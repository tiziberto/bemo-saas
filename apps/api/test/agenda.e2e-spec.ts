import { INestApplication } from '@nestjs/common';
import { createTestApp, http, uniqueDni } from './utils/harness';
import {
  addMember,
  atArgentina,
  book,
  bookRequest,
  createRoom,
  createWeeklyAvailability,
  futureDate,
  registerClinic,
  type Session,
} from './utils/fixtures';

describe('Agenda: huecos, choques y concurrencia', () => {
  let app: INestApplication;
  let admin: Session;
  let profA: Session;
  let profB: Session;
  let roomId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const clinic = await registerClinic(app, 'Clínica agenda');
    admin = clinic.admin;
    profA = await addMember(app, admin, 'professional', 'Prof A');
    profB = await addMember(app, admin, 'professional', 'Prof B');
    roomId = (await createRoom(app, admin, 'Sala única')).id;
    await createWeeklyAvailability(app, admin, profA.userId, { slotMinutes: 30 });
    await createWeeklyAvailability(app, admin, profB.userId, { slotMinutes: 30 });
  });

  afterAll(async () => app.close());

  it('la disponibilidad genera los huecos esperados (09:00 a 13:00 cada 30 min = 8)', async () => {
    const date = futureDate(60);
    const res = await http(app)
      .get(`/v1/availability?professionalId=${profA.userId}&date=${date}`)
      .set('authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(res.body).toHaveLength(8);
  });

  it('agendar saca ese hueco de la lista', async () => {
    const date = futureDate(61);
    await book(app, admin, {
      professionalId: profA.userId,
      startsAt: atArgentina(date, '09:00'),
    });
    const res = await http(app)
      .get(`/v1/availability?professionalId=${profA.userId}&date=${date}`)
      .set('authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(res.body).toHaveLength(7);
    expect(res.body.map((s: { start: string }) => s.start)).not.toContain(
      expect.stringContaining('T12:00:00'),
    );
  });

  it('dos turnos superpuestos del mismo profesional → 409', async () => {
    const date = futureDate(62);
    await book(app, admin, {
      professionalId: profA.userId,
      startsAt: atArgentina(date, '10:00'),
      durationMinutes: 30,
    });
    const res = await bookRequest(app, admin, {
      professionalId: profA.userId,
      startsAt: atArgentina(date, '10:15'), // se pisa con el anterior
      durationMinutes: 30,
    }).expect(409);
    expect(res.body.code).toBe('PROFESSIONAL_SLOT_TAKEN');
  });

  it('dos profesionales distintos en la MISMA sala y horario → 409 de sala', async () => {
    const date = futureDate(63);
    await book(app, admin, {
      professionalId: profA.userId,
      startsAt: atArgentina(date, '11:00'),
      roomId,
    });
    const res = await bookRequest(app, admin, {
      professionalId: profB.userId,
      startsAt: atArgentina(date, '11:00'),
      roomId,
    }).expect(409);
    expect(res.body.code).toBe('ROOM_SLOT_TAKEN');
  });

  it('dos profesionales distintos en el mismo horario y SIN sala conviven', async () => {
    const date = futureDate(64);
    await book(app, admin, {
      professionalId: profA.userId,
      startsAt: atArgentina(date, '12:00'),
    });
    await book(app, admin, {
      professionalId: profB.userId,
      startsAt: atArgentina(date, '12:00'),
    });
  });

  it('cancelar libera el hueco', async () => {
    const date = futureDate(65);
    const appt = await book(app, admin, {
      professionalId: profA.userId,
      startsAt: atArgentina(date, '09:30'),
    });

    const ocupado = await http(app)
      .get(`/v1/availability?professionalId=${profA.userId}&date=${date}`)
      .set('authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(ocupado.body).toHaveLength(7);

    await http(app)
      .patch(`/v1/appointments/${appt.id}/status`)
      .set('authorization', `Bearer ${admin.token}`)
      .send({ status: 'cancelled' })
      .expect(200);

    const libre = await http(app)
      .get(`/v1/availability?professionalId=${profA.userId}&date=${date}`)
      .set('authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(libre.body).toHaveLength(8);
  });

  it('el hueco liberado se puede volver a agendar', async () => {
    const date = futureDate(66);
    const appt = await book(app, admin, {
      professionalId: profA.userId,
      startsAt: atArgentina(date, '09:00'),
    });
    await http(app)
      .patch(`/v1/appointments/${appt.id}/status`)
      .set('authorization', `Bearer ${admin.token}`)
      .send({ status: 'cancelled' })
      .expect(200);
    await bookRequest(app, admin, {
      professionalId: profA.userId,
      startsAt: atArgentina(date, '09:00'),
    }).expect(201);
  });

  /**
   * El gate de la etapa 3: la garantía no es del código de aplicación sino del
   * constraint EXCLUDE de Postgres. Dos reservas al mismo slot, en paralelo.
   */
  it('CONCURRENCIA: dos reservas simultáneas al mismo slot → exactamente 1 éxito y 1 conflicto', async () => {
    const date = futureDate(67);
    const startsAt = atArgentina(date, '10:30');

    const results = await Promise.all([
      bookRequest(app, admin, { professionalId: profA.userId, startsAt, dni: uniqueDni() }),
      bookRequest(app, admin, { professionalId: profA.userId, startsAt, dni: uniqueDni() }),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    const conflicto = results.find((r) => r.status === 409)!;
    expect(conflicto.body.code).toBe('PROFESSIONAL_SLOT_TAKEN');
  });

  /**
   * Regresión: con muchas reservas simultáneas las transacciones se esperan
   * entre sí por el EXCLUDE y el grafo de esperas puede ciclar. Postgres mataba
   * transacciones con deadlock (40P01) y la recepción veía un 500 en vez de "ese
   * horario se acaba de ocupar". Se arregló serializando por profesional y sala
   * con un advisory lock antes de tocar el constraint.
   *
   * Las dos propiedades que importan: nunca dos turnos en el mismo horario, y
   * nunca un 5xx. (Un request puede morir a nivel socket por límites del
   * servidor efímero de los tests; eso no es una respuesta de la aplicación y se
   * cuenta aparte.)
   */
  it('CONCURRENCIA: diez reservas simultáneas → como máximo 1 éxito y ningún 500', async () => {
    const date = futureDate(68);
    const startsAt = atArgentina(date, '11:30');

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        bookRequest(app, admin, {
          professionalId: profB.userId,
          startsAt,
          dni: uniqueDni(),
        })
          .then((r) => ({ status: r.status, code: r.body?.code as string | undefined }))
          .catch(() => ({ status: 0, code: 'SOCKET' })),
      ),
    );

    const detalle = results.map((r) => `${r.status}:${r.code ?? ''}`).join(' ');
    const exitos = results.filter((r) => r.status === 201).length;
    const conflictos = results.filter((r) => r.status === 409).length;
    const servidor = results.filter((r) => r.status >= 500).length;

    expect({ servidor, detalle }).toEqual({ servidor: 0, detalle });
    expect({ exitos, detalle }).toEqual({ exitos: 1, detalle });
    expect({ conflictos, detalle }).toEqual({ conflictos: 9, detalle });
    // Y en la base quedó exactamente uno.
    const agenda = await http(app)
      .get(`/v1/appointments?date=${date}&professionalId=${profB.userId}`)
      .set('authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(agenda.body).toHaveLength(1);
  });

  describe('zona horaria', () => {
    it('un turno a las 23:30 de Buenos Aires cae en ese día, no en el siguiente', async () => {
      const date = futureDate(70);
      // 23:30 en AR (UTC-3) es 02:30 UTC del día siguiente: el filtro por fecha
      // tiene que usar la zona de la clínica, no UTC.
      const appt = await book(app, admin, {
        professionalId: profA.userId,
        startsAt: atArgentina(date, '23:30'),
      });

      const mismoDia = await http(app)
        .get(`/v1/appointments?date=${date}`)
        .set('authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(mismoDia.body.map((x: { id: string }) => x.id)).toContain(appt.id);

      const diaSiguiente = await http(app)
        .get(`/v1/appointments?date=${futureDate(71)}`)
        .set('authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(diaSiguiente.body.map((x: { id: string }) => x.id)).not.toContain(appt.id);
    });

    it('un turno a las 00:30 de Buenos Aires no aparece en el día anterior', async () => {
      const date = futureDate(72);
      const appt = await book(app, admin, {
        professionalId: profA.userId,
        startsAt: atArgentina(date, '00:30'),
      });

      const anterior = await http(app)
        .get(`/v1/appointments?date=${futureDate(71)}`)
        .set('authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(anterior.body.map((x: { id: string }) => x.id)).not.toContain(appt.id);

      const propio = await http(app)
        .get(`/v1/appointments?date=${date}`)
        .set('authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(propio.body.map((x: { id: string }) => x.id)).toContain(appt.id);
    });
  });

  it('agendar con el mismo DNI reutiliza la ficha, no duplica la persona', async () => {
    const dni = uniqueDni();
    const date = futureDate(75);
    const uno = await book(app, admin, {
      professionalId: profA.userId,
      startsAt: atArgentina(date, '09:00'),
      dni,
      firstName: 'Repetido',
      lastName: 'Paciente',
    });
    const dos = await book(app, admin, {
      professionalId: profA.userId,
      startsAt: atArgentina(date, '09:30'),
      dni,
      firstName: 'Repetido',
      lastName: 'Paciente',
    });
    expect(uno.person_id).toBe(dos.person_id);
  });

  it('rechaza un estado inventado', async () => {
    const appt = await book(app, admin, {
      professionalId: profA.userId,
      startsAt: atArgentina(futureDate(76), '10:00'),
    });
    await http(app)
      .patch(`/v1/appointments/${appt.id}/status`)
      .set('authorization', `Bearer ${admin.token}`)
      .send({ status: 'inventado' })
      .expect(400);
  });
});

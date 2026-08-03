import { INestApplication } from '@nestjs/common';
import { createTestApp, http, uniqueDni } from './utils/harness';
import {
  addMember,
  atArgentina,
  book,
  createWeeklyAvailability,
  futureDate,
  registerClinic,
  type Session,
} from './utils/fixtures';

/**
 * Los huecos que ve la recepción al agendar: semana tipo, menos lo ocupado,
 * menos los bloqueos, más las aperturas puntuales.
 */
describe('Disponibilidad: bloqueos, aperturas y rango semanal', () => {
  let app: INestApplication;
  let admin: Session;
  let prof: Session;
  let recep: Session;

  const slots = (actor: Session, query: string) =>
    http(app).get(`/v1/availability?${query}`).set('authorization', `Bearer ${actor.token}`);

  beforeAll(async () => {
    app = await createTestApp();
    const clinic = await registerClinic(app, 'Clínica disponibilidad');
    admin = clinic.admin;
    prof = await addMember(app, admin, 'professional', 'Dra. Agenda');
    recep = await addMember(app, admin, 'receptionist', 'Recepción');
    // 09:00–13:00 todos los días, turnos de 30 min → 8 huecos por día.
    await createWeeklyAvailability(app, admin, prof.userId);
  });

  afterAll(async () => app.close());

  it('un rango de 7 días devuelve los huecos de toda la semana', async () => {
    const from = futureDate(400);
    const to = futureDate(406);
    const res = await slots(recep, `professionalId=${prof.userId}&from=${from}&to=${to}`).expect(
      200,
    );
    expect(res.body).toHaveLength(8 * 7);
  });

  it('sigue funcionando pedir un solo día', async () => {
    const res = await slots(recep, `professionalId=${prof.userId}&date=${futureDate(410)}`).expect(
      200,
    );
    expect(res.body).toHaveLength(8);
  });

  describe('bloqueos de agenda', () => {
    it('bloquear el día completo lo deja sin huecos', async () => {
      const dia = futureDate(420);
      await http(app)
        .post('/v1/availability-exceptions')
        .set('authorization', `Bearer ${admin.token}`)
        .send({ professionalId: prof.userId, date: dia, kind: 'remove' })
        .expect(201);

      const res = await slots(recep, `professionalId=${prof.userId}&date=${dia}`).expect(200);
      expect(res.body).toEqual([]);
    });

    it('bloquear un rato saca sólo esos huecos', async () => {
      const dia = futureDate(421);
      await http(app)
        .post('/v1/availability-exceptions')
        .set('authorization', `Bearer ${admin.token}`)
        .send({
          professionalId: prof.userId,
          date: dia,
          kind: 'remove',
          startTime: '09:00',
          endTime: '11:00',
        })
        .expect(201);

      const res = await slots(recep, `professionalId=${prof.userId}&date=${dia}`).expect(200);
      // De 8 huecos quedan los 4 de 11:00 a 13:00.
      expect(res.body).toHaveLength(4);
      expect(res.body[0].start).toContain('T14:00:00'); // 11:00 AR = 14:00 UTC
    });

    it('el bloqueo del día no afecta al resto de la semana', async () => {
      const bloqueado = futureDate(420);
      const siguiente = futureDate(422);
      const res = await slots(
        recep,
        `professionalId=${prof.userId}&from=${bloqueado}&to=${siguiente}`,
      ).expect(200);
      // 3 días: uno bloqueado, uno con bloqueo parcial (4) y uno entero (8).
      expect(res.body).toHaveLength(12);
    });

    it('quitar el bloqueo devuelve los huecos', async () => {
      const dia = futureDate(423);
      const creado = await http(app)
        .post('/v1/availability-exceptions')
        .set('authorization', `Bearer ${admin.token}`)
        .send({ professionalId: prof.userId, date: dia, kind: 'remove' })
        .expect(201);

      expect((await slots(recep, `professionalId=${prof.userId}&date=${dia}`)).body).toEqual([]);

      await http(app)
        .delete(`/v1/availability-exceptions/${creado.body.id}`)
        .set('authorization', `Bearer ${admin.token}`)
        .expect(200);

      const res = await slots(recep, `professionalId=${prof.userId}&date=${dia}`).expect(200);
      expect(res.body).toHaveLength(8);
    });

    it('un turno ya agendado no aparece como hueco, aunque el día esté abierto', async () => {
      const dia = futureDate(424);
      await book(app, admin, {
        professionalId: prof.userId,
        startsAt: atArgentina(dia, '09:00'),
        dni: uniqueDni(),
      });
      const res = await slots(recep, `professionalId=${prof.userId}&date=${dia}`).expect(200);
      expect(res.body).toHaveLength(7);
    });
  });

  describe('aperturas puntuales', () => {
    it('abrir horas extra agrega huecos a ese día', async () => {
      const dia = futureDate(430);
      const antes = (await slots(recep, `professionalId=${prof.userId}&date=${dia}`)).body.length;

      await http(app)
        .post('/v1/availability-exceptions')
        .set('authorization', `Bearer ${admin.token}`)
        .send({
          professionalId: prof.userId,
          date: dia,
          kind: 'add',
          startTime: '18:00',
          endTime: '20:00',
        })
        .expect(201);

      const res = await slots(recep, `professionalId=${prof.userId}&date=${dia}`).expect(200);
      expect(res.body).toHaveLength(antes + 4); // 2 h en turnos de 30 min
    });
  });

  describe('permisos', () => {
    it('la recepción no puede bloquear la agenda de nadie', async () => {
      const res = await http(app)
        .post('/v1/availability-exceptions')
        .set('authorization', `Bearer ${recep.token}`)
        .send({ professionalId: prof.userId, date: futureDate(440), kind: 'remove' })
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('un profesional no puede bloquear la agenda de otro', async () => {
      const otro = await addMember(app, admin, 'professional', 'Otro');
      const res = await http(app)
        .post('/v1/availability-exceptions')
        .set('authorization', `Bearer ${prof.token}`)
        .send({ professionalId: otro.userId, date: futureDate(441), kind: 'remove' })
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN_PROFESSIONAL');
    });

    it('borrar un horario de otro profesional da 403', async () => {
      const otro = await addMember(app, admin, 'professional', 'Ajeno');
      await createWeeklyAvailability(app, admin, otro.userId);
      const bloques = await http(app)
        .get(`/v1/availability-blocks?professionalId=${otro.userId}`)
        .set('authorization', `Bearer ${admin.token}`)
        .expect(200);

      const res = await http(app)
        .delete(`/v1/availability-blocks/${bloques.body[0].id}`)
        .set('authorization', `Bearer ${prof.token}`)
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN_PROFESSIONAL');
    });

    it('el admin sí puede borrar un horario', async () => {
      const bloques = await http(app)
        .get(`/v1/availability-blocks?professionalId=${prof.userId}`)
        .set('authorization', `Bearer ${admin.token}`)
        .expect(200);
      const antes = bloques.body.length;

      await http(app)
        .delete(`/v1/availability-blocks/${bloques.body[0].id}`)
        .set('authorization', `Bearer ${admin.token}`)
        .expect(200);

      const despues = await http(app)
        .get(`/v1/availability-blocks?professionalId=${prof.userId}`)
        .set('authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(despues.body).toHaveLength(antes - 1);
    });

    it('los bloqueos no cruzan clínicas', async () => {
      const otra = await registerClinic(app, 'Clínica vecina');
      const res = await http(app)
        .get(`/v1/availability-exceptions?professionalId=${prof.userId}`)
        .set('authorization', `Bearer ${otra.admin.token}`)
        .expect(200);
      expect(res.body).toEqual([]);
    });
  });
});

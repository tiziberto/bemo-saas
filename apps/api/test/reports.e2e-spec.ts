import { INestApplication } from '@nestjs/common';
import { createTestApp, http, uniqueDni } from './utils/harness';
import {
  addMember,
  atArgentina,
  book,
  createPatient,
  createWeeklyAvailability,
  futureDate,
  registerClinic,
  type Session,
} from './utils/fixtures';

/**
 * Reportes: no-show, ocupación y pacientes nuevos.
 *
 * Se siembra un período controlado y se verifican los números exactos: un
 * reporte que no cierra con la aritmética es peor que no tener reporte.
 */
describe('Reportes del consultorio', () => {
  let app: INestApplication;
  let admin: Session;
  let prof: Session;
  let otroProf: Session;
  let recep: Session;

  const from = futureDate(300);
  const to = futureDate(300);

  beforeAll(async () => {
    app = await createTestApp();
    const clinic = await registerClinic(app, 'Clínica reportes');
    admin = clinic.admin;
    prof = await addMember(app, admin, 'professional', 'Dra. Reportes');
    otroProf = await addMember(app, admin, 'professional', 'Dr. Sin Turnos');
    recep = await addMember(app, admin, 'receptionist', 'Recepción');

    // 4 horas de atención por día (09:00–13:00) = 240 minutos.
    await createWeeklyAvailability(app, admin, prof.userId);

    // Un solo día con 4 turnos de 30 minutos: 2 atendidos, 1 no vino, 1 cancelado.
    const estados = ['completed', 'completed', 'no_show', 'cancelled'];
    const horas = ['09:00', '09:30', '10:00', '10:30'];
    for (let i = 0; i < 4; i++) {
      const appt = await book(app, admin, {
        professionalId: prof.userId,
        startsAt: atArgentina(from, horas[i]),
        durationMinutes: 30,
        dni: uniqueDni(),
      });
      await http(app)
        .patch(`/v1/appointments/${appt.id}/status`)
        .set('authorization', `Bearer ${admin.token}`)
        .send({ status: estados[i] })
        .expect(200);
    }

    // Dos pacientes cargados a mano por el profesional. Los 4 de arriba también
    // cuentan como suyos: agendar un turno suma al paciente a la lista del
    // profesional del turno.
    await createPatient(app, prof, { dni: uniqueDni() });
    await createPatient(app, prof, { dni: uniqueDni() });
  });

  afterAll(async () => app.close());

  const summary = (actor: Session, extra = '') =>
    http(app)
      .get(`/v1/reports/summary?from=${from}&to=${to}${extra}`)
      .set('authorization', `Bearer ${actor.token}`);

  it('cuenta los turnos por estado', async () => {
    const res = await summary(admin).expect(200);
    const fila = res.body.find((r: any) => r.professional_id === prof.userId);
    expect(fila).toMatchObject({
      total: 4,
      completed: 2,
      no_show: 1,
      cancelled: 1,
    });
  });

  it('la tasa de no-show mide sobre los turnos que llegaron a término', async () => {
    const res = await summary(admin).expect(200);
    const fila = res.body.find((r: any) => r.professional_id === prof.userId);
    // 1 ausencia sobre 3 turnos que ocurrieron (2 atendidos + 1 no vino) = 33.3%.
    // El cancelado no cuenta: avisar no es lo mismo que no aparecer.
    expect(fila.no_show_rate).toBeCloseTo(33.3, 1);
  });

  it('la ocupación compara lo agendado contra las horas configuradas', async () => {
    const res = await summary(admin).expect(200);
    const fila = res.body.find((r: any) => r.professional_id === prof.userId);
    // 3 turnos activos × 30 min = 90 minutos sobre 240 configurados = 37.5%.
    expect(fila.available_minutes).toBe(240);
    expect(fila.booked_minutes).toBe(90);
    expect(fila.occupancy_rate).toBeCloseTo(37.5, 1);
  });

  it('cuenta los pacientes nuevos por la fecha en que se sumaron a la lista', async () => {
    // Los turnos de este test están en el futuro, pero los pacientes se dieron
    // de alta hoy: el período de "nuevos" es el de la fecha de alta.
    //
    // Son 6: los 4 que entraron por un turno más los 2 cargados a mano. Antes
    // eran 2 porque agendar no sumaba a nadie a la lista del profesional, que
    // es justamente lo que se arregló.
    const hoy = futureDate(0);
    const res = await http(app)
      .get(`/v1/reports/summary?from=${futureDate(-1)}&to=${futureDate(1)}`)
      .set('authorization', `Bearer ${admin.token}`)
      .expect(200);
    const fila = res.body.find((r: any) => r.professional_id === prof.userId);
    expect(fila.new_patients).toBe(6);
    expect(hoy).toBeTruthy();
  });

  it('un profesional sin actividad aparece en cero, no desaparece', async () => {
    const res = await summary(admin).expect(200);
    const fila = res.body.find((r: any) => r.professional_id === otroProf.userId);
    expect(fila).toMatchObject({ total: 0, no_show: 0, occupancy_rate: 0 });
  });

  it('un profesional sólo ve sus propios números, aunque pida los de otro', async () => {
    const res = await summary(prof, `&professionalId=${otroProf.userId}`).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].professional_id).toBe(prof.userId);
  });

  it('la recepción no accede a los reportes', async () => {
    const res = await summary(recep).expect(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('sin token no hay reportes', async () => {
    await http(app).get(`/v1/reports/summary?from=${from}&to=${to}`).expect(401);
  });

  it('la serie diaria devuelve un punto por día, incluidos los vacíos', async () => {
    const desde = futureDate(299);
    const hasta = futureDate(301);
    const res = await http(app)
      .get(`/v1/reports/daily?from=${desde}&to=${hasta}`)
      .set('authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(res.body).toHaveLength(3);
    const conTurnos = res.body.filter((d: any) => d.total > 0);
    expect(conTurnos).toHaveLength(1);
    expect(conTurnos[0].total).toBe(3); // el cancelado no cuenta
    expect(conTurnos[0].no_show).toBe(1);
  });

  it('los reportes no cruzan clínicas', async () => {
    const otra = await registerClinic(app, 'Clínica ajena');
    const res = await http(app)
      .get(`/v1/reports/summary?from=${from}&to=${to}`)
      .set('authorization', `Bearer ${otra.admin.token}`)
      .expect(200);
    const ids = res.body.map((r: any) => r.professional_id);
    expect(ids).not.toContain(prof.userId);
  });
});

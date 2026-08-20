import { INestApplication } from '@nestjs/common';
import { createTestApp, http, uniqueDni } from './utils/harness';
import {
  addMember,
  atArgentina,
  book,
  bookRequest,
  createPatient,
  createRoom,
  createWeeklyAvailability,
  futureDate,
  registerClinic,
  type Session,
} from './utils/fixtures';

/**
 * El gate de seguridad innegociable del roadmap: dos clínicas sembradas y cero
 * fuga entre ellas en TODOS los list/get.
 *
 * Se prueba contra la API real, no contra las policies sueltas: lo que importa
 * es que un token de la clínica A no vea nada de la B por ningún camino.
 */
describe('Aislamiento entre clínicas', () => {
  let app: INestApplication;

  let aAdmin: Session;
  let aProf: Session;
  let bAdmin: Session;
  let bProf: Session;

  const a = { roomId: '', apptId: '', personId: '', dni: uniqueDni() };
  const b = { roomId: '', apptId: '', personId: '', dni: uniqueDni() };

  beforeAll(async () => {
    app = await createTestApp();

    const clinicA = await registerClinic(app, 'Clínica A');
    aAdmin = clinicA.admin;
    aProf = await addMember(app, aAdmin, 'professional', 'Prof A');

    const clinicB = await registerClinic(app, 'Clínica B');
    bAdmin = clinicB.admin;
    bProf = await addMember(app, bAdmin, 'professional', 'Prof B');

    for (const [clinic, admin, prof, data] of [
      ['A', aAdmin, aProf, a],
      ['B', bAdmin, bProf, b],
    ] as const) {
      const room = await createRoom(app, admin, `Sala ${clinic}`);
      data.roomId = room.id;
      await createWeeklyAvailability(app, admin, prof.userId);
      const appt = await book(app, admin, {
        professionalId: prof.userId,
        startsAt: atArgentina(futureDate(21), '09:00'),
        roomId: room.id,
        dni: data.dni,
        firstName: `Paciente${clinic}`,
        lastName: clinic,
      });
      data.apptId = appt.id;
      const patient = await createPatient(app, prof, {
        dni: data.dni,
        firstName: `Paciente${clinic}`,
        lastName: clinic,
      });
      data.personId = patient.personId;
      await http(app)
        .post(`/v1/patients/${data.personId}/clinical-entries`)
        .set('authorization', `Bearer ${prof.token}`)
        .send({ type: 'note', content: `Historia privada de ${clinic}` })
        .expect(201);
    }
  });

  afterAll(async () => app.close());

  it('GET /rooms devuelve sólo las salas propias', async () => {
    const res = await http(app)
      .get('/v1/rooms')
      .set('authorization', `Bearer ${aAdmin.token}`)
      .expect(200);
    const ids = res.body.map((r: { id: string }) => r.id);
    expect(ids).toContain(a.roomId);
    expect(ids).not.toContain(b.roomId);
  });

  it('GET /users devuelve sólo el equipo propio', async () => {
    const res = await http(app)
      .get('/v1/users')
      .set('authorization', `Bearer ${aAdmin.token}`)
      .expect(200);
    const emails = res.body.map((u: { email: string }) => u.email);
    expect(emails).toContain(aProf.email);
    expect(emails).not.toContain(bProf.email);
    expect(emails).not.toContain(bAdmin.email);
  });

  it('GET /users/professionals no cruza clínicas', async () => {
    const res = await http(app)
      .get('/v1/users/professionals')
      .set('authorization', `Bearer ${aAdmin.token}`)
      .expect(200);
    const ids = res.body.map((u: { id: string }) => u.id);
    expect(ids).toContain(aProf.userId);
    expect(ids).not.toContain(bProf.userId);
  });

  it('GET /appointments no muestra turnos de la otra clínica', async () => {
    const res = await http(app)
      .get('/v1/appointments')
      .set('authorization', `Bearer ${aAdmin.token}`)
      .expect(200);
    const ids = res.body.map((x: { id: string }) => x.id);
    expect(ids).toContain(a.apptId);
    expect(ids).not.toContain(b.apptId);
  });

  it('GET /appointments filtrando por un profesional ajeno devuelve vacío', async () => {
    const res = await http(app)
      .get(`/v1/appointments?professionalId=${bProf.userId}`)
      .set('authorization', `Bearer ${aAdmin.token}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /availability-blocks no cruza clínicas', async () => {
    const res = await http(app)
      .get('/v1/availability-blocks')
      .set('authorization', `Bearer ${aAdmin.token}`)
      .expect(200);
    const profIds = res.body.map((x: { professional_id: string }) => x.professional_id);
    expect(profIds).toContain(aProf.userId);
    expect(profIds).not.toContain(bProf.userId);
  });

  it('GET /availability de un profesional ajeno no devuelve huecos', async () => {
    const res = await http(app)
      .get(`/v1/availability?professionalId=${bProf.userId}&date=${futureDate(22)}`)
      .set('authorization', `Bearer ${aAdmin.token}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /patients no muestra pacientes de la otra clínica', async () => {
    const res = await http(app)
      .get('/v1/patients')
      .set('authorization', `Bearer ${aProf.token}`)
      .expect(200);
    const ids = res.body.map((p: { id: string }) => p.id);
    expect(ids).toContain(a.personId);
    expect(ids).not.toContain(b.personId);
  });

  it('leer la historia de un paciente de otra clínica da 403', async () => {
    const res = await http(app)
      .get(`/v1/patients/${b.personId}/clinical-entries`)
      .set('authorization', `Bearer ${aProf.token}`)
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN_HISTORY');
  });

  it('escribir en la historia de un paciente de otra clínica da 403', async () => {
    const res = await http(app)
      .post(`/v1/patients/${b.personId}/clinical-entries`)
      .set('authorization', `Bearer ${aProf.token}`)
      .send({ type: 'note', content: 'No debería entrar' })
      .expect(403);
    expect(res.body.code).toBe('NOT_YOUR_PATIENT');
  });

  it('cambiar el estado de un turno de otra clínica da 404, no un 200 vacío', async () => {
    const res = await http(app)
      .patch(`/v1/appointments/${b.apptId}/status`)
      .set('authorization', `Bearer ${aAdmin.token}`)
      .send({ status: 'cancelled' })
      .expect(404);
    expect(res.body.code).toBe('APPOINTMENT_NOT_FOUND');

    // Y el turno de B sigue intacto.
    const check = await http(app)
      .get('/v1/appointments')
      .set('authorization', `Bearer ${bAdmin.token}`)
      .expect(200);
    const target = check.body.find((x: { id: string }) => x.id === b.apptId);
    expect(target.status).toBe('scheduled');
  });

  it('compartir con un profesional de otra clínica no expone la historia al resto', async () => {
    // El compartir cross-clínica es la ÚNICA excepción al aislamiento y es explícito.
    await http(app)
      .post(`/v1/patients/${a.personId}/shares`)
      .set('authorization', `Bearer ${aProf.token}`)
      .send({ sharedWithProfessionalId: bProf.userId })
      .expect(201);

    // El destinatario sí ve la historia…
    const shared = await http(app)
      .get(`/v1/patients/${a.personId}/clinical-entries`)
      .set('authorization', `Bearer ${bProf.token}`)
      .expect(200);
    expect(shared.body.length).toBeGreaterThan(0);

    // …pero el admin de esa clínica, que no es el destinatario, no.
    const otro = await http(app)
      .get(`/v1/patients/${a.personId}/clinical-entries`)
      .set('authorization', `Bearer ${bAdmin.token}`)
      .expect(403);
    expect(otro.body.code).toBe('FORBIDDEN_HISTORY');
  });

  it('un token de A no puede invitar gente a B', async () => {
    // El clinicId viaja en el token: no hay forma de pedir "invitar a la clínica B".
    const res = await http(app)
      .post('/v1/users/invite')
      .set('authorization', `Bearer ${aAdmin.token}`)
      .send({ email: `cruzado-${Date.now()}@test.local`, role: 'professional' })
      .expect(201);
    expect(res.body.inviteToken).toEqual(expect.any(String));

    const equipoB = await http(app)
      .get('/v1/users')
      .set('authorization', `Bearer ${bAdmin.token}`)
      .expect(200);
    expect(equipoB.body.map((u: { email: string }) => u.email)).not.toContain(
      res.body.email,
    );
  });

// ── Escritura cruzada ─────────────────────────────────────────────────────
  // RLS impide LEER lo de otra clínica, pero no impedía ESCRIBIR una fila propia
  // que apunte a algo ajeno. Encontrado probando el sistema: la clínica B podía
  // agendar con el profesional de A, y como los EXCLUDE anti-solapamiento son
  // por professional_id a nivel tabla, le ocupaba la agenda de verdad. A veía el
  // horario libre y recibía 409 al intentar usarlo. Lo cierran las FK compuestas.

  it('B no puede agendar con un profesional de A', async () => {
    const res = await bookRequest(app, bAdmin, {
      professionalId: aProf.userId,
      startsAt: atArgentina(futureDate(90), '09:00'),
    }).expect(404);
    expect(res.body.code).toBe('FUERA_DE_LA_CLINICA');
  });

  it('B no puede agendar en una sala de A', async () => {
    const res = await bookRequest(app, bAdmin, {
      professionalId: bProf.userId,
      roomId: a.roomId,
      startsAt: atArgentina(futureDate(91), '09:00'),
    }).expect(404);
    expect(res.body.code).toBe('FUERA_DE_LA_CLINICA');
  });

  it('B no puede asignar especialidades a un profesional de A', async () => {
    await http(app)
      .put(`/v1/users/${aProf.userId}/specialties`)
      .set('authorization', `Bearer ${bAdmin.token}`)
      .send({ specialtyIds: [] })
      .expect(404);
  });
});

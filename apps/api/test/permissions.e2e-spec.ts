import { INestApplication } from '@nestjs/common';
import { createTestApp, http } from './utils/harness';
import {
  addMember,
  atArgentina,
  book,
  createRoom,
  createWeeklyAvailability,
  futureDate,
  registerClinic,
  type Session,
} from './utils/fixtures';

/**
 * Matriz de autorización: cada celda de "quién puede hacer qué".
 *
 * Se escribe como tabla a propósito. Cuando se agregue un endpoint nuevo, sumar
 * una fila acá es más barato que descubrir en producción que la recepción podía
 * leer historias clínicas.
 */
describe('Matriz de permisos por rol', () => {
  let app: INestApplication;
  let admin: Session; // admin + professional (el dueño)
  let prof: Session; // professional puro
  let recep: Session; // receptionist puro
  let roomId: string;
  let apptId: string;
  let personId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const clinic = await registerClinic(app, 'Clínica de permisos');
    admin = clinic.admin;
    prof = await addMember(app, admin, 'professional', 'Dr. Profesional');
    recep = await addMember(app, admin, 'receptionist', 'Recepción');

    const room = await createRoom(app, admin);
    roomId = room.id;
    await createWeeklyAvailability(app, admin, prof.userId);

    const appt = await http(app)
      .post('/v1/appointments')
      .set('authorization', `Bearer ${admin.token}`)
      .send({
        professionalId: prof.userId,
        startsAt: atArgentina(futureDate(30), '09:00'),
        durationMinutes: 30,
        person: { dni: '39111222', firstName: 'Test', lastName: 'Permisos' },
      })
      .expect(201);
    apptId = appt.body.id;

    const patient = await http(app)
      .post('/v1/patients')
      .set('authorization', `Bearer ${prof.token}`)
      .send({ dni: '39111222', firstName: 'Test', lastName: 'Permisos' })
      .expect(201);
    personId = patient.body.personId;
  });

  afterAll(async () => app.close());

  type Actor = 'admin' | 'professional' | 'receptionist';
  const sessionOf = (a: Actor): Session =>
    a === 'admin' ? admin : a === 'professional' ? prof : recep;

  interface Case {
    name: string;
    method: 'get' | 'post' | 'patch' | 'delete';
    path: () => string;
    body?: () => Record<string, unknown>;
    /** Estado esperado por rol. 2xx = permitido. */
    expected: Record<Actor, number>;
  }

  const cases: Case[] = [
    {
      name: 'GET /rooms',
      method: 'get',
      path: () => '/v1/rooms',
      expected: { admin: 200, professional: 200, receptionist: 200 },
    },
    {
      name: 'POST /rooms',
      method: 'post',
      path: () => '/v1/rooms',
      body: () => ({ name: `Sala ${Math.random().toString(36).slice(2, 8)}` }),
      expected: { admin: 201, professional: 403, receptionist: 403 },
    },
    {
      name: 'GET /users (equipo completo)',
      method: 'get',
      path: () => '/v1/users',
      expected: { admin: 200, professional: 403, receptionist: 403 },
    },
    {
      name: 'GET /users/professionals',
      method: 'get',
      path: () => '/v1/users/professionals',
      expected: { admin: 200, professional: 200, receptionist: 200 },
    },
    {
      name: 'POST /users/invite',
      method: 'post',
      path: () => '/v1/users/invite',
      body: () => ({
        email: `inv-${Math.random().toString(36).slice(2, 10)}@test.local`,
        role: 'professional',
      }),
      expected: { admin: 201, professional: 403, receptionist: 403 },
    },
    {
      name: 'GET /availability-blocks',
      method: 'get',
      path: () => '/v1/availability-blocks',
      expected: { admin: 200, professional: 200, receptionist: 200 },
    },
    {
      name: 'POST /availability-blocks (propios)',
      method: 'post',
      path: () => '/v1/availability-blocks',
      body: () => ({ weekday: 3, startTime: '15:00', endTime: '16:00', slotMinutes: 30 }),
      expected: { admin: 201, professional: 201, receptionist: 403 },
    },
    {
      name: 'GET /availability',
      method: 'get',
      path: () => `/v1/availability?professionalId=${prof.userId}&date=${futureDate(31)}`,
      expected: { admin: 200, professional: 200, receptionist: 200 },
    },
    {
      name: 'GET /appointments',
      method: 'get',
      path: () => '/v1/appointments',
      expected: { admin: 200, professional: 200, receptionist: 200 },
    },
    {
      name: 'POST /appointments (agendar)',
      method: 'post',
      path: () => '/v1/appointments',
      body: () => ({
        professionalId: prof.userId,
        startsAt: atArgentina(futureDate(40 + Math.floor(Math.random() * 40)), '10:00'),
        durationMinutes: 30,
        roomId,
        person: { dni: '39111333', firstName: 'Otro', lastName: 'Paciente' },
      }),
      expected: { admin: 201, professional: 403, receptionist: 201 },
    },
    {
      // El profesional SÍ puede: sin esto no puede marcar "Llegó" ni "Atender"
      // de sus propios turnos y la sala de espera la tendría que operar
      // recepción. El turno de esta matriz es suyo. Que no pueda tocar los de
      // OTRO profesional se prueba aparte, más abajo.
      name: 'PATCH /appointments/:id/status',
      method: 'patch',
      path: () => `/v1/appointments/${apptId}/status`,
      body: () => ({ status: 'confirmed' }),
      expected: { admin: 200, professional: 200, receptionist: 200 },
    },
    {
      name: 'GET /patients',
      method: 'get',
      path: () => '/v1/patients',
      expected: { admin: 200, professional: 200, receptionist: 403 },
    },
    {
      name: 'GET /patients/:id/clinical-entries (historia clínica)',
      method: 'get',
      path: () => `/v1/patients/${personId}/clinical-entries`,
      expected: { admin: 403, professional: 200, receptionist: 403 },
    },
    {
      name: 'POST /patients/:id/clinical-entries',
      method: 'post',
      path: () => `/v1/patients/${personId}/clinical-entries`,
      body: () => ({ type: 'note', content: 'Entrada de prueba.' }),
      expected: { admin: 403, professional: 201, receptionist: 403 },
    },
  ];

  const actors: Actor[] = ['admin', 'professional', 'receptionist'];

  for (const c of cases) {
    for (const actor of actors) {
      const expected = c.expected[actor];
      const verb = expected < 400 ? 'puede' : 'NO puede';
      it(`${actor} ${verb} · ${c.name} → ${expected}`, async () => {
        const req = http(app)
          [c.method](c.path())
          .set('authorization', `Bearer ${sessionOf(actor).token}`);
        const res = await (c.body ? req.send(c.body()) : req);
        expect(res.status).toBe(expected);
        if (expected === 403) expect(res.body.code).toBeDefined();
      });
    }

    it(`sin token · ${c.name} → 401`, async () => {
      const req = http(app)[c.method](c.path());
      const res = await (c.body ? req.send(c.body()) : req);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('NO_TOKEN');
    });
  }

  it('un profesional no puede cargar la disponibilidad de otro', async () => {
    const otro = await addMember(app, admin, 'professional', 'Otro Prof');
    const res = await http(app)
      .post('/v1/availability-blocks')
      .set('authorization', `Bearer ${prof.token}`)
      .send({
        professionalId: otro.userId,
        weekday: 2,
        startTime: '08:00',
        endTime: '09:00',
        slotMinutes: 30,
      })
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN_PROFESSIONAL');
  });

  it('un profesional no puede cambiar el estado del turno de otro', async () => {
    // La contracara de habilitarle el PATCH: RLS acota a la clínica pero no al
    // profesional, así que sin el filtro del servicio cualquiera del equipo
    // podía marcar como atendido el turno de otro.
    const otro = await addMember(app, admin, 'professional', 'Prof Ajeno');
    await createWeeklyAvailability(app, admin, otro.userId);
    const ajeno = await book(app, admin, {
      professionalId: otro.userId,
      startsAt: atArgentina(futureDate(95), '09:00'),
    });
    await http(app)
      .patch(`/v1/appointments/${ajeno.id}/status`)
      .set('authorization', `Bearer ${prof.token}`)
      .send({ status: 'completed' })
      .expect(404);
  });

  it('el admin sí puede cargar la disponibilidad de cualquier profesional', async () => {
    await http(app)
      .post('/v1/availability-blocks')
      .set('authorization', `Bearer ${admin.token}`)
      .send({
        professionalId: prof.userId,
        weekday: 4,
        startTime: '17:00',
        endTime: '18:00',
        slotMinutes: 30,
      })
      .expect(201);
  });
});

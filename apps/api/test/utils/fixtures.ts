import { INestApplication } from '@nestjs/common';
import { http, PASSWORD, uniqueDni, uniqueEmail } from './harness';

export interface Session {
  userId: string;
  clinicId: string;
  email: string;
  roles: string[];
  token: string;
  refreshToken: string;
}

export interface Clinic {
  clinicId: string;
  /** Admin + profesional: es como queda el dueño al registrarse. */
  admin: Session;
}

function toSession(body: any): Session {
  return {
    userId: body.user.id,
    clinicId: body.user.clinicId,
    email: body.user.email,
    roles: body.user.roles,
    token: body.accessToken,
    refreshToken: body.refreshToken,
  };
}

export async function registerClinic(
  app: INestApplication,
  name = 'Consultorio de prueba',
): Promise<Clinic> {
  const res = await http(app)
    .post('/v1/auth/register-clinic')
    .send({
      clinicName: name,
      email: uniqueEmail('admin'),
      password: PASSWORD,
      fullName: 'Dra. Admin',
    })
    .expect(201);
  const admin = toSession(res.body);
  return { clinicId: admin.clinicId, admin };
}

/** Invita y acepta en un paso: devuelve la sesión del nuevo integrante. */
export async function addMember(
  app: INestApplication,
  admin: Session,
  role: 'professional' | 'receptionist' | 'admin',
  fullName = 'Integrante',
): Promise<Session> {
  const email = uniqueEmail(role);
  const invite = await http(app)
    .post('/v1/users/invite')
    .set('authorization', `Bearer ${admin.token}`)
    .send({ email, role })
    .expect(201);

  const accepted = await http(app)
    .post('/v1/auth/accept-invite')
    .send({ token: invite.body.inviteToken, password: PASSWORD, fullName })
    .expect(201);

  return toSession(accepted.body);
}

export async function createRoom(
  app: INestApplication,
  admin: Session,
  name = 'Consultorio 1',
): Promise<{ id: string; name: string }> {
  const res = await http(app)
    .post('/v1/rooms')
    .set('authorization', `Bearer ${admin.token}`)
    .send({ name })
    .expect(201);
  return res.body;
}

/** Disponibilidad de un profesional para TODOS los días de la semana. */
export async function createWeeklyAvailability(
  app: INestApplication,
  actor: Session,
  professionalId: string,
  opts: { startTime?: string; endTime?: string; slotMinutes?: number; roomId?: string } = {},
) {
  for (let weekday = 0; weekday < 7; weekday++) {
    await http(app)
      .post('/v1/availability-blocks')
      .set('authorization', `Bearer ${actor.token}`)
      .send({
        professionalId,
        weekday,
        startTime: opts.startTime ?? '09:00',
        endTime: opts.endTime ?? '13:00',
        slotMinutes: opts.slotMinutes ?? 30,
        roomId: opts.roomId,
      })
      .expect(201);
  }
}

export interface BookInput {
  professionalId: string;
  startsAt: string;
  durationMinutes?: number;
  roomId?: string;
  reason?: string;
  /** Segunda confirmación del sobreturno: sin esto, el turno superpuesto se rechaza. */
  allowOverbook?: boolean;
  dni?: string;
  firstName?: string;
  lastName?: string;
}

export function bookRequest(app: INestApplication, actor: Session, input: BookInput) {
  return http(app)
    .post('/v1/appointments')
    .set('authorization', `Bearer ${actor.token}`)
    .send({
      professionalId: input.professionalId,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes ?? 30,
      roomId: input.roomId,
      reason: input.reason,
      allowOverbook: input.allowOverbook,
      person: {
        dni: input.dni ?? uniqueDni(),
        firstName: input.firstName ?? 'Paciente',
        lastName: input.lastName ?? 'De Prueba',
      },
    });
}

export async function book(app: INestApplication, actor: Session, input: BookInput) {
  const res = await bookRequest(app, actor, input);
  if (res.status !== 201) {
    throw new Error(
      `book() esperaba 201 y recibió ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
  return res.body;
}

export async function createPatient(
  app: INestApplication,
  professional: Session,
  overrides: { dni?: string; firstName?: string; lastName?: string } = {},
) {
  const res = await http(app)
    .post('/v1/patients')
    .set('authorization', `Bearer ${professional.token}`)
    .send({
      dni: overrides.dni ?? uniqueDni(),
      firstName: overrides.firstName ?? 'Marta',
      lastName: overrides.lastName ?? 'Silva',
    })
    .expect(201);
  return res.body as { personId: string; dni: string };
}

export async function addEntry(
  app: INestApplication,
  professional: Session,
  personId: string,
  content = 'Control de rutina.',
  type = 'note',
) {
  const res = await http(app)
    .post(`/v1/patients/${personId}/clinical-entries`)
    .set('authorization', `Bearer ${professional.token}`)
    .send({ type, content })
    .expect(201);
  return res.body;
}

/** Fecha futura (YYYY-MM-DD) para no chocar con turnos ya sembrados. */
export function futureDate(daysFromNow = 7): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/** `2026-08-10` + `09:00` → ISO con el offset de Buenos Aires. */
export function atArgentina(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00-03:00`;
}

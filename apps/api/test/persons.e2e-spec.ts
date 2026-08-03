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

/** Buscar a la persona por DNI es el primer paso para agendar. */
describe('Búsqueda de personas para agendar', () => {
  let app: INestApplication;
  let admin: Session;
  let prof: Session;
  let recep: Session;
  const dni = uniqueDni();

  beforeAll(async () => {
    app = await createTestApp();
    const clinic = await registerClinic(app, 'Clínica personas');
    admin = clinic.admin;
    prof = await addMember(app, admin, 'professional', 'Dra. Prof');
    recep = await addMember(app, admin, 'receptionist', 'Recepción');
    await createWeeklyAvailability(app, admin, prof.userId);
    await book(app, admin, {
      professionalId: prof.userId,
      startsAt: atArgentina(futureDate(500), '09:00'),
      dni,
      firstName: 'Marta',
      lastName: 'Silva',
    });
  });

  afterAll(async () => app.close());

  const buscar = (actor: Session, query: string) =>
    http(app).get(`/v1/persons?${query}`).set('authorization', `Bearer ${actor.token}`);

  it('la recepción encuentra a la persona por DNI exacto', async () => {
    const res = await buscar(recep, `dni=${dni}`).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ dni, first_name: 'Marta', last_name: 'Silva' });
  });

  it('no devuelve nada clínico, sólo datos de contacto', async () => {
    const res = await buscar(recep, `dni=${dni}`).expect(200);
    expect(Object.keys(res.body[0]).sort()).toEqual([
      'dni',
      'email',
      'first_name',
      'id',
      'last_name',
      'phone',
    ]);
  });

  it('un DNI que no existe devuelve lista vacía, no un error', async () => {
    const res = await buscar(recep, 'dni=99999999').expect(200);
    expect(res.body).toEqual([]);
  });

  it('también busca por nombre', async () => {
    const res = await buscar(recep, 'q=marta').expect(200);
    expect(res.body.map((p: any) => p.dni)).toContain(dni);
  });

  it('el profesional también puede buscar', async () => {
    await buscar(prof, `dni=${dni}`).expect(200);
  });

  it('no cruza clínicas', async () => {
    const otra = await registerClinic(app, 'Clínica ajena');
    const res = await buscar(otra.admin, `dni=${dni}`).expect(200);
    expect(res.body).toEqual([]);
  });

  it('sin token no se busca a nadie', async () => {
    await http(app).get(`/v1/persons?dni=${dni}`).expect(401);
  });
});

import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createTestApp, http, ownerDb, PASSWORD, uniqueEmail } from './utils/harness';
import { addMember, registerClinic, type Clinic } from './utils/fixtures';

describe('Auth y sesión', () => {
  let app: INestApplication;
  let clinic: Clinic;

  beforeAll(async () => {
    app = await createTestApp();
    clinic = await registerClinic(app);
  });
  afterAll(async () => app.close());

  it('el registro crea la clínica con el dueño como admin y profesional', () => {
    expect(clinic.admin.roles.sort()).toEqual(['admin', 'professional']);
    expect(clinic.admin.clinicId).toEqual(expect.any(String));
    expect(clinic.admin.token).toEqual(expect.any(String));
  });

  it('rechaza registrar dos veces el mismo email', async () => {
    const email = uniqueEmail('dup');
    const payload = {
      clinicName: 'Otra',
      email,
      password: PASSWORD,
      fullName: 'Alguien',
    };
    await http(app).post('/v1/auth/register-clinic').send(payload).expect(201);
    const res = await http(app).post('/v1/auth/register-clinic').send(payload).expect(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('rechaza contraseñas de menos de 8 caracteres', async () => {
    const res = await http(app)
      .post('/v1/auth/register-clinic')
      .send({ clinicName: 'X', email: uniqueEmail(), password: 'corta', fullName: 'X' })
      .expect(400);
    expect(res.body.status).toBe(400);
  });

  it('login válido devuelve tokens; contraseña incorrecta devuelve 401', async () => {
    const ok = await http(app)
      .post('/v1/auth/login')
      .send({ email: clinic.admin.email, password: PASSWORD })
      .expect(201);
    expect(ok.body.accessToken).toEqual(expect.any(String));

    const bad = await http(app)
      .post('/v1/auth/login')
      .send({ email: clinic.admin.email, password: 'otra-cosa-cualquiera' })
      .expect(401);
    expect(bad.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('un email inexistente da el mismo error que una contraseña incorrecta', async () => {
    const res = await http(app)
      .post('/v1/auth/login')
      .send({ email: 'no-existe@test.local', password: PASSWORD })
      .expect(401);
    // Mismo código y mismo mensaje: no se filtra qué emails están registrados.
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  describe('protección de endpoints', () => {
    it('sin token → 401 NO_TOKEN', async () => {
      const res = await http(app).get('/v1/auth/me').expect(401);
      expect(res.body.code).toBe('NO_TOKEN');
    });

    it('token basura → 401 INVALID_TOKEN', async () => {
      const res = await http(app)
        .get('/v1/auth/me')
        .set('authorization', 'Bearer no-es-un-jwt')
        .expect(401);
      expect(res.body.code).toBe('INVALID_TOKEN');
    });

    it('token firmado con OTRO secreto → 401', async () => {
      const forged = new JwtService({ secret: 'otro-secreto-completamente-distinto' }).sign({
        sub: clinic.admin.userId,
        clinicId: clinic.admin.clinicId,
        roles: ['admin'],
      });
      const res = await http(app)
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${forged}`)
        .expect(401);
      expect(res.body.code).toBe('INVALID_TOKEN');
    });

    it('un token expirado no sirve', async () => {
      const expired = new JwtService({
        secret: process.env.JWT_SECRET!,
      }).sign(
        { sub: clinic.admin.userId, clinicId: clinic.admin.clinicId, roles: ['admin'] },
        { expiresIn: '-1s' },
      );
      const res = await http(app)
        .get('/v1/auth/me')
        .set('authorization', `Bearer ${expired}`)
        .expect(401);
      expect(res.body.code).toBe('INVALID_TOKEN');
    });
  });

  describe('refresh token', () => {
    it('rota usando SOLO la cookie httpOnly, sin body', async () => {
      const login = await http(app)
        .post('/v1/auth/login')
        .send({ email: clinic.admin.email, password: PASSWORD })
        .expect(201);

      const cookie = login.headers['set-cookie'];
      expect(String(cookie)).toContain('HttpOnly');

      const refreshed = await http(app)
        .post('/v1/auth/refresh')
        .set('Cookie', cookie)
        .send({})
        .expect(201);

      expect(refreshed.body.accessToken).toEqual(expect.any(String));
      expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);
    });

    it('el refresh token viejo queda revocado tras rotar (anti replay)', async () => {
      const login = await http(app)
        .post('/v1/auth/login')
        .send({ email: clinic.admin.email, password: PASSWORD })
        .expect(201);
      const original = login.body.refreshToken;

      await http(app).post('/v1/auth/refresh').send({ refreshToken: original }).expect(201);

      const reuse = await http(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken: original })
        .expect(401);
      expect(reuse.body.code).toBe('INVALID_REFRESH');
    });

    it('logout revoca el refresh token y borra la cookie', async () => {
      const login = await http(app)
        .post('/v1/auth/login')
        .send({ email: clinic.admin.email, password: PASSWORD })
        .expect(201);

      const out = await http(app)
        .post('/v1/auth/logout')
        .set('Cookie', login.headers['set-cookie'])
        .send({})
        .expect(201);
      expect(out.body).toEqual({ ok: true });

      const after = await http(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
      expect(after.body.code).toBe('INVALID_REFRESH');
    });

    it('replicar un token ya usado corta TODAS las sesiones del usuario', async () => {
      const login = await http(app)
        .post('/v1/auth/login')
        .send({ email: clinic.admin.email, password: PASSWORD })
        .expect(201);
      const t1 = login.body.refreshToken;

      // Rotación normal: t1 → t2.
      const rotado = await http(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken: t1 })
        .expect(201);
      const t2 = rotado.body.refreshToken;

      // Un atacante con una copia de t1 lo intenta: falla.
      await http(app).post('/v1/auth/refresh').send({ refreshToken: t1 }).expect(401);

      // Y t2 —que era el token bueno— también queda muerto: ante un replay se
      // cortan todas las sesiones y el usuario tiene que volver a entrar.
      const res = await http(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken: t2 })
        .expect(401);
      expect(res.body.code).toBe('INVALID_REFRESH');
    });

    it('un refresh token inventado no sirve', async () => {
      const res = await http(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'a'.repeat(64) })
        .expect(401);
      expect(res.body.code).toBe('INVALID_REFRESH');
    });
  });

  describe('invitaciones', () => {
    it('la invitación se usa una sola vez', async () => {
      const email = uniqueEmail('single-use');
      const invite = await http(app)
        .post('/v1/users/invite')
        .set('authorization', `Bearer ${clinic.admin.token}`)
        .send({ email, role: 'professional' })
        .expect(201);

      await http(app)
        .post('/v1/auth/accept-invite')
        .send({ token: invite.body.inviteToken, password: PASSWORD, fullName: 'Prof' })
        .expect(201);

      const second = await http(app)
        .post('/v1/auth/accept-invite')
        .send({ token: invite.body.inviteToken, password: PASSWORD, fullName: 'Otro' })
        .expect(401);
      expect(second.body.code).toBe('INVALID_INVITE');
    });

    it('un token de invitación inventado no crea usuarios', async () => {
      const res = await http(app)
        .post('/v1/auth/accept-invite')
        .send({ token: 'b'.repeat(64), password: PASSWORD, fullName: 'Intruso' })
        .expect(401);
      expect(res.body.code).toBe('INVALID_INVITE');
    });

    it('el invitado queda con el rol que le dieron, no con más', async () => {
      const recep = await addMember(app, clinic.admin, 'receptionist');
      expect(recep.roles).toEqual(['receptionist']);
    });
  });

  it('un usuario desactivado no puede entrar', async () => {
    const prof = await addMember(app, clinic.admin, 'professional');
    const db = ownerDb();
    await db.connect();
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [prof.userId]);
    await db.end();

    const res = await http(app)
      .post('/v1/auth/login')
      .send({ email: prof.email, password: PASSWORD })
      .expect(403);
    expect(res.body.code).toBe('USER_INACTIVE');
  });

  it('los errores salen con el contrato RFC 9457', async () => {
    const res = await http(app).get('/v1/auth/me').expect(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: 'about:blank',
      status: 401,
      code: 'NO_TOKEN',
      instance: '/v1/auth/me',
    });
  });

  it('rechaza campos que no están en el contrato', async () => {
    // Antes se descartaban en silencio: un cliente podía mandar `roles` o
    // `isAdmin` y creer que había funcionado.
    const res = await http(app)
      .post('/v1/auth/login')
      .send({ email: clinic.admin.email, password: PASSWORD, roles: ['admin'] })
      .expect(400);
    expect(String(res.body.detail)).toContain('roles');
  });

  it('responde con las cabeceras de seguridad de helmet', async () => {
    const res = await http(app).get('/v1/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

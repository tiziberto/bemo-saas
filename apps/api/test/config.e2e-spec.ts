import { loadEnv, resetEnvCache } from '../src/config/env';

/**
 * El control de seguridad más barato del proyecto: que la app no arranque mal
 * configurada. Antes levantaba igual con la JWT_SECRET de desarrollo, así que
 * cualquiera con el repo podía firmar tokens válidos contra producción.
 */
describe('Validación del entorno al arrancar', () => {
  const original = { ...process.env };

  beforeEach(() => resetEnvCache());
  afterEach(() => {
    process.env = { ...original };
    resetEnvCache();
  });

  it('en producción, sin JWT_SECRET no arranca', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    expect(() => loadEnv()).toThrow(/JWT_SECRET no está definida/);
  });

  it('en producción, con la JWT_SECRET de desarrollo no arranca', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'dev-insecure-change-me';
    expect(() => loadEnv()).toThrow(/valor de desarrollo/);
  });

  it('en producción, una JWT_SECRET corta no arranca', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'corta';
    expect(() => loadEnv()).toThrow(/demasiado corta/);
  });

  it('sin DATABASE_URL no arranca, en ningún entorno', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DATABASE_URL;
    expect(() => loadEnv()).toThrow(/DATABASE_URL no está definida/);
  });

  it('en desarrollo se permite el secreto por default (con aviso)', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const env = loadEnv();
    expect(env.jwtSecret).toBe('dev-insecure-change-me');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('en producción Swagger queda apagado salvo que se pida explícitamente', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'una-clave-larguisima-de-produccion-32+';
    expect(loadEnv().enableDocs).toBe(false);

    resetEnvCache();
    process.env.ENABLE_DOCS = '1';
    expect(loadEnv().enableDocs).toBe(true);
  });

  it('los límites tienen defaults sanos', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.THROTTLE_LIMIT;
    delete process.env.AUTH_THROTTLE_LIMIT;
    delete process.env.BODY_LIMIT;
    const env = loadEnv();
    expect(env.throttleLimit).toBe(120);
    expect(env.authThrottleLimit).toBe(10);
    expect(env.bodyLimit).toBe('1mb');
  });
});

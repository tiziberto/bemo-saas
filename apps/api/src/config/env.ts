/**
 * Configuración validada al arrancar. Sin esto la app levantaba con
 * `JWT_SECRET = 'dev-insecure-change-me'` si faltaba la variable: cualquiera con
 * el repo podía firmar un token válido contra producción.
 *
 * Reglas: en producción faltar un secreto es un error fatal; en desarrollo se
 * avisa fuerte pero se deja arrancar.
 */

const DEV_JWT_SECRET = 'dev-insecure-change-me';

export interface AppEnv {
  nodeEnv: string;
  isProduction: boolean;
  isTest: boolean;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  webOrigin: string;
  /** Límite global de requests por minuto y por IP. */
  throttleLimit: number;
  /** Límite específico de `/auth/*` (fuerza bruta). */
  authThrottleLimit: number;
  /** Tamaño máximo del body JSON (el import de pacientes manda CSV adentro). */
  bodyLimit: string;
  /** Swagger sólo se publica si es explícito fuera de desarrollo. */
  enableDocs: boolean;
  /** Dónde se guardan los archivos clínicos (volumen, no la base). */
  storageDir: string;
  /** Tamaño máximo de un adjunto, en MB. */
  maxUploadMb: number;
}

let cached: AppEnv | null = null;

export function loadEnv(): AppEnv {
  if (cached) return cached;

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';
  const problems: string[] = [];

  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl) problems.push('DATABASE_URL no está definida');

  let jwtSecret = process.env.JWT_SECRET ?? '';
  if (!jwtSecret) {
    if (isProduction) {
      problems.push('JWT_SECRET no está definida');
    } else {
      jwtSecret = DEV_JWT_SECRET;
    }
  } else if (jwtSecret === DEV_JWT_SECRET && isProduction) {
    problems.push('JWT_SECRET tiene el valor de desarrollo');
  } else if (jwtSecret.length < 32 && isProduction) {
    problems.push('JWT_SECRET es demasiado corta (mínimo 32 caracteres)');
  }

  if (problems.length) {
    throw new Error(
      `[config] La aplicación no puede arrancar:\n  - ${problems.join('\n  - ')}\n` +
        'Revisá tu .env (ver .env.example).',
    );
  }

  if (jwtSecret === DEV_JWT_SECRET && !isTest) {
    // eslint-disable-next-line no-console
    console.warn(
      '[config] ATENCIÓN: usando la JWT_SECRET de desarrollo. No sirve para producción.',
    );
  }

  cached = {
    nodeEnv,
    isProduction,
    isTest,
    port: Number(process.env.API_PORT ?? 3000),
    databaseUrl,
    jwtSecret,
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    throttleLimit: Number(process.env.THROTTLE_LIMIT ?? 120),
    authThrottleLimit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 10),
    bodyLimit: process.env.BODY_LIMIT ?? '1mb',
    enableDocs: process.env.ENABLE_DOCS === '1' || !isProduction,
    storageDir: process.env.STORAGE_DIR ?? './storage',
    maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 20),
  };
  return cached;
}

/** Sólo para tests: obliga a releer el entorno. */
export function resetEnvCache() {
  cached = null;
}

// Entorno de los tests. Se carga ANTES que cualquier import de la app porque
// el throttler y los secretos se resuelven en tiempo de import.
const host = process.env.TEST_DB_HOST ?? 'localhost';
const port = process.env.TEST_DB_PORT ?? '5432';
const db = process.env.TEST_DB_NAME ?? 'bemo_test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `postgres://bemo_app:bemo_app@${host}:${port}/${db}`;
process.env.JWT_SECRET = 'test-secret-de-32-caracteres-o-mas-para-los-tests';
process.env.WEB_ORIGIN = 'http://localhost:5173';
// Los adjuntos de los tests van a un directorio descartable, nunca al repo.
process.env.STORAGE_DIR = process.env.STORAGE_DIR ?? '/tmp/bemo-test-storage';

// El rate limit real (120/min global, 10/min en auth) haría fallar la suite por
// motivos que no tienen que ver con lo que se está probando. Hay un test
// dedicado que lo verifica bajando el límite a propósito.
process.env.THROTTLE_LIMIT = '100000';
process.env.AUTH_THROTTLE_LIMIT = '100000';

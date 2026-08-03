import { execSync } from 'child_process';
import { rmSync } from 'fs';
import { Client } from 'pg';

/**
 * Crea la base de test desde cero y le corre las migraciones reales.
 *
 * Se usan las mismas migraciones que producción a propósito: si una policy RLS
 * está mal escrita, el test la agarra. Un schema armado a mano para los tests
 * probaría otra cosa.
 */
export default async function globalSetup() {
  const host = process.env.TEST_DB_HOST ?? 'localhost';
  const port = process.env.TEST_DB_PORT ?? '5432';
  const dbName = process.env.TEST_DB_NAME ?? 'bemo_test';
  const owner = process.env.TEST_DB_OWNER ?? 'bemo';
  const ownerPass = process.env.TEST_DB_OWNER_PASSWORD ?? 'bemo';

  const adminUrl = `postgres://${owner}:${ownerPass}@${host}:${port}/postgres`;
  const ownerTestUrl = `postgres://${owner}:${ownerPass}@${host}:${port}/${dbName}`;

  // Archivos de la corrida anterior: se descartan junto con la base.
  rmSync(process.env.STORAGE_DIR ?? '/tmp/bemo-test-storage', {
    recursive: true,
    force: true,
  });

  const admin = new Client({ connectionString: adminUrl });
  try {
    await admin.connect();
  } catch (err) {
    throw new Error(
      `No se pudo conectar a Postgres en ${host}:${port}. ` +
        'Levantá la base con `docker compose up -d db` antes de correr los tests.\n' +
        String(err),
    );
  }

  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  execSync('node_modules/.bin/node-pg-migrate up -m migrations --no-check-order', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: ownerTestUrl },
    stdio: 'pipe',
  });
}

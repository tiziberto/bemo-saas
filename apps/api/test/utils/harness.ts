import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';

/**
 * Levanta la app REAL (mismo módulo, mismos pipes, mismo filtro de errores que
 * producción) contra la base de test. Si los tests armaran su propia config,
 * probarían una app que no existe.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export function http(app: INestApplication) {
  return request(app.getHttpServer());
}

/** Conexión como owner: para mirar tablas que la API no expone (audit_log). */
export function ownerDb(): Client {
  const host = process.env.TEST_DB_HOST ?? 'localhost';
  const port = process.env.TEST_DB_PORT ?? '5432';
  const db = process.env.TEST_DB_NAME ?? 'bemo_test';
  return new Client({ connectionString: `postgres://bemo:bemo@${host}:${port}/${db}` });
}

let seq = 0;
export function uniqueEmail(prefix = 'user'): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}@test.local`;
}

export function uniqueDni(): string {
  seq += 1;
  return String(20_000_000 + ((Date.now() + seq) % 79_000_000));
}

export const PASSWORD = 'contrasena-de-prueba';

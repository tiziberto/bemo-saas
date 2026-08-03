import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, setupDocs } from './bootstrap';
import { loadEnv } from './config/env';

async function bootstrap() {
  // Se valida el entorno ANTES de levantar nada: si falta un secreto, no arranca.
  const env = loadEnv();

  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const docs = setupDocs(app);

  await app.listen(env.port, '0.0.0.0');
  new Logger('bootstrap').log(
    `escuchando en http://0.0.0.0:${env.port}/v1${docs ? ' (docs en /v1/docs)' : ''} · env=${env.nodeEnv}`,
  );
}

void bootstrap().catch((err) => {
  new Logger('bootstrap').error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

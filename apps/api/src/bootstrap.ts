import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import express from 'express';
import { HttpLoggerInterceptor } from './common/http-logger.interceptor';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { loadEnv } from './config/env';

/**
 * Configuración de la app, compartida entre `main.ts` y los tests.
 * Si esto viviera sólo en main.ts, los tests correrían contra una app distinta
 * de la real y no probarían ni los pipes ni el filtro de errores ni el prefijo.
 */
export function configureApp(app: INestApplication): void {
  const env = loadEnv();

  app.setGlobalPrefix('v1');

  // Cabeceras de seguridad. CSP apagada: es una API, no sirve HTML.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

  // Necesario para leer la cookie httpOnly del refresh token.
  app.use(cookieParser());

  // El import de pacientes manda el CSV dentro del JSON; el default de Express
  // (100 kb) lo cortaba. El límite explícito también acota el abuso.
  app.use(express.json({ limit: env.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: env.bodyLimit }));

  app.enableCors({ origin: env.webOrigin, credentials: true });

  // `forbidNonWhitelisted`: un campo que no está en el DTO ahora da 400 en vez
  // de descartarse en silencio. Un cliente que manda `isAdmin: true` o `role`
  // se entera, y nosotros también.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Contrato de error único (RFC 9457 — application/problem+json)
  app.useGlobalFilters(new ProblemDetailsFilter());

  // Un renglón por request: método, ruta, estado y duración.
  app.useGlobalInterceptors(new HttpLoggerInterceptor());

  app.enableShutdownHooks();
}

/** Swagger: en producción sólo si se pide explícitamente con ENABLE_DOCS=1. */
export function setupDocs(app: INestApplication): boolean {
  const env = loadEnv();
  if (!env.enableDocs) return false;

  const config = new DocumentBuilder()
    .setTitle('bemo API')
    .setDescription('CRM para consultorios — API v1')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('v1/docs', app, SwaggerModule.createDocument(app, config));
  return true;
}

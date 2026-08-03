import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * Registro de cada request: método, ruta, estado y duración.
 *
 * Antes no quedaba rastro de nada: ni de quién entró, ni de qué falló, ni de
 * qué endpoint se puso lento. Para datos de salud, poder responder "quién tocó
 * esto y cuándo" no es opcional.
 *
 * No se loguea el body ni la query: ahí viajan DNI, teléfonos y motivos de
 * consulta. La auditoría de accesos clínicos vive en `audit_log`, con su propio
 * detalle y sin PHI en los logs.
 */
@Injectable()
export class HttpLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('http');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();

    const req = ctx.switchToHttp().getRequest<Request & { user?: { userId?: string } }>();
    // El healthcheck pega cada 30 segundos: ensuciaría el log sin aportar nada.
    if (req.originalUrl?.startsWith('/v1/health')) return next.handle();

    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => this.write(ctx, req, started),
        // Los errores los registra ProblemDetailsFilter, con su stack.
        error: () => undefined,
      }),
    );
  }

  private write(
    ctx: ExecutionContext,
    req: Request & { user?: { userId?: string } },
    started: number,
  ) {
    const res = ctx.switchToHttp().getResponse<Response>();
    const ms = Date.now() - started;
    const actor = req.user?.userId ? ` user=${req.user.userId}` : '';
    this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms${actor}`);
  }
}

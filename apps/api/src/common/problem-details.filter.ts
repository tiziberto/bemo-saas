import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Contrato de error único (RFC 9457 — Problem Details).
// Toda excepción sale con la misma forma + un `code` estable para el front.
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('http');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let title = 'Internal Server Error';
    let detail: string | undefined;
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      title = exception.name.replace(/Exception$/, '') || 'Error';
      const body = exception.getResponse();
      if (typeof body === 'string') {
        detail = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        detail = Array.isArray(b.message)
          ? (b.message as string[]).join(', ')
          : (b.message as string | undefined);
        if (typeof b.code === 'string') code = b.code;
      }
    } else if (exception instanceof Error) {
      detail =
        process.env.NODE_ENV === 'production' ? undefined : exception.message;
    }

    // Sin esto, un 500 se serializaba al cliente y no quedaba registrado en
    // ningún lado: los errores del servidor eran invisibles.
    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} → ${status} ${code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status === 401 || status === 403) {
      this.logger.warn(`${req.method} ${req.originalUrl} → ${status} ${code}`);
    }

    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title,
        status,
        detail,
        code,
        instance: req.originalUrl,
      });
  }
}

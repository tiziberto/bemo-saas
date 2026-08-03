import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { loadEnv } from '../config/env';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        message: 'Falta el token de acceso',
        code: 'NO_TOKEN',
      });
    }
    const token = header.slice('Bearer '.length);
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: loadEnv().jwtSecret,
      });
      (req as Request & { user: unknown }).user = {
        userId: payload.sub,
        clinicId: payload.clinicId,
        roles: payload.roles ?? [],
      };
      return true;
    } catch {
      throw new UnauthorizedException({
        message: 'Token inválido o expirado',
        code: 'INVALID_TOKEN',
      });
    }
  }
}

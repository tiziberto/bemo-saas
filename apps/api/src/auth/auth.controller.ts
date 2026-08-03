import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { loadEnv } from '../config/env';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../security/current-user.decorator';
import { AuthService } from './auth.service';
import {
  AcceptInviteDto,
  LoginDto,
  RefreshDto,
  RegisterClinicDto,
} from './dto';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Endpoints de auth con rate-limit más estricto (anti fuerza bruta).
@ApiTags('auth')
@Controller('auth')
@Throttle({ default: { limit: loadEnv().authThrottleLimit, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register-clinic')
  async register(
    @Body() dto: RegisterClinicDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.auth.register(dto);
    this.setRefreshCookie(res, out.refreshToken);
    return out;
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const out = await this.auth.login(dto);
    this.setRefreshCookie(res, out.refreshToken);
    return out;
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.auth.refresh(this.readRefreshToken(req, dto));
    this.setRefreshCookie(res, out.refreshToken);
    return out;
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Body() dto: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE] ?? dto.refreshToken;
    this.clearRefreshCookie(res);
    return this.auth.logout(token);
  }

  @Post('accept-invite')
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.auth.acceptInvite(dto);
    this.setRefreshCookie(res, out.refreshToken);
    return out;
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  /**
   * La cookie httpOnly manda; el body es el fallback para clientes que no la
   * tienen (tests, apps nativas). Guardar el refresh token en localStorage lo
   * deja expuesto a cualquier XSS: por eso la cookie es el camino preferido.
   */
  private readRefreshToken(req: Request, dto: RefreshDto): string {
    const token = req.cookies?.[REFRESH_COOKIE] ?? dto.refreshToken;
    if (!token) {
      throw new BadRequestException({
        message: 'Falta el refresh token',
        code: 'NO_REFRESH_TOKEN',
      });
    }
    return token;
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: loadEnv().isProduction,
      path: '/v1/auth',
    };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: REFRESH_TTL_MS,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }
}

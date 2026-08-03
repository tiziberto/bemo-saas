import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'crypto';
import { DbService } from '../database/db.service';
import { AcceptInviteDto, LoginDto, RegisterClinicDto } from './dto';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly jwt: JwtService,
  ) {}

  private async issueTokens(userId: string, clinicId: string, roles: string[]) {
    const accessToken = await this.jwt.signAsync({ sub: userId, clinicId, roles });
    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await this.db.query('SELECT auth_store_refresh($1, $2, $3)', [
      userId,
      sha256(refreshToken),
      expiresAt,
    ]);
    return { accessToken, refreshToken };
  }

  private async rolesOf(userId: string): Promise<string[]> {
    const res = await this.db.query<{ role: string }>(
      'SELECT auth_user_roles($1) AS role',
      [userId],
    );
    return res.rows.map((r) => r.role);
  }

  async register(dto: RegisterClinicDto) {
    const passwordHash = await hash(dto.password);
    let row: { o_clinic_id: string; o_user_id: string };
    try {
      const res = await this.db.query<{ o_clinic_id: string; o_user_id: string }>(
        'SELECT * FROM register_clinic($1, $2, $3, $4, $5)',
        [dto.clinicName, dto.timezone ?? '', dto.email, passwordHash, dto.fullName],
      );
      row = res.rows[0];
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException({
          message: 'El email ya está registrado',
          code: 'EMAIL_TAKEN',
        });
      }
      throw err;
    }
    const roles = ['admin', 'professional'];
    const tokens = await this.issueTokens(row.o_user_id, row.o_clinic_id, roles);
    return {
      user: {
        id: row.o_user_id,
        clinicId: row.o_clinic_id,
        email: dto.email,
        roles,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const res = await this.db.query<{
      user_id: string;
      clinic_id: string;
      password_hash: string;
      is_active: boolean;
    }>('SELECT * FROM auth_login_lookup($1)', [dto.email]);
    const u = res.rows[0];
    const invalid = new UnauthorizedException({
      message: 'Credenciales inválidas',
      code: 'INVALID_CREDENTIALS',
    });
    if (!u) throw invalid;
    const ok = await verify(u.password_hash, dto.password).catch(() => false);
    if (!ok) throw invalid;
    if (!u.is_active) {
      throw new ForbiddenException({
        message: 'Usuario inactivo',
        code: 'USER_INACTIVE',
      });
    }
    const roles = await this.rolesOf(u.user_id);
    const tokens = await this.issueTokens(u.user_id, u.clinic_id, roles);
    return {
      user: { id: u.user_id, clinicId: u.clinic_id, email: dto.email, roles },
      ...tokens,
    };
  }

  async refresh(refreshToken?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException({
        message: 'Falta el refresh token',
        code: 'NO_REFRESH',
      });
    }
    const newRefresh = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    const res = await this.db.query<{ o_user_id: string; o_clinic_id: string }>(
      'SELECT * FROM auth_rotate_refresh($1, $2, $3)',
      [sha256(refreshToken), sha256(newRefresh), expiresAt],
    );
    const row = res.rows[0];
    if (!row) {
      throw new UnauthorizedException({
        message: 'Refresh token inválido o expirado',
        code: 'INVALID_REFRESH',
      });
    }
    const roles = await this.rolesOf(row.o_user_id);
    const accessToken = await this.jwt.signAsync({
      sub: row.o_user_id,
      clinicId: row.o_clinic_id,
      roles,
    });
    return { accessToken, refreshToken: newRefresh };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      await this.db.query('SELECT auth_revoke_refresh($1)', [sha256(refreshToken)]);
    }
    return { ok: true };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const passwordHash = await hash(dto.password);
    let row: { o_user_id: string; o_clinic_id: string; o_email: string } | undefined;
    try {
      const res = await this.db.query<{
        o_user_id: string;
        o_clinic_id: string;
        o_email: string;
      }>('SELECT * FROM accept_invite($1, $2, $3)', [
        sha256(dto.token),
        passwordHash,
        dto.fullName,
      ]);
      row = res.rows[0];
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException({
          message: 'Ese email ya tiene una cuenta',
          code: 'EMAIL_TAKEN',
        });
      }
      throw err;
    }
    if (!row) {
      throw new UnauthorizedException({
        message: 'Invitación inválida o expirada',
        code: 'INVALID_INVITE',
      });
    }
    const roles = await this.rolesOf(row.o_user_id);
    const tokens = await this.issueTokens(row.o_user_id, row.o_clinic_id, roles);
    return {
      user: {
        id: row.o_user_id,
        clinicId: row.o_clinic_id,
        email: row.o_email,
        roles,
      },
      ...tokens,
    };
  }
}

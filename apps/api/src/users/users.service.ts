import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DbService } from '../database/db.service';
import { AuthUser } from '../security/current-user.decorator';
import { InviteDto } from './dto';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  async invite(user: AuthUser, dto: InviteDto) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await this.db.withTenant(
      { clinicId: user.clinicId, userId: user.userId },
      async (client) => {
        await client.query(
          `INSERT INTO user_invites(clinic_id, email, role, token_hash, expires_at, invited_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [user.clinicId, dto.email, dto.role, sha256(token), expiresAt, user.userId],
        );
      },
    );
    // En dev devolvemos el token; en prod se manda por email un link.
    return { inviteToken: token, email: dto.email, role: dto.role, expiresAt };
  }

  listProfessionals(user: AuthUser) {
    return this.db.withTenant(
      { clinicId: user.clinicId, userId: user.userId },
      async (client) => {
        const res = await client.query(
          `SELECT DISTINCT u.id, u.full_name
             FROM users u
             JOIN user_roles ur ON ur.user_id = u.id
            WHERE ur.role = 'professional' AND u.is_active
            ORDER BY u.full_name`,
        );
        return res.rows;
      },
    );
  }

  async list(user: AuthUser) {
    return this.db.withTenant(
      { clinicId: user.clinicId, userId: user.userId },
      async (client) => {
        const res = await client.query(
          `SELECT u.id, u.email, u.full_name, u.is_active,
                  COALESCE(array_agg(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
             FROM users u
             LEFT JOIN user_roles ur ON ur.user_id = u.id
            GROUP BY u.id
            ORDER BY u.created_at`,
        );
        return res.rows;
      },
    );
  }
}

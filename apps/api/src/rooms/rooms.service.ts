import { Injectable } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuthUser } from '../security/current-user.decorator';
import { CreateRoomDto } from './dto';

@Injectable()
export class RoomsService {
  constructor(private readonly db: DbService) {}

  create(user: AuthUser, dto: CreateRoomDto) {
    return this.db.withTenant(
      { clinicId: user.clinicId, userId: user.userId },
      async (c) => {
        const r = await c.query(
          'INSERT INTO rooms(clinic_id, name) VALUES ($1, $2) RETURNING id, name, is_active',
          [user.clinicId, dto.name],
        );
        return r.rows[0];
      },
    );
  }

  list(user: AuthUser) {
    return this.db.withTenant(
      { clinicId: user.clinicId, userId: user.userId },
      async (c) => {
        const r = await c.query(
          'SELECT id, name, is_active FROM rooms ORDER BY name',
        );
        return r.rows;
      },
    );
  }
}

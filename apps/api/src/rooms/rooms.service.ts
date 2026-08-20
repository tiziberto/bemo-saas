import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuthUser } from '../security/current-user.decorator';
import { CreateRoomDto, UpdateRoomDto } from './dto';

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

  /**
   * Edita nombre y/o estado. No hay borrado: los turnos ya dados referencian la
   * sala, y borrarla dejaría la agenda histórica sin poder decir dónde se atendió.
   * Desactivar la saca de los selectores y deja el pasado intacto.
   */
  update(user: AuthUser, id: string, dto: UpdateRoomDto) {
    return this.db.withTenant(
      { clinicId: user.clinicId, userId: user.userId },
      async (c) => {
        const r = await c.query(
          `UPDATE rooms
              SET name      = COALESCE($2, name),
                  is_active = COALESCE($3, is_active)
            WHERE id = $1
        RETURNING id, name, is_active`,
          [id, dto.name ?? null, dto.isActive ?? null],
        );
        // Sin fila: o no existe, o es de otra clínica y RLS la ocultó. Las dos
        // cosas son un 404 desde afuera; distinguirlas filtraría que existe.
        if (!r.rows[0]) throw new NotFoundException({ code: 'ROOM_NOT_FOUND' });
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

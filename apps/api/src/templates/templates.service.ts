import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuthUser } from '../security/current-user.decorator';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly db: DbService) {}

  private ctx(user: AuthUser) {
    return { clinicId: user.clinicId, userId: user.userId };
  }

  /**
   * Los del sistema y los propios, en una sola lista. `own` distingue cuáles se
   * pueden editar: los del sistema los ve todo el mundo y no los toca nadie.
   * El filtro real lo hace RLS; el `owner_professional_id IS NOT NULL` sólo
   * define la bandera.
   */
  list(user: AuthUser) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `SELECT id, title, type, content, sort_order,
                (owner_professional_id IS NOT NULL) AS own
           FROM clinical_templates
          WHERE deleted_at IS NULL
          ORDER BY own, sort_order, title`,
      );
      return r.rows;
    });
  }

  create(user: AuthUser, dto: CreateTemplateDto) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `INSERT INTO clinical_templates
           (clinic_id, owner_professional_id, title, type, content, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, title, type, content, sort_order, true AS own`,
        [user.clinicId, user.userId, dto.title, dto.type, dto.content, dto.sortOrder ?? 100],
      );
      return r.rows[0];
    });
  }

  update(user: AuthUser, id: string, dto: UpdateTemplateDto) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `UPDATE clinical_templates
            SET title      = COALESCE($2, title),
                type       = COALESCE($3, type),
                content    = COALESCE($4, content),
                sort_order = COALESCE($5, sort_order)
          WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, title, type, content, sort_order, true AS own`,
        [id, dto.title ?? null, dto.type ?? null, dto.content ?? null, dto.sortOrder ?? null],
      );
      // Sin fila: no existe, o es del sistema, o es de otro. RLS ya lo tapó y
      // desde afuera las tres cosas son lo mismo.
      if (!r.rows[0]) throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND' });
      return r.rows[0];
    });
  }

  /** Borrado lógico: un preinforme borrado no debería reescribir la historia. */
  remove(user: AuthUser, id: string) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `UPDATE clinical_templates SET deleted_at = now()
          WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        [id],
      );
      if (!r.rows[0]) throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND' });
      return { ok: true };
    });
  }
}

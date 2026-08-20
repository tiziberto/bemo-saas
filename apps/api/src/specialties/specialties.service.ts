import { BadRequestException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../database/db.service';
import { AuthUser } from '../security/current-user.decorator';

@Injectable()
export class SpecialtiesService {
  constructor(private readonly db: DbService) {}

  private ctx(user: AuthUser) {
    return { clinicId: user.clinicId, userId: user.userId };
  }

  /**
   * El catálogo completo. Es dato de referencia sin dueño —no tiene clinic_id ni
   * RLS— y hace falta en el registro, cuando todavía no hay sesión ni clínica.
   * Por eso va sin contexto de tenant.
   */
  async catalogo() {
    const r = await this.db.query(
      'SELECT id, label FROM specialties ORDER BY sort_order, label',
    );
    return r.rows;
  }

  /** Las que ofrece esta clínica. */
  deLaClinica(user: AuthUser) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `SELECT s.id, s.label
           FROM clinic_specialties cs
           JOIN specialties s ON s.id = cs.specialty_id
          ORDER BY s.sort_order, s.label`,
      );
      return r.rows;
    });
  }

  /**
   * Reemplaza la lista de la clínica por la que se manda.
   *
   * Sacar una especialidad que algún profesional todavía tiene se rechaza en vez
   * de arrastrarla: la clave foránea la borraría en cascada y el profesional
   * perdería el dato sin que nadie se entere. Mejor decirlo.
   */
  setClinica(user: AuthUser, ids: string[]) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      await this.validarExisten(c, ids);

      const enUso = await c.query<{ label: string; full_name: string }>(
        `SELECT DISTINCT s.label, u.full_name
           FROM user_specialties us
           JOIN specialties s ON s.id = us.specialty_id
           JOIN users u ON u.id = us.user_id
          WHERE NOT (us.specialty_id = ANY($1::text[]))`,
        [ids],
      );
      if (enUso.rows.length) {
        const detalle = enUso.rows
          .map((f) => `${f.label} (${f.full_name})`)
          .join(', ');
        throw new BadRequestException({
          message: `No se puede sacar una especialidad que un profesional todavía tiene: ${detalle}. Sacásela primero en Equipo.`,
          code: 'SPECIALTY_IN_USE',
        });
      }

      await c.query(
        'DELETE FROM clinic_specialties WHERE NOT (specialty_id = ANY($1::text[]))',
        [ids],
      );
      if (ids.length) {
        await c.query(
          `INSERT INTO clinic_specialties (clinic_id, specialty_id)
           SELECT $1, unnest($2::text[])
           ON CONFLICT DO NOTHING`,
          [user.clinicId, ids],
        );
      }
      return this.deLaClinicaEn(c);
    });
  }

  /** Las de un profesional. */
  deProfesional(user: AuthUser, userId: string) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `SELECT s.id, s.label
           FROM user_specialties us
           JOIN specialties s ON s.id = us.specialty_id
          WHERE us.user_id = $1
          ORDER BY s.sort_order, s.label`,
        [userId],
      );
      return r.rows;
    });
  }

  /**
   * Reemplaza las de un profesional. La base ya impide asignar una que la clínica
   * no ofrezca (clave foránea compuesta), pero se valida antes para poder decir
   * cuál falta en vez de devolver un error de integridad.
   */
  setProfesional(user: AuthUser, userId: string, ids: string[]) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const ofrecidas = await c.query<{ id: string }>(
        'SELECT specialty_id AS id FROM clinic_specialties',
      );
      const disponibles = new Set(ofrecidas.rows.map((f) => f.id));
      const fuera = ids.filter((id) => !disponibles.has(id));
      if (fuera.length) {
        throw new BadRequestException({
          message: `La clínica no ofrece: ${fuera.join(', ')}. Agregala primero en Configuración › Clínica.`,
          code: 'SPECIALTY_NOT_OFFERED',
        });
      }

      await c.query('DELETE FROM user_specialties WHERE user_id = $1', [userId]);
      if (ids.length) {
        await c.query(
          `INSERT INTO user_specialties (clinic_id, user_id, specialty_id)
           SELECT $1, $2, unnest($3::text[])`,
          [user.clinicId, userId, ids],
        );
      }
      const r = await c.query(
        `SELECT s.id, s.label
           FROM user_specialties us
           JOIN specialties s ON s.id = us.specialty_id
          WHERE us.user_id = $1
          ORDER BY s.sort_order, s.label`,
        [userId],
      );
      return r.rows;
    });
  }

  private async validarExisten(c: PoolClient, ids: string[]) {
    if (!ids.length) return;
    const r = await c.query<{ id: string }>(
      'SELECT id FROM specialties WHERE id = ANY($1::text[])',
      [ids],
    );
    const conocidas = new Set(r.rows.map((f) => f.id));
    const desconocidas = ids.filter((id) => !conocidas.has(id));
    if (desconocidas.length) {
      throw new BadRequestException({
        message: `Especialidad desconocida: ${desconocidas.join(', ')}`,
        code: 'SPECIALTY_UNKNOWN',
      });
    }
  }

  private async deLaClinicaEn(c: PoolClient) {
    const r = await c.query(
      `SELECT s.id, s.label
         FROM clinic_specialties cs
         JOIN specialties s ON s.id = cs.specialty_id
        ORDER BY s.sort_order, s.label`,
    );
    return r.rows;
  }
}

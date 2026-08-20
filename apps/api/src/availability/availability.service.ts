import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuthUser } from '../security/current-user.decorator';
import { CreateBlockDto, CreateExceptionDto } from './dto';

@Injectable()
export class AvailabilityService {
  constructor(private readonly db: DbService) {}

  private ctx(user: AuthUser) {
    return { clinicId: user.clinicId, userId: user.userId };
  }

  /** El profesional maneja su propia agenda; el admin, la de cualquiera. */
  private resolveProfessional(user: AuthUser, requested?: string): string {
    const isAdmin = user.roles.includes('admin');
    const professionalId = requested ?? user.userId;
    if (!isAdmin && professionalId !== user.userId) {
      throw new ForbiddenException({
        message: 'Solo podés configurar tu propia disponibilidad',
        code: 'FORBIDDEN_PROFESSIONAL',
      });
    }
    return professionalId;
  }

  createBlock(user: AuthUser, dto: CreateBlockDto) {
    const professionalId = this.resolveProfessional(user, dto.professionalId);
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `INSERT INTO availability_blocks
           (clinic_id, professional_id, room_id, weekday, start_time, end_time, slot_minutes, valid_from, valid_to)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,30),$8,$9)
         RETURNING id, professional_id, room_id, weekday, start_time, end_time, slot_minutes`,
        [
          user.clinicId,
          professionalId,
          dto.roomId ?? null,
          dto.weekday,
          dto.startTime,
          dto.endTime,
          dto.slotMinutes ?? null,
          dto.validFrom ?? null,
          dto.validTo ?? null,
        ],
      );
      return r.rows[0];
    });
  }

  listBlocks(user: AuthUser, professionalId?: string) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `SELECT id, professional_id, room_id, weekday, start_time, end_time, slot_minutes, valid_from, valid_to
           FROM availability_blocks
          WHERE ($1::uuid IS NULL OR professional_id = $1)
          ORDER BY weekday, start_time`,
        [professionalId ?? null],
      );
      return r.rows;
    });
  }

  async deleteBlock(user: AuthUser, id: string) {
    const row = await this.db.withTenant(this.ctx(user), async (c) => {
      const owner = await c.query<{ professional_id: string }>(
        'SELECT professional_id FROM availability_blocks WHERE id = $1',
        [id],
      );
      return owner.rows[0];
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Horario no encontrado',
        code: 'BLOCK_NOT_FOUND',
      });
    }
    this.resolveProfessional(user, row.professional_id);

    return this.db.withTenant(this.ctx(user), async (c) => {
      await c.query('DELETE FROM availability_blocks WHERE id = $1', [id]);
      return { ok: true };
    });
  }

  /**
   * Bloqueos y aperturas puntuales de agenda: vacaciones, feriados, una tarde
   * que no se atiende, un sábado extra. Sin horario = el día completo.
   */
  createException(user: AuthUser, dto: CreateExceptionDto) {
    const professionalId = this.resolveProfessional(user, dto.professionalId);
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `INSERT INTO availability_exceptions
           (clinic_id, professional_id, date, date_to, kind, start_time, end_time)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, professional_id, date, date_to, kind, start_time, end_time`,
        [
          user.clinicId,
          professionalId,
          dto.date,
          // Un solo día es el rango que empieza y termina el mismo día: así no
          // hay dos formas de representar lo mismo.
          dto.dateTo ?? dto.date,
          dto.kind,
          dto.startTime ?? null,
          dto.endTime ?? null,
        ],
      );
      return r.rows[0];
    });
  }

  listExceptions(user: AuthUser, professionalId?: string, from?: string, to?: string) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `SELECT id, professional_id, date, date_to, kind, start_time, end_time
           FROM availability_exceptions
          WHERE ($1::uuid IS NULL OR professional_id = $1)
            -- Solapamiento, no "empieza dentro": un bloqueo del 1 al 30 tiene
            -- que aparecer cuando se consulta la semana del 10.
            AND ($2::date IS NULL OR date_to >= $2::date)
            AND ($3::date IS NULL OR date    <= $3::date)
          ORDER BY date, start_time NULLS FIRST`,
        [professionalId ?? null, from ?? null, to ?? null],
      );
      return r.rows;
    });
  }

  async deleteException(user: AuthUser, id: string) {
    const row = await this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query<{ professional_id: string }>(
        'SELECT professional_id FROM availability_exceptions WHERE id = $1',
        [id],
      );
      return r.rows[0];
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Bloqueo no encontrado',
        code: 'EXCEPTION_NOT_FOUND',
      });
    }
    this.resolveProfessional(user, row.professional_id);

    return this.db.withTenant(this.ctx(user), async (c) => {
      await c.query('DELETE FROM availability_exceptions WHERE id = $1', [id]);
      return { ok: true };
    });
  }

  /**
   * Huecos libres de un profesional entre dos fechas.
   *
   * Un hueco existe si: cae dentro de la semana tipo (o de una excepción que
   * suma horas), el día no está bloqueado, no lo pisa un bloqueo parcial, y no
   * hay un turno activo encima. Todo en la zona horaria de la clínica.
   */
  freeSlots(
    user: AuthUser,
    professionalId: string,
    from: string,
    to: string,
    includeTaken = false,
  ) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `
        WITH cfg AS (SELECT timezone FROM clinics WHERE id = app_current_clinic()),
        dias AS (
          SELECT d::date AS dia FROM generate_series($2::date, $3::date, interval '1 day') d
        ),
        -- Días bloqueados por completo (excepción 'remove' sin horario).
        -- Un bloqueo puede abarcar varios días (vacaciones): se expande a un día
        -- por fila. Mirando sólo date se bloqueaba nada más que el primero.
        dias_bloqueados AS (
          SELECT d::date AS dia
            FROM availability_exceptions e,
                 LATERAL generate_series(e.date, e.date_to, interval '1 day') d
           WHERE e.professional_id = $1 AND e.kind = 'remove' AND e.start_time IS NULL
        ),
        -- Para las aperturas puntuales, que no traen tamaño de turno propio.
        slot_default AS (
          SELECT COALESCE(min(slot_minutes), 30) AS mins
            FROM availability_blocks WHERE professional_id = $1
        ),
        -- Franjas de atención = semana tipo + aperturas puntuales.
        franjas AS (
          SELECT d.dia, b.start_time, b.end_time, b.slot_minutes, b.room_id
            FROM dias d
            JOIN availability_blocks b
              ON b.professional_id = $1
             AND b.weekday = extract(dow from d.dia)::int
             AND (b.valid_from IS NULL OR b.valid_from <= d.dia)
             AND (b.valid_to   IS NULL OR b.valid_to   >= d.dia)
           WHERE d.dia NOT IN (SELECT dia FROM dias_bloqueados)
          UNION ALL
          -- Las aperturas puntuales no tienen consultorio propio: queda en null.
          SELECT d::date, e.start_time, e.end_time, (SELECT mins FROM slot_default), NULL::uuid
            FROM availability_exceptions e,
                 LATERAL generate_series(
                   GREATEST(e.date, $2::date), LEAST(e.date_to, $3::date), interval '1 day'
                 ) d
           WHERE e.professional_id = $1 AND e.kind = 'add'
             AND e.start_time IS NOT NULL AND e.end_time IS NOT NULL
             AND e.date <= $3::date AND e.date_to >= $2::date
        ),
        slots AS (
          SELECT gs AS slot_start,
                 gs + make_interval(mins => f.slot_minutes) AS slot_end,
                 f.room_id
            FROM franjas f, cfg,
            LATERAL generate_series(
              (f.dia + f.start_time) AT TIME ZONE cfg.timezone,
              (f.dia + f.end_time) AT TIME ZONE cfg.timezone - make_interval(mins => f.slot_minutes),
              make_interval(mins => f.slot_minutes)
            ) AS gs
        )
        SELECT DISTINCT s.slot_start AS "start", s.slot_end AS "end", s.room_id AS "roomId",
               EXISTS (
                 SELECT 1 FROM appointments a
                  WHERE a.professional_id = $1
                    AND a.status IN ('scheduled','confirmed','completed')
                    AND a.during && tstzrange(s.slot_start, s.slot_end, '[)')
               ) AS "taken"
          FROM slots s, cfg
         WHERE ($4::bool OR NOT EXISTS (
           SELECT 1 FROM appointments a
            WHERE a.professional_id = $1
              AND a.status IN ('scheduled','confirmed','completed')
              AND a.during && tstzrange(s.slot_start, s.slot_end, '[)')
         ))
           -- Un bloqueo de agenda NO se puede sobreturnear: si el profesional no
           -- está, no hay a quién encajarle el paciente.
           AND NOT EXISTS (
           -- Bloqueos parciales: media jornada, un rato para una reunión. Si el
           -- bloqueo abarca varios días, esa franja se repite todos esos días.
           SELECT 1 FROM availability_exceptions e,
                 LATERAL generate_series(e.date, e.date_to, interval '1 day') d
            WHERE e.professional_id = $1
              AND e.kind = 'remove'
              AND e.start_time IS NOT NULL
              AND tstzrange(
                    (d::date + e.start_time) AT TIME ZONE cfg.timezone,
                    (d::date + COALESCE(e.end_time, time '23:59')) AT TIME ZONE cfg.timezone,
                    '[)'
                  ) && tstzrange(s.slot_start, s.slot_end, '[)')
         )
         ORDER BY 1
        `,
        [professionalId, from, to, includeTaken],
      );
      return r.rows;
    });
  }
}

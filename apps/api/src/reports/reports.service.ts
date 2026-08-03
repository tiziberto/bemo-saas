import { Injectable } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuthUser } from '../security/current-user.decorator';

export interface ProfessionalReport {
  professional_id: string;
  full_name: string;
  total: number;
  completed: number;
  confirmed: number;
  scheduled: number;
  cancelled: number;
  no_show: number;
  no_show_rate: number;
  booked_minutes: number;
  available_minutes: number;
  occupancy_rate: number;
  new_patients: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly db: DbService) {}

  /**
   * La foto del período por profesional.
   *
   * Ocupación = minutos agendados ÷ minutos de atención configurados. Los
   * minutos configurados salen de la semana tipo (`availability_blocks`)
   * contando cuántas veces cae cada día de semana dentro del rango, menos las
   * excepciones que bloquean el día completo.
   *
   * Todo se calcula en la zona horaria de la clínica: un turno de las 23:30 es
   * del día que la recepción cree que es.
   */
  summary(user: AuthUser, from: string, to: string, professionalId?: string) {
    return this.db.withTenant(
      { clinicId: user.clinicId, userId: user.userId },
      async (c) => {
        const r = await c.query<ProfessionalReport>(
          `
          WITH cfg AS (SELECT timezone FROM clinics WHERE id = app_current_clinic()),
          profs AS (
            SELECT DISTINCT u.id, u.full_name
              FROM users u
              JOIN user_roles ur ON ur.user_id = u.id
             WHERE ur.role = 'professional' AND u.is_active
               AND ($3::uuid IS NULL OR u.id = $3)
          ),
          -- Turnos del rango, ubicados por la fecha local de la clínica.
          appts AS (
            SELECT a.professional_id,
                   a.status,
                   EXTRACT(EPOCH FROM (a.ends_at - a.starts_at)) / 60 AS minutes
              FROM appointments a, cfg
             WHERE (a.starts_at AT TIME ZONE cfg.timezone)::date BETWEEN $1::date AND $2::date
          ),
          por_estado AS (
            SELECT professional_id,
                   count(*)::int AS total,
                   count(*) FILTER (WHERE status = 'completed')::int AS completed,
                   count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
                   count(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
                   count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
                   count(*) FILTER (WHERE status = 'no_show')::int  AS no_show,
                   COALESCE(sum(minutes) FILTER (WHERE status <> 'cancelled'), 0)::int AS booked_minutes
              FROM appts GROUP BY professional_id
          ),
          -- Cada día del rango, con su día de semana.
          dias AS (
            SELECT d::date AS dia, extract(dow from d)::int AS dow
              FROM generate_series($1::date, $2::date, interval '1 day') d
          ),
          -- Minutos de atención configurados, descontando los días bloqueados
          -- por una excepción de tipo 'remove' que cubre el día entero.
          disponibilidad AS (
            SELECT b.professional_id,
                   COALESCE(sum(EXTRACT(EPOCH FROM (b.end_time - b.start_time)) / 60), 0)::int AS available_minutes
              FROM availability_blocks b
              JOIN dias ON dias.dow = b.weekday
             WHERE (b.valid_from IS NULL OR b.valid_from <= dias.dia)
               AND (b.valid_to   IS NULL OR b.valid_to   >= dias.dia)
               AND NOT EXISTS (
                 SELECT 1 FROM availability_exceptions e
                  WHERE e.professional_id = b.professional_id
                    AND e.kind = 'remove'
                    AND e.date = dias.dia
                    AND e.start_time IS NULL
               )
             GROUP BY b.professional_id
          ),
          -- Pacientes que cada profesional sumó a su lista en el período.
          -- Va por función acotada: la relación profesional↔paciente es privada
          -- (RLS), pero el conteo es información de gestión y no revela a nadie.
          nuevos AS (
            SELECT o_professional_id AS professional_id, o_new_patients AS new_patients
              FROM report_new_patients($1::date, $2::date)
          )
          SELECT p.id AS professional_id,
                 p.full_name,
                 COALESCE(e.total, 0)      AS total,
                 COALESCE(e.completed, 0)  AS completed,
                 COALESCE(e.confirmed, 0)  AS confirmed,
                 COALESCE(e.scheduled, 0)  AS scheduled,
                 COALESCE(e.cancelled, 0)  AS cancelled,
                 COALESCE(e.no_show, 0)    AS no_show,
                 -- Sobre los turnos que llegaron a término: cancelar con aviso
                 -- no es lo mismo que no presentarse.
                 CASE WHEN COALESCE(e.completed, 0) + COALESCE(e.no_show, 0) = 0 THEN 0
                      ELSE round(100.0 * e.no_show / (e.completed + e.no_show), 1)
                 END AS no_show_rate,
                 COALESCE(e.booked_minutes, 0) AS booked_minutes,
                 COALESCE(d.available_minutes, 0) AS available_minutes,
                 CASE WHEN COALESCE(d.available_minutes, 0) = 0 THEN 0
                      ELSE round(100.0 * COALESCE(e.booked_minutes, 0) / d.available_minutes, 1)
                 END AS occupancy_rate,
                 COALESCE(n.new_patients, 0) AS new_patients
            FROM profs p
            LEFT JOIN por_estado e ON e.professional_id = p.id
            LEFT JOIN disponibilidad d ON d.professional_id = p.id
            LEFT JOIN nuevos n ON n.professional_id = p.id
           ORDER BY p.full_name
          `,
          [from, to, professionalId ?? null],
        );
        return r.rows.map((row) => ({
          ...row,
          no_show_rate: Number(row.no_show_rate),
          occupancy_rate: Number(row.occupancy_rate),
        }));
      },
    );
  }

  /** Serie diaria de turnos del período: para ver la forma del mes de un vistazo. */
  daily(user: AuthUser, from: string, to: string) {
    return this.db.withTenant(
      { clinicId: user.clinicId, userId: user.userId },
      async (c) => {
        const r = await c.query(
          `
          WITH cfg AS (SELECT timezone FROM clinics WHERE id = app_current_clinic())
          SELECT d::date AS date,
                 count(a.id)::int AS total,
                 count(a.id) FILTER (WHERE a.status = 'no_show')::int AS no_show
            FROM generate_series($1::date, $2::date, interval '1 day') d
            LEFT JOIN cfg ON true
            LEFT JOIN appointments a
              ON (a.starts_at AT TIME ZONE cfg.timezone)::date = d::date
             AND a.status <> 'cancelled'
           GROUP BY d
           ORDER BY d
          `,
          [from, to],
        );
        return r.rows;
      },
    );
  }
}

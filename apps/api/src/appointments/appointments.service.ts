import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../database/db.service';
import { AuthUser } from '../security/current-user.decorator';
import { CreateAppointmentDto, PersonInput } from './dto';

function mapConflict(err: unknown): unknown {
  const e = err as { code?: string; constraint?: string };
  if (e?.code === '23P01') {
    // Los dos códigos significan "ese lugar ya está tomado": son justamente los
    // que el frontend puede reintentar como sobreturno tras una segunda confirmación.
    if (e.constraint === 'no_room_overlap') {
      return new ConflictException({
        message: 'La sala ya está ocupada en esa franja',
        code: 'ROOM_SLOT_TAKEN',
      });
    }
    return new ConflictException({
      message: 'El profesional ya tiene un turno en esa franja',
      code: 'PROFESSIONAL_SLOT_TAKEN',
    });
  }
  return err;
}

/**
 * Clave de lock derivada de un UUID: los primeros 60 bits en hexa entran en el
 * bigint que pide `pg_advisory_xact_lock`.
 */
function lockKey(uuid: string): string {
  return BigInt('0x' + uuid.replace(/-/g, '').slice(0, 15)).toString();
}

@Injectable()
export class AppointmentsService {
  constructor(private readonly db: DbService) {}

  /**
   * Serializa las reservas que podrían chocar, ANTES de tocar el constraint.
   *
   * Sin esto, varias reservas simultáneas al mismo horario se esperan entre sí
   * dentro del índice del EXCLUDE y el grafo de esperas cicla: Postgres mata
   * transacciones con deadlock y la recepción ve un 500. Con un lock por
   * profesional (y por sala) tomado siempre en el mismo orden, no hay ciclo
   * posible: el segundo espera, encuentra el turno ya confirmado y recibe el
   * 409 que corresponde.
   *
   * El lock es `xact`: se libera solo al terminar la transacción.
   */
  private async lockResources(client: PoolClient, ...ids: (string | null | undefined)[]) {
    const keys = [...new Set(ids.filter(Boolean).map((id) => lockKey(id as string)))];
    // Orden global estable: dos transacciones nunca los toman al revés.
    keys.sort();
    for (const key of keys) {
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [key]);
    }
  }

  private async findOrCreatePerson(
    client: PoolClient,
    clinicId: string,
    p: PersonInput,
  ): Promise<string> {
    const found = await client.query<{ id: string }>(
      'SELECT id FROM persons WHERE dni = $1 AND deleted_at IS NULL',
      [p.dni],
    );
    if (found.rows[0]) return found.rows[0].id;
    const created = await client.query<{ id: string }>(
      `INSERT INTO persons(clinic_id, dni, first_name, last_name, phone, email)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [clinicId, p.dni, p.firstName, p.lastName, p.phone ?? null, p.email ?? null],
    );
    return created.rows[0].id;
  }

  async book(user: AuthUser, dto: CreateAppointmentDto) {
    const duration = dto.durationMinutes ?? 30;
    const endsAt = new Date(
      new Date(dto.startsAt).getTime() + duration * 60000,
    ).toISOString();
    try {
      return await this.db.withTenant(
        { clinicId: user.clinicId, userId: user.userId },
        async (c) => {
          await this.lockResources(c, dto.professionalId, dto.roomId);
          const personId = await this.findOrCreatePerson(
            c,
            user.clinicId,
            dto.person,
          );
          const r = await c.query(
            `INSERT INTO appointments
               (clinic_id, professional_id, room_id, person_id, starts_at, ends_at, reason, created_by_user_id, is_overbook)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING id, professional_id, room_id, person_id, starts_at, ends_at, status, reason, is_overbook`,
            [
              user.clinicId,
              dto.professionalId,
              dto.roomId ?? null,
              personId,
              dto.startsAt,
              endsAt,
              dto.reason ?? null,
              user.userId,
              dto.allowOverbook === true,
            ],
          );
          return r.rows[0];
        },
      );
    } catch (err) {
      throw mapConflict(err);
    }
  }

  /**
   * `limit` existe para las preguntas de tipo "¿hay al menos uno?": sin él, saber si la
   * clínica tiene algún turno obligaba a traerlos todos. `LIMIT NULL` en Postgres es
   * "sin límite", así que omitirlo mantiene el comportamiento anterior.
   */
  list(user: AuthUser, professionalId?: string, date?: string, limit?: number) {
    return this.db.withTenant(
      { clinicId: user.clinicId, userId: user.userId },
      async (c) => {
        const r = await c.query(
          `SELECT a.id, a.starts_at, a.ends_at, a.status, a.reason,
                  a.professional_id, a.room_id, a.person_id,
                  p.first_name, p.last_name, p.dni, p.phone
             FROM appointments a
             JOIN persons p ON p.id = a.person_id
            WHERE ($1::uuid IS NULL OR a.professional_id = $1)
              AND ($2::date IS NULL OR
                   (a.starts_at AT TIME ZONE (SELECT timezone FROM clinics WHERE id = app_current_clinic()))::date = $2::date)
            ORDER BY a.starts_at
            LIMIT $3::int`,
          [professionalId ?? null, date ?? null, limit ?? null],
        );
        return r.rows;
      },
    );
  }

  updateStatus(user: AuthUser, id: string, status: string) {
    return this.db.withTenant(
      { clinicId: user.clinicId, userId: user.userId },
      async (c) => {
        const r = await c.query(
          'UPDATE appointments SET status = $2 WHERE id = $1 RETURNING id, status',
          [id, status],
        );
        // Un turno de otra clínica no existe para RLS: 404, no un 200 con null.
        // Devolver null silenciaba el intento y dejaba al cliente creyendo que
        // había funcionado.
        if (!r.rows[0]) {
          throw new NotFoundException({
            message: 'Turno no encontrado',
            code: 'APPOINTMENT_NOT_FOUND',
          });
        }
        return r.rows[0];
      },
    );
  }
}

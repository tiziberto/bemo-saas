import { Injectable } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuthUser } from '../security/current-user.decorator';

/**
 * Búsqueda de personas para agendar.
 *
 * Devuelve SÓLO datos de contacto: nombre, DNI, teléfono, email. Nada clínico.
 * La recepción necesita esto para no volver a cargar a un paciente que ya
 * existe; quién es paciente de quién y qué tiene en su historia sigue siendo
 * privado del profesional.
 */
@Injectable()
export class PersonsService {
  constructor(private readonly db: DbService) {}

  search(user: AuthUser, dni?: string, q?: string) {
    return this.db.withTenant(
      { clinicId: user.clinicId, userId: user.userId },
      async (c) => {
        const term = (q ?? '').trim();
        const r = await c.query(
          `SELECT id, dni, first_name, last_name, phone, email
             FROM persons
            WHERE deleted_at IS NULL
              AND ($1::text IS NULL OR dni = $1)
              AND ($2::text IS NULL OR (
                    first_name || ' ' || last_name ILIKE '%' || $2 || '%'
                 OR dni ILIKE $2 || '%'))
            ORDER BY last_name, first_name
            LIMIT 20`,
          [dni?.trim() || null, term || null],
        );
        return r.rows;
      },
    );
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../database/db.service';
import { AuthUser } from '../security/current-user.decorator';
import {
  ClinicalEntryDto,
  CreatePatientDto,
  ImportDto,
  ShareDto,
} from './dto';

@Injectable()
export class PatientsService {
  constructor(private readonly db: DbService) {}

  private audit(
    c: PoolClient,
    user: AuthUser,
    action: string,
    resourceType: string,
    resourceId: string | null,
    decision: 'allow' | 'deny',
  ) {
    return c.query(
      `INSERT INTO audit_log(clinic_id, actor_user_id, action, resource_type, resource_id, decision)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [user.clinicId, user.userId, action, resourceType, resourceId, decision],
    );
  }

  private async findOrCreatePerson(
    c: PoolClient,
    clinicId: string,
    p: {
      dni: string; firstName: string; lastName: string;
      phone?: string; email?: string; sex?: string; birthdate?: string;
    },
  ): Promise<string> {
    const found = await c.query<{ id: string }>(
      'SELECT id FROM persons WHERE dni = $1 AND deleted_at IS NULL',
      [p.dni],
    );
    if (found.rows[0]) return found.rows[0].id;
    const created = await c.query<{ id: string }>(
      `INSERT INTO persons(clinic_id, dni, first_name, last_name, phone, email, sex, birthdate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [clinicId, p.dni, p.firstName, p.lastName, p.phone ?? null, p.email ?? null,
       p.sex ?? null, p.birthdate ?? null],
    );
    return created.rows[0].id;
  }

  private ctx(user: AuthUser) {
    return { clinicId: user.clinicId, userId: user.userId };
  }

  async create(user: AuthUser, dto: CreatePatientDto) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const personId = await this.findOrCreatePerson(c, user.clinicId, dto);
      await c.query(
        `INSERT INTO patient_links(clinic_id, professional_id, person_id)
         VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [user.clinicId, user.userId, personId],
      );
      return { personId, dni: dto.dni, firstName: dto.firstName, lastName: dto.lastName };
    });
  }

  list(user: AuthUser) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `SELECT p.id, p.dni, p.first_name, p.last_name, p.phone, true AS owned
           FROM persons p
           JOIN patient_links pl ON pl.person_id = p.id
          WHERE pl.professional_id = app_current_user() AND pl.deleted_at IS NULL AND p.deleted_at IS NULL
         UNION
         SELECT p.id, p.dni, p.first_name, p.last_name, p.phone, false AS owned
           FROM persons p
           JOIN patient_shares s ON s.person_id = p.id
          WHERE s.shared_with_professional_id = app_current_user() AND s.revoked_at IS NULL AND p.deleted_at IS NULL
          ORDER BY last_name, first_name`,
      );
      return r.rows;
    });
  }

  async addEntry(user: AuthUser, personId: string, dto: ClinicalEntryDto) {
    const isPatient = await this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        'SELECT 1 FROM patient_links WHERE person_id = $1 AND professional_id = app_current_user() AND deleted_at IS NULL',
        [personId],
      );
      return r.rowCount! > 0;
    });
    if (!isPatient) {
      await this.db.withTenant(this.ctx(user), (c) =>
        this.audit(c, user, 'create_clinical_entry', 'clinical_entries', personId, 'deny'),
      );
      throw new ForbiddenException({
        message: 'Esa persona no es tu paciente',
        code: 'NOT_YOUR_PATIENT',
      });
    }
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `INSERT INTO clinical_entries(clinic_id, person_id, author_professional_id, entry_date, type, content)
         VALUES ($1,$2,app_current_user(),COALESCE($3::date, current_date),$4,$5)
         RETURNING id, entry_date, type, content`,
        [user.clinicId, personId, dto.entryDate ?? null, dto.type, dto.content],
      );
      await this.audit(c, user, 'create_clinical_entry', 'clinical_entries', personId, 'allow');
      return r.rows[0];
    });
  }

  async getEntries(user: AuthUser, personId: string) {
    const hasAccess = await this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query<{ has: boolean }>(
        `SELECT (
           EXISTS (SELECT 1 FROM patient_links WHERE person_id = $1 AND professional_id = app_current_user() AND deleted_at IS NULL)
           OR EXISTS (SELECT 1 FROM patient_shares WHERE person_id = $1 AND shared_with_professional_id = app_current_user() AND revoked_at IS NULL)
         ) AS has`,
        [personId],
      );
      return r.rows[0].has;
    });
    if (!hasAccess) {
      await this.db.withTenant(this.ctx(user), (c) =>
        this.audit(c, user, 'read_clinical_history', 'clinical_entries', personId, 'deny'),
      );
      throw new ForbiddenException({
        message: 'No tenés acceso a esta historia clínica',
        code: 'FORBIDDEN_HISTORY',
      });
    }
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `SELECT id, entry_date, type, content, author_professional_id
           FROM clinical_entries
          WHERE person_id = $1 AND deleted_at IS NULL
          ORDER BY entry_date DESC, created_at DESC`,
        [personId],
      );
      await this.audit(c, user, 'read_clinical_history', 'clinical_entries', personId, 'allow');
      return r.rows;
    });
  }

  async share(user: AuthUser, personId: string, dto: ShareDto) {
    const isPatient = await this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        'SELECT 1 FROM patient_links WHERE person_id = $1 AND professional_id = app_current_user() AND deleted_at IS NULL',
        [personId],
      );
      return r.rowCount! > 0;
    });
    if (!isPatient) {
      throw new ForbiddenException({
        message: 'Solo podés compartir tus propios pacientes',
        code: 'NOT_YOUR_PATIENT',
      });
    }
    return this.db.withTenant(this.ctx(user), async (c) => {
      const consent = await c.query<{ id: string }>(
        `INSERT INTO consents(clinic_id, person_id, type, created_by_user_id)
         VALUES ($1,$2,'sharing',app_current_user()) RETURNING id`,
        [user.clinicId, personId],
      );
      const share = await c.query<{ id: string }>(
        `INSERT INTO patient_shares(person_id, owner_professional_id, shared_with_professional_id, consent_id)
         VALUES ($1, app_current_user(), $2, $3) RETURNING id, created_at`,
        [personId, dto.sharedWithProfessionalId, consent.rows[0].id],
      );
      await this.audit(c, user, 'share_patient', 'patient_shares', share.rows[0].id, 'allow');
      return share.rows[0];
    });
  }

  async revokeShare(user: AuthUser, shareId: string) {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `UPDATE patient_shares SET revoked_at = now()
          WHERE id = $1 AND owner_professional_id = app_current_user() AND revoked_at IS NULL
          RETURNING id`,
        [shareId],
      );
      if (r.rowCount === 0) {
        throw new NotFoundException({
          message: 'Compartir no encontrado',
          code: 'SHARE_NOT_FOUND',
        });
      }
      await this.audit(c, user, 'revoke_share', 'patient_shares', shareId, 'allow');
      return { ok: true };
    });
  }

  async importCsv(user: AuthUser, dto: ImportDto) {
    const lines = dto.csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    let created = 0;
    let errors = 0;
    await this.db.withTenant(this.ctx(user), async (c) => {
      for (const line of lines) {
        const [dni, firstName, lastName, phone, email] = line
          .split(',')
          .map((x) => x.trim());
        if (!dni || dni.toLowerCase() === 'dni' || !firstName || !lastName) {
          continue; // header o fila inválida
        }
        try {
          const personId = await this.findOrCreatePerson(c, user.clinicId, {
            dni,
            firstName,
            lastName,
            phone,
            email,
          });
          await c.query(
            `INSERT INTO patient_links(clinic_id, professional_id, person_id)
             VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [user.clinicId, user.userId, personId],
          );
          created += 1;
        } catch {
          errors += 1;
        }
      }
    });
    return { imported: created, errors };
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { loadEnv } from '../config/env';
import { DbService } from '../database/db.service';
import { AuthUser } from '../security/current-user.decorator';
import { StorageService } from '../storage/storage.service';

/** Lo que un consultorio realmente adjunta: imágenes de estudios y PDFs. */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'application/dicom',
]);

export interface AttachmentRow {
  id: string;
  person_id: string;
  filename: string;
  mime: string;
  size_bytes: string;
  note: string | null;
  created_at: string;
  uploaded_by: string;
  storage_key?: string;
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly db: DbService,
    private readonly storage: StorageService,
  ) {}

  private ctx(user: AuthUser) {
    return { clinicId: user.clinicId, userId: user.userId };
  }

  private audit(
    c: PoolClient,
    user: AuthUser,
    action: string,
    resourceId: string | null,
    decision: 'allow' | 'deny',
  ) {
    return c.query(
      `INSERT INTO audit_log(clinic_id, actor_user_id, action, resource_type, resource_id, decision)
       VALUES ($1,$2,$3,'attachments',$4,$5)`,
      [user.clinicId, user.userId, action, resourceId, decision],
    );
  }

  /** ¿Es paciente propio? Es lo que habilita subir y borrar. */
  private async ownsPatient(user: AuthUser, personId: string): Promise<boolean> {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query(
        `SELECT 1 FROM patient_links
          WHERE person_id = $1 AND professional_id = app_current_user() AND deleted_at IS NULL`,
        [personId],
      );
      return r.rowCount! > 0;
    });
  }

  async upload(
    user: AuthUser,
    personId: string,
    file: Express.Multer.File,
    note?: string,
  ) {
    if (!file) {
      throw new BadRequestException({
        message: 'No llegó ningún archivo',
        code: 'NO_FILE',
      });
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException({
        message: `Tipo de archivo no permitido: ${file.mimetype}. Se aceptan imágenes y PDF.`,
        code: 'MIME_NOT_ALLOWED',
      });
    }

    if (!(await this.ownsPatient(user, personId))) {
      await this.db.withTenant(this.ctx(user), (c) =>
        this.audit(c, user, 'upload_attachment', personId, 'deny'),
      );
      throw new ForbiddenException({
        message: 'Esa persona no es tu paciente',
        code: 'NOT_YOUR_PATIENT',
      });
    }

    const key = this.storage.buildKey(user.clinicId, personId, file.originalname);
    const { checksum, size } = await this.storage.put(key, file.buffer);

    try {
      return await this.db.withTenant(this.ctx(user), async (c) => {
        const r = await c.query(
          `INSERT INTO attachments
             (clinic_id, person_id, uploaded_by, filename, mime, size_bytes, storage_key, checksum, note)
           VALUES ($1,$2,app_current_user(),$3,$4,$5,$6,$7,$8)
           RETURNING id, person_id, filename, mime, size_bytes, note, created_at, uploaded_by`,
          [
            user.clinicId,
            personId,
            file.originalname.slice(0, 200),
            file.mimetype,
            size,
            key,
            checksum,
            note ?? null,
          ],
        );
        await this.audit(c, user, 'upload_attachment', r.rows[0].id, 'allow');
        return r.rows[0];
      });
    } catch (err) {
      // Si la fila no se guardó, el archivo huérfano no debe quedar en disco.
      await this.storage.remove(key);
      throw err;
    }
  }

  /** Lista los adjuntos de un paciente: propios o compartidos en lectura. */
  async list(user: AuthUser, personId: string): Promise<AttachmentRow[]> {
    return this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query<AttachmentRow>(
        `SELECT id, person_id, filename, mime, size_bytes, note, created_at, uploaded_by
           FROM attachments
          WHERE person_id = $1 AND deleted_at IS NULL
          ORDER BY created_at DESC`,
        [personId],
      );
      if (r.rowCount) await this.audit(c, user, 'list_attachments', personId, 'allow');
      return r.rows;
    });
  }

  /**
   * Devuelve la metadata para servir el contenido. RLS ya decide si se ve o no:
   * si no hay fila, para este usuario el archivo no existe.
   */
  async getForDownload(user: AuthUser, personId: string, id: string) {
    const row = await this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query<AttachmentRow>(
        `SELECT id, filename, mime, size_bytes, storage_key
           FROM attachments
          WHERE id = $1 AND person_id = $2 AND deleted_at IS NULL`,
        [id, personId],
      );
      const found = r.rows[0];
      await this.audit(c, user, 'read_attachment', id, found ? 'allow' : 'deny');
      return found;
    });

    if (!row) {
      throw new NotFoundException({
        message: 'Adjunto no encontrado',
        code: 'ATTACHMENT_NOT_FOUND',
      });
    }
    if (!this.storage.exists(row.storage_key!)) {
      throw new NotFoundException({
        message: 'El archivo no está disponible',
        code: 'ATTACHMENT_FILE_MISSING',
      });
    }
    return row;
  }

  stream(key: string) {
    return this.storage.stream(key);
  }

  /**
   * Baja lógica. El archivo se borra del almacenamiento, pero la fila queda con
   * `deleted_at`: la trazabilidad de que existió es parte de la historia.
   */
  async remove(user: AuthUser, personId: string, id: string) {
    const row = await this.db.withTenant(this.ctx(user), async (c) => {
      const r = await c.query<{ storage_key: string }>(
        `UPDATE attachments SET deleted_at = now()
          WHERE id = $1 AND person_id = $2 AND uploaded_by = app_current_user()
            AND deleted_at IS NULL
          RETURNING storage_key`,
        [id, personId],
      );
      await this.audit(c, user, 'delete_attachment', id, r.rowCount ? 'allow' : 'deny');
      return r.rows[0];
    });

    if (!row) {
      throw new NotFoundException({
        message: 'Adjunto no encontrado o no es tuyo',
        code: 'ATTACHMENT_NOT_FOUND',
      });
    }
    await this.storage.remove(row.storage_key);
    return { ok: true };
  }

  maxBytes(): number {
    return loadEnv().maxUploadMb * 1024 * 1024;
  }
}

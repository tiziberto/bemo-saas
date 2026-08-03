import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import { createTestApp, http, ownerDb, uniqueDni } from './utils/harness';
import {
  addMember,
  createPatient,
  registerClinic,
  type Session,
} from './utils/fixtures';

// Un PNG mínimo válido (1x1 transparente).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Adjuntos: radiografías y estudios', () => {
  let app: INestApplication;
  let db: Client;
  let admin: Session;
  let dueño: Session;
  let ajeno: Session;
  let recep: Session;
  let personId: string;
  let attachmentId: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = ownerDb();
    await db.connect();

    const clinic = await registerClinic(app, 'Clínica adjuntos');
    admin = clinic.admin;
    dueño = await addMember(app, admin, 'professional', 'Dra. Dueña');
    ajeno = await addMember(app, admin, 'professional', 'Dr. Ajeno');
    recep = await addMember(app, admin, 'receptionist', 'Recepción');

    personId = (await createPatient(app, dueño, { dni: uniqueDni() })).personId;
  });

  afterAll(async () => {
    await db.end();
    await app.close();
  });

  it('el profesional sube un estudio a la ficha de su paciente', async () => {
    const res = await http(app)
      .post(`/v1/patients/${personId}/attachments`)
      .set('authorization', `Bearer ${dueño.token}`)
      .field('note', 'Panorámica inicial')
      .attach('file', PNG, { filename: 'panoramica.png', contentType: 'image/png' })
      .expect(201);

    attachmentId = res.body.id;
    expect(res.body).toMatchObject({
      filename: 'panoramica.png',
      mime: 'image/png',
      note: 'Panorámica inicial',
      person_id: personId,
    });
    expect(Number(res.body.size_bytes)).toBe(PNG.length);
  });

  it('aparece en el listado de la ficha', async () => {
    const res = await http(app)
      .get(`/v1/patients/${personId}/attachments`)
      .set('authorization', `Bearer ${dueño.token}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(attachmentId);
    // El listado nunca expone dónde está guardado el archivo.
    expect(res.body[0].storage_key).toBeUndefined();
  });

  it('el contenido se descarga con su tipo y no se cachea', async () => {
    const res = await http(app)
      .get(`/v1/patients/${personId}/attachments/${attachmentId}/content`)
      .set('authorization', `Bearer ${dueño.token}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers['content-disposition']).toContain('panoramica.png');
    expect(Buffer.from(res.body).length).toBe(PNG.length);
  });

  it('rechaza tipos de archivo que no son estudios', async () => {
    const res = await http(app)
      .post(`/v1/patients/${personId}/attachments`)
      .set('authorization', `Bearer ${dueño.token}`)
      .attach('file', Buffer.from('#!/bin/sh\nrm -rf /'), {
        filename: 'script.sh',
        contentType: 'application/x-sh',
      })
      .expect(400);
    expect(res.body.code).toBe('MIME_NOT_ALLOWED');
  });

  it('rechaza subir a un paciente que no es tuyo', async () => {
    const res = await http(app)
      .post(`/v1/patients/${personId}/attachments`)
      .set('authorization', `Bearer ${ajeno.token}`)
      .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' })
      .expect(403);
    expect(res.body.code).toBe('NOT_YOUR_PATIENT');
  });

  it('la recepción no accede a los adjuntos', async () => {
    const lista = await http(app)
      .get(`/v1/patients/${personId}/attachments`)
      .set('authorization', `Bearer ${recep.token}`)
      .expect(403);
    expect(lista.body.code).toBe('FORBIDDEN_ROLE');

    await http(app)
      .get(`/v1/patients/${personId}/attachments/${attachmentId}/content`)
      .set('authorization', `Bearer ${recep.token}`)
      .expect(403);
  });

  it('un profesional ajeno no ve ni descarga el adjunto', async () => {
    const lista = await http(app)
      .get(`/v1/patients/${personId}/attachments`)
      .set('authorization', `Bearer ${ajeno.token}`)
      .expect(200);
    expect(lista.body).toEqual([]);

    const bajada = await http(app)
      .get(`/v1/patients/${personId}/attachments/${attachmentId}/content`)
      .set('authorization', `Bearer ${ajeno.token}`)
      .expect(404);
    expect(bajada.body.code).toBe('ATTACHMENT_NOT_FOUND');
  });

  it('sin token no se descarga nada', async () => {
    await http(app)
      .get(`/v1/patients/${personId}/attachments/${attachmentId}/content`)
      .expect(401);
  });

  describe('compartir', () => {
    let shareId: string;

    it('al compartir el paciente, el otro profesional LEE los estudios', async () => {
      const share = await http(app)
        .post(`/v1/patients/${personId}/shares`)
        .set('authorization', `Bearer ${dueño.token}`)
        .send({ sharedWithProfessionalId: ajeno.userId })
        .expect(201);
      shareId = share.body.id;

      const lista = await http(app)
        .get(`/v1/patients/${personId}/attachments`)
        .set('authorization', `Bearer ${ajeno.token}`)
        .expect(200);
      expect(lista.body).toHaveLength(1);

      await http(app)
        .get(`/v1/patients/${personId}/attachments/${attachmentId}/content`)
        .set('authorization', `Bearer ${ajeno.token}`)
        .expect(200);
    });

    it('el compartido no puede subir ni borrar: es sólo lectura', async () => {
      await http(app)
        .post(`/v1/patients/${personId}/attachments`)
        .set('authorization', `Bearer ${ajeno.token}`)
        .attach('file', PNG, { filename: 'y.png', contentType: 'image/png' })
        .expect(403);

      const borrado = await http(app)
        .delete(`/v1/patients/${personId}/attachments/${attachmentId}`)
        .set('authorization', `Bearer ${ajeno.token}`)
        .expect(404);
      expect(borrado.body.code).toBe('ATTACHMENT_NOT_FOUND');
    });

    it('al revocar, se corta también el acceso a los estudios', async () => {
      await http(app)
        .delete(`/v1/patients/${personId}/shares/${shareId}`)
        .set('authorization', `Bearer ${dueño.token}`)
        .expect(200);

      const lista = await http(app)
        .get(`/v1/patients/${personId}/attachments`)
        .set('authorization', `Bearer ${ajeno.token}`)
        .expect(200);
      expect(lista.body).toEqual([]);

      await http(app)
        .get(`/v1/patients/${personId}/attachments/${attachmentId}/content`)
        .set('authorization', `Bearer ${ajeno.token}`)
        .expect(404);
    });
  });

  it('otra clínica no ve nada, ni siquiera con el id exacto', async () => {
    const otra = await registerClinic(app, 'Clínica vecina');
    const res = await http(app)
      .get(`/v1/patients/${personId}/attachments/${attachmentId}/content`)
      .set('authorization', `Bearer ${otra.admin.token}`)
      .expect(404);
    expect(res.body.code).toBe('ATTACHMENT_NOT_FOUND');
  });

  it('cada acceso a un estudio queda auditado', async () => {
    const r = await db.query(
      `SELECT action, decision FROM audit_log
        WHERE resource_type = 'attachments' AND resource_id = $1
        ORDER BY occurred_at`,
      [attachmentId],
    );
    const acciones = r.rows.map((x) => `${x.action}:${x.decision}`);
    expect(acciones).toContain('upload_attachment:allow');
    expect(acciones).toContain('read_attachment:allow');
    // Los intentos fallidos también quedan registrados.
    expect(acciones).toContain('read_attachment:deny');
  });

  it('borrar deja la ficha sin el estudio y el archivo deja de estar disponible', async () => {
    await http(app)
      .delete(`/v1/patients/${personId}/attachments/${attachmentId}`)
      .set('authorization', `Bearer ${dueño.token}`)
      .expect(200);

    const lista = await http(app)
      .get(`/v1/patients/${personId}/attachments`)
      .set('authorization', `Bearer ${dueño.token}`)
      .expect(200);
    expect(lista.body).toEqual([]);

    await http(app)
      .get(`/v1/patients/${personId}/attachments/${attachmentId}/content`)
      .set('authorization', `Bearer ${dueño.token}`)
      .expect(404);

    // La fila queda con deleted_at: la trazabilidad de que existió no se borra.
    const r = await db.query(
      'SELECT deleted_at FROM attachments WHERE id = $1',
      [attachmentId],
    );
    expect(r.rows[0].deleted_at).not.toBeNull();
  });
});

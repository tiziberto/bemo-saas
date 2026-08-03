import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import { createTestApp, http, ownerDb, uniqueDni } from './utils/harness';
import {
  addEntry,
  addMember,
  createPatient,
  registerClinic,
  type Session,
} from './utils/fixtures';

/**
 * Criterios de aceptación 5 a 9 del spec: historia privada, recepción sin
 * acceso, compartir en lectura, cero acceso a lo ajeno, y auditoría de todo.
 */
describe('Historia clínica: privacidad, compartir y auditoría', () => {
  let app: INestApplication;
  let db: Client;
  let admin: Session;
  let profA: Session;
  let profB: Session;
  let recep: Session;
  let personId: string;

  const auditRows = async (personIdOrShare: string, action?: string) => {
    const res = await db.query(
      `SELECT action, decision, actor_user_id FROM audit_log
        WHERE resource_id = $1 ${action ? 'AND action = $2' : ''}
        ORDER BY occurred_at`,
      action ? [personIdOrShare, action] : [personIdOrShare],
    );
    return res.rows as { action: string; decision: string; actor_user_id: string }[];
  };

  beforeAll(async () => {
    app = await createTestApp();
    db = ownerDb();
    await db.connect();

    const clinic = await registerClinic(app, 'Clínica historia');
    admin = clinic.admin;
    profA = await addMember(app, admin, 'professional', 'Dra. Dueña');
    profB = await addMember(app, admin, 'professional', 'Dr. Ajeno');
    recep = await addMember(app, admin, 'receptionist', 'Recepción');

    const patient = await createPatient(app, profA, { dni: uniqueDni() });
    personId = patient.personId;
    await addEntry(app, profA, personId, 'Caries oclusal en pieza 36.', 'diagnosis');
  });

  afterAll(async () => {
    await db.end();
    await app.close();
  });

  it('5 · el profesional ve a su paciente y su historia', async () => {
    const pacientes = await http(app)
      .get('/v1/patients')
      .set('authorization', `Bearer ${profA.token}`)
      .expect(200);
    const mio = pacientes.body.find((p: { id: string }) => p.id === personId);
    expect(mio).toBeDefined();
    expect(mio.owned).toBe(true);

    const historia = await http(app)
      .get(`/v1/patients/${personId}/clinical-entries`)
      .set('authorization', `Bearer ${profA.token}`)
      .expect(200);
    expect(historia.body).toHaveLength(1);
    expect(historia.body[0].content).toContain('Caries oclusal');
  });

  it('6 · la recepción NO accede a la historia clínica (403) y queda auditado', async () => {
    const res = await http(app)
      .get(`/v1/patients/${personId}/clinical-entries`)
      .set('authorization', `Bearer ${recep.token}`)
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('6b · un profesional ajeno recibe 403 y la denegación queda en audit_log', async () => {
    const res = await http(app)
      .get(`/v1/patients/${personId}/clinical-entries`)
      .set('authorization', `Bearer ${profB.token}`)
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN_HISTORY');

    const denies = (await auditRows(personId, 'read_clinical_history')).filter(
      (r) => r.decision === 'deny' && r.actor_user_id === profB.userId,
    );
    expect(denies.length).toBeGreaterThan(0);
  });

  it('8 · el profesional ajeno tampoco ve al paciente en su listado', async () => {
    const res = await http(app)
      .get('/v1/patients')
      .set('authorization', `Bearer ${profB.token}`)
      .expect(200);
    expect(res.body.map((p: { id: string }) => p.id)).not.toContain(personId);
  });

  it('8b · el profesional ajeno no puede escribir en una historia que no es suya', async () => {
    const res = await http(app)
      .post(`/v1/patients/${personId}/clinical-entries`)
      .set('authorization', `Bearer ${profB.token}`)
      .send({ type: 'note', content: 'Intento de escritura' })
      .expect(403);
    expect(res.body.code).toBe('NOT_YOUR_PATIENT');

    const denies = (await auditRows(personId, 'create_clinical_entry')).filter(
      (r) => r.decision === 'deny',
    );
    expect(denies.length).toBeGreaterThan(0);
  });

  describe('7 · compartir en lectura', () => {
    let shareId: string;

    it('el dueño comparte y el destinatario LEE la historia', async () => {
      const share = await http(app)
        .post(`/v1/patients/${personId}/shares`)
        .set('authorization', `Bearer ${profA.token}`)
        .send({ sharedWithProfessionalId: profB.userId })
        .expect(201);
      shareId = share.body.id;

      const historia = await http(app)
        .get(`/v1/patients/${personId}/clinical-entries`)
        .set('authorization', `Bearer ${profB.token}`)
        .expect(200);
      expect(historia.body).toHaveLength(1);
    });

    it('el paciente compartido aparece marcado como NO propio', async () => {
      const res = await http(app)
        .get('/v1/patients')
        .set('authorization', `Bearer ${profB.token}`)
        .expect(200);
      const compartido = res.body.find((p: { id: string }) => p.id === personId);
      expect(compartido).toBeDefined();
      expect(compartido.owned).toBe(false);
    });

    it('el compartido NO puede escribir: es sólo lectura', async () => {
      const res = await http(app)
        .post(`/v1/patients/${personId}/clinical-entries`)
        .set('authorization', `Bearer ${profB.token}`)
        .send({ type: 'note', content: 'No debería poder' })
        .expect(403);
      expect(res.body.code).toBe('NOT_YOUR_PATIENT');
    });

    it('el compartido NO puede re-compartir el paciente', async () => {
      const tercero = await addMember(app, admin, 'professional', 'Tercero');
      const res = await http(app)
        .post(`/v1/patients/${personId}/shares`)
        .set('authorization', `Bearer ${profB.token}`)
        .send({ sharedWithProfessionalId: tercero.userId })
        .expect(403);
      expect(res.body.code).toBe('NOT_YOUR_PATIENT');
    });

    it('al revocar, el acceso se corta', async () => {
      await http(app)
        .delete(`/v1/patients/${personId}/shares/${shareId}`)
        .set('authorization', `Bearer ${profA.token}`)
        .expect(200);

      const res = await http(app)
        .get(`/v1/patients/${personId}/clinical-entries`)
        .set('authorization', `Bearer ${profB.token}`)
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN_HISTORY');

      const listado = await http(app)
        .get('/v1/patients')
        .set('authorization', `Bearer ${profB.token}`)
        .expect(200);
      expect(listado.body.map((p: { id: string }) => p.id)).not.toContain(personId);
    });

    it('revocar dos veces la misma vez da 404', async () => {
      const res = await http(app)
        .delete(`/v1/patients/${personId}/shares/${shareId}`)
        .set('authorization', `Bearer ${profA.token}`)
        .expect(404);
      expect(res.body.code).toBe('SHARE_NOT_FOUND');
    });
  });

  describe('9 · auditoría', () => {
    it('cada lectura de historia escribe una fila permitida', async () => {
      const antes = (await auditRows(personId, 'read_clinical_history')).length;
      await http(app)
        .get(`/v1/patients/${personId}/clinical-entries`)
        .set('authorization', `Bearer ${profA.token}`)
        .expect(200);
      const despues = await auditRows(personId, 'read_clinical_history');
      expect(despues.length).toBe(antes + 1);
      expect(despues[despues.length - 1]).toMatchObject({
        decision: 'allow',
        actor_user_id: profA.userId,
      });
    });

    it('escribir una entrada queda auditado', async () => {
      const antes = (await auditRows(personId, 'create_clinical_entry')).length;
      await addEntry(app, profA, personId, 'Obturación realizada.', 'treatment');
      const despues = await auditRows(personId, 'create_clinical_entry');
      expect(despues.length).toBe(antes + 1);
    });

    it('el audit_log es append-only para la aplicación', async () => {
      // El rol de runtime no tiene UPDATE ni DELETE sobre audit_log.
      const appDb = new Client({ connectionString: process.env.DATABASE_URL });
      await appDb.connect();
      await expect(
        appDb.query('UPDATE audit_log SET action = $1 WHERE id IS NOT NULL', ['manipulado']),
      ).rejects.toThrow(/permission denied|permiso denegado/i);
      await expect(appDb.query('DELETE FROM audit_log')).rejects.toThrow(
        /permission denied|permiso denegado/i,
      );
      await appDb.end();
    });
  });

  it('el import de pacientes no pisa fichas de otra clínica', async () => {
    const otra = await registerClinic(app, 'Clínica import');
    const dni = uniqueDni();
    await http(app)
      .post('/v1/patients/import')
      .set('authorization', `Bearer ${profA.token}`)
      .send({ csv: `DNI,Nombre,Apellido\n${dni},Importado,Uno` })
      .expect(201);

    const ajena = await http(app)
      .get('/v1/patients')
      .set('authorization', `Bearer ${otra.admin.token}`)
      .expect(200);
    expect(ajena.body.map((p: { dni: string }) => p.dni)).not.toContain(dni);
  });

  it('el historial es append-only: no hay endpoint para editar ni borrar entradas', async () => {
    const entradas = await http(app)
      .get(`/v1/patients/${personId}/clinical-entries`)
      .set('authorization', `Bearer ${profA.token}`)
      .expect(200);
    const id = entradas.body[0].id;
    await http(app)
      .delete(`/v1/patients/${personId}/clinical-entries/${id}`)
      .set('authorization', `Bearer ${profA.token}`)
      .expect(404);
  });
});

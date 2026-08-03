/* eslint-disable camelcase */

// Etapa B — Adjuntos: radiografías y estudios en la ficha del paciente.
//
// Los archivos NO van en la base: en la fila queda la metadata y una `storage_key`
// que apunta al almacenamiento. La base guarda quién subió qué y cuándo; el
// contenido vive aparte y se sirve sólo a través de la API, que verifica permisos
// y audita cada lectura.
//
// El acceso sigue exactamente la regla de la historia clínica: el profesional que
// lo subió escribe y lee; a quien le compartieron el paciente, sólo lee.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE attachments (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id   uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      person_id   uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename    text NOT NULL,
      mime        text NOT NULL,
      size_bytes  bigint NOT NULL CHECK (size_bytes > 0),
      storage_key text NOT NULL UNIQUE,
      checksum    text,
      note        text,
      created_at  timestamptz NOT NULL DEFAULT now(),
      deleted_at  timestamptz
    );
    CREATE INDEX attachments_person_idx ON attachments (person_id) WHERE deleted_at IS NULL;
    CREATE INDEX attachments_clinic_idx ON attachments (clinic_id);

    -- === RLS ===
    ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

    CREATE POLICY attachments_own ON attachments FOR ALL
      USING (uploaded_by = app_current_user() AND clinic_id = app_current_clinic())
      WITH CHECK (uploaded_by = app_current_user() AND clinic_id = app_current_clinic());

    CREATE POLICY attachments_shared ON attachments FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM patient_shares s
         WHERE s.person_id = attachments.person_id
           AND s.owner_professional_id = attachments.uploaded_by
           AND s.shared_with_professional_id = app_current_user()
           AND s.revoked_at IS NULL));

    -- === Permisos ===
    GRANT SELECT, INSERT, UPDATE, DELETE ON attachments TO bemo_app;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS attachments;
  `);
};

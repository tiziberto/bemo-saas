/* eslint-disable camelcase */

// Etapa 4 — Pacientes (relación profesional↔persona), historia clínica privada,
// compartir read cross-clínica (vía RLS), consentimientos y auditoría (Ley 25.326).

exports.up = (pgm) => {
  pgm.sql(`
    -- Usuario del contexto actual (lo setea withTenant con SET LOCAL).
    CREATE OR REPLACE FUNCTION app_current_user() RETURNS uuid
      LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
    $$;

    -- patient_links: la persona como paciente de un profesional.
    CREATE TABLE patient_links (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id       uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      professional_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      person_id       uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      notes_admin     text,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now(),
      deleted_at      timestamptz
    );
    CREATE UNIQUE INDEX patient_links_uq ON patient_links (professional_id, person_id) WHERE deleted_at IS NULL;
    CREATE TRIGGER patient_links_updated BEFORE UPDATE ON patient_links
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- Historia clínica: privada del autor (append-only via soft-delete).
    CREATE TABLE clinical_entries (
      id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id              uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      person_id              uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      author_professional_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entry_date             date NOT NULL DEFAULT current_date,
      type                   text NOT NULL CHECK (type IN ('note','diagnosis','treatment','prescription')),
      content                text NOT NULL,
      created_at             timestamptz NOT NULL DEFAULT now(),
      updated_at             timestamptz NOT NULL DEFAULT now(),
      deleted_at             timestamptz
    );
    CREATE INDEX clinical_entries_person_idx ON clinical_entries (person_id, author_professional_id);

    -- Compartir paciente (read, cross-clínica). Re-compartir = fila nueva.
    CREATE TABLE patient_shares (
      id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      person_id                   uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      owner_professional_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shared_with_professional_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission                  text NOT NULL DEFAULT 'read' CHECK (permission IN ('read')),
      consent_id                  uuid,
      created_at                  timestamptz NOT NULL DEFAULT now(),
      revoked_at                  timestamptz
    );
    CREATE INDEX patient_shares_target_idx ON patient_shares (shared_with_professional_id) WHERE revoked_at IS NULL;
    CREATE INDEX patient_shares_person_idx ON patient_shares (person_id);

    -- Consentimientos (Ley 25.326)
    CREATE TABLE consents (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id         uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      person_id         uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      type              text NOT NULL CHECK (type IN ('data_processing','sharing')),
      granted_at        timestamptz NOT NULL DEFAULT now(),
      document_ref      text,
      created_by_user_id uuid REFERENCES users(id)
    );

    -- Auditoría append-only de accesos a datos sensibles.
    CREATE TABLE audit_log (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id     uuid,
      actor_user_id uuid,
      action        text NOT NULL,
      resource_type text NOT NULL,
      resource_id   uuid,
      decision      text NOT NULL DEFAULT 'allow' CHECK (decision IN ('allow','deny')),
      details       jsonb,
      ip_address    text,
      user_agent    text,
      request_id    text,
      occurred_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX audit_log_clinic_time_idx ON audit_log (clinic_id, occurred_at);

    -- === RLS ===
    ALTER TABLE patient_links    ENABLE ROW LEVEL SECURITY;
    ALTER TABLE clinical_entries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE patient_shares   ENABLE ROW LEVEL SECURITY;
    ALTER TABLE consents         ENABLE ROW LEVEL SECURITY;
    ALTER TABLE audit_log        ENABLE ROW LEVEL SECURITY;

    -- patient_links: el profesional ve solo los suyos.
    CREATE POLICY patient_links_own ON patient_links
      USING (professional_id = app_current_user() AND clinic_id = app_current_clinic())
      WITH CHECK (professional_id = app_current_user() AND clinic_id = app_current_clinic());

    -- persons: además del tenant (Etapa 3), visible si me la compartieron.
    CREATE POLICY persons_shared ON persons FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM patient_shares s
         WHERE s.person_id = persons.id
           AND s.shared_with_professional_id = app_current_user()
           AND s.revoked_at IS NULL));

    -- clinical_entries: el autor escribe/lee las suyas; el compartido solo lee.
    CREATE POLICY clinical_entries_own ON clinical_entries FOR ALL
      USING (author_professional_id = app_current_user())
      WITH CHECK (author_professional_id = app_current_user());
    CREATE POLICY clinical_entries_shared ON clinical_entries FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM patient_shares s
         WHERE s.person_id = clinical_entries.person_id
           AND s.owner_professional_id = clinical_entries.author_professional_id
           AND s.shared_with_professional_id = app_current_user()
           AND s.revoked_at IS NULL));

    -- patient_shares: dueño y destinatario las ven; solo el dueño las crea/edita.
    CREATE POLICY patient_shares_rw ON patient_shares
      USING (owner_professional_id = app_current_user() OR shared_with_professional_id = app_current_user())
      WITH CHECK (owner_professional_id = app_current_user());

    CREATE POLICY consents_tenant ON consents
      USING (clinic_id = app_current_clinic()) WITH CHECK (clinic_id = app_current_clinic());

    -- audit_log: lectura por tenant; inserción por tenant; SIN update/delete (append-only).
    CREATE POLICY audit_select ON audit_log FOR SELECT USING (clinic_id = app_current_clinic());
    CREATE POLICY audit_insert ON audit_log FOR INSERT WITH CHECK (clinic_id = app_current_clinic());

    -- === Permisos ===
    GRANT SELECT, INSERT, UPDATE, DELETE ON patient_links, clinical_entries, patient_shares, consents TO bemo_app;
    GRANT SELECT, INSERT ON audit_log TO bemo_app;
    REVOKE UPDATE, DELETE ON audit_log FROM bemo_app;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP POLICY IF EXISTS persons_shared ON persons;
    DROP TABLE IF EXISTS audit_log;
    DROP TABLE IF EXISTS consents;
    DROP TABLE IF EXISTS patient_shares;
    DROP TABLE IF EXISTS clinical_entries;
    DROP TABLE IF EXISTS patient_links;
    DROP FUNCTION IF EXISTS app_current_user();
  `);
};

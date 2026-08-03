/* eslint-disable camelcase */

// Etapa 6 — Endurecimiento del aislamiento.
//
// Tres agujeros de defensa en profundidad detectados al escribir la suite de
// permisos:
//
// 1. `clinical_entries_own` filtraba sólo por `author_professional_id`, sin
//    `clinic_id`. Hoy los ids de usuario son únicos por clínica, así que no hay
//    fuga real, pero la policy dependía de esa suerte en vez de decirlo.
// 2. `clinical_entries` no tenía trigger de `updated_at`: la columna existía y
//    nunca se actualizaba.
// 3. `patient_shares.consent_id` no tenía FK: se podía guardar un consentimiento
//    inexistente, justo el dato que la Ley 25.326 exige poder demostrar.

exports.up = (pgm) => {
  pgm.sql(`
    -- 1. La historia clínica también se filtra por clínica.
    DROP POLICY IF EXISTS clinical_entries_own ON clinical_entries;
    CREATE POLICY clinical_entries_own ON clinical_entries FOR ALL
      USING (author_professional_id = app_current_user()
             AND clinic_id = app_current_clinic())
      WITH CHECK (author_professional_id = app_current_user()
                  AND clinic_id = app_current_clinic());

    -- 2. updated_at que efectivamente se actualiza.
    DROP TRIGGER IF EXISTS clinical_entries_updated ON clinical_entries;
    CREATE TRIGGER clinical_entries_updated BEFORE UPDATE ON clinical_entries
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- 3. El consentimiento referenciado tiene que existir.
    DELETE FROM patient_shares s
     WHERE s.consent_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM consents c WHERE c.id = s.consent_id);
    ALTER TABLE patient_shares
      ADD CONSTRAINT patient_shares_consent_fk
      FOREIGN KEY (consent_id) REFERENCES consents(id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE patient_shares DROP CONSTRAINT IF EXISTS patient_shares_consent_fk;
    DROP TRIGGER IF EXISTS clinical_entries_updated ON clinical_entries;
    DROP POLICY IF EXISTS clinical_entries_own ON clinical_entries;
    CREATE POLICY clinical_entries_own ON clinical_entries FOR ALL
      USING (author_professional_id = app_current_user())
      WITH CHECK (author_professional_id = app_current_user());
  `);
};

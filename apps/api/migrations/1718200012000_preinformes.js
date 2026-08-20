/* eslint-disable camelcase */

// Preinformes: textos que el profesional reusa al cargar la historia clínica.
//
// Dos orígenes en una sola tabla, distinguidos por quién es el dueño:
//   - `clinic_id` y `owner_professional_id` en NULL  → del sistema, los ve todo el mundo.
//   - los dos cargados                                → del profesional, sólo suyos.
//
// Que sean privados no es una elección arbitraria: es la misma regla que ya rige
// la historia clínica en este producto. Lo que escribe un profesional es suyo.
//
// Los del sistema son esqueletos neutros a propósito. Sugerir texto clínico por
// especialidad sería inventar contenido médico sin ser del rubro; que lo cargue
// quien sabe.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE clinical_templates (
      id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id             uuid REFERENCES clinics(id) ON DELETE CASCADE,
      owner_professional_id uuid REFERENCES users(id) ON DELETE CASCADE,
      title                 text NOT NULL,
      type                  text NOT NULL
                              CHECK (type IN ('note','diagnosis','treatment','prescription')),
      content               text NOT NULL,
      sort_order            int  NOT NULL DEFAULT 100,
      created_at            timestamptz NOT NULL DEFAULT now(),
      updated_at            timestamptz NOT NULL DEFAULT now(),
      deleted_at            timestamptz,
      -- O es del sistema (las dos columnas nulas) o es de alguien (las dos
      -- cargadas). Una fila a medias no significa nada y no debería existir.
      CONSTRAINT clinical_templates_duenio CHECK (
        (clinic_id IS NULL AND owner_professional_id IS NULL)
        OR (clinic_id IS NOT NULL AND owner_professional_id IS NOT NULL)
      )
    );
    CREATE INDEX clinical_templates_owner_idx
      ON clinical_templates (owner_professional_id) WHERE deleted_at IS NULL;

    CREATE TRIGGER clinical_templates_updated BEFORE UPDATE ON clinical_templates
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    ALTER TABLE clinical_templates ENABLE ROW LEVEL SECURITY;

    -- Leer: los del sistema los ve cualquiera; los propios, sólo su dueño.
    CREATE POLICY clinical_templates_visibles ON clinical_templates
      FOR SELECT USING (
        clinic_id IS NULL
        OR (clinic_id = app_current_clinic() AND owner_professional_id = app_current_user())
      );

    -- Escribir: sólo los propios. Nadie puede tocar los del sistema ni los de otro.
    CREATE POLICY clinical_templates_propios ON clinical_templates
      FOR ALL
      USING (clinic_id = app_current_clinic() AND owner_professional_id = app_current_user())
      WITH CHECK (clinic_id = app_current_clinic() AND owner_professional_id = app_current_user());

    GRANT SELECT, INSERT, UPDATE, DELETE ON clinical_templates TO bemo_app;

    -- Esqueletos neutros: sirven a cualquier especialidad y no dicen nada
    -- clínico. Son un punto de partida para que la función no arranque vacía.
    INSERT INTO clinical_templates (title, type, content, sort_order) VALUES
      ('Motivo de consulta', 'note',
       E'Motivo de consulta:\n\nAntecedentes relevantes:\n\nExamen:\n', 10),
      ('Evolución', 'note',
       E'Evolución desde el último control:\n\nHallazgos:\n\nConducta:\n', 20),
      ('Diagnóstico', 'diagnosis',
       E'Diagnóstico:\n\nFundamento:\n\nEstudios solicitados:\n', 30),
      ('Indicaciones al paciente', 'treatment',
       E'Indicaciones:\n\nCuidados:\n\nPróximo control:\n', 40),
      ('Receta', 'prescription',
       E'Medicación:\n\nDosis y frecuencia:\n\nDuración:\n\nObservaciones:\n', 50);
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE clinical_templates;');
};

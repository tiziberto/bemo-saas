/* eslint-disable camelcase */

// Cinco cambios de modelo que van juntos porque son una sola pasada de esquema.
//
// 1. Sala de espera: hoy no existe el momento en que el paciente llegó y todavía
//    no pasó. Se agregan dos marcas de tiempo y dos estados. La espera es
//    `called_at - arrived_at`: recepción marca que llegó, el profesional marca
//    "Atender" y ahí se lo llama a pasar. Medir desde la hora del turno sería
//    mentir: si el paciente llegó 20 minutos antes, esos 20 no son demora.
//
// 2. Especialidades: catálogo global (para que dos clínicas escriban "Odontología"
//    igual y se pueda reportar cruzado), lo que ofrece cada clínica, y lo que hace
//    cada profesional dentro de ella.
//
// 3. Bloqueos por rango: una fila con desde/hasta en vez de N filas sueltas, así
//    se edita y se borra como una unidad.
//
// 4. Sexo de la persona: viene en el PDF417 del DNI y hoy se descartaba.

exports.up = (pgm) => {
  pgm.sql(`
    -- ── 1 · Sala de espera ────────────────────────────────────────────────
    ALTER TABLE appointments
      ADD COLUMN arrived_at timestamptz,
      ADD COLUMN called_at  timestamptz;

    COMMENT ON COLUMN appointments.arrived_at IS
      'Cuándo recepción marcó que el paciente llegó. Null = todavía no llegó.';
    COMMENT ON COLUMN appointments.called_at IS
      'Cuándo el profesional lo llamó a pasar. La espera es called_at - arrived_at.';

    ALTER TABLE appointments DROP CONSTRAINT appointments_status_check;
    ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
      CHECK (status IN ('scheduled','confirmed','waiting','in_progress',
                        'completed','cancelled','no_show'));

    -- Los dos estados nuevos ocupan la agenda igual que los otros activos: el
    -- paciente está en el consultorio, ese horario no está libre.
    ALTER TABLE appointments DROP CONSTRAINT no_room_overlap;
    ALTER TABLE appointments DROP CONSTRAINT no_prof_overlap;

    ALTER TABLE appointments ADD CONSTRAINT no_room_overlap
      EXCLUDE USING gist (room_id WITH =, during WITH &&)
      WHERE (status IN ('scheduled','confirmed','waiting','in_progress','completed')
             AND room_id IS NOT NULL AND NOT is_overbook);

    ALTER TABLE appointments ADD CONSTRAINT no_prof_overlap
      EXCLUDE USING gist (professional_id WITH =, during WITH &&)
      WHERE (status IN ('scheduled','confirmed','waiting','in_progress','completed')
             AND NOT is_overbook);

    -- Para la lista de espera del día, que se consulta todo el tiempo.
    CREATE INDEX appointments_espera_idx ON appointments (clinic_id, arrived_at)
      WHERE arrived_at IS NOT NULL AND called_at IS NULL;

    -- ── 2 · Especialidades ────────────────────────────────────────────────
    -- Catálogo cerrado y global: sin tenant, sin RLS. Es dato de referencia, no
    -- de nadie. Un id de texto legible en vez de uuid para poder leer las
    -- consultas y sembrarlo sin depender de ids generados.
    CREATE TABLE specialties (
      id         text PRIMARY KEY,
      label      text NOT NULL,
      sort_order int  NOT NULL DEFAULT 100
    );

    CREATE TABLE clinic_specialties (
      clinic_id    uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      specialty_id text NOT NULL REFERENCES specialties(id),
      PRIMARY KEY (clinic_id, specialty_id)
    );

    CREATE TABLE user_specialties (
      clinic_id    uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      specialty_id text NOT NULL REFERENCES specialties(id),
      PRIMARY KEY (user_id, specialty_id)
    );
    CREATE INDEX user_specialties_clinic_idx ON user_specialties (clinic_id);

    -- Un profesional sólo puede tener especialidades que su clínica ofrezca. Se
    -- valida en la base y no sólo en el servicio: es la misma regla que el resto
    -- del aislamiento y no depende de que nadie se acuerde de chequearla.
    ALTER TABLE user_specialties
      ADD CONSTRAINT user_specialties_de_la_clinica
      FOREIGN KEY (clinic_id, specialty_id)
      REFERENCES clinic_specialties (clinic_id, specialty_id) ON DELETE CASCADE;

    ALTER TABLE clinic_specialties ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_specialties   ENABLE ROW LEVEL SECURITY;
    CREATE POLICY clinic_specialties_tenant ON clinic_specialties
      USING (clinic_id = app_current_clinic()) WITH CHECK (clinic_id = app_current_clinic());
    CREATE POLICY user_specialties_tenant ON user_specialties
      USING (clinic_id = app_current_clinic()) WITH CHECK (clinic_id = app_current_clinic());

    GRANT SELECT ON specialties TO bemo_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON clinic_specialties, user_specialties TO bemo_app;


    -- Catálogo de especialidades. Cerrado a propósito: con texto libre aparecen
    -- "Odontología" y "odontologia" como dos cosas distintas y se pierde el
    -- filtro y el reporte. El orden agrupa por familia (odontología, médicas,
    -- terapias, diagnóstico) sin necesidad de una tabla de familias.
    INSERT INTO specialties (id, label, sort_order) VALUES
      ('odontologia-general','Odontología general',10),
      ('ortodoncia','Ortodoncia',11),
      ('endodoncia','Endodoncia',12),
      ('periodoncia','Periodoncia',13),
      ('implantologia','Implantología',14),
      ('odontopediatria','Odontopediatría',15),
      ('protesis-dental','Prótesis dental',16),
      ('cirugia-maxilofacial','Cirugía maxilofacial',17),
      ('clinica-medica','Clínica médica',30),
      ('pediatria','Pediatría',31),
      ('ginecologia','Ginecología',32),
      ('obstetricia','Obstetricia',33),
      ('cardiologia','Cardiología',34),
      ('dermatologia','Dermatología',35),
      ('traumatologia','Traumatología',36),
      ('oftalmologia','Oftalmología',37),
      ('otorrinolaringologia','Otorrinolaringología',38),
      ('neurologia','Neurología',39),
      ('urologia','Urología',40),
      ('endocrinologia','Endocrinología',41),
      ('gastroenterologia','Gastroenterología',42),
      ('neumonologia','Neumonología',43),
      ('reumatologia','Reumatología',44),
      ('alergia-inmunologia','Alergia e inmunología',45),
      ('infectologia','Infectología',46),
      ('nefrologia','Nefrología',47),
      ('hematologia','Hematología',48),
      ('geriatria','Geriatría',49),
      ('flebologia','Flebología',50),
      ('medicina-estetica','Medicina estética',51),
      ('psicologia','Psicología',70),
      ('psiquiatria','Psiquiatría',71),
      ('kinesiologia','Kinesiología y fisiatría',72),
      ('nutricion','Nutrición',73),
      ('fonoaudiologia','Fonoaudiología',74),
      ('terapia-ocupacional','Terapia ocupacional',75),
      ('podologia','Podología',76),
      ('obstetricia-partera','Partería',77),
      ('diagnostico-imagenes','Diagnóstico por imágenes',90),
      ('ecografia','Ecografía',91),
      ('laboratorio','Laboratorio',92),
      ('enfermeria','Enfermería',93);

    -- ── 3 · Bloqueos por rango ────────────────────────────────────────────
    -- La columna date pasa a ser el inicio y date_to el fin. Las filas existentes
    -- de un día: se copian a sí mismas para no dejar nulls que después haya que
    -- contemplar en cada consulta.
    ALTER TABLE availability_exceptions ADD COLUMN date_to date;
    UPDATE availability_exceptions SET date_to = date WHERE date_to IS NULL;
    ALTER TABLE availability_exceptions
      ALTER COLUMN date_to SET NOT NULL,
      ADD CONSTRAINT availability_exceptions_rango CHECK (date_to >= date);

    -- ── 5 · Duración de turno hasta 6 horas ───────────────────────────────
    -- El tope estaba en TRES lugares: los selects del frontend, el DTO y este
    -- CHECK. Subir sólo los dos primeros dejaba el alta reventando con un 500 al
    -- guardar un bloque largo — que es exactamente lo que pasó al probarlo.
    ALTER TABLE availability_blocks DROP CONSTRAINT availability_blocks_slot_minutes_check;
    ALTER TABLE availability_blocks
      ADD CONSTRAINT availability_blocks_slot_minutes_check
      CHECK (slot_minutes >= 5 AND slot_minutes <= 360);

    -- ── 4 · Sexo ──────────────────────────────────────────────────────────
    -- Viene en el código del DNI. 'X' porque el DNI argentino lo contempla.
    ALTER TABLE persons ADD COLUMN sex text CHECK (sex IN ('F','M','X'));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE persons DROP COLUMN sex;

    -- Los bloques de más de 240 minutos se recortan: si no, el CHECK viejo no
    -- se puede volver a crear y la migración falla a mitad de camino.
    UPDATE availability_blocks SET slot_minutes = 240 WHERE slot_minutes > 240;
    ALTER TABLE availability_blocks DROP CONSTRAINT availability_blocks_slot_minutes_check;
    ALTER TABLE availability_blocks
      ADD CONSTRAINT availability_blocks_slot_minutes_check
      CHECK (slot_minutes >= 5 AND slot_minutes <= 240);

    ALTER TABLE availability_exceptions
      DROP CONSTRAINT availability_exceptions_rango,
      DROP COLUMN date_to;

    DROP TABLE user_specialties;
    DROP TABLE clinic_specialties;
    DROP TABLE specialties;

    DROP INDEX appointments_espera_idx;
    ALTER TABLE appointments DROP CONSTRAINT no_room_overlap;
    ALTER TABLE appointments DROP CONSTRAINT no_prof_overlap;
    ALTER TABLE appointments ADD CONSTRAINT no_room_overlap
      EXCLUDE USING gist (room_id WITH =, during WITH &&)
      WHERE (status IN ('scheduled','confirmed','completed')
             AND room_id IS NOT NULL AND NOT is_overbook);
    ALTER TABLE appointments ADD CONSTRAINT no_prof_overlap
      EXCLUDE USING gist (professional_id WITH =, during WITH &&)
      WHERE (status IN ('scheduled','confirmed','completed') AND NOT is_overbook);

    -- Los turnos en los estados nuevos vuelven al más cercano antes de reponer
    -- el CHECK viejo, que si no rechaza filas existentes.
    UPDATE appointments SET status = 'confirmed' WHERE status IN ('waiting','in_progress');
    ALTER TABLE appointments DROP CONSTRAINT appointments_status_check;
    ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
      CHECK (status IN ('scheduled','confirmed','cancelled','completed','no_show'));

    ALTER TABLE appointments DROP COLUMN called_at, DROP COLUMN arrived_at;
  `);
};

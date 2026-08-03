/* eslint-disable camelcase */

// Etapa 3 — Núcleo de agenda: consultorios, disponibilidad, personas (contacto)
// y turnos con anti-doble-booking por constraint de Postgres (EXCLUDE + btree_gist).

exports.up = (pgm) => {
  pgm.sql(`
    -- Consultorios
    CREATE TABLE rooms (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id  uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      name       text NOT NULL,
      is_active  boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX rooms_clinic_idx ON rooms (clinic_id);

    -- Disponibilidad recurrente del profesional (con sala y duración de turno)
    CREATE TABLE availability_blocks (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id       uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      professional_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      room_id         uuid REFERENCES rooms(id) ON DELETE SET NULL,
      weekday         int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      start_time      time NOT NULL,
      end_time        time NOT NULL,
      slot_minutes    int NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 5 AND 240),
      valid_from      date,
      valid_to        date,
      created_at      timestamptz NOT NULL DEFAULT now(),
      CHECK (start_time < end_time)
    );
    CREATE INDEX availability_blocks_prof_idx ON availability_blocks (professional_id, weekday);

    -- Excepciones (vacaciones / feriados / franjas extra)
    CREATE TABLE availability_exceptions (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id       uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      professional_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date            date NOT NULL,
      kind            text NOT NULL CHECK (kind IN ('add','remove')),
      start_time      time,
      end_time        time,
      created_at      timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX availability_exceptions_prof_idx ON availability_exceptions (professional_id, date);

    -- Personas (la persona-paciente; datos de contacto los maneja la recepción).
    -- La historia clínica privada (patient_links / clinical_entries) llega en Etapa 4.
    CREATE TABLE persons (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id  uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      dni        text NOT NULL,
      first_name text NOT NULL,
      last_name  text NOT NULL,
      phone      text,
      email      text,
      birthdate  date,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE UNIQUE INDEX persons_clinic_dni_uq ON persons (clinic_id, dni) WHERE deleted_at IS NULL;
    CREATE TRIGGER persons_updated BEFORE UPDATE ON persons
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- Turnos
    CREATE TABLE appointments (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id         uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      professional_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      room_id           uuid REFERENCES rooms(id) ON DELETE SET NULL,
      person_id         uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      starts_at         timestamptz NOT NULL,
      ends_at           timestamptz NOT NULL,
      status            text NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled','confirmed','cancelled','completed','no_show')),
      reason            text,
      created_by_user_id uuid REFERENCES users(id),
      created_at        timestamptz NOT NULL DEFAULT now(),
      updated_at        timestamptz NOT NULL DEFAULT now(),
      during            tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED,
      CHECK (starts_at < ends_at)
    );
    CREATE INDEX appointments_prof_time_idx ON appointments (professional_id, starts_at);
    CREATE INDEX appointments_clinic_time_idx ON appointments (clinic_id, starts_at);
    CREATE TRIGGER appointments_updated BEFORE UPDATE ON appointments
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- Anti-doble-booking: una sala / un profesional no pueden tener dos turnos
    -- activos solapados. Los cancelados/no_show liberan la franja.
    ALTER TABLE appointments ADD CONSTRAINT no_room_overlap
      EXCLUDE USING gist (room_id WITH =, during WITH &&)
      WHERE (status IN ('scheduled','confirmed','completed') AND room_id IS NOT NULL);
    ALTER TABLE appointments ADD CONSTRAINT no_prof_overlap
      EXCLUDE USING gist (professional_id WITH =, during WITH &&)
      WHERE (status IN ('scheduled','confirmed','completed'));

    -- === RLS por tenant ===
    ALTER TABLE rooms                  ENABLE ROW LEVEL SECURITY;
    ALTER TABLE availability_blocks    ENABLE ROW LEVEL SECURITY;
    ALTER TABLE availability_exceptions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE persons                ENABLE ROW LEVEL SECURITY;
    ALTER TABLE appointments           ENABLE ROW LEVEL SECURITY;

    CREATE POLICY rooms_tenant ON rooms
      USING (clinic_id = app_current_clinic()) WITH CHECK (clinic_id = app_current_clinic());
    CREATE POLICY availability_blocks_tenant ON availability_blocks
      USING (clinic_id = app_current_clinic()) WITH CHECK (clinic_id = app_current_clinic());
    CREATE POLICY availability_exceptions_tenant ON availability_exceptions
      USING (clinic_id = app_current_clinic()) WITH CHECK (clinic_id = app_current_clinic());
    CREATE POLICY persons_tenant ON persons
      USING (clinic_id = app_current_clinic()) WITH CHECK (clinic_id = app_current_clinic());
    CREATE POLICY appointments_tenant ON appointments
      USING (clinic_id = app_current_clinic()) WITH CHECK (clinic_id = app_current_clinic());

    GRANT SELECT, INSERT, UPDATE, DELETE ON rooms, availability_blocks, availability_exceptions, persons, appointments TO bemo_app;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS appointments;
    DROP TABLE IF EXISTS persons;
    DROP TABLE IF EXISTS availability_exceptions;
    DROP TABLE IF EXISTS availability_blocks;
    DROP TABLE IF EXISTS rooms;
  `);
};

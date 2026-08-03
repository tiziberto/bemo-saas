/* eslint-disable camelcase */

// Etapa 2 — Auth + multi-tenant con RLS real.
//
// Diseño de aislamiento:
// - La API corre como el rol `bemo_app` (NO owner, NO superuser) => sujeto a RLS.
// - Las migraciones y las funciones SECURITY DEFINER corren como `bemo` (owner) => bypass RLS.
// - Cada request de datos de tenant hace `SET LOCAL app.current_clinic_id = '<uuid>'`
//   y las policies filtran por ese valor. Sin el SET LOCAL no se ve ninguna fila.
// - El signup/login (que ocurren SIN contexto de clínica) pasan por funciones
//   SECURITY DEFINER acotadas, resolviendo el chicken-and-egg del multi-tenant.

// La contraseña del rol de aplicación sale del entorno. El default es sólo para
// desarrollo local; en producción `scripts/set-app-password.js` la reemplaza
// después de migrar (ver compose.prod.yaml).
const APP_ROLE_PASSWORD = process.env.BEMO_APP_PASSWORD || 'bemo_app';
if (/['\\]/.test(APP_ROLE_PASSWORD)) {
  throw new Error('BEMO_APP_PASSWORD no puede contener comillas ni barras invertidas.');
}

exports.up = (pgm) => {
  pgm.sql(`
    -- Rol de aplicación (restringido). La contraseña viene del entorno.
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bemo_app') THEN
        CREATE ROLE bemo_app LOGIN PASSWORD '${APP_ROLE_PASSWORD}';
      END IF;
    END $$;

    -- Helper: clínica del contexto actual (NULL si no hay SET LOCAL).
    CREATE OR REPLACE FUNCTION app_current_clinic() RETURNS uuid
      LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('app.current_clinic_id', true), '')::uuid
    $$;

    -- Trigger de updated_at.
    CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at = now(); RETURN NEW; END
    $$;

    -- === Tablas ===
    CREATE TABLE clinics (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name       text NOT NULL,
      timezone   text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE users (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id     uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      auth_id       uuid NOT NULL DEFAULT gen_random_uuid(),
      email         text NOT NULL,
      password_hash text NOT NULL,
      full_name     text NOT NULL,
      is_active     boolean NOT NULL DEFAULT true,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));
    CREATE INDEX users_clinic_idx ON users (clinic_id);

    CREATE TABLE user_roles (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role    text NOT NULL CHECK (role IN ('admin','professional','receptionist')),
      PRIMARY KEY (user_id, role)
    );

    CREATE TABLE refresh_tokens (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  text NOT NULL,
      expires_at  timestamptz NOT NULL,
      revoked_at  timestamptz,
      replaced_by uuid,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX refresh_tokens_hash_idx ON refresh_tokens (token_hash);

    CREATE TRIGGER clinics_updated BEFORE UPDATE ON clinics
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER users_updated BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- === RLS (ENABLE, no FORCE: el owner bypassa para definer/migraciones) ===
    ALTER TABLE clinics        ENABLE ROW LEVEL SECURITY;
    ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_roles     ENABLE ROW LEVEL SECURITY;
    ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

    CREATE POLICY clinics_tenant ON clinics
      USING (id = app_current_clinic())
      WITH CHECK (id = app_current_clinic());

    CREATE POLICY users_tenant ON users
      USING (clinic_id = app_current_clinic())
      WITH CHECK (clinic_id = app_current_clinic());

    CREATE POLICY user_roles_tenant ON user_roles
      USING (EXISTS (SELECT 1 FROM users u WHERE u.id = user_roles.user_id AND u.clinic_id = app_current_clinic()))
      WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = user_roles.user_id AND u.clinic_id = app_current_clinic()));

    CREATE POLICY refresh_tokens_tenant ON refresh_tokens
      USING (EXISTS (SELECT 1 FROM users u WHERE u.id = refresh_tokens.user_id AND u.clinic_id = app_current_clinic()))
      WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = refresh_tokens.user_id AND u.clinic_id = app_current_clinic()));

    -- === Funciones de auth (SECURITY DEFINER, owner = bemo => bypass RLS) ===
    CREATE OR REPLACE FUNCTION register_clinic(
      p_name text, p_tz text, p_email text, p_password_hash text, p_full_name text
    ) RETURNS TABLE (o_clinic_id uuid, o_user_id uuid)
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_clinic uuid; v_user uuid;
      BEGIN
        INSERT INTO clinics(name, timezone)
          VALUES (p_name, COALESCE(NULLIF(p_tz, ''), 'America/Argentina/Buenos_Aires'))
          RETURNING id INTO v_clinic;
        INSERT INTO users(clinic_id, email, password_hash, full_name)
          VALUES (v_clinic, p_email, p_password_hash, p_full_name)
          RETURNING id INTO v_user;
        -- El dueño arranca como admin + professional (footnote del spec).
        INSERT INTO user_roles(user_id, role) VALUES (v_user, 'admin'), (v_user, 'professional');
        o_clinic_id := v_clinic; o_user_id := v_user; RETURN NEXT;
      END
    $$;

    CREATE OR REPLACE FUNCTION auth_login_lookup(p_email text)
      RETURNS TABLE (user_id uuid, clinic_id uuid, password_hash text, is_active boolean)
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT id, clinic_id, password_hash, is_active FROM users WHERE lower(email) = lower(p_email)
    $$;

    CREATE OR REPLACE FUNCTION auth_user_roles(p_user_id uuid)
      RETURNS SETOF text
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT role FROM user_roles WHERE user_id = p_user_id ORDER BY role
    $$;

    CREATE OR REPLACE FUNCTION auth_store_refresh(p_user_id uuid, p_token_hash text, p_expires_at timestamptz)
      RETURNS uuid
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        INSERT INTO refresh_tokens(user_id, token_hash, expires_at)
          VALUES (p_user_id, p_token_hash, p_expires_at) RETURNING id
    $$;

    CREATE OR REPLACE FUNCTION auth_rotate_refresh(p_old_hash text, p_new_hash text, p_expires_at timestamptz)
      RETURNS TABLE (o_user_id uuid, o_clinic_id uuid)
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_id uuid; v_user uuid; v_clinic uuid;
      BEGIN
        SELECT id, user_id INTO v_id, v_user FROM refresh_tokens
          WHERE token_hash = p_old_hash AND revoked_at IS NULL AND expires_at > now();
        IF v_user IS NULL THEN RETURN; END IF;
        UPDATE refresh_tokens SET revoked_at = now() WHERE id = v_id;
        INSERT INTO refresh_tokens(user_id, token_hash, expires_at)
          VALUES (v_user, p_new_hash, p_expires_at);
        SELECT clinic_id INTO v_clinic FROM users WHERE id = v_user;
        o_user_id := v_user; o_clinic_id := v_clinic; RETURN NEXT;
      END
    $$;

    CREATE OR REPLACE FUNCTION auth_revoke_refresh(p_token_hash text)
      RETURNS void
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        UPDATE refresh_tokens SET revoked_at = now()
          WHERE token_hash = p_token_hash AND revoked_at IS NULL
    $$;

    -- === Permisos para bemo_app ===
    GRANT USAGE ON SCHEMA public TO bemo_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bemo_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO bemo_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bemo_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO bemo_app;
    -- Las funciones de auth NO deben ser ejecutables por el mundo.
    REVOKE EXECUTE ON FUNCTION register_clinic(text,text,text,text,text) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION auth_login_lookup(text) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION auth_store_refresh(uuid,text,timestamptz) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION auth_rotate_refresh(text,text,timestamptz) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION auth_revoke_refresh(text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION register_clinic(text,text,text,text,text) TO bemo_app;
    GRANT EXECUTE ON FUNCTION auth_login_lookup(text) TO bemo_app;
    GRANT EXECUTE ON FUNCTION auth_store_refresh(uuid,text,timestamptz) TO bemo_app;
    GRANT EXECUTE ON FUNCTION auth_rotate_refresh(text,text,timestamptz) TO bemo_app;
    GRANT EXECUTE ON FUNCTION auth_revoke_refresh(text) TO bemo_app;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP FUNCTION IF EXISTS auth_revoke_refresh(text);
    DROP FUNCTION IF EXISTS auth_rotate_refresh(text,text,timestamptz);
    DROP FUNCTION IF EXISTS auth_store_refresh(uuid,text,timestamptz);
    DROP FUNCTION IF EXISTS auth_user_roles(uuid);
    DROP FUNCTION IF EXISTS auth_login_lookup(text);
    DROP FUNCTION IF EXISTS register_clinic(text,text,text,text,text);
    DROP TABLE IF EXISTS refresh_tokens;
    DROP TABLE IF EXISTS user_roles;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS clinics;
    DROP FUNCTION IF EXISTS app_current_clinic();
    DROP FUNCTION IF EXISTS set_updated_at();
  `);
};

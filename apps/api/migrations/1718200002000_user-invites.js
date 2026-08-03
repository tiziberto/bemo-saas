/* eslint-disable camelcase */

// Etapa 2 — Invitaciones de usuarios (token de un solo uso).
// El admin invita (email + rol) estando autenticado (RLS por tenant).
// El invitado acepta SIN contexto de clínica => función SECURITY DEFINER.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE user_invites (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id  uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      email      text NOT NULL,
      role       text NOT NULL CHECK (role IN ('admin','professional','receptionist')),
      token_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      accepted_at timestamptz,
      invited_by uuid REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX user_invites_hash_idx ON user_invites (token_hash);
    CREATE INDEX user_invites_clinic_idx ON user_invites (clinic_id);

    ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;
    CREATE POLICY user_invites_tenant ON user_invites
      USING (clinic_id = app_current_clinic())
      WITH CHECK (clinic_id = app_current_clinic());

    GRANT SELECT, INSERT, UPDATE, DELETE ON user_invites TO bemo_app;

    -- Aceptar invitación (sin contexto): crea el usuario + rol y marca aceptada.
    CREATE OR REPLACE FUNCTION accept_invite(
      p_token_hash text, p_password_hash text, p_full_name text
    ) RETURNS TABLE (o_user_id uuid, o_clinic_id uuid, o_email text)
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_inv user_invites%ROWTYPE; v_user uuid;
      BEGIN
        SELECT * INTO v_inv FROM user_invites
          WHERE token_hash = p_token_hash AND accepted_at IS NULL AND expires_at > now();
        IF v_inv.id IS NULL THEN RETURN; END IF;
        INSERT INTO users(clinic_id, email, password_hash, full_name)
          VALUES (v_inv.clinic_id, v_inv.email, p_password_hash, p_full_name)
          RETURNING id INTO v_user;
        INSERT INTO user_roles(user_id, role) VALUES (v_user, v_inv.role);
        UPDATE user_invites SET accepted_at = now() WHERE id = v_inv.id;
        o_user_id := v_user; o_clinic_id := v_inv.clinic_id; o_email := v_inv.email;
        RETURN NEXT;
      END
    $$;
    REVOKE EXECUTE ON FUNCTION accept_invite(text,text,text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION accept_invite(text,text,text) TO bemo_app;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP FUNCTION IF EXISTS accept_invite(text,text,text);
    DROP TABLE IF EXISTS user_invites;
  `);
};

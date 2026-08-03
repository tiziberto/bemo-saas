/* eslint-disable camelcase */

// Etapa 6 — Detección de reuso de refresh tokens.
//
// La rotación ya revocaba el token viejo, así que replicarlo fallaba. Pero fallar
// en silencio pierde la señal: que aparezca un token ya usado significa que
// alguien tiene una copia (se la robaron del dispositivo, de un backup, de un log).
//
// Respuesta estándar (OWASP): ante el reuso, se revoca TODA la familia de tokens
// del usuario. El atacante se queda afuera y el usuario legítimo tiene que volver
// a entrar — que es exactamente la señal que uno quiere en ese caso.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION auth_rotate_refresh(p_old_hash text, p_new_hash text, p_expires_at timestamptz)
      RETURNS TABLE (o_user_id uuid, o_clinic_id uuid)
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_id uuid; v_user uuid; v_clinic uuid; v_replay_user uuid;
      BEGIN
        SELECT id, user_id INTO v_id, v_user FROM refresh_tokens
          WHERE token_hash = p_old_hash AND revoked_at IS NULL AND expires_at > now();

        IF v_user IS NULL THEN
          -- El token no sirve. Si además EXISTE en la tabla, es un replay:
          -- se cortan todas las sesiones vivas de ese usuario.
          SELECT user_id INTO v_replay_user FROM refresh_tokens WHERE token_hash = p_old_hash;
          IF v_replay_user IS NOT NULL THEN
            UPDATE refresh_tokens SET revoked_at = now()
              WHERE user_id = v_replay_user AND revoked_at IS NULL;
          END IF;
          RETURN;
        END IF;

        UPDATE refresh_tokens SET revoked_at = now() WHERE id = v_id;
        INSERT INTO refresh_tokens(user_id, token_hash, expires_at)
          VALUES (v_user, p_new_hash, p_expires_at);
        SELECT clinic_id INTO v_clinic FROM users WHERE id = v_user;
        o_user_id := v_user; o_clinic_id := v_clinic; RETURN NEXT;
      END
    $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
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
  `);
};

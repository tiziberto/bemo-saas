/* eslint-disable camelcase */

// Dar un turno tiene que dejar al paciente en la lista del profesional.
//
// Hasta acá agendar sólo creaba la fila en `persons`. La ficha del profesional
// vive en `patient_links`, y esa tabla es privada: su policy exige
// `professional_id = app_current_user()`. O sea que cuando RECEPCIÓN agenda un
// turno con el Dr. X, no puede crear la ficha del Dr. X — la política la frena.
// Resultado: el profesional atendía a alguien que no le figuraba en Pacientes.
//
// La salida es la misma que ya se usó para el conteo de pacientes nuevos: una
// función SECURITY DEFINER que se acota sola con `app_current_clinic()`. No
// recibe la clínica por parámetro, así nadie puede vincular en otra.
//
// Qué revela esto y qué no: una ficha dice "este profesional atiende a esta
// persona", que es exactamente lo que quien agendó el turno ya sabe. La historia
// clínica sigue siendo privada de su autor — eso no se toca.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION link_patient_to_professional(
      p_person_id uuid,
      p_professional_id uuid
    ) RETURNS void
      LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
        INSERT INTO patient_links (clinic_id, professional_id, person_id)
        SELECT app_current_clinic(), p_professional_id, p_person_id
         -- Las dos puntas tienen que ser de la clínica de la sesión. Sin esto,
         -- la función sería una puerta para vincular gente entre clínicas.
         WHERE EXISTS (
                 SELECT 1 FROM persons pe
                  WHERE pe.id = p_person_id
                    AND pe.clinic_id = app_current_clinic()
                    AND pe.deleted_at IS NULL)
           AND EXISTS (
                 SELECT 1 FROM users u
                   JOIN user_roles ur ON ur.user_id = u.id
                  WHERE u.id = p_professional_id
                    AND u.clinic_id = app_current_clinic()
                    AND ur.role = 'professional')
        ON CONFLICT DO NOTHING;
      $$;

    REVOKE ALL ON FUNCTION link_patient_to_professional(uuid, uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION link_patient_to_professional(uuid, uuid) TO bemo_app;

    -- Los turnos ya dados quedaron sin ficha: se rellenan para que la lista de
    -- cada profesional refleje a quién viene atendiendo.
    INSERT INTO patient_links (clinic_id, professional_id, person_id)
    SELECT DISTINCT a.clinic_id, a.professional_id, a.person_id
      FROM appointments a
      JOIN user_roles ur ON ur.user_id = a.professional_id AND ur.role = 'professional'
     WHERE NOT EXISTS (
             SELECT 1 FROM patient_links pl
              WHERE pl.professional_id = a.professional_id
                AND pl.person_id = a.person_id
                AND pl.deleted_at IS NULL);
  `);
};

exports.down = (pgm) => {
  // Las fichas no se borran: pueden tener notas del profesional y no hay forma
  // de distinguir las que creó el backfill de las que ya existían.
  pgm.sql(`DROP FUNCTION IF EXISTS link_patient_to_professional(uuid, uuid);`);
};

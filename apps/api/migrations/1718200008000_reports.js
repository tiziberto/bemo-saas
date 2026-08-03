/* eslint-disable camelcase */

// Etapa B — Reportes: pacientes nuevos por profesional.
//
// El problema: `patient_links` es privado del profesional (policy
// `patient_links_own`), así que el admin no puede contarlos ni siquiera para un
// reporte. Y está bien que sea así: quiénes son los pacientes de cada
// profesional es justamente lo que el producto promete no compartir.
//
// Pero un CONTEO no revela identidades ni nada clínico, y es información de
// gestión legítima ("¿cuántos pacientes nuevos entraron este mes?").
//
// Solución: una función SECURITY DEFINER que devuelve SÓLO números y que se
// acota sola con `app_current_clinic()` — no recibe la clínica por parámetro,
// así nadie puede pedir los números de otra.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION report_new_patients(p_from date, p_to date)
      RETURNS TABLE (o_professional_id uuid, o_new_patients int)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT pl.professional_id, count(*)::int
          FROM patient_links pl
         WHERE pl.clinic_id = app_current_clinic()
           AND pl.deleted_at IS NULL
           AND pl.created_at::date BETWEEN p_from AND p_to
         GROUP BY pl.professional_id
      $$;

    REVOKE EXECUTE ON FUNCTION report_new_patients(date, date) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION report_new_patients(date, date) TO bemo_app;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP FUNCTION IF EXISTS report_new_patients(date, date);
  `);
};

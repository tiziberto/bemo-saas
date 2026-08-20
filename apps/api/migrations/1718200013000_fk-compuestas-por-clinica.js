/* eslint-disable camelcase */

// Cierra un agujero de aislamiento entre clínicas encontrado probando el sistema.
//
// El problema: RLS impide LEER lo de otra clínica, pero no impedía ESCRIBIR una
// fila propia que apunte a algo ajeno. `appointments` guarda `clinic_id` y
// `professional_id` como columnas sueltas, y la policy sólo exige que el
// `clinic_id` sea el de la sesión. Entonces una clínica B podía crear un turno
// con `clinic_id = B` y `professional_id` = un profesional de A.
//
// Y eso no era sólo suciedad de datos. Los EXCLUDE anti-solapamiento son por
// `professional_id` a nivel tabla, sin mirar la clínica: el turno de B ocupaba
// de verdad la agenda del profesional de A. Reproducido: B agenda a las 09:00,
// A intenta su propio hueco y recibe 409, mientras la disponibilidad le sigue
// mostrando el horario libre porque RLS le esconde la fila de B. Un horario que
// se ve libre, no se puede usar, y no hay forma de averiguar por qué.
//
// La solución es estructural: claves foráneas COMPUESTAS. Para referenciar a un
// profesional hay que acertar el par (clinic_id, id), así que apuntar a otra
// clínica deja de ser posible — no por una comprobación que alguien puede
// olvidarse de escribir, sino porque la base no lo acepta.

exports.up = (pgm) => {
  pgm.sql(`
    -- Las filas cruzadas que ya existan tienen que irse antes de las constraints.
    -- Son inconsistentes por definición: nadie las puede ver ni usar.
    DELETE FROM user_specialties us USING users u
      WHERE u.id = us.user_id AND us.clinic_id <> u.clinic_id;
    DELETE FROM appointments a USING users u
      WHERE u.id = a.professional_id AND a.clinic_id <> u.clinic_id;
    UPDATE appointments a SET room_id = NULL FROM rooms r
      WHERE r.id = a.room_id AND a.clinic_id <> r.clinic_id;
    DELETE FROM appointments a USING persons p
      WHERE p.id = a.person_id AND a.clinic_id <> p.clinic_id;
    DELETE FROM availability_blocks b USING users u
      WHERE u.id = b.professional_id AND b.clinic_id <> u.clinic_id;
    DELETE FROM availability_exceptions e USING users u
      WHERE u.id = e.professional_id AND e.clinic_id <> u.clinic_id;
    DELETE FROM patient_links pl USING users u
      WHERE u.id = pl.professional_id AND pl.clinic_id <> u.clinic_id;
    DELETE FROM patient_links pl USING persons p
      WHERE p.id = pl.person_id AND pl.clinic_id <> p.clinic_id;

    -- Para poder referenciar el par hace falta que el par sea único.
    ALTER TABLE users   ADD CONSTRAINT users_id_clinic_uq   UNIQUE (id, clinic_id);
    ALTER TABLE rooms   ADD CONSTRAINT rooms_id_clinic_uq   UNIQUE (id, clinic_id);
    ALTER TABLE persons ADD CONSTRAINT persons_id_clinic_uq UNIQUE (id, clinic_id);

    -- Turnos: profesional, sala y persona tienen que ser de la misma clínica.
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_prof_misma_clinica
        FOREIGN KEY (professional_id, clinic_id) REFERENCES users (id, clinic_id)
        ON DELETE CASCADE,
      ADD CONSTRAINT appointments_room_misma_clinica
        FOREIGN KEY (room_id, clinic_id) REFERENCES rooms (id, clinic_id)
        ON DELETE SET NULL,
      ADD CONSTRAINT appointments_person_misma_clinica
        FOREIGN KEY (person_id, clinic_id) REFERENCES persons (id, clinic_id)
        ON DELETE CASCADE;

    ALTER TABLE availability_blocks
      ADD CONSTRAINT availability_blocks_prof_misma_clinica
        FOREIGN KEY (professional_id, clinic_id) REFERENCES users (id, clinic_id)
        ON DELETE CASCADE;

    ALTER TABLE availability_exceptions
      ADD CONSTRAINT availability_exceptions_prof_misma_clinica
        FOREIGN KEY (professional_id, clinic_id) REFERENCES users (id, clinic_id)
        ON DELETE CASCADE;

    ALTER TABLE patient_links
      ADD CONSTRAINT patient_links_prof_misma_clinica
        FOREIGN KEY (professional_id, clinic_id) REFERENCES users (id, clinic_id)
        ON DELETE CASCADE,
      ADD CONSTRAINT patient_links_person_misma_clinica
        FOREIGN KEY (person_id, clinic_id) REFERENCES persons (id, clinic_id)
        ON DELETE CASCADE;

    ALTER TABLE clinical_entries
      ADD CONSTRAINT clinical_entries_autor_misma_clinica
        FOREIGN KEY (author_professional_id, clinic_id) REFERENCES users (id, clinic_id)
        ON DELETE CASCADE,
      ADD CONSTRAINT clinical_entries_person_misma_clinica
        FOREIGN KEY (person_id, clinic_id) REFERENCES persons (id, clinic_id)
        ON DELETE CASCADE;

    ALTER TABLE user_specialties
      ADD CONSTRAINT user_specialties_user_misma_clinica
        FOREIGN KEY (user_id, clinic_id) REFERENCES users (id, clinic_id)
        ON DELETE CASCADE;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE user_specialties DROP CONSTRAINT user_specialties_user_misma_clinica;
    ALTER TABLE clinical_entries
      DROP CONSTRAINT clinical_entries_autor_misma_clinica,
      DROP CONSTRAINT clinical_entries_person_misma_clinica;
    ALTER TABLE patient_links
      DROP CONSTRAINT patient_links_prof_misma_clinica,
      DROP CONSTRAINT patient_links_person_misma_clinica;
    ALTER TABLE availability_exceptions DROP CONSTRAINT availability_exceptions_prof_misma_clinica;
    ALTER TABLE availability_blocks DROP CONSTRAINT availability_blocks_prof_misma_clinica;
    ALTER TABLE appointments
      DROP CONSTRAINT appointments_prof_misma_clinica,
      DROP CONSTRAINT appointments_room_misma_clinica,
      DROP CONSTRAINT appointments_person_misma_clinica;
    ALTER TABLE persons DROP CONSTRAINT persons_id_clinic_uq;
    ALTER TABLE rooms   DROP CONSTRAINT rooms_id_clinic_uq;
    ALTER TABLE users   DROP CONSTRAINT users_id_clinic_uq;
  `);
};

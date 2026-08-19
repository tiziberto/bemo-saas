/* eslint-disable camelcase */

// Sobreturno con doble confirmación.
//
// Hasta acá el solapamiento era imposible: dos EXCLUDE constraints impedían que un
// profesional o una sala tuvieran dos turnos activos encima. Eso resuelve el error
// (dos personas anotando a la vez) pero también bloquea el caso legítimo: la urgencia
// que hay que encajar sí o sí sobre un horario ya dado.
//
// La solución NO es aflojar la regla, es hacerla explícita. Se agrega `is_overbook`:
// los turnos normales siguen sin poder pisarse entre ellos, y sólo un turno que alguien
// marcó a conciencia como sobreturno queda fuera del constraint. Un choque accidental
// sigue siendo imposible; uno deliberado queda registrado como tal.
//
// Los EXCLUDE ya tenían un WHERE (por estado), así que se recrean sumando la condición.

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE appointments
      ADD COLUMN is_overbook boolean NOT NULL DEFAULT false;

    COMMENT ON COLUMN appointments.is_overbook IS
      'Turno cargado a sabiendas encima de otro. Queda fuera de los EXCLUDE anti-solapamiento.';

    ALTER TABLE appointments DROP CONSTRAINT no_room_overlap;
    ALTER TABLE appointments DROP CONSTRAINT no_prof_overlap;

    ALTER TABLE appointments ADD CONSTRAINT no_room_overlap
      EXCLUDE USING gist (room_id WITH =, during WITH &&)
      WHERE (status IN ('scheduled','confirmed','completed')
             AND room_id IS NOT NULL
             AND NOT is_overbook);

    ALTER TABLE appointments ADD CONSTRAINT no_prof_overlap
      EXCLUDE USING gist (professional_id WITH =, during WITH &&)
      WHERE (status IN ('scheduled','confirmed','completed')
             AND NOT is_overbook);

    -- Para el reporte de cuántos sobreturnos se están dando por profesional.
    CREATE INDEX appointments_overbook_idx ON appointments (clinic_id, is_overbook)
      WHERE is_overbook;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS appointments_overbook_idx;
    ALTER TABLE appointments DROP CONSTRAINT no_room_overlap;
    ALTER TABLE appointments DROP CONSTRAINT no_prof_overlap;

    -- Volver atrás sólo es posible si no quedaron sobreturnos: con dos turnos
    -- encima, el constraint viejo no se puede crear y la migración falla acá,
    -- que es preferible a borrar turnos en silencio.
    ALTER TABLE appointments ADD CONSTRAINT no_room_overlap
      EXCLUDE USING gist (room_id WITH =, during WITH &&)
      WHERE (status IN ('scheduled','confirmed','completed') AND room_id IS NOT NULL);
    ALTER TABLE appointments ADD CONSTRAINT no_prof_overlap
      EXCLUDE USING gist (professional_id WITH =, during WITH &&)
      WHERE (status IN ('scheduled','confirmed','completed'));

    ALTER TABLE appointments DROP COLUMN is_overbook;
  `);
};

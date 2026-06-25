/* eslint-disable camelcase */

// Extensiones base del proyecto:
// - btree_gist: necesaria para los EXCLUDE constraints anti-doble-turno (Etapa 3)
// - pgcrypto: gen_random_uuid() para PKs UUID
exports.up = (pgm) => {
  pgm.createExtension('btree_gist', { ifNotExists: true });
  pgm.createExtension('pgcrypto', { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropExtension('btree_gist', { ifExists: true });
  pgm.dropExtension('pgcrypto', { ifExists: true });
};

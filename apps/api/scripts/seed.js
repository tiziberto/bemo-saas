// Seed idempotente de datos demo.
// Etapa 1: todavía no hay esquema de dominio; sólo verificamos las extensiones.
// En la Etapa 4 esto crea la clínica demo, su equipo, salas, agenda y pacientes.
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT extname FROM pg_extension WHERE extname IN ('btree_gist','pgcrypto') ORDER BY extname",
    );
    const found = rows.map((r) => r.extname).join(', ') || 'ninguna';
    console.log(`[seed] extensiones presentes: ${found}`);
    console.log('[seed] OK — sin datos de dominio todavía (se agregan en la Etapa 4).');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[seed] error:', err.message);
  process.exit(1);
});

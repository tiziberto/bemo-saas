// La migración crea el rol `bemo_app` con una contraseña de desarrollo fija
// ('bemo_app'), que está en el repo. En producción hay que reemplazarla por la
// real: este script lo hace después de migrar, como owner.
//
// Uso (dentro del contenedor de migraciones):
//   DATABASE_URL=<owner> BEMO_APP_PASSWORD=<secreta> node scripts/set-app-password.js
//
// Es idempotente: se puede correr en cada despliegue.
const { Client } = require('pg');

async function main() {
  const password = process.env.BEMO_APP_PASSWORD;
  if (!password) {
    console.log('[app-password] BEMO_APP_PASSWORD no está definida: no se cambia nada.');
    return;
  }
  if (password === 'bemo_app') {
    throw new Error(
      '[app-password] BEMO_APP_PASSWORD no puede ser la contraseña de desarrollo.',
    );
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // Se pasa como literal escapado porque ALTER ROLE no acepta parámetros.
    const quoted = await client.query('SELECT quote_literal($1) AS q', [password]);
    await client.query(`ALTER ROLE bemo_app WITH PASSWORD ${quoted.rows[0].q}`);
    console.log('[app-password] contraseña del rol bemo_app actualizada.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[app-password] error:', err.message);
  process.exit(1);
});

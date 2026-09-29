/**
 * Reset complet de la base de données Palabre.
 *
 * Supprime toutes les tables et les recree proprement via les migrations.
 * A utiliser en developpement uniquement.
 *
 * Usage :
 *   docker compose -f docker/docker-compose.yml exec backend node src/db/reset.js
 */
require('dotenv').config();
const { pool } = require('../config/db');
const { execSync } = require('child_process');

async function run() {
  const client = await pool.connect();
  try {
    console.log('[reset] Suppression de toutes les tables...');

    // Supprimer le schema public et le recréer proprement
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO palabre');
    await client.query('GRANT ALL ON SCHEMA public TO public');

    console.log('[reset] Schema reinitialise.');
    client.release();
    await pool.end();

    console.log('[reset] Relance des migrations...');
    execSync('node src/db/migrate.js', { stdio: 'inherit' });

    console.log('\n[reset] Base de donnees reinitialise avec succes.');
    console.log('[reset] Vous pouvez maintenant tester le workflow depuis zero.');
  } catch (e) {
    client.release();
    console.error('[reset] ECHEC :', e.message);
    process.exit(1);
  }
}

run();

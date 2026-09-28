/**
 * Exécuteur de migrations minimaliste : applique dans l'ordre chaque fichier
 * .sql du dossier /migrations qui n'a pas encore été appliqué, dans une
 * transaction, et journalise l'application dans la table `schema_migrations`.
 *
 * Usage : node src/db/migrate.js
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function run() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);

    const applied = new Set(
      (await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename)
    );

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] déjà appliquée : ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] application de ${file} ...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrate] OK : ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] ÉCHEC sur ${file} :`, err.message);
        throw err;
      }
    }
    console.log('[migrate] terminé.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

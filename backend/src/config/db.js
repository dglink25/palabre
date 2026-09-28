const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('[db] erreur inattendue sur le pool PostgreSQL', err);
});

module.exports = { pool };

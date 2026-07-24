require('../config');

const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');

async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada. Copie .env.example para .env e preencha a palavra-passe.');
  const sql = await fs.readFile(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await pool.query(sql);
    console.log('Migração concluída com sucesso.');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrate().catch((error) => {
    console.error(`Falha na migração: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { migrate };

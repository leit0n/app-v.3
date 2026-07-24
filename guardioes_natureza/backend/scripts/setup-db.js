require('../config');

const { Pool } = require('pg');

async function setupDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  const target = new URL(process.env.DATABASE_URL);
  const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''));
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(databaseName)) throw new Error('O nome da base de dados deve conter apenas letras, números e _.');
  target.pathname = '/postgres';

  const adminPool = new Pool({ connectionString: target.toString(), max: 1 });
  try {
    const exists = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (!exists.rowCount) {
      await adminPool.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`Base de dados ${databaseName} criada.`);
    } else {
      console.log(`Base de dados ${databaseName} já existe.`);
    }
  } finally {
    await adminPool.end();
  }

  const { migrate } = require('./migrate');
  await migrate();
}

setupDatabase().catch((error) => {
  console.error(`Falha ao preparar a base de dados: ${error.message}`);
  process.exitCode = 1;
});

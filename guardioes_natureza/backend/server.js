require('./config');

const path = require('path');
const { Pool } = require('pg');
const { createApp } = require('./app');

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl, max: 10, idleTimeoutMillis: 30_000 })
  : null;

if (!pool) {
  console.warn('[backend] DATABASE_URL não configurada. A interface abre, mas a API devolve 503 até configurar a base de dados.');
}

const app = createApp({
  pool,
  webRoot: path.join(__dirname, '..', 'web'),
});

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => {
  console.log(`Guardiões da Natureza disponível em http://localhost:${port}`);
});

async function shutdown(signal) {
  console.log(`\n[backend] A encerrar (${signal})...`);
  server.close(async () => {
    await pool?.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

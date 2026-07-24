const express = require('express');
const path = require('path');
const crypto = require('crypto');

const VALID_CATEGORIES = new Set(['lixo', 'desmatamento', 'incendio']);
const VALID_TICKET_STATES = new Set(['Novo', 'Encaminhado', 'Em_Tratamento', 'Resolvido', 'Arquivado']);
const MAX_PHOTO_SIZE = 6_000_000;

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA); // keep timing consistent even on length mismatch
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Protects the admin panel (page + API) with HTTP Basic Auth. Credentials
// come from ADMIN_USER / ADMIN_PASSWORD in .env — never hardcoded.
function requireAdminAuth(req, res, next) {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).send('Painel de administração não configurado. Defina ADMIN_PASSWORD no ficheiro .env do backend.');
  }
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    const user = idx === -1 ? decoded : decoded.slice(0, idx);
    const pass = idx === -1 ? '' : decoded.slice(idx + 1);
    if (timingSafeEqualStr(user, adminUser) && timingSafeEqualStr(pass, adminPassword)) {
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="Guardioes Admin"');
  return res.status(401).send('Autenticação necessária.');
}

function asText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function validateReport(body = {}) {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracy = Number(body.accuracy);
  const category = body.category;
  const location = asText(body.location, 250);
  const description = asText(body.description, 2_000);
  const photoDataUrl = typeof body.photoDataUrl === 'string' ? body.photoDataUrl : null;
  const userId = body.userId == null || body.userId === '' ? 1 : Number(body.userId);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return { error: 'Latitude inválida.' };
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { error: 'Longitude inválida.' };
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 50) return { error: 'A precisão GPS deve estar entre 0 e 50 metros.' };
  if (!VALID_CATEGORIES.has(category)) return { error: 'Categoria inválida.' };
  if (!location) return { error: 'Indique uma referência do local.' };
  if (!description) return { error: 'Descreva a ocorrência.' };
  if (!Number.isSafeInteger(userId) || userId < 1) return { error: 'Utilizador inválido.' };
  if (photoDataUrl && (!photoDataUrl.startsWith('data:image/') || photoDataUrl.length > MAX_PHOTO_SIZE)) {
    return { error: 'A fotografia é inválida ou demasiado grande.' };
  }

  return { value: { latitude, longitude, accuracy, category, location, description, photoDataUrl, userId } };
}

function dbUnavailable(res) {
  return res.status(503).json({ error: 'Base de dados indisponível. Configure DATABASE_URL e execute a migração.' });
}

function createApp({ pool, webRoot } = {}) {
  const app = express();
  const publicRoot = webRoot ? path.resolve(webRoot) : null;
  app.use(express.json({ limit: '7mb' }));

  app.get('/api/health', async (_req, res, next) => {
    if (!pool) return dbUnavailable(res);
    try {
      const result = await pool.query("SELECT current_database() AS database, postgis_version() AS postgis_version");
      return res.json({ ok: true, ...result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/profile/:userId', async (req, res, next) => {
    if (!pool) return dbUnavailable(res);
    const userId = Number(req.params.userId);
    if (!Number.isSafeInteger(userId) || userId < 1) return res.status(400).json({ error: 'Utilizador inválido.' });
    try {
      const result = await pool.query(
        'SELECT id, nickname, email, school_name AS "schoolName", created_at AS "createdAt" FROM users WHERE id = $1',
        [userId]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Utilizador não encontrado.' });
      return res.json(result.rows[0]);
    } catch (error) {
      return next(error);
    }
  });

  app.put('/api/profile/:userId', async (req, res, next) => {
    if (!pool) return dbUnavailable(res);
    const userId = Number(req.params.userId);
    const nickname = asText(req.body?.name, 50);
    if (!Number.isSafeInteger(userId) || userId < 1 || !nickname) return res.status(400).json({ error: 'Nome de perfil inválido.' });
    try {
      const result = await pool.query(
        'UPDATE users SET nickname = $2 WHERE id = $1 RETURNING id, nickname, email, school_name AS "schoolName", created_at AS "createdAt"',
        [userId, nickname]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Utilizador não encontrado.' });
      return res.json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Este nome já está a ser usado.' });
      return next(error);
    }
  });

  app.get('/api/reports', async (req, res, next) => {
    if (!pool) return dbUnavailable(res);
    const userIdRaw = req.query.userId;
    const filterByUser = userIdRaw !== undefined && userIdRaw !== '';
    const userId = filterByUser ? Number(userIdRaw) : null;
    if (filterByUser && (!Number.isSafeInteger(userId) || userId < 1)) {
      return res.status(400).json({ error: 'Parâmetro userId inválido.' });
    }
    try {
      const result = await pool.query(`
        SELECT r.id, r.category AS type, r.location_label AS location, r.description AS "desc",
               r.accuracy_meters AS accuracy, r.created_at AS "createdAt", t.state AS status,
               a.name AS "authorityName", a.contact_email AS "authorityContact",
               ST_Y(r.geom) AS latitude, ST_X(r.geom) AS longitude,
               (r.photo_data_url IS NOT NULL) AS "hasPhoto"
        FROM reports r
        JOIN tickets t ON t.report_id = r.id
        LEFT JOIN authorities a ON a.id = t.authority_id
        ${filterByUser ? 'WHERE r.user_id = $1' : ''}
        ORDER BY r.created_at DESC
        LIMIT 200
      `, filterByUser ? [userId] : []);
      return res.json({ reports: result.rows });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/reports', async (req, res, next) => {
    if (!pool) return dbUnavailable(res);
    const validation = validateReport(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });
    const report = validation.value;
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const user = await client.query('SELECT id FROM users WHERE id = $1', [report.userId]);
      if (!user.rowCount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'O utilizador indicado não existe.' });
      }
      const authorityResult = await client.query(`
        SELECT id, name, contact_email FROM authorities
        WHERE ST_Covers(geom, ST_SetSRID(ST_Point($1, $2), 4326))
        ORDER BY ST_Area(geom) LIMIT 1
      `, [report.longitude, report.latitude]);
      if (!authorityResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'A localização está fora da área de cobertura ativa.' });
      }
      const authority = authorityResult.rows[0];
      const inserted = await client.query(`
        INSERT INTO reports (user_id, geom, accuracy_meters, category, location_label, description, photo_data_url)
        VALUES ($1, ST_SetSRID(ST_Point($2, $3), 4326), $4, $5, $6, $7, $8)
        RETURNING id, created_at AS "createdAt"
      `, [report.userId, report.longitude, report.latitude, report.accuracy, report.category, report.location, report.description, report.photoDataUrl]);
      const ticket = await client.query(
        "INSERT INTO tickets (report_id, authority_id, state) VALUES ($1, $2, 'Encaminhado') RETURNING id, state",
        [inserted.rows[0].id, authority.id]
      );
      await client.query('COMMIT');
      return res.status(201).json({
        success: true,
        reportId: inserted.rows[0].id,
        ticketId: ticket.rows[0].id,
        status: ticket.rows[0].state,
        createdAt: inserted.rows[0].createdAt,
        encaminhadoPara: authority.name,
        contactoAlvo: authority.contact_email,
      });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      return next(error);
    } finally {
      client?.release();
    }
  });

  // ---- Painel de administração (protegido por password) ----
  app.use(['/admin', '/admin.html', '/api/admin'], requireAdminAuth);

  app.get('/admin', (_req, res) => {
    if (!publicRoot) return res.status(503).send('Frontend não configurado.');
    return res.sendFile(path.join(publicRoot, 'admin.html'));
  });

  app.get('/api/admin/reports', async (req, res, next) => {
    if (!pool) return dbUnavailable(res);
    const stateFilter = VALID_TICKET_STATES.has(req.query.state) ? req.query.state : null;
    const categoryFilter = VALID_CATEGORIES.has(req.query.category) ? req.query.category : null;
    const conditions = [];
    const params = [];
    if (stateFilter) { params.push(stateFilter); conditions.push(`t.state = $${params.length}`); }
    if (categoryFilter) { params.push(categoryFilter); conditions.push(`r.category = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    try {
      const result = await pool.query(`
        SELECT r.id, u.nickname AS "reportedBy", r.category, r.location_label AS location,
               r.description, r.accuracy_meters AS accuracy, r.created_at AS "createdAt",
               t.id AS "ticketId", t.state,
               a.id AS "authorityId", a.name AS "authorityName", a.contact_email AS "authorityContact",
               ST_Y(r.geom) AS latitude, ST_X(r.geom) AS longitude,
               (r.photo_data_url IS NOT NULL) AS "hasPhoto"
        FROM reports r
        JOIN tickets t ON t.report_id = r.id
        LEFT JOIN authorities a ON a.id = t.authority_id
        LEFT JOIN users u ON u.id = r.user_id
        ${where}
        ORDER BY r.created_at DESC
        LIMIT 500
      `, params);
      return res.json({ reports: result.rows });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/admin/reports/:id/photo', async (req, res, next) => {
    if (!pool) return dbUnavailable(res);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Id inválido.' });
    try {
      const result = await pool.query('SELECT photo_data_url FROM reports WHERE id = $1', [id]);
      const dataUrl = result.rows[0]?.photo_data_url;
      if (!dataUrl) return res.status(404).json({ error: 'Sem fotografia para este reporte.' });
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(dataUrl);
      if (!match) return res.status(422).json({ error: 'Formato de fotografia inválido.' });
      const [, mime, base64] = match;
      res.set('Content-Type', mime);
      return res.send(Buffer.from(base64, 'base64'));
    } catch (error) {
      return next(error);
    }
  });

  app.patch('/api/admin/reports/:id', async (req, res, next) => {
    if (!pool) return dbUnavailable(res);
    const id = Number(req.params.id);
    const state = req.body?.state;
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Id inválido.' });
    if (!VALID_TICKET_STATES.has(state)) return res.status(400).json({ error: 'Estado inválido.' });
    try {
      const result = await pool.query(
        'UPDATE tickets SET state = $2 WHERE report_id = $1 RETURNING id, state',
        [id, state]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Reporte não encontrado.' });
      return res.json({ success: true, ticket: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint não encontrado.' }));

  if (publicRoot) {
    app.use(express.static(publicRoot));
    app.get('*', (_req, res) => res.sendFile(path.join(publicRoot, 'index.html')));
  }

  app.use((error, _req, res, _next) => {
    console.error('[backend] erro não tratado:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  });
  return app;
}

module.exports = { createApp, validateReport };

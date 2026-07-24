CREATE EXTENSION IF NOT EXISTS postgis;

DO $$ BEGIN
  CREATE TYPE authority_type AS ENUM ('Junta', 'Câmara', 'Governo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_state AS ENUM ('Novo', 'Encaminhado', 'Em_Tratamento', 'Resolvido', 'Arquivado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_category AS ENUM ('lixo', 'desmatamento', 'incendio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nickname VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  school_name VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS authorities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type authority_type NOT NULL,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  contact_email VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  geom geometry(Point, 4326) NOT NULL,
  accuracy_meters NUMERIC(5,2) NOT NULL CHECK (accuracy_meters >= 0 AND accuracy_meters <= 50),
  category report_category NOT NULL DEFAULT 'lixo',
  location_label VARCHAR(250) NOT NULL DEFAULT '',
  description VARCHAR(2000) NOT NULL DEFAULT '',
  photo_data_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE reports ADD COLUMN IF NOT EXISTS location_label VARCHAR(250) NOT NULL DEFAULT '';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS description VARCHAR(2000) NOT NULL DEFAULT '';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS photo_data_url TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS category report_category NOT NULL DEFAULT 'lixo';

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  report_id INT UNIQUE NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  authority_id INT NOT NULL REFERENCES authorities(id),
  state ticket_state NOT NULL DEFAULT 'Novo',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_authorities_geom ON authorities USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_reports_geom ON reports USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_reports_user_created ON reports (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_authority_state ON tickets (authority_id, state);

INSERT INTO users (nickname, role)
VALUES ('convidado', 'guest')
ON CONFLICT (nickname) DO NOTHING;

INSERT INTO authorities (name, type, geom, contact_email)
SELECT
  'Câmara Municipal de Ponta Delgada',
  'Câmara',
  ST_SetSRID(ST_GeomFromText('MULTIPOLYGON(((-25.90 37.70, -25.90 37.90, -25.10 37.90, -25.10 37.70, -25.90 37.70)))'), 4326),
  'geral@cmpontadelgada.pt'
WHERE NOT EXISTS (
  SELECT 1 FROM authorities WHERE name = 'Câmara Municipal de Ponta Delgada'
);

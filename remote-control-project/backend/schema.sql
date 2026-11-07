-- Remote Control backend - Postgres sxemasi
-- DATABASE_URL o'rnatilgan bo'lsa, server ishga tushganda bu jadvallar
-- avtomatik yaratiladi (store.js -> init()). Qo'lda ishga tushirish uchun:
--   psql "$DATABASE_URL" -f schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL,              -- 'agent' | 'controller'
  platform   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessiyalar - audit-log. Kim, qachon, qaysi qurilmani kuzatgani yozib boriladi.
CREATE TABLE IF NOT EXISTS sessions (
  id                   UUID PRIMARY KEY,
  agent_device_id      UUID,
  controller_device_id UUID,
  approved             BOOLEAN NOT NULL DEFAULT false,
  started_at           BIGINT NOT NULL,  -- epoch ms
  ended_at             BIGINT
);

CREATE INDEX IF NOT EXISTS idx_devices_user       ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent      ON sessions(agent_device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_controller ON sessions(controller_device_id);

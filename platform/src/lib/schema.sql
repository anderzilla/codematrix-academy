-- CodeMatrix Academy — Schema relacional multi-curso (Etapa 1)
-- Compatível com SQLite (node:sqlite) e preparatório para PostgreSQL

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Formação',
  language TEXT NOT NULL DEFAULT 'pt-BR',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  planned_modules_count INTEGER NOT NULL DEFAULT 0,
  planned_lessons_count INTEGER NOT NULL DEFAULT 0,
  planned_blocks_count INTEGER NOT NULL DEFAULT 0,
  min_pass_percent INTEGER NOT NULL DEFAULT 70,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS course_versions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  version_tag TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  source_ref TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (course_id, version_tag)
);

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES course_versions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  promise TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'planned', 'published')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (course_id, code),
  UNIQUE (course_id, position)
);

CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  focus TEXT NOT NULL DEFAULT '',
  remediate TEXT NOT NULL DEFAULT '',
  min_pass_percent INTEGER NOT NULL DEFAULT 70,
  is_free_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_free_sample IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('draft', 'planned', 'published')),
  UNIQUE (course_id, code),
  UNIQUE (module_id, position)
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  slides_count INTEGER NOT NULL DEFAULT 0,
  content_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('draft', 'planned', 'published')),
  UNIQUE (course_id, code),
  UNIQUE (course_id, position)
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id TEXT REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('slides', 'document', 'stream_video', 'live_input', 'project_guide', 'reference')),
  title TEXT NOT NULL,
  storage_ref TEXT NOT NULL DEFAULT '',
  stream_uid TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'ready', 'pending_upload')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE (course_id, code)
);

-- Gabarito e explicações ficam exclusivamente no servidor; nunca expostos na API pública da vitrine
CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  question_code TEXT NOT NULL,
  lesson_position INTEGER NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  skill TEXT NOT NULL DEFAULT '',
  explanation TEXT NOT NULL DEFAULT '',
  version_tag TEXT NOT NULL DEFAULT 'v1',
  UNIQUE (course_id, question_code)
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  offer_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  access_scope TEXT NOT NULL,
  is_free INTEGER NOT NULL DEFAULT 0 CHECK (is_free IN (0, 1)),
  price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  hotmart_product_id TEXT,
  hotmart_offer_code TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  offer_id TEXT REFERENCES offers(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed_cents')),
  discount_value INTEGER NOT NULL CHECK (discount_value >= 0),
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_from TEXT,
  valid_until TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'expired', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  offer_sku TEXT,
  hotmart_product_id TEXT,
  transaction_code TEXT,
  buyer_email_hash TEXT,
  payload_sha256 TEXT NOT NULL,
  payload_sanitized_json TEXT NOT NULL,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('recorded_stage1', 'ignored', 'failed')),
  entitlement_status TEXT NOT NULL DEFAULT 'deferred_to_stage_2',
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS cms_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  review_notice TEXT NOT NULL DEFAULT '',
  sections_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_modules_course_pos ON modules(course_id, position);
CREATE INDEX IF NOT EXISTS idx_blocks_module_pos ON blocks(module_id, position);
CREATE INDEX IF NOT EXISTS idx_lessons_block_pos ON lessons(block_id, position);
CREATE INDEX IF NOT EXISTS idx_offers_course_status ON offers(course_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_events_provider ON payment_events(provider, received_at);

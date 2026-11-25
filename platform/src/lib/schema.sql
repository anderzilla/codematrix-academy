-- CodeMatrix Academy — Schema relacional multi-curso (Etapas 1 e 2)
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
  processing_status TEXT NOT NULL CHECK (processing_status IN ('recorded_stage1', 'processed', 'ignored', 'failed')),
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

-- ============================================================================
-- ETAPA 2: Identidade, sessões, entitlements, progresso, quizzes, lives, certs
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'ops_support', 'instructor', 'affiliate', 'seller', 'partner', 'student')),
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, role, course_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Caixa de entrada isolada SOMENTE para desenvolvimento/testes quando SMTP não está configurado
CREATE TABLE IF NOT EXISTS dev_mailbox (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  subject TEXT NOT NULL,
  token_preview TEXT NOT NULL,
  action_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  buyer_email_hash TEXT,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  offer_sku TEXT NOT NULL,
  access_scope TEXT NOT NULL,
  source_provider TEXT NOT NULL CHECK (source_provider IN ('free_sample', 'hotmart', 'manual')),
  source_event_id TEXT,
  transaction_code TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'revoked', 'expired')),
  starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  ends_at TEXT,
  suspension_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Trilha append-only de concessão, suspensão e revogação de direitos (nunca apagar)
CREATE TABLE IF NOT EXISTS entitlement_history (
  id TEXT PRIMARY KEY,
  entitlement_id TEXT NOT NULL REFERENCES entitlements(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('granted', 'suspended', 'revoked', 'reactivated', 'claimed_by_user')),
  reason TEXT NOT NULL DEFAULT '',
  source_event_id TEXT,
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  version_tag TEXT NOT NULL DEFAULT 'v1.0-m1',
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted')),
  questions_snapshot_json TEXT NOT NULL,
  answers_json TEXT,
  score_percent INTEGER,
  correct_count INTEGER,
  total_count INTEGER NOT NULL DEFAULT 10,
  passed INTEGER NOT NULL DEFAULT 0 CHECK (passed IN (0, 1)),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS live_events (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id TEXT REFERENCES modules(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  scheduled_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'live', 'replay_available', 'ended')),
  access_scope TEXT NOT NULL,
  live_input_uid TEXT,
  replay_stream_uid TEXT,
  retention_days INTEGER NOT NULL DEFAULT 90,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (course_id, code)
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  verification_code TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_display_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  scope_label TEXT NOT NULL,
  workload_hours INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL CHECK (status IN ('valid', 'revoked')),
  revocation_reason TEXT,
  template_notice TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  UNIQUE (user_id, course_id, scope_label)
);

CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_modules_course_pos ON modules(course_id, position);
CREATE INDEX IF NOT EXISTS idx_blocks_module_pos ON blocks(module_id, position);
CREATE INDEX IF NOT EXISTS idx_lessons_block_pos ON lessons(block_id, position);
CREATE INDEX IF NOT EXISTS idx_offers_course_status ON offers(course_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_events_provider ON payment_events(provider, received_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_user_course ON entitlements(user_id, course_id, status);
CREATE INDEX IF NOT EXISTS idx_entitlements_email_hash ON entitlements(buyer_email_hash, status);
CREATE INDEX IF NOT EXISTS idx_entitlements_tx ON entitlements(transaction_code);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_block ON quiz_attempts(user_id, block_id, status);
CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(verification_code);

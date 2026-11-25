-- CodeMatrix Academy — Schema PostgreSQL 16 (Azure Database for PostgreSQL Flexible Server)
-- Fonte de verdade transacional ACID com suporte a Row-Level Security (RLS),
-- TLS obrigatório (sslmode=verify-full) e auditoria append-only.

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  offer_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  access_scope TEXT NOT NULL,
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  hotmart_product_id TEXT,
  hotmart_offer_code TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  payload_sanitized_json JSONB NOT NULL,
  processing_status TEXT NOT NULL,
  entitlement_status TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  buyer_email_hash TEXT,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  offer_sku TEXT NOT NULL,
  access_scope TEXT NOT NULL,
  source_provider TEXT NOT NULL CHECK (source_provider IN ('free_sample', 'mercadopago', 'hotmart', 'manual')),
  source_event_id TEXT,
  transaction_code TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'revoked', 'expired')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  suspension_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entitlement_history (
  id TEXT PRIMARY KEY,
  entitlement_id TEXT NOT NULL REFERENCES entitlements(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  source_event_id TEXT,
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('invited', 'pending', 'approved', 'suspended')),
  terms_version TEXT,
  terms_accepted_at TIMESTAMPTZ,
  payout_method TEXT,
  payout_masked_summary TEXT,
  payout_encrypted_blob TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commission_rules (
  id TEXT PRIMARY KEY,
  rule_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  offer_sku TEXT NOT NULL,
  partner_role TEXT NOT NULL,
  campaign TEXT NOT NULL DEFAULT 'geral',
  calc_base TEXT NOT NULL CHECK (calc_base IN ('gross', 'net_after_gateway')),
  rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (rate_bps >= 0 AND rate_bps <= 10000),
  fixed_cents INTEGER NOT NULL DEFAULT 0 CHECK (fixed_cents >= 0),
  warranty_days INTEGER NOT NULL DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rule_key, version)
);

CREATE TABLE IF NOT EXISTS payout_batches (
  id TEXT PRIMARY KEY,
  period_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft_preliminary',
  total_commission_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  prepared_by TEXT NOT NULL,
  approved_by TEXT,
  payment_method TEXT,
  payment_reference TEXT,
  receipt_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commission_entries (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partner_profiles(id) ON DELETE RESTRICT,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  offer_sku TEXT NOT NULL,
  transaction_code TEXT NOT NULL,
  source_event_id TEXT,
  attribution_source TEXT NOT NULL,
  attribution_code TEXT NOT NULL,
  buyer_masked_label TEXT NOT NULL,
  rule_id TEXT NOT NULL REFERENCES commission_rules(id) ON DELETE RESTRICT,
  rule_version INTEGER NOT NULL,
  rule_snapshot_json JSONB NOT NULL,
  gross_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  gateway_fee_cents INTEGER NOT NULL DEFAULT 0,
  commission_base_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL,
  payout_batch_id TEXT REFERENCES payout_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transaction_code, partner_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exemplo de Row-Level Security (RLS) para ativar em produção no Azure PostgreSQL:
-- ALTER TABLE commission_entries ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY partner_own_commissions ON commission_entries
--   USING (partner_id = current_setting('app.current_partner_id', true));


-- ============================================================================
-- Tabelas adicionais das Etapas 1 e 2 (paridade completa no PostgreSQL 16)
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_versions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  version_tag TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  source_ref TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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
  is_free_sample BOOLEAN NOT NULL DEFAULT FALSE,
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
  content_json JSONB NOT NULL DEFAULT '[]'::jsonb,
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
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  storage_ref TEXT NOT NULL DEFAULT '',
  stream_uid TEXT,
  status TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (course_id, code)
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  question_code TEXT NOT NULL,
  lesson_position INTEGER NOT NULL,
  question TEXT NOT NULL,
  options_json JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  skill TEXT NOT NULL DEFAULT '',
  explanation TEXT NOT NULL DEFAULT '',
  version_tag TEXT NOT NULL DEFAULT 'v1',
  UNIQUE (course_id, question_code)
);

CREATE TABLE IF NOT EXISTS cms_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  review_notice TEXT NOT NULL DEFAULT '',
  sections_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, course_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  version_tag TEXT NOT NULL DEFAULT 'v1.0-m1',
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted')),
  questions_snapshot_json JSONB NOT NULL,
  answers_json JSONB,
  score_percent INTEGER,
  correct_count INTEGER,
  total_count INTEGER NOT NULL DEFAULT 10,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS live_events (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id TEXT REFERENCES modules(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL,
  access_scope TEXT NOT NULL,
  live_input_uid TEXT,
  replay_stream_uid TEXT,
  retention_days INTEGER NOT NULL DEFAULT 90,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (user_id, course_id, scope_label)
);


-- ============================================================================
-- ETAPA 4 (PostgreSQL 16): MFA Admin, Ledger Financeiro Append-Only e LGPD
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_mfa (
  session_token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT 'totp_step_up',
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_ledger (
  id TEXT PRIMARY KEY,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('sale', 'refund', 'chargeback', 'adjustment')),
  course_id TEXT REFERENCES courses(id) ON DELETE RESTRICT,
  offer_sku TEXT,
  partner_id TEXT REFERENCES partner_profiles(id) ON DELETE SET NULL,
  transaction_code TEXT NOT NULL,
  source_event_id TEXT,
  gross_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  gateway_fee_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  refund_cents INTEGER NOT NULL DEFAULT 0,
  chargeback_cents INTEGER NOT NULL DEFAULT 0,
  net_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  competence_date DATE NOT NULL,
  cash_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lgpd_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  requester_email_hash TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('export_data', 'delete_data', 'rectify_data')),
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'completed')),
  reason TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- Checkout Próprio (Mercado Pago), Pedidos Internos e Lista de Espera (PG 16)
-- ============================================================================

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_code TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  buyer_email_hash TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  offer_sku TEXT NOT NULL,
  gross_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  net_payable_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  payment_method TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  provider_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  coupon_code TEXT,
  partner_link_code TEXT,
  checkout_url TEXT,
  pix_copy_paste TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS waitlist_leads (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  target_scope TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, target_scope, email)
);

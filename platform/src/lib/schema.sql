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
  status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'published', 'archived')),
  active_version_id TEXT,
  planned_modules_count INTEGER NOT NULL DEFAULT 0,
  planned_lessons_count INTEGER NOT NULL DEFAULT 0,
  planned_blocks_count INTEGER NOT NULL DEFAULT 0,
  min_pass_percent INTEGER NOT NULL DEFAULT 70,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS course_slug_aliases (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  old_slug TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  source_provider TEXT NOT NULL CHECK (source_provider IN ('free_sample', 'mercadopago', 'hotmart', 'manual')),
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
  course_version_id TEXT,
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  version_tag TEXT NOT NULL DEFAULT 'v1',
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


-- ============================================================================
-- ETAPA 3: Parceiros, RBAC por escopo, links/cupons, comissões e auditoria
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('invited', 'pending', 'approved', 'suspended')),
  terms_version TEXT,
  terms_accepted_at TEXT,
  payout_method TEXT,
  payout_masked_summary TEXT,
  payout_encrypted_blob TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS partner_scopes (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('instructor', 'affiliate', 'seller', 'partner')),
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  campaign TEXT,
  contract_ref TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (partner_id, role, course_id, campaign)
);

CREATE TABLE IF NOT EXISTS partner_links (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  offer_sku TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  campaign TEXT NOT NULL DEFAULT 'geral',
  attribution_precedence TEXT NOT NULL DEFAULT 'coupon_over_link' CHECK (attribution_precedence IN ('coupon_over_link', 'last_click', 'first_click')),
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  clicks_count INTEGER NOT NULL DEFAULT 0,
  valid_from TEXT,
  valid_until TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired', 'revoked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS partner_coupons (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  offer_sku TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  campaign TEXT NOT NULL DEFAULT 'geral',
  -- Desconto para o cliente (separado da remuneração do parceiro)
  discount_type TEXT NOT NULL CHECK (discount_type IN ('none', 'percent', 'fixed_cents')),
  discount_value INTEGER NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  -- Regra de remuneração vinculada (opcional; sobrescrita apenas por regra versionada aprovada)
  commission_rule_id TEXT REFERENCES commission_rules(id) ON DELETE SET NULL,
  attribution_precedence TEXT NOT NULL DEFAULT 'coupon_over_link' CHECK (attribution_precedence IN ('coupon_over_link', 'last_click', 'first_click')),
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_from TEXT,
  valid_until TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired', 'revoked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS instructor_assignments (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id TEXT REFERENCES modules(id) ON DELETE SET NULL,
  live_event_id TEXT REFERENCES live_events(id) ON DELETE SET NULL,
  role_label TEXT NOT NULL DEFAULT 'Instrutor convidado',
  recording_status TEXT NOT NULL DEFAULT 'pending' CHECK (recording_status IN ('pending', 'in_progress', 'recorded', 'published')),
  prep_checklist_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commission_rules (
  id TEXT PRIMARY KEY,
  rule_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  offer_sku TEXT NOT NULL,
  partner_role TEXT NOT NULL CHECK (partner_role IN ('instructor', 'affiliate', 'seller', 'partner')),
  campaign TEXT NOT NULL DEFAULT 'geral',
  calc_base TEXT NOT NULL CHECK (calc_base IN ('gross', 'net_after_gateway')),
  rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (rate_bps >= 0 AND rate_bps <= 10000),
  fixed_cents INTEGER NOT NULL DEFAULT 0 CHECK (fixed_cents >= 0),
  warranty_days INTEGER NOT NULL DEFAULT 7 CHECK (warranty_days >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (rule_key, version)
);

CREATE TABLE IF NOT EXISTS payout_batches (
  id TEXT PRIMARY KEY,
  period_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft_preliminary' CHECK (status IN ('draft_preliminary', 'pending_dual_approval', 'approved', 'paid', 'reversed')),
  total_commission_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  prepared_by TEXT NOT NULL,
  approved_by TEXT,
  payment_method TEXT,
  payment_reference TEXT,
  receipt_ref TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commission_entries (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partner_profiles(id) ON DELETE RESTRICT,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  offer_sku TEXT NOT NULL,
  transaction_code TEXT NOT NULL,
  source_event_id TEXT,
  attribution_source TEXT NOT NULL CHECK (attribution_source IN ('coupon', 'link', 'manual_contract')),
  attribution_code TEXT NOT NULL,
  buyer_masked_label TEXT NOT NULL,
  rule_id TEXT NOT NULL REFERENCES commission_rules(id) ON DELETE RESTRICT,
  rule_version INTEGER NOT NULL,
  rule_snapshot_json TEXT NOT NULL,
  gross_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  gateway_fee_cents INTEGER NOT NULL DEFAULT 0,
  commission_base_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL CHECK (status IN ('estimated', 'pending_warranty', 'approved', 'blocked_refund', 'blocked_chargeback', 'under_review', 'paid')),
  payout_batch_id TEXT REFERENCES payout_batches(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (transaction_code, partner_id)
);

CREATE TABLE IF NOT EXISTS partner_fraud_flags (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
  commission_entry_id TEXT REFERENCES commission_entries(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('self_referral', 'burst_clicks', 'coupon_abuse', 'other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review', 'appealed', 'cleared', 'confirmed')),
  detail TEXT NOT NULL,
  appeal_note TEXT,
  appealed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_partner_scopes_partner ON partner_scopes(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_links_partner ON partner_links(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_coupons_partner ON partner_coupons(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_commission_entries_partner ON commission_entries(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_commission_entries_tx ON commission_entries(transaction_code);
CREATE INDEX IF NOT EXISTS idx_audit_events_target ON audit_events(target_type, target_id, created_at);


-- ============================================================================
-- ETAPA 4: MFA/Step-up Admin, Ledger Financeiro Append-Only e Pedidos LGPD
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_mfa (
  session_token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT 'totp_step_up',
  verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Razão operacional append-only (nunca sobrescrever; ajustes são novos lançamentos)
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
  competence_date TEXT NOT NULL,
  cash_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lgpd_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  requester_email_hash TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('export_data', 'delete_data', 'rectify_data')),
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'completed')),
  reason TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ledger_tx ON financial_ledger(transaction_code, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_course ON financial_ledger(course_id, competence_date);
CREATE INDEX IF NOT EXISTS idx_lgpd_status ON lgpd_requests(status, created_at);


-- ============================================================================
-- Checkout Próprio (Mercado Pago), Pedidos Internos e Lista de Espera
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
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card', 'google_pay', 'apple_pay', 'boleto')),
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  provider_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'refunded', 'chargeback', 'canceled')),
  coupon_code TEXT,
  partner_link_code TEXT,
  checkout_url TEXT,
  pix_copy_paste TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS waitlist_leads (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  target_scope TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (course_id, target_scope, email)
);

CREATE INDEX IF NOT EXISTS idx_orders_provider_pid ON orders(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_hash ON orders(buyer_email_hash, status);

-- ============================================================================
-- ETAPA 6: Multi-curso completo — offer_grants, course_partner_assignments e migrations
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS offer_grants (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  course_version_id TEXT REFERENCES course_versions(id) ON DELETE SET NULL,
  grant_type TEXT NOT NULL CHECK (grant_type IN ('course', 'module', 'block')),
  target_code TEXT NOT NULL DEFAULT 'full',
  access_scope TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (offer_id, course_id, access_scope)
);

CREATE TABLE IF NOT EXISTS course_partner_assignments (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('instructor', 'affiliate', 'seller', 'partner')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked', 'expired')),
  scope_json TEXT NOT NULL DEFAULT '{}',
  terms_version TEXT,
  terms_accepted_at TEXT,
  commission_rule_id TEXT REFERENCES commission_rules(id) ON DELETE SET NULL,
  valid_from TEXT,
  valid_until TEXT,
  granted_by TEXT NOT NULL DEFAULT 'system',
  revoked_by TEXT,
  revoked_at TEXT,
  impact_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (partner_id, course_id, role)
);

CREATE INDEX IF NOT EXISTS idx_offer_grants_offer_course ON offer_grants(offer_id, course_id);
CREATE INDEX IF NOT EXISTS idx_cpa_partner_course_status ON course_partner_assignments(partner_id, course_id, status);
CREATE INDEX IF NOT EXISTS idx_cpa_course_role_status ON course_partner_assignments(course_id, role, status);
CREATE INDEX IF NOT EXISTS idx_slug_aliases_old_slug ON course_slug_aliases(old_slug);

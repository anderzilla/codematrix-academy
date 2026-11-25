import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import type { DatabaseSync } from 'node:sqlite';
import { getDb } from '@/lib/db';
import { claimPendingEntitlementsForUser } from '@/lib/entitlements';

export const SESSION_COOKIE_NAME =
  process.env.ACADEMY_SESSION_COOKIE_NAME?.trim() || 'cm_academy_session';

const SESSION_TTL_HOURS = 24 * 7;
const VERIFY_TOKEN_TTL_MINUTES = 60;
const RESET_TOKEN_TTL_MINUTES = 30;

// Rate limiter simples por chave em memória (proteção básica contra abuso de login/recuperação)
const rateBucket = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests = 15, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateBucket.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBucket.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

export function isDevMailboxEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ACADEMY_DEV_MAILBOX === '1') return true;
  if (env.ACADEMY_DEV_MAILBOX === '0') return false;
  return env.NODE_ENV !== 'production';
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(normalizeEmail(email), 'utf8').digest('hex');
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hexDigest] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hexDigest, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: string | null;
  roles: string[];
}

function recordDevEmail(
  db: DatabaseSync,
  input: {
    recipientEmail: string;
    purpose: 'verify_email' | 'reset_password';
    subject: string;
    token: string;
    actionPath: string;
  },
): void {
  if (!isDevMailboxEnabled()) return;
  const baseUrl = (process.env.ACADEMY_PUBLIC_URL || 'http://127.0.0.1:3100').replace(/\/+$/, '');
  const id = `mail_${crypto.randomUUID().replace(/-/g, '')}`;
  db.prepare(
    `INSERT INTO dev_mailbox (id, recipient_email, purpose, subject, token_preview, action_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.recipientEmail,
    input.purpose,
    input.subject,
    input.token,
    `${baseUrl}${input.actionPath}`,
  );
}

function createAuthToken(
  db: DatabaseSync,
  userId: string,
  purpose: 'verify_email' | 'reset_password',
  ttlMinutes: number,
): string {
  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = sha256Hex(rawToken);
  const id = `tok_${crypto.randomUUID().replace(/-/g, '')}`;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();

  db.prepare(
    `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, userId, purpose, tokenHash, expiresAt);

  return rawToken;
}

export function registerStudent(
  db: DatabaseSync,
  input: { name: string; email: string; password: string },
): { ok: true; userId: string } | { ok: false; status: number; error: string } {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (name.length < 2 || name.length > 120) {
    return { ok: false, status: 400, error: 'Informe seu nome completo (mínimo de 2 caracteres).' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) {
    return { ok: false, status: 400, error: 'Informe um endereço de e-mail válido.' };
  }
  if (password.length < 8 || password.length > 128) {
    return { ok: false, status: 400, error: 'A senha deve ter entre 8 e 128 caracteres.' };
  }

  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as
    | { id: string }
    | undefined;
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: 'Já existe uma conta cadastrada com este e-mail. Tente entrar ou recuperar sua senha.',
    };
  }

  const userId = `usr_${crypto.randomUUID().replace(/-/g, '')}`;
  const emailHash = hashEmail(email);
  const passwordHash = hashPassword(password);

  db.prepare(
    `INSERT INTO users (id, email, email_hash, name, password_hash)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(userId, email, emailHash, name, passwordHash);

  db.prepare(
    `INSERT INTO user_roles (id, user_id, role, course_id)
     VALUES (?, ?, 'student', NULL)`,
  ).run(`ur_${crypto.randomUUID().replace(/-/g, '')}`, userId);

  const token = createAuthToken(db, userId, 'verify_email', VERIFY_TOKEN_TTL_MINUTES);
  recordDevEmail(db, {
    recipientEmail: email,
    purpose: 'verify_email',
    subject: 'Confirme seu e-mail na CodeMatrix Academy',
    token,
    actionPath: `/entrar?modo=verificar&token=${encodeURIComponent(token)}`,
  });

  return { ok: true, userId };
}

export function verifyEmailWithToken(
  db: DatabaseSync,
  rawToken: string,
): { ok: true; userId: string; claimedEntitlements: number } | { ok: false; error: string } {
  const tokenHash = sha256Hex(rawToken.trim());
  const row = db
    .prepare(
      `SELECT t.id, t.user_id, t.expires_at, t.used_at, u.email_hash
       FROM auth_tokens t
       INNER JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.purpose = 'verify_email'`,
    )
    .get(tokenHash) as
    | { id: string; user_id: string; expires_at: string; used_at: string | null; email_hash: string }
    | undefined;

  if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: 'Código de verificação inválido ou expirado.' };
  }

  db.prepare(`UPDATE auth_tokens SET used_at = datetime('now') WHERE id = ?`).run(row.id);
  db.prepare(
    `UPDATE users SET email_verified_at = COALESCE(email_verified_at, datetime('now')), updated_at = datetime('now') WHERE id = ?`,
  ).run(row.user_id);

  const claimed = claimPendingEntitlementsForUser(db, row.user_id, row.email_hash);
  return { ok: true, userId: row.user_id, claimedEntitlements: claimed };
}

export function authenticateUser(
  db: DatabaseSync,
  input: { email: string; password: string },
):
  | { ok: true; user: SessionUser; sessionToken: string; expiresAt: string }
  | { ok: false; status: number; code: string; error: string } {
  const email = normalizeEmail(input.email);
  const row = db
    .prepare(
      `SELECT id, email, email_hash, name, password_hash, email_verified_at, status
       FROM users WHERE email = ?`,
    )
    .get(email) as
    | {
        id: string;
        email: string;
        email_hash: string;
        name: string;
        password_hash: string;
        email_verified_at: string | null;
        status: string;
      }
    | undefined;

  if (!row || !verifyPassword(input.password, row.password_hash)) {
    return {
      ok: false,
      status: 401,
      code: 'invalid_credentials',
      error: 'E-mail ou senha incorretos.',
    };
  }

  if (row.status !== 'active') {
    return {
      ok: false,
      status: 403,
      code: 'account_suspended',
      error: 'Esta conta está suspensa. Entre em contato com o suporte.',
    };
  }

  if (!row.email_verified_at) {
    return {
      ok: false,
      status: 403,
      code: 'email_not_verified',
      error: 'Confirme seu e-mail antes de entrar na Área do Aluno.',
    };
  }

  // Garante vinculação de eventuais compras feitas após o cadastro
  claimPendingEntitlementsForUser(db, row.id, row.email_hash);

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
  ).run(`ses_${crypto.randomUUID().replace(/-/g, '')}`, row.id, sha256Hex(sessionToken), expiresAt);

  const roles = (
    db.prepare(`SELECT DISTINCT role FROM user_roles WHERE user_id = ?`).all(row.id) as Array<{
      role: string;
    }>
  ).map((r) => r.role);

  return {
    ok: true,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      emailVerifiedAt: row.email_verified_at,
      roles,
    },
    sessionToken,
    expiresAt,
  };
}

export function requestPasswordRecovery(db: DatabaseSync, rawEmail: string): void {
  const email = normalizeEmail(rawEmail);
  const user = db.prepare(`SELECT id, email, status FROM users WHERE email = ?`).get(email) as
    | { id: string; email: string; status: string }
    | undefined;

  if (!user || user.status !== 'active') {
    return;
  }

  const token = createAuthToken(db, user.id, 'reset_password', RESET_TOKEN_TTL_MINUTES);
  recordDevEmail(db, {
    recipientEmail: user.email,
    purpose: 'reset_password',
    subject: 'Recuperação de senha — CodeMatrix Academy',
    token,
    actionPath: `/entrar?modo=redefinir&token=${encodeURIComponent(token)}`,
  });
}

export function resetPasswordWithToken(
  db: DatabaseSync,
  rawToken: string,
  newPassword: string,
): { ok: true } | { ok: false; error: string } {
  if (newPassword.length < 8 || newPassword.length > 128) {
    return { ok: false, error: 'A nova senha deve ter entre 8 e 128 caracteres.' };
  }
  const tokenHash = sha256Hex(rawToken.trim());
  const row = db
    .prepare(
      `SELECT id, user_id, expires_at, used_at
       FROM auth_tokens
       WHERE token_hash = ? AND purpose = 'reset_password'`,
    )
    .get(tokenHash) as
    | { id: string; user_id: string; expires_at: string; used_at: string | null }
    | undefined;

  if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: 'Link ou código de recuperação inválido ou expirado.' };
  }

  db.prepare(`UPDATE auth_tokens SET used_at = datetime('now') WHERE id = ?`).run(row.id);
  db.prepare(
    `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(hashPassword(newPassword), row.user_id);
  // Revoga sessões anteriores após troca de senha
  db.prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ?`).run(
    row.user_id,
  );

  return { ok: true };
}

export function revokeSessionToken(db: DatabaseSync, rawToken: string): void {
  db.prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE token_hash = ?`).run(
    sha256Hex(rawToken),
  );
}

export function getUserBySessionToken(db: DatabaseSync, rawToken: string): SessionUser | null {
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.email_verified_at, u.status, s.expires_at, s.revoked_at
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(sha256Hex(rawToken)) as
    | {
        id: string;
        email: string;
        name: string;
        email_verified_at: string | null;
        status: string;
        expires_at: string;
        revoked_at: string | null;
      }
    | undefined;

  if (!row || row.revoked_at || row.status !== 'active') return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;

  const roles = (
    db.prepare(`SELECT DISTINCT role FROM user_roles WHERE user_id = ?`).all(row.id) as Array<{
      role: string;
    }>
  ).map((r) => r.role);

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerifiedAt: row.email_verified_at,
    roles,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  const db = getDb();
  return getUserBySessionToken(db, raw);
}

export function getSessionCookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  };
}

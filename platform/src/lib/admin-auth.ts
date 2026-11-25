import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import type { DatabaseSync } from 'node:sqlite';
import { recordAuditEvent } from '@/lib/audit';
import {
  getUserBySessionToken,
  SESSION_COOKIE_NAME,
  sha256Hex,
  type SessionUser,
} from '@/lib/auth';
import { getDb } from '@/lib/db';

const MFA_TTL_HOURS = 4;

export interface AdminAuthSuccess {
  ok: true;
  user: SessionUser;
  sessionTokenHash: string;
  mfaVerified: boolean;
  isFullAdmin: boolean;
}

export interface AdminAuthFailure {
  ok: false;
  status: 401 | 403;
  code: 'unauthorized' | 'forbidden' | 'mfa_required';
  error: string;
}

export function isSessionMfaValid(db: DatabaseSync, sessionTokenHash: string): boolean {
  const row = db
    .prepare(`SELECT expires_at FROM session_mfa WHERE session_token_hash = ?`)
    .get(sessionTokenHash) as { expires_at: string } | undefined;
  if (!row) return false;
  return new Date(row.expires_at).getTime() > Date.now();
}

export async function requireAdminSession(options: {
  requireMfa?: boolean;
  requireFullAdmin?: boolean;
} = {}): Promise<AdminAuthSuccess | AdminAuthFailure> {
  const { requireMfa = true, requireFullAdmin = false } = options;
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      error: 'Autenticação administrativa necessária.',
    };
  }

  const db = getDb();
  const user = getUserBySessionToken(db, rawToken);
  if (!user) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      error: 'Sessão inválida ou expirada.',
    };
  }

  const isFullAdmin = user.roles.includes('admin');
  const isOps = user.roles.includes('ops_support');

  if (requireFullAdmin ? !isFullAdmin : !isFullAdmin && !isOps) {
    return {
      ok: false,
      status: 403,
      code: 'forbidden',
      error: 'Acesso restrito à equipe administrativa autorizada.',
    };
  }

  const sessionTokenHash = sha256Hex(rawToken);
  const mfaVerified = isSessionMfaValid(db, sessionTokenHash);

  if (requireMfa && !mfaVerified) {
    return {
      ok: false,
      status: 403,
      code: 'mfa_required',
      error: 'Verificação em duas etapas (MFA) obrigatória antes de acessar ou alterar dados administrativos.',
    };
  }

  return {
    ok: true,
    user,
    sessionTokenHash,
    mfaVerified,
    isFullAdmin,
  };
}

export function verifyAdminStepUpMfa(
  db: DatabaseSync,
  input: {
    sessionTokenHash: string;
    userId: string;
    code: string;
  },
  env: NodeJS.ProcessEnv = process.env,
): { ok: true; expiresAt: string } | { ok: false; status: 400 | 401 | 503; error: string } {
  const provided = input.code.trim();
  if (!/^\d{6}$/.test(provided)) {
    return { ok: false, status: 400, error: 'Informe um código MFA de 6 dígitos.' };
  }

  const expectedCode = env.ACADEMY_ADMIN_MFA_CODE?.trim() ?? '';
  if (!expectedCode) {
    return {
      ok: false,
      status: 503,
      error:
        'MFA administrativo não configurado neste ambiente (fail-closed): defina ACADEMY_ADMIN_MFA_CODE (ou provedor TOTP/OIDC) no servidor/Key Vault.',
    };
  }

  const expectedBuf = Buffer.from(expectedCode, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return { ok: false, status: 401, error: 'Código MFA inválido.' };
  }

  const expiresAt = new Date(Date.now() + MFA_TTL_HOURS * 3600 * 1000).toISOString();
  db.prepare(
    `INSERT INTO session_mfa (session_token_hash, user_id, method, verified_at, expires_at)
     VALUES (?, ?, 'step_up_code', datetime('now'), ?)
     ON CONFLICT(session_token_hash) DO UPDATE SET verified_at = datetime('now'), expires_at = excluded.expires_at`,
  ).run(input.sessionTokenHash, input.userId, expiresAt);

  recordAuditEvent(db, {
    actorUserId: input.userId,
    actorRole: 'admin',
    action: 'admin.mfa_verified',
    targetType: 'session',
    targetId: input.sessionTokenHash.slice(0, 12),
  });

  return { ok: true, expiresAt };
}

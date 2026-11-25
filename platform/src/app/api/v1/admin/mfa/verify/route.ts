import { NextResponse } from 'next/server';
import { requireAdminSession, verifyAdminStepUpMfa } from '@/lib/admin-auth';
import { checkRateLimit } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const auth = await requireAdminSession({ requireMfa: false });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  if (!checkRateLimit(`admin-mfa:${auth.user.id}`, 8, 60_000)) {
    return NextResponse.json(
      { ok: false, error: 'Muitas tentativas de MFA. Aguarde um minuto.' },
      { status: 429 },
    );
  }

  let body: { code?: unknown };
  try {
    body = (await request.json()) as { code?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const db = getDb();
  const res = verifyAdminStepUpMfa(db, {
    sessionTokenHash: auth.sessionTokenHash,
    userId: auth.user.id,
    code: typeof body.code === 'string' ? body.code : '',
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }

  return NextResponse.json({
    ok: true,
    mfaVerified: true,
    expiresAt: res.expiresAt,
  });
}

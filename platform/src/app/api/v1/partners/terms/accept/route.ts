import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { acceptPartnerTerms } from '@/lib/partners';
import { getPartnerContext } from '@/lib/rbac';

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }
  const db = getDb();
  const ctx = getPartnerContext(db, user.id);
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  let body: { termsVersion?: unknown };
  try {
    body = (await request.json()) as { termsVersion?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const res = acceptPartnerTerms(
    db,
    ctx,
    typeof body.termsVersion === 'string' ? body.termsVersion : '',
  );
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, status: res.status });
}

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { submitPartnerFraudAppeal } from '@/lib/partners';
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

  let body: { flagId?: unknown; appealNote?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const res = submitPartnerFraudAppeal(
    db,
    ctx,
    typeof body.flagId === 'string' ? body.flagId : '',
    typeof body.appealNote === 'string' ? body.appealNote : '',
  );
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true, message: 'Recurso registrado para análise humana.' });
}

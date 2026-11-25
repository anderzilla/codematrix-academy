import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { grantFreeSampleOffer } from '@/lib/entitlements';

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Faça login para ativar a amostra gratuita.' }, { status: 401 });
  }

  let body: { offerCode?: unknown };
  try {
    body = (await request.json()) as { offerCode?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const offerCode = typeof body.offerCode === 'string' ? body.offerCode.trim() : '';
  if (!offerCode) {
    return NextResponse.json({ ok: false, error: 'Informe offerCode.' }, { status: 400 });
  }

  const db = getDb();
  const res = grantFreeSampleOffer(db, user.id, offerCode);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    entitlementId: res.entitlementId,
    created: res.created,
    message: 'Amostra gratuita ativada na sua biblioteca.',
  });
}

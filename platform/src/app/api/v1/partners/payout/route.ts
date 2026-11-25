import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { updatePartnerPayoutProfile } from '@/lib/partners';
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

  let body: { method?: unknown; holderName?: unknown; destinationKey?: unknown };
  try {
    body = (await request.json()) as {
      method?: unknown;
      holderName?: unknown;
      destinationKey?: unknown;
    };
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const res = updatePartnerPayoutProfile(db, ctx, {
    method: typeof body.method === 'string' ? body.method : '',
    holderName: typeof body.holderName === 'string' ? body.holderName : '',
    destinationKey: typeof body.destinationKey === 'string' ? body.destinationKey : '',
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true, maskedSummary: res.maskedSummary });
}

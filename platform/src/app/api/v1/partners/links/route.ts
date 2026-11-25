import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createPartnerLink } from '@/lib/partners';
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

  let body: {
    courseId?: unknown;
    offerSku?: unknown;
    code?: unknown;
    campaign?: unknown;
    maxUses?: unknown;
    validUntil?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const res = createPartnerLink(db, ctx, {
    courseId: typeof body.courseId === 'string' ? body.courseId : '',
    offerSku: typeof body.offerSku === 'string' ? body.offerSku : '',
    code: typeof body.code === 'string' ? body.code : '',
    campaign: typeof body.campaign === 'string' ? body.campaign : 'geral',
    maxUses: typeof body.maxUses === 'number' ? body.maxUses : null,
    validUntil: typeof body.validUntil === 'string' ? body.validUntil : null,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true, id: res.id, code: res.code }, { status: 201 });
}

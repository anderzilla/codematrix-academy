import { NextResponse } from 'next/server';
import { adminPreparePayoutBatch } from '@/lib/admin';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true, requireFullAdmin: true });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  let body: { periodLabel?: unknown; includePendingWarranty?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const db = getDb();
  const res = adminPreparePayoutBatch(db, auth.user.id, {
    periodLabel: typeof body.periodLabel === 'string' ? body.periodLabel : '',
    includePendingWarranty: Boolean(body.includePendingWarranty),
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json(res, { status: 201 });
}

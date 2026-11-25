import { NextResponse } from 'next/server';
import { adminMarkPayoutBatchPaid } from '@/lib/admin';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';

export async function POST(
  request: Request,
  context: { params: Promise<{ batchId: string }> },
) {
  const auth = await requireAdminSession({ requireMfa: true, requireFullAdmin: true });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  let body: { paymentMethod?: unknown; paymentReference?: unknown; receiptRef?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const { batchId } = await context.params;
  const db = getDb();
  const res = adminMarkPayoutBatchPaid(db, auth.user.id, batchId, {
    paymentMethod: typeof body.paymentMethod === 'string' ? body.paymentMethod : '',
    paymentReference: typeof body.paymentReference === 'string' ? body.paymentReference : '',
    receiptRef: typeof body.receiptRef === 'string' ? body.receiptRef : '',
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true, status: 'paid' });
}

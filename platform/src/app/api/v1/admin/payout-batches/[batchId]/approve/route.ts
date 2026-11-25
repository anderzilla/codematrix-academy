import { NextResponse } from 'next/server';
import { adminApprovePayoutBatch } from '@/lib/admin';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';

export async function POST(
  _request: Request,
  context: { params: Promise<{ batchId: string }> },
) {
  const auth = await requireAdminSession({ requireMfa: true, requireFullAdmin: true });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  const { batchId } = await context.params;
  const db = getDb();
  const res = adminApprovePayoutBatch(db, auth.user.id, batchId);

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error },
      { status: res.status },
    );
  }
  return NextResponse.json({ ok: true, status: 'approved' });
}

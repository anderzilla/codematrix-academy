import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';
import { exportLedgerCsv } from '@/lib/ledger';

export async function GET() {
  const auth = await requireAdminSession({ requireMfa: true });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  const db = getDb();
  const csv = exportLedgerCsv(db);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="codematrix-academy-ledger.csv"',
      'cache-control': 'no-store',
    },
  });
}

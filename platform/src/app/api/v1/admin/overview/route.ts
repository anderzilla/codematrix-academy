import { NextResponse } from 'next/server';
import { getAdminOverview } from '@/lib/admin';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';

export async function GET() {
  const auth = await requireAdminSession({ requireMfa: true });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  const db = getDb();
  return NextResponse.json({
    ok: true,
    actor: {
      id: auth.user.id,
      name: auth.user.name,
      isFullAdmin: auth.isFullAdmin,
      mfaVerified: auth.mfaVerified,
    },
    overview: getAdminOverview(db),
  });
}

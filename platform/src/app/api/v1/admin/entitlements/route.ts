import { NextResponse } from 'next/server';
import { adminManageEntitlement } from '@/lib/admin';
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

  let body: {
    action?: unknown;
    userId?: unknown;
    courseId?: unknown;
    offerSku?: unknown;
    accessScope?: unknown;
    reason?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const action = body.action === 'suspend' ? 'suspend' : 'grant';
  const db = getDb();
  const res = adminManageEntitlement(db, auth.user.id, {
    action,
    userId: typeof body.userId === 'string' ? body.userId : '',
    courseId: typeof body.courseId === 'string' ? body.courseId : '',
    offerSku: typeof body.offerSku === 'string' ? body.offerSku : '',
    accessScope: typeof body.accessScope === 'string' ? body.accessScope : '',
    reason: typeof body.reason === 'string' ? body.reason : '',
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true, entitlementId: res.entitlementId ?? null });
}

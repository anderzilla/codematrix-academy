import { NextResponse } from 'next/server';
import { adminBindMediaUid } from '@/lib/admin';
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
    targetType?: unknown;
    code?: unknown;
    streamUid?: unknown;
    retentionDays?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const targetType = body.targetType === 'live_event' ? 'live_event' : 'lesson_asset';
  const db = getDb();
  const res = adminBindMediaUid(db, auth.user.id, {
    targetType,
    code: typeof body.code === 'string' ? body.code : '',
    streamUid: typeof body.streamUid === 'string' ? body.streamUid : '',
    retentionDays: typeof body.retentionDays === 'number' ? body.retentionDays : undefined,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}

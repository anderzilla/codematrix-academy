import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';
import {
  rescheduleOrCancelClassSession,
  scheduleClassSession,
} from '@/lib/school-ops';

export async function POST(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true, requireFullAdmin: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.error }, { status: auth.status });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const res = scheduleClassSession(getDb(), auth.user.id, {
    cohortId: typeof body.cohortId === 'string' ? body.cohortId : '',
    blockId: typeof body.blockId === 'string' ? body.blockId : null,
    lessonId: typeof body.lessonId === 'string' ? body.lessonId : null,
    instructorPartnerId: typeof body.instructorPartnerId === 'string' ? body.instructorPartnerId : null,
    title: typeof body.title === 'string' ? body.title : '',
    description: typeof body.description === 'string' ? body.description : '',
    startsAt: typeof body.startsAt === 'string' ? body.startsAt : '',
    endsAt: typeof body.endsAt === 'string' ? body.endsAt : '',
    timezone: typeof body.timezone === 'string' ? body.timezone : 'America/Sao_Paulo',
    attendanceRequired: Boolean(body.attendanceRequired),
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, code: res.code, error: res.error }, { status: res.status });
  }
  return NextResponse.json(res, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true, requireFullAdmin: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.error }, { status: auth.status });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const action = body.action === 'cancel' ? 'cancel' : 'reschedule';
  const res = rescheduleOrCancelClassSession(
    getDb(),
    auth.user.id,
    typeof body.sessionId === 'string' ? body.sessionId : '',
    {
      action,
      reason: typeof body.reason === 'string' ? body.reason : '',
      newStartsAt: typeof body.newStartsAt === 'string' ? body.newStartsAt : undefined,
      newEndsAt: typeof body.newEndsAt === 'string' ? body.newEndsAt : undefined,
    },
  );
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  return NextResponse.json(res);
}

import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';
import {
  createCohort,
  enrollStudentInCohort,
  listCohorts,
  transferStudentCohort,
} from '@/lib/school-ops';

export async function GET(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.error }, { status: auth.status });
  }
  const url = new URL(request.url);
  const courseId = url.searchParams.get('courseId') || undefined;
  return NextResponse.json({ ok: true, cohorts: listCohorts(getDb(), { courseId }) });
}

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

  const db = getDb();
  const action = typeof body.action === 'string' ? body.action : 'create_cohort';

  if (action === 'enroll') {
    const res = enrollStudentInCohort(db, auth.user.id, {
      cohortId: typeof body.cohortId === 'string' ? body.cohortId : '',
      userId: typeof body.userId === 'string' ? body.userId : '',
      origin: typeof body.origin === 'string' ? body.origin : undefined,
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    return NextResponse.json(res, { status: 201 });
  }

  if (action === 'transfer') {
    const res = transferStudentCohort(db, auth.user.id, {
      userId: typeof body.userId === 'string' ? body.userId : '',
      fromCohortId: typeof body.fromCohortId === 'string' ? body.fromCohortId : '',
      toCohortId: typeof body.toCohortId === 'string' ? body.toCohortId : '',
      reason: typeof body.reason === 'string' ? body.reason : '',
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    return NextResponse.json(res);
  }

  const res = createCohort(db, auth.user.id, {
    courseId: typeof body.courseId === 'string' ? body.courseId : '',
    courseVersionId: typeof body.courseVersionId === 'string' ? body.courseVersionId : null,
    code: typeof body.code === 'string' ? body.code : '',
    name: typeof body.name === 'string' ? body.name : '',
    status: (typeof body.status === 'string' ? body.status : 'active') as 'planned' | 'active' | 'completed' | 'archived',
    timezone: typeof body.timezone === 'string' ? body.timezone : 'America/Sao_Paulo',
    currentBlockCode: typeof body.currentBlockCode === 'string' ? body.currentBlockCode : null,
    startsAt: typeof body.startsAt === 'string' ? body.startsAt : null,
    endsAt: typeof body.endsAt === 'string' ? body.endsAt : null,
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  return NextResponse.json(res, { status: 201 });
}

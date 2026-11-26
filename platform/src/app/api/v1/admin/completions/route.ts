import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';
import { recordModuleCompletion } from '@/lib/school-ops';

export async function POST(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.error }, { status: auth.status });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const res = recordModuleCompletion(getDb(), {
    userId: typeof body.userId === 'string' ? body.userId : '',
    courseId: typeof body.courseId === 'string' ? body.courseId : '',
    moduleId: typeof body.moduleId === 'string' ? body.moduleId : '',
    cohortId: typeof body.cohortId === 'string' ? body.cohortId : null,
    courseVersionId: typeof body.courseVersionId === 'string' ? body.courseVersionId : null,
    evidence:
      body.evidence && typeof body.evidence === 'object'
        ? (body.evidence as Record<string, unknown>)
        : { source: 'admin_verified' },
    actor: auth.user.id,
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  return NextResponse.json(res, { status: 201 });
}

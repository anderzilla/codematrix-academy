import { NextResponse } from 'next/server';
import {
  assignPartnerToCourse,
  getAdminCourseDetail,
  updatePartnerAssignmentStatus,
} from '@/lib/admin-courses';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';
import type { PartnerRole } from '@/lib/rbac';

export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  const auth = await requireAdminSession({ requireMfa: true });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  const { courseId } = await context.params;
  const detail = getAdminCourseDetail(getDb(), courseId);
  if (!detail) {
    return NextResponse.json({ ok: false, error: 'Curso não encontrado.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, assignments: detail.partnerAssignments });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  const auth = await requireAdminSession({ requireMfa: true, requireFullAdmin: true });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  const { courseId } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const res = assignPartnerToCourse(getDb(), auth.user.id, {
    partnerId: typeof body.partnerId === 'string' ? body.partnerId : '',
    courseId,
    role: (typeof body.role === 'string' ? body.role : '') as PartnerRole,
    commissionRuleId: typeof body.commissionRuleId === 'string' ? body.commissionRuleId : null,
    validFrom: typeof body.validFrom === 'string' ? body.validFrom : null,
    validUntil: typeof body.validUntil === 'string' ? body.validUntil : null,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json(res, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true, requireFullAdmin: true });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const status = typeof body.status === 'string' ? body.status : '';
  if (!['active', 'suspended', 'revoked'].includes(status)) {
    return NextResponse.json({ ok: false, error: 'Status inválido.' }, { status: 400 });
  }

  const res = updatePartnerAssignmentStatus(
    getDb(),
    auth.user.id,
    typeof body.assignmentId === 'string' ? body.assignmentId : '',
    {
      status: status as 'active' | 'suspended' | 'revoked',
      reason: typeof body.reason === 'string' ? body.reason : '',
    },
  );

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json(res);
}

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { updateInstructorAssignmentChecklist } from '@/lib/partners';
import { getPartnerContext } from '@/lib/rbac';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }
  const db = getDb();
  const ctx = getPartnerContext(db, user.id);
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  let body: {
    recordingStatus?: unknown;
    checklist?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const validStatuses = new Set(['pending', 'in_progress', 'recorded', 'published']);
  const recordingStatus =
    typeof body.recordingStatus === 'string' && validStatuses.has(body.recordingStatus)
      ? (body.recordingStatus as 'pending' | 'in_progress' | 'recorded' | 'published')
      : undefined;

  const { assignmentId } = await context.params;
  const res = updateInstructorAssignmentChecklist(db, ctx, assignmentId, {
    recordingStatus,
    checklist: Array.isArray(body.checklist)
      ? (body.checklist as Array<{ label: string; done: boolean }>)
      : undefined,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}

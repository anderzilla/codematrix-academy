import { NextResponse } from 'next/server';
import {
  duplicateAdminCourse,
  getAdminCourseDetail,
  publishNewCourseVersion,
  updateAdminCourse,
  type CourseStatus,
} from '@/lib/admin-courses';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';

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
  return NextResponse.json({ ok: true, ...detail });
}

export async function PATCH(
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

  const db = getDb();
  const action = typeof body.action === 'string' ? body.action : 'update';

  if (action === 'duplicate') {
    const res = duplicateAdminCourse(db, auth.user.id, courseId, {
      newTitle: typeof body.newTitle === 'string' ? body.newTitle : '',
      newSlug: typeof body.newSlug === 'string' ? body.newSlug : '',
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    }
    return NextResponse.json(res, { status: 201 });
  }

  if (action === 'publish_version') {
    const res = publishNewCourseVersion(db, auth.user.id, courseId, {
      versionTag: typeof body.versionTag === 'string' ? body.versionTag : '',
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    }
    return NextResponse.json(res, { status: 201 });
  }

  const res = updateAdminCourse(db, auth.user.id, courseId, {
    title: typeof body.title === 'string' ? body.title : undefined,
    slug: typeof body.slug === 'string' ? body.slug : undefined,
    subtitle: typeof body.subtitle === 'string' ? body.subtitle : undefined,
    summary: typeof body.summary === 'string' ? body.summary : undefined,
    category: typeof body.category === 'string' ? body.category : undefined,
    status: typeof body.status === 'string' ? (body.status as CourseStatus) : undefined,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json(res);
}

export async function DELETE(
  _request: Request,
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
  const db = getDb();
  const hasHistory =
    db.prepare(`SELECT 1 FROM entitlements WHERE course_id = ? LIMIT 1`).get(courseId) ||
    db.prepare(`SELECT 1 FROM orders WHERE course_id = ? LIMIT 1`).get(courseId) ||
    db.prepare(`SELECT 1 FROM financial_ledger WHERE course_id = ? LIMIT 1`).get(courseId);

  if (hasHistory) {
    return NextResponse.json(
      {
        ok: false,
        code: 'cannot_delete_with_history',
        error:
          'Cursos vendidos ou com histórico nunca podem ser excluídos fisicamente. Altere o status para "archived".',
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      code: 'archive_required',
      error: 'Por segurança de auditoria, utilize arquivamento (PATCH status: "archived") em vez de exclusão física.',
    },
    { status: 409 },
  );
}

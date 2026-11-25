import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getProtectedLessonContent } from '@/lib/student';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; lessonCode: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }

  const { slug, lessonCode } = await context.params;
  const db = getDb();
  const res = getProtectedLessonContent(db, user.id, slug, lessonCode);
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error },
      { status: res.status },
    );
  }

  return NextResponse.json(res);
}

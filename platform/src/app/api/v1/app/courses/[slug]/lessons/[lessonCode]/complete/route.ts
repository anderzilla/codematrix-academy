import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { completeLessonForUser } from '@/lib/student';

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string; lessonCode: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }

  const { slug, lessonCode } = await context.params;
  const db = getDb();
  const res = completeLessonForUser(db, user.id, slug, lessonCode);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }

  return NextResponse.json({
    ok: true,
    lessonId: res.lessonId,
    blockCode: res.blockCode,
    message: 'Aula concluída e registrada no seu progresso.',
  });
}

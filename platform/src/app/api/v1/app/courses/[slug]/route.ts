import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getStudentCourseRoom } from '@/lib/student';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }

  const { slug } = await context.params;
  const db = getDb();
  const room = getStudentCourseRoom(db, user.id, slug);
  if (!room) {
    return NextResponse.json({ ok: false, error: 'Curso não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, course: room });
}

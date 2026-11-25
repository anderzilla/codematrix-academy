import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createNoSqlStore } from '@/lib/persistence/nosql';
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
  const access = getProtectedLessonContent(db, user.id, slug, lessonCode);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  const nosql = createNoSqlStore();
  const docs = await nosql.listByPartition('student_notes', user.id);
  const prefix = `${slug}:${lessonCode.toUpperCase()}:`;
  const notes: Record<number, string> = {};
  for (const doc of docs) {
    if (doc.id.startsWith(prefix)) {
      const slideIndex = Number(doc.payload.slideIndex);
      if (Number.isInteger(slideIndex) && typeof doc.payload.text === 'string') {
        notes[slideIndex] = doc.payload.text;
      }
    }
  }

  return NextResponse.json({ ok: true, driver: nosql.driver, notes });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; lessonCode: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }

  const { slug, lessonCode } = await context.params;
  const db = getDb();
  const access = getProtectedLessonContent(db, user.id, slug, lessonCode);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  let body: { slideIndex?: unknown; text?: unknown };
  try {
    body = (await request.json()) as { slideIndex?: unknown; text?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const slideIndex = Number(body.slideIndex);
  const text = typeof body.text === 'string' ? body.text.slice(0, 2000) : '';
  if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 50) {
    return NextResponse.json({ ok: false, error: 'Índice de tela inválido.' }, { status: 400 });
  }

  const nosql = createNoSqlStore();
  await nosql.upsert('student_notes', {
    id: `${slug}:${lessonCode.toUpperCase()}:slide-${slideIndex}`,
    partitionKey: user.id,
    kind: 'pare_e_anote',
    payload: {
      courseSlug: slug,
      lessonCode: lessonCode.toUpperCase(),
      slideIndex,
      text,
    },
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, driver: nosql.driver, saved: true });
}

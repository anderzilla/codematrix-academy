import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { submitBlockQuizAttempt } from '@/lib/student';

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; blockCode: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }

  let body: { attemptId?: unknown; answers?: unknown };
  try {
    body = (await request.json()) as { attemptId?: unknown; answers?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const attemptId = typeof body.attemptId === 'string' ? body.attemptId.trim() : '';
  const answers = Array.isArray(body.answers) ? body.answers.map(Number) : [];
  if (!attemptId) {
    return NextResponse.json({ ok: false, error: 'Informe attemptId.' }, { status: 400 });
  }

  const { slug, blockCode } = await context.params;
  const db = getDb();
  const res = submitBlockQuizAttempt(db, user.id, slug, blockCode, attemptId, answers);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }

  return NextResponse.json(res);
}

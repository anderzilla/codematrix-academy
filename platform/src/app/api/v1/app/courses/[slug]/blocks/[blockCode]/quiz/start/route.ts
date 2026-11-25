import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { startBlockQuizAttempt } from '@/lib/student';

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string; blockCode: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }

  const { slug, blockCode } = await context.params;
  const db = getDb();
  const res = startBlockQuizAttempt(db, user.id, slug, blockCode);
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error },
      { status: res.status },
    );
  }

  return NextResponse.json(res);
}

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listAuthorizedLivesForUser } from '@/lib/lives';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }

  const db = getDb();
  const lives = listAuthorizedLivesForUser(db, user.id);
  return NextResponse.json({ ok: true, lives });
}

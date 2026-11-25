import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { revokeSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (raw) {
    const db = getDb();
    revokeSessionToken(db, raw);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

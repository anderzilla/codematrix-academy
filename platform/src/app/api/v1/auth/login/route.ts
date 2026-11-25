import { NextResponse } from 'next/server';
import {
  authenticateUser,
  checkRateLimit,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  if (!checkRateLimit(`login:${ip}`, 20, 60_000)) {
    return NextResponse.json(
      { ok: false, error: 'Muitas tentativas de login. Aguarde um minuto.' },
      { status: 429 },
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const db = getDb();
  const res = authenticateUser(db, {
    email: typeof body.email === 'string' ? body.email : '',
    password: typeof body.password === 'string' ? body.password : '',
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error },
      { status: res.status },
    );
  }

  const response = NextResponse.json({
    ok: true,
    user: {
      id: res.user.id,
      name: res.user.name,
      email: res.user.email,
      roles: res.user.roles,
    },
  });
  response.cookies.set(
    SESSION_COOKIE_NAME,
    res.sessionToken,
    getSessionCookieOptions(res.expiresAt),
  );
  return response;
}

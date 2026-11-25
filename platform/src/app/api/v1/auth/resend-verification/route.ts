import { NextResponse } from 'next/server';
import { checkRateLimit, resendVerificationEmail } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  if (!checkRateLimit(`resend:${ip}`, 5, 60_000)) {
    return NextResponse.json(
      { ok: false, error: 'Aguarde um minuto antes de solicitar outro reenvio.' },
      { status: 429 },
    );
  }

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  if (typeof body.email === 'string' && body.email.trim()) {
    const db = getDb();
    resendVerificationEmail(db, body.email);
  }

  return NextResponse.json({
    ok: true,
    message:
      'Se existir uma conta pendente de confirmação para este e-mail, enviamos um novo código.',
  });
}

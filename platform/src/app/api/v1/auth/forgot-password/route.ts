import { NextResponse } from 'next/server';
import { checkRateLimit, requestPasswordRecovery } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  if (!checkRateLimit(`forgot:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { ok: false, error: 'Muitas solicitações. Aguarde um minuto.' },
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
    requestPasswordRecovery(db, body.email);
  }

  // Resposta sempre genérica para não revelar existência da conta
  return NextResponse.json({
    ok: true,
    message:
      'Se o e-mail estiver cadastrado e ativo, enviamos instruções para redefinir sua senha.',
  });
}

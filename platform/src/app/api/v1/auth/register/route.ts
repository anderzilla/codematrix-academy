import { NextResponse } from 'next/server';
import { checkRateLimit, isDevMailboxEnabled, registerStudent } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  if (!checkRateLimit(`register:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { ok: false, error: 'Muitas tentativas. Aguarde um minuto antes de tentar novamente.' },
      { status: 429 },
    );
  }

  let body: { name?: unknown; email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { name?: unknown; email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const db = getDb();
  const res = registerStudent(db, {
    name: typeof body.name === 'string' ? body.name : '',
    email: typeof body.email === 'string' ? body.email : '',
    password: typeof body.password === 'string' ? body.password : '',
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }

  return NextResponse.json(
    {
      ok: true,
      message:
        'Conta criada. Verifique seu e-mail para ativar o acesso à Área do Aluno.',
      devMailboxHint: isDevMailboxEnabled(),
    },
    { status: 201 },
  );
}

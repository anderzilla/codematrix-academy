import { NextResponse } from 'next/server';
import { verifyEmailWithToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token : '';
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Informe o código de verificação recebido por e-mail.' },
      { status: 400 },
    );
  }

  const db = getDb();
  const res = verifyEmailWithToken(db, token);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    claimedEntitlements: res.claimedEntitlements,
    message: 'E-mail confirmado com sucesso. Você já pode entrar na Área do Aluno.',
  });
}

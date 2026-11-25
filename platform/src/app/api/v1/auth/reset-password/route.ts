import { NextResponse } from 'next/server';
import { resetPasswordWithToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  let body: { token?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { token?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const db = getDb();
  const res = resetPasswordWithToken(
    db,
    typeof body.token === 'string' ? body.token : '',
    typeof body.password === 'string' ? body.password : '',
  );

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Senha redefinida com sucesso. Faça login com a nova senha.',
  });
}

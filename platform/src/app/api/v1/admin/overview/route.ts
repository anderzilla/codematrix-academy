import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { isAdminOrOps } from '@/lib/rbac';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }
  if (!isAdminOrOps(user)) {
    return NextResponse.json(
      { ok: false, error: 'Acesso restrito à equipe administrativa.' },
      { status: 403 },
    );
  }
  return NextResponse.json({ ok: true, stage: 4, message: 'Painel admin será expandido na Etapa 4.' });
}

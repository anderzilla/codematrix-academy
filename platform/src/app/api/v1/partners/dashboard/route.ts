import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPartnerDashboard } from '@/lib/partners';
import { getPartnerContext } from '@/lib/rbac';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }

  const db = getDb();
  const ctx = getPartnerContext(db, user.id);
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: 'Acesso restrito a parceiros autorizados.' },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    dashboard: getPartnerDashboard(db, ctx),
  });
}

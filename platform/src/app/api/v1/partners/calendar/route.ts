import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getFinancialCalendarView, listCalendarEventsForPartner } from '@/lib/calendar';
import { getDb } from '@/lib/db';
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

  const events = listCalendarEventsForPartner(db, ctx);
  // Parceiro vê exclusivamente a previsão/status das suas próprias comissões (nunca de terceiros)
  const ownCommissions = getFinancialCalendarView(db, { partnerId: ctx.partnerId }).commissionEvents;

  return NextResponse.json({
    ok: true,
    timezone: 'America/Sao_Paulo',
    partnerId: ctx.partnerId,
    events,
    ownCommissions,
  });
}

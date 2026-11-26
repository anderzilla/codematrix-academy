import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { listCalendarEventsForStudent } from '@/lib/calendar';
import { getDb } from '@/lib/db';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    timezone: 'America/Sao_Paulo',
    events: listCalendarEventsForStudent(getDb(), user.id),
  });
}

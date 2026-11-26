import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import {
  createCalendarEvent,
  getFinancialCalendarView,
  listCalendarEventsForAdmin,
  updateCalendarEvent,
  type CalendarAudienceScope,
  type CalendarEventType,
} from '@/lib/calendar';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.error }, { status: auth.status });
  }
  const url = new URL(request.url);
  const view = url.searchParams.get('view');
  const courseId = url.searchParams.get('courseId') || undefined;
  const db = getDb();

  if (view === 'financial') {
    const partnerId = url.searchParams.get('partnerId') || undefined;
    return NextResponse.json({
      ok: true,
      financialCalendar: getFinancialCalendarView(db, { courseId, partnerId }),
    });
  }

  return NextResponse.json({
    ok: true,
    events: listCalendarEventsForAdmin(db, {
      courseId,
      cohortId: url.searchParams.get('cohortId') || undefined,
      eventType: url.searchParams.get('eventType') || undefined,
      status: url.searchParams.get('status') || undefined,
    }),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true, requireFullAdmin: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.error }, { status: auth.status });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const res = createCalendarEvent(getDb(), auth.user.id, {
    eventType: (typeof body.eventType === 'string' ? body.eventType : 'general_event') as CalendarEventType,
    title: typeof body.title === 'string' ? body.title : '',
    description: typeof body.description === 'string' ? body.description : '',
    startsAt: typeof body.startsAt === 'string' ? body.startsAt : '',
    endsAt: typeof body.endsAt === 'string' ? body.endsAt : '',
    timezone: typeof body.timezone === 'string' ? body.timezone : 'America/Sao_Paulo',
    audienceScope: (typeof body.audienceScope === 'string' ? body.audienceScope : 'course') as CalendarAudienceScope,
    courseId: typeof body.courseId === 'string' ? body.courseId : null,
    cohortId: typeof body.cohortId === 'string' ? body.cohortId : null,
    partnerId: typeof body.partnerId === 'string' ? body.partnerId : null,
    targetUserId: typeof body.targetUserId === 'string' ? body.targetUserId : null,
    financialEntryId: typeof body.financialEntryId === 'string' ? body.financialEntryId : null,
    recurrenceWeeklyCount: typeof body.recurrenceWeeklyCount === 'number' ? body.recurrenceWeeklyCount : 1,
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, code: res.code, error: res.error }, { status: res.status });
  }
  return NextResponse.json(res, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true, requireFullAdmin: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.error }, { status: auth.status });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const res = updateCalendarEvent(
    getDb(),
    auth.user.id,
    typeof body.eventId === 'string' ? body.eventId : '',
    {
      action: body.action === 'cancel' ? 'cancel' : 'reschedule',
      scope: body.scope === 'all_series' ? 'all_series' : 'this_occurrence',
      reason: typeof body.reason === 'string' ? body.reason : '',
      startsAt: typeof body.startsAt === 'string' ? body.startsAt : undefined,
      endsAt: typeof body.endsAt === 'string' ? body.endsAt : undefined,
    },
  );
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  return NextResponse.json(res);
}

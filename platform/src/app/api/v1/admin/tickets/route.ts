import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import {
  adminRespondTicket,
  listAdminTickets,
  type TicketStatus,
} from '@/lib/communications';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.error }, { status: auth.status });
  }
  const url = new URL(request.url);
  const tickets = listAdminTickets(getDb(), {
    courseId: url.searchParams.get('courseId') || undefined,
    status: url.searchParams.get('status') || undefined,
    priority: url.searchParams.get('priority') || undefined,
  });
  return NextResponse.json({ ok: true, tickets });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.error }, { status: auth.status });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const res = adminRespondTicket(
    getDb(),
    auth.user.id,
    typeof body.ticketId === 'string' ? body.ticketId : '',
    {
      body: typeof body.body === 'string' ? body.body : undefined,
      isInternalNote: Boolean(body.isInternalNote),
      status: typeof body.status === 'string' ? (body.status as TicketStatus) : undefined,
      assignedToUserId:
        typeof body.assignedToUserId === 'string' ? body.assignedToUserId : undefined,
    },
  );
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  return NextResponse.json(res);
}

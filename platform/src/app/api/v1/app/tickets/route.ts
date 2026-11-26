import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import {
  createSupportTicket,
  getTicketThreadForStudent,
  listStudentTickets,
  type TicketCategory,
  type TicketPriority,
} from '@/lib/communications';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }
  const url = new URL(request.url);
  const ticketId = url.searchParams.get('ticketId');
  const db = getDb();

  if (ticketId) {
    const thread = getTicketThreadForStudent(db, user.id, ticketId);
    if (!thread) {
      return NextResponse.json({ ok: false, error: 'Chamado não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...thread });
  }

  return NextResponse.json({ ok: true, tickets: listStudentTickets(db, user.id) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const res = createSupportTicket(getDb(), user.id, {
    category: (typeof body.category === 'string' ? body.category : 'academic') as TicketCategory,
    subject: typeof body.subject === 'string' ? body.subject : '',
    description: typeof body.description === 'string' ? body.description : '',
    priority: (typeof body.priority === 'string' ? body.priority : 'normal') as TicketPriority,
    courseId: typeof body.courseId === 'string' ? body.courseId : null,
    cohortId: typeof body.cohortId === 'string' ? body.cohortId : null,
    blockId: typeof body.blockId === 'string' ? body.blockId : null,
    lessonId: typeof body.lessonId === 'string' ? body.lessonId : null,
    orderId: typeof body.orderId === 'string' ? body.orderId : null,
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  return NextResponse.json(res, { status: 201 });
}

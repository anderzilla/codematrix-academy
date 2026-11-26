import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import {
  listStudentInbox,
  markInboxMessageStatus,
  updateCommunicationPreferences,
} from '@/lib/communications';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }
  const url = new URL(request.url);
  const inbox = listStudentInbox(getDb(), user.id, {
    category: url.searchParams.get('category') || undefined,
    courseId: url.searchParams.get('courseId') || undefined,
    status: url.searchParams.get('status') || undefined,
  });
  return NextResponse.json({ ok: true, ...inbox });
}

export async function PATCH(request: Request) {
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

  const db = getDb();
  if (typeof body.marketingOptIn === 'boolean') {
    updateCommunicationPreferences(db, user.id, { marketingOptIn: body.marketingOptIn });
    return NextResponse.json({ ok: true, marketingOptIn: body.marketingOptIn });
  }

  const deliveryId = typeof body.deliveryId === 'string' ? body.deliveryId : '';
  const status = typeof body.status === 'string' ? body.status : '';
  if (!deliveryId || !['read', 'archived', 'unread'].includes(status)) {
    return NextResponse.json({ ok: false, error: 'Informe deliveryId e status válidos.' }, { status: 400 });
  }

  const updated = markInboxMessageStatus(
    db,
    user.id,
    deliveryId,
    status as 'read' | 'archived' | 'unread',
  );
  if (!updated) {
    return NextResponse.json({ ok: false, error: 'Mensagem não encontrada.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, deliveryId, status });
}

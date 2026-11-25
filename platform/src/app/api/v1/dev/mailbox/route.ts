import { NextResponse } from 'next/server';
import { isDevMailboxEnabled } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  // Estritamente isolado para ambiente de desenvolvimento/teste; falha fechado (404) em produção
  if (!isDevMailboxEnabled()) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim().toLowerCase();

  const db = getDb();
  const rows = email
    ? db
        .prepare(
          `SELECT id, recipient_email, purpose, subject, token_preview, action_url, created_at
           FROM dev_mailbox
           WHERE recipient_email = ?
           ORDER BY created_at DESC
           LIMIT 20`,
        )
        .all(email)
    : db
        .prepare(
          `SELECT id, recipient_email, purpose, subject, token_preview, action_url, created_at
           FROM dev_mailbox
           ORDER BY created_at DESC
           LIMIT 20`,
        )
        .all();

  return NextResponse.json({ ok: true, devOnly: true, messages: rows });
}

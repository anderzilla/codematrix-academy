import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  let body: { courseId?: unknown; targetScope?: unknown; email?: unknown; name?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const user = await getSessionUser();
  const email = (
    typeof body.email === 'string' && body.email.trim() ? body.email : user?.email || ''
  )
    .trim()
    .toLowerCase();
  const name = (typeof body.name === 'string' ? body.name : user?.name || '').trim().slice(0, 120);
  const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
  const targetScope = typeof body.targetScope === 'string' ? body.targetScope.trim().slice(0, 80) : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !courseId || !targetScope) {
    return NextResponse.json(
      { ok: false, error: 'Informe um e-mail válido para entrar na lista de aviso.' },
      { status: 400 },
    );
  }

  const db = getDb();
  db.prepare(
    `INSERT INTO waitlist_leads (id, course_id, target_scope, email, name)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(course_id, target_scope, email) DO UPDATE SET name = excluded.name`,
  ).run(`wl_${crypto.randomUUID().replace(/-/g, '')}`, courseId, targetScope, email, name);

  return NextResponse.json({
    ok: true,
    message: 'Seu interesse foi registrado! Avisaremos por e-mail assim que abrir.',
  });
}

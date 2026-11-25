import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { recordAuditEvent } from '@/lib/audit';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true, requireFullAdmin: true });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  let body: {
    title?: unknown;
    slug?: unknown;
    subtitle?: unknown;
    summary?: unknown;
    category?: unknown;
    status?: unknown;
    offerPriceCents?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const slug = (typeof body.slug === 'string' ? body.slug : title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (title.length < 3 || slug.length < 3) {
    return NextResponse.json({ ok: false, error: 'Informe um título válido para o curso.' }, { status: 400 });
  }

  const status = body.status === 'published' ? 'published' : 'draft';
  const db = getDb();
  const courseId = `course_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  try {
    db.prepare(
      `INSERT INTO courses (id, tenant_id, slug, title, subtitle, summary, category, language, status)
       VALUES (?, 'tenant_codematrix', ?, ?, ?, ?, ?, 'pt-BR', ?)`,
    ).run(
      courseId,
      slug,
      title,
      typeof body.subtitle === 'string' ? body.subtitle.trim() : '',
      typeof body.summary === 'string' ? body.summary.trim() : '',
      typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Inteligência Artificial Aplicada',
      status,
    );

    const priceCents =
      typeof body.offerPriceCents === 'number' && body.offerPriceCents > 0
        ? Math.round(body.offerPriceCents)
        : null;
    if (priceCents) {
      const sku = `CM-${slug.toUpperCase().slice(0, 16)}-FULL`;
      db.prepare(
        `INSERT INTO offers (id, course_id, sku, offer_code, title, description, access_scope, is_free, price_cents, currency, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'BRL', ?)`,
      ).run(
        `ofr_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        courseId,
        sku,
        `${slug}-completo`,
        `${title} — Acesso completo`,
        'Acesso completo ao curso via checkout próprio CodeMatrix Academy (Pix, cartão, Google Pay e Apple Pay).',
        `course:${slug}:full`,
        priceCents,
        status,
      );
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'Já existe um curso com este slug.' }, { status: 409 });
  }

  recordAuditEvent(db, {
    actorUserId: auth.user.id,
    actorRole: 'admin',
    action: 'admin.course_created',
    targetType: 'course',
    targetId: courseId,
    metadata: { slug, status },
  });

  return NextResponse.json({ ok: true, courseId, slug, status }, { status: 201 });
}

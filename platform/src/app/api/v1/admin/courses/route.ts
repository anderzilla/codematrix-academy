import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { listAdminCourses, normalizeSlug } from '@/lib/admin-courses';
import { requireAdminSession } from '@/lib/admin-auth';
import { recordAuditEvent } from '@/lib/audit';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  const q = url.searchParams.get('q') || undefined;

  return NextResponse.json({
    ok: true,
    courses: listAdminCourses(getDb(), { status, q }),
  });
}

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
  const slug = normalizeSlug(typeof body.slug === 'string' && body.slug.trim() ? body.slug : title);

  if (title.length < 3 || slug.length < 3) {
    return NextResponse.json({ ok: false, error: 'Informe um título e slug válidos para o curso.' }, { status: 400 });
  }

  const allowedStatuses = new Set(['draft', 'review', 'published', 'archived']);
  const status =
    typeof body.status === 'string' && allowedStatuses.has(body.status) ? body.status : 'draft';
  const db = getDb();
  const courseId = `course_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const versionId = `ver_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO courses (id, tenant_id, slug, title, subtitle, summary, category, language, status, active_version_id)
       VALUES (?, 'tenant_codematrix', ?, ?, ?, ?, ?, 'pt-BR', ?, ?)`,
    ).run(
      courseId,
      slug,
      title,
      typeof body.subtitle === 'string' ? body.subtitle.trim() : '',
      typeof body.summary === 'string' ? body.summary.trim() : '',
      typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Inteligência Artificial Aplicada',
      status,
      versionId,
    );

    db.prepare(
      `INSERT INTO course_versions (id, course_id, version_tag, status, notes)
       VALUES (?, ?, 'v1.0', ?, 'Versão inicial criada via painel administrativo')`,
    ).run(versionId, courseId, status === 'published' ? 'published' : 'draft');

    const priceCents =
      typeof body.offerPriceCents === 'number' && body.offerPriceCents > 0
        ? Math.round(body.offerPriceCents)
        : null;
    if (priceCents) {
      const offerId = `ofr_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const sku = `CM-${slug.toUpperCase().slice(0, 16)}-FULL`;
      const scope = `course:${slug}:full`;
      db.prepare(
        `INSERT INTO offers (id, course_id, sku, offer_code, title, description, access_scope, is_free, price_cents, currency, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'BRL', ?)`,
      ).run(
        offerId,
        courseId,
        sku,
        `${slug}-completo`,
        `${title} — Acesso completo`,
        'Acesso completo ao curso via checkout próprio CodeMatrix Academy (Pix, cartão, Google Pay e Apple Pay).',
        scope,
        priceCents,
        status === 'published' ? 'published' : 'draft',
      );
      db.prepare(
        `INSERT INTO offer_grants (id, offer_id, course_id, course_version_id, grant_type, target_code, access_scope)
         VALUES (?, ?, ?, ?, 'course', 'full', ?)`,
      ).run(`og_${offerId}`, offerId, courseId, versionId, scope);
    }

    recordAuditEvent(db, {
      actorUserId: auth.user.id,
      actorRole: 'admin',
      action: 'admin.course_created',
      targetType: 'course',
      targetId: courseId,
      metadata: { slug, status, versionId, offerPriceCents: priceCents },
    });

    db.exec('COMMIT');
    return NextResponse.json({ ok: true, courseId, versionId, slug, status }, { status: 201 });
  } catch (err) {
    db.exec('ROLLBACK');
    const msg = err instanceof Error ? err.message : 'Erro ao criar curso.';
    const isConflict = msg.includes('UNIQUE');
    return NextResponse.json(
      { ok: false, error: isConflict ? `Já existe um curso com o slug "${slug}".` : msg },
      { status: isConflict ? 409 : 500 },
    );
  }
}

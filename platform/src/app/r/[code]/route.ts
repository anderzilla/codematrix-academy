import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const cleanCode = code.trim().toLowerCase();
  const db = getDb();

  const link = db
    .prepare(
      `SELECT pl.id, pl.code, pl.offer_sku, pl.valid_until, pl.status,
              c.slug AS course_slug, o.offer_code
       FROM partner_links pl
       INNER JOIN courses c ON c.id = pl.course_id
       LEFT JOIN offers o ON o.sku = pl.offer_sku AND o.status = 'published'
       WHERE pl.code = ? AND pl.status = 'active'`,
    )
    .get(cleanCode) as
    | {
        id: string;
        code: string;
        offer_sku: string;
        valid_until: string | null;
        status: string;
        course_slug: string;
        offer_code: string | null;
      }
    | undefined;

  const baseUrl = new URL(request.url).origin;
  if (!link || (link.valid_until && new Date(link.valid_until).getTime() <= Date.now())) {
    return NextResponse.redirect(`${baseUrl}/cursos`);
  }

  db.prepare(`UPDATE partner_links SET clicks_count = clicks_count + 1 WHERE id = ?`).run(link.id);

  const destination = link.offer_code
    ? `${baseUrl}/oferta/${encodeURIComponent(link.offer_code)}?ref=${encodeURIComponent(link.code)}`
    : `${baseUrl}/cursos/${encodeURIComponent(link.course_slug)}?ref=${encodeURIComponent(link.code)}`;

  const res = NextResponse.redirect(destination);
  res.cookies.set('cm_partner_ref', link.code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

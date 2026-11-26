import { NextResponse } from 'next/server';
import { listPartnerCoursesForAdmin } from '@/lib/admin-courses';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';

export async function GET(
  _request: Request,
  context: { params: Promise<{ partnerId: string }> },
) {
  const auth = await requireAdminSession({ requireMfa: true });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  const { partnerId } = await context.params;
  const data = listPartnerCoursesForAdmin(getDb(), partnerId);
  if (!data) {
    return NextResponse.json({ ok: false, error: 'Parceiro não encontrado.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...data });
}

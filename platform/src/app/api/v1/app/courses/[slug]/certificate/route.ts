import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { issueStudentCertificate } from '@/lib/certificates';
import { getDb } from '@/lib/db';

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }

  const { slug } = await context.params;
  const db = getDb();
  const res = issueStudentCertificate(db, {
    userId: user.id,
    userName: user.name,
    courseSlug: slug,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }

  return NextResponse.json({
    ok: true,
    created: res.created,
    certificate: res.certificate,
  });
}

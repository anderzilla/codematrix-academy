import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { listStudentCertificates } from '@/lib/certificates';
import { getDb } from '@/lib/db';
import { listAuthorizedLivesForUser } from '@/lib/lives';
import { getStudentLibrary } from '@/lib/student';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 });
  }

  const db = getDb();
  const courses = getStudentLibrary(db, user.id);
  const lives = listAuthorizedLivesForUser(db, user.id);
  const certificates = listStudentCertificates(db, user.id);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email },
    courses,
    lives,
    certificates,
  });
}

import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';
import { listAdminStudents } from '@/lib/school-ops';

export async function GET(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.error }, { status: auth.status });
  }
  const url = new URL(request.url);
  const students = listAdminStudents(getDb(), {
    q: url.searchParams.get('q') || undefined,
    courseId: url.searchParams.get('courseId') || undefined,
    cohortId: url.searchParams.get('cohortId') || undefined,
    hasOpenTickets: url.searchParams.get('hasOpenTickets') === '1',
  });
  return NextResponse.json({ ok: true, students });
}

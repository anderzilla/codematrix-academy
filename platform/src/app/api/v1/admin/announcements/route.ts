import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import {
  createAndDispatchAnnouncement,
  type AnnouncementCategory,
  type AudienceType,
} from '@/lib/communications';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const auth = await requireAdminSession({ requireMfa: true, requireFullAdmin: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.error }, { status: auth.status });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const res = createAndDispatchAnnouncement(getDb(), auth.user.id, {
    category: (typeof body.category === 'string' ? body.category : 'course_live') as AnnouncementCategory,
    urgency: (typeof body.urgency === 'string' ? body.urgency : 'normal') as 'low' | 'normal' | 'high' | 'critical',
    title: typeof body.title === 'string' ? body.title : '',
    body: typeof body.body === 'string' ? body.body : '',
    actionUrl: typeof body.actionUrl === 'string' ? body.actionUrl : null,
    audienceType: (typeof body.audienceType === 'string' ? body.audienceType : 'all_students') as AudienceType,
    courseId: typeof body.courseId === 'string' ? body.courseId : null,
    cohortId: typeof body.cohortId === 'string' ? body.cohortId : null,
    sessionId: typeof body.sessionId === 'string' ? body.sessionId : null,
    targetUserId: typeof body.targetUserId === 'string' ? body.targetUserId : null,
    validUntil: typeof body.validUntil === 'string' ? body.validUntil : null,
    previewOnly: Boolean(body.previewOnly),
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  return NextResponse.json(res, { status: res.previewOnly ? 200 : 201 });
}

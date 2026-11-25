import type { DatabaseSync } from 'node:sqlite';
import { listUserActiveEntitlements, scopeGrantsCourse } from '@/lib/entitlements';

export interface StudentLiveItem {
  id: string;
  code: string;
  courseSlug: string;
  courseTitle: string;
  title: string;
  description: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'scheduled' | 'live' | 'replay_available' | 'ended';
  retentionDays: number;
  hasPlaybackReady: boolean;
}

export function listAuthorizedLivesForUser(
  db: DatabaseSync,
  userId: string,
): StudentLiveItem[] {
  const entitlements = listUserActiveEntitlements(db, userId);
  if (entitlements.length === 0) return [];

  const rows = db
    .prepare(
      `SELECT le.id, le.code, le.course_id, le.title, le.description, le.scheduled_at,
              le.duration_minutes, le.status, le.access_scope, le.live_input_uid,
              le.replay_stream_uid, le.retention_days,
              c.slug AS course_slug, c.title AS course_title
       FROM live_events le
       INNER JOIN courses c ON c.id = le.course_id
       WHERE c.status = 'published'
       ORDER BY le.scheduled_at ASC`,
    )
    .all() as Array<Record<string, unknown>>;

  return rows
    .filter((row) => {
      const courseId = String(row.course_id);
      const courseSlug = String(row.course_slug);
      const accessScope = String(row.access_scope);
      return entitlements.some(
        (e) =>
          e.courseId === courseId &&
          (e.accessScope === accessScope || scopeGrantsCourse(e.accessScope, courseSlug)),
      );
    })
    .map((row) => {
      const status = row.status as StudentLiveItem['status'];
      const hasPlaybackReady =
        (status === 'live' && Boolean(row.live_input_uid)) ||
        (status === 'replay_available' && Boolean(row.replay_stream_uid));

      return {
        id: String(row.id),
        code: String(row.code),
        courseSlug: String(row.course_slug),
        courseTitle: String(row.course_title),
        title: String(row.title),
        description: String(row.description),
        scheduledAt: String(row.scheduled_at),
        durationMinutes: Number(row.duration_minutes),
        status,
        retentionDays: Number(row.retention_days),
        hasPlaybackReady,
      };
    });
}

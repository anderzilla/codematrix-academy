import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export function recordAuditEvent(
  db: DatabaseSync,
  input: {
    actorUserId?: string | null;
    actorRole: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  },
): string {
  const id = `aud_${crypto.randomUUID().replace(/-/g, '')}`;
  db.prepare(
    `INSERT INTO audit_events (id, actor_user_id, actor_role, action, target_type, target_id, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.actorUserId ?? null,
    input.actorRole,
    input.action,
    input.targetType,
    input.targetId,
    JSON.stringify(input.metadata ?? {}),
  );
  return id;
}

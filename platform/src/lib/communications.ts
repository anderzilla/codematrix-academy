import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { recordAuditEvent } from '@/lib/audit';

export type TicketCategory = 'academic' | 'technical' | 'billing' | 'certificate' | 'other';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketStatus =
  | 'new'
  | 'triage'
  | 'in_progress'
  | 'waiting_student'
  | 'waiting_third_party'
  | 'resolved'
  | 'closed';

export type AnnouncementCategory =
  | 'maintenance'
  | 'course_live'
  | 'billing_operational'
  | 'security'
  | 'marketing_offer';

export type AudienceType = 'all_students' | 'course' | 'cohort' | 'session' | 'user';

export function createSupportTicket(
  db: DatabaseSync,
  userId: string,
  input: {
    category: TicketCategory;
    subject: string;
    description: string;
    priority?: TicketPriority;
    courseId?: string | null;
    cohortId?: string | null;
    blockId?: string | null;
    lessonId?: string | null;
    orderId?: string | null;
  },
): { ok: true; ticketId: string; ticketCode: string } | { ok: false; status: number; error: string } {
  const subject = input.subject.trim();
  const description = input.description.trim();
  if (subject.length < 4 || description.length < 10) {
    return {
      ok: false,
      status: 400,
      error: 'Informe um assunto (mínimo 4 caracteres) e descrição detalhada (mínimo 10 caracteres).',
    };
  }

  // Anti-spam simples: máximo 5 tickets abertos nas últimas 24h por usuário
  const recentCount = Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM support_tickets
           WHERE user_id = ? AND created_at >= datetime('now', '-1 day')`,
        )
        .get(userId) as { c: number }
    ).c,
  );
  if (recentCount >= 5) {
    return {
      ok: false,
      status: 429,
      error: 'Limite diário de abertura de chamados atingido. Aguarde atendimento nos chamados abertos.',
    };
  }

  const ticketId = `tkt_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const ticketCode = `SUP-${Date.now().toString(36).toUpperCase().slice(-5)}-${crypto
    .randomBytes(2)
    .toString('hex')
    .toUpperCase()}`;
  const slaDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO support_tickets (
         id, ticket_code, user_id, course_id, cohort_id, block_id, lesson_id, order_id,
         category, subject, description, priority, status, sla_due_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
    ).run(
      ticketId,
      ticketCode,
      userId,
      input.courseId ?? null,
      input.cohortId ?? null,
      input.blockId ?? null,
      input.lessonId ?? null,
      input.orderId ?? null,
      input.category,
      subject,
      description,
      input.priority ?? 'normal',
      slaDueAt,
    );

    db.prepare(
      `INSERT INTO ticket_messages (id, ticket_id, author_user_id, author_role, body, is_internal_note)
       VALUES (?, ?, ?, 'student', ?, 0)`,
    ).run(`tmsg_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`, ticketId, userId, description);

    recordAuditEvent(db, {
      actorUserId: userId,
      actorRole: 'student',
      action: 'student.ticket_created',
      targetType: 'support_ticket',
      targetId: ticketId,
      metadata: { ticketCode, category: input.category, courseId: input.courseId ?? null },
    });
    db.exec('COMMIT');
    return { ok: true, ticketId, ticketCode };
  } catch (err) {
    db.exec('ROLLBACK');
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Erro ao abrir chamado.',
    };
  }
}

export function listStudentTickets(db: DatabaseSync, userId: string) {
  return db
    .prepare(
      `SELECT t.id, t.ticket_code, t.course_id, t.cohort_id, t.category, t.subject,
              t.priority, t.status, t.sla_due_at, t.resolved_at, t.created_at, t.updated_at,
              c.title AS course_title
       FROM support_tickets t
       LEFT JOIN courses c ON c.id = t.course_id
       WHERE t.user_id = ?
       ORDER BY t.updated_at DESC`,
    )
    .all(userId);
}

export function getTicketThreadForStudent(db: DatabaseSync, userId: string, ticketId: string) {
  const ticket = db
    .prepare(`SELECT * FROM support_tickets WHERE id = ? AND user_id = ?`)
    .get(ticketId, userId);
  if (!ticket) return null;

  // Regra crítica: NUNCA expor is_internal_note = 1 ao aluno!
  const messages = db
    .prepare(
      `SELECT id, author_role, body, created_at
       FROM ticket_messages
       WHERE ticket_id = ? AND is_internal_note = 0
       ORDER BY created_at ASC`,
    )
    .all(ticketId);

  return { ticket, messages };
}

export function listAdminTickets(
  db: DatabaseSync,
  filter?: { courseId?: string; status?: string; priority?: string },
) {
  const where: string[] = ['1=1'];
  const params: string[] = [];
  if (filter?.courseId) {
    where.push('t.course_id = ?');
    params.push(filter.courseId);
  }
  if (filter?.status) {
    where.push('t.status = ?');
    params.push(filter.status);
  }
  if (filter?.priority) {
    where.push('t.priority = ?');
    params.push(filter.priority);
  }

  return db
    .prepare(
      `SELECT t.*, u.name AS student_name, u.email AS student_email, c.title AS course_title
       FROM support_tickets t
       INNER JOIN users u ON u.id = t.user_id
       LEFT JOIN courses c ON c.id = t.course_id
       WHERE ${where.join(' AND ')}
       ORDER BY t.updated_at DESC
       LIMIT 100`,
    )
    .all(...params);
}

export function adminRespondTicket(
  db: DatabaseSync,
  actorUserId: string,
  ticketId: string,
  input: {
    body?: string;
    isInternalNote?: boolean;
    status?: TicketStatus;
    assignedToUserId?: string | null;
  },
): { ok: true } | { ok: false; status: number; error: string } {
  const ticket = db
    .prepare(`SELECT id, ticket_code, user_id, course_id, subject FROM support_tickets WHERE id = ?`)
    .get(ticketId) as
    | { id: string; ticket_code: string; user_id: string; course_id: string | null; subject: string }
    | undefined;
  if (!ticket) {
    return { ok: false, status: 404, error: 'Chamado não encontrado.' };
  }

  db.exec('BEGIN');
  try {
    if (input.body?.trim()) {
      db.prepare(
        `INSERT INTO ticket_messages (id, ticket_id, author_user_id, author_role, body, is_internal_note)
         VALUES (?, ?, ?, 'admin', ?, ?)`,
      ).run(
        `tmsg_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        ticketId,
        actorUserId,
        input.body.trim(),
        input.isInternalNote ? 1 : 0,
      );
    }

    if (input.status || input.assignedToUserId !== undefined) {
      db.prepare(
        `UPDATE support_tickets
         SET status = COALESCE(?, status),
             assigned_to_user_id = COALESCE(?, assigned_to_user_id),
             resolved_at = CASE WHEN ? IN ('resolved', 'closed') THEN datetime('now') ELSE resolved_at END,
             updated_at = datetime('now')
         WHERE id = ?`,
      ).run(
        input.status ?? null,
        input.assignedToUserId ?? null,
        input.status ?? null,
        ticketId,
      );
    }

    // Se houver resposta pública ao aluno (não nota interna), entrega aviso no inbox do aluno
    if (input.body?.trim() && !input.isInternalNote) {
      const annId = `ann_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      db.prepare(
        `INSERT INTO announcements (
           id, category, urgency, title, body, action_url, audience_type, course_id, target_user_id, created_by
         ) VALUES (?, 'course_live', 'normal', ?, ?, '/app/suporte', 'user', ?, ?, ?)`,
      ).run(
        annId,
        `Nova resposta no chamado ${ticket.ticket_code}`,
        `Sua solicitação "${ticket.subject}" recebeu uma resposta da equipe.`,
        ticket.course_id,
        ticket.user_id,
        actorUserId,
      );
      db.prepare(
        `INSERT OR IGNORE INTO announcement_deliveries (id, announcement_id, user_id, dedup_key, status)
         VALUES (?, ?, ?, ?, 'unread')`,
      ).run(
        `adel_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        annId,
        ticket.user_id,
        `ticket_reply:${ticketId}:${Date.now()}`,
      );
    }

    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: input.isInternalNote ? 'admin.ticket_internal_note_added' : 'admin.ticket_updated',
      targetType: 'support_ticket',
      targetId: ticketId,
      metadata: {
        status: input.status ?? null,
        isInternalNote: Boolean(input.isInternalNote),
      },
    });
    db.exec('COMMIT');
    return { ok: true };
  } catch (err) {
    db.exec('ROLLBACK');
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Erro ao atualizar chamado.',
    };
  }
}

export function resolveAnnouncementRecipients(
  db: DatabaseSync,
  input: {
    category: AnnouncementCategory;
    audienceType: AudienceType;
    courseId?: string | null;
    cohortId?: string | null;
    sessionId?: string | null;
    targetUserId?: string | null;
  },
): string[] {
  let userIds: string[] = [];

  if (input.audienceType === 'user' && input.targetUserId) {
    userIds = [input.targetUserId];
  } else if (input.audienceType === 'cohort' && input.cohortId) {
    userIds = (
      db
        .prepare(`SELECT DISTINCT user_id FROM cohort_memberships WHERE cohort_id = ? AND status = 'active'`)
        .all(input.cohortId) as Array<{ user_id: string }>
    ).map((r) => r.user_id);
  } else if (input.audienceType === 'session' && input.sessionId) {
    userIds = (
      db
        .prepare(
          `SELECT DISTINCT cm.user_id
           FROM class_sessions cs
           INNER JOIN cohort_memberships cm ON cm.cohort_id = cs.cohort_id AND cm.status = 'active'
           WHERE cs.id = ?`,
        )
        .all(input.sessionId) as Array<{ user_id: string }>
    ).map((r) => r.user_id);
  } else if (input.audienceType === 'course' && input.courseId) {
    userIds = (
      db
        .prepare(`SELECT DISTINCT user_id FROM entitlements WHERE course_id = ? AND status = 'active' AND user_id IS NOT NULL`)
        .all(input.courseId) as Array<{ user_id: string }>
    ).map((r) => r.user_id);
  } else if (input.audienceType === 'all_students') {
    userIds = (
      db.prepare(`SELECT id AS user_id FROM users WHERE status = 'active'`).all() as Array<{
        user_id: string;
      }>
    ).map((r) => r.user_id);
  }

  // Avisos promocionais/marketing respeitam estritamente marketing_opt_in = 1
  if (input.category === 'marketing_offer' && userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(', ');
    const optedIn = db
      .prepare(
        `SELECT user_id FROM user_communication_preferences
         WHERE user_id IN (${placeholders}) AND marketing_opt_in = 1`,
      )
      .all(...userIds) as Array<{ user_id: string }>;
    return optedIn.map((r) => r.user_id);
  }

  return userIds;
}

export function createAndDispatchAnnouncement(
  db: DatabaseSync,
  actorUserId: string,
  input: {
    category: AnnouncementCategory;
    urgency?: 'low' | 'normal' | 'high' | 'critical';
    title: string;
    body: string;
    actionUrl?: string | null;
    audienceType: AudienceType;
    courseId?: string | null;
    cohortId?: string | null;
    sessionId?: string | null;
    targetUserId?: string | null;
    validUntil?: string | null;
    previewOnly?: boolean;
  },
):
  | { ok: true; announcementId: string | null; recipientsCount: number; previewOnly: boolean }
  | { ok: false; status: number; error: string } {
  if (input.title.trim().length < 3 || input.body.trim().length < 5) {
    return { ok: false, status: 400, error: 'Informe título e conteúdo do aviso.' };
  }

  const recipients = resolveAnnouncementRecipients(db, input);
  if (input.previewOnly) {
    return { ok: true, announcementId: null, recipientsCount: recipients.length, previewOnly: true };
  }

  const annId = `ann_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO announcements (
         id, category, urgency, title, body, action_url, audience_type,
         course_id, cohort_id, session_id, target_user_id, valid_until, snapshot_json, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      annId,
      input.category,
      input.urgency ?? 'normal',
      input.title.trim(),
      input.body.trim(),
      input.actionUrl?.trim() || null,
      input.audienceType,
      input.courseId ?? null,
      input.cohortId ?? null,
      input.sessionId ?? null,
      input.targetUserId ?? null,
      input.validUntil ?? null,
      JSON.stringify({ recipientsCount: recipients.length, category: input.category }),
      actorUserId,
    );

    const ins = db.prepare(
      `INSERT OR IGNORE INTO announcement_deliveries (id, announcement_id, user_id, dedup_key, status)
       VALUES (?, ?, ?, ?, 'unread')`,
    );
    let delivered = 0;
    for (const uid of recipients) {
      const r = ins.run(
        `adel_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        annId,
        uid,
        `ann:${annId}:${uid}`,
      );
      if (r.changes > 0) delivered += 1;
    }

    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: 'admin.announcement_dispatched',
      targetType: 'announcement',
      targetId: annId,
      metadata: {
        category: input.category,
        audienceType: input.audienceType,
        recipientsCount: delivered,
      },
    });
    db.exec('COMMIT');
    return { ok: true, announcementId: annId, recipientsCount: delivered, previewOnly: false };
  } catch (err) {
    db.exec('ROLLBACK');
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Erro ao enviar aviso.',
    };
  }
}

export function listStudentInbox(
  db: DatabaseSync,
  userId: string,
  filter?: { category?: string; courseId?: string; status?: string },
) {
  const where: string[] = ['d.user_id = ?'];
  const params: string[] = [userId];
  if (filter?.category) {
    where.push('a.category = ?');
    params.push(filter.category);
  }
  if (filter?.courseId) {
    where.push('a.course_id = ?');
    params.push(filter.courseId);
  }
  if (filter?.status) {
    where.push('d.status = ?');
    params.push(filter.status);
  }

  const messages = db
    .prepare(
      `SELECT d.id AS delivery_id, d.status AS delivery_status, d.delivered_at, d.read_at, d.archived_at,
              a.id AS announcement_id, a.category, a.urgency, a.title, a.body, a.action_url,
              a.course_id, a.cohort_id, c.title AS course_title
       FROM announcement_deliveries d
       INNER JOIN announcements a ON a.id = d.announcement_id
       LEFT JOIN courses c ON c.id = a.course_id
       WHERE ${where.join(' AND ')}
       ORDER BY d.delivered_at DESC
       LIMIT 100`,
    )
    .all(...params);

  const unreadCount = Number(
    (
      db
        .prepare(`SELECT COUNT(*) AS c FROM announcement_deliveries WHERE user_id = ? AND status = 'unread'`)
        .get(userId) as { c: number }
    ).c,
  );

  const prefs = (db
    .prepare(`SELECT operational_enabled, marketing_opt_in FROM user_communication_preferences WHERE user_id = ?`)
    .get(userId) as { operational_enabled: number; marketing_opt_in: number } | undefined) ?? {
    operational_enabled: 1,
    marketing_opt_in: 0,
  };

  return {
    unreadCount,
    preferences: {
      operationalEnabled: Number(prefs.operational_enabled) === 1,
      marketingOptIn: Number(prefs.marketing_opt_in) === 1,
    },
    messages,
  };
}

export function markInboxMessageStatus(
  db: DatabaseSync,
  userId: string,
  deliveryId: string,
  status: 'read' | 'archived' | 'unread',
): boolean {
  const res = db
    .prepare(
      `UPDATE announcement_deliveries
       SET status = ?,
           read_at = CASE WHEN ? = 'read' THEN COALESCE(read_at, datetime('now')) ELSE read_at END,
           archived_at = CASE WHEN ? = 'archived' THEN datetime('now') ELSE archived_at END
       WHERE id = ? AND user_id = ?`,
    )
    .run(status, status, status, deliveryId, userId);
  return res.changes > 0;
}

export function updateCommunicationPreferences(
  db: DatabaseSync,
  userId: string,
  input: { marketingOptIn: boolean },
): void {
  db.prepare(
    `INSERT INTO user_communication_preferences (user_id, operational_enabled, marketing_opt_in, updated_at)
     VALUES (?, 1, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       marketing_opt_in = excluded.marketing_opt_in,
       updated_at = datetime('now')`,
  ).run(userId, input.marketingOptIn ? 1 : 0);
}

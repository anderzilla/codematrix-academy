import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { recordAuditEvent } from '@/lib/audit';

export function createCohort(
  db: DatabaseSync,
  actorUserId: string,
  input: {
    courseId: string;
    courseVersionId?: string | null;
    code: string;
    name: string;
    status?: 'planned' | 'active' | 'completed' | 'archived';
    timezone?: string;
    currentBlockCode?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
  },
): { ok: true; cohortId: string } | { ok: false; status: number; error: string } {
  const course = db
    .prepare(`SELECT id, active_version_id FROM courses WHERE id = ?`)
    .get(input.courseId) as { id: string; active_version_id: string | null } | undefined;
  if (!course) {
    return { ok: false, status: 404, error: 'Curso não encontrado.' };
  }
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (code.length < 2 || name.length < 3) {
    return { ok: false, status: 400, error: 'Informe código e nome válidos para a turma.' };
  }

  const versionId = input.courseVersionId || course.active_version_id || null;
  const cohortId = `coh_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  try {
    db.prepare(
      `INSERT INTO cohorts (
         id, course_id, course_version_id, code, name, status, timezone,
         current_block_code, starts_at, ends_at, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      cohortId,
      input.courseId,
      versionId,
      code,
      name,
      input.status ?? 'active',
      input.timezone?.trim() || 'America/Sao_Paulo',
      input.currentBlockCode?.trim() || null,
      input.startsAt ?? null,
      input.endsAt ?? null,
      actorUserId,
    );

    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: 'admin.cohort_created',
      targetType: 'cohort',
      targetId: cohortId,
      metadata: { courseId: input.courseId, versionId, code, name },
    });

    return { ok: true, cohortId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar turma.';
    const isConflict = msg.includes('UNIQUE');
    return {
      ok: false,
      status: isConflict ? 409 : 500,
      error: isConflict ? `Já existe uma turma com código "${code}" neste curso.` : msg,
    };
  }
}

export function listCohorts(db: DatabaseSync, filter?: { courseId?: string }) {
  const where = filter?.courseId ? 'WHERE c.course_id = ?' : '';
  const params = filter?.courseId ? [filter.courseId] : [];
  return db
    .prepare(
      `SELECT c.*, crs.slug AS course_slug, crs.title AS course_title,
              (SELECT COUNT(*) FROM cohort_memberships cm WHERE cm.cohort_id = c.id AND cm.status = 'active') AS active_students_count,
              (SELECT COUNT(*) FROM class_sessions cs WHERE cs.cohort_id = c.id AND cs.status != 'canceled') AS sessions_count
       FROM cohorts c
       INNER JOIN courses crs ON crs.id = c.course_id
       ${where}
       ORDER BY c.created_at DESC`,
    )
    .all(...params);
}

export function enrollStudentInCohort(
  db: DatabaseSync,
  actorUserId: string,
  input: { cohortId: string; userId: string; origin?: string },
): { ok: true; membershipId: string } | { ok: false; status: number; error: string } {
  const cohort = db
    .prepare(`SELECT id, course_id, course_version_id FROM cohorts WHERE id = ?`)
    .get(input.cohortId) as
    | { id: string; course_id: string; course_version_id: string | null }
    | undefined;
  const user = db.prepare(`SELECT id FROM users WHERE id = ?`).get(input.userId);
  if (!cohort || !user) {
    return { ok: false, status: 404, error: 'Turma ou aluno não encontrado.' };
  }

  const membershipId = `cmem_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  db.prepare(
    `INSERT INTO cohort_memberships (
       id, cohort_id, course_id, course_version_id, user_id, status, origin
     ) VALUES (?, ?, ?, ?, ?, 'active', ?)
     ON CONFLICT(cohort_id, user_id) DO UPDATE SET
       status = 'active',
       updated_at = datetime('now')`,
  ).run(
    membershipId,
    cohort.id,
    cohort.course_id,
    cohort.course_version_id,
    input.userId,
    input.origin ?? 'admin_enrollment',
  );

  recordAuditEvent(db, {
    actorUserId,
    actorRole: 'admin',
    action: 'admin.student_enrolled_cohort',
    targetType: 'cohort_membership',
    targetId: membershipId,
    metadata: { cohortId: cohort.id, courseId: cohort.course_id, userId: input.userId },
  });

  return { ok: true, membershipId };
}

export function transferStudentCohort(
  db: DatabaseSync,
  actorUserId: string,
  input: {
    userId: string;
    fromCohortId: string;
    toCohortId: string;
    reason: string;
  },
): { ok: true; newMembershipId: string; progressPreserved: true } | { ok: false; status: number; error: string } {
  if (input.reason.trim().length < 5) {
    return { ok: false, status: 400, error: 'Informe um motivo para a transferência de turma.' };
  }
  const fromC = db
    .prepare(`SELECT id, course_id, course_version_id FROM cohorts WHERE id = ?`)
    .get(input.fromCohortId) as
    | { id: string; course_id: string; course_version_id: string | null }
    | undefined;
  const toC = db
    .prepare(`SELECT id, course_id, course_version_id FROM cohorts WHERE id = ?`)
    .get(input.toCohortId) as
    | { id: string; course_id: string; course_version_id: string | null }
    | undefined;

  if (!fromC || !toC) {
    return { ok: false, status: 404, error: 'Turma de origem ou destino não encontrada.' };
  }
  if (fromC.course_id !== toC.course_id) {
    return {
      ok: false,
      status: 400,
      error: 'Transferência só é permitida entre turmas do mesmo curso.',
    };
  }

  const newMembershipId = `cmem_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  db.exec('BEGIN');
  try {
    // Marca matrícula antiga como 'transferred' sem apagar histórico ou progresso
    db.prepare(
      `UPDATE cohort_memberships
       SET status = 'transferred', transfer_note = ?, updated_at = datetime('now')
       WHERE cohort_id = ? AND user_id = ?`,
    ).run(input.reason.trim(), fromC.id, input.userId);

    db.prepare(
      `INSERT INTO cohort_memberships (
         id, cohort_id, course_id, course_version_id, user_id, status, origin,
         transferred_from_cohort_id, transfer_note
       ) VALUES (?, ?, ?, ?, ?, 'active', 'cohort_transfer', ?, ?)
       ON CONFLICT(cohort_id, user_id) DO UPDATE SET
         status = 'active',
         transferred_from_cohort_id = excluded.transferred_from_cohort_id,
         transfer_note = excluded.transfer_note,
         updated_at = datetime('now')`,
    ).run(
      newMembershipId,
      toC.id,
      toC.course_id,
      toC.course_version_id,
      input.userId,
      fromC.id,
      input.reason.trim(),
    );

    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: 'admin.student_cohort_transferred',
      targetType: 'user',
      targetId: input.userId,
      metadata: {
        fromCohortId: fromC.id,
        toCohortId: toC.id,
        courseId: toC.course_id,
        reason: input.reason.trim(),
        progressPreserved: true,
      },
    });
    db.exec('COMMIT');
    return { ok: true, newMembershipId, progressPreserved: true };
  } catch (err) {
    db.exec('ROLLBACK');
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Erro ao transferir aluno de turma.',
    };
  }
}

export function scheduleClassSession(
  db: DatabaseSync,
  actorUserId: string,
  input: {
    cohortId: string;
    blockId?: string | null;
    lessonId?: string | null;
    instructorPartnerId?: string | null;
    title: string;
    description?: string;
    startsAt: string;
    endsAt: string;
    timezone?: string;
    attendanceRequired?: boolean;
  },
):
  | { ok: true; sessionId: string; calendarEventId: string }
  | { ok: false; status: number; code?: string; error: string } {
  const cohort = db
    .prepare(`SELECT id, course_id, course_version_id, timezone FROM cohorts WHERE id = ?`)
    .get(input.cohortId) as
    | { id: string; course_id: string; course_version_id: string | null; timezone: string }
    | undefined;
  if (!cohort) {
    return { ok: false, status: 404, error: 'Turma não encontrada.' };
  }

  const startMs = Date.parse(input.startsAt);
  const endMs = Date.parse(input.endsAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return { ok: false, status: 400, error: 'Datas de início e fim inválidas para a sessão.' };
  }

  // Regra: professor responsável só pode ser atribuído se tiver vínculo ativo no mesmo curso!
  if (input.instructorPartnerId) {
    const assigned = db
      .prepare(
        `SELECT 1 FROM course_partner_assignments
         WHERE partner_id = ? AND course_id = ? AND role = 'instructor' AND status = 'active'
         LIMIT 1`,
      )
      .get(input.instructorPartnerId, cohort.course_id);
    if (!assigned) {
      return {
        ok: false,
        status: 403,
        code: 'instructor_not_assigned_to_course',
        error: 'Este professor não possui vínculo ativo atribuído a este curso.',
      };
    }

    // Checagem de conflito de horário do professor
    const conflict = db
      .prepare(
        `SELECT id, title FROM class_sessions
         WHERE instructor_partner_id = ? AND status IN ('scheduled', 'live', 'rescheduled')
           AND starts_at < ? AND ends_at > ?
         LIMIT 1`,
      )
      .get(input.instructorPartnerId, input.endsAt, input.startsAt) as
      | { id: string; title: string }
      | undefined;
    if (conflict) {
      return {
        ok: false,
        status: 409,
        code: 'schedule_conflict',
        error: `Conflito de horário para o professor com a sessão "${conflict.title}".`,
      };
    }
  }

  // Checagem de conflito na mesma turma
  const cohortConflict = db
    .prepare(
      `SELECT id, title FROM class_sessions
       WHERE cohort_id = ? AND status IN ('scheduled', 'live', 'rescheduled')
         AND starts_at < ? AND ends_at > ?
       LIMIT 1`,
    )
    .get(cohort.id, input.endsAt, input.startsAt) as { id: string; title: string } | undefined;
  if (cohortConflict) {
    return {
      ok: false,
      status: 409,
      code: 'schedule_conflict',
      error: `Conflito de horário na turma com a sessão "${cohortConflict.title}".`,
    };
  }

  const sessionId = `cses_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const calendarEventId = `cevt_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const tz = input.timezone?.trim() || cohort.timezone || 'America/Sao_Paulo';

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO class_sessions (
         id, course_id, course_version_id, cohort_id, block_id, lesson_id,
         instructor_partner_id, title, description, starts_at, ends_at, timezone,
         status, attendance_required, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)`,
    ).run(
      sessionId,
      cohort.course_id,
      cohort.course_version_id,
      cohort.id,
      input.blockId ?? null,
      input.lessonId ?? null,
      input.instructorPartnerId ?? null,
      input.title.trim(),
      input.description?.trim() || '',
      input.startsAt,
      input.endsAt,
      tz,
      input.attendanceRequired ? 1 : 0,
      actorUserId,
    );

    // Sincroniza no motor compartilhado de calendário (fonte única da verdade)
    db.prepare(
      `INSERT INTO calendar_events (
         id, event_type, title, description, starts_at, ends_at, timezone, status,
         audience_scope, course_id, cohort_id, partner_id,
         source_entity_type, source_entity_id, created_by
       ) VALUES (?, 'class_live', ?, ?, ?, ?, ?, 'scheduled', 'cohort', ?, ?, ?, 'class_session', ?, ?)`,
    ).run(
      calendarEventId,
      input.title.trim(),
      input.description?.trim() || '',
      input.startsAt,
      input.endsAt,
      tz,
      cohort.course_id,
      cohort.id,
      input.instructorPartnerId ?? null,
      sessionId,
      actorUserId,
    );

    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: 'admin.class_session_scheduled',
      targetType: 'class_session',
      targetId: sessionId,
      metadata: {
        cohortId: cohort.id,
        courseId: cohort.course_id,
        instructorPartnerId: input.instructorPartnerId ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
    });
    db.exec('COMMIT');
    return { ok: true, sessionId, calendarEventId };
  } catch (err) {
    db.exec('ROLLBACK');
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Erro ao agendar sessão.',
    };
  }
}

export function rescheduleOrCancelClassSession(
  db: DatabaseSync,
  actorUserId: string,
  sessionId: string,
  input: {
    action: 'reschedule' | 'cancel';
    reason: string;
    newStartsAt?: string;
    newEndsAt?: string;
  },
): { ok: true; notifiedUsersCount: number } | { ok: false; status: number; error: string } {
  if (input.reason.trim().length < 5) {
    return { ok: false, status: 400, error: 'Informe um motivo detalhado (mínimo 5 caracteres).' };
  }

  const session = db
    .prepare(`SELECT * FROM class_sessions WHERE id = ?`)
    .get(sessionId) as Record<string, unknown> | undefined;
  if (!session) {
    return { ok: false, status: 404, error: 'Sessão não encontrada.' };
  }

  if (input.action === 'reschedule') {
    if (!input.newStartsAt || !input.newEndsAt || Date.parse(input.newEndsAt) <= Date.parse(input.newStartsAt)) {
      return { ok: false, status: 400, error: 'Informe nova data de início e fim válidas.' };
    }
  }

  db.exec('BEGIN');
  try {
    if (input.action === 'cancel') {
      db.prepare(
        `UPDATE class_sessions
         SET status = 'canceled', cancel_reason = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).run(input.reason.trim(), sessionId);

      db.prepare(
        `UPDATE calendar_events
         SET status = 'canceled', updated_at = datetime('now')
         WHERE source_entity_type = 'class_session' AND source_entity_id = ?`,
      ).run(sessionId);
    } else {
      db.prepare(
        `UPDATE class_sessions
         SET status = 'rescheduled', starts_at = ?, ends_at = ?, cancel_reason = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).run(input.newStartsAt!, input.newEndsAt!, input.reason.trim(), sessionId);

      db.prepare(
        `UPDATE calendar_events
         SET status = 'rescheduled', starts_at = ?, ends_at = ?, updated_at = datetime('now')
         WHERE source_entity_type = 'class_session' AND source_entity_id = ?`,
      ).run(input.newStartsAt!, input.newEndsAt!, sessionId);
    }

    // Notifica apenas alunos ativos da turma afetada (deduplicado)
    const members = db
      .prepare(`SELECT user_id FROM cohort_memberships WHERE cohort_id = ? AND status = 'active'`)
      .all(String(session.cohort_id)) as Array<{ user_id: string }>;

    const annId = `ann_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const title =
      input.action === 'cancel'
        ? `Sessão cancelada: ${String(session.title)}`
        : `Sessão reagendada: ${String(session.title)}`;
    const body =
      input.action === 'cancel'
        ? `A sessão foi cancelada. Motivo: ${input.reason.trim()}`
        : `Novo horário: ${input.newStartsAt}. Motivo: ${input.reason.trim()}`;

    db.prepare(
      `INSERT INTO announcements (
         id, category, urgency, title, body, audience_type, course_id, cohort_id, session_id, created_by
       ) VALUES (?, 'course_live', 'high', ?, ?, 'cohort', ?, ?, ?, ?)`,
    ).run(annId, title, body, String(session.course_id), String(session.cohort_id), sessionId, actorUserId);

    const insertDel = db.prepare(
      `INSERT OR IGNORE INTO announcement_deliveries (id, announcement_id, user_id, dedup_key, status)
       VALUES (?, ?, ?, ?, 'unread')`,
    );
    let notified = 0;
    for (const m of members) {
      const dedupKey = `session:${sessionId}:${input.action}:${input.newStartsAt || 'cancel'}:${m.user_id}`;
      const r = insertDel.run(
        `adel_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        annId,
        m.user_id,
        dedupKey,
      );
      if (r.changes > 0) notified += 1;
    }

    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: input.action === 'cancel' ? 'admin.class_session_canceled' : 'admin.class_session_rescheduled',
      targetType: 'class_session',
      targetId: sessionId,
      metadata: {
        cohortId: String(session.cohort_id),
        reason: input.reason.trim(),
        newStartsAt: input.newStartsAt ?? null,
        notifiedUsersCount: notified,
      },
    });
    db.exec('COMMIT');
    return { ok: true, notifiedUsersCount: notified };
  } catch (err) {
    db.exec('ROLLBACK');
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Erro ao atualizar sessão.',
    };
  }
}

export function recordModuleCompletion(
  db: DatabaseSync,
  input: {
    userId: string;
    courseId: string;
    moduleId: string;
    cohortId?: string | null;
    courseVersionId?: string | null;
    evidence: Record<string, unknown>;
    actor: string;
  },
): { ok: true; completionId: string; eligibleForCourseCertificate: boolean } | { ok: false; status: number; error: string } {
  const mod = db
    .prepare(`SELECT id, course_id, version_id FROM modules WHERE id = ? AND course_id = ?`)
    .get(input.moduleId, input.courseId) as
    | { id: string; course_id: string; version_id: string }
    | undefined;
  if (!mod) {
    return { ok: false, status: 404, error: 'Módulo não pertence ao curso informado.' };
  }

  const versionId = input.courseVersionId || mod.version_id;
  const completionId = `mcomp_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  db.prepare(
    `INSERT INTO module_completions (
       id, user_id, course_id, course_version_id, cohort_id, module_id, evidence_json, actor
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, module_id, course_version_id) DO UPDATE SET
       evidence_json = excluded.evidence_json`,
  ).run(
    completionId,
    input.userId,
    input.courseId,
    versionId,
    input.cohortId ?? null,
    input.moduleId,
    JSON.stringify(input.evidence),
    input.actor,
  );

  // Verifica se TODOS os módulos publicados da versão do curso foram concluídos
  const totalRequired = Number(
    (
      db
        .prepare(`SELECT COUNT(*) AS c FROM modules WHERE course_id = ? AND version_id = ? AND status = 'published'`)
        .get(input.courseId, versionId) as { c: number }
    ).c,
  );
  const completedRequired = Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM module_completions
           WHERE user_id = ? AND course_id = ? AND course_version_id = ?`,
        )
        .get(input.userId, input.courseId, versionId) as { c: number }
    ).c,
  );

  return {
    ok: true,
    completionId,
    eligibleForCourseCertificate: totalRequired > 0 && completedRequired >= totalRequired,
  };
}

export function listAdminStudents(
  db: DatabaseSync,
  filter?: { q?: string; courseId?: string; cohortId?: string; hasOpenTickets?: boolean },
) {
  const where: string[] = ['1=1'];
  const params: string[] = [];

  if (filter?.q?.trim()) {
    const q = `%${filter.q.trim().toLowerCase()}%`;
    where.push('(LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.id) LIKE ?)');
    params.push(q, q, q);
  }
  if (filter?.courseId) {
    where.push(
      `EXISTS (SELECT 1 FROM entitlements e WHERE e.user_id = u.id AND e.course_id = ? AND e.status = 'active')`,
    );
    params.push(filter.courseId);
  }
  if (filter?.cohortId) {
    where.push(
      `EXISTS (SELECT 1 FROM cohort_memberships cm WHERE cm.user_id = u.id AND cm.cohort_id = ? AND cm.status = 'active')`,
    );
    params.push(filter.cohortId);
  }
  if (filter?.hasOpenTickets) {
    where.push(
      `EXISTS (SELECT 1 FROM support_tickets t WHERE t.user_id = u.id AND t.status NOT IN ('resolved', 'closed'))`,
    );
  }

  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.status, u.email_verified_at, u.created_at,
              (SELECT COUNT(DISTINCT course_id) FROM entitlements e WHERE e.user_id = u.id AND e.status = 'active') AS active_courses_count,
              (SELECT COUNT(*) FROM cohort_memberships cm WHERE cm.user_id = u.id AND cm.status = 'active') AS active_cohorts_count,
              (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = u.id) AS completed_lessons_count,
              (SELECT COUNT(*) FROM module_completions mc WHERE mc.user_id = u.id) AS completed_modules_count,
              (SELECT COUNT(*) FROM certificates cert WHERE cert.user_id = u.id AND cert.status = 'valid') AS valid_certificates_count,
              (SELECT COUNT(*) FROM support_tickets t WHERE t.user_id = u.id AND t.status NOT IN ('resolved', 'closed')) AS open_tickets_count
       FROM users u
       WHERE ${where.join(' AND ')}
       ORDER BY u.created_at DESC
       LIMIT 100`,
    )
    .all(...params);
}

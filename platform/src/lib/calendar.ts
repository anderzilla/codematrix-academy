import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { recordAuditEvent } from '@/lib/audit';
import type { PartnerContext } from '@/lib/rbac';

export type CalendarEventType =
  | 'class_live'
  | 'block_milestone'
  | 'activity_deadline'
  | 'general_event'
  | 'maintenance'
  | 'promotion_offer'
  | 'partner_commitment'
  | 'financial_receivable'
  | 'financial_payout'
  | 'operational_reminder';

export type CalendarAudienceScope =
  | 'global_students'
  | 'course'
  | 'cohort'
  | 'partner'
  | 'admin_only'
  | 'user';

export function createCalendarEvent(
  db: DatabaseSync,
  actorUserId: string,
  input: {
    eventType: CalendarEventType;
    title: string;
    description?: string;
    startsAt: string;
    endsAt: string;
    timezone?: string;
    audienceScope: CalendarAudienceScope;
    courseId?: string | null;
    cohortId?: string | null;
    partnerId?: string | null;
    targetUserId?: string | null;
    financialEntryId?: string | null;
    recurrenceWeeklyCount?: number;
  },
):
  | { ok: true; eventIds: string[]; recurrenceGroupId: string | null }
  | { ok: false; status: number; code?: string; error: string } {
  const startMs = Date.parse(input.startsAt);
  const endMs = Date.parse(input.endsAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return { ok: false, status: 400, error: 'Intervalo de data/hora inválido.' };
  }

  const occurrences = Math.min(Math.max(input.recurrenceWeeklyCount ?? 1, 1), 12);
  const recurrenceGroupId = occurrences > 1 ? `rgrp_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}` : null;
  const tz = input.timezone?.trim() || 'America/Sao_Paulo';
  const durationMs = endMs - startMs;

  // Validação de conflito para eventos de turma ou parceiro
  if (input.cohortId || input.partnerId) {
    const conflict = db
      .prepare(
        `SELECT id, title FROM calendar_events
         WHERE status IN ('scheduled', 'rescheduled')
           AND ((? IS NOT NULL AND cohort_id = ?) OR (? IS NOT NULL AND partner_id = ?))
           AND starts_at < ? AND ends_at > ?
         LIMIT 1`,
      )
      .get(
        input.cohortId ?? null,
        input.cohortId ?? null,
        input.partnerId ?? null,
        input.partnerId ?? null,
        input.endsAt,
        input.startsAt,
      ) as { id: string; title: string } | undefined;
    if (conflict) {
      return {
        ok: false,
        status: 409,
        code: 'calendar_conflict',
        error: `Conflito de agenda detectado com "${conflict.title}".`,
      };
    }
  }

  const eventIds: string[] = [];
  db.exec('BEGIN');
  try {
    const ins = db.prepare(
      `INSERT INTO calendar_events (
         id, event_type, title, description, starts_at, ends_at, timezone, status,
         audience_scope, course_id, cohort_id, partner_id, target_user_id,
         financial_entry_id, recurrence_rule, recurrence_group_id, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (let i = 0; i < occurrences; i += 1) {
      const occStart = new Date(startMs + i * 7 * 24 * 60 * 60 * 1000).toISOString();
      const occEnd = new Date(startMs + i * 7 * 24 * 60 * 60 * 1000 + durationMs).toISOString();
      const id = `cevt_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      ins.run(
        id,
        input.eventType,
        input.title.trim(),
        input.description?.trim() || '',
        occStart,
        occEnd,
        tz,
        input.audienceScope,
        input.courseId ?? null,
        input.cohortId ?? null,
        input.partnerId ?? null,
        input.targetUserId ?? null,
        input.financialEntryId ?? null,
        occurrences > 1 ? `WEEKLY;COUNT=${occurrences}` : null,
        recurrenceGroupId,
        actorUserId,
      );
      eventIds.push(id);
    }

    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: 'admin.calendar_event_created',
      targetType: 'calendar_event',
      targetId: eventIds[0],
      metadata: {
        eventType: input.eventType,
        occurrences,
        recurrenceGroupId,
        courseId: input.courseId ?? null,
        cohortId: input.cohortId ?? null,
      },
    });
    db.exec('COMMIT');
    return { ok: true, eventIds, recurrenceGroupId };
  } catch (err) {
    db.exec('ROLLBACK');
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Erro ao criar evento no calendário.',
    };
  }
}

export function updateCalendarEvent(
  db: DatabaseSync,
  actorUserId: string,
  eventId: string,
  input: {
    action: 'reschedule' | 'cancel';
    scope?: 'this_occurrence' | 'all_series';
    reason: string;
    startsAt?: string;
    endsAt?: string;
  },
): { ok: true; updatedCount: number } | { ok: false; status: number; error: string } {
  if (input.reason.trim().length < 5) {
    return { ok: false, status: 400, error: 'Informe um motivo para alterar o evento.' };
  }
  const ev = db
    .prepare(`SELECT * FROM calendar_events WHERE id = ?`)
    .get(eventId) as Record<string, unknown> | undefined;
  if (!ev) {
    return { ok: false, status: 404, error: 'Evento não encontrado.' };
  }

  // Regra crítica financeira: evento financeiro no calendário NÃO altera cobrança/ledger diretamente!
  if (ev.event_type === 'financial_receivable' || ev.event_type === 'financial_payout') {
    return {
      ok: false,
      status: 403,
      error:
        'Eventos financeiros derivam do ledger/PSP e não podem ser alterados diretamente pelo calendário. Use o fluxo financeiro autorizado.',
    };
  }

  let updatedCount = 0;
  if (input.action === 'cancel') {
    if (input.scope === 'all_series' && ev.recurrence_group_id) {
      const r = db
        .prepare(`UPDATE calendar_events SET status = 'canceled', updated_at = datetime('now') WHERE recurrence_group_id = ?`)
        .run(String(ev.recurrence_group_id));
      updatedCount = Number(r.changes);
    } else {
      const r = db
        .prepare(`UPDATE calendar_events SET status = 'canceled', updated_at = datetime('now') WHERE id = ?`)
        .run(eventId);
      updatedCount = Number(r.changes);
    }
  } else {
    if (!input.startsAt || !input.endsAt || Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      return { ok: false, status: 400, error: 'Datas inválidas para reagendamento.' };
    }
    const r = db
      .prepare(
        `UPDATE calendar_events SET status = 'rescheduled', starts_at = ?, ends_at = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(input.startsAt, input.endsAt, eventId);
    updatedCount = Number(r.changes);
  }

  recordAuditEvent(db, {
    actorUserId,
    actorRole: 'admin',
    action: input.action === 'cancel' ? 'admin.calendar_event_canceled' : 'admin.calendar_event_rescheduled',
    targetType: 'calendar_event',
    targetId: eventId,
    metadata: { scope: input.scope ?? 'this_occurrence', reason: input.reason.trim(), updatedCount },
  });

  return { ok: true, updatedCount };
}

export function listCalendarEventsForAdmin(
  db: DatabaseSync,
  filter?: { courseId?: string; cohortId?: string; eventType?: string; status?: string },
) {
  const where: string[] = ['1=1'];
  const params: string[] = [];
  if (filter?.courseId) {
    where.push('ce.course_id = ?');
    params.push(filter.courseId);
  }
  if (filter?.cohortId) {
    where.push('ce.cohort_id = ?');
    params.push(filter.cohortId);
  }
  if (filter?.eventType) {
    where.push('ce.event_type = ?');
    params.push(filter.eventType);
  }
  if (filter?.status) {
    where.push('ce.status = ?');
    params.push(filter.status);
  }

  return db
    .prepare(
      `SELECT ce.*, c.title AS course_title, coh.name AS cohort_name
       FROM calendar_events ce
       LEFT JOIN courses c ON c.id = ce.course_id
       LEFT JOIN cohorts coh ON coh.id = ce.cohort_id
       WHERE ${where.join(' AND ')}
       ORDER BY ce.starts_at ASC
       LIMIT 200`,
    )
    .all(...params);
}

export function listCalendarEventsForStudent(db: DatabaseSync, userId: string) {
  return db
    .prepare(
      `SELECT ce.id, ce.event_type, ce.title, ce.description, ce.starts_at, ce.ends_at,
              ce.timezone, ce.status, ce.course_id, ce.cohort_id,
              c.title AS course_title, coh.name AS cohort_name
       FROM calendar_events ce
       LEFT JOIN courses c ON c.id = ce.course_id
       LEFT JOIN cohorts coh ON coh.id = ce.cohort_id
       WHERE ce.audience_scope = 'global_students'
          OR (ce.audience_scope = 'user' AND ce.target_user_id = ?)
          OR (ce.audience_scope = 'course' AND ce.course_id IN (
                SELECT course_id FROM entitlements WHERE user_id = ? AND status = 'active'
             ))
          OR (ce.audience_scope = 'cohort' AND ce.cohort_id IN (
                SELECT cohort_id FROM cohort_memberships WHERE user_id = ? AND status = 'active'
             ))
       ORDER BY ce.starts_at ASC
       LIMIT 100`,
    )
    .all(userId, userId, userId);
}

export function listCalendarEventsForPartner(db: DatabaseSync, ctx: PartnerContext) {
  const assignedCourseIds = [...new Set(ctx.scopes.map((s) => s.courseId))];
  if (assignedCourseIds.length === 0) {
    // Parceiro sem vínculos ativos vê apenas compromissos estritamente dele (nunca de outros cursos)
    return db
      .prepare(
        `SELECT id, event_type, title, description, starts_at, ends_at, timezone, status, course_id, cohort_id
         FROM calendar_events
         WHERE partner_id = ?
         ORDER BY starts_at ASC`,
      )
      .all(ctx.partnerId);
  }

  const placeholders = assignedCourseIds.map(() => '?').join(', ');
  return db
    .prepare(
      `SELECT ce.id, ce.event_type, ce.title, ce.description, ce.starts_at, ce.ends_at,
              ce.timezone, ce.status, ce.course_id, ce.cohort_id,
              c.title AS course_title, coh.name AS cohort_name
       FROM calendar_events ce
       LEFT JOIN courses c ON c.id = ce.course_id
       LEFT JOIN cohorts coh ON coh.id = ce.cohort_id
       WHERE ce.partner_id = ?
          OR (ce.course_id IN (${placeholders}) AND ce.event_type IN ('class_live', 'block_milestone', 'promotion_offer', 'partner_commitment'))
       ORDER BY ce.starts_at ASC
       LIMIT 100`,
    )
    .all(ctx.partnerId, ...assignedCourseIds);
}

/**
 * Agenda financeira derivada em tempo real do Ledger / Pedidos / Lotes de Repasse.
 * Fonte única da verdade: nunca armazena cópia editável do status financeiro no calendário.
 */
export function getFinancialCalendarView(
  db: DatabaseSync,
  filter?: { courseId?: string; partnerId?: string },
) {
  const ledgerWhere = filter?.courseId ? 'WHERE fl.course_id = ?' : '';
  const ledgerParams = filter?.courseId ? [filter.courseId] : [];
  const ledgerItems = db
    .prepare(
      `SELECT fl.id AS financial_entry_id, fl.entry_type, fl.course_id, c.title AS course_title,
              fl.offer_sku, fl.partner_id, fl.transaction_code, fl.gross_cents,
              fl.gateway_fee_cents, fl.commission_cents, fl.net_cents, fl.currency,
              fl.competence_date, fl.cash_date, fl.created_at
       FROM financial_ledger fl
       LEFT JOIN courses c ON c.id = fl.course_id
       ${ledgerWhere}
       ORDER BY fl.competence_date DESC, fl.created_at DESC
       LIMIT 100`,
    )
    .all(...ledgerParams);

  const commWhereParts: string[] = ['1=1'];
  const commParams: string[] = [];
  if (filter?.courseId) {
    commWhereParts.push('ce.course_id = ?');
    commParams.push(filter.courseId);
  }
  if (filter?.partnerId) {
    commWhereParts.push('ce.partner_id = ?');
    commParams.push(filter.partnerId);
  }

  const commissionEvents = db
    .prepare(
      `SELECT ce.id, ce.partner_id, ce.course_id, c.title AS course_title, ce.transaction_code,
              ce.commission_cents, ce.currency, ce.status, ce.payout_batch_id, ce.created_at
       FROM commission_entries ce
       LEFT JOIN courses c ON c.id = ce.course_id
       WHERE ${commWhereParts.join(' AND ')}
       ORDER BY ce.created_at DESC
       LIMIT 100`,
    )
    .all(...commParams);

  const payoutBatches = db
    .prepare(
      `SELECT id, period_label, status, total_commission_cents, currency, paid_at, created_at
       FROM payout_batches
       ORDER BY created_at DESC
       LIMIT 30`,
    )
    .all();

  return {
    derivedFromSourceOfTruth: true,
    ledgerItems,
    commissionEvents,
    payoutBatches,
  };
}

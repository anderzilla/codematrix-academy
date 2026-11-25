import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export interface EntitlementRecord {
  id: string;
  userId: string | null;
  buyerEmailHash: string | null;
  courseId: string;
  offerSku: string;
  accessScope: string;
  sourceProvider: 'free_sample' | 'hotmart' | 'manual';
  sourceEventId: string | null;
  transactionCode: string | null;
  status: 'active' | 'suspended' | 'revoked' | 'expired';
  startsAt: string;
  endsAt: string | null;
  suspensionReason: string | null;
}

export function scopeGrantsBlock(
  accessScope: string,
  courseSlug: string,
  moduleCode: string,
  blockCode: string,
): boolean {
  const normalized = accessScope.trim();
  if (normalized === `course:${courseSlug}:full`) return true;
  if (normalized === `course:${courseSlug}:module:${moduleCode}`) return true;
  if (normalized === `course:${courseSlug}:block:${blockCode}`) return true;
  return false;
}

export function scopeGrantsCourse(accessScope: string, courseSlug: string): boolean {
  return accessScope.trim().startsWith(`course:${courseSlug}:`);
}

function appendHistory(
  db: DatabaseSync,
  input: {
    entitlementId: string;
    action: 'granted' | 'suspended' | 'revoked' | 'reactivated' | 'claimed_by_user';
    reason: string;
    sourceEventId?: string | null;
    actor?: string;
  },
): void {
  const historyId = `eh_${crypto.randomUUID().replace(/-/g, '')}`;
  db.prepare(
    `INSERT INTO entitlement_history (id, entitlement_id, action, reason, source_event_id, actor)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    historyId,
    input.entitlementId,
    input.action,
    input.reason,
    input.sourceEventId ?? null,
    input.actor ?? 'system',
  );
}

export function grantEntitlement(
  db: DatabaseSync,
  input: {
    userId?: string | null;
    buyerEmailHash?: string | null;
    courseId: string;
    offerSku: string;
    accessScope: string;
    sourceProvider: 'free_sample' | 'hotmart' | 'manual';
    sourceEventId?: string | null;
    transactionCode?: string | null;
    reason: string;
    actor?: string;
  },
): { entitlementId: string; created: boolean } {
  // Idempotência por source_event_id ou transaction_code + offer_sku
  if (input.sourceEventId) {
    const byEvent = db
      .prepare(`SELECT id FROM entitlements WHERE source_event_id = ? LIMIT 1`)
      .get(input.sourceEventId) as { id: string } | undefined;
    if (byEvent) {
      return { entitlementId: byEvent.id, created: false };
    }
  }

  if (input.transactionCode) {
    const byTx = db
      .prepare(
        `SELECT id, status FROM entitlements WHERE transaction_code = ? AND offer_sku = ? LIMIT 1`,
      )
      .get(input.transactionCode, input.offerSku) as { id: string; status: string } | undefined;
    if (byTx) {
      if (byTx.status !== 'active') {
        db.prepare(
          `UPDATE entitlements
           SET status = 'active', suspension_reason = NULL, updated_at = datetime('now')
           WHERE id = ?`,
        ).run(byTx.id);
        appendHistory(db, {
          entitlementId: byTx.id,
          action: 'reactivated',
          reason: input.reason,
          sourceEventId: input.sourceEventId,
          actor: input.actor,
        });
      }
      return { entitlementId: byTx.id, created: false };
    }
  }

  if (input.userId) {
    const existingActive = db
      .prepare(
        `SELECT id FROM entitlements
         WHERE user_id = ? AND course_id = ? AND offer_sku = ? AND status = 'active'
         LIMIT 1`,
      )
      .get(input.userId, input.courseId, input.offerSku) as { id: string } | undefined;
    if (existingActive) {
      return { entitlementId: existingActive.id, created: false };
    }
  }

  // Se veio por e-mail (Hotmart) e o usuário já tem conta verificada, vincula imediatamente
  let resolvedUserId = input.userId ?? null;
  if (!resolvedUserId && input.buyerEmailHash) {
    const matchedUser = db
      .prepare(`SELECT id FROM users WHERE email_hash = ? LIMIT 1`)
      .get(input.buyerEmailHash) as { id: string } | undefined;
    if (matchedUser) {
      resolvedUserId = matchedUser.id;
    }
  }

  const entitlementId = `ent_${crypto.randomUUID().replace(/-/g, '')}`;
  db.prepare(
    `INSERT INTO entitlements (
       id, user_id, buyer_email_hash, course_id, offer_sku, access_scope,
       source_provider, source_event_id, transaction_code, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
  ).run(
    entitlementId,
    resolvedUserId,
    input.buyerEmailHash ?? null,
    input.courseId,
    input.offerSku,
    input.accessScope,
    input.sourceProvider,
    input.sourceEventId ?? null,
    input.transactionCode ?? null,
  );

  appendHistory(db, {
    entitlementId,
    action: 'granted',
    reason: input.reason,
    sourceEventId: input.sourceEventId,
    actor: input.actor,
  });

  return { entitlementId, created: true };
}

export function revokeOrSuspendByTransaction(
  db: DatabaseSync,
  input: {
    transactionCode: string;
    eventType: string;
    sourceEventId: string;
    env?: NodeJS.ProcessEnv;
  },
): { updatedCount: number; targetStatus: 'suspended' | 'revoked' } {
  const env = input.env ?? process.env;
  const refundPolicy = (env.HOTMART_REFUND_POLICY || 'revoke').toLowerCase();
  const isChargeback = input.eventType === 'PURCHASE_CHARGEBACK' || input.eventType === 'PURCHASE_PROTEST';
  const targetStatus: 'suspended' | 'revoked' =
    isChargeback || refundPolicy === 'revoke' ? 'revoked' : 'suspended';

  const rows = db
    .prepare(
      `SELECT id, status FROM entitlements
       WHERE transaction_code = ? AND status IN ('active', 'suspended')`,
    )
    .all(input.transactionCode) as Array<{ id: string; status: string }>;

  let updatedCount = 0;
  for (const row of rows) {
    if (row.status === targetStatus) continue;
    const reason = `Evento Hotmart ${input.eventType} (política: ${targetStatus})`;
    db.prepare(
      `UPDATE entitlements
       SET status = ?, suspension_reason = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(targetStatus, reason, row.id);

    appendHistory(db, {
      entitlementId: row.id,
      action: targetStatus === 'revoked' ? 'revoked' : 'suspended',
      reason,
      sourceEventId: input.sourceEventId,
      actor: 'hotmart_webhook',
    });
    updatedCount += 1;
  }

  return { updatedCount, targetStatus };
}

export function claimPendingEntitlementsForUser(
  db: DatabaseSync,
  userId: string,
  emailHash: string,
): number {
  const pending = db
    .prepare(
      `SELECT id FROM entitlements
       WHERE user_id IS NULL AND buyer_email_hash = ? AND status = 'active'`,
    )
    .all(emailHash) as Array<{ id: string }>;

  for (const row of pending) {
    db.prepare(
      `UPDATE entitlements SET user_id = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(userId, row.id);
    appendHistory(db, {
      entitlementId: row.id,
      action: 'claimed_by_user',
      reason: 'Direito vinculado automaticamente após verificação de e-mail.',
      actor: userId,
    });
  }

  return pending.length;
}

export function grantFreeSampleOffer(
  db: DatabaseSync,
  userId: string,
  offerCode: string,
): { ok: true; entitlementId: string; created: boolean } | { ok: false; error: string } {
  const offer = db
    .prepare(
      `SELECT o.id, o.course_id, o.sku, o.access_scope, o.is_free, o.status
       FROM offers o
       INNER JOIN courses c ON c.id = o.course_id
       WHERE o.offer_code = ? AND o.status = 'published' AND c.status = 'published'`,
    )
    .get(offerCode) as
    | {
        id: string;
        course_id: string;
        sku: string;
        access_scope: string;
        is_free: number;
        status: string;
      }
    | undefined;

  if (!offer || Number(offer.is_free) !== 1) {
    return {
      ok: false,
      error: 'Oferta gratuita não encontrada ou indisponível para liberação direta.',
    };
  }

  const res = grantEntitlement(db, {
    userId,
    courseId: offer.course_id,
    offerSku: offer.sku,
    accessScope: offer.access_scope,
    sourceProvider: 'free_sample',
    reason: `Ativação explícita da oferta gratuita ${offer.sku}`,
    actor: userId,
  });

  return { ok: true, ...res };
}

export function listUserActiveEntitlements(
  db: DatabaseSync,
  userId: string,
): EntitlementRecord[] {
  const rows = db
    .prepare(
      `SELECT id, user_id, buyer_email_hash, course_id, offer_sku, access_scope,
              source_provider, source_event_id, transaction_code, status,
              starts_at, ends_at, suspension_reason
       FROM entitlements
       WHERE user_id = ?
         AND status = 'active'
         AND (ends_at IS NULL OR datetime(ends_at) > datetime('now'))
       ORDER BY created_at DESC`,
    )
    .all(userId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    userId: r.user_id ? String(r.user_id) : null,
    buyerEmailHash: r.buyer_email_hash ? String(r.buyer_email_hash) : null,
    courseId: String(r.course_id),
    offerSku: String(r.offer_sku),
    accessScope: String(r.access_scope),
    sourceProvider: r.source_provider as EntitlementRecord['sourceProvider'],
    sourceEventId: r.source_event_id ? String(r.source_event_id) : null,
    transactionCode: r.transaction_code ? String(r.transaction_code) : null,
    status: r.status as EntitlementRecord['status'],
    startsAt: String(r.starts_at),
    endsAt: r.ends_at ? String(r.ends_at) : null,
    suspensionReason: r.suspension_reason ? String(r.suspension_reason) : null,
  }));
}

export function userHasBlockAccess(
  db: DatabaseSync,
  userId: string,
  courseId: string,
  courseSlug: string,
  moduleCode: string,
  blockCode: string,
): boolean {
  const entitlements = listUserActiveEntitlements(db, userId).filter(
    (e) => e.courseId === courseId,
  );
  return entitlements.some((e) =>
    scopeGrantsBlock(e.accessScope, courseSlug, moduleCode, blockCode),
  );
}

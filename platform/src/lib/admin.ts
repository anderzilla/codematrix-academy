import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { recordAuditEvent } from '@/lib/audit';
import { isDevMailboxEnabled } from '@/lib/auth';
import { grantEntitlement } from '@/lib/entitlements';
import { getHotmartConfig } from '@/lib/payments/hotmart';
import { getPersistenceTopology } from '@/lib/persistence/nosql';

export function getAdminOverview(db: DatabaseSync) {
  const courses = db
    .prepare(
      `SELECT c.id, c.slug, c.title, c.status, c.planned_modules_count, c.planned_lessons_count,
              (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id AND m.status = 'published') AS published_modules,
              (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id AND m.status = 'planned') AS planned_modules,
              (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.status = 'published') AS published_lessons,
              (SELECT COUNT(*) FROM assets a WHERE a.course_id = c.id AND a.kind = 'stream_video' AND a.stream_uid IS NULL) AS pending_stream_videos
       FROM courses c
       ORDER BY c.created_at ASC`,
    )
    .all() as Array<Record<string, unknown>>;

  const users = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.status, u.email_verified_at, u.created_at,
              (SELECT GROUP_CONCAT(DISTINCT role) FROM user_roles ur WHERE ur.user_id = u.id) AS roles_csv
       FROM users u
       ORDER BY u.created_at DESC
       LIMIT 50`,
    )
    .all() as Array<Record<string, unknown>>;

  const paymentEvents = db
    .prepare(
      `SELECT id, provider, provider_event_id, event_type, offer_sku, transaction_code,
              processing_status, entitlement_status, received_at
       FROM payment_events
       ORDER BY received_at DESC
       LIMIT 50`,
    )
    .all() as Array<Record<string, unknown>>;

  const ledgerSummary = db
    .prepare(
      `SELECT
         COUNT(*) AS entries_count,
         COALESCE(SUM(gross_cents), 0) AS gross_cents,
         COALESCE(SUM(discount_cents), 0) AS discount_cents,
         COALESCE(SUM(gateway_fee_cents), 0) AS gateway_fee_cents,
         COALESCE(SUM(commission_cents), 0) AS commission_cents,
         COALESCE(SUM(refund_cents), 0) AS refund_cents,
         COALESCE(SUM(chargeback_cents), 0) AS chargeback_cents,
         COALESCE(SUM(net_cents), 0) AS net_cents
       FROM financial_ledger`,
    )
    .get() as Record<string, unknown>;

  const payoutBatches = db
    .prepare(
      `SELECT id, period_label, status, total_commission_cents, currency,
              prepared_by, approved_by, payment_method, payment_reference, receipt_ref, paid_at, created_at
       FROM payout_batches
       ORDER BY created_at DESC
       LIMIT 20`,
    )
    .all() as Array<Record<string, unknown>>;

  const certificates = db
    .prepare(
      `SELECT verification_code, student_display_name, course_title, status, revocation_reason, issued_at, revoked_at
       FROM certificates
       ORDER BY issued_at DESC
       LIMIT 30`,
    )
    .all() as Array<Record<string, unknown>>;

  const mediaAssets = db
    .prepare(
      `SELECT a.id, a.code, a.title, a.kind, a.stream_uid, a.status, c.slug AS course_slug
       FROM assets a
       INNER JOIN courses c ON c.id = a.course_id
       WHERE a.kind = 'stream_video'
       ORDER BY a.code ASC
       LIMIT 30`,
    )
    .all() as Array<Record<string, unknown>>;

  const lives = db
    .prepare(
      `SELECT id, code, title, scheduled_at, status, live_input_uid, replay_stream_uid, retention_days
       FROM live_events
       ORDER BY scheduled_at ASC`,
    )
    .all() as Array<Record<string, unknown>>;

  const auditEvents = db
    .prepare(
      `SELECT id, actor_user_id, actor_role, action, target_type, target_id, created_at
       FROM audit_events
       ORDER BY created_at DESC
       LIMIT 40`,
    )
    .all() as Array<Record<string, unknown>>;

  const fraudFlags = db
    .prepare(
      `SELECT id, partner_id, signal_type, severity, status, detail, appeal_note, created_at
       FROM partner_fraud_flags
       ORDER BY created_at DESC
       LIMIT 20`,
    )
    .all() as Array<Record<string, unknown>>;

  const lgpdRequests = db
    .prepare(
      `SELECT id, request_type, status, reason, reviewed_by, created_at
       FROM lgpd_requests
       ORDER BY created_at DESC
       LIMIT 20`,
    )
    .all() as Array<Record<string, unknown>>;

  const hotmart = getHotmartConfig();
  const persistence = getPersistenceTopology();

  return {
    courses,
    users,
    paymentEvents,
    ledgerSummary,
    payoutBatches,
    certificates,
    mediaAssets,
    lives,
    auditEvents,
    fraudFlags,
    lgpdRequests,
    integrationsHealth: {
      hotmart: { mode: hotmart.mode, hottokConfigured: hotmart.hasHottok },
      cloudflareStream: {
        signingConfigured: Boolean(
          process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID?.trim() &&
            process.env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY?.trim(),
        ),
        allowedOrigins: process.env.CLOUDFLARE_STREAM_ALLOWED_ORIGINS || 'academy.codematrix.com.br',
      },
      email: {
        devMailboxEnabled: isDevMailboxEnabled(),
        smtpConfigured: Boolean(process.env.SMTP_HOST?.trim()),
      },
      persistence,
    },
  };
}

export function adminManageEntitlement(
  db: DatabaseSync,
  actorUserId: string,
  input: {
    action: 'grant' | 'suspend';
    userId: string;
    courseId: string;
    offerSku: string;
    accessScope: string;
    reason: string;
  },
): { ok: true; entitlementId?: string } | { ok: false; status: number; error: string } {
  const reason = input.reason.trim();
  if (reason.length < 5) {
    return { ok: false, status: 400, error: 'Informe um motivo obrigatório (mínimo 5 caracteres).' };
  }

  if (input.action === 'grant') {
    const res = grantEntitlement(db, {
      userId: input.userId,
      courseId: input.courseId,
      offerSku: input.offerSku,
      accessScope: input.accessScope,
      sourceProvider: 'manual',
      reason,
      actor: actorUserId,
    });
    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: 'admin.entitlement_granted',
      targetType: 'entitlement',
      targetId: res.entitlementId,
      metadata: { userId: input.userId, offerSku: input.offerSku, reason },
    });
    return { ok: true, entitlementId: res.entitlementId };
  }

  const rows = db
    .prepare(
      `SELECT id FROM entitlements
       WHERE user_id = ? AND course_id = ? AND offer_sku = ? AND status = 'active'`,
    )
    .all(input.userId, input.courseId, input.offerSku) as Array<{ id: string }>;

  for (const row of rows) {
    db.prepare(
      `UPDATE entitlements SET status = 'suspended', suspension_reason = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(reason, row.id);
    db.prepare(
      `INSERT INTO entitlement_history (id, entitlement_id, action, reason, actor)
       VALUES (?, ?, 'suspended', ?, ?)`,
    ).run(`eh_${crypto.randomUUID().replace(/-/g, '')}`, row.id, reason, actorUserId);
    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: 'admin.entitlement_suspended',
      targetType: 'entitlement',
      targetId: row.id,
      metadata: { userId: input.userId, reason },
    });
  }

  return { ok: true };
}

export function adminPreparePayoutBatch(
  db: DatabaseSync,
  makerUserId: string,
  input: { periodLabel: string; includePendingWarranty?: boolean },
): { ok: true; batchId: string; entriesCount: number; totalCents: number } | { ok: false; status: number; error: string } {
  const periodLabel = input.periodLabel.trim();
  if (periodLabel.length < 3) {
    return { ok: false, status: 400, error: 'Informe o período do lote (ex.: 2026-11).' };
  }

  const eligibleStatuses = input.includePendingWarranty
    ? `('approved', 'pending_warranty')`
    : `('approved')`;

  const entries = db
    .prepare(
      `SELECT id, commission_cents FROM commission_entries
       WHERE payout_batch_id IS NULL AND status IN ${eligibleStatuses}`,
    )
    .all() as Array<{ id: string; commission_cents: number }>;

  if (entries.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'Não há comissões elegíveis sem lote para fechamento neste momento.',
    };
  }

  const totalCents = entries.reduce((sum, e) => sum + Number(e.commission_cents), 0);
  const batchId = `pbat_${crypto.randomUUID().replace(/-/g, '')}`;

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO payout_batches (id, period_label, status, total_commission_cents, prepared_by)
       VALUES (?, ?, 'pending_dual_approval', ?, ?)`,
    ).run(batchId, periodLabel, totalCents, makerUserId);

    for (const e of entries) {
      db.prepare(
        `UPDATE commission_entries
         SET payout_batch_id = ?, status = 'approved', updated_at = datetime('now')
         WHERE id = ?`,
      ).run(batchId, e.id);
    }

    recordAuditEvent(db, {
      actorUserId: makerUserId,
      actorRole: 'admin',
      action: 'admin.payout_batch_prepared',
      targetType: 'payout_batch',
      targetId: batchId,
      metadata: { periodLabel, entriesCount: entries.length, totalCents },
    });

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return { ok: true, batchId, entriesCount: entries.length, totalCents };
}

export function adminApprovePayoutBatch(
  db: DatabaseSync,
  checkerUserId: string,
  batchId: string,
): { ok: true } | { ok: false; status: number; code: string; error: string } {
  const batch = db
    .prepare(`SELECT id, status, prepared_by FROM payout_batches WHERE id = ?`)
    .get(batchId) as { id: string; status: string; prepared_by: string } | undefined;

  if (!batch) {
    return { ok: false, status: 404, code: 'not_found', error: 'Lote não encontrado.' };
  }
  if (batch.status !== 'pending_dual_approval') {
    return {
      ok: false,
      status: 400,
      code: 'invalid_state',
      error: `Lote em status "${batch.status}" não pode ser aprovado.`,
    };
  }
  // Controle estrito Maker-Checker: quem prepara não pode aprovar o mesmo lote
  if (batch.prepared_by === checkerUserId) {
    return {
      ok: false,
      status: 403,
      code: 'maker_checker_violation',
      error: 'Regra maker-checker: o administrador que preparou o lote não pode aprová-lo. Outro administrador deve revisar e aprovar.',
    };
  }

  db.prepare(
    `UPDATE payout_batches
     SET status = 'approved', approved_by = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(checkerUserId, batchId);

  recordAuditEvent(db, {
    actorUserId: checkerUserId,
    actorRole: 'admin',
    action: 'admin.payout_batch_approved',
    targetType: 'payout_batch',
    targetId: batchId,
    metadata: { preparedBy: batch.prepared_by },
  });

  return { ok: true };
}

export function adminMarkPayoutBatchPaid(
  db: DatabaseSync,
  actorUserId: string,
  batchId: string,
  input: { paymentMethod: string; paymentReference: string; receiptRef: string },
): { ok: true } | { ok: false; status: number; error: string } {
  const batch = db
    .prepare(`SELECT id, status FROM payout_batches WHERE id = ?`)
    .get(batchId) as { id: string; status: string } | undefined;

  if (!batch) {
    return { ok: false, status: 404, error: 'Lote não encontrado.' };
  }
  if (batch.status !== 'approved') {
    return {
      ok: false,
      status: 400,
      error: 'Somente lotes aprovados por dupla aprovação podem ser marcados como pagos manualmente.',
    };
  }
  if (!input.paymentMethod.trim() || !input.paymentReference.trim() || !input.receiptRef.trim()) {
    return {
      ok: false,
      status: 400,
      error: 'Informe método, identificador da transferência manual e referência do comprovante.',
    };
  }

  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE payout_batches
       SET status = 'paid', payment_method = ?, payment_reference = ?, receipt_ref = ?,
           paid_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
    ).run(
      input.paymentMethod.trim(),
      input.paymentReference.trim(),
      input.receiptRef.trim(),
      batchId,
    );

    db.prepare(
      `UPDATE commission_entries SET status = 'paid', updated_at = datetime('now') WHERE payout_batch_id = ?`,
    ).run(batchId);

    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: 'admin.payout_batch_marked_paid',
      targetType: 'payout_batch',
      targetId: batchId,
      metadata: {
        paymentMethod: input.paymentMethod.trim(),
        paymentReference: input.paymentReference.trim(),
        receiptRef: input.receiptRef.trim(),
      },
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return { ok: true };
}

export function adminRevokeCertificate(
  db: DatabaseSync,
  actorUserId: string,
  verificationCode: string,
  reason: string,
): { ok: true } | { ok: false; status: number; error: string } {
  if (reason.trim().length < 5) {
    return { ok: false, status: 400, error: 'Informe um motivo obrigatório para revogação.' };
  }
  const cert = db
    .prepare(`SELECT id, status FROM certificates WHERE verification_code = ?`)
    .get(verificationCode.trim()) as { id: string; status: string } | undefined;
  if (!cert) {
    return { ok: false, status: 404, error: 'Certificado não encontrado.' };
  }

  db.prepare(
    `UPDATE certificates
     SET status = 'revoked', revocation_reason = ?, revoked_at = datetime('now')
     WHERE id = ?`,
  ).run(reason.trim(), cert.id);

  recordAuditEvent(db, {
    actorUserId,
    actorRole: 'admin',
    action: 'admin.certificate_revoked',
    targetType: 'certificate',
    targetId: verificationCode.trim(),
    metadata: { reason: reason.trim() },
  });

  return { ok: true };
}

export function adminBindMediaUid(
  db: DatabaseSync,
  actorUserId: string,
  input: {
    targetType: 'lesson_asset' | 'live_event';
    code: string;
    streamUid: string;
    retentionDays?: number;
  },
): { ok: true } | { ok: false; status: number; error: string } {
  const uid = input.streamUid.trim();
  if (uid.length < 4 || uid.length > 128) {
    return { ok: false, status: 400, error: 'Stream UID inválido.' };
  }

  if (input.targetType === 'lesson_asset') {
    const asset = db
      .prepare(`SELECT id FROM assets WHERE code = ? AND kind = 'stream_video'`)
      .get(input.code.trim()) as { id: string } | undefined;
    if (!asset) return { ok: false, status: 404, error: 'Asset de vídeo não encontrado.' };

    db.prepare(`UPDATE assets SET stream_uid = ?, status = 'ready' WHERE id = ?`).run(
      uid,
      asset.id,
    );
    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: 'admin.stream_asset_bound',
      targetType: 'asset',
      targetId: asset.id,
      metadata: { code: input.code.trim() },
    });
    return { ok: true };
  }

  const live = db
    .prepare(`SELECT id FROM live_events WHERE code = ?`)
    .get(input.code.trim()) as { id: string } | undefined;
  if (!live) return { ok: false, status: 404, error: 'Evento ao vivo não encontrado.' };

  db.prepare(
    `UPDATE live_events SET replay_stream_uid = ?, status = 'replay_available', retention_days = COALESCE(?, retention_days) WHERE id = ?`,
  ).run(uid, input.retentionDays ?? null, live.id);

  recordAuditEvent(db, {
    actorUserId,
    actorRole: 'admin',
    action: 'admin.live_replay_bound',
    targetType: 'live_event',
    targetId: live.id,
    metadata: { code: input.code.trim(), retentionDays: input.retentionDays ?? null },
  });
  return { ok: true };
}

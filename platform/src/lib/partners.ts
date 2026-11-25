import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { recordAuditEvent } from '@/lib/audit';
import {
  partnerCanAccessCourse,
  partnerHasRole,
  type PartnerContext,
} from '@/lib/rbac';

export const CURRENT_PARTNER_TERMS_VERSION = '2026-11-v1-rascunho';

function maskPayoutIdentifier(raw: string): string {
  const clean = raw.trim();
  if (clean.length <= 4) return '••••';
  return `••••-${clean.slice(-4)}`;
}

function encryptPayoutBlob(
  payload: Record<string, string>,
  env: NodeJS.ProcessEnv = process.env,
): { ok: true; blob: string } | { ok: false; error: string } {
  const rawKey = env.ACADEMY_PAYOUT_ENCRYPTION_KEY?.trim() ?? '';
  if (!rawKey) {
    return {
      ok: false,
      error:
        'Cadastro de dados de repasse indisponível neste ambiente: configure ACADEMY_PAYOUT_ENCRYPTION_KEY no servidor/Secret Manager.',
    };
  }
  const key = crypto.createHash('sha256').update(rawKey, 'utf8').digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ok: true,
    blob: `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`,
  };
}

export function acceptPartnerTerms(
  db: DatabaseSync,
  ctx: PartnerContext,
  termsVersion: string,
): { ok: true; status: string } | { ok: false; error: string } {
  if (ctx.status === 'suspended') {
    return { ok: false, error: 'Conta de parceiro suspensa. Contate a equipe financeira.' };
  }
  if (termsVersion.trim() !== CURRENT_PARTNER_TERMS_VERSION) {
    return {
      ok: false,
      error: `Versão de termos inválida. Versão vigente: ${CURRENT_PARTNER_TERMS_VERSION}.`,
    };
  }

  const nextStatus = ctx.status === 'invited' ? 'pending' : ctx.status;
  db.prepare(
    `UPDATE partner_profiles
     SET terms_version = ?, terms_accepted_at = datetime('now'), status = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(termsVersion, nextStatus, ctx.partnerId);

  recordAuditEvent(db, {
    actorUserId: ctx.userId,
    actorRole: ctx.roles.join(','),
    action: 'partner.terms_accepted',
    targetType: 'partner_profile',
    targetId: ctx.partnerId,
    metadata: { termsVersion },
  });

  return { ok: true, status: nextStatus };
}

export function updatePartnerPayoutProfile(
  db: DatabaseSync,
  ctx: PartnerContext,
  input: { method: string; holderName: string; destinationKey: string },
  env: NodeJS.ProcessEnv = process.env,
): { ok: true; maskedSummary: string } | { ok: false; status: number; error: string } {
  if (ctx.status === 'suspended') {
    return { ok: false, status: 403, error: 'Conta de parceiro suspensa.' };
  }
  const method = input.method.trim().toUpperCase();
  const holderName = input.holderName.trim();
  const destinationKey = input.destinationKey.trim();

  if (!['PIX', 'TED'].includes(method)) {
    return { ok: false, status: 400, error: 'Método inválido. Use PIX ou TED.' };
  }
  if (holderName.length < 3 || destinationKey.length < 4) {
    return { ok: false, status: 400, error: 'Preencha titular e chave/conta de destino.' };
  }

  const encrypted = encryptPayoutBlob({ method, holderName, destinationKey }, env);
  if (!encrypted.ok) {
    return { ok: false, status: 503, error: encrypted.error };
  }

  const maskedSummary = `${method} ${maskPayoutIdentifier(destinationKey)}`;
  db.prepare(
    `UPDATE partner_profiles
     SET payout_method = ?, payout_masked_summary = ?, payout_encrypted_blob = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(method, maskedSummary, encrypted.blob, ctx.partnerId);

  recordAuditEvent(db, {
    actorUserId: ctx.userId,
    actorRole: ctx.roles.join(','),
    action: 'partner.payout_updated',
    targetType: 'partner_profile',
    targetId: ctx.partnerId,
    metadata: { method, maskedSummary },
  });

  return { ok: true, maskedSummary };
}

export function createPartnerLink(
  db: DatabaseSync,
  ctx: PartnerContext,
  input: {
    courseId: string;
    offerSku: string;
    code: string;
    campaign?: string;
    maxUses?: number | null;
    validUntil?: string | null;
  },
): { ok: true; id: string; code: string } | { ok: false; status: number; error: string } {
  if (ctx.status !== 'approved') {
    return {
      ok: false,
      status: 403,
      error: 'Apenas parceiros com perfil aprovado podem criar links de divulgação.',
    };
  }
  if (!partnerCanAccessCourse(ctx, input.courseId, ['affiliate', 'seller', 'partner'])) {
    return {
      ok: false,
      status: 403,
      error: 'Você não tem permissão para criar links para este curso.',
    };
  }

  const cleanCode = input.code.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
  if (cleanCode.length < 4 || cleanCode.length > 48) {
    return {
      ok: false,
      status: 400,
      error: 'O código do link deve ter entre 4 e 48 caracteres (letras, números, - ou _).',
    };
  }

  const offer = db
    .prepare(`SELECT sku FROM offers WHERE course_id = ? AND sku = ? LIMIT 1`)
    .get(input.courseId, input.offerSku) as { sku: string } | undefined;
  if (!offer) {
    return { ok: false, status: 404, error: 'Oferta/SKU não encontrada para este curso.' };
  }

  const id = `plk_${crypto.randomUUID().replace(/-/g, '')}`;
  try {
    db.prepare(
      `INSERT INTO partner_links (id, partner_id, course_id, offer_sku, code, campaign, max_uses, valid_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      ctx.partnerId,
      input.courseId,
      input.offerSku,
      cleanCode,
      (input.campaign || 'geral').trim().slice(0, 64),
      input.maxUses ?? null,
      input.validUntil ?? null,
    );
  } catch {
    return { ok: false, status: 409, error: 'Este código de link já está em uso.' };
  }

  recordAuditEvent(db, {
    actorUserId: ctx.userId,
    actorRole: ctx.roles.join(','),
    action: 'partner.link_created',
    targetType: 'partner_link',
    targetId: id,
    metadata: { courseId: input.courseId, offerSku: input.offerSku, code: cleanCode },
  });

  return { ok: true, id, code: cleanCode };
}

export function createPartnerCoupon(
  db: DatabaseSync,
  ctx: PartnerContext,
  input: {
    courseId: string;
    offerSku: string;
    code: string;
    campaign?: string;
    discountType: 'none' | 'percent' | 'fixed_cents';
    discountValue: number;
    maxUses?: number | null;
    validUntil?: string | null;
  },
): { ok: true; id: string; code: string } | { ok: false; status: number; error: string } {
  if (ctx.status !== 'approved') {
    return {
      ok: false,
      status: 403,
      error: 'Apenas parceiros com perfil aprovado podem criar cupons.',
    };
  }
  if (!partnerCanAccessCourse(ctx, input.courseId, ['affiliate', 'seller', 'partner'])) {
    return {
      ok: false,
      status: 403,
      error: 'Você não tem permissão para criar cupons para este curso.',
    };
  }

  const cleanCode = input.code.trim().toUpperCase().replace(/[^A-Z0-9-_]/g, '');
  if (cleanCode.length < 4 || cleanCode.length > 32) {
    return {
      ok: false,
      status: 400,
      error: 'O cupom deve ter entre 4 e 32 caracteres (letras maiúsculas e números).',
    };
  }

  if (input.discountType === 'percent' && (input.discountValue < 0 || input.discountValue > 30)) {
    return {
      ok: false,
      status: 400,
      error: 'Desconto percentual de parceiro limitado entre 0% e 30% (revisão admin acima disso).',
    };
  }

  const id = `pcp_${crypto.randomUUID().replace(/-/g, '')}`;
  try {
    db.prepare(
      `INSERT INTO partner_coupons (
         id, partner_id, course_id, offer_sku, code, campaign, discount_type, discount_value, max_uses, valid_until
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      ctx.partnerId,
      input.courseId,
      input.offerSku,
      cleanCode,
      (input.campaign || 'geral').trim().slice(0, 64),
      input.discountType,
      Math.max(0, Math.floor(input.discountValue)),
      input.maxUses ?? null,
      input.validUntil ?? null,
    );
  } catch {
    return { ok: false, status: 409, error: 'Este código de cupom já está em uso.' };
  }

  recordAuditEvent(db, {
    actorUserId: ctx.userId,
    actorRole: ctx.roles.join(','),
    action: 'partner.coupon_created',
    targetType: 'partner_coupon',
    targetId: id,
    metadata: {
      courseId: input.courseId,
      offerSku: input.offerSku,
      code: cleanCode,
      discountType: input.discountType,
      discountValue: input.discountValue,
    },
  });

  return { ok: true, id, code: cleanCode };
}

export function updateInstructorAssignmentChecklist(
  db: DatabaseSync,
  ctx: PartnerContext,
  assignmentId: string,
  input: {
    recordingStatus?: 'pending' | 'in_progress' | 'recorded' | 'published';
    checklist?: Array<{ label: string; done: boolean }>;
  },
): { ok: true } | { ok: false; status: number; error: string } {
  if (!partnerHasRole(ctx, ['instructor'])) {
    return { ok: false, status: 403, error: 'Ação restrita a professores atribuídos.' };
  }

  // Proteção IDOR: valida que a atribuição pertence ao partner_id autenticado
  const row = db
    .prepare(`SELECT id, partner_id FROM instructor_assignments WHERE id = ?`)
    .get(assignmentId) as { id: string; partner_id: string } | undefined;

  if (!row) {
    return { ok: false, status: 404, error: 'Atribuição de aula/live não encontrada.' };
  }
  if (row.partner_id !== ctx.partnerId) {
    return {
      ok: false,
      status: 403,
      error: 'Você não tem permissão para alterar atribuições de outro professor.',
    };
  }

  if (input.recordingStatus) {
    db.prepare(
      `UPDATE instructor_assignments SET recording_status = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(input.recordingStatus, assignmentId);
  }
  if (Array.isArray(input.checklist)) {
    const sanitized = input.checklist.slice(0, 20).map((item) => ({
      label: String(item.label).slice(0, 140),
      done: Boolean(item.done),
    }));
    db.prepare(
      `UPDATE instructor_assignments SET prep_checklist_json = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(JSON.stringify(sanitized), assignmentId);
  }

  recordAuditEvent(db, {
    actorUserId: ctx.userId,
    actorRole: 'instructor',
    action: 'instructor.assignment_updated',
    targetType: 'instructor_assignment',
    targetId: assignmentId,
    metadata: { recordingStatus: input.recordingStatus ?? null },
  });

  return { ok: true };
}

export function attributeHotmartCommission(
  db: DatabaseSync,
  input: {
    courseId: string;
    offerSku: string;
    transactionCode: string;
    sourceEventId: string;
    grossCents: number;
    gatewayFeeCents: number;
    currency: string;
    buyerEmailHash: string | null;
    couponCode?: string | null;
    linkCode?: string | null;
  },
): { attributed: boolean; entryId?: string; status?: string; fraudFlagged?: boolean } {
  // Precedência: cupom prevalece sobre link quando ambos informados
  let attributionSource: 'coupon' | 'link' | null = null;
  let attributionCode = '';
  let partnerId = '';
  let campaign = 'geral';
  let discountCents = 0;
  let explicitRuleId: string | null = null;

  if (input.couponCode) {
    const cpn = db
      .prepare(
        `SELECT id, partner_id, campaign, discount_type, discount_value, commission_rule_id, max_uses, used_count, valid_until
         FROM partner_coupons
         WHERE code = ? AND course_id = ? AND status = 'active'`,
      )
      .get(input.couponCode.trim().toUpperCase(), input.courseId) as
      | {
          id: string;
          partner_id: string;
          campaign: string;
          discount_type: string;
          discount_value: number;
          commission_rule_id: string | null;
          max_uses: number | null;
          used_count: number;
          valid_until: string | null;
        }
      | undefined;

    const notExpired = !cpn?.valid_until || new Date(cpn.valid_until).getTime() > Date.now();
    const withinLimit = !cpn?.max_uses || Number(cpn.used_count) < Number(cpn.max_uses);

    if (cpn && notExpired && withinLimit) {
      attributionSource = 'coupon';
      attributionCode = input.couponCode.trim().toUpperCase();
      partnerId = cpn.partner_id;
      campaign = cpn.campaign;
      explicitRuleId = cpn.commission_rule_id;
      if (cpn.discount_type === 'percent') {
        discountCents = Math.round((input.grossCents * Number(cpn.discount_value)) / 100);
      } else if (cpn.discount_type === 'fixed_cents') {
        discountCents = Math.min(input.grossCents, Number(cpn.discount_value));
      }
      db.prepare(`UPDATE partner_coupons SET used_count = used_count + 1 WHERE id = ?`).run(
        cpn.id,
      );
    }
  }

  if (!attributionSource && input.linkCode) {
    const lnk = db
      .prepare(
        `SELECT id, partner_id, campaign, max_uses, used_count, valid_until
         FROM partner_links
         WHERE code = ? AND course_id = ? AND status = 'active'`,
      )
      .get(input.linkCode.trim().toLowerCase(), input.courseId) as
      | {
          id: string;
          partner_id: string;
          campaign: string;
          max_uses: number | null;
          used_count: number;
          valid_until: string | null;
        }
      | undefined;

    const notExpired = !lnk?.valid_until || new Date(lnk.valid_until).getTime() > Date.now();
    const withinLimit = !lnk?.max_uses || Number(lnk.used_count) < Number(lnk.max_uses);

    if (lnk && notExpired && withinLimit) {
      attributionSource = 'link';
      attributionCode = input.linkCode.trim().toLowerCase();
      partnerId = lnk.partner_id;
      campaign = lnk.campaign;
      db.prepare(`UPDATE partner_links SET used_count = used_count + 1 WHERE id = ?`).run(lnk.id);
    }
  }

  if (!attributionSource || !partnerId) {
    return { attributed: false };
  }

  // Idempotência por (transaction_code, partner_id)
  const existing = db
    .prepare(
      `SELECT id, status FROM commission_entries WHERE transaction_code = ? AND partner_id = ?`,
    )
    .get(input.transactionCode, partnerId) as { id: string; status: string } | undefined;
  if (existing) {
    return { attributed: true, entryId: existing.id, status: existing.status };
  }

  // Busca regra versionada ativa (nunca retroativa em pedidos antigos)
  const rule = explicitRuleId
    ? (db.prepare(`SELECT * FROM commission_rules WHERE id = ?`).get(explicitRuleId) as
        | Record<string, unknown>
        | undefined)
    : (db
        .prepare(
          `SELECT * FROM commission_rules
           WHERE course_id = ? AND offer_sku = ? AND status = 'active'
           ORDER BY CASE WHEN campaign = ? THEN 0 ELSE 1 END, version DESC
           LIMIT 1`,
        )
        .get(input.courseId, input.offerSku, campaign) as Record<string, unknown> | undefined);

  if (!rule) {
    return { attributed: false };
  }

  const netAfterDiscount = Math.max(0, input.grossCents - discountCents);
  const calcBase = String(rule.calc_base);
  const commissionBaseCents =
    calcBase === 'net_after_gateway'
      ? Math.max(0, netAfterDiscount - input.gatewayFeeCents)
      : netAfterDiscount;

  const rateBps = Number(rule.rate_bps);
  const fixedCents = Number(rule.fixed_cents);
  const commissionCents = Math.round((commissionBaseCents * rateBps) / 10000) + fixedCents;

  // Antifraude proporcional: detecta autoindicação (mesmo e-mail do parceiro) -> revisão + recurso
  const partnerUser = db
    .prepare(
      `SELECT u.email_hash FROM partner_profiles pp
       INNER JOIN users u ON u.id = pp.user_id
       WHERE pp.id = ?`,
    )
    .get(partnerId) as { email_hash: string } | undefined;

  const isSelfReferral =
    Boolean(input.buyerEmailHash) &&
    Boolean(partnerUser?.email_hash) &&
    input.buyerEmailHash === partnerUser?.email_hash;

  const entryStatus = isSelfReferral ? 'under_review' : 'pending_warranty';
  const entryId = `ce_${crypto.randomUUID().replace(/-/g, '')}`;
  const snapshot = {
    ruleId: String(rule.id),
    ruleKey: String(rule.rule_key),
    version: Number(rule.version),
    calcBase,
    rateBps,
    fixedCents,
    warrantyDays: Number(rule.warranty_days),
    frozenAt: new Date().toISOString(),
  };

  // Comprador sempre mascarado — sem PII
  const buyerMaskedLabel = `Pedido #${input.transactionCode.slice(-8)}`;

  db.prepare(
    `INSERT INTO commission_entries (
       id, partner_id, course_id, offer_sku, transaction_code, source_event_id,
       attribution_source, attribution_code, buyer_masked_label,
       rule_id, rule_version, rule_snapshot_json,
       gross_cents, discount_cents, gateway_fee_cents, commission_base_cents, commission_cents,
       currency, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entryId,
    partnerId,
    input.courseId,
    input.offerSku,
    input.transactionCode,
    input.sourceEventId,
    attributionSource,
    attributionCode,
    buyerMaskedLabel,
    String(rule.id),
    Number(rule.version),
    JSON.stringify(snapshot),
    input.grossCents,
    discountCents,
    input.gatewayFeeCents,
    commissionBaseCents,
    commissionCents,
    input.currency || 'BRL',
    entryStatus,
  );

  recordAuditEvent(db, {
    actorRole: 'system',
    action: 'commission.attributed',
    targetType: 'commission_entry',
    targetId: entryId,
    metadata: {
      partnerId,
      ruleVersion: Number(rule.version),
      commissionCents,
      status: entryStatus,
    },
  });

  if (isSelfReferral) {
    const flagId = `flg_${crypto.randomUUID().replace(/-/g, '')}`;
    db.prepare(
      `INSERT INTO partner_fraud_flags (id, partner_id, commission_entry_id, signal_type, severity, status, detail)
       VALUES (?, ?, ?, 'self_referral', 'high', 'under_review', ?)`,
    ).run(
      flagId,
      partnerId,
      entryId,
      'Sinal de autoindicação detectado (mesmo e-mail do parceiro). Comissão encaminhada para revisão humana com direito a recurso.',
    );
    recordAuditEvent(db, {
      actorRole: 'system',
      action: 'partner.fraud_flagged',
      targetType: 'partner_fraud_flag',
      targetId: flagId,
      metadata: { partnerId, signalType: 'self_referral', entryId },
    });
  }

  return { attributed: true, entryId, status: entryStatus, fraudFlagged: isSelfReferral };
}

export function blockCommissionsByTransaction(
  db: DatabaseSync,
  input: { transactionCode: string; eventType: string; sourceEventId: string },
): number {
  const isChargeback =
    input.eventType === 'PURCHASE_CHARGEBACK' || input.eventType === 'PURCHASE_PROTEST';
  const nextStatus = isChargeback ? 'blocked_chargeback' : 'blocked_refund';

  const entries = db
    .prepare(
      `SELECT id, status FROM commission_entries
       WHERE transaction_code = ? AND status NOT IN ('blocked_refund', 'blocked_chargeback', 'paid')`,
    )
    .all(input.transactionCode) as Array<{ id: string; status: string }>;

  for (const e of entries) {
    db.prepare(
      `UPDATE commission_entries SET status = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(nextStatus, e.id);
    recordAuditEvent(db, {
      actorRole: 'system',
      action: `commission.${nextStatus}`,
      targetType: 'commission_entry',
      targetId: e.id,
      metadata: { eventType: input.eventType, sourceEventId: input.sourceEventId },
    });
  }

  return entries.length;
}

export function submitPartnerFraudAppeal(
  db: DatabaseSync,
  ctx: PartnerContext,
  flagId: string,
  appealNote: string,
): { ok: true } | { ok: false; status: number; error: string } {
  const cleanNote = appealNote.trim();
  if (cleanNote.length < 10 || cleanNote.length > 600) {
    return {
      ok: false,
      status: 400,
      error: 'Explique sua justificativa com pelo menos 10 caracteres.',
    };
  }

  const row = db
    .prepare(`SELECT id, partner_id, status FROM partner_fraud_flags WHERE id = ?`)
    .get(flagId) as { id: string; partner_id: string; status: string } | undefined;

  if (!row) {
    return { ok: false, status: 404, error: 'Sinalização não encontrada.' };
  }
  if (row.partner_id !== ctx.partnerId) {
    return { ok: false, status: 403, error: 'Acesso negado a registros de outro parceiro.' };
  }

  db.prepare(
    `UPDATE partner_fraud_flags
     SET status = 'appealed', appeal_note = ?, appealed_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`,
  ).run(cleanNote, flagId);

  recordAuditEvent(db, {
    actorUserId: ctx.userId,
    actorRole: ctx.roles.join(','),
    action: 'partner.fraud_appealed',
    targetType: 'partner_fraud_flag',
    targetId: flagId,
  });

  return { ok: true };
}

export function getPartnerDashboard(db: DatabaseSync, ctx: PartnerContext) {
  const links = partnerHasRole(ctx, ['affiliate', 'seller', 'partner'])
    ? (db
        .prepare(
          `SELECT pl.id, pl.course_id, pl.offer_sku, pl.code, pl.campaign, pl.clicks_count,
                  pl.used_count, pl.max_uses, pl.valid_until, pl.status, c.title AS course_title
           FROM partner_links pl
           INNER JOIN courses c ON c.id = pl.course_id
           WHERE pl.partner_id = ?
           ORDER BY pl.created_at DESC`,
        )
        .all(ctx.partnerId) as Array<Record<string, unknown>>)
    : [];

  const coupons = partnerHasRole(ctx, ['affiliate', 'seller', 'partner'])
    ? (db
        .prepare(
          `SELECT pc.id, pc.course_id, pc.offer_sku, pc.code, pc.campaign, pc.discount_type,
                  pc.discount_value, pc.used_count, pc.max_uses, pc.valid_until, pc.status,
                  c.title AS course_title
           FROM partner_coupons pc
           INNER JOIN courses c ON c.id = pc.course_id
           WHERE pc.partner_id = ?
           ORDER BY pc.created_at DESC`,
        )
        .all(ctx.partnerId) as Array<Record<string, unknown>>)
    : [];

  const assignments = partnerHasRole(ctx, ['instructor'])
    ? (db
        .prepare(
          `SELECT ia.id, ia.course_id, ia.role_label, ia.recording_status, ia.prep_checklist_json,
                  c.title AS course_title, le.title AS live_title, le.scheduled_at AS live_scheduled_at,
                  le.status AS live_status
           FROM instructor_assignments ia
           INNER JOIN courses c ON c.id = ia.course_id
           LEFT JOIN live_events le ON le.id = ia.live_event_id
           WHERE ia.partner_id = ?
           ORDER BY ia.created_at DESC`,
        )
        .all(ctx.partnerId) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        courseId: String(row.course_id),
        courseTitle: String(row.course_title),
        roleLabel: String(row.role_label),
        recordingStatus: String(row.recording_status),
        liveTitle: row.live_title ? String(row.live_title) : null,
        liveScheduledAt: row.live_scheduled_at ? String(row.live_scheduled_at) : null,
        liveStatus: row.live_status ? String(row.live_status) : null,
        checklist: JSON.parse(String(row.prep_checklist_json || '[]')) as Array<{
          label: string;
          done: boolean;
        }>,
      }))
    : [];

  const commissions = db
    .prepare(
      `SELECT ce.id, ce.transaction_code, ce.offer_sku, ce.attribution_source, ce.attribution_code,
              ce.buyer_masked_label, ce.rule_version, ce.gross_cents, ce.discount_cents,
              ce.commission_base_cents, ce.commission_cents, ce.currency, ce.status, ce.created_at,
              c.title AS course_title
       FROM commission_entries ce
       INNER JOIN courses c ON c.id = ce.course_id
       WHERE ce.partner_id = ?
       ORDER BY ce.created_at DESC`,
    )
    .all(ctx.partnerId) as Array<Record<string, unknown>>;

  const flags = db
    .prepare(
      `SELECT id, commission_entry_id, signal_type, severity, status, detail, appeal_note, created_at
       FROM partner_fraud_flags
       WHERE partner_id = ?
       ORDER BY created_at DESC`,
    )
    .all(ctx.partnerId) as Array<Record<string, unknown>>;

  const summary = {
    totalClicks: links.reduce((acc, l) => acc + Number(l.clicks_count || 0), 0),
    totalOrders: commissions.length,
    pendingWarrantyCents: 0,
    approvedCents: 0,
    blockedCents: 0,
    paidCents: 0,
    underReviewCents: 0,
  };

  for (const row of commissions) {
    const val = Number(row.commission_cents);
    const st = String(row.status);
    if (st === 'pending_warranty' || st === 'estimated') summary.pendingWarrantyCents += val;
    else if (st === 'approved') summary.approvedCents += val;
    else if (st === 'blocked_refund' || st === 'blocked_chargeback') summary.blockedCents += val;
    else if (st === 'paid') summary.paidCents += val;
    else if (st === 'under_review') summary.underReviewCents += val;
  }

  return {
    profile: {
      partnerId: ctx.partnerId,
      displayName: ctx.displayName,
      contactEmail: ctx.contactEmail,
      status: ctx.status,
      roles: ctx.roles,
      termsVersion: ctx.termsVersion,
      termsAcceptedAt: ctx.termsAcceptedAt,
      currentTermsVersion: CURRENT_PARTNER_TERMS_VERSION,
      payoutMethod: ctx.payoutMethod,
      payoutMaskedSummary: ctx.payoutMaskedSummary,
    },
    summary,
    links,
    coupons,
    assignments,
    commissions,
    fraudFlags: flags,
  };
}

export function exportPartnerStatementCsv(db: DatabaseSync, ctx: PartnerContext): string {
  const rows = db
    .prepare(
      `SELECT ce.created_at, ce.transaction_code, c.title AS course_title, ce.offer_sku,
              ce.attribution_source, ce.attribution_code, ce.buyer_masked_label, ce.rule_version,
              ce.gross_cents, ce.discount_cents, ce.commission_base_cents, ce.commission_cents,
              ce.currency, ce.status
       FROM commission_entries ce
       INNER JOIN courses c ON c.id = ce.course_id
       WHERE ce.partner_id = ?
       ORDER BY ce.created_at ASC`,
    )
    .all(ctx.partnerId) as Array<Record<string, unknown>>;

  const header = [
    'data_utc',
    'transacao',
    'curso',
    'sku',
    'origem',
    'codigo_atribuicao',
    'comprador_mascarado',
    'versao_regra',
    'bruto_centavos',
    'desconto_centavos',
    'base_comissao_centavos',
    'comissao_centavos',
    'moeda',
    'status',
  ].join(',');

  const escapeCsv = (val: unknown) => {
    const str = String(val ?? '');
    if (/[,"\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const lines = rows.map((r) =>
    [
      r.created_at,
      r.transaction_code,
      r.course_title,
      r.offer_sku,
      r.attribution_source,
      r.attribution_code,
      r.buyer_masked_label,
      r.rule_version,
      r.gross_cents,
      r.discount_cents,
      r.commission_base_cents,
      r.commission_cents,
      r.currency,
      r.status,
    ]
      .map(escapeCsv)
      .join(','),
  );

  return [header, ...lines].join('\n');
}

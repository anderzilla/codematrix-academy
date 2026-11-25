import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export interface AppendLedgerInput {
  entryType: 'sale' | 'refund' | 'chargeback' | 'adjustment';
  courseId?: string | null;
  offerSku?: string | null;
  partnerId?: string | null;
  transactionCode: string;
  sourceEventId?: string | null;
  grossCents?: number;
  discountCents?: number;
  gatewayFeeCents?: number;
  commissionCents?: number;
  refundCents?: number;
  chargebackCents?: number;
  currency?: string;
  competenceDate?: string;
  cashDate?: string | null;
  notes?: string;
}

export function appendLedgerEntry(db: DatabaseSync, input: AppendLedgerInput): string {
  // Evita duplicação pelo mesmo source_event_id + entry_type
  if (input.sourceEventId) {
    const existing = db
      .prepare(
        `SELECT id FROM financial_ledger WHERE source_event_id = ? AND entry_type = ? LIMIT 1`,
      )
      .get(input.sourceEventId, input.entryType) as { id: string } | undefined;
    if (existing) return existing.id;
  }

  const gross = Math.max(0, Math.round(input.grossCents ?? 0));
  const discount = Math.max(0, Math.round(input.discountCents ?? 0));
  const gatewayFee = Math.max(0, Math.round(input.gatewayFeeCents ?? 0));
  const commission = Math.max(0, Math.round(input.commissionCents ?? 0));
  const refund = Math.max(0, Math.round(input.refundCents ?? 0));
  const chargeback = Math.max(0, Math.round(input.chargebackCents ?? 0));
  const net = gross - discount - gatewayFee - commission - refund - chargeback;

  const id = `led_${crypto.randomUUID().replace(/-/g, '')}`;
  const competenceDate = input.competenceDate || new Date().toISOString().slice(0, 10);

  db.prepare(
    `INSERT INTO financial_ledger (
       id, entry_type, course_id, offer_sku, partner_id, transaction_code, source_event_id,
       gross_cents, discount_cents, gateway_fee_cents, commission_cents,
       refund_cents, chargeback_cents, net_cents, currency, competence_date, cash_date, notes
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.entryType,
    input.courseId ?? null,
    input.offerSku ?? null,
    input.partnerId ?? null,
    input.transactionCode,
    input.sourceEventId ?? null,
    gross,
    discount,
    gatewayFee,
    commission,
    refund,
    chargeback,
    net,
    input.currency || 'BRL',
    competenceDate,
    input.cashDate ?? null,
    input.notes ?? '',
  );

  return id;
}

export function exportLedgerCsv(db: DatabaseSync): string {
  const rows = db
    .prepare(
      `SELECT id, created_at, competence_date, cash_date, entry_type, transaction_code,
              source_event_id, course_id, offer_sku, partner_id,
              gross_cents, discount_cents, gateway_fee_cents, commission_cents,
              refund_cents, chargeback_cents, net_cents, currency, notes
       FROM financial_ledger
       ORDER BY created_at ASC`,
    )
    .all() as Array<Record<string, unknown>>;

  const header = [
    'ledger_id',
    'created_at_utc',
    'competence_date',
    'cash_date',
    'entry_type',
    'transaction_code',
    'source_event_id',
    'course_id',
    'offer_sku',
    'partner_id',
    'gross_cents',
    'discount_cents',
    'gateway_fee_cents',
    'commission_cents',
    'refund_cents',
    'chargeback_cents',
    'net_cents',
    'currency',
    'notes',
  ].join(',');

  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  return [
    header,
    ...rows.map((r) =>
      [
        r.id,
        r.created_at,
        r.competence_date,
        r.cash_date,
        r.entry_type,
        r.transaction_code,
        r.source_event_id,
        r.course_id,
        r.offer_sku,
        r.partner_id,
        r.gross_cents,
        r.discount_cents,
        r.gateway_fee_cents,
        r.commission_cents,
        r.refund_cents,
        r.chargeback_cents,
        r.net_cents,
        r.currency,
        r.notes,
      ]
        .map(esc)
        .join(','),
    ),
  ].join('\n');
}

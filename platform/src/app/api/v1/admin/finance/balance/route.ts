import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';

export async function GET() {
  const auth = await requireAdminSession({ requireMfa: true });
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  const db = getDb();
  const dre = db
    .prepare(
      `SELECT
         COUNT(*) AS total_entries,
         COALESCE(SUM(gross_cents), 0) AS gross_revenue_cents,
         COALESCE(SUM(discount_cents), 0) AS coupon_discounts_cents,
         COALESCE(SUM(gross_cents - discount_cents), 0) AS net_sales_cents,
         COALESCE(SUM(gateway_fee_cents), 0) AS gateway_fees_cents,
         COALESCE(SUM(commission_cents), 0) AS partner_commissions_cents,
         COALESCE(SUM(refund_cents), 0) AS refunds_cents,
         COALESCE(SUM(chargeback_cents), 0) AS chargebacks_cents,
         COALESCE(SUM(net_cents), 0) AS operating_net_result_cents
       FROM financial_ledger`,
    )
    .get();

  const byMethod = db
    .prepare(
      `SELECT payment_method, status, COUNT(*) AS orders_count, COALESCE(SUM(net_payable_cents), 0) AS total_cents
       FROM orders
       GROUP BY payment_method, status`,
    )
    .all();

  const partnerBalances = db
    .prepare(
      `SELECT status, COUNT(*) AS entries_count, COALESCE(SUM(commission_cents), 0) AS total_cents
       FROM commission_entries
       GROUP BY status`,
    )
    .all();

  return NextResponse.json({
    ok: true,
    currency: 'BRL',
    dre,
    ordersByPaymentMethod: byMethod,
    partnerCommissionBalances: partnerBalances,
  });
}

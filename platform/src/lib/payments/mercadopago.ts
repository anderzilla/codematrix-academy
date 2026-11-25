import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { hashEmail } from '@/lib/auth';
import { grantEntitlement, revokeOrSuspendByTransaction } from '@/lib/entitlements';
import { appendLedgerEntry } from '@/lib/ledger';
import { attributeHotmartCommission, blockCommissionsByTransaction } from '@/lib/partners';

export type PaymentMethod = 'pix' | 'credit_card' | 'google_pay' | 'apple_pay' | 'boleto';

export interface MercadoPagoConfig {
  mode: 'sandbox' | 'production';
  hasAccessToken: boolean;
  hasWebhookSecret: boolean;
  publicKey: string | null;
}

export function getMercadoPagoConfig(env: NodeJS.ProcessEnv = process.env): MercadoPagoConfig {
  const rawMode = (env.MERCADOPAGO_MODE || '').trim().toLowerCase();
  const mode =
    rawMode === 'sandbox'
      ? 'sandbox'
      : rawMode === 'production' || env.NODE_ENV === 'production'
        ? 'production'
        : 'sandbox';
  return {
    mode,
    hasAccessToken: Boolean(env.MERCADOPAGO_ACCESS_TOKEN?.trim()),
    hasWebhookSecret: Boolean(env.MERCADOPAGO_WEBHOOK_SECRET?.trim()),
    publicKey: env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() || null,
  };
}

/**
 * Estima taxa real do Mercado Pago por meio de pagamento:
 * - Pix: 0,99%
 * - Cartão / Google Pay / Apple Pay: 4,98% (liberação imediata; pode ser menor em D+30)
 * - Boleto: R$ 3,49 fixo
 */
export function estimateMercadoPagoFeeCents(
  netPayableCents: number,
  paymentMethod: PaymentMethod,
): number {
  if (netPayableCents <= 0) return 0;
  if (paymentMethod === 'pix') return Math.round(netPayableCents * 0.0099);
  if (paymentMethod === 'boleto') return 349;
  return Math.round(netPayableCents * 0.0498);
}

export function previewOfferDiscount(
  db: DatabaseSync,
  input: { courseId: string; grossCents: number; couponCode?: string | null },
): {
  validCoupon: boolean;
  couponCode: string | null;
  discountCents: number;
  netPayableCents: number;
  message: string;
} {
  const rawCode = input.couponCode?.trim().toUpperCase() || '';
  if (!rawCode) {
    return {
      validCoupon: false,
      couponCode: null,
      discountCents: 0,
      netPayableCents: input.grossCents,
      message: '',
    };
  }

  const cpn = db
    .prepare(
      `SELECT code, discount_type, discount_value, max_uses, used_count, valid_until
       FROM partner_coupons
       WHERE code = ? AND course_id = ? AND status = 'active'`,
    )
    .get(rawCode, input.courseId) as
    | {
        code: string;
        discount_type: string;
        discount_value: number;
        max_uses: number | null;
        used_count: number;
        valid_until: string | null;
      }
    | undefined;

  if (!cpn) {
    return {
      validCoupon: false,
      couponCode: null,
      discountCents: 0,
      netPayableCents: input.grossCents,
      message: 'Cupom não encontrado ou inativo para este curso.',
    };
  }
  if (cpn.valid_until && new Date(cpn.valid_until).getTime() <= Date.now()) {
    return {
      validCoupon: false,
      couponCode: null,
      discountCents: 0,
      netPayableCents: input.grossCents,
      message: 'Este cupom está expirado.',
    };
  }
  if (cpn.max_uses && Number(cpn.used_count) >= Number(cpn.max_uses)) {
    return {
      validCoupon: false,
      couponCode: null,
      discountCents: 0,
      netPayableCents: input.grossCents,
      message: 'Este cupom atingiu o limite máximo de usos.',
    };
  }

  let discountCents = 0;
  if (cpn.discount_type === 'percent') {
    discountCents = Math.round((input.grossCents * Number(cpn.discount_value)) / 100);
  } else if (cpn.discount_type === 'fixed_cents') {
    discountCents = Math.min(input.grossCents, Number(cpn.discount_value));
  }

  return {
    validCoupon: true,
    couponCode: cpn.code,
    discountCents,
    netPayableCents: Math.max(0, input.grossCents - discountCents),
    message: `Cupom ${cpn.code} aplicado!`,
  };
}

export async function createInternalCheckoutOrder(
  db: DatabaseSync,
  input: {
    offerCode: string;
    buyerEmail: string;
    userId?: string | null;
    paymentMethod: PaymentMethod;
    couponCode?: string | null;
    partnerLinkCode?: string | null;
  },
  env: NodeJS.ProcessEnv = process.env,
): Promise<
  | {
      ok: true;
      orderId: string;
      orderCode: string;
      grossCents: number;
      discountCents: number;
      netPayableCents: number;
      paymentMethod: PaymentMethod;
      providerMode: 'mercadopago_live' | 'sandbox_preview';
      checkoutUrl: string | null;
      pixCopyPaste: string | null;
      message: string;
    }
  | { ok: false; status: number; error: string }
> {
  const email = input.buyerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: 'Informe um e-mail válido para emissão do pedido.' };
  }

  const offer = db
    .prepare(
      `SELECT o.id, o.course_id, o.sku, o.title, o.price_cents, o.currency, o.is_free, o.status,
              c.slug AS course_slug
       FROM offers o
       INNER JOIN courses c ON c.id = o.course_id
       WHERE o.offer_code = ? AND o.status = 'published' AND c.status = 'published'`,
    )
    .get(input.offerCode.trim()) as
    | {
        id: string;
        course_id: string;
        sku: string;
        title: string;
        price_cents: number | null;
        currency: string;
        is_free: number;
        status: string;
        course_slug: string;
      }
    | undefined;

  if (!offer) {
    return { ok: false, status: 404, error: 'Oferta não encontrada ou ainda não publicada.' };
  }
  if (Number(offer.is_free) === 1) {
    return {
      ok: false,
      status: 400,
      error: 'Esta oferta é gratuita. Ative-a diretamente na Área do Aluno.',
    };
  }
  if (offer.price_cents === null || Number(offer.price_cents) <= 0) {
    return {
      ok: false,
      status: 400,
      error: 'O valor desta oferta ainda não foi definido pela equipe comercial.',
    };
  }

  const grossCents = Number(offer.price_cents);
  const discount = previewOfferDiscount(db, {
    courseId: offer.course_id,
    grossCents,
    couponCode: input.couponCode,
  });

  const orderId = `ord_${crypto.randomUUID().replace(/-/g, '')}`;
  const orderCode = `CMA-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(2)
    .toString('hex')
    .toUpperCase()}`;
  const buyerEmailHash = hashEmail(email);

  const mpToken = env.MERCADOPAGO_ACCESS_TOKEN?.trim() ?? '';
  const publicUrl = (env.ACADEMY_PUBLIC_URL || 'http://127.0.0.1:3100').replace(/\/+$/, '');
  let checkoutUrl: string | null = null;
  let pixCopyPaste: string | null = null;
  let providerPaymentId: string | null = null;
  let providerMode: 'mercadopago_live' | 'sandbox_preview' = 'sandbox_preview';

  if (mpToken) {
    try {
      if (input.paymentMethod === 'pix') {
        const res = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${mpToken}`,
            'content-type': 'application/json',
            'x-idempotency-key': orderCode,
          },
          body: JSON.stringify({
            transaction_amount: Number((discount.netPayableCents / 100).toFixed(2)),
            description: offer.title,
            payment_method_id: 'pix',
            external_reference: orderCode,
            notification_url: `${publicUrl}/api/webhooks/mercadopago`,
            payer: { email },
          }),
        });
        if (res.ok) {
          const mpData = (await res.json()) as {
            id?: number | string;
            point_of_interaction?: { transaction_data?: { qr_code?: string; ticket_url?: string } };
          };
          providerPaymentId = mpData.id ? String(mpData.id) : null;
          pixCopyPaste = mpData.point_of_interaction?.transaction_data?.qr_code ?? null;
          checkoutUrl = mpData.point_of_interaction?.transaction_data?.ticket_url ?? null;
          providerMode = 'mercadopago_live';
        }
      } else {
        const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${mpToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            external_reference: orderCode,
            notification_url: `${publicUrl}/api/webhooks/mercadopago`,
            payer: { email },
            items: [
              {
                id: offer.sku,
                title: offer.title,
                quantity: 1,
                currency_id: offer.currency || 'BRL',
                unit_price: Number((discount.netPayableCents / 100).toFixed(2)),
              },
            ],
            back_urls: {
              success: `${publicUrl}/app`,
              pending: `${publicUrl}/app`,
              failure: `${publicUrl}/oferta/${input.offerCode}`,
            },
            auto_return: 'approved',
          }),
        });
        if (res.ok) {
          const mpPref = (await res.json()) as { id?: string; init_point?: string };
          providerPaymentId = mpPref.id ?? null;
          checkoutUrl = mpPref.init_point ?? null;
          providerMode = 'mercadopago_live';
        }
      }
    } catch {
      // mantém falha segura sem aprovar pedido
    }
  } else if (getMercadoPagoConfig(env).mode === 'production') {
    return {
      ok: false,
      status: 503,
      error:
        'Gateway de pagamento Mercado Pago não configurado neste ambiente (fail-closed): defina MERCADOPAGO_ACCESS_TOKEN no Azure Key Vault.',
    };
  }

  db.prepare(
    `INSERT INTO orders (
       id, order_code, user_id, buyer_email_hash, course_id, offer_sku,
       gross_cents, discount_cents, net_payable_cents, currency, payment_method,
       provider, provider_payment_id, status, coupon_code, partner_link_code,
       checkout_url, pix_copy_paste
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'mercadopago', ?, 'pending', ?, ?, ?, ?)`,
  ).run(
    orderId,
    orderCode,
    input.userId ?? null,
    buyerEmailHash,
    offer.course_id,
    offer.sku,
    grossCents,
    discount.discountCents,
    discount.netPayableCents,
    offer.currency || 'BRL',
    input.paymentMethod,
    providerPaymentId,
    discount.couponCode,
    input.partnerLinkCode?.trim().toLowerCase() || null,
    checkoutUrl,
    pixCopyPaste,
  );

  return {
    ok: true,
    orderId,
    orderCode,
    grossCents,
    discountCents: discount.discountCents,
    netPayableCents: discount.netPayableCents,
    paymentMethod: input.paymentMethod,
    providerMode,
    checkoutUrl,
    pixCopyPaste,
    message:
      providerMode === 'mercadopago_live'
        ? 'Pedido criado no Mercado Pago. Conclua o pagamento para liberar o acesso automaticamente.'
        : 'Pedido criado em modo sandbox local. O acesso só será liberado após confirmação via webhook assinado (/api/webhooks/mercadopago).',
  };
}

/**
 * Valida assinatura oficial HMAC-SHA256 do Mercado Pago:
 * Header x-signature: "ts=<timestamp>,v1=<hex>"
 * Manifest: "id:<dataId>;request-id:<x-request-id>;ts:<ts>;"
 */
export function verifyMercadoPagoSignature(
  headers: Headers,
  dataId: string,
  env: NodeJS.ProcessEnv = process.env,
): { ok: true } | { ok: false; status: 401 | 503; code: string; error: string } {
  const secret = env.MERCADOPAGO_WEBHOOK_SECRET?.trim() ?? '';
  if (!secret) {
    return {
      ok: false,
      status: 503,
      code: 'missing_mp_webhook_secret',
      error:
        'Webhook Mercado Pago desativado (fail-closed): configure MERCADOPAGO_WEBHOOK_SECRET no servidor/Key Vault.',
    };
  }

  const sigHeader = headers.get('x-signature')?.trim() ?? '';
  const requestId = headers.get('x-request-id')?.trim() ?? '';
  const parts = Object.fromEntries(
    sigHeader.split(',').map((p) => {
      const [k, ...rest] = p.split('=');
      return [k?.trim(), rest.join('=').trim()];
    }),
  );

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1 || !dataId) {
    return { ok: false, status: 401, code: 'invalid_signature', error: 'Assinatura Mercado Pago ausente ou malformada.' };
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expectedHex = crypto.createHmac('sha256', secret).update(manifest, 'utf8').digest('hex');

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const providedBuf = Buffer.from(v1, 'hex');
  if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return { ok: false, status: 401, code: 'invalid_signature', error: 'Assinatura HMAC Mercado Pago inválida.' };
  }

  return { ok: true };
}

export function processMercadoPagoPaymentEvent(
  db: DatabaseSync,
  input: {
    eventId: string;
    orderCode: string;
    paymentStatus: 'approved' | 'refunded' | 'charged_back' | 'rejected' | 'pending';
    providerPaymentId: string;
    rawPayloadText: string;
  },
): {
  ok: true;
  duplicate: boolean;
  entitlementStatus: string;
} | { ok: false; status: number; error: string } {
  const existing = db
    .prepare(
      `SELECT id, entitlement_status FROM payment_events WHERE provider = 'mercadopago' AND provider_event_id = ?`,
    )
    .get(input.eventId) as { id: string; entitlement_status: string } | undefined;

  if (existing) {
    return { ok: true, duplicate: true, entitlementStatus: existing.entitlement_status };
  }

  const order = db
    .prepare(
      `SELECT o.*, ofr.access_scope
       FROM orders o
       INNER JOIN offers ofr ON ofr.sku = o.offer_sku
       WHERE o.order_code = ?`,
    )
    .get(input.orderCode) as
    | {
        id: string;
        order_code: string;
        user_id: string | null;
        buyer_email_hash: string;
        course_id: string;
        offer_sku: string;
        gross_cents: number;
        discount_cents: number;
        net_payable_cents: number;
        currency: string;
        payment_method: PaymentMethod;
        coupon_code: string | null;
        partner_link_code: string | null;
        access_scope: string;
      }
    | undefined;

  if (!order) {
    return { ok: false, status: 404, error: 'Pedido interno não encontrado para external_reference.' };
  }

  const feeCents = estimateMercadoPagoFeeCents(
    Number(order.net_payable_cents),
    order.payment_method,
  );
  const payloadSha256 = crypto.createHash('sha256').update(input.rawPayloadText, 'utf8').digest('hex');
  const recordId = `pe_${crypto.randomUUID().replace(/-/g, '')}`;
  let entitlementStatus = 'no_change';

  db.exec('BEGIN');
  try {
    if (input.paymentStatus === 'approved') {
      db.prepare(
        `UPDATE orders SET status = 'approved', provider_payment_id = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(input.providerPaymentId, order.id);

      grantEntitlement(db, {
        userId: order.user_id,
        buyerEmailHash: order.buyer_email_hash,
        courseId: order.course_id,
        offerSku: order.offer_sku,
        accessScope: order.access_scope,
        sourceProvider: 'mercadopago',
        sourceEventId: input.eventId,
        transactionCode: order.order_code,
        reason: `Pagamento Mercado Pago aprovado (${order.payment_method})`,
        actor: 'mercadopago_webhook',
      });
      entitlementStatus = 'granted';

      const comm = attributeHotmartCommission(db, {
        courseId: order.course_id,
        offerSku: order.offer_sku,
        transactionCode: order.order_code,
        sourceEventId: input.eventId,
        grossCents: Number(order.gross_cents),
        gatewayFeeCents: feeCents,
        currency: order.currency,
        buyerEmailHash: order.buyer_email_hash,
        couponCode: order.coupon_code,
        linkCode: order.partner_link_code,
      });

      let commissionCents = 0;
      let partnerId: string | null = null;
      if (comm.attributed && comm.entryId) {
        const ce = db
          .prepare(`SELECT partner_id, commission_cents FROM commission_entries WHERE id = ?`)
          .get(comm.entryId) as { partner_id: string; commission_cents: number } | undefined;
        if (ce) {
          partnerId = ce.partner_id;
          commissionCents = Number(ce.commission_cents);
        }
      }

      appendLedgerEntry(db, {
        entryType: 'sale',
        courseId: order.course_id,
        offerSku: order.offer_sku,
        partnerId,
        transactionCode: order.order_code,
        sourceEventId: input.eventId,
        grossCents: Number(order.gross_cents),
        discountCents: Number(order.discount_cents),
        gatewayFeeCents: feeCents,
        commissionCents,
        currency: order.currency,
        notes: `Venda própria Mercado Pago (${order.payment_method})`,
      });
    } else if (input.paymentStatus === 'refunded' || input.paymentStatus === 'charged_back') {
      const isCb = input.paymentStatus === 'charged_back';
      db.prepare(
        `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(isCb ? 'chargeback' : 'refunded', order.id);

      const eventName = isCb ? 'PURCHASE_CHARGEBACK' : 'PURCHASE_REFUNDED';
      const revoked = revokeOrSuspendByTransaction(db, {
        transactionCode: order.order_code,
        eventType: eventName,
        sourceEventId: input.eventId,
      });
      blockCommissionsByTransaction(db, {
        transactionCode: order.order_code,
        eventType: eventName,
        sourceEventId: input.eventId,
      });
      appendLedgerEntry(db, {
        entryType: isCb ? 'chargeback' : 'refund',
        courseId: order.course_id,
        offerSku: order.offer_sku,
        transactionCode: order.order_code,
        sourceEventId: input.eventId,
        refundCents: isCb ? 0 : Number(order.net_payable_cents),
        chargebackCents: isCb ? Number(order.net_payable_cents) : 0,
        currency: order.currency,
        notes: `Estorno Mercado Pago (${input.paymentStatus})`,
      });
      entitlementStatus = revoked.targetStatus;
    }

    db.prepare(
      `INSERT INTO payment_events (
         id, provider, provider_event_id, event_type, course_id, offer_sku,
         transaction_code, buyer_email_hash, payload_sha256, payload_sanitized_json,
         processing_status, entitlement_status
       ) VALUES (?, 'mercadopago', ?, ?, ?, ?, ?, ?, ?, ?, 'processed', ?)`,
    ).run(
      recordId,
      input.eventId,
      `MP_${input.paymentStatus.toUpperCase()}`,
      order.course_id,
      order.offer_sku,
      order.order_code,
      order.buyer_email_hash,
      payloadSha256,
      JSON.stringify({
        eventId: input.eventId,
        orderCode: order.order_code,
        paymentStatus: input.paymentStatus,
        paymentMethod: order.payment_method,
      }),
      entitlementStatus,
    );

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return { ok: true, duplicate: false, entitlementStatus };
}

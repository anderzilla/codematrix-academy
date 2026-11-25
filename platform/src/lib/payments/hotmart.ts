import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { PublicOfferItem } from '@/lib/catalog';

export const ALLOWED_HOTMART_EVENTS = new Set([
  'PURCHASE_APPROVED',
  'PURCHASE_COMPLETE',
  'PURCHASE_CANCELED',
  'PURCHASE_REFUNDED',
  'PURCHASE_CHARGEBACK',
  'PURCHASE_PROTEST',
  'PURCHASE_DELAYED',
  'PURCHASE_BILLET_PRINTED',
]);

export interface HotmartProductMapping {
  productId?: string;
  offerCode?: string;
  checkoutUrl?: string;
}

export interface HotmartAdapterConfig {
  mode: 'sandbox' | 'production';
  isProduction: boolean;
  hasHottok: boolean;
  checkoutBaseUrl: string;
  productMap: Record<string, HotmartProductMapping>;
}

export interface CheckoutResolution {
  state: 'free_sample' | 'ready' | 'unconfigured_fail_closed' | 'sandbox_unavailable';
  checkoutUrl: string | null;
  message: string;
}

export interface HottokVerificationResult {
  ok: boolean;
  status: 200 | 401 | 503;
  code: 'ok' | 'missing_hottok_config' | 'invalid_hottok';
  message: string;
}

export interface NormalizedHotmartEvent {
  providerEventId: string;
  eventType: string;
  hotmartProductId: string;
  offerCode: string | null;
  transactionCode: string;
  buyerEmailHash: string | null;
  sanitizedPayload: Record<string, unknown>;
}

export function getHotmartConfig(env: NodeJS.ProcessEnv = process.env): HotmartAdapterConfig {
  const rawMode = (env.HOTMART_MODE || 'sandbox').toLowerCase();
  const isProduction = env.NODE_ENV === 'production' || rawMode === 'production';
  const mode: 'sandbox' | 'production' = isProduction ? 'production' : 'sandbox';
  const hottok = env.HOTMART_HOTTOK?.trim() ?? '';
  const checkoutBaseUrl = (env.HOTMART_CHECKOUT_BASE_URL || 'https://pay.hotmart.com').replace(/\/+$/, '');

  let productMap: Record<string, HotmartProductMapping> = {};
  if (env.HOTMART_PRODUCT_MAP_JSON?.trim()) {
    try {
      const parsed = JSON.parse(env.HOTMART_PRODUCT_MAP_JSON) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        productMap = parsed as Record<string, HotmartProductMapping>;
      }
    } catch {
      productMap = {};
    }
  }

  return {
    mode,
    isProduction,
    hasHottok: hottok.length > 0,
    checkoutBaseUrl,
    productMap,
  };
}

export function resolveCheckoutTarget(
  offer: PublicOfferItem,
  env: NodeJS.ProcessEnv = process.env,
): CheckoutResolution {
  if (offer.isFree) {
    return {
      state: 'free_sample',
      checkoutUrl: null,
      message:
        'Amostra gratuita explícita (Bloco 1). O acesso autenticado do aluno será ativado na Etapa 2 em /app.',
    };
  }

  const config = getHotmartConfig(env);
  const mapped = config.productMap[offer.sku];
  const productId = mapped?.productId || offer.hotmartProductId;
  const offerCode = mapped?.offerCode || offer.hotmartOfferCode;

  if (!config.hasHottok || (!mapped?.checkoutUrl && !offerCode && !productId)) {
    if (config.isProduction) {
      return {
        state: 'unconfigured_fail_closed',
        checkoutUrl: null,
        message:
          'Checkout indisponível: credenciais Hotmart (HOTMART_HOTTOK e mapeamento do SKU) não configuradas neste ambiente. Falha fechada por segurança.',
      };
    }
    return {
      state: 'sandbox_unavailable',
      checkoutUrl: null,
      message:
        'Ambiente sandbox sem checkout externo vinculado para este SKU. Configure HOTMART_HOTTOK e HOTMART_PRODUCT_MAP_JSON ou teste o endpoint POST /api/webhooks/hotmart com fixtures locais.',
    };
  }

  if (mapped?.checkoutUrl) {
    try {
      const parsed = new URL(mapped.checkoutUrl);
      if (parsed.protocol === 'https:') {
        return {
          state: 'ready',
          checkoutUrl: parsed.toString(),
          message: 'Checkout externo Hotmart configurado.',
        };
      }
    } catch {
      // ignora URL inválida e falha fechado abaixo
    }
  }

  if (offerCode) {
    return {
      state: 'ready',
      checkoutUrl: `${config.checkoutBaseUrl}/${encodeURIComponent(offerCode)}`,
      message: 'Checkout externo Hotmart configurado por código de oferta.',
    };
  }

  return {
    state: 'unconfigured_fail_closed',
    checkoutUrl: null,
    message: 'Configuração de checkout Hotmart incompleta para este SKU.',
  };
}

export function verifyHottok(
  headerValue: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): HottokVerificationResult {
  const expected = env.HOTMART_HOTTOK?.trim() ?? '';
  if (!expected) {
    return {
      ok: false,
      status: 503,
      code: 'missing_hottok_config',
      message:
        'Webhook Hotmart desativado (fail-closed): defina HOTMART_HOTTOK no servidor/Secret Manager antes de receber eventos.',
    };
  }

  const provided = headerValue?.trim() ?? '';
  if (!provided) {
    return {
      ok: false,
      status: 401,
      code: 'invalid_hottok',
      message: 'Header X-HOTMART-HOTTOK ausente ou inválido.',
    };
  }

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return {
      ok: false,
      status: 401,
      code: 'invalid_hottok',
      message: 'Header X-HOTMART-HOTTOK inválido.',
    };
  }

  const valid = crypto.timingSafeEqual(expectedBuf, providedBuf);
  if (!valid) {
    return {
      ok: false,
      status: 401,
      code: 'invalid_hottok',
      message: 'Header X-HOTMART-HOTTOK inválido.',
    };
  }

  return {
    ok: true,
    status: 200,
    code: 'ok',
    message: 'Credencial validada.',
  };
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function validateAndNormalizeHotmartPayload(
  payload: unknown,
): { ok: true; data: NormalizedHotmartEvent } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Payload JSON deve ser um objeto.' };
  }

  const obj = payload as Record<string, unknown>;
  const providerEventId = typeof obj.id === 'string' ? obj.id.trim() : '';
  const eventType = typeof obj.event === 'string' ? obj.event.trim().toUpperCase() : '';

  if (!providerEventId || providerEventId.length > 128) {
    return { ok: false, error: 'Campo obrigatório "id" ausente ou inválido.' };
  }
  if (!ALLOWED_HOTMART_EVENTS.has(eventType)) {
    return { ok: false, error: `Tipo de evento "${eventType || 'vazio'}" não suportado.` };
  }

  const data = obj.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'Campo obrigatório "data" ausente.' };
  }
  const dataObj = data as Record<string, unknown>;
  const product = dataObj.product as Record<string, unknown> | undefined;
  const purchase = dataObj.purchase as Record<string, unknown> | undefined;
  const buyer = dataObj.buyer as Record<string, unknown> | undefined;

  const productIdRaw = product?.id;
  const hotmartProductId =
    typeof productIdRaw === 'string' || typeof productIdRaw === 'number'
      ? String(productIdRaw).trim()
      : '';
  const transactionCode =
    typeof purchase?.transaction === 'string' ? purchase.transaction.trim() : '';

  if (!hotmartProductId) {
    return { ok: false, error: 'Campo obrigatório "data.product.id" ausente.' };
  }
  if (!transactionCode) {
    return { ok: false, error: 'Campo obrigatório "data.purchase.transaction" ausente.' };
  }

  const offerObj = purchase?.offer as Record<string, unknown> | undefined;
  const offerCode = typeof offerObj?.code === 'string' ? offerObj.code.trim() : null;

  const buyerEmailRaw = typeof buyer?.email === 'string' ? buyer.email.trim().toLowerCase() : '';
  const buyerEmailHash = buyerEmailRaw ? sha256Hex(buyerEmailRaw) : null;

  const priceObj = purchase?.price as Record<string, unknown> | undefined;

  // Apenas campos operacionais mínimos — sem cartão, CPF, endereço, telefone ou segredos
  const sanitizedPayload: Record<string, unknown> = {
    id: providerEventId,
    event: eventType,
    creation_date: typeof obj.creation_date === 'number' ? obj.creation_date : null,
    product_id: hotmartProductId,
    offer_code: offerCode,
    transaction: transactionCode,
    purchase_status: typeof purchase?.status === 'string' ? purchase.status : null,
    currency: typeof priceObj?.currency_value === 'string' ? priceObj.currency_value : null,
    value: typeof priceObj?.value === 'number' ? priceObj.value : null,
    buyer_email_hash: buyerEmailHash,
  };

  return {
    ok: true,
    data: {
      providerEventId,
      eventType,
      hotmartProductId,
      offerCode,
      transactionCode,
      buyerEmailHash,
      sanitizedPayload,
    },
  };
}

export function recordHotmartWebhookEvent(
  db: DatabaseSync,
  normalized: NormalizedHotmartEvent,
  rawPayloadText: string,
): {
  duplicate: boolean;
  recordId: string;
  providerEventId: string;
  entitlementStatus: 'deferred_to_stage_2';
} {
  const existing = db
    .prepare(
      `SELECT id FROM payment_events WHERE provider = 'hotmart' AND provider_event_id = ?`,
    )
    .get(normalized.providerEventId) as { id: string } | undefined;

  if (existing) {
    return {
      duplicate: true,
      recordId: existing.id,
      providerEventId: normalized.providerEventId,
      entitlementStatus: 'deferred_to_stage_2',
    };
  }

  // Resolve oferta/curso vinculado, se houver mapeamento no banco
  const offerMatch = db
    .prepare(
      `SELECT course_id, sku
       FROM offers
       WHERE hotmart_product_id = ? OR (? IS NOT NULL AND hotmart_offer_code = ?)
       LIMIT 1`,
    )
    .get(normalized.hotmartProductId, normalized.offerCode, normalized.offerCode) as
    | { course_id: string; sku: string }
    | undefined;

  const recordId = `pe_${crypto.randomUUID().replace(/-/g, '')}`;
  const payloadSha256 = sha256Hex(rawPayloadText);

  try {
    db.prepare(
      `INSERT INTO payment_events (
         id, provider, provider_event_id, event_type, course_id, offer_sku,
         hotmart_product_id, transaction_code, buyer_email_hash,
         payload_sha256, payload_sanitized_json, processing_status, entitlement_status
       ) VALUES (?, 'hotmart', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recorded_stage1', 'deferred_to_stage_2')`,
    ).run(
      recordId,
      normalized.providerEventId,
      normalized.eventType,
      offerMatch?.course_id ?? null,
      offerMatch?.sku ?? null,
      normalized.hotmartProductId,
      normalized.transactionCode,
      normalized.buyerEmailHash,
      payloadSha256,
      JSON.stringify(normalized.sanitizedPayload),
    );
  } catch (err) {
    // Trata condição de corrida concorrente com a constraint UNIQUE(provider, provider_event_id)
    const retryExisting = db
      .prepare(
        `SELECT id FROM payment_events WHERE provider = 'hotmart' AND provider_event_id = ?`,
      )
      .get(normalized.providerEventId) as { id: string } | undefined;
    if (retryExisting) {
      return {
        duplicate: true,
        recordId: retryExisting.id,
        providerEventId: normalized.providerEventId,
        entitlementStatus: 'deferred_to_stage_2',
      };
    }
    throw err;
  }

  return {
    duplicate: false,
    recordId,
    providerEventId: normalized.providerEventId,
    entitlementStatus: 'deferred_to_stage_2',
  };
}

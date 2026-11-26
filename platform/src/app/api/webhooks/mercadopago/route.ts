import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  processMercadoPagoPaymentEvent,
  verifyMercadoPagoSignature,
} from '@/lib/payments/mercadopago';

type InternalPaymentStatus = 'approved' | 'refunded' | 'charged_back' | 'rejected' | 'pending';

function normalizeMercadoPagoStatus(raw: string): InternalPaymentStatus | null {
  const s = raw.trim().toLowerCase();
  if (s === 'approved' || s === 'processed' || s === 'accredited') return 'approved';
  if (s === 'refunded' || s === 'partially_refunded') return 'refunded';
  if (s === 'charged_back') return 'charged_back';
  if (s === 'rejected' || s === 'failed' || s === 'canceled' || s === 'cancelled' || s === 'expired') {
    return 'rejected';
  }
  if (s === 'pending' || s === 'in_process' || s === 'created' || s === 'action_required') {
    return 'pending';
  }
  return null;
}

async function fetchOrderOrPaymentFromMercadoPagoApi(
  resourceId: string,
  eventType: string,
): Promise<{
  externalReference: string;
  status: InternalPaymentStatus;
} | null> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token || !resourceId) return null;

  const isOrder =
    eventType === 'order' ||
    eventType.startsWith('order.') ||
    resourceId.toUpperCase().startsWith('ORD');
  const endpoint = isOrder
    ? `https://api.mercadopago.com/v1/orders/${encodeURIComponent(resourceId)}`
    : `https://api.mercadopago.com/v1/payments/${encodeURIComponent(resourceId)}`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      external_reference?: unknown;
      status?: unknown;
      transactions?: { payments?: Array<{ status?: unknown }> };
    };
    const externalReference =
      typeof json.external_reference === 'string' ? json.external_reference.trim() : '';
    const primaryStatus = typeof json.status === 'string' ? json.status : '';
    const nestedPaymentStatus =
      typeof json.transactions?.payments?.[0]?.status === 'string'
        ? json.transactions.payments[0].status
        : '';
    const normalized =
      normalizeMercadoPagoStatus(primaryStatus) || normalizeMercadoPagoStatus(nestedPaymentStatus);
    if (!externalReference || !normalized) return null;
    return { externalReference, status: normalized };
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: 'mercadopago',
    api: 'orders_and_payments',
    webhook: 'ready',
    signatureRequired: true,
  });
}

export async function POST(request: Request) {
  const rawText = await request.text();
  if (Buffer.byteLength(rawText, 'utf8') > 65_536) {
    return NextResponse.json({ ok: false, error: 'Payload excede limite.' }, { status: 413 });
  }

  let parsed: {
    id?: unknown;
    type?: unknown;
    action?: unknown;
    live_mode?: unknown;
    data?: {
      id?: unknown;
      external_reference?: unknown;
      status?: unknown;
      transactions?: { payments?: Array<{ status?: unknown }> };
    };
  };
  try {
    parsed = JSON.parse(rawText) as typeof parsed;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const url = new URL(request.url);
  const dataId =
    parsed.data?.id !== undefined
      ? String(parsed.data.id)
      : url.searchParams.get('data.id') || '';

  const sig = verifyMercadoPagoSignature(request.headers, dataId);
  if (!sig.ok) {
    return NextResponse.json({ ok: false, code: sig.code, error: sig.error }, { status: sig.status });
  }

  const eventType =
    typeof parsed.type === 'string'
      ? parsed.type.trim().toLowerCase()
      : typeof parsed.action === 'string'
        ? parsed.action.trim().toLowerCase()
        : '';

  // Aceita eventos de Orders API ("order" / "order.*") e Payments API ("payment")
  if (
    eventType &&
    eventType !== 'payment' &&
    eventType !== 'order' &&
    !eventType.startsWith('order.') &&
    !eventType.startsWith('payment.')
  ) {
    return NextResponse.json({ ok: true, ignored: true, type: eventType }, { status: 200 });
  }

  let orderCode =
    typeof parsed.data?.external_reference === 'string'
      ? parsed.data.external_reference.trim()
      : '';
  let normalizedStatus =
    (typeof parsed.data?.status === 'string'
      ? normalizeMercadoPagoStatus(parsed.data.status)
      : null) ||
    (typeof parsed.data?.transactions?.payments?.[0]?.status === 'string'
      ? normalizeMercadoPagoStatus(parsed.data.transactions.payments[0].status)
      : null);

  // Fluxo real de produção: consulta GET /v1/orders/{id} (ou /v1/payments/{id}) no Mercado Pago
  if ((!orderCode || !normalizedStatus) && dataId) {
    const mpDetails = await fetchOrderOrPaymentFromMercadoPagoApi(dataId, eventType);
    if (mpDetails) {
      orderCode = mpDetails.externalReference;
      normalizedStatus = mpDetails.status;
    }
  }

  // Notificações de teste do painel Mercado Pago (sem pedido real no banco)
  if ((!orderCode || !normalizedStatus) && parsed.live_mode === false && (dataId === '123456' || dataId.startsWith('ORD01TEST'))) {
    return NextResponse.json(
      { ok: true, testNotification: true, message: 'Assinatura HMAC validada com sucesso.' },
      { status: 200 },
    );
  }

  if (!orderCode || !normalizedStatus) {
    return NextResponse.json(
      { ok: false, error: 'Payload de webhook Mercado Pago sem external_reference ou status válido.' },
      { status: 400 },
    );
  }

  const db = getDb();
  const eventId = parsed.id ? String(parsed.id) : `mp_${dataId}_${normalizedStatus}`;
  const res = processMercadoPagoPaymentEvent(db, {
    eventId,
    orderCode,
    paymentStatus: normalizedStatus,
    providerPaymentId: dataId || eventId,
    rawPayloadText: rawText,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }

  return NextResponse.json(res, { status: 200 });
}

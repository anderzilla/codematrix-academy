import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  processMercadoPagoPaymentEvent,
  verifyMercadoPagoSignature,
} from '@/lib/payments/mercadopago';

const ALLOWED_STATUSES = new Set(['approved', 'refunded', 'charged_back', 'rejected', 'pending']);

async function fetchPaymentFromMercadoPagoApi(paymentId: string): Promise<{
  externalReference: string;
  status: string;
} | null> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token || !paymentId) return null;

  try {
    const res = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      external_reference?: unknown;
      status?: unknown;
    };
    const externalReference =
      typeof json.external_reference === 'string' ? json.external_reference.trim() : '';
    const status = typeof json.status === 'string' ? json.status.trim().toLowerCase() : '';
    if (!externalReference || !status) return null;
    return { externalReference, status };
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: 'mercadopago',
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
    data?: { id?: unknown; external_reference?: unknown; status?: unknown };
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

  // Ignora silenciosamente eventos que não são de pagamento (ex.: merchant_order) após assinatura válida
  if (parsed.type && parsed.type !== 'payment') {
    return NextResponse.json({ ok: true, ignored: true, type: parsed.type }, { status: 200 });
  }

  let orderCode =
    typeof parsed.data?.external_reference === 'string'
      ? parsed.data.external_reference.trim()
      : '';
  let statusRaw =
    typeof parsed.data?.status === 'string' ? parsed.data.status.trim().toLowerCase() : '';

  // Fluxo real de produção do Mercado Pago: webhook envia apenas data.id e consultamos a API oficial
  if ((!orderCode || !ALLOWED_STATUSES.has(statusRaw)) && dataId) {
    const mpDetails = await fetchPaymentFromMercadoPagoApi(dataId);
    if (mpDetails) {
      orderCode = mpDetails.externalReference;
      statusRaw = mpDetails.status;
    }
  }

  // Notificações de teste do painel Mercado Pago (data.id = "123456" sem pedido real)
  if ((!orderCode || !ALLOWED_STATUSES.has(statusRaw)) && parsed.live_mode === false && dataId === '123456') {
    return NextResponse.json(
      { ok: true, testNotification: true, message: 'Assinatura HMAC validada com sucesso.' },
      { status: 200 },
    );
  }

  if (!orderCode || !ALLOWED_STATUSES.has(statusRaw)) {
    return NextResponse.json(
      { ok: false, error: 'Payload de webhook Mercado Pago sem external_reference ou status válido.' },
      { status: 400 },
    );
  }

  const db = getDb();
  const eventId = parsed.id ? String(parsed.id) : `mp_${dataId}_${statusRaw}`;
  const res = processMercadoPagoPaymentEvent(db, {
    eventId,
    orderCode,
    paymentStatus: statusRaw as 'approved' | 'refunded' | 'charged_back' | 'rejected' | 'pending',
    providerPaymentId: dataId || eventId,
    rawPayloadText: rawText,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }

  return NextResponse.json(res, { status: 200 });
}

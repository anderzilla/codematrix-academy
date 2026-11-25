import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  processMercadoPagoPaymentEvent,
  verifyMercadoPagoSignature,
} from '@/lib/payments/mercadopago';

export async function POST(request: Request) {
  const rawText = await request.text();
  if (Buffer.byteLength(rawText, 'utf8') > 65_536) {
    return NextResponse.json({ ok: false, error: 'Payload excede limite.' }, { status: 413 });
  }

  let parsed: {
    id?: unknown;
    type?: unknown;
    data?: { id?: unknown; external_reference?: unknown; status?: unknown };
  };
  try {
    parsed = JSON.parse(rawText) as typeof parsed;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const dataId = parsed.data?.id !== undefined ? String(parsed.data.id) : '';
  const sig = verifyMercadoPagoSignature(request.headers, dataId);
  if (!sig.ok) {
    return NextResponse.json({ ok: false, code: sig.code, error: sig.error }, { status: sig.status });
  }

  const orderCode =
    typeof parsed.data?.external_reference === 'string'
      ? parsed.data.external_reference.trim()
      : '';
  const statusRaw =
    typeof parsed.data?.status === 'string' ? parsed.data.status.trim().toLowerCase() : '';
  const allowedStatuses = new Set(['approved', 'refunded', 'charged_back', 'rejected', 'pending']);

  if (!orderCode || !allowedStatuses.has(statusRaw)) {
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

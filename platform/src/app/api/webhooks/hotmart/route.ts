import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  recordHotmartWebhookEvent,
  validateAndNormalizeHotmartPayload,
  verifyHottok,
} from '@/lib/payments/hotmart';

const MAX_BODY_BYTES = 65_536;

export async function POST(request: Request) {
  const auth = verifyHottok(request.headers.get('x-hotmart-hottok'));
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawText = await request.text();
  if (Buffer.byteLength(rawText, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, code: 'payload_too_large', message: 'Payload excede o limite permitido.' },
      { status: 413 },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return NextResponse.json(
      { ok: false, code: 'invalid_json', message: 'Corpo da requisição não é JSON válido.' },
      { status: 400 },
    );
  }

  const validation = validateAndNormalizeHotmartPayload(parsed);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, code: 'invalid_schema', message: validation.error },
      { status: 400 },
    );
  }

  const db = getDb();
  const result = recordHotmartWebhookEvent(db, validation.data, rawText);

  return NextResponse.json(
    {
      ok: true,
      duplicate: result.duplicate,
      eventId: result.providerEventId,
      recordId: result.recordId,
      entitlementGranted: false,
      entitlementStatus: result.entitlementStatus,
    },
    { status: 200 },
  );
}

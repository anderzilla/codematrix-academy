import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  createInternalCheckoutOrder,
  type PaymentMethod,
} from '@/lib/payments/mercadopago';
import { verifyCsrfOrigin } from '@/lib/security';

const ALLOWED_METHODS = new Set<PaymentMethod>([
  'pix',
  'credit_card',
  'google_pay',
  'apple_pay',
  'boleto',
]);

export async function POST(request: Request) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, error: csrf.error }, { status: 403 });
  }

  let body: {
    offerCode?: unknown;
    buyerEmail?: unknown;
    paymentMethod?: unknown;
    couponCode?: unknown;
    partnerLinkCode?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const user = await getSessionUser();
  const cookieStore = await cookies();
  const refFromCookie = cookieStore.get('cm_partner_ref')?.value || null;
  const rawMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.trim() : 'pix';
  const paymentMethod: PaymentMethod = ALLOWED_METHODS.has(rawMethod as PaymentMethod)
    ? (rawMethod as PaymentMethod)
    : 'pix';

  const db = getDb();
  const res = await createInternalCheckoutOrder(db, {
    offerCode: typeof body.offerCode === 'string' ? body.offerCode : '',
    buyerEmail:
      typeof body.buyerEmail === 'string' && body.buyerEmail.trim()
        ? body.buyerEmail
        : user?.email || '',
    userId: user?.id ?? null,
    paymentMethod,
    couponCode: typeof body.couponCode === 'string' ? body.couponCode : null,
    partnerLinkCode:
      typeof body.partnerLinkCode === 'string' && body.partnerLinkCode.trim()
        ? body.partnerLinkCode
        : refFromCookie,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }

  return NextResponse.json(res, { status: 201 });
}

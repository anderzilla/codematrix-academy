import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getMailerConfig } from '@/lib/mailer';
import { getMercadoPagoConfig } from '@/lib/payments/mercadopago';
import { getPersistenceTopology } from '@/lib/persistence/nosql';

export async function GET() {
  try {
    const db = getDb();
    db.prepare('SELECT 1 AS ok').get();
    return NextResponse.json({
      ok: true,
      service: 'codematrix-academy',
      timestamp: new Date().toISOString(),
      payments: getMercadoPagoConfig().mode,
      mailer: getMailerConfig().provider,
      persistence: getPersistenceTopology(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 });
  }
}

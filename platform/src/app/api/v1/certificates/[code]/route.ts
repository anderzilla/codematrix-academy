import { NextResponse } from 'next/server';
import { getPublicCertificateByCode } from '@/lib/certificates';
import { getDb } from '@/lib/db';

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const db = getDb();
  const cert = getPublicCertificateByCode(db, code);

  if (!cert) {
    return NextResponse.json(
      { ok: false, status: 'not_found', message: 'Certificado não encontrado.' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    certificate: cert,
  });
}

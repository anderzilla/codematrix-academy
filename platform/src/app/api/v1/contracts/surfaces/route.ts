import { NextResponse } from 'next/server';
import { ACADEMY_SURFACES } from '@/lib/contracts';

export async function GET() {
  return NextResponse.json({
    ok: true,
    stage: 1,
    surfaces: ACADEMY_SURFACES,
  });
}

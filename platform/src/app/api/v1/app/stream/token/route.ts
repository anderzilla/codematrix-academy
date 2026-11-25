import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { issueAuthorizedStreamToken } from '@/lib/stream/cloudflare';

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'unauthorized', error: 'Faça login para reproduzir este vídeo.' },
      { status: 401 },
    );
  }

  let body: {
    courseSlug?: unknown;
    lessonCode?: unknown;
    assetCode?: unknown;
    liveCode?: unknown;
  };
  try {
    body = (await request.json()) as {
      courseSlug?: unknown;
      lessonCode?: unknown;
      assetCode?: unknown;
      liveCode?: unknown;
    };
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_json', error: 'JSON inválido.' }, { status: 400 });
  }

  // Ignora propositalmente qualquer streamUid enviado pelo cliente (somente UIDs do banco)
  const db = getDb();
  const res = issueAuthorizedStreamToken(db, user.id, {
    courseSlug: typeof body.courseSlug === 'string' ? body.courseSlug.trim() : undefined,
    lessonCode: typeof body.lessonCode === 'string' ? body.lessonCode.trim() : undefined,
    assetCode: typeof body.assetCode === 'string' ? body.assetCode.trim() : undefined,
    liveCode: typeof body.liveCode === 'string' ? body.liveCode.trim() : undefined,
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error },
      { status: res.status },
    );
  }

  return NextResponse.json(res);
}

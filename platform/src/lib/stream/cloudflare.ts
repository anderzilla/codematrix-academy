import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { listUserActiveEntitlements, scopeGrantsCourse } from '@/lib/entitlements';
import { getProtectedLessonContent } from '@/lib/student';

const TOKEN_TTL_SECONDS = 15 * 60;

export interface StreamPlaybackResult {
  ok: true;
  token: string;
  expiresAt: string;
  hlsUrl: string;
  iframeUrl: string;
  allowedOrigins: string[];
  requireSignedURLs: true;
}

export interface StreamPlaybackError {
  ok: false;
  status: 400 | 403 | 404 | 503;
  code:
    | 'invalid_request'
    | 'no_entitlement'
    | 'video_unavailable'
    | 'stream_not_configured';
  error: string;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function resolveSigningPrivateKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (trimmed.includes('BEGIN')) {
    return trimmed.replace(/\\n/g, '\n');
  }
  // Aceita PEM codificado em base64 (formato comum da API Cloudflare Stream Signing Keys)
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (decoded.includes('BEGIN')) {
      return decoded;
    }
  } catch {
    // fallback
  }
  return trimmed;
}

export function signCloudflareStreamJwt(
  streamUid: string,
  env: NodeJS.ProcessEnv = process.env,
): StreamPlaybackResult | StreamPlaybackError {
  const keyId = env.CLOUDFLARE_STREAM_SIGNING_KEY_ID?.trim() ?? '';
  const rawPrivateKey = env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY?.trim() ?? '';
  const customerSubdomain =
    env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim() || 'videodelivery.net';
  const allowedOrigins = (
    env.CLOUDFLARE_STREAM_ALLOWED_ORIGINS || 'academy.codematrix.com.br'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!keyId || !rawPrivateKey) {
    return {
      ok: false,
      status: 503,
      code: 'stream_not_configured',
      error:
        'Reprodução protegida indisponível: credenciais Cloudflare Stream (CLOUDFLARE_STREAM_SIGNING_KEY_ID e CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY) não configuradas no servidor.',
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_TTL_SECONDS;
  const header = { alg: 'RS256', kid: keyId };
  const payload = {
    sub: streamUid,
    kid: keyId,
    exp,
    nbf: now - 30,
    downloadable: false,
    accessRules: [
      {
        type: 'any',
        action: 'allow',
      },
    ],
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload),
  )}`;

  try {
    const privateKeyPem = resolveSigningPrivateKey(rawPrivateKey);
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();
    const signature = signer.sign(privateKeyPem);
    const token = `${signingInput}.${base64UrlEncode(signature)}`;

    const host = customerSubdomain.includes('.')
      ? customerSubdomain
      : `${customerSubdomain}.cloudflarestream.com`;

    return {
      ok: true,
      token,
      expiresAt: new Date(exp * 1000).toISOString(),
      hlsUrl: `https://${host}/${token}/manifest/video.m3u8`,
      iframeUrl: `https://${host}/${token}/iframe`,
      allowedOrigins,
      requireSignedURLs: true,
    };
  } catch {
    return {
      ok: false,
      status: 503,
      code: 'stream_not_configured',
      error:
        'Chave de assinatura Cloudflare Stream inválida no servidor. Verifique CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY.',
    };
  }
}

export function issueAuthorizedStreamToken(
  db: DatabaseSync,
  userId: string,
  input: {
    courseSlug?: string;
    lessonCode?: string;
    assetCode?: string;
    liveCode?: string;
  },
  env: NodeJS.ProcessEnv = process.env,
): StreamPlaybackResult | StreamPlaybackError {
  if (input.liveCode) {
    const live = db
      .prepare(
        `SELECT le.id, le.course_id, le.status, le.access_scope, le.live_input_uid, le.replay_stream_uid,
                c.slug AS course_slug
         FROM live_events le
         INNER JOIN courses c ON c.id = le.course_id
         WHERE le.code = ? AND c.status = 'published'`,
      )
      .get(input.liveCode) as
      | {
          id: string;
          course_id: string;
          status: string;
          access_scope: string;
          live_input_uid: string | null;
          replay_stream_uid: string | null;
          course_slug: string;
        }
      | undefined;

    if (!live) {
      return {
        ok: false,
        status: 404,
        code: 'video_unavailable',
        error: 'Transmissão ao vivo ou replay não encontrado.',
      };
    }

    const ents = listUserActiveEntitlements(db, userId).filter((e) => e.courseId === live.course_id);
    const allowed = ents.some(
      (e) => e.accessScope === live.access_scope || scopeGrantsCourse(e.accessScope, live.course_slug),
    );
    if (!allowed) {
      return {
        ok: false,
        status: 403,
        code: 'no_entitlement',
        error: 'Você não possui acesso liberado para esta transmissão ou replay.',
      };
    }

    const targetUid =
      live.status === 'replay_available' ? live.replay_stream_uid : live.live_input_uid;
    if (!targetUid) {
      return {
        ok: false,
        status: 404,
        code: 'video_unavailable',
        error: 'O vídeo ou transmissão ainda não foi publicado no Cloudflare Stream.',
      };
    }

    return signCloudflareStreamJwt(targetUid, env);
  }

  if (!input.courseSlug || !input.lessonCode) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_request',
      error: 'Informe courseSlug e lessonCode (ou liveCode) para solicitar acesso ao vídeo.',
    };
  }

  // Autorização objeto a objeto: nunca aceitar stream_uid enviado pelo browser
  const lessonAccess = getProtectedLessonContent(db, userId, input.courseSlug, input.lessonCode);
  if (!lessonAccess.ok) {
    return {
      ok: false,
      status: lessonAccess.status,
      code: lessonAccess.status === 403 ? 'no_entitlement' : 'video_unavailable',
      error: lessonAccess.error,
    };
  }

  const asset = input.assetCode
    ? (db
        .prepare(
          `SELECT stream_uid, status FROM assets
           WHERE lesson_id = ? AND code = ? AND kind = 'stream_video'`,
        )
        .get(lessonAccess.lesson.id, input.assetCode) as
        | { stream_uid: string | null; status: string }
        | undefined)
    : (db
        .prepare(
          `SELECT stream_uid, status FROM assets
           WHERE lesson_id = ? AND kind = 'stream_video'
           LIMIT 1`,
        )
        .get(lessonAccess.lesson.id) as
        | { stream_uid: string | null; status: string }
        | undefined);

  if (!asset || !asset.stream_uid) {
    return {
      ok: false,
      status: 404,
      code: 'video_unavailable',
      error: 'Vídeo gravado ainda indisponível para esta aula. Você pode estudar normalmente pelas telas interativas.',
    };
  }

  return signCloudflareStreamJwt(asset.stream_uid, env);
}

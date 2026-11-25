import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getStudentCourseRoom } from '@/lib/student';

const DEFAULT_CERTIFICATE_NOTICE =
  'Certificado de participação em curso livre emitido pela CodeMatrix Academy. Texto e critérios sujeitos a revisão jurídica/acadêmica antes do uso comercial definitivo.';

export interface PublicCertificateRecord {
  verificationCode: string;
  studentDisplayName: string;
  courseTitle: string;
  scopeLabel: string;
  workloadHours: number;
  status: 'valid' | 'revoked';
  revocationReason: string | null;
  templateNotice: string;
  issuedAt: string;
  revokedAt: string | null;
}

export function issueStudentCertificate(
  db: DatabaseSync,
  input: {
    userId: string;
    userName: string;
    courseSlug: string;
  },
  env: NodeJS.ProcessEnv = process.env,
):
  | { ok: true; certificate: PublicCertificateRecord; created: boolean }
  | { ok: false; status: 400 | 404; error: string } {
  const room = getStudentCourseRoom(db, input.userId, input.courseSlug);
  if (!room) {
    return { ok: false, status: 404, error: 'Curso não encontrado.' };
  }

  if (!room.eligibleForCertificate) {
    return {
      ok: false,
      status: 400,
      error:
        'Para emitir o certificado, conclua todas as aulas disponíveis e alcance pelo menos 70% em todos os quizzes de bloco.',
    };
  }

  const scopeLabel = 'Módulo 1 — Fundamentos e Projeto Intelicar';
  const existing = db
    .prepare(
      `SELECT verification_code, student_display_name, course_title, scope_label,
              workload_hours, status, revocation_reason, template_notice, issued_at, revoked_at
       FROM certificates
       WHERE user_id = ? AND course_id = ? AND scope_label = ?
       LIMIT 1`,
    )
    .get(input.userId, room.courseId, scopeLabel) as Record<string, unknown> | undefined;

  if (existing) {
    return {
      ok: true,
      created: false,
      certificate: mapPublicCertificate(existing),
    };
  }

  const id = `cert_${crypto.randomUUID().replace(/-/g, '')}`;
  const verificationCode = crypto.randomBytes(16).toString('hex');
  const templateNotice = env.ACADEMY_CERTIFICATE_NOTICE?.trim() || DEFAULT_CERTIFICATE_NOTICE;

  db.prepare(
    `INSERT INTO certificates (
       id, verification_code, user_id, course_id, student_display_name,
       course_title, scope_label, workload_hours, status, template_notice
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 15, 'valid', ?)`,
  ).run(
    id,
    verificationCode,
    input.userId,
    room.courseId,
    input.userName,
    room.title,
    scopeLabel,
    templateNotice,
  );

  const createdRow = db
    .prepare(
      `SELECT verification_code, student_display_name, course_title, scope_label,
              workload_hours, status, revocation_reason, template_notice, issued_at, revoked_at
       FROM certificates WHERE id = ?`,
    )
    .get(id) as Record<string, unknown>;

  return {
    ok: true,
    created: true,
    certificate: mapPublicCertificate(createdRow),
  };
}

function mapPublicCertificate(row: Record<string, unknown>): PublicCertificateRecord {
  return {
    verificationCode: String(row.verification_code),
    studentDisplayName: String(row.student_display_name),
    courseTitle: String(row.course_title),
    scopeLabel: String(row.scope_label),
    workloadHours: Number(row.workload_hours),
    status: row.status as 'valid' | 'revoked',
    revocationReason: row.revocation_reason ? String(row.revocation_reason) : null,
    templateNotice: String(row.template_notice),
    issuedAt: String(row.issued_at),
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
  };
}

export function getPublicCertificateByCode(
  db: DatabaseSync,
  code: string,
): PublicCertificateRecord | null {
  const row = db
    .prepare(
      `SELECT verification_code, student_display_name, course_title, scope_label,
              workload_hours, status, revocation_reason, template_notice, issued_at, revoked_at
       FROM certificates
       WHERE verification_code = ?`,
    )
    .get(code.trim()) as Record<string, unknown> | undefined;

  if (!row) return null;
  return mapPublicCertificate(row);
}

export function listStudentCertificates(
  db: DatabaseSync,
  userId: string,
): PublicCertificateRecord[] {
  const rows = db
    .prepare(
      `SELECT verification_code, student_display_name, course_title, scope_label,
              workload_hours, status, revocation_reason, template_notice, issued_at, revoked_at
       FROM certificates
       WHERE user_id = ?
       ORDER BY issued_at DESC`,
    )
    .all(userId) as Array<Record<string, unknown>>;

  return rows.map(mapPublicCertificate);
}

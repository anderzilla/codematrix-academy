import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { recordAuditEvent } from '@/lib/audit';
import { PARTNER_ROLES, type PartnerRole } from '@/lib/rbac';

export type CourseStatus = 'draft' | 'review' | 'published' | 'archived';

const VALID_COURSE_STATUSES = new Set<CourseStatus>(['draft', 'review', 'published', 'archived']);

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function listAdminCourses(db: DatabaseSync, filter?: { status?: string; q?: string }) {
  const where: string[] = ['1=1'];
  const params: string[] = [];
  if (filter?.status && VALID_COURSE_STATUSES.has(filter.status as CourseStatus)) {
    where.push('c.status = ?');
    params.push(filter.status);
  }
  if (filter?.q?.trim()) {
    const q = `%${filter.q.trim().toLowerCase()}%`;
    where.push('(LOWER(c.title) LIKE ? OR LOWER(c.slug) LIKE ? OR LOWER(c.category) LIKE ?)');
    params.push(q, q, q);
  }

  return db
    .prepare(
      `SELECT c.id, c.slug, c.title, c.subtitle, c.summary, c.category, c.language, c.status,
              c.active_version_id, c.min_pass_percent, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM course_versions cv WHERE cv.course_id = c.id) AS versions_count,
              (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS modules_count,
              (SELECT COUNT(*) FROM blocks b WHERE b.course_id = c.id) AS blocks_count,
              (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lessons_count,
              (SELECT COUNT(*) FROM offers o WHERE o.course_id = c.id) AS offers_count,
              (SELECT COUNT(*) FROM course_partner_assignments cpa WHERE cpa.course_id = c.id AND cpa.status = 'active') AS active_partners_count
       FROM courses c
       WHERE ${where.join(' AND ')}
       ORDER BY c.created_at DESC`,
    )
    .all(...params);
}

export function getAdminCourseDetail(db: DatabaseSync, courseId: string) {
  const course = db
    .prepare(`SELECT * FROM courses WHERE id = ?`)
    .get(courseId) as Record<string, unknown> | undefined;
  if (!course) return null;

  const versions = db
    .prepare(`SELECT * FROM course_versions WHERE course_id = ? ORDER BY created_at DESC`)
    .all(courseId);
  const modules = db
    .prepare(`SELECT * FROM modules WHERE course_id = ? ORDER BY position ASC`)
    .all(courseId);
  const blocks = db
    .prepare(`SELECT * FROM blocks WHERE course_id = ? ORDER BY position ASC`)
    .all(courseId);
  const lessons = db
    .prepare(
      `SELECT id, module_id, block_id, position, code, title, goal, slides_count, status
       FROM lessons WHERE course_id = ? ORDER BY position ASC`,
    )
    .all(courseId);
  const offers = db
    .prepare(`SELECT * FROM offers WHERE course_id = ? ORDER BY created_at ASC`)
    .all(courseId);
  const grants = db
    .prepare(`SELECT * FROM offer_grants WHERE course_id = ? ORDER BY created_at ASC`)
    .all(courseId);
  const partnerAssignments = db
    .prepare(
      `SELECT cpa.*, pp.display_name, pp.contact_email, pp.status AS partner_status
       FROM course_partner_assignments cpa
       INNER JOIN partner_profiles pp ON pp.id = cpa.partner_id
       WHERE cpa.course_id = ?
       ORDER BY cpa.created_at DESC`,
    )
    .all(courseId);
  const slugAliases = db
    .prepare(`SELECT * FROM course_slug_aliases WHERE course_id = ? ORDER BY created_at DESC`)
    .all(courseId);

  return {
    course,
    versions,
    modules,
    blocks,
    lessons,
    offers,
    grants,
    partnerAssignments,
    slugAliases,
  };
}

export function updateAdminCourse(
  db: DatabaseSync,
  actorUserId: string,
  courseId: string,
  input: {
    title?: string;
    slug?: string;
    subtitle?: string;
    summary?: string;
    category?: string;
    status?: CourseStatus;
  },
): { ok: true; slugChanged: boolean } | { ok: false; status: number; error: string } {
  const existing = db
    .prepare(`SELECT id, slug, title, status FROM courses WHERE id = ?`)
    .get(courseId) as { id: string; slug: string; title: string; status: CourseStatus } | undefined;

  if (!existing) {
    return { ok: false, status: 404, error: 'Curso não encontrado.' };
  }

  const nextTitle = input.title !== undefined ? input.title.trim() : existing.title;
  const nextSlug = input.slug !== undefined ? normalizeSlug(input.slug) : existing.slug;
  const nextStatus = input.status ?? existing.status;

  if (!VALID_COURSE_STATUSES.has(nextStatus)) {
    return { ok: false, status: 400, error: 'Status de curso inválido.' };
  }

  if (nextStatus === 'published' && (nextTitle.length < 3 || nextSlug.length < 3)) {
    return {
      ok: false,
      status: 400,
      error: 'Não é possível publicar curso sem título e slug mínimos válidos.',
    };
  }

  if (nextSlug !== existing.slug) {
    const conflict = db
      .prepare(`SELECT id FROM courses WHERE slug = ? AND id != ?`)
      .get(nextSlug, courseId);
    if (conflict) {
      return { ok: false, status: 409, error: `O slug "${nextSlug}" já está em uso por outro curso.` };
    }
  }

  db.exec('BEGIN');
  try {
    let slugChanged = false;
    if (nextSlug !== existing.slug) {
      slugChanged = true;
      db.prepare(
        `INSERT OR IGNORE INTO course_slug_aliases (id, course_id, old_slug, created_by)
         VALUES (?, ?, ?, ?)`,
      ).run(`csa_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`, courseId, existing.slug, actorUserId);
    }

    db.prepare(
      `UPDATE courses
       SET title = ?,
           slug = ?,
           subtitle = COALESCE(?, subtitle),
           summary = COALESCE(?, summary),
           category = COALESCE(?, category),
           status = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    ).run(
      nextTitle,
      nextSlug,
      input.subtitle !== undefined ? input.subtitle.trim() : null,
      input.summary !== undefined ? input.summary.trim() : null,
      input.category !== undefined ? input.category.trim() : null,
      nextStatus,
      courseId,
    );

    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: slugChanged ? 'admin.course_slug_and_metadata_updated' : 'admin.course_updated',
      targetType: 'course',
      targetId: courseId,
      metadata: {
        previousSlug: existing.slug,
        nextSlug,
        previousStatus: existing.status,
        nextStatus,
      },
    });
    db.exec('COMMIT');
    return { ok: true, slugChanged };
  } catch (err) {
    db.exec('ROLLBACK');
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Erro ao atualizar curso.',
    };
  }
}

export function duplicateAdminCourse(
  db: DatabaseSync,
  actorUserId: string,
  sourceCourseId: string,
  input: { newTitle: string; newSlug: string },
): { ok: true; courseId: string; slug: string } | { ok: false; status: number; error: string } {
  const source = db
    .prepare(`SELECT * FROM courses WHERE id = ?`)
    .get(sourceCourseId) as Record<string, unknown> | undefined;
  if (!source) {
    return { ok: false, status: 404, error: 'Curso de origem não encontrado.' };
  }

  const slug = normalizeSlug(input.newSlug || input.newTitle);
  const title = input.newTitle.trim();
  if (title.length < 3 || slug.length < 3) {
    return { ok: false, status: 400, error: 'Informe título e slug válidos para a cópia.' };
  }

  const conflict = db.prepare(`SELECT id FROM courses WHERE slug = ?`).get(slug);
  if (conflict) {
    return { ok: false, status: 409, error: `Já existe um curso com slug "${slug}".` };
  }

  const newCourseId = `course_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const newVersionId = `ver_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO courses (
         id, tenant_id, slug, title, subtitle, summary, category, language, status,
         active_version_id, planned_modules_count, planned_lessons_count, planned_blocks_count, min_pass_percent, metadata_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
    ).run(
      newCourseId,
      String(source.tenant_id),
      slug,
      title,
      String(source.subtitle || ''),
      String(source.summary || ''),
      String(source.category || 'Formação'),
      String(source.language || 'pt-BR'),
      newVersionId,
      Number(source.planned_modules_count || 0),
      Number(source.planned_lessons_count || 0),
      Number(source.planned_blocks_count || 0),
      Number(source.min_pass_percent || 70),
      JSON.stringify({ duplicatedFromCourseId: sourceCourseId }),
    );

    db.prepare(
      `INSERT INTO course_versions (id, course_id, version_tag, status, notes)
       VALUES (?, ?, 'v1.0', 'draft', ?)`,
    ).run(newVersionId, newCourseId, `Duplicado de ${String(source.slug)}`);

    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: 'admin.course_duplicated',
      targetType: 'course',
      targetId: newCourseId,
      metadata: { sourceCourseId, slug },
    });

    db.exec('COMMIT');
    return { ok: true, courseId: newCourseId, slug };
  } catch (err) {
    db.exec('ROLLBACK');
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Erro ao duplicar curso.',
    };
  }
}

export function publishNewCourseVersion(
  db: DatabaseSync,
  actorUserId: string,
  courseId: string,
  input: { versionTag: string; notes?: string },
): { ok: true; versionId: string; versionTag: string } | { ok: false; status: number; error: string } {
  const course = db
    .prepare(`SELECT id, slug, title FROM courses WHERE id = ?`)
    .get(courseId) as { id: string; slug: string; title: string } | undefined;
  if (!course) {
    return { ok: false, status: 404, error: 'Curso não encontrado.' };
  }
  const versionTag = input.versionTag.trim();
  if (versionTag.length < 2) {
    return { ok: false, status: 400, error: 'Informe uma tag de versão válida (ex.: v2.0).' };
  }
  const dup = db
    .prepare(`SELECT id FROM course_versions WHERE course_id = ? AND version_tag = ?`)
    .get(courseId, versionTag);
  if (dup) {
    return {
      ok: false,
      status: 409,
      error: `Versão "${versionTag}" já existe e versões publicadas são imutáveis. Crie uma nova versão.`,
    };
  }

  const versionId = `ver_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO course_versions (id, course_id, version_tag, status, notes)
       VALUES (?, ?, ?, 'published', ?)`,
    ).run(versionId, courseId, versionTag, input.notes?.trim() || 'Nova versão curricular publicada');

    db.prepare(`UPDATE courses SET active_version_id = ?, updated_at = datetime('now') WHERE id = ?`).run(
      versionId,
      courseId,
    );

    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: 'admin.course_version_published',
      targetType: 'course_version',
      targetId: versionId,
      metadata: { courseId, versionTag },
    });
    db.exec('COMMIT');
    return { ok: true, versionId, versionTag };
  } catch (err) {
    db.exec('ROLLBACK');
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Erro ao publicar versão.',
    };
  }
}

export function assignPartnerToCourse(
  db: DatabaseSync,
  actorUserId: string,
  input: {
    partnerId: string;
    courseId: string;
    role: PartnerRole;
    commissionRuleId?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
    scope?: Record<string, unknown>;
  },
): { ok: true; assignmentId: string } | { ok: false; status: number; error: string } {
  if (!PARTNER_ROLES.has(input.role)) {
    return { ok: false, status: 400, error: 'Função de parceiro inválida.' };
  }
  const partner = db.prepare(`SELECT id FROM partner_profiles WHERE id = ?`).get(input.partnerId);
  const course = db.prepare(`SELECT id FROM courses WHERE id = ?`).get(input.courseId);
  if (!partner || !course) {
    return { ok: false, status: 404, error: 'Parceiro ou curso não encontrado.' };
  }

  const existing = db
    .prepare(
      `SELECT id FROM course_partner_assignments WHERE partner_id = ? AND course_id = ? AND role = ?`,
    )
    .get(input.partnerId, input.courseId, input.role) as { id: string } | undefined;

  const assignmentId = existing?.id || `cpa_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  db.exec('BEGIN');
  try {
    if (existing) {
      db.prepare(
        `UPDATE course_partner_assignments
         SET status = 'active',
             commission_rule_id = ?,
             valid_from = ?,
             valid_until = ?,
             scope_json = ?,
             revoked_by = NULL,
             revoked_at = NULL,
             updated_at = datetime('now')
         WHERE id = ?`,
      ).run(
        input.commissionRuleId ?? null,
        input.validFrom ?? null,
        input.validUntil ?? null,
        JSON.stringify(input.scope ?? {}),
        assignmentId,
      );
    } else {
      db.prepare(
        `INSERT INTO course_partner_assignments (
           id, partner_id, course_id, role, status, scope_json, commission_rule_id,
           valid_from, valid_until, granted_by
         ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
      ).run(
        assignmentId,
        input.partnerId,
        input.courseId,
        input.role,
        JSON.stringify(input.scope ?? {}),
        input.commissionRuleId ?? null,
        input.validFrom ?? null,
        input.validUntil ?? null,
        actorUserId,
      );
    }

    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: 'admin.course_partner_assigned',
      targetType: 'course_partner_assignment',
      targetId: assignmentId,
      metadata: {
        partnerId: input.partnerId,
        courseId: input.courseId,
        role: input.role,
      },
    });
    db.exec('COMMIT');
    return { ok: true, assignmentId };
  } catch (err) {
    db.exec('ROLLBACK');
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Erro ao vincular parceiro ao curso.',
    };
  }
}

export function updatePartnerAssignmentStatus(
  db: DatabaseSync,
  actorUserId: string,
  assignmentId: string,
  input: { status: 'active' | 'suspended' | 'revoked'; reason: string },
):
  | {
      ok: true;
      impact: { affectedLinksCount: number; affectedCouponsCount: number; historyPreserved: true };
    }
  | { ok: false; status: number; error: string } {
  if (input.reason.trim().length < 5) {
    return { ok: false, status: 400, error: 'Informe um motivo detalhado (mínimo 5 caracteres).' };
  }

  const row = db
    .prepare(`SELECT id, partner_id, course_id, role FROM course_partner_assignments WHERE id = ?`)
    .get(assignmentId) as
    | { id: string; partner_id: string; course_id: string; role: string }
    | undefined;
  if (!row) {
    return { ok: false, status: 404, error: 'Vínculo parceiro-curso não encontrado.' };
  }

  const linksCount = Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM partner_links WHERE partner_id = ? AND course_id = ? AND status = 'active'`,
        )
        .get(row.partner_id, row.course_id) as { c: number }
    ).c,
  );
  const couponsCount = Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM partner_coupons WHERE partner_id = ? AND course_id = ? AND status = 'active'`,
        )
        .get(row.partner_id, row.course_id) as { c: number }
    ).c,
  );

  const impactNote =
    input.status === 'active'
      ? `Vínculo reativado: ${input.reason.trim()}`
      : `Vínculo ${input.status}: ${linksCount} link(s) e ${couponsCount} cupom(ns) futuros pausados neste curso; vendas e comissões históricas preservadas. Motivo: ${input.reason.trim()}`;

  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE course_partner_assignments
       SET status = ?,
           revoked_by = ?,
           revoked_at = CASE WHEN ? = 'active' THEN NULL ELSE datetime('now') END,
           impact_note = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    ).run(input.status, input.status === 'active' ? null : actorUserId, input.status, impactNote, assignmentId);

    if (input.status !== 'active') {
      // Pausa links e cupons futuros deste curso sem apagar nenhum registro histórico
      db.prepare(
        `UPDATE partner_links SET status = 'paused' WHERE partner_id = ? AND course_id = ? AND status = 'active'`,
      ).run(row.partner_id, row.course_id);
      db.prepare(
        `UPDATE partner_coupons SET status = 'paused' WHERE partner_id = ? AND course_id = ? AND status = 'active'`,
      ).run(row.partner_id, row.course_id);
      // Também revoga eventuais scopes legados do mesmo curso/papel
      db.prepare(
        `UPDATE partner_scopes SET status = 'revoked' WHERE partner_id = ? AND course_id = ? AND role = ?`,
      ).run(row.partner_id, row.course_id, row.role);
    }

    recordAuditEvent(db, {
      actorUserId,
      actorRole: 'admin',
      action: 'admin.course_partner_status_updated',
      targetType: 'course_partner_assignment',
      targetId: assignmentId,
      metadata: {
        partnerId: row.partner_id,
        courseId: row.course_id,
        status: input.status,
        affectedLinksCount: linksCount,
        affectedCouponsCount: couponsCount,
        reason: input.reason.trim(),
      },
    });
    db.exec('COMMIT');
    return {
      ok: true,
      impact: {
        affectedLinksCount: linksCount,
        affectedCouponsCount: couponsCount,
        historyPreserved: true,
      },
    };
  } catch (err) {
    db.exec('ROLLBACK');
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Erro ao atualizar vínculo.',
    };
  }
}

export function listPartnerCoursesForAdmin(db: DatabaseSync, partnerId: string) {
  const partner = db
    .prepare(`SELECT id, display_name, contact_email, status FROM partner_profiles WHERE id = ?`)
    .get(partnerId);
  if (!partner) return null;

  const assignments = db
    .prepare(
      `SELECT cpa.*, c.slug AS course_slug, c.title AS course_title, c.status AS course_status
       FROM course_partner_assignments cpa
       INNER JOIN courses c ON c.id = cpa.course_id
       WHERE cpa.partner_id = ?
       ORDER BY cpa.created_at DESC`,
    )
    .all(partnerId);

  return { partner, assignments };
}

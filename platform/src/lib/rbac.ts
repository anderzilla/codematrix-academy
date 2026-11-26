import type { DatabaseSync } from 'node:sqlite';
import type { SessionUser } from '@/lib/auth';

export type PartnerRole = 'instructor' | 'affiliate' | 'seller' | 'partner';

export const PARTNER_ROLES = new Set<PartnerRole>([
  'instructor',
  'affiliate',
  'seller',
  'partner',
]);

export interface PartnerScopeRecord {
  id: string;
  role: PartnerRole;
  courseId: string;
  campaign: string | null;
  contractRef: string | null;
  commissionRuleId?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  source: 'course_partner_assignments' | 'partner_scopes';
}

export interface PartnerContext {
  partnerId: string;
  userId: string;
  displayName: string;
  contactEmail: string;
  status: 'invited' | 'pending' | 'approved' | 'suspended';
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  payoutMethod: string | null;
  payoutMaskedSummary: string | null;
  roles: PartnerRole[];
  scopes: PartnerScopeRecord[];
}

export function isAdminOrOps(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.roles.includes('admin') || user.roles.includes('ops_support');
}

function isWithinValidityWindow(validFrom: string | null, validUntil: string | null): boolean {
  const now = Date.now();
  if (validFrom) {
    const start = Date.parse(validFrom);
    if (!Number.isNaN(start) && now < start) return false;
  }
  if (validUntil) {
    const end = Date.parse(validUntil);
    if (!Number.isNaN(end) && now > end) return false;
  }
  return true;
}

export function getPartnerContext(
  db: DatabaseSync,
  userId: string,
): PartnerContext | null {
  const profile = db
    .prepare(
      `SELECT id, user_id, display_name, contact_email, status, terms_version,
              terms_accepted_at, payout_method, payout_masked_summary
       FROM partner_profiles
       WHERE user_id = ?`,
    )
    .get(userId) as Record<string, unknown> | undefined;

  if (!profile) return null;

  const partnerId = String(profile.id);
  const scopes: PartnerScopeRecord[] = [];
  const seenKeys = new Set<string>();

  // 1. Fonte primária multi-curso: course_partner_assignments (sempre exige course_id explícito e vigência ativa)
  const cpaRows = db
    .prepare(
      `SELECT id, role, course_id, scope_json, commission_rule_id, valid_from, valid_until
       FROM course_partner_assignments
       WHERE partner_id = ? AND status = 'active'`,
    )
    .all(partnerId) as Array<Record<string, unknown>>;

  for (const r of cpaRows) {
    const role = String(r.role) as PartnerRole;
    if (!PARTNER_ROLES.has(role) || !r.course_id) continue;
    const validFrom = r.valid_from ? String(r.valid_from) : null;
    const validUntil = r.valid_until ? String(r.valid_until) : null;
    if (!isWithinValidityWindow(validFrom, validUntil)) continue;

    const courseId = String(r.course_id);
    const key = `${role}:${courseId}`;
    seenKeys.add(key);
    scopes.push({
      id: String(r.id),
      role,
      courseId,
      campaign: null,
      contractRef: null,
      commissionRuleId: r.commission_rule_id ? String(r.commission_rule_id) : null,
      validFrom,
      validUntil,
      source: 'course_partner_assignments',
    });
  }

  // 2. Compatibilidade com partner_scopes legados (NUNCA concede acesso global quando course_id é NULL)
  const scopeRows = db
    .prepare(
      `SELECT id, role, course_id, campaign, contract_ref
       FROM partner_scopes
       WHERE partner_id = ? AND status = 'active' AND course_id IS NOT NULL`,
    )
    .all(partnerId) as Array<Record<string, unknown>>;

  for (const r of scopeRows) {
    const role = String(r.role) as PartnerRole;
    if (!PARTNER_ROLES.has(role) || !r.course_id) continue;
    const courseId = String(r.course_id);
    const key = `${role}:${courseId}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    scopes.push({
      id: String(r.id),
      role,
      courseId,
      campaign: r.campaign ? String(r.campaign) : null,
      contractRef: r.contract_ref ? String(r.contract_ref) : null,
      source: 'partner_scopes',
    });
  }

  const roles = [...new Set(scopes.map((s) => s.role))];

  // Permite acesso somente leitura a históricos se o parceiro já tiver comissões passadas,
  // mesmo quando vínculos ativos foram suspensos/encerrados.
  if (roles.length === 0) {
    const hasHistoricalCommissions = db
      .prepare(`SELECT 1 FROM commission_entries WHERE partner_id = ? LIMIT 1`)
      .get(partnerId);
    if (!hasHistoricalCommissions) {
      return null;
    }
  }

  return {
    partnerId,
    userId: String(profile.user_id),
    displayName: String(profile.display_name),
    contactEmail: String(profile.contact_email),
    status: profile.status as PartnerContext['status'],
    termsVersion: profile.terms_version ? String(profile.terms_version) : null,
    termsAcceptedAt: profile.terms_accepted_at ? String(profile.terms_accepted_at) : null,
    payoutMethod: profile.payout_method ? String(profile.payout_method) : null,
    payoutMaskedSummary: profile.payout_masked_summary
      ? String(profile.payout_masked_summary)
      : null,
    roles,
    scopes,
  };
}

export function partnerHasRole(ctx: PartnerContext, allowed: PartnerRole[]): boolean {
  return ctx.roles.some((r) => allowed.includes(r));
}

export function partnerCanAccessCourse(
  ctx: PartnerContext,
  courseId: string,
  allowedRoles: PartnerRole[],
): boolean {
  if (!courseId) return false;
  // Papel nunca concede acesso global automático: precisa de vínculo ativo explícito ao courseId
  return ctx.scopes.some(
    (s) => allowedRoles.includes(s.role) && s.courseId === courseId,
  );
}

export function listPartnerAssignedCourses(db: DatabaseSync, ctx: PartnerContext) {
  const courseIds = [...new Set(ctx.scopes.map((s) => s.courseId))];
  if (courseIds.length === 0) return [];

  const placeholders = courseIds.map(() => '?').join(', ');
  const courses = db
    .prepare(
      `SELECT id, slug, title, subtitle, category, status
       FROM courses
       WHERE id IN (${placeholders})
       ORDER BY title ASC`,
    )
    .all(...courseIds) as Array<Record<string, unknown>>;

  return courses.map((c) => {
    const cid = String(c.id);
    const assignedRoles = ctx.scopes.filter((s) => s.courseId === cid).map((s) => s.role);
    const offers = db
      .prepare(
        `SELECT id, sku, offer_code, title, price_cents, is_free, status
         FROM offers
         WHERE course_id = ? AND status != 'archived'
         ORDER BY is_free ASC, created_at ASC`,
      )
      .all(cid) as Array<Record<string, unknown>>;

    return {
      courseId: cid,
      slug: String(c.slug),
      title: String(c.title),
      subtitle: String(c.subtitle),
      category: String(c.category),
      status: String(c.status),
      roles: [...new Set(assignedRoles)],
      offers: offers.map((o) => ({
        id: String(o.id),
        sku: String(o.sku),
        offerCode: String(o.offer_code),
        title: String(o.title),
        priceCents: o.price_cents === null ? null : Number(o.price_cents),
        isFree: Number(o.is_free) === 1,
        status: String(o.status),
      })),
    };
  });
}

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
  courseId: string | null;
  campaign: string | null;
  contractRef: string | null;
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
  const scopeRows = db
    .prepare(
      `SELECT id, role, course_id, campaign, contract_ref
       FROM partner_scopes
       WHERE partner_id = ? AND status = 'active'`,
    )
    .all(partnerId) as Array<Record<string, unknown>>;

  const scopes: PartnerScopeRecord[] = scopeRows
    .filter((r) => PARTNER_ROLES.has(String(r.role) as PartnerRole))
    .map((r) => ({
      id: String(r.id),
      role: String(r.role) as PartnerRole,
      courseId: r.course_id ? String(r.course_id) : null,
      campaign: r.campaign ? String(r.campaign) : null,
      contractRef: r.contract_ref ? String(r.contract_ref) : null,
    }));

  const roles = [...new Set(scopes.map((s) => s.role))];

  // Negação por padrão: precisa ter pelo menos 1 papel de parceiro ativo
  if (roles.length === 0) {
    return null;
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
  return ctx.scopes.some(
    (s) =>
      allowedRoles.includes(s.role) && (s.courseId === null || s.courseId === courseId),
  );
}

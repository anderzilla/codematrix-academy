export type AcademyRole =
  | 'admin'
  | 'ops_support'
  | 'instructor'
  | 'affiliate'
  | 'seller'
  | 'partner'
  | 'student';

export type AcademySurfaceId = 'vitrine' | 'app' | 'partners' | 'admin';

export interface SurfaceContract {
  id: AcademySurfaceId;
  name: string;
  basePath: string;
  stage: 1 | 2 | 3 | 4;
  status: 'active' | 'reserved_stage_2' | 'reserved_stage_3' | 'reserved_stage_4';
  requiresAuth: boolean;
  requiresMfa: boolean;
  allowedRoles: AcademyRole[];
  summary: string;
}

export interface EntitlementContract {
  id: string;
  userId: string;
  courseId: string;
  offerSku: string;
  accessScope: string;
  status: 'active' | 'suspended' | 'revoked' | 'expired';
  sourceProvider: 'hotmart' | 'manual' | 'free_sample';
  sourceEventId: string | null;
  startsAt: string;
  endsAt: string | null;
}

export interface PlaybackTokenRequestContract {
  courseId: string;
  lessonId: string;
  assetCode: string;
}

export const ACADEMY_SURFACES: SurfaceContract[] = [
  {
    id: 'vitrine',
    name: 'Vitrine Pública',
    basePath: '/',
    stage: 1,
    status: 'active',
    requiresAuth: false,
    requiresMfa: false,
    allowedRoles: ['student', 'partner', 'seller', 'affiliate', 'instructor', 'ops_support', 'admin'],
    summary: 'Catálogo multi-curso, detalhe de trilhas, ofertas, checkout adapter e páginas institucionais.',
  },
  {
    id: 'app',
    name: 'Área do Aluno',
    basePath: '/app',
    stage: 2,
    status: 'active',
    requiresAuth: true,
    requiresMfa: false,
    allowedRoles: ['student', 'instructor', 'admin'],
    summary: 'Biblioteca do aluno, aulas em sequência, progresso, quizzes corrigidos no servidor, Cloudflare Stream e certificados.',
  },
  {
    id: 'partners',
    name: 'Painel de Parceiros',
    basePath: '/partners',
    stage: 3,
    status: 'active',
    requiresAuth: true,
    requiresMfa: false,
    allowedRoles: ['instructor', 'affiliate', 'seller', 'partner', 'admin'],
    summary: 'Links/cupons, agenda de lives atribuídas, demonstrativos próprios e comissões sem expor dados pessoais de alunos.',
  },
  {
    id: 'admin',
    name: 'Painel Administrativo',
    basePath: '/admin',
    stage: 4,
    status: 'active',
    requiresAuth: true,
    requiresMfa: true,
    allowedRoles: ['admin', 'ops_support'],
    summary: 'Gestão multi-curso, direitos, conciliação Hotmart, ledger financeiro append-only, fechamento maker-checker e auditoria.',
  },
];

import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PartnersDashboardClient } from '@/components/PartnersDashboardClient';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPartnerDashboard } from '@/lib/partners';
import { getPartnerContext, listPartnerAssignedCourses } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export default async function PartnersPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <section className="section">
        <div className="container-narrow">
          <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Painel de Parceiros' }]} />
          <div className="card">
            <span className="badge badge-planned" style={{ width: 'fit-content' }}>
              Acesso restrito a parceiros
            </span>
            <h1 className="section-heading" style={{ margin: 0 }}>
              Entre com sua conta de parceiro
            </h1>
            <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
              Professores, afiliados, vendedores e parceiros autorizados acessam aqui seus
              links, cupons, agenda de lives e demonstrativo de comissões.
            </p>
            <div className="hero-actions" style={{ marginTop: 8 }}>
              <Link href="/entrar" className="pill-btn">
                Entrar na minha conta
              </Link>
              <Link href="/suporte" className="pill-btn pill-btn-secondary">
                Solicitar convite de parceria
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const db = getDb();
  const ctx = getPartnerContext(db, user.id);

  if (!ctx) {
    return (
      <section className="section">
        <div className="container-narrow">
          <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Painel de Parceiros' }]} />
          <div className="card">
            <span className="badge badge-planned" style={{ width: 'fit-content' }}>
              Perfil de parceiro não encontrado
            </span>
            <h1 className="section-heading" style={{ margin: 0 }}>
              Esta conta não possui acesso ao Painel de Parceiros
            </h1>
            <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
              Por segurança, o acesso ao painel de parceiros é liberado apenas mediante convite e
              papel atribuído pela equipe da CodeMatrix Academy.
            </p>
            <div className="hero-actions" style={{ marginTop: 8 }}>
              <Link href="/app" className="pill-btn">
                Ir para a Área do Aluno
              </Link>
              <Link href="/suporte" className="pill-btn pill-btn-secondary">
                Falar com o suporte
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const dashboard = getPartnerDashboard(db, ctx);
  const assignedCourses = listPartnerAssignedCourses(db, ctx);

  return (
    <section className="section">
      <div className="container">
        <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Painel de Parceiros' }]} />
        <PartnersDashboardClient
          data={dashboard as unknown as Parameters<typeof PartnersDashboardClient>[0]['data']}
          assignedCourses={assignedCourses}
        />
      </div>
    </section>
  );
}

import Link from 'next/link';
import { AdminDashboardClient } from '@/components/AdminDashboardClient';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getAdminOverview } from '@/lib/admin';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const auth = await requireAdminSession({ requireMfa: false });

  if (!auth.ok) {
    const isLoggedNonAdmin = auth.code === 'forbidden';
    return (
      <section className="section">
        <div className="container-narrow">
          <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Administração' }]} />
          <div className="card">
            <span className="badge badge-planned" style={{ width: 'fit-content' }}>
              {isLoggedNonAdmin ? 'Conta sem permissão administrativa' : 'Acesso restrito à equipe'}
            </span>
            <h1 className="section-heading" style={{ margin: 0 }}>
              {isLoggedNonAdmin
                ? 'Sua conta atual não possui acesso à Administração'
                : 'Painel Administrativo CodeMatrix Academy'}
            </h1>
            <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
              {isLoggedNonAdmin
                ? 'Você está conectado com uma conta de aluno/parceiro. Para acessar seus cursos, vá para a Área do Aluno.'
                : auth.error}
            </p>
            <div className="hero-actions" style={{ marginTop: 8 }}>
              {isLoggedNonAdmin ? (
                <Link href="/app" className="pill-btn">
                  Ir para a Área do Aluno
                </Link>
              ) : (
                <Link href="/entrar" className="pill-btn">
                  Entrar com conta autorizada
                </Link>
              )}
              <Link href="/" className="pill-btn pill-btn-secondary">
                Voltar ao início
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const db = getDb();
  const overview = auth.mfaVerified ? getAdminOverview(db) : null;

  return (
    <section className="section">
      <div className="container">
        <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Administração' }]} />
        <AdminDashboardClient
          actorName={auth.user.name}
          mfaVerified={auth.mfaVerified}
          overview={overview as unknown as Parameters<typeof AdminDashboardClient>[0]['overview']}
        />
      </div>
    </section>
  );
}

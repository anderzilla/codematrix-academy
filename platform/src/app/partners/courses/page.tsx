import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPartnerContext, listPartnerAssignedCourses } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export default async function PartnerCoursesPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <section className="section">
        <div className="container-narrow">
          <Breadcrumbs
            items={[
              { label: 'Início', href: '/' },
              { label: 'Parceiros', href: '/partners' },
              { label: 'Meus cursos atribuídos' },
            ]}
          />
          <div className="card">
            <h1 className="section-heading" style={{ margin: 0 }}>
              Entre na sua conta de parceiro
            </h1>
            <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
              Apenas parceiros com vínculo ativo por curso visualizam esta área.
            </p>
            <div className="hero-actions" style={{ marginTop: 10 }}>
              <Link href="/entrar" className="pill-btn">
                Entrar na minha conta
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
          <Breadcrumbs
            items={[
              { label: 'Início', href: '/' },
              { label: 'Parceiros', href: '/partners' },
              { label: 'Meus cursos atribuídos' },
            ]}
          />
          <div className="card">
            <h1 className="section-heading" style={{ margin: 0 }}>
              Acesso restrito
            </h1>
            <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
              Esta conta não possui atribuições de parceiro ativas em cursos da CodeMatrix Academy.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const courses = listPartnerAssignedCourses(db, ctx);

  return (
    <section className="section">
      <div className="container">
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Painel de Parceiros', href: '/partners' },
            { label: 'Cursos atribuídos' },
          ]}
        />
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="eyebrow">Isolamento por curso · course_partner_assignments</p>
            <h1 className="section-heading" style={{ margin: 0 }}>
              Meus cursos atribuídos
            </h1>
            <p style={{ margin: '6px 0 0', color: 'var(--cm-muted)' }}>
              Você visualiza apenas os cursos com vínculo ativo e vigente atribuído à sua conta ({ctx.displayName}).
            </p>
          </div>
          <Link href="/partners" className="pill-btn pill-btn-secondary">
            Voltar ao painel geral
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="notice-box" role="status" style={{ marginTop: 18 }}>
            Nenhum curso com vínculo ativo neste momento. Caso um vínculo tenha sido encerrado, seu
            histórico financeiro permanece disponível no demonstrativo do{' '}
            <Link href="/partners" className="inline-link">
              Painel de Parceiros
            </Link>
            .
          </div>
        ) : (
          <div className="grid-2" style={{ marginTop: 18 }}>
            {courses.map((course) => (
              <article key={course.courseId} className="card card-highlight">
                <div className="badge-row">
                  <span className="badge badge-available">{course.status}</span>
                  <span className="badge badge-brand">{course.category}</span>
                  {course.roles.map((role) => (
                    <span key={role} className="badge badge-neutral">
                      {role}
                    </span>
                  ))}
                </div>
                <h2 className="course-card-title">{course.title}</h2>
                <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 14 }}>{course.subtitle}</p>
                <div style={{ marginTop: 10 }}>
                  <strong style={{ fontSize: 13 }}>Ofertas vinculáveis ({course.offers.length}):</strong>
                  <ul className="checklist" style={{ marginTop: 6 }}>
                    {course.offers.map((o) => (
                      <li key={o.id}>
                        <code>{o.sku}</code> — {o.title}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card-actions">
                  <Link href="/partners" className="pill-btn">
                    Gerar links e cupons
                  </Link>
                  <Link href={`/cursos/${course.slug}`} className="pill-btn pill-btn-secondary">
                    Ver página pública
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

import Link from 'next/link';
import { listPublishedCourses } from '@/lib/catalog';
import { ACADEMY_SURFACES } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

export default function AcademyHomePage() {
  const courses = listPublishedCourses();
  const primaryCourse = courses[0] ?? null;

  return (
    <>
      <section className="hero-section">
        <div className="container">
          <p className="eyebrow">CodeMatrix Academy · Tecnologia e IA aplicada</p>
          <h1 className="hero-title">
            Formação prática em IA com escopo claro e progressão verificável.
          </h1>
          <p className="hero-subtitle">
            Ambiente educacional independente da CodeMatrix para profissionais e pequenas e
            médias empresas. Comece pela amostra gratuita do Bloco 1 e acompanhe cada etapa
            com transparência sobre o que já está disponível e o que está em planejamento.
          </p>

          <div className="hero-actions">
            {primaryCourse ? (
              <Link href={`/cursos/${primaryCourse.slug}`} className="pill-btn">
                Explorar {primaryCourse.title}
              </Link>
            ) : null}
            <Link href="/cursos" className="pill-btn pill-btn-secondary">
              Ver catálogo completo
            </Link>
          </div>

          <div className="hero-metrics" aria-label="Resumo da estrutura inicial">
            <div className="metric-card">
              <strong>{courses.length} curso publicado</strong>
              <span>Catálogo multi-curso pronto para novas trilhas sem alterar o schema.</span>
            </div>
            <div className="metric-card">
              <strong>15 aulas disponíveis</strong>
              <span>Módulo 1 organizado em 5 blocos de 3 aulas, com mínimo de 70% por bloco.</span>
            </div>
            <div className="metric-card">
              <strong>Bloco 1 gratuito</strong>
              <span>Amostra explícita por regra de oferta; módulos 2 e 3 marcados como planejados.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <p className="eyebrow">Catálogo publicado</p>
          <h2 className="section-heading">Cursos disponíveis na vitrine</h2>
          <p className="section-lead">
            Apenas cursos com status publicado aparecem aqui. Rascunhos internos e módulos
            planejados nunca são exibidos como se já estivessem concluídos.
          </p>

          {courses.length === 0 ? (
            <div className="notice-box" role="status">
              Nenhum curso publicado no banco local. Execute <code>npm run seed</code> para
              importar o catálogo inicial.
            </div>
          ) : (
            <div className="grid-2">
              {courses.map((course) => (
                <article key={course.id} className="card">
                  <div className="badge-row">
                    <span className="badge badge-available">Publicado</span>
                    <span className="badge badge-brand">{course.category}</span>
                    {course.hasFreeSample ? (
                      <span className="badge badge-neutral">Bloco 1 gratuito</span>
                    ) : null}
                  </div>
                  <h3 className="course-card-title">{course.title}</h3>
                  <p style={{ margin: 0, color: 'var(--cm-muted)' }}>{course.summary}</p>
                  <div className="course-card-meta">
                    <span>
                      Disponível agora: <strong>{course.availableModulesCount} módulo</strong> ·{' '}
                      <strong>{course.availableLessonsCount} aulas</strong>
                    </span>
                    <span>
                      Trilha planejada: {course.plannedModulesCount} módulos ·{' '}
                      {course.plannedLessonsCount} aulas
                    </span>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                    <Link href={`/cursos/${course.slug}`} className="pill-btn">
                      Ver estrutura do curso
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section section-navy">
        <div className="container">
          <p className="eyebrow">Arquitetura da plataforma</p>
          <h2 className="section-heading">Quatro superfícies integradas e isoladas</h2>
          <p className="section-lead">
            A CodeMatrix Academy separa vitrine pública, área do aluno, painel de parceiros e
            administração com autorização validada no servidor.
          </p>

          <div className="grid-2">
            {ACADEMY_SURFACES.map((surface) => (
              <article key={surface.id} className="card-navy">
                <span className="eyebrow" style={{ marginBottom: 4 }}>
                  Etapa {surface.stage} · {surface.basePath}
                </span>
                <h3>{surface.name}</h3>
                <p>{surface.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

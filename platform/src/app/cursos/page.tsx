import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { listPublishedCourses } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function CoursesCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const courses = listPublishedCourses(query);

  return (
    <section className="section">
      <div className="container">
        <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Cursos' }]} />

        <p className="eyebrow">Catálogo CodeMatrix Academy</p>
        <h1 className="section-heading">Cursos disponíveis</h1>
        <p className="section-lead">
          Escolha uma formação para ver a grade completa de aulas, entender como funcionam as
          avaliações e conhecer a amostra gratuita antes de se matricular.
        </p>

        <div className="search-bar-wrap">
          <form method="get" action="/cursos" className="search-form" role="search">
            <label htmlFor="catalog-search" className="skip-link">
              Buscar cursos por tema ou título
            </label>
            <input
              id="catalog-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Buscar por assunto, título ou categoria (ex.: IA)"
              className="search-input"
            />
            <button type="submit" className="pill-btn">
              Buscar
            </button>
            {query ? (
              <Link href="/cursos" className="pill-btn pill-btn-secondary">
                Limpar filtro
              </Link>
            ) : null}
          </form>
          <p className="search-meta" aria-live="polite">
            {courses.length === 1
              ? '1 curso disponível'
              : `${courses.length} cursos disponíveis`}
            {query ? ` para "${query}"` : ''}.
          </p>
        </div>

        {courses.length === 0 ? (
          <div className="notice-box" role="status">
            {query ? (
              <>
                Nenhum curso encontrado para <strong>&ldquo;{query}&rdquo;</strong>. Tente outro
                termo ou{' '}
                <Link href="/cursos" className="inline-link">
                  veja todos os cursos disponíveis
                </Link>
                .
              </>
            ) : (
              'Nenhum curso publicado no catálogo neste momento.'
            )}
          </div>
        ) : (
          <div className="grid-2">
            {courses.map((course) => (
              <article key={course.id} className="card card-highlight">
                <div className="badge-row">
                  <span className="badge badge-available">Disponível agora</span>
                  <span className="badge badge-brand">{course.category}</span>
                  <span className="badge badge-neutral">Português (BR)</span>
                </div>
                <h2 className="course-card-title">{course.title}</h2>
                <p style={{ margin: 0, color: 'var(--cm-muted)' }}>{course.summary}</p>
                <div className="course-card-meta">
                  <span>
                    <strong>Pronto para estudo:</strong> {course.availableModulesCount} módulo ·{' '}
                    {course.availableLessonsCount} aulas ({course.availableBlocksCount} blocos)
                  </span>
                  <span>
                    <strong>Avaliação:</strong> mínimo {course.minPassPercent}% por bloco
                  </span>
                </div>
                <div className="card-actions">
                  <Link href={`/cursos/${course.slug}`} className="pill-btn">
                    Ver estrutura e aulas
                  </Link>
                  {course.hasFreeSample && course.freeSampleOfferCode ? (
                    <Link
                      href={`/oferta/${course.freeSampleOfferCode}`}
                      className="pill-btn pill-btn-secondary"
                    >
                      Amostra gratuita
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

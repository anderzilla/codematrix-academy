import Link from 'next/link';
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
        <p className="eyebrow">Catálogo multi-curso</p>
        <h1 className="section-heading">Cursos publicados</h1>
        <p className="section-lead">
          Explore as trilhas publicadas da CodeMatrix Academy. Cursos em rascunho ficam
          ocultos até revisão e publicação formal.
        </p>

        <form method="get" action="/cursos" className="search-form" role="search">
          <label htmlFor="catalog-search" className="skip-link">
            Buscar cursos publicados
          </label>
          <input
            id="catalog-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Buscar por tema, título ou categoria..."
            className="search-input"
          />
          <button type="submit" className="pill-btn">
            Buscar
          </button>
          {query ? (
            <Link href="/cursos" className="pill-btn pill-btn-secondary">
              Limpar
            </Link>
          ) : null}
        </form>

        {courses.length === 0 ? (
          <div className="notice-box" role="status">
            {query
              ? `Nenhum curso publicado encontrado para "${query}".`
              : 'Nenhum curso publicado no catálogo neste momento.'}
          </div>
        ) : (
          <div className="grid-2">
            {courses.map((course) => (
              <article key={course.id} className="card">
                <div className="badge-row">
                  <span className="badge badge-available">Publicado</span>
                  <span className="badge badge-brand">{course.category}</span>
                  <span className="badge badge-neutral">{course.language}</span>
                </div>
                <h2 className="course-card-title">{course.title}</h2>
                <p style={{ margin: 0, color: 'var(--cm-muted)' }}>{course.summary}</p>
                <div className="course-card-meta">
                  <span>
                    Disponível: {course.availableModulesCount} módulo ·{' '}
                    {course.availableLessonsCount} aulas · {course.availableBlocksCount} blocos
                  </span>
                  <span>Nota mínima por bloco: {course.minPassPercent}%</span>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <Link href={`/cursos/${course.slug}`} className="pill-btn">
                    Ver detalhes e trilha
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

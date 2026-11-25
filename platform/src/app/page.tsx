import Link from 'next/link';
import { listPublishedCourses } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

const STUDY_STEPS = [
  {
    step: '01',
    title: 'Comece pela amostra gratuita',
    description:
      'Conheça a didática nas 3 primeiras aulas do Bloco 1 e teste seus conhecimentos antes de decidir pela matrícula completa.',
  },
  {
    step: '02',
    title: 'Estude em blocos curtos e práticos',
    description:
      'Cada bloco reúne 3 aulas objetivas em telas de apresentação, exemplos do cotidiano e etapas guiadas do projeto didático Intelicar.',
  },
  {
    step: '03',
    title: 'Valide o aprendizado com 70% no quiz',
    description:
      'Ao concluir as 3 aulas do bloco, responda às 10 questões de fixação. Atingindo 70%, o bloco seguinte é liberado; abaixo disso, você recebe indicação exata do que revisar.',
  },
  {
    step: '04',
    title: 'Avance com transparência de escopo',
    description:
      'Cada trilha mostra exatamente o que já está pronto para estudo hoje e o que faz parte dos módulos planejados, sem promessas irreais.',
  },
];

export default function AcademyHomePage() {
  const courses = listPublishedCourses();
  const primaryCourse = courses[0] ?? null;

  return (
    <>
      <section className="hero-section">
        <div className="container">
          <p className="eyebrow">CodeMatrix Academy · Formação prática em IA</p>
          <h1 className="hero-title">
            Aprenda Inteligência Artificial na prática, no seu ritmo e com clareza.
          </h1>
          <p className="hero-subtitle">
            Cursos em português do Brasil desenhados para profissionais e pequenas e médias
            empresas que querem entender como a IA funciona, onde ela realmente ajuda e como
            aplicá-la com responsabilidade — sem jargão desnecessário.
          </p>

          <div className="hero-actions">
            {primaryCourse ? (
              <Link href={`/cursos/${primaryCourse.slug}`} className="pill-btn">
                Conhecer a Formação IA
              </Link>
            ) : null}
            <Link href="/cursos" className="pill-btn pill-btn-secondary">
              Ver catálogo de cursos
            </Link>
          </div>

          <div className="hero-metrics" aria-label="Destaques da formação">
            <div className="metric-card">
              <strong>Amostra gratuita no Bloco 1</strong>
              <span>
                Experimente as 3 primeiras aulas e o primeiro quiz de fixação antes de se
                matricular.
              </span>
            </div>
            <div className="metric-card">
              <strong>15 aulas prontas no Módulo 1</strong>
              <span>
                Organizadas em 5 blocos de 3 aulas, com pausas de fixação e projeto prático
                guiado.
              </span>
            </div>
            <div className="metric-card">
              <strong>Progressão com 70% de acerto</strong>
              <span>
                Avaliação de 10 questões por bloco, revisão orientada em caso de dúvidas e nova
                tentativa.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <p className="eyebrow">Catálogo disponível</p>
          <h2 className="section-heading">Comece pela nossa formação inicial</h2>
          <p className="section-lead">
            Publicamos apenas conteúdos revisados. Em cada página de curso você vê exatamente
            quais aulas já estão prontas hoje e quais módulos estão em produção.
          </p>

          {courses.length === 0 ? (
            <div className="notice-box" role="status">
              Nenhum curso disponível no momento. Caso esteja em ambiente local, execute{' '}
              <code>npm run seed</code> para carregar o catálogo inicial.
            </div>
          ) : (
            <div className="grid-2">
              {courses.map((course) => (
                <article key={course.id} className="card card-highlight">
                  <div className="badge-row">
                    <span className="badge badge-available">Módulo 1 disponível</span>
                    <span className="badge badge-brand">{course.category}</span>
                    {course.hasFreeSample ? (
                      <span className="badge badge-neutral">Bloco 1 gratuito</span>
                    ) : null}
                  </div>
                  <h3 className="course-card-title">{course.title}</h3>
                  <p style={{ margin: 0, color: 'var(--cm-muted)' }}>{course.summary}</p>
                  <div className="course-card-meta">
                    <span>
                      <strong>Disponível agora:</strong> {course.availableModulesCount} módulo ·{' '}
                      {course.availableLessonsCount} aulas ({course.availableBlocksCount} blocos)
                    </span>
                    <span>
                      <strong>Trilha completa planejada:</strong> {course.plannedModulesCount}{' '}
                      módulos · {course.plannedLessonsCount} aulas
                    </span>
                  </div>
                  <div className="card-actions">
                    <Link href={`/cursos/${course.slug}`} className="pill-btn">
                      Ver aulas e módulos
                    </Link>
                    {course.hasFreeSample ? (
                      <Link
                        href="/oferta/formacao-ia-amostra-bloco-1"
                        className="pill-btn pill-btn-secondary"
                      >
                        Ver amostra gratuita
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section section-navy">
        <div className="container">
          <p className="eyebrow">Como funciona na prática</p>
          <h2 className="section-heading">Um caminho guiado do básico à primeira entrega</h2>
          <p className="section-lead">
            Nada de aulas soltas ou vídeos intermináveis sem aplicação. A CodeMatrix Academy
            organiza o aprendizado em etapas claras para você consolidar cada conceito.
          </p>

          <div className="grid-2">
            {STUDY_STEPS.map((item) => (
              <article key={item.step} className="card-navy">
                <span className="step-number">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

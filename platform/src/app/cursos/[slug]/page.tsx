import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getPublishedCourseBySlug, resolveCourseSlugAlias } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

function formatPrice(priceCents: number | null, currency: string, isFree: boolean): string {
  if (isFree) return 'Gratuito · sem cartão de crédito';
  if (priceCents === null) return 'Condições em definição';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(priceCents / 100);
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = getPublishedCourseBySlug(slug);

  if (!course) {
    const aliasTarget = resolveCourseSlugAlias(slug);
    if (aliasTarget) {
      redirect(`/cursos/${aliasTarget}`);
    }
    notFound();
  }

  const freeOffer = course.publishedOffers.find((o) => o.isFree);

  return (
    <>
      <section className="hero-section">
        <div className="container">
          <Breadcrumbs
            items={[
              { label: 'Início', href: '/' },
              { label: 'Cursos', href: '/cursos' },
              { label: course.title },
            ]}
          />

          <div className="badge-row" style={{ marginBottom: 14 }}>
            <span className="badge badge-available">Módulo 1 disponível</span>
            <span className="badge badge-brand">{course.category}</span>
            <span className="badge badge-neutral">
              Nota mínima de {course.minPassPercent}% por bloco
            </span>
          </div>

          <h1 className="hero-title">{course.title}</h1>
          <p className="hero-subtitle">{course.summary}</p>

          <div className="hero-actions">
            {freeOffer ? (
              <Link href={`/oferta/${freeOffer.offerCode}`} className="pill-btn">
                Ver amostra gratuita (Bloco 1)
              </Link>
            ) : null}
            <a href="#grade-completa" className="pill-btn pill-btn-secondary">
              Ver todas as 15 aulas
            </a>
          </div>

          <div className="hero-metrics">
            <div className="metric-card">
              <strong>
                {course.availableLessonsCount} de {course.plannedLessonsCount} aulas prontas
              </strong>
              <span>
                Módulo 1 completo e disponível; Módulos 2 e 3 em planejamento transparente.
              </span>
            </div>
            <div className="metric-card">
              <strong>{course.availableBlocksCount} blocos de estudo</strong>
              <span>
                Cada bloco combina 3 aulas em sequência e um quiz de 10 questões com revisão
                orientada.
              </span>
            </div>
            <div className="metric-card">
              <strong>Formato prático em telas</strong>
              <span>
                {course.assetsSummary.slidesPacks} aulas interativas + projeto didático
                Intelicar. Vídeos gravados serão adicionados na evolução da plataforma.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">Como você vai estudar</p>
          <h2 className="section-heading">Progressão simples em 3 passos por bloco</h2>
          <p className="section-lead">
            Você não precisa ter experiência prévia com programação para começar o Módulo 1.
            Siga o ritmo abaixo em cada bloco:
          </p>

          <div className="step-grid">
            <article className="step-card">
              <span className="step-card-badge">1</span>
              <h3>Complete as 3 aulas do bloco</h3>
              <p>
                Leia as telas de apresentação em sequência, veja os exemplos práticos e faça as
                pausas de fixação propostas em cada aula.
              </p>
            </article>
            <article className="step-card">
              <span className="step-card-badge">2</span>
              <h3>Faça o quiz de 10 questões</h3>
              <p>
                Ao terminar a terceira aula, o quiz do bloco é liberado com 10 perguntas
                sorteadas. O resultado e as explicações aparecem ao finalizar o envio.
              </p>
            </article>
            <article className="step-card">
              <span className="step-card-badge">3</span>
              <h3>Avance com 70% ou revise com guia</h3>
              <p>
                Com 7 ou mais acertos (70%), o próximo bloco abre automaticamente. Se ficar
                abaixo, você vê exatamente quais aulas revisar antes de tentar novamente.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <p className="eyebrow">Inscrição e acesso</p>
          <h2 className="section-heading">Como começar nesta formação</h2>

          <div className="grid-2" style={{ marginTop: 20 }}>
            {course.publishedOffers.map((offer) => (
              <article key={offer.id} className="card card-highlight">
                <div className="badge-row">
                  <span className="badge badge-available">
                    {offer.isFree ? 'Amostra gratuita' : 'Disponível'}
                  </span>
                </div>
                <h3 className="course-card-title">{offer.title}</h3>
                <p style={{ margin: 0, color: 'var(--cm-muted)' }}>{offer.description}</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 750, color: 'var(--cm-ink)' }}>
                  {formatPrice(offer.priceCents, offer.currency, offer.isFree)}
                </p>
                <div className="card-actions">
                  <Link href={`/oferta/${offer.offerCode}`} className="pill-btn">
                    Ver detalhes e como acessar
                  </Link>
                </div>
              </article>
            ))}

            {course.draftOffersCount > 0 ? (
              <article className="card">
                <div className="badge-row">
                  <span className="badge badge-planned">Abertura em preparação</span>
                </div>
                <h3 className="course-card-title">Módulo 1 completo e Formação Completa</h3>
                <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
                  As inscrições pagas para o Módulo 1 completo (Blocos 1 a 5) e para a trilha
                  completa (Módulos 1, 2 e 3) estão em preparação. Preço, prazo de acesso e
                  checkout serão publicados aqui assim que forem definidos oficialmente.
                </p>
                <div className="card-actions">
                  <Link href="/suporte" className="pill-btn pill-btn-secondary">
                    Tirar dúvidas com o suporte
                  </Link>
                </div>
              </article>
            ) : null}
          </div>
        </div>
      </section>

      <section id="grade-completa" className="section">
        <div className="container">
          <p className="eyebrow">Grade curricular</p>
          <h2 className="section-heading">Módulos, blocos e o que você aprende em cada aula</h2>
          <p className="section-lead">
            Confira abaixo a trilha completa. Mostramos exatamente o que já está disponível no
            Módulo 1 e o que está planejado para os Módulos 2 e 3.
          </p>

          <div className="module-stack">
            {course.modules.map((mod) => (
              <section key={mod.id} className="card">
                <div className="badge-row">
                  <span
                    className={`badge ${
                      mod.status === 'published' ? 'badge-available' : 'badge-planned'
                    }`}
                  >
                    {mod.status === 'published' ? 'Disponível agora' : 'Em planejamento'}
                  </span>
                  <span className="badge badge-neutral">Módulo {mod.position}</span>
                </div>
                <h3 className="course-card-title">{mod.title}</h3>
                <p style={{ margin: 0, color: 'var(--cm-muted)' }}>{mod.promise}</p>

                {mod.status === 'published' && mod.blocks.length > 0 ? (
                  <div className="block-list">
                    {mod.blocks.map((block) => (
                      <article key={block.id} className="block-card">
                        <div className="badge-row">
                          <span className="badge badge-brand">Bloco {block.position}</span>
                          {block.isFreeSample ? (
                            <span className="badge badge-available">Amostra gratuita</span>
                          ) : (
                            <span className="badge badge-neutral">Módulo 1 completo</span>
                          )}
                        </div>
                        <h4>{block.title}</h4>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--cm-muted)' }}>
                          {block.focus}
                        </p>

                        <ol className="lesson-list">
                          {block.lessons.map((lesson) => (
                            <li key={lesson.id} className="lesson-item">
                              <div className="lesson-item-head">
                                <strong>
                                  Aula {String(lesson.position).padStart(2, '0')} · {lesson.title}
                                </strong>
                                <span style={{ color: 'var(--cm-muted)', flexShrink: 0 }}>
                                  {lesson.slidesCount} telas
                                </span>
                              </div>
                              {lesson.goal ? (
                                <p className="lesson-item-goal">{lesson.goal}</p>
                              ) : null}
                            </li>
                          ))}
                        </ol>

                        <p className="block-quiz-foot">
                          <strong>Avaliação do bloco:</strong> 10 questões sorteadas (mínimo{' '}
                          {block.minPassPercent}% para liberar o próximo bloco).
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="notice-box" role="note">
                    <strong>Módulo em produção:</strong> previsto com 15 aulas organizadas em 5
                    blocos avaliados. Este conteúdo ainda não está liberado e será publicado
                    somente após revisão didática completa.
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

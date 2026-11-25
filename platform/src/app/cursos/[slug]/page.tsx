import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublishedCourseBySlug } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

function formatPrice(priceCents: number | null, currency: string, isFree: boolean): string {
  if (isFree) return 'Gratuito (amostra explícita)';
  if (priceCents === null) return 'Em definição comercial';
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
    notFound();
  }

  return (
    <>
      <section className="hero-section">
        <div className="container">
          <div className="badge-row" style={{ marginBottom: 14 }}>
            <span className="badge badge-available">Módulo 1 disponível</span>
            <span className="badge badge-brand">{course.category}</span>
            <span className="badge badge-neutral">
              Mínimo {course.minPassPercent}% por bloco
            </span>
          </div>
          <h1 className="hero-title">{course.title}</h1>
          <p className="hero-subtitle">{course.summary}</p>

          <div className="hero-metrics">
            <div className="metric-card">
              <strong>
                {course.availableLessonsCount} de {course.plannedLessonsCount} aulas
              </strong>
              <span>Aulas publicadas no Módulo 1; Módulos 2 e 3 seguem planejados.</span>
            </div>
            <div className="metric-card">
              <strong>{course.availableBlocksCount} blocos avaliados</strong>
              <span>3 aulas por bloco + quiz de 10 questões sorteadas no servidor.</span>
            </div>
            <div className="metric-card">
              <strong>{course.assetsSummary.slidesPacks} conjuntos de slides</strong>
              <span>
                Vídeos Cloudflare Stream: {course.assetsSummary.streamVideosReady} prontos /{' '}
                {course.assetsSummary.streamVideosPending} pendentes.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <p className="eyebrow">Ofertas e acesso</p>
          <h2 className="section-heading">Opções publicadas para este curso</h2>

          <div className="grid-2" style={{ marginTop: 20 }}>
            {course.publishedOffers.map((offer) => (
              <article key={offer.id} className="card">
                <div className="badge-row">
                  <span className="badge badge-available">
                    {offer.isFree ? 'Amostra gratuita' : 'Oferta publicada'}
                  </span>
                  <span className="badge badge-neutral">SKU {offer.sku}</span>
                </div>
                <h3 className="course-card-title">{offer.title}</h3>
                <p style={{ margin: 0, color: 'var(--cm-muted)' }}>{offer.description}</p>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--cm-ink)' }}>
                  {formatPrice(offer.priceCents, offer.currency, offer.isFree)}
                </p>
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <Link href={`/oferta/${offer.offerCode}`} className="pill-btn">
                    Ver detalhes da oferta
                  </Link>
                </div>
              </article>
            ))}

            {course.draftOffersCount > 0 ? (
              <article className="card">
                <div className="badge-row">
                  <span className="badge badge-planned">Em preparação comercial</span>
                </div>
                <h3 className="course-card-title">Módulos pagos e pacote completo</h3>
                <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
                  Existem {course.draftOffersCount} ofertas em estado de rascunho no banco de
                  dados aguardando definição formal de preço, prazo de acesso e vinculação de
                  produto na Hotmart. Nenhum preço provisório é publicado nesta etapa.
                </p>
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <Link href="/suporte" className="pill-btn pill-btn-secondary">
                    Falar com o suporte
                  </Link>
                </div>
              </article>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">Estrutura pedagógica preservada</p>
          <h2 className="section-heading">Módulos, blocos e sequência de aulas</h2>
          <p className="section-lead">
            A sequência abaixo reflete exatamente o material verificado em{' '}
            <code>LEIA-ME.md</code> e <code>assets/formacao.js</code>. Módulos planejados são
            sinalizados claramente e não possuem aulas inventadas.
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
                    {mod.status === 'published' ? 'Disponível agora' : 'Planejado'}
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
                          <span className="badge badge-brand">{block.code}</span>
                          {block.isFreeSample ? (
                            <span className="badge badge-available">Amostra gratuita</span>
                          ) : (
                            <span className="badge badge-neutral">Requer módulo liberado</span>
                          )}
                        </div>
                        <h4>{block.title}</h4>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--cm-muted)' }}>
                          {block.focus}
                        </p>
                        <ol className="lesson-list">
                          {block.lessons.map((lesson) => (
                            <li key={lesson.id}>
                              <strong>
                                Aula {String(lesson.position).padStart(2, '0')}:
                              </strong>{' '}
                              {lesson.title}{' '}
                              <span style={{ color: 'var(--cm-muted)' }}>
                                ({lesson.slidesCount} telas)
                              </span>
                            </li>
                          ))}
                        </ol>
                        <p
                          style={{
                            margin: '12px 0 0',
                            fontSize: 13,
                            color: 'var(--cm-muted)',
                          }}
                        >
                          Avaliação do bloco: 10 questões sorteadas de um banco de{' '}
                          {block.quizQuestionBankCount} no servidor · mínimo{' '}
                          {block.minPassPercent}%.
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="notice-box" role="note">
                    Conteúdo planejado (15 aulas em 5 blocos). Não publicado ainda; nenhuma
                    aula ou gabarito foi inventado.
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

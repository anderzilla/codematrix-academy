import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { OfferCheckoutClient } from '@/components/OfferCheckoutClient';
import { getPublishedOfferByCode } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function OfferCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ offerCode: string }>;
  searchParams: Promise<{ cupom?: string; ref?: string }>;
}) {
  const { offerCode } = await params;
  const qs = await searchParams;
  const offer = getPublishedOfferByCode(offerCode);

  if (!offer) {
    notFound();
  }

  return (
    <section className="section">
      <div className="container-narrow">
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Cursos', href: '/cursos' },
            { label: offer.courseTitle, href: `/cursos/${offer.courseSlug}` },
            { label: offer.isFree ? 'Amostra gratuita' : 'Inscrição' },
          ]}
        />

        <div className="card card-highlight">
          <div className="badge-row">
            <span className="badge badge-available">
              {offer.isFree ? 'Acesso gratuito · Bloco 1' : 'Checkout próprio CodeMatrix'}
            </span>
            <span className="badge badge-brand">{offer.courseTitle}</span>
          </div>

          <h1 className="section-heading" style={{ margin: 0 }}>
            {offer.title}
          </h1>
          <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 16 }}>
            {offer.description}
          </p>

          <div>
            <h2 style={{ margin: '8px 0 12px', fontSize: 18 }}>O que está incluído</h2>
            <ul className="check-list">
              {offer.isFree ? (
                <>
                  <li>
                    <span className="check-icon" aria-hidden="true">
                      ✓
                    </span>
                    <span>
                      <strong>Aulas 1, 2 e 3 do Módulo 1</strong> — fundamentos de IA, como
                      modelos aprendem com exemplos e como separar fluência de evidência.
                    </span>
                  </li>
                  <li>
                    <span className="check-icon" aria-hidden="true">
                      ✓
                    </span>
                    <span>
                      <strong>12 telas interativas + Pare e Anote</strong> com anotações salvas na
                      sua conta.
                    </span>
                  </li>
                  <li>
                    <span className="check-icon" aria-hidden="true">
                      ✓
                    </span>
                    <span>
                      <strong>Quiz de fixação do Bloco 1</strong> com 10 questões sorteadas e
                      revisão orientada das respostas.
                    </span>
                  </li>
                </>
              ) : (
                <li>
                  <span className="check-icon" aria-hidden="true">
                    ✓
                  </span>
                  <span>
                    Acesso completo aos conteúdos desta oferta na Área do Aluno, com progresso
                    salvo, quizzes avaliados no servidor e certificado verificável ao concluir.
                  </span>
                </li>
              )}
            </ul>
          </div>

          {offer.isFree ? (
            <>
              <div className="info-box">
                <strong>Como começar em 2 passos (sem cartão de crédito):</strong>
                <br />
                1. Crie sua conta ou entre na Área do Aluno.
                <br />
                2. Clique em <strong>&ldquo;Ativar amostra gratuita — Bloco 1&rdquo;</strong> para
                liberar as 3 aulas imediatamente.
              </div>
              <div className="hero-actions" style={{ marginTop: 8 }}>
                <Link href="/app" className="pill-btn">
                  Entrar e ativar amostra gratuita
                </Link>
                <Link href={`/cursos/${offer.courseSlug}`} className="pill-btn pill-btn-secondary">
                  Voltar para a grade do curso
                </Link>
              </div>
            </>
          ) : (
            <OfferCheckoutClient
              offerCode={offer.offerCode}
              offerTitle={offer.title}
              priceCents={offer.priceCents}
              currency={offer.currency}
              initialCoupon={qs.cupom || ''}
              initialRef={qs.ref || ''}
            />
          )}
        </div>
      </div>
    </section>
  );
}

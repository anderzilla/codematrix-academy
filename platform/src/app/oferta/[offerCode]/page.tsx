import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getPublishedOfferByCode } from '@/lib/catalog';
import { resolveCheckoutTarget } from '@/lib/payments/hotmart';

export const dynamic = 'force-dynamic';

export default async function OfferCheckoutPage({
  params,
}: {
  params: Promise<{ offerCode: string }>;
}) {
  const { offerCode } = await params;
  const offer = getPublishedOfferByCode(offerCode);

  if (!offer) {
    notFound();
  }

  const checkout = resolveCheckoutTarget(offer);

  return (
    <section className="section">
      <div className="container-narrow">
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Cursos', href: '/cursos' },
            { label: offer.courseTitle, href: `/cursos/${offer.courseSlug}` },
            { label: offer.isFree ? 'Amostra gratuita' : 'Detalhes da oferta' },
          ]}
        />

        <div className="card card-highlight">
          <div className="badge-row">
            <span className="badge badge-available">
              {offer.isFree ? 'Acesso gratuito · Bloco 1' : 'Oferta disponível'}
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
                      <strong>12 telas de apresentação</strong> com exemplos cotidianos e pausas
                      de fixação.
                    </span>
                  </li>
                  <li>
                    <span className="check-icon" aria-hidden="true">
                      ✓
                    </span>
                    <span>
                      <strong>Quiz de fixação do Bloco 1</strong> com 10 questões sorteadas,
                      mínimo de 70% e revisão orientada das respostas.
                    </span>
                  </li>
                </>
              ) : (
                <li>
                  <span className="check-icon" aria-hidden="true">
                    ✓
                  </span>
                  <span>
                    Acesso individual aos conteúdos definidos nesta oferta dentro da Área do
                    Aluno da CodeMatrix Academy.
                  </span>
                </li>
              )}
            </ul>
          </div>

          <div className="info-box">
            <strong>Como funciona a liberação do seu acesso:</strong>{' '}
            {offer.isFree
              ? 'Esta amostra é gratuita e não exige cartão de crédito. O acesso será liberado diretamente na Área do Aluno assim que o cadastro e o login da plataforma estiverem ativos.'
              : 'Após concluir o pagamento no checkout oficial da Hotmart, o sistema confirma a transação automaticamente no servidor e libera o seu acesso na Área do Aluno.'}
          </div>

          {checkout.state === 'unconfigured_fail_closed' ||
          checkout.state === 'sandbox_unavailable' ? (
            <div className="notice-box" role="alert">
              <strong>Checkout temporariamente indisponível:</strong> esta oferta ainda não
              está conectada ao checkout externo neste ambiente. Em caso de dúvida, fale com o{' '}
              <Link href="/suporte" className="inline-link">
                suporte da Academy
              </Link>
              .
            </div>
          ) : null}

          <div className="hero-actions" style={{ marginTop: 8 }}>
            {checkout.state === 'ready' && checkout.checkoutUrl ? (
              <a
                href={checkout.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pill-btn"
              >
                Continuar para o checkout Hotmart
              </a>
            ) : null}
            {checkout.state === 'free_sample' ? (
              <Link href="/app" className="pill-btn">
                Acessar Área do Aluno
              </Link>
            ) : null}
            <Link href={`/cursos/${offer.courseSlug}`} className="pill-btn pill-btn-secondary">
              Voltar para a grade do curso
            </Link>
          </div>

          <p className="meta-ref">Código de referência da oferta: {offer.sku}</p>
        </div>
      </div>
    </section>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
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
        <div className="card">
          <div className="badge-row">
            <span className="badge badge-available">
              {offer.isFree ? 'Amostra gratuita' : 'Oferta publicada'}
            </span>
            <span className="badge badge-neutral">SKU {offer.sku}</span>
          </div>

          <p className="eyebrow" style={{ margin: 0 }}>
            {offer.courseTitle}
          </p>
          <h1 className="section-heading" style={{ margin: 0 }}>
            {offer.title}
          </h1>
          <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 16 }}>
            {offer.description}
          </p>

          <div className="info-box">
            <strong>Escopo de acesso:</strong> <code>{offer.accessScope}</code>
            <br />
            <strong>Regra de liberação:</strong> o navegador nunca concede acesso por conta
            própria. Compras pagas são confirmadas exclusivamente via webhook autenticado da
            Hotmart e processadas pelo serviço central de direitos (Etapa 2).
          </div>

          {checkout.state === 'free_sample' ? (
            <div className="notice-box" role="status">
              {checkout.message}
            </div>
          ) : null}

          {checkout.state === 'unconfigured_fail_closed' ||
          checkout.state === 'sandbox_unavailable' ? (
            <div className="notice-box" role="alert">
              {checkout.message}
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
                Ir para checkout Hotmart
              </a>
            ) : null}
            {checkout.state === 'free_sample' ? (
              <Link href="/app" className="pill-btn">
                Ir para Área do Aluno (Etapa 2)
              </Link>
            ) : null}
            <Link href={`/cursos/${offer.courseSlug}`} className="pill-btn pill-btn-secondary">
              Voltar ao curso
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

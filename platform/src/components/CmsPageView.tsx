import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getPublishedCmsPage } from '@/lib/catalog';

export function CmsPageView({ slug }: { slug: string }) {
  const page = getPublishedCmsPage(slug);

  if (!page) {
    return (
      <section className="section">
        <div className="container-narrow">
          <div className="notice-box" role="status">
            Conteúdo institucional indisponível no momento. Volte para a{' '}
            <Link href="/" className="inline-link">
              página inicial
            </Link>
            .
          </div>
        </div>
      </section>
    );
  }

  const supportEmail = process.env.ACADEMY_SUPPORT_EMAIL || 'contato@codematrix.com.br';
  const isSupport = slug === 'suporte';

  return (
    <section className="section">
      <div className="container-narrow">
        <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: page.title }]} />

        <p className="eyebrow">CodeMatrix Academy · Institucional</p>
        <h1 className="section-heading">{page.title}</h1>
        <p className="section-lead">{page.subtitle}</p>

        {page.reviewNotice ? (
          <div className="notice-box" role="note" style={{ marginBottom: 24 }}>
            <strong>Aviso de transparência:</strong> {page.reviewNotice}
          </div>
        ) : null}

        {isSupport ? (
          <div className="card card-highlight" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Como agilizar seu atendimento</h2>
            <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
              Envie sua mensagem para{' '}
              <a href={`mailto:${supportEmail}`} className="inline-link">
                {supportEmail}
              </a>{' '}
              informando os dados abaixo para nossa equipe responder com mais rapidez:
            </p>
            <ul className="check-list">
              <li>
                <span className="check-icon" aria-hidden="true">
                  1
                </span>
                <span>Seu nome e o e-mail usado (ou que deseja usar) na CodeMatrix Academy.</span>
              </li>
              <li>
                <span className="check-icon" aria-hidden="true">
                  2
                </span>
                <span>O nome do curso ou módulo relacionado à sua dúvida.</span>
              </li>
              <li>
                <span className="check-icon" aria-hidden="true">
                  3
                </span>
                <span>
                  Em caso de compra ou reembolso, o código da transação enviado pela Hotmart
                  (nunca envie dados de cartão ou senhas).
                </span>
              </li>
            </ul>
          </div>
        ) : null}

        <div className="module-stack">
          {page.sections.map((section) => (
            <article key={section.heading} className="card">
              <h2 style={{ margin: 0, fontSize: 21 }}>{section.heading}</h2>
              {section.paragraphs.map((text, idx) => (
                <p key={idx} style={{ margin: 0, color: 'var(--cm-muted)' }}>
                  {text}
                </p>
              ))}
            </article>
          ))}
        </div>

        <div className="info-box" style={{ marginTop: 24 }}>
          Precisa de ajuda? Escreva para{' '}
          <a href={`mailto:${supportEmail}`} className="inline-link">
            {supportEmail}
          </a>{' '}
          ou{' '}
          <Link href="/cursos" className="inline-link">
            volte para o catálogo de cursos
          </Link>
          .
        </div>
      </div>
    </section>
  );
}

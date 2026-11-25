import Link from 'next/link';
import { getPublishedCmsPage } from '@/lib/catalog';

export function CmsPageView({ slug }: { slug: string }) {
  const page = getPublishedCmsPage(slug);

  if (!page) {
    return (
      <section className="section">
        <div className="container-narrow">
          <div className="notice-box" role="status">
            Conteúdo institucional ainda não carregado. Execute <code>npm run seed</code>.
          </div>
        </div>
      </section>
    );
  }

  const supportEmail = process.env.ACADEMY_SUPPORT_EMAIL || 'contato@codematrix.com.br';

  return (
    <section className="section">
      <div className="container-narrow">
        <p className="eyebrow">Institucional · conteúdo configurável</p>
        <h1 className="section-heading">{page.title}</h1>
        <p className="section-lead">{page.subtitle}</p>

        {page.reviewNotice ? (
          <div className="notice-box" role="note" style={{ marginBottom: 24 }}>
            {page.reviewNotice}
          </div>
        ) : null}

        <div className="module-stack">
          {page.sections.map((section) => (
            <article key={section.heading} className="card">
              <h2 style={{ margin: 0, fontSize: 22 }}>{section.heading}</h2>
              {section.paragraphs.map((text, idx) => (
                <p key={idx} style={{ margin: 0, color: 'var(--cm-muted)' }}>
                  {text}
                </p>
              ))}
            </article>
          ))}
        </div>

        <div className="info-box" style={{ marginTop: 24 }}>
          Canal de contato configurado: <strong>{supportEmail}</strong> ·{' '}
          <Link href="/cursos" style={{ color: 'var(--cm-blue)', fontWeight: 650 }}>
            Voltar ao catálogo
          </Link>
        </div>
      </div>
    </section>
  );
}

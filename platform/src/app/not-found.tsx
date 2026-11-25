import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <section className="section">
      <div className="container-narrow">
        <div className="card">
          <span className="badge badge-neutral" style={{ width: 'fit-content' }}>
            404
          </span>
          <h1 className="section-heading" style={{ margin: 0 }}>
            Página não encontrada
          </h1>
          <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
            O curso, oferta ou rota solicitada não está disponível ou permanece em rascunho.
          </p>
          <div>
            <Link href="/cursos" className="pill-btn">
              Voltar ao catálogo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

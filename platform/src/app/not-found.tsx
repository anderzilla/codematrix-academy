import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <section className="section">
      <div className="container-narrow">
        <div className="card">
          <span className="badge badge-neutral" style={{ width: 'fit-content' }}>
            Página não encontrada
          </span>
          <h1 className="section-heading" style={{ margin: 0 }}>
            Não encontramos este endereço
          </h1>
          <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
            O link pode estar desatualizado ou o curso/oferta solicitado ainda não foi
            publicado. Use os atalhos abaixo para continuar navegando.
          </p>
          <div className="hero-actions" style={{ marginTop: 8 }}>
            <Link href="/cursos" className="pill-btn">
              Ver catálogo de cursos
            </Link>
            <Link href="/" className="pill-btn pill-btn-secondary">
              Ir para a página inicial
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

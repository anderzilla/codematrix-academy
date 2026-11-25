import Link from 'next/link';
import type { SurfaceContract } from '@/lib/contracts';

export function RestrictedSurfaceGate({ surface }: { surface: SurfaceContract }) {
  return (
    <section className="section">
      <div className="container-narrow">
        <div className="card">
          <div className="badge-row">
            <span className="badge badge-planned">Acesso restrito</span>
            <span className="badge badge-neutral">Etapa {surface.stage} de 4</span>
            {surface.requiresMfa ? (
              <span className="badge badge-brand">MFA obrigatório</span>
            ) : null}
          </div>

          <h1 className="section-heading" style={{ margin: 0 }}>
            {surface.name}
          </h1>
          <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 16 }}>
            {surface.summary}
          </p>

          <div className="info-box">
            <strong>Isolamento por padrão:</strong> esta superfície exige autenticação
            validada no servidor e autorização por papel ({surface.allowedRoles.join(', ')}).
            Na Etapa 1, nenhum dado privado de aluno, parceiro, financeiro ou gabarito é
            exposto publicamente.
          </div>

          <div className="hero-actions" style={{ marginTop: 8 }}>
            <Link href="/cursos" className="pill-btn">
              Ver catálogo público
            </Link>
            <Link href="/" className="pill-btn pill-btn-secondary">
              Voltar para a vitrine
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

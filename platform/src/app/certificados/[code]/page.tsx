import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getPublicCertificateByCode } from '@/lib/certificates';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function PublicCertificateVerificationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const db = getDb();
  const cert = getPublicCertificateByCode(db, code);
  const publicBase = (process.env.ACADEMY_PUBLIC_URL || 'https://academy.codematrix.com.br').replace(/\/+$/, '');
  const verifyUrl = `${publicBase}/certificados/${encodeURIComponent(code)}`;

  if (!cert) {
    return (
      <section className="section">
        <div className="container-narrow">
          <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Verificação de certificado' }]} />
          <div className="card">
            <span className="badge badge-planned" style={{ width: 'fit-content' }}>
              Não encontrado
            </span>
            <h1 className="section-heading" style={{ margin: 0 }}>
              Certificado não localizado
            </h1>
            <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
              Não existe registro público ativo para o código informado. Confira se o link está
              completo.
            </p>
            <div>
              <Link href="/" className="pill-btn">
                Voltar à vitrine
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container-narrow">
        <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Verificação de certificado' }]} />

        <article className="cert-card">
          <div className="badge-row">
            <span className={`badge ${cert.status === 'valid' ? 'badge-available' : 'badge-planned'}`}>
              {cert.status === 'valid' ? 'Certificado válido ✓' : 'Certificado revogado'}
            </span>
            <span className="badge badge-brand">Verificação pública</span>
          </div>

          <p className="eyebrow" style={{ margin: 0 }}>
            CodeMatrix Academy · Registro de conclusão
          </p>
          <h1 className="section-heading" style={{ margin: 0 }}>
            {cert.studentDisplayName}
          </h1>
          <p style={{ margin: 0, fontSize: 18 }}>
            Concluiu <strong>{cert.courseTitle}</strong> — {cert.scopeLabel} ({cert.workloadHours}{' '}
            horas estimadas).
          </p>

          <div className="info-box">
            <strong>Código de verificação:</strong> <code>{cert.verificationCode}</code>
            <br />
            <strong>Data de emissão:</strong> {new Date(cert.issuedAt).toLocaleDateString('pt-BR')}
            <br />
            <strong>URL pública:</strong> <code>{verifyUrl}</code>
            {cert.status === 'revoked' && cert.revocationReason ? (
              <>
                <br />
                <strong>Motivo da revogação:</strong> {cert.revocationReason}
              </>
            ) : null}
          </div>

          <div className="notice-box" role="note">
            {cert.templateNotice}
          </div>

          <p className="meta-ref">
            Por privacidade (LGPD), esta página pública exibe apenas o nome do titular, curso,
            carga horária e status de validade — sem CPF, e-mail ou dados financeiros.
          </p>
        </article>
      </div>
    </section>
  );
}

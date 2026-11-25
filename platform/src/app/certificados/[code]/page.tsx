import crypto from 'node:crypto';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getPublicCertificateByCode } from '@/lib/certificates';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Gera matriz visual QR determinística baseada no código de verificação (sem dependência externa) */
function renderVerificationMatrixSvg(code: string) {
  const hash = crypto.createHash('sha256').update(code).digest();
  const size = 21;
  const cells: Array<{ x: number; y: number }> = [];
  const isFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isFinder(x, y)) {
        const lx = x >= size - 7 ? x - (size - 7) : x;
        const ly = y >= size - 7 ? y - (size - 7) : y;
        const border = lx === 0 || lx === 6 || ly === 0 || ly === 6;
        const center = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
        if (border || center) cells.push({ x, y });
      } else {
        const bitIndex = (y * size + x) % (hash.length * 8);
        const byte = hash[Math.floor(bitIndex / 8)];
        if ((byte >> (bitIndex % 8)) & 1) cells.push({ x, y });
      }
    }
  }

  return (
    <svg
      width={116}
      height={116}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Código visual de verificação ${code}`}
      style={{ background: '#fff', padding: 8, borderRadius: 12, border: '1px solid var(--cm-line)' }}
    >
      {cells.map((c, idx) => (
        <rect key={idx} x={c.x} y={c.y} width={1} height={1} fill="#0b1530" />
      ))}
    </svg>
  );
}

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

          <div className="info-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
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
            {renderVerificationMatrixSvg(cert.verificationCode)}
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

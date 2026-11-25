'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface AdminOverviewData {
  courses: Array<{
    id: string;
    slug: string;
    title: string;
    status: string;
    published_modules: number;
    planned_modules: number;
    published_lessons: number;
    pending_stream_videos: number;
  }>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    roles_csv: string | null;
  }>;
  paymentEvents: Array<{
    id: string;
    provider_event_id: string;
    event_type: string;
    offer_sku: string | null;
    transaction_code: string | null;
    processing_status: string;
    entitlement_status: string;
    received_at: string;
  }>;
  ledgerSummary: {
    entries_count: number;
    gross_cents: number;
    discount_cents: number;
    gateway_fee_cents: number;
    commission_cents: number;
    refund_cents: number;
    chargeback_cents: number;
    net_cents: number;
  };
  payoutBatches: Array<{
    id: string;
    period_label: string;
    status: string;
    total_commission_cents: number;
    prepared_by: string;
    approved_by: string | null;
    payment_method: string | null;
    payment_reference: string | null;
  }>;
  certificates: Array<{
    verification_code: string;
    student_display_name: string;
    course_title: string;
    status: string;
    revocation_reason: string | null;
  }>;
  auditEvents: Array<{
    id: string;
    actor_role: string;
    action: string;
    target_type: string;
    target_id: string;
    created_at: string;
  }>;
  integrationsHealth: {
    hotmart: { mode: string; hottokConfigured: boolean };
    cloudflareStream: { signingConfigured: boolean; allowedOrigins: string };
    email: { devMailboxEnabled: boolean; smtpConfigured: boolean };
    persistence: {
      sql: { driver: string; configured: boolean; azureTarget: string };
      nosql: { driver: string; configured: boolean; azureTarget: string };
    };
  };
}

function formatBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (Number(cents) || 0) / 100,
  );
}

export function AdminDashboardClient({
  actorName,
  mfaVerified,
  overview,
}: {
  actorName: string;
  mfaVerified: boolean;
  overview: AdminOverviewData | null;
}) {
  const router = useRouter();
  const [mfaCode, setMfaCode] = useState('');
  const [tab, setTab] = useState<'overview' | 'courses' | 'finance' | 'audit'>('overview');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [periodLabel, setPeriodLabel] = useState('2026-11');
  const [revokeCode, setRevokeCode] = useState('');
  const [revokeReason, setRevokeReason] = useState('');

  async function handleVerifyMfa(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/admin/mfa/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: mfaCode }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Código MFA inválido.');
        return;
      }
      setMfaCode('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handlePrepareBatch(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/admin/payout-batches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ periodLabel, includePendingWarranty: true }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; batchId?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Não foi possível preparar o lote.');
        return;
      }
      setFeedback(`Lote preliminar ${json.batchId} preparado. Aguardando segunda aprovação (maker-checker).`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveBatch(batchId: string) {
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/payout-batches/${batchId}/approve`, {
        method: 'POST',
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Não foi possível aprovar o lote.');
        return;
      }
      setFeedback(`Lote ${batchId} aprovado por dupla aprovação.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeCert(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/admin/certificates/revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ verificationCode: revokeCode, reason: revokeReason }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Não foi possível revogar o certificado.');
        return;
      }
      setRevokeCode('');
      setRevokeReason('');
      setFeedback('Certificado revogado com trilha de auditoria.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!mfaVerified || !overview) {
    return (
      <div className="card card-highlight">
        <div className="badge-row">
          <span className="badge badge-brand">Verificação em duas etapas (MFA)</span>
        </div>
        <h1 className="section-heading" style={{ margin: 0 }}>
          Confirme seu código MFA para acessar a Administração
        </h1>
        <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
          Conectado como <strong>{actorName}</strong>. Operações administrativas e financeiras
          exigem verificação em duas etapas ativa nesta sessão.
        </p>
        {errorMsg ? (
          <div className="alert-error" role="alert">
            {errorMsg}
          </div>
        ) : null}
        <form onSubmit={handleVerifyMfa} className="form-stack" style={{ maxWidth: 360 }}>
          <div className="field-group">
            <label htmlFor="admin-mfa-code">Código MFA (6 dígitos)</label>
            <input
              id="admin-mfa-code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              required
              className="field-input"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder="000000"
            />
          </div>
          <button type="submit" className="pill-btn" disabled={busy}>
            {busy ? 'Validando...' : 'Validar MFA e entrar'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="module-stack">
      <div className="card">
        <div className="badge-row">
          <span className="badge badge-available">MFA ativo ✓</span>
          <span className="badge badge-brand">Painel Administrativo</span>
        </div>
        <h1 className="section-heading" style={{ margin: 0 }}>
          Operação e Governança — CodeMatrix Academy
        </h1>
        <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 14 }}>
          Operador: <strong>{actorName}</strong> · Pagamentos reais exigem aprovação humana
          maker-checker e execução manual externa (nenhuma movimentação bancária automática).
        </p>
        <div className="tabs-row" style={{ marginTop: 8, marginBottom: 0 }} role="tablist">
          <button type="button" role="tab" className="tab-btn" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>
            Visão geral e saúde
          </button>
          <button type="button" role="tab" className="tab-btn" aria-selected={tab === 'courses'} onClick={() => setTab('courses')}>
            Cursos e mídia
          </button>
          <button type="button" role="tab" className="tab-btn" aria-selected={tab === 'finance'} onClick={() => setTab('finance')}>
            Financeiro e repasses
          </button>
          <button type="button" role="tab" className="tab-btn" aria-selected={tab === 'audit'} onClick={() => setTab('audit')}>
            Auditoria e certificados
          </button>
        </div>
      </div>

      {feedback ? <div className="alert-success" role="status">{feedback}</div> : null}
      {errorMsg ? <div className="alert-error" role="alert">{errorMsg}</div> : null}

      {tab === 'overview' ? (
        <div className="grid-2">
          <div className="card">
            <h2 style={{ margin: 0, fontSize: 20 }}>Saúde das integrações</h2>
            <ul className="check-list">
              <li>
                <span className="check-icon">H</span>
                <span>
                  <strong>Hotmart:</strong> modo {overview.integrationsHealth.hotmart.mode} · hottok{' '}
                  {overview.integrationsHealth.hotmart.hottokConfigured ? 'configurado' : 'ausente (fail-closed)'}
                </span>
              </li>
              <li>
                <span className="check-icon">S</span>
                <span>
                  <strong>Cloudflare Stream:</strong> assinatura RS256{' '}
                  {overview.integrationsHealth.cloudflareStream.signingConfigured ? 'configurada' : 'pendente (fail-closed)'}
                </span>
              </li>
              <li>
                <span className="check-icon">D</span>
                <span>
                  <strong>Banco SQL:</strong> {overview.integrationsHealth.persistence.sql.driver} ·{' '}
                  <strong>NoSQL:</strong> {overview.integrationsHealth.persistence.nosql.driver}
                </span>
              </li>
            </ul>
          </div>

          <div className="card">
            <h2 style={{ margin: 0, fontSize: 20 }}>Resumo do razão operacional (append-only)</h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--cm-muted)' }}>
              Lançamentos: <strong>{overview.ledgerSummary.entries_count}</strong>
              <br />
              Bruto: <strong>{formatBrl(overview.ledgerSummary.gross_cents)}</strong> · Taxas:{' '}
              <strong>{formatBrl(overview.ledgerSummary.gateway_fee_cents)}</strong>
              <br />
              Comissões: <strong>{formatBrl(overview.ledgerSummary.commission_cents)}</strong> ·
              Estornos/Chargeback:{' '}
              <strong>
                {formatBrl(
                  overview.ledgerSummary.refund_cents + overview.ledgerSummary.chargeback_cents,
                )}
              </strong>
              <br />
              Líquido operacional: <strong>{formatBrl(overview.ledgerSummary.net_cents)}</strong>
            </p>
            <div>
              <a href="/api/v1/admin/ledger/export" className="pill-btn pill-btn-sm">
                Exportar razão operacional (CSV)
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'courses' ? (
        <section className="card">
          <h2 style={{ margin: 0, fontSize: 22 }}>Catálogo multi-curso e alertas de completude</h2>
          <div className="module-stack">
            {overview.courses.map((c) => (
              <article key={c.id} className="block-card">
                <div className="badge-row">
                  <span className={`badge ${c.status === 'published' ? 'badge-available' : 'badge-planned'}`}>
                    {c.status}
                  </span>
                  <span className="badge badge-neutral">
                    {c.published_modules} módulo(s) publicado(s) · {c.planned_modules} planejado(s)
                  </span>
                  <span className="badge badge-neutral">
                    {c.pending_stream_videos} vídeo(s) Stream pendente(s)
                  </span>
                </div>
                <h4>{c.title}</h4>
                <div className="card-actions">
                  <Link href={`/app/cursos/${c.slug}`} className="pill-btn pill-btn-sm pill-btn-secondary">
                    Pré-visualizar como aluno
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'finance' ? (
        <div className="grid-2">
          <form onSubmit={handlePrepareBatch} className="card form-stack">
            <h2 style={{ margin: 0, fontSize: 20 }}>Fechamento de parceiros (Maker)</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--cm-muted)' }}>
              Prepara o lote preliminar. Outro administrador (Checker) precisará aprovar antes do
              pagamento manual.
            </p>
            <div className="field-group">
              <label htmlFor="batch-period">Período de competência</label>
              <input
                id="batch-period"
                className="field-input"
                required
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
              />
            </div>
            <button type="submit" className="pill-btn" disabled={busy}>
              Preparar lote preliminar
            </button>
          </form>

          <section className="card">
            <h2 style={{ margin: 0, fontSize: 20 }}>Lotes de repasse</h2>
            {overview.payoutBatches.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 14 }}>
                Nenhum lote criado ainda.
              </p>
            ) : (
              <div className="module-stack">
                {overview.payoutBatches.map((b) => (
                  <article key={b.id} className="lesson-item">
                    <div className="lesson-item-head">
                      <strong>
                        {b.period_label} · {formatBrl(b.total_commission_cents)}
                      </strong>
                      <span className="badge badge-neutral">{b.status}</span>
                    </div>
                    {b.status === 'pending_dual_approval' ? (
                      <button
                        type="button"
                        className="pill-btn pill-btn-sm"
                        style={{ marginTop: 8 }}
                        disabled={busy}
                        onClick={() => handleApproveBatch(b.id)}
                      >
                        Aprovar lote (Checker)
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'audit' ? (
        <div className="grid-2">
          <form onSubmit={handleRevokeCert} className="card form-stack">
            <h2 style={{ margin: 0, fontSize: 20 }}>Revogar certificado com justificativa</h2>
            <div className="field-group">
              <label htmlFor="cert-code">Código de verificação</label>
              <input
                id="cert-code"
                required
                className="field-input"
                value={revokeCode}
                onChange={(e) => setRevokeCode(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="cert-reason">Motivo obrigatório</label>
              <input
                id="cert-reason"
                required
                minLength={5}
                className="field-input"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
              />
            </div>
            <button type="submit" className="pill-btn" disabled={busy}>
              Revogar certificado
            </button>
          </form>

          <section className="card">
            <h2 style={{ margin: 0, fontSize: 20 }}>Trilha de auditoria recente</h2>
            <ul className="lesson-list">
              {overview.auditEvents.slice(0, 10).map((ev) => (
                <li key={ev.id} className="lesson-item">
                  <strong>{ev.action}</strong> ({ev.actor_role}) · {ev.target_type}:{ev.target_id}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}

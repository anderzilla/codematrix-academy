'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface PartnerDashboardData {
  profile: {
    partnerId: string;
    displayName: string;
    contactEmail: string;
    status: string;
    roles: string[];
    termsVersion: string | null;
    termsAcceptedAt: string | null;
    currentTermsVersion: string;
    payoutMethod: string | null;
    payoutMaskedSummary: string | null;
  };
  summary: {
    totalClicks: number;
    totalOrders: number;
    pendingWarrantyCents: number;
    approvedCents: number;
    blockedCents: number;
    paidCents: number;
    underReviewCents: number;
  };
  links: Array<{
    id: string;
    course_title: string;
    offer_sku: string;
    code: string;
    campaign: string;
    clicks_count: number;
    used_count: number;
    status: string;
  }>;
  coupons: Array<{
    id: string;
    course_title: string;
    offer_sku: string;
    code: string;
    campaign: string;
    discount_type: string;
    discount_value: number;
    used_count: number;
    status: string;
  }>;
  assignments: Array<{
    id: string;
    courseTitle: string;
    roleLabel: string;
    recordingStatus: string;
    liveTitle: string | null;
    liveScheduledAt: string | null;
    liveStatus: string | null;
    checklist: Array<{ label: string; done: boolean }>;
  }>;
  commissions: Array<{
    id: string;
    transaction_code: string;
    course_title: string;
    offer_sku: string;
    attribution_source: string;
    attribution_code: string;
    buyer_masked_label: string;
    rule_version: number;
    commission_cents: number;
    currency: string;
    status: string;
    created_at: string;
  }>;
  fraudFlags: Array<{
    id: string;
    signal_type: string;
    severity: string;
    status: string;
    detail: string;
    appeal_note: string | null;
  }>;
}

const ROLE_LABELS: Record<string, string> = {
  instructor: 'Professor / Instrutor',
  affiliate: 'Afiliado',
  seller: 'Vendedor',
  partner: 'Parceiro',
};

const COMMISSION_STATUS_LABELS: Record<string, string> = {
  estimated: 'Estimada',
  pending_warranty: 'Em garantia',
  approved: 'Aprovada',
  blocked_refund: 'Bloqueada (reembolso)',
  blocked_chargeback: 'Bloqueada (chargeback)',
  under_review: 'Em revisão',
  paid: 'Paga',
};

function formatBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    cents / 100,
  );
}

interface AssignedPartnerCourse {
  courseId: string;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  status: string;
  roles: string[];
  offers: Array<{
    id: string;
    sku: string;
    offerCode: string;
    title: string;
    priceCents: number | null;
    isFree: boolean;
    status: string;
  }>;
}

export function PartnersDashboardClient({
  data,
  assignedCourses = [],
}: {
  data: PartnerDashboardData;
  assignedCourses?: AssignedPartnerCourse[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'overview' | 'links' | 'instructor' | 'statement' | 'profile'>(
    'overview',
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const defaultCourse = assignedCourses[0] ?? null;
  const defaultOffer =
    defaultCourse?.offers.find((o) => !o.isFree) ?? defaultCourse?.offers[0] ?? null;

  // Forms
  const [selectedCourseId, setSelectedCourseId] = useState(defaultCourse?.courseId ?? '');
  const [selectedOfferSku, setSelectedOfferSku] = useState(defaultOffer?.sku ?? '');
  const [linkCode, setLinkCode] = useState('');
  const [linkCampaign, setLinkCampaign] = useState('lancamento');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState('10');
  const [payoutMethod, setPayoutMethod] = useState('PIX');
  const [payoutHolder, setPayoutHolder] = useState('');
  const [payoutKey, setPayoutKey] = useState('');
  const [appealNote, setAppealNote] = useState('');

  const activeCourse =
    assignedCourses.find((c) => c.courseId === selectedCourseId) ?? defaultCourse;
  const activeOfferSku =
    selectedOfferSku ||
    activeCourse?.offers.find((o) => !o.isFree)?.sku ||
    activeCourse?.offers[0]?.sku ||
    '';

  const canPromote = data.profile.roles.some((r) =>
    ['affiliate', 'seller', 'partner'].includes(r),
  );
  const isInstructor = data.profile.roles.includes('instructor');

  async function acceptTerms() {
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/partners/terms/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ termsVersion: data.profile.currentTermsVersion }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Não foi possível registrar o aceite.');
        return;
      }
      setFeedback('Aceite dos termos de parceria registrado com sucesso.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/partners/links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          courseId: activeCourse?.courseId || selectedCourseId,
          offerSku: activeOfferSku,
          code: linkCode,
          campaign: linkCampaign,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Não foi possível criar o link.');
        return;
      }
      setLinkCode('');
      setFeedback(`Link "${json.code}" criado com sucesso.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/partners/coupons', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          courseId: activeCourse?.courseId || selectedCourseId,
          offerSku: activeOfferSku,
          code: couponCode,
          campaign: linkCampaign,
          discountType: 'percent',
          discountValue: Number(couponDiscount) || 0,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Não foi possível criar o cupom.');
        return;
      }
      setCouponCode('');
      setFeedback(`Cupom "${json.code}" criado com sucesso.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePayout(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/partners/payout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          method: payoutMethod,
          holderName: payoutHolder,
          destinationKey: payoutKey,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; maskedSummary?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Não foi possível salvar os dados de repasse.');
        return;
      }
      setPayoutKey('');
      setFeedback(`Dados de repasse salvos de forma cifrada (${json.maskedSummary}).`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleChecklist(
    assignmentId: string,
    checklist: Array<{ label: string; done: boolean }>,
    idx: number,
  ) {
    const next = checklist.map((item, i) => (i === idx ? { ...item, done: !item.done } : item));
    const res = await fetch(`/api/v1/partners/assignments/${assignmentId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checklist: next }),
    });
    if (res.ok) {
      router.refresh();
    }
  }

  async function handleAppeal(flagId: string) {
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/partners/appeals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flagId, appealNote }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Não foi possível enviar o recurso.');
        return;
      }
      setAppealNote('');
      setFeedback(json.message || 'Recurso enviado para análise.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="module-stack">
      <div className="card">
        <div className="badge-row">
          <span className="badge badge-brand">Painel de Parceiros</span>
          <span
            className={`badge ${
              data.profile.status === 'approved' ? 'badge-available' : 'badge-planned'
            }`}
          >
            Perfil: {data.profile.status === 'approved' ? 'Aprovado' : data.profile.status}
          </span>
          {data.profile.roles.map((r) => (
            <span key={r} className="badge badge-neutral">
              {ROLE_LABELS[r] || r}
            </span>
          ))}
        </div>
        <h1 className="section-heading" style={{ margin: 0 }}>
          {data.profile.displayName}
        </h1>
        <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 14 }}>
          Acompanhe suas atribuições, links, cupons, agenda e demonstrativo de comissões. Por
          privacidade (LGPD), dados pessoais de compradores permanecem omitidos.
        </p>

        <div className="tabs-row" style={{ marginTop: 8, marginBottom: 0 }} role="tablist">
          <button
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={tab === 'overview'}
            onClick={() => setTab('overview')}
          >
            Visão geral
          </button>
          {canPromote ? (
            <button
              type="button"
              role="tab"
              className="tab-btn"
              aria-selected={tab === 'links'}
              onClick={() => setTab('links')}
            >
              Links e cupons
            </button>
          ) : null}
          {isInstructor ? (
            <button
              type="button"
              role="tab"
              className="tab-btn"
              aria-selected={tab === 'instructor'}
              onClick={() => setTab('instructor')}
            >
              Minhas aulas e lives
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={tab === 'statement'}
            onClick={() => setTab('statement')}
          >
            Demonstrativo
          </button>
          <button
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={tab === 'profile'}
            onClick={() => setTab('profile')}
          >
            Contrato e repasse
          </button>
          <Link href="/partners/courses" className="tab-btn" style={{ textDecoration: 'none' }}>
            Meus cursos ({assignedCourses.length})
          </Link>
        </div>

        {canPromote && assignedCourses.length > 0 ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
            <label htmlFor="partner-course-select" className="meta-ref" style={{ margin: 0 }}>
              Curso ativo para novos links/cupons:
            </label>
            <select
              id="partner-course-select"
              className="field-input"
              style={{ maxWidth: 280 }}
              value={activeCourse?.courseId ?? ''}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedCourseId(nextId);
                const nextCourse = assignedCourses.find((c) => c.courseId === nextId);
                const nextOffer =
                  nextCourse?.offers.find((o) => !o.isFree) ?? nextCourse?.offers[0] ?? null;
                setSelectedOfferSku(nextOffer?.sku ?? '');
              }}
            >
              {assignedCourses.map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.title}
                </option>
              ))}
            </select>
            {activeCourse && activeCourse.offers.length > 0 ? (
              <select
                aria-label="Oferta do curso selecionado"
                className="field-input"
                style={{ maxWidth: 240 }}
                value={activeOfferSku}
                onChange={(e) => setSelectedOfferSku(e.target.value)}
              >
                {activeCourse.offers.map((o) => (
                  <option key={o.sku} value={o.sku}>
                    {o.sku} — {o.title}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}
      </div>

      {feedback ? (
        <div className="alert-success" role="status">
          {feedback}
        </div>
      ) : null}
      {errorMsg ? (
        <div className="alert-error" role="alert">
          {errorMsg}
        </div>
      ) : null}

      {tab === 'overview' ? (
        <div className="hero-metrics" style={{ marginTop: 0 }}>
          <div className="metric-card">
            <strong>{data.summary.totalOrders} pedidos atribuídos</strong>
            <span>Cliques registrados nos seus links: {data.summary.totalClicks}</span>
          </div>
          <div className="metric-card">
            <strong>{formatBrl(data.summary.pendingWarrantyCents + data.summary.approvedCents)}</strong>
            <span>
              Em garantia: {formatBrl(data.summary.pendingWarrantyCents)} · Aprovado:{' '}
              {formatBrl(data.summary.approvedCents)}
            </span>
          </div>
          <div className="metric-card">
            <strong>{formatBrl(data.summary.paidCents)}</strong>
            <span>
              Já repassado · Bloqueado (estorno/chargeback): {formatBrl(data.summary.blockedCents)}
            </span>
          </div>
        </div>
      ) : null}

      {tab === 'links' && canPromote ? (
        <div className="grid-2">
          <form onSubmit={handleCreateLink} className="card form-stack">
            <h2 style={{ margin: 0, fontSize: 20 }}>Criar link de divulgação</h2>
            <div className="field-group">
              <label htmlFor="link-code">Código único do link</label>
              <input
                id="link-code"
                required
                className="field-input"
                value={linkCode}
                onChange={(e) => setLinkCode(e.target.value)}
                placeholder="ex.: parceiro-ia-nov"
              />
            </div>
            <div className="field-group">
              <label htmlFor="link-campaign">Campanha</label>
              <input
                id="link-campaign"
                className="field-input"
                value={linkCampaign}
                onChange={(e) => setLinkCampaign(e.target.value)}
              />
            </div>
            <button type="submit" className="pill-btn" disabled={busy}>
              Criar link
            </button>
            <ul className="lesson-list">
              {data.links.map((l) => (
                <li key={l.id} className="lesson-item">
                  <strong>{l.code}</strong> · {l.campaign} ({l.used_count} vendas / {l.clicks_count}{' '}
                  cliques)
                  <div className="meta-ref">
                    Link de divulgação: <code>/r/{l.code}</code>
                  </div>
                </li>
              ))}
            </ul>
          </form>

          <form onSubmit={handleCreateCoupon} className="card form-stack">
            <h2 style={{ margin: 0, fontSize: 20 }}>Criar cupom de campanha</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--cm-muted)' }}>
              O desconto para o aluno é configurado separadamente da sua comissão contratual.
            </p>
            <div className="field-group">
              <label htmlFor="coupon-code">Código do cupom</label>
              <input
                id="coupon-code"
                required
                className="field-input"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="ex.: PARCEIRO10"
              />
            </div>
            <div className="field-group">
              <label htmlFor="coupon-discount">Desconto para o aluno (%)</label>
              <input
                id="coupon-discount"
                type="number"
                min={0}
                max={30}
                className="field-input"
                value={couponDiscount}
                onChange={(e) => setCouponDiscount(e.target.value)}
              />
            </div>
            <button type="submit" className="pill-btn" disabled={busy}>
              Criar cupom
            </button>
            <ul className="lesson-list">
              {data.coupons.map((c) => (
                <li key={c.id} className="lesson-item">
                  <strong>{c.code}</strong> · {c.discount_value}% ({c.used_count} usos)
                </li>
              ))}
            </ul>
          </form>
        </div>
      ) : null}

      {tab === 'instructor' && isInstructor ? (
        <section className="card">
          <h2 style={{ margin: 0, fontSize: 22 }}>Cursos e lives atribuídos a você</h2>
          {data.assignments.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
              Nenhuma aula ou transmissão atribuída no momento.
            </p>
          ) : (
            <div className="grid-2">
              {data.assignments.map((a) => (
                <article key={a.id} className="block-card">
                  <div className="badge-row">
                    <span className="badge badge-brand">{a.roleLabel}</span>
                    <span className="badge badge-neutral">Gravação: {a.recordingStatus}</span>
                  </div>
                  <h4>{a.liveTitle || a.courseTitle}</h4>
                  {a.liveScheduledAt ? (
                    <p className="meta-ref">
                      Agenda: {new Date(a.liveScheduledAt).toLocaleString('pt-BR')}
                    </p>
                  ) : null}
                  <div className="form-stack" style={{ gap: 8 }}>
                    {a.checklist.map((item, idx) => (
                      <label key={idx} style={{ display: 'flex', gap: 8, fontSize: 14 }}>
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => handleToggleChecklist(a.id, a.checklist, idx)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === 'statement' ? (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>Demonstrativo próprio de comissões</h2>
            <a href="/api/v1/partners/statement/export" className="pill-btn pill-btn-sm">
              Exportar meu demonstrativo (CSV)
            </a>
          </div>
          {data.commissions.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
              Nenhuma comissão registrada ainda.
            </p>
          ) : (
            <div className="module-stack">
              {data.commissions.map((c) => (
                <article key={c.id} className="lesson-item">
                  <div className="lesson-item-head">
                    <strong>
                      {c.buyer_masked_label} · {c.course_title}
                    </strong>
                    <strong>{formatBrl(c.commission_cents)}</strong>
                  </div>
                  <p className="lesson-item-goal">
                    Origem: {c.attribution_source} ({c.attribution_code}) · Regra v{c.rule_version}{' '}
                    · Status: {COMMISSION_STATUS_LABELS[c.status] || c.status}
                  </p>
                </article>
              ))}
            </div>
          )}

          {data.fraudFlags.length > 0 ? (
            <div className="notice-box" style={{ marginTop: 12 }}>
              <strong>Sinalizações em revisão (com direito a recurso):</strong>
              {data.fraudFlags.map((f) => (
                <div key={f.id} style={{ marginTop: 10 }}>
                  <p style={{ margin: '0 0 8px' }}>{f.detail}</p>
                  {f.status === 'under_review' ? (
                    <div className="form-stack" style={{ gap: 8 }}>
                      <input
                        className="field-input"
                        value={appealNote}
                        onChange={(e) => setAppealNote(e.target.value)}
                        placeholder="Escreva sua justificativa para revisão humana"
                      />
                      <button
                        type="button"
                        className="pill-btn pill-btn-sm"
                        disabled={busy}
                        onClick={() => handleAppeal(f.id)}
                      >
                        Enviar recurso
                      </button>
                    </div>
                  ) : (
                    <p className="meta-ref">Status do recurso: {f.status}</p>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'profile' ? (
        <div className="grid-2">
          <div className="card">
            <h2 style={{ margin: 0, fontSize: 20 }}>Termos e contrato de parceria</h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--cm-muted)' }}>
              Versão vigente: <strong>{data.profile.currentTermsVersion}</strong>
              <br />
              Seu aceite:{' '}
              {data.profile.termsAcceptedAt
                ? `${data.profile.termsVersion} em ${new Date(data.profile.termsAcceptedAt).toLocaleDateString('pt-BR')}`
                : 'Pendente'}
            </p>
            <button type="button" className="pill-btn" disabled={busy} onClick={acceptTerms}>
              Aceitar versão vigente dos termos
            </button>
          </div>

          <form onSubmit={handleSavePayout} className="card form-stack">
            <h2 style={{ margin: 0, fontSize: 20 }}>Dados protegidos para repasse</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--cm-muted)' }}>
              Seus dados bancários são cifrados no servidor e nunca ficam visíveis para outros
              parceiros. Pagamentos são aprovados manualmente pela equipe financeira.
            </p>
            {data.profile.payoutMaskedSummary ? (
              <div className="info-box">
                Cadastro atual: <strong>{data.profile.payoutMaskedSummary}</strong>
              </div>
            ) : null}
            <div className="field-group">
              <label htmlFor="payout-method">Método</label>
              <select
                id="payout-method"
                className="field-input"
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value)}
              >
                <option value="PIX">PIX</option>
                <option value="TED">TED</option>
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="payout-holder">Nome/Razão social do titular</label>
              <input
                id="payout-holder"
                required
                className="field-input"
                value={payoutHolder}
                onChange={(e) => setPayoutHolder(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="payout-key">Chave PIX ou dados bancários</label>
              <input
                id="payout-key"
                required
                className="field-input"
                value={payoutKey}
                onChange={(e) => setPayoutKey(e.target.value)}
              />
            </div>
            <button type="submit" className="pill-btn" disabled={busy}>
              Salvar dados de repasse
            </button>
          </form>
        </div>
      ) : null}

      <p className="meta-ref">
        Precisa ajustar escopo ou contrato?{' '}
        <Link href="/suporte" className="inline-link">
          Fale com a operação da Academy
        </Link>
        .
      </p>
    </div>
  );
}

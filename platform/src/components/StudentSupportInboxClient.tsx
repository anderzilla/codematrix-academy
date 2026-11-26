'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface InboxItem {
  delivery_id: string;
  delivery_status: string;
  delivered_at: string;
  category: string;
  urgency: string;
  title: string;
  body: string;
  action_url: string | null;
  course_title: string | null;
}

interface TicketItem {
  id: string;
  ticket_code: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  course_title: string | null;
  created_at: string;
}

export function StudentSupportInboxClient({
  initialInbox,
  initialUnreadCount,
  initialMarketingOptIn,
  initialTickets,
}: {
  initialInbox: InboxItem[];
  initialUnreadCount: number;
  initialMarketingOptIn: boolean;
  initialTickets: TicketItem[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'inbox' | 'tickets'>('inbox');
  const [marketingOptIn, setMarketingOptIn] = useState(initialMarketingOptIn);
  const [category, setCategory] = useState('academic');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleToggleMarketing() {
    setBusy(true);
    setFeedback(null);
    try {
      const next = !marketingOptIn;
      const res = await fetch('/api/v1/app/inbox', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ marketingOptIn: next }),
      });
      if (res.ok) {
        setMarketingOptIn(next);
        setFeedback(
          next
            ? 'Preferência atualizada: você optou por receber avisos promocionais.'
            : 'Preferência atualizada: avisos promocionais desativados (avisos operacionais continuam ativos).',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleMark(deliveryId: string, status: 'read' | 'archived') {
    setBusy(true);
    try {
      await fetch('/api/v1/app/inbox', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deliveryId, status }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenTicket(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/app/tickets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category, subject, description }),
      });
      const json = (await res.json()) as { ok?: boolean; ticketCode?: string; error?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Não foi possível abrir o chamado.');
        return;
      }
      setSubject('');
      setDescription('');
      setFeedback(`Chamado ${json.ticketCode} aberto com sucesso. Nossa equipe responderá em breve.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="module-stack">
      <div className="card">
        <div className="tab-list" role="tablist" aria-label="Canais do aluno">
          <button
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={tab === 'inbox'}
            onClick={() => setTab('inbox')}
          >
            Caixa de Avisos ({initialUnreadCount} não lidos)
          </button>
          <button
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={tab === 'tickets'}
            onClick={() => setTab('tickets')}
          >
            Chamados de Suporte ({initialTickets.length})
          </button>
        </div>
        <p className="meta-ref" style={{ marginTop: 8 }}>
          <strong>Canais separados:</strong> Avisos são comunicados oficiais da Academy; Chamados de
          Suporte são conversas privadas com nossa equipe (não há chat aberto entre alunos).
        </p>
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

      {tab === 'inbox' ? (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Meus avisos</h2>
            <button
              type="button"
              className="pill-btn pill-btn-secondary"
              disabled={busy}
              onClick={handleToggleMarketing}
            >
              Avisos promocionais: {marketingOptIn ? 'Ativados (opt-in)' : 'Desativados (opt-out)'}
            </button>
          </div>
          {initialInbox.length === 0 ? (
            <p className="meta-ref" style={{ marginTop: 12 }}>
              Nenhum aviso na sua caixa de entrada no momento.
            </p>
          ) : (
            <div className="module-stack" style={{ marginTop: 12 }}>
              {initialInbox.map((m) => (
                <article key={m.delivery_id} className="block-card">
                  <div className="badge-row">
                    <span className={m.delivery_status === 'unread' ? 'badge badge-brand' : 'badge badge-neutral'}>
                      {m.delivery_status === 'unread' ? 'Não lido' : m.delivery_status === 'read' ? 'Lido' : 'Arquivado'}
                    </span>
                    <span className="badge badge-neutral">{m.category}</span>
                    {m.course_title ? <span className="badge badge-neutral">{m.course_title}</span> : null}
                  </div>
                  <h3 style={{ margin: '6px 0 0', fontSize: 17 }}>{m.title}</h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--cm-muted)', fontSize: 14 }}>{m.body}</p>
                  <div className="card-actions" style={{ marginTop: 8 }}>
                    {m.delivery_status === 'unread' ? (
                      <button
                        type="button"
                        className="pill-btn pill-btn-sm"
                        disabled={busy}
                        onClick={() => handleMark(m.delivery_id, 'read')}
                      >
                        Marcar como lido
                      </button>
                    ) : null}
                    {m.delivery_status !== 'archived' ? (
                      <button
                        type="button"
                        className="pill-btn pill-btn-secondary pill-btn-sm"
                        disabled={busy}
                        onClick={() => handleMark(m.delivery_id, 'archived')}
                      >
                        Arquivar
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="module-stack">
          <div className="card card-highlight">
            <h2 style={{ margin: 0, fontSize: 20 }}>Abrir novo chamado de suporte</h2>
            <p className="meta-ref">
              Não envie número de cartão, senha ou dados sensíveis no chamado.
            </p>
            <form onSubmit={handleOpenTicket} className="module-stack" style={{ marginTop: 10 }}>
              <div className="field-group">
                <label htmlFor="tkt-cat" className="field-label">
                  Categoria
                </label>
                <select
                  id="tkt-cat"
                  className="field-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="academic">Dúvida pedagógica / aula</option>
                  <option value="technical">Problema técnico / acesso</option>
                  <option value="billing">Pagamento / matrícula</option>
                  <option value="certificate">Certificado</option>
                  <option value="other">Outro assunto</option>
                </select>
              </div>
              <div className="field-group">
                <label htmlFor="tkt-sub" className="field-label">
                  Assunto
                </label>
                <input
                  id="tkt-sub"
                  className="field-input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>
              <div className="field-group">
                <label htmlFor="tkt-desc" className="field-label">
                  Descrição detalhada
                </label>
                <textarea
                  id="tkt-desc"
                  className="field-input"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="pill-btn" style={{ width: 'fit-content' }} disabled={busy}>
                {busy ? 'Enviando...' : 'Abrir chamado'}
              </button>
            </form>
          </div>

          <div className="card">
            <h2 style={{ margin: 0, fontSize: 20 }}>Meus chamados</h2>
            {initialTickets.length === 0 ? (
              <p className="meta-ref" style={{ marginTop: 10 }}>
                Você ainda não abriu nenhum chamado de suporte.
              </p>
            ) : (
              <div className="module-stack" style={{ marginTop: 12 }}>
                {initialTickets.map((t) => (
                  <article key={t.id} className="block-card">
                    <div className="badge-row">
                      <span className="badge badge-brand">{t.ticket_code}</span>
                      <span className="badge badge-neutral">{t.status}</span>
                      <span className="badge badge-neutral">{t.category}</span>
                    </div>
                    <h3 style={{ margin: '6px 0 0', fontSize: 17 }}>{t.subject}</h3>
                    <p className="meta-ref">
                      Aberto em {new Date(t.created_at).toLocaleString('pt-BR')}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

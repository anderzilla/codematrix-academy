import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getSessionUser } from '@/lib/auth';
import { getFinancialCalendarView, listCalendarEventsForPartner } from '@/lib/calendar';
import { getDb } from '@/lib/db';
import { getPartnerContext } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export default async function PartnerCalendarPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <section className="section">
        <div className="container-narrow">
          <div className="card">
            <h1 className="section-heading" style={{ margin: 0 }}>
              Entre com sua conta de parceiro
            </h1>
            <Link href="/entrar" className="pill-btn" style={{ width: 'fit-content', marginTop: 10 }}>
              Entrar
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const db = getDb();
  const ctx = getPartnerContext(db, user.id);
  if (!ctx) {
    return (
      <section className="section">
        <div className="container-narrow">
          <div className="card">
            <h1 className="section-heading" style={{ margin: 0 }}>
              Acesso restrito a parceiros
            </h1>
          </div>
        </div>
      </section>
    );
  }

  const events = listCalendarEventsForPartner(db, ctx) as Array<Record<string, unknown>>;
  const ownCommissions = getFinancialCalendarView(db, { partnerId: ctx.partnerId })
    .commissionEvents as Array<Record<string, unknown>>;

  return (
    <section className="section">
      <div className="container">
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Painel de Parceiros', href: '/partners' },
            { label: 'Agenda do Parceiro' },
          ]}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="eyebrow">Escopo isolado · Somente cursos atribuídos</p>
            <h1 className="section-heading" style={{ margin: 0 }}>
              Minha agenda e previsões de repasse
            </h1>
          </div>
          <Link href="/partners" className="pill-btn pill-btn-secondary">
            Voltar ao painel
          </Link>
        </div>

        <div className="grid-2" style={{ marginTop: 18 }}>
          <section className="card">
            <h2 style={{ margin: 0, fontSize: 20 }}>Eventos e sessões atribuídas ({events.length})</h2>
            {events.length === 0 ? (
              <p className="meta-ref" style={{ marginTop: 10 }}>
                Nenhum compromisso agendado para seus cursos atribuídos.
              </p>
            ) : (
              <div className="module-stack" style={{ marginTop: 12 }}>
                {events.map((ev) => (
                  <article key={String(ev.id)} className="block-card">
                    <div className="badge-row">
                      <span className="badge badge-brand">{String(ev.event_type)}</span>
                      <span className="badge badge-neutral">{String(ev.status)}</span>
                    </div>
                    <h3 style={{ margin: '4px 0 0', fontSize: 16 }}>{String(ev.title)}</h3>
                    <p className="meta-ref">
                      {new Date(String(ev.starts_at)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2 style={{ margin: 0, fontSize: 20 }}>Previsão das minhas comissões ({ownCommissions.length})</h2>
            <p className="meta-ref">
              Status derivado do livro-razão financeiro (apenas suas próprias atribuições).
            </p>
            {ownCommissions.length === 0 ? (
              <p className="meta-ref" style={{ marginTop: 10 }}>
                Nenhuma comissão registrada até o momento.
              </p>
            ) : (
              <div className="module-stack" style={{ marginTop: 12 }}>
                {ownCommissions.map((c) => (
                  <article key={String(c.id)} className="block-card">
                    <div className="badge-row">
                      <span className="badge badge-available">{String(c.status)}</span>
                      <span className="badge badge-neutral">
                        R$ {(Number(c.commission_cents) / 100).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <p className="meta-ref" style={{ margin: '4px 0 0' }}>
                      Pedido: <code>{String(c.transaction_code)}</code>
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

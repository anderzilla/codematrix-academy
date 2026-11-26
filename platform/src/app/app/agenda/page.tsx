import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getSessionUser } from '@/lib/auth';
import { listCalendarEventsForStudent } from '@/lib/calendar';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const EVENT_TYPE_LABELS: Record<string, string> = {
  class_live: 'Aula ao vivo',
  block_milestone: 'Marco de bloco',
  activity_deadline: 'Prazo de atividade',
  general_event: 'Evento',
  maintenance: 'Manutenção',
  promotion_offer: 'Oferta / Promoção',
  partner_commitment: 'Compromisso',
  financial_receivable: 'Financeiro',
  financial_payout: 'Repasse',
  operational_reminder: 'Lembrete operacional',
};

export default async function StudentCalendarPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <section className="section">
        <div className="container-narrow">
          <div className="card">
            <h1 className="section-heading" style={{ margin: 0 }}>
              Entre para ver sua agenda
            </h1>
            <Link href="/entrar" className="pill-btn" style={{ width: 'fit-content', marginTop: 10 }}>
              Entrar na minha conta
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const events = listCalendarEventsForStudent(getDb(), user.id) as Array<Record<string, unknown>>;

  return (
    <section className="section">
      <div className="container">
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Área do Aluno', href: '/app' },
            { label: 'Minha Agenda' },
          ]}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="eyebrow">Fuso horário padrão: America/Sao_Paulo</p>
            <h1 className="section-heading" style={{ margin: 0 }}>
              Agenda dos meus cursos e turmas
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/app/suporte" className="pill-btn pill-btn-secondary">
              Avisos e Suporte
            </Link>
            <Link href="/app" className="pill-btn pill-btn-secondary">
              Meus cursos
            </Link>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="notice-box" role="status" style={{ marginTop: 18 }}>
            Nenhum evento agendado para seus cursos ou turmas no momento.
          </div>
        ) : (
          <div className="module-stack" style={{ marginTop: 18 }}>
            {events.map((ev) => (
              <article key={String(ev.id)} className="card">
                <div className="badge-row">
                  <span className="badge badge-brand">
                    {EVENT_TYPE_LABELS[String(ev.event_type)] || String(ev.event_type)}
                  </span>
                  <span className={ev.status === 'canceled' ? 'badge badge-planned' : 'badge badge-available'}>
                    {String(ev.status)}
                  </span>
                  {ev.course_title ? <span className="badge badge-neutral">{String(ev.course_title)}</span> : null}
                  {ev.cohort_name ? <span className="badge badge-neutral">Turma: {String(ev.cohort_name)}</span> : null}
                </div>
                <h2 style={{ margin: '6px 0 0', fontSize: 19 }}>{String(ev.title)}</h2>
                {ev.description ? (
                  <p style={{ margin: '4px 0 0', color: 'var(--cm-muted)', fontSize: 14 }}>
                    {String(ev.description)}
                  </p>
                ) : null}
                <p className="meta-ref" style={{ marginTop: 6 }}>
                  Início: {new Date(String(ev.starts_at)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} ·
                  Término: {new Date(String(ev.ends_at)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} ({String(ev.timezone)})
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

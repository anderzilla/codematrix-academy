import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { requireAdminSession } from '@/lib/admin-auth';
import { getFinancialCalendarView, listCalendarEventsForAdmin } from '@/lib/calendar';
import { listAdminTickets } from '@/lib/communications';
import { getDb } from '@/lib/db';
import { listAdminStudents, listCohorts } from '@/lib/school-ops';

export const dynamic = 'force-dynamic';

export default async function AdminSchoolOpsPage() {
  const auth = await requireAdminSession({ requireMfa: true });
  if (!auth.ok) {
    return (
      <section className="section">
        <div className="container-narrow">
          <div className="card">
            <h1 className="section-heading" style={{ margin: 0 }}>
              {auth.code === 'mfa_required' ? 'MFA obrigatório' : 'Acesso restrito'}
            </h1>
            <p style={{ margin: 0, color: 'var(--cm-muted)' }}>{auth.error}</p>
            <Link href="/admin" className="pill-btn" style={{ width: 'fit-content', marginTop: 10 }}>
              Voltar ao Admin
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const db = getDb();
  const students = listAdminStudents(db) as Array<Record<string, unknown>>;
  const cohorts = listCohorts(db) as Array<Record<string, unknown>>;
  const tickets = listAdminTickets(db) as Array<Record<string, unknown>>;
  const events = listCalendarEventsForAdmin(db) as Array<Record<string, unknown>>;
  const finCal = getFinancialCalendarView(db);

  return (
    <section className="section">
      <div className="container">
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Administração', href: '/admin' },
            { label: 'Operação Escolar, Suporte e Calendário' },
          ]}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="eyebrow">Operação Escolar Integrada · America/Sao_Paulo</p>
            <h1 className="section-heading" style={{ margin: 0 }}>
              Alunos, Turmas, Tickets e Calendário Compartilhado
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/admin/courses" className="pill-btn pill-btn-secondary">
              Gestão Multi-Curso
            </Link>
            <Link href="/admin" className="pill-btn pill-btn-secondary">
              Painel Financeiro
            </Link>
          </div>
        </div>

        <div className="hero-metrics" style={{ marginTop: 18 }}>
          <div className="metric-card">
            <span className="metric-value">{students.length}</span>
            <span className="metric-label">Alunos cadastrados</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{cohorts.length}</span>
            <span className="metric-label">Turmas / Coortes</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{tickets.length}</span>
            <span className="metric-label">Tickets de suporte</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{events.length}</span>
            <span className="metric-label">Eventos no calendário</span>
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: 18 }}>
          <section className="card">
            <h2 style={{ margin: 0, fontSize: 19 }}>Turmas ativas e planejadas ({cohorts.length})</h2>
            {cohorts.length === 0 ? (
              <p className="meta-ref" style={{ marginTop: 8 }}>
                Nenhuma turma criada ainda. Use `POST /api/v1/admin/cohorts`.
              </p>
            ) : (
              <ul className="checklist" style={{ marginTop: 10 }}>
                {cohorts.map((c) => (
                  <li key={String(c.id)}>
                    <strong>{String(c.code)}</strong> — {String(c.name)} ({String(c.course_title)}) ·{' '}
                    {Number(c.active_students_count)} aluno(s) · {Number(c.sessions_count)} sessão(ões)
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 style={{ margin: 0, fontSize: 19 }}>Agenda Financeira (derivada do Ledger)</h2>
            <p className="meta-ref">
              Somente leitura a partir do livro-razão (`financial_ledger`) e lotes maker-checker.
            </p>
            <p style={{ marginTop: 8, fontSize: 14 }}>
              Lançamentos no ledger: <strong>{finCal.ledgerItems.length}</strong> · Comissões:{' '}
              <strong>{finCal.commissionEvents.length}</strong> · Lotes de repasse:{' '}
              <strong>{finCal.payoutBatches.length}</strong>
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}

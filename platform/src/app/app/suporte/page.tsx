import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { StudentSupportInboxClient } from '@/components/StudentSupportInboxClient';
import { getSessionUser } from '@/lib/auth';
import { listStudentInbox, listStudentTickets } from '@/lib/communications';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function StudentSupportPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <section className="section">
        <div className="container-narrow">
          <div className="card">
            <h1 className="section-heading" style={{ margin: 0 }}>
              Entre para acessar seus avisos e chamados
            </h1>
            <Link href="/entrar" className="pill-btn" style={{ width: 'fit-content', marginTop: 10 }}>
              Entrar na minha conta
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const db = getDb();
  const inbox = listStudentInbox(db, user.id);
  const tickets = listStudentTickets(db, user.id);

  return (
    <section className="section">
      <div className="container">
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Área do Aluno', href: '/app' },
            { label: 'Avisos e Suporte' },
          ]}
        />
        <StudentSupportInboxClient
          initialInbox={inbox.messages as unknown as Parameters<typeof StudentSupportInboxClient>[0]['initialInbox']}
          initialUnreadCount={inbox.unreadCount}
          initialMarketingOptIn={inbox.preferences.marketingOptIn}
          initialTickets={tickets as unknown as Parameters<typeof StudentSupportInboxClient>[0]['initialTickets']}
        />
      </div>
    </section>
  );
}

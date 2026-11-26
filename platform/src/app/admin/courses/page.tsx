import Link from 'next/link';
import { AdminCoursesManagerClient } from '@/components/AdminCoursesManagerClient';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { listAdminCourses } from '@/lib/admin-courses';
import { requireAdminSession } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminCoursesPage() {
  const auth = await requireAdminSession({ requireMfa: true });

  if (!auth.ok) {
    return (
      <section className="section">
        <div className="container-narrow">
          <Breadcrumbs
            items={[
              { label: 'Início', href: '/' },
              { label: 'Administração', href: '/admin' },
              { label: 'Cursos' },
            ]}
          />
          <div className="card">
            <h1 className="section-heading" style={{ margin: 0 }}>
              {auth.code === 'mfa_required'
                ? 'Confirmação MFA obrigatória'
                : 'Acesso restrito à administração'}
            </h1>
            <p style={{ margin: 0, color: 'var(--cm-muted)' }}>{auth.error}</p>
            <div className="hero-actions" style={{ marginTop: 10 }}>
              <Link href="/admin" className="pill-btn">
                Ir para o Painel Admin
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const courses = listAdminCourses(getDb()) as unknown as Parameters<
    typeof AdminCoursesManagerClient
  >[0]['initialCourses'];

  return (
    <section className="section">
      <div className="container">
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Administração', href: '/admin' },
            { label: 'Gestão Multi-Curso' },
          ]}
        />
        <AdminCoursesManagerClient
          initialCourses={courses}
          isFullAdmin={auth.isFullAdmin}
        />
      </div>
    </section>
  );
}

import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { StudentLibraryClient } from '@/components/StudentLibraryClient';
import { getSessionUser } from '@/lib/auth';
import { listStudentCertificates } from '@/lib/certificates';
import { getDb } from '@/lib/db';
import { listAuthorizedLivesForUser } from '@/lib/lives';
import { getStudentLibrary } from '@/lib/student';

export const dynamic = 'force-dynamic';

export default async function StudentAppPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <section className="section">
        <div className="container-narrow">
          <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Área do Aluno' }]} />
          <div className="card card-highlight">
            <div className="badge-row">
              <span className="badge badge-brand">Área do Aluno</span>
            </div>
            <h1 className="section-heading" style={{ margin: 0 }}>
              Entre na sua conta para estudar
            </h1>
            <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 16 }}>
              Acesse suas aulas, salve seu progresso no servidor, responda aos quizzes de fixação
              e ative gratuitamente a amostra do Bloco 1.
            </p>
            <div className="hero-actions" style={{ marginTop: 8 }}>
              <Link href="/entrar" className="pill-btn">
                Entrar ou criar conta
              </Link>
              <Link href="/cursos" className="pill-btn pill-btn-secondary">
                Ver catálogo público
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const db = getDb();
  const courses = getStudentLibrary(db, user.id);
  const lives = listAuthorizedLivesForUser(db, user.id);
  const certificates = listStudentCertificates(db, user.id);

  return (
    <section className="section">
      <div className="container">
        <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Área do Aluno' }]} />
        <StudentLibraryClient
          user={{ id: user.id, name: user.name, email: user.email }}
          initialCourses={courses}
          initialLives={lives}
          initialCertificates={certificates}
        />
      </div>
    </section>
  );
}

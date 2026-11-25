import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LessonPlayerClient } from '@/components/LessonPlayerClient';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getProtectedLessonContent } from '@/lib/student';

export const dynamic = 'force-dynamic';

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonCode: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/entrar');
  }

  const { slug, lessonCode } = await params;
  const db = getDb();
  const res = getProtectedLessonContent(db, user.id, slug, lessonCode);

  if (!res.ok) {
    return (
      <section className="section">
        <div className="container-narrow">
          <Breadcrumbs
            items={[
              { label: 'Área do Aluno', href: '/app' },
              { label: 'Acesso bloqueado' },
            ]}
          />
          <div className="card">
            <span className="badge badge-planned" style={{ width: 'fit-content' }}>
              Acesso indisponível
            </span>
            <h1 className="section-heading" style={{ margin: 0 }}>
              Não foi possível abrir esta aula
            </h1>
            <p style={{ margin: 0, color: 'var(--cm-muted)' }}>{res.error}</p>
            <div>
              <Link href={`/app/cursos/${slug}`} className="pill-btn">
                Voltar à sala do curso
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
        <Breadcrumbs
          items={[
            { label: 'Área do Aluno', href: '/app' },
            { label: res.courseTitle, href: `/app/cursos/${res.courseSlug}` },
            { label: `Aula ${String(res.lesson.position).padStart(2, '0')}` },
          ]}
        />
        <LessonPlayerClient
          courseSlug={res.courseSlug}
          courseTitle={res.courseTitle}
          blockCode={res.blockCode}
          blockTitle={res.blockTitle}
          lesson={res.lesson}
          nextLessonCode={res.nextLessonCode}
          isLastLessonInBlock={res.isLastLessonInBlock}
        />
      </div>
    </section>
  );
}

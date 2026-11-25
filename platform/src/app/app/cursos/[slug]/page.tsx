import { notFound, redirect } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { StudentCourseRoomClient } from '@/components/StudentCourseRoomClient';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getStudentCourseRoom } from '@/lib/student';

export const dynamic = 'force-dynamic';

export default async function StudentCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/entrar');
  }

  const { slug } = await params;
  const db = getDb();
  const room = getStudentCourseRoom(db, user.id, slug);
  if (!room) {
    notFound();
  }

  return (
    <section className="section">
      <div className="container">
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Área do Aluno', href: '/app' },
            { label: room.title },
          ]}
        />
        <StudentCourseRoomClient room={room} />
      </div>
    </section>
  );
}

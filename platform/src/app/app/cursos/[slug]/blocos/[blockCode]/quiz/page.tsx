import { redirect } from 'next/navigation';
import { BlockQuizClient } from '@/components/BlockQuizClient';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function StudentBlockQuizPage({
  params,
}: {
  params: Promise<{ slug: string; blockCode: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/entrar');
  }

  const { slug, blockCode } = await params;

  return (
    <section className="section">
      <div className="container-narrow">
        <Breadcrumbs
          items={[
            { label: 'Área do Aluno', href: '/app' },
            { label: 'Sala do curso', href: `/app/cursos/${slug}` },
            { label: `Quiz ${blockCode}` },
          ]}
        />
        <BlockQuizClient courseSlug={slug} blockCode={blockCode} />
      </div>
    </section>
  );
}

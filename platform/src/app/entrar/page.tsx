import { Suspense } from 'react';
import { AuthPortalClient } from '@/components/AuthPortalClient';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <section className="section">
      <div className="container-narrow">
        <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Área do Aluno' }]} />

        <p className="eyebrow">CodeMatrix Academy · Acesso seguro</p>
        <h1 className="section-heading">Entre ou crie sua conta de aluno</h1>
        <p className="section-lead">
          Use seu e-mail verificado para acompanhar suas aulas, salvar seu progresso, fazer os
          quizzes de fixação e emitir certificados.
        </p>

        <Suspense fallback={<div className="info-box">Carregando formulário de acesso...</div>}>
          <AuthPortalClient />
        </Suspense>
      </div>
    </section>
  );
}

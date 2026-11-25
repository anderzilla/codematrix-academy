import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import type { SurfaceContract } from '@/lib/contracts';

const SURFACE_COPY: Record<
  Exclude<SurfaceContract['id'], 'vitrine'>,
  {
    badge: string;
    heading: string;
    lead: string;
    features: string[];
    nextStep: string;
  }
> = {
  app: {
    badge: 'Área do Aluno · Em preparação',
    heading: 'Sua sala de aula está sendo finalizada',
    lead: 'Em breve você poderá criar sua conta, validar seu e-mail e estudar as aulas da CodeMatrix Academy diretamente por aqui.',
    features: [
      'Acesso à amostra gratuita do Bloco 1 e aos módulos liberados na sua matrícula.',
      'Progresso salvo automaticamente no servidor, quizzes de 10 questões e revisão orientada.',
      'Vídeos protegidos, agenda de aulas ao vivo e certificados verificáveis por QR Code.',
    ],
    nextStep:
      'Enquanto liberamos o cadastro e login, você já pode conferir toda a grade de aulas do Módulo 1 no catálogo público.',
  },
  partners: {
    badge: 'Parceiros · Acesso restrito',
    heading: 'Painel de Professores, Afiliados e Parceiros',
    lead: 'Espaço exclusivo para instrutores, afiliados e parceiros comerciais autorizados pela CodeMatrix Academy.',
    features: [
      'Links e cupons de divulgação vinculados a campanhas e ofertas aprovadas.',
      'Agenda de aulas ao vivo atribuídas a professores e checklists de preparação.',
      'Demonstrativos próprios de vendas e comissões, preservando a privacidade dos alunos.',
    ],
    nextStep:
      'O acesso a este painel exige convite aprovado e login autenticado. Se você é parceiro ou professor, entre em contato pelo suporte.',
  },
  admin: {
    badge: 'Administração · Acesso restrito à equipe',
    heading: 'Painel Administrativo CodeMatrix Academy',
    lead: 'Área interna reservada à equipe de operação e administração da CodeMatrix, protegida por autenticação forte (MFA).',
    features: [
      'Gestão do catálogo multi-curso, publicação de módulos, ofertas e cupons.',
      'Atendimento a alunos, conciliação de pedidos Hotmart e trilha de auditoria.',
      'Relatórios operacionais e fechamento de repasses com aprovação humana.',
    ],
    nextStep:
      'Nenhum dado administrativo ou financeiro é exibido publicamente nesta rota.',
  },
};

export function RestrictedSurfaceGate({ surface }: { surface: SurfaceContract }) {
  const copy =
    surface.id === 'vitrine' ? SURFACE_COPY.app : SURFACE_COPY[surface.id];

  return (
    <section className="section">
      <div className="container-narrow">
        <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: surface.name }]} />

        <div className="card">
          <div className="badge-row">
            <span className="badge badge-planned">{copy.badge}</span>
            {surface.requiresMfa ? (
              <span className="badge badge-brand">Verificação em duas etapas (MFA)</span>
            ) : null}
          </div>

          <h1 className="section-heading" style={{ margin: 0 }}>
            {copy.heading}
          </h1>
          <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 16 }}>
            {copy.lead}
          </p>

          <div>
            <h2 style={{ margin: '8px 0 12px', fontSize: 17 }}>
              O que estará disponível nesta área
            </h2>
            <ul className="check-list">
              {copy.features.map((item) => (
                <li key={item}>
                  <span className="check-icon" aria-hidden="true">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="info-box">{copy.nextStep}</div>

          <div className="hero-actions" style={{ marginTop: 8 }}>
            <Link href="/cursos" className="pill-btn">
              Explorar catálogo de cursos
            </Link>
            <Link href="/suporte" className="pill-btn pill-btn-secondary">
              Falar com o suporte
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

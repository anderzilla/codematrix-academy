'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PublicCertificateRecord } from '@/lib/certificates';
import type { StudentLiveItem } from '@/lib/lives';
import type { StudentLibraryCourse } from '@/lib/student';

interface Props {
  user: { id: string; name: string; email: string };
  initialCourses: StudentLibraryCourse[];
  initialLives: StudentLiveItem[];
  initialCertificates: PublicCertificateRecord[];
}

export function StudentLibraryClient({
  user,
  initialCourses,
  initialLives,
  initialCertificates,
}: Props) {
  const router = useRouter();
  const [enrolling, setEnrolling] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasFormacao = initialCourses.some((c) => c.slug === 'formacao-ia-anderzilla');

  async function handleEnrollFree() {
    setEnrolling(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/app/enroll-free', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offerCode: 'formacao-ia-amostra-bloco-1' }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'Não foi possível ativar a amostra gratuita.');
        return;
      }
      setFeedback(data.message || 'Amostra gratuita do Bloco 1 liberada na sua biblioteca.');
      router.refresh();
    } catch {
      setErrorMsg('Erro de rede ao ativar a amostra gratuita.');
    } finally {
      setEnrolling(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.push('/entrar');
    router.refresh();
  }

  return (
    <div className="module-stack">
      <div className="card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>
            Área do Aluno · Sessão autenticada
          </p>
          <h1 className="section-heading" style={{ margin: 0 }}>
            Olá, {user.name}
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--cm-muted)', fontSize: 14 }}>
            Conectado como <strong>{user.email}</strong>
          </p>
        </div>
        <button type="button" onClick={handleLogout} className="pill-btn pill-btn-secondary">
          Sair da conta
        </button>
      </div>

      {feedback ? (
        <div className="alert-success" role="status">
          {feedback}
        </div>
      ) : null}
      {errorMsg ? (
        <div className="alert-error" role="alert">
          {errorMsg}
        </div>
      ) : null}

      <section className="card card-highlight">
        <div className="badge-row">
          <span className="badge badge-brand">Meus cursos</span>
        </div>
        <h2 style={{ margin: 0, fontSize: 24 }}>Sua biblioteca de estudos</h2>

        {initialCourses.length === 0 ? (
          <div className="info-box">
            <strong>Você ainda não possui cursos liberados nesta conta.</strong> Ative abaixo a
            amostra gratuita do Bloco 1 da Formação IA (Aulas 1 a 3 + quiz de 10 questões) ou
            confirme que usou o mesmo e-mail da sua compra.
            <div className="hero-actions" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="pill-btn"
                onClick={handleEnrollFree}
                disabled={enrolling}
              >
                {enrolling ? 'Ativando...' : 'Ativar amostra gratuita — Bloco 1'}
              </button>
              <Link href="/cursos" className="pill-btn pill-btn-secondary">
                Ver catálogo de cursos
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid-2">
              {initialCourses.map((course) => (
                <article key={course.courseId} className="block-card">
                  <div className="badge-row">
                    <span className="badge badge-available">Acesso ativo</span>
                    <span className="badge badge-neutral">
                      {course.completedLessonsCount}/{course.availableLessonsCount} aulas
                    </span>
                  </div>
                  <h3 style={{ margin: '6px 0 0', fontSize: 20 }}>{course.title}</h3>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--cm-muted)' }}>
                    {course.subtitle}
                  </p>
                  <div>
                    <div className="progress-track" aria-label={`Progresso: ${course.progressPercent}%`}>
                      <div
                        className="progress-fill"
                        style={{ width: `${course.progressPercent}%` }}
                      />
                    </div>
                    <p className="meta-ref">{course.progressPercent}% das aulas disponíveis concluídas</p>
                  </div>
                  <div className="card-actions">
                    <Link href={`/app/cursos/${course.slug}`} className="pill-btn">
                      Continuar estudos
                    </Link>
                    {course.certificateCode ? (
                      <Link
                        href={`/certificados/${course.certificateCode}`}
                        className="pill-btn pill-btn-secondary"
                      >
                        Ver certificado
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {!hasFormacao ? (
              <div>
                <button
                  type="button"
                  className="pill-btn pill-btn-secondary"
                  onClick={handleEnrollFree}
                  disabled={enrolling}
                >
                  {enrolling ? 'Ativando...' : 'Ativar amostra gratuita — Formação IA (Bloco 1)'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="card">
        <div className="badge-row">
          <span className="badge badge-neutral">Agenda ao vivo e replays</span>
        </div>
        <h2 style={{ margin: 0, fontSize: 22 }}>Aulas ao vivo autorizadas</h2>
        {initialLives.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 14 }}>
            Nenhuma transmissão ao vivo agendada para os seus cursos ativos no momento.
          </p>
        ) : (
          <div className="grid-2">
            {initialLives.map((live) => (
              <article key={live.id} className="block-card">
                <div className="badge-row">
                  <span className="badge badge-brand">
                    {live.status === 'scheduled'
                      ? 'Agendada'
                      : live.status === 'live'
                        ? 'Ao vivo agora'
                        : live.status === 'replay_available'
                          ? 'Replay disponível'
                          : 'Encerrada'}
                  </span>
                  <span className="badge badge-neutral">{live.durationMinutes} min</span>
                </div>
                <h3 style={{ margin: '4px 0 0', fontSize: 17 }}>{live.title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--cm-muted)' }}>
                  {live.description}
                </p>
                <p className="meta-ref">
                  Data prevista: {new Date(live.scheduledAt).toLocaleString('pt-BR')} · Retenção do
                  replay: {live.retentionDays} dias.
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="badge-row">
          <span className="badge badge-neutral">Certificados verificáveis</span>
        </div>
        <h2 style={{ margin: 0, fontSize: 22 }}>Meus certificados</h2>
        {initialCertificates.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 14 }}>
            Conclua todas as aulas e alcance pelo menos 70% nos quizzes de todos os blocos para
            emitir seu certificado com QR Code de verificação pública.
          </p>
        ) : (
          <div className="grid-2">
            {initialCertificates.map((cert) => (
              <article key={cert.verificationCode} className="block-card">
                <div className="badge-row">
                  <span className="badge badge-available">
                    {cert.status === 'valid' ? 'Válido' : 'Revogado'}
                  </span>
                  <span className="badge badge-neutral">{cert.workloadHours}h</span>
                </div>
                <h3 style={{ margin: '4px 0 0', fontSize: 18 }}>{cert.courseTitle}</h3>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--cm-muted)' }}>
                  {cert.scopeLabel}
                </p>
                <div className="card-actions">
                  <Link
                    href={`/certificados/${cert.verificationCode}`}
                    className="pill-btn pill-btn-sm"
                  >
                    Abrir certificado público
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

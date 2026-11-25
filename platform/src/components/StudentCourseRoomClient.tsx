'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { StudentCourseRoom } from '@/lib/student';

export function StudentCourseRoomClient({ room }: { room: StudentCourseRoom }) {
  const router = useRouter();
  const [issuing, setIssuing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleIssueCertificate() {
    setIssuing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/app/courses/${room.slug}/certificate`, {
        method: 'POST',
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        certificate?: { verificationCode: string };
      };
      if (!res.ok || !data.ok || !data.certificate) {
        setErrorMsg(data.error || 'Não foi possível emitir o certificado.');
        return;
      }
      router.push(`/certificados/${data.certificate.verificationCode}`);
    } catch {
      setErrorMsg('Erro de rede ao emitir o certificado.');
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="module-stack">
      <div className="card card-highlight">
        <div className="badge-row">
          <span className="badge badge-available">Sala do curso</span>
          <span className="badge badge-neutral">
            {room.completedLessonsCount} de {room.totalAvailableLessonsCount} aulas concluídas
          </span>
        </div>
        <h1 className="section-heading" style={{ margin: 0 }}>
          {room.title}
        </h1>
        <p style={{ margin: 0, color: 'var(--cm-muted)' }}>{room.subtitle}</p>
        <div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${room.progressPercent}%` }} />
          </div>
          <p className="meta-ref">{room.progressPercent}% concluído no Módulo 1</p>
        </div>

        {errorMsg ? (
          <div className="alert-error" role="alert">
            {errorMsg}
          </div>
        ) : null}

        <div className="hero-actions" style={{ marginTop: 4 }}>
          {room.certificateCode ? (
            <Link href={`/certificados/${room.certificateCode}`} className="pill-btn">
              Abrir meu certificado verificável
            </Link>
          ) : room.eligibleForCertificate ? (
            <button
              type="button"
              className="pill-btn"
              onClick={handleIssueCertificate}
              disabled={issuing}
            >
              {issuing ? 'Emitindo certificado...' : 'Emitir certificado do Módulo 1'}
            </button>
          ) : null}
          <Link href="/app" className="pill-btn pill-btn-secondary">
            Voltar à minha biblioteca
          </Link>
        </div>
      </div>

      {room.modules.map((mod) => (
        <section key={mod.id} className="card">
          <div className="badge-row">
            <span
              className={`badge ${
                mod.status === 'published' ? 'badge-available' : 'badge-planned'
              }`}
            >
              {mod.status === 'published' ? 'Disponível agora' : 'Em planejamento'}
            </span>
            <span className="badge badge-neutral">Módulo {mod.position}</span>
          </div>
          <h2 className="course-card-title">{mod.title}</h2>
          <p style={{ margin: 0, color: 'var(--cm-muted)' }}>{mod.promise}</p>

          {mod.status === 'published' ? (
            <div className="block-list">
              {mod.blocks.map((block) => (
                <article key={block.id} className="block-card">
                  <div className="badge-row">
                    <span className="badge badge-brand">Bloco {block.position}</span>
                    {block.passedQuiz ? (
                      <span className="badge badge-available">
                        Aprovado ({block.bestScorePercent}%)
                      </span>
                    ) : block.unlocked ? (
                      <span className="badge badge-available">Liberado</span>
                    ) : (
                      <span className="badge badge-planned">Bloqueado</span>
                    )}
                  </div>
                  <h4>{block.title}</h4>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--cm-muted)' }}>
                    {block.focus}
                  </p>

                  {!block.unlocked ? (
                    <div className="notice-box" role="note">
                      {block.lockReason === 'no_entitlement'
                        ? 'Este bloco faz parte do Módulo 1 pago. Assim que sua compra for confirmada, ele será liberado automaticamente.'
                        : 'Conclua o quiz do bloco anterior com pelo menos 70% de acerto para desbloquear estas aulas.'}
                    </div>
                  ) : null}

                  <ol className="lesson-list">
                    {block.lessons.map((lesson) => (
                      <li key={lesson.id} className="lesson-item">
                        <div className="lesson-item-head">
                          {lesson.unlocked ? (
                            <Link
                              href={`/app/cursos/${room.slug}/aulas/${lesson.code}`}
                              className="inline-link"
                            >
                              Aula {String(lesson.position).padStart(2, '0')} · {lesson.title}
                            </Link>
                          ) : (
                            <strong>
                              Aula {String(lesson.position).padStart(2, '0')} · {lesson.title}
                            </strong>
                          )}
                          <span style={{ fontSize: 12, color: lesson.completed ? 'var(--cm-success-ink)' : 'var(--cm-muted)', fontWeight: 700 }}>
                            {lesson.completed ? 'Concluída ✓' : `${lesson.slidesCount} telas`}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <div className="card-actions">
                    {block.quizReady ? (
                      <Link
                        href={`/app/cursos/${room.slug}/blocos/${block.code}/quiz`}
                        className="pill-btn pill-btn-sm"
                      >
                        {block.passedQuiz ? 'Refazer quiz do bloco' : 'Fazer quiz do bloco (10 questões)'}
                      </Link>
                    ) : block.unlocked ? (
                      <span className="meta-ref">
                        Conclua as 3 aulas ({block.completedLessonsCount}/{block.totalLessonsCount}) para
                        liberar o quiz.
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="notice-box" role="note">
              Módulo em produção — ainda não liberado para estudo.
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { SlideContent } from '@/lib/student';

interface Props {
  courseSlug: string;
  courseTitle: string;
  blockCode: string;
  blockTitle: string;
  lesson: {
    code: string;
    position: number;
    title: string;
    goal: string;
    slides: SlideContent[];
    completed: boolean;
  };
  nextLessonCode: string | null;
  isLastLessonInBlock: boolean;
}

type VideoState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; iframeUrl: string; expiresAt: string }
  | { kind: 'unavailable'; message: string }
  | { kind: 'forbidden'; message: string }
  | { kind: 'expired'; message: string }
  | { kind: 'offline'; message: string }
  | { kind: 'error'; message: string };

export function LessonPlayerClient({
  courseSlug,
  blockCode,
  blockTitle,
  lesson,
  nextLessonCode,
  isLastLessonInBlock,
}: Props) {
  const router = useRouter();
  const [slideIdx, setSlideIdx] = useState(0);
  const [completed, setCompleted] = useState(lesson.completed);
  const [completing, setCompleting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [videoState, setVideoState] = useState<VideoState>({ kind: 'idle' });

  const slides = lesson.slides;
  const currentSlide = slides[slideIdx];

  const loadVideoToken = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setVideoState({
        kind: 'offline',
        message: 'Você parece estar offline. Reconecte-se à internet para carregar o vídeo protegido.',
      });
      return;
    }

    setVideoState({ kind: 'loading' });
    try {
      const res = await fetch('/api/v1/app/stream/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          courseSlug,
          lessonCode: lesson.code,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        code?: string;
        error?: string;
        iframeUrl?: string;
        expiresAt?: string;
      };

      if (res.status === 401 || res.status === 403) {
        setVideoState({
          kind: 'forbidden',
          message: data.error || 'Você não tem permissão para reproduzir este vídeo.',
        });
        return;
      }
      if (res.status === 404 || res.status === 503) {
        setVideoState({
          kind: 'unavailable',
          message:
            data.error ||
            'O vídeo gravado desta aula ainda não está publicado. Você pode estudar normalmente pelas telas interativas abaixo.',
        });
        return;
      }
      if (!res.ok || !data.ok || !data.iframeUrl || !data.expiresAt) {
        setVideoState({
          kind: 'error',
          message: data.error || 'Não foi possível carregar o vídeo no momento.',
        });
        return;
      }

      setVideoState({
        kind: 'ready',
        iframeUrl: data.iframeUrl,
        expiresAt: data.expiresAt,
      });
    } catch {
      setVideoState({
        kind: 'error',
        message: 'Erro de rede ao solicitar o token do vídeo. Tente novamente.',
      });
    }
  }, [courseSlug, lesson.code]);

  useEffect(() => {
    if (videoState.kind !== 'ready') return;
    const msLeft = Math.max(0, new Date(videoState.expiresAt).getTime() - Date.now());
    const timer = setTimeout(() => {
      setVideoState({
        kind: 'expired',
        message: 'O link seguro deste vídeo expirou. Clique abaixo para renovar seu acesso.',
      });
    }, msLeft);
    return () => clearTimeout(timer);
  }, [videoState]);

  async function handleCompleteLesson() {
    setCompleting(true);
    setStatusMsg(null);
    try {
      const res = await fetch(
        `/api/v1/app/courses/${courseSlug}/lessons/${lesson.code}/complete`,
        { method: 'POST' },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatusMsg(data.error || 'Não foi possível salvar a conclusão.');
        return;
      }
      setCompleted(true);
      setStatusMsg('Aula marcada como concluída!');
      router.refresh();
    } catch {
      setStatusMsg('Erro de conexão ao salvar o progresso.');
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="module-stack">
      <div className="card">
        <div className="badge-row">
          <span className="badge badge-brand">{blockTitle}</span>
          <span className="badge badge-neutral">
            Aula {String(lesson.position).padStart(2, '0')}
          </span>
          {completed ? <span className="badge badge-available">Concluída ✓</span> : null}
        </div>
        <h1 className="section-heading" style={{ margin: 0 }}>
          {lesson.title}
        </h1>
        <p style={{ margin: 0, color: 'var(--cm-muted)' }}>{lesson.goal}</p>
      </div>

      {/* Vídeo protegido Cloudflare Stream com estados acessíveis */}
      <section className="video-shell" aria-label="Vídeo protegido da aula">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <strong>Vídeo da aula (reprodução protegida)</strong>
          {videoState.kind === 'idle' || videoState.kind === 'expired' || videoState.kind === 'error' || videoState.kind === 'offline' ? (
            <button type="button" className="pill-btn pill-btn-sm" onClick={loadVideoToken}>
              {videoState.kind === 'expired' ? 'Renovar link do vídeo' : 'Carregar vídeo'}
            </button>
          ) : null}
        </div>

        {videoState.kind === 'idle' ? (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--cm-muted)' }}>
            Clique em &ldquo;Carregar vídeo&rdquo; para solicitar um token de reprodução assinado
            no servidor.
          </p>
        ) : null}

        {videoState.kind === 'loading' ? (
          <div className="info-box" role="status">
            Validando permissão e preparando a reprodução segura...
          </div>
        ) : null}

        {videoState.kind === 'ready' ? (
          <iframe
            src={videoState.iframeUrl}
            title={`Vídeo da aula ${lesson.title}`}
            className="video-iframe"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : null}

        {videoState.kind === 'unavailable' ? (
          <div className="info-box" role="status">
            {videoState.message}
          </div>
        ) : null}

        {videoState.kind === 'forbidden' ||
        videoState.kind === 'expired' ||
        videoState.kind === 'offline' ||
        videoState.kind === 'error' ? (
          <div className="notice-box" role="alert">
            {videoState.message}
          </div>
        ) : null}
      </section>

      {/* Apresentação interativa em telas */}
      {currentSlide ? (
        <section className="slide-deck" aria-label="Conteúdo da aula em telas">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span className="badge badge-brand">
              Tela {slideIdx + 1} de {slides.length}
            </span>
            <span className="meta-ref" style={{ margin: 0 }}>
              Use os botões abaixo para avançar pelas telas
            </span>
          </div>

          <h2 style={{ margin: 0, fontSize: 26 }}>{currentSlide.title}</h2>
          <p style={{ margin: 0, fontSize: 16 }}>{currentSlide.body}</p>

          {currentSlide.visual ? (
            <div className="slide-visual" aria-label="Referência visual">
              {currentSlide.visual}
            </div>
          ) : null}

          {currentSlide.example ? (
            <div className="slide-box">
              <strong>Exemplo prático:</strong> {currentSlide.example}
            </div>
          ) : null}

          {currentSlide.pause ? (
            <div className="info-box">
              <strong>Pausa de fixação:</strong> {currentSlide.pause}
            </div>
          ) : null}

          <div className="slide-controls">
            <button
              type="button"
              className="pill-btn pill-btn-secondary"
              disabled={slideIdx === 0}
              onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
            >
              ← Tela anterior
            </button>

            {slideIdx < slides.length - 1 ? (
              <button
                type="button"
                className="pill-btn"
                onClick={() => setSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
              >
                Próxima tela →
              </button>
            ) : (
              <button
                type="button"
                className="pill-btn"
                disabled={completing}
                onClick={handleCompleteLesson}
              >
                {completing
                  ? 'Salvando...'
                  : completed
                    ? 'Aula concluída ✓'
                    : 'Marcar aula como concluída ✓'}
              </button>
            )}
          </div>
        </section>
      ) : null}

      {statusMsg ? (
        <div className="alert-success" role="status">
          {statusMsg}
        </div>
      ) : null}

      <div className="hero-actions" style={{ marginTop: 4 }}>
        <Link href={`/app/cursos/${courseSlug}`} className="pill-btn pill-btn-secondary">
          ← Voltar para a sala do curso
        </Link>
        {completed && nextLessonCode ? (
          <Link
            href={`/app/cursos/${courseSlug}/aulas/${nextLessonCode}`}
            className="pill-btn"
          >
            Ir para a próxima aula →
          </Link>
        ) : null}
        {completed && isLastLessonInBlock ? (
          <Link
            href={`/app/cursos/${courseSlug}/blocos/${blockCode}/quiz`}
            className="pill-btn"
          >
            Fazer quiz do bloco →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

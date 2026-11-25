'use client';

import Link from 'next/link';
import { useState } from 'react';

interface QuizQuestionClient {
  index: number;
  questionId: string;
  question: string;
  options: string[];
}

interface QuizResultClient {
  scorePercent: number;
  correctCount: number;
  totalCount: number;
  minPassPercent: number;
  passed: boolean;
  reviewItems: Array<{
    question: string;
    skill: string;
    lessonPosition: number;
    selectedText: string;
    expectedText: string;
    explanation: string;
  }>;
}

export function BlockQuizClient({
  courseSlug,
  blockCode,
}: {
  courseSlug: string;
  blockCode: string;
}) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [blockTitle, setBlockTitle] = useState('');
  const [minPass, setMinPass] = useState(70);
  const [questions, setQuestions] = useState<QuizQuestionClient[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResultClient | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleStart() {
    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    setAnswers({});
    try {
      const res = await fetch(
        `/api/v1/app/courses/${courseSlug}/blocks/${blockCode}/quiz/start`,
        { method: 'POST' },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        attemptId?: string;
        blockTitle?: string;
        minPassPercent?: number;
        questions?: QuizQuestionClient[];
      };
      if (!res.ok || !data.ok || !data.attemptId || !data.questions) {
        setErrorMsg(data.error || 'Não foi possível iniciar o quiz.');
        return;
      }
      setAttemptId(data.attemptId);
      setBlockTitle(data.blockTitle || blockCode);
      setMinPass(data.minPassPercent || 70);
      setQuestions(data.questions);
    } catch {
      setErrorMsg('Erro de rede ao iniciar o quiz.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!attemptId) return;
    if (Object.keys(answers).length < questions.length) {
      setErrorMsg(`Responda todas as ${questions.length} questões antes de enviar.`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const ordered = questions.map((q) => answers[q.index]);
      const res = await fetch(
        `/api/v1/app/courses/${courseSlug}/blocks/${blockCode}/quiz/submit`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ attemptId, answers: ordered }),
        },
      );
      const data = (await res.json()) as QuizResultClient & { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'Não foi possível corrigir suas respostas.');
        return;
      }
      setResult(data);
      setAttemptId(null);
      setQuestions([]);
    } catch {
      setErrorMsg('Erro de rede ao enviar suas respostas.');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="card card-highlight">
        <div className="badge-row">
          <span className={`badge ${result.passed ? 'badge-available' : 'badge-planned'}`}>
            {result.passed ? 'Bloco aprovado ✓' : 'Revisão recomendada'}
          </span>
          <span className="badge badge-neutral">
            Nota: {result.scorePercent}% ({result.correctCount}/{result.totalCount})
          </span>
        </div>
        <h2 style={{ margin: 0, fontSize: 26 }}>
          {result.passed
            ? 'Parabéns! Você atingiu a nota mínima.'
            : `Você precisava de ${result.minPassPercent}% para avançar.`}
        </h2>
        <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
          {result.passed
            ? 'Seu progresso foi registrado no servidor e o próximo bloco já pode ser acessado.'
            : 'Revise os pontos indicados abaixo e faça uma nova tentativa quando estiver pronto.'}
        </p>

        {result.reviewItems.length > 0 ? (
          <div className="module-stack">
            <h3 style={{ margin: '8px 0 0', fontSize: 18 }}>Pontos para revisar</h3>
            {result.reviewItems.map((item, idx) => (
              <article key={idx} className="block-card">
                <strong>
                  {item.skill} · Aula {String(item.lessonPosition).padStart(2, '0')}
                </strong>
                <p style={{ margin: 0 }}>{item.question}</p>
                <p style={{ margin: 0, fontSize: 14, color: '#991b1b' }}>
                  Sua resposta: {item.selectedText}
                </p>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--cm-success-ink)' }}>
                  Resposta esperada: {item.expectedText}
                </p>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--cm-muted)' }}>
                  {item.explanation}
                </p>
                <Link
                  href={`/app/cursos/${courseSlug}/aulas/A${String(item.lessonPosition).padStart(2, '0')}`}
                  className="inline-link"
                >
                  Rever Aula {String(item.lessonPosition).padStart(2, '0')} →
                </Link>
              </article>
            ))}
          </div>
        ) : null}

        <div className="hero-actions">
          <Link href={`/app/cursos/${courseSlug}`} className="pill-btn">
            Voltar para a sala do curso
          </Link>
          <button type="button" className="pill-btn pill-btn-secondary" onClick={handleStart}>
            Fazer nova tentativa
          </button>
        </div>
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="card card-highlight">
        <span className="badge badge-brand" style={{ width: 'fit-content' }}>
          Avaliação do bloco {blockCode}
        </span>
        <h1 className="section-heading" style={{ margin: 0 }}>
          Quiz de fixação (10 questões)
        </h1>
        <p style={{ margin: 0, color: 'var(--cm-muted)' }}>
          As questões e alternativas são sorteadas no servidor a cada tentativa. A nota mínima
          para liberação do próximo bloco é de <strong>70%</strong>. O gabarito comentado aparece
          somente após o envio completo.
        </p>
        {errorMsg ? (
          <div className="alert-error" role="alert">
            {errorMsg}
          </div>
        ) : null}
        <div className="hero-actions" style={{ marginTop: 8 }}>
          <button type="button" className="pill-btn" onClick={handleStart} disabled={loading}>
            {loading ? 'Preparando questões...' : 'Iniciar quiz agora'}
          </button>
          <Link href={`/app/cursos/${courseSlug}`} className="pill-btn pill-btn-secondary">
            Voltar ao curso
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="module-stack">
      <div className="card">
        <span className="badge badge-brand" style={{ width: 'fit-content' }}>
          {blockTitle} · Mínimo {minPass}%
        </span>
        <h1 className="section-heading" style={{ margin: 0 }}>
          Responda às {questions.length} questões
        </h1>
        <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 14 }}>
          Selecione uma alternativa por questão e clique em enviar para ver sua nota e revisão.
        </p>
      </div>

      {errorMsg ? (
        <div className="alert-error" role="alert">
          {errorMsg}
        </div>
      ) : null}

      {questions.map((q) => (
        <fieldset key={q.questionId} className="quiz-fieldset">
          <legend>
            {String(q.index + 1).padStart(2, '0')}. {q.question}
          </legend>
          {q.options.map((opt, optIdx) => (
            <label key={optIdx} className="quiz-option">
              <input
                type="radio"
                name={`q-${q.index}`}
                required
                checked={answers[q.index] === optIdx}
                onChange={() => setAnswers((prev) => ({ ...prev, [q.index]: optIdx }))}
              />
              <span>{opt}</span>
            </label>
          ))}
        </fieldset>
      ))}

      <div className="hero-actions">
        <button type="submit" className="pill-btn" disabled={loading}>
          {loading ? 'Corrigindo no servidor...' : 'Enviar respostas e ver resultado'}
        </button>
      </div>
    </form>
  );
}

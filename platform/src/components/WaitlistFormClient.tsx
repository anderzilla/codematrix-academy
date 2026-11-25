'use client';

import { useState } from 'react';

export function WaitlistFormClient({
  courseId,
  targetScope,
  label,
}: {
  courseId: string;
  targetScope: string;
  label: string;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ courseId, targetScope, email }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Não foi possível registrar seu aviso.');
        return;
      }
      setDoneMsg(json.message || 'Interesse registrado!');
      setEmail('');
    } catch {
      setErrorMsg('Erro de rede.');
    } finally {
      setBusy(false);
    }
  }

  if (doneMsg) {
    return (
      <div className="alert-success" role="status" style={{ marginTop: 10 }}>
        {doneMsg}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}
    >
      <input
        type="email"
        required
        className="field-input"
        style={{ flex: '1 1 220px', minHeight: 38 }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Seu e-mail para ser avisado"
        aria-label={label}
      />
      <button type="submit" className="pill-btn pill-btn-sm" disabled={busy}>
        {busy ? 'Salvando...' : label}
      </button>
      {errorMsg ? (
        <span style={{ color: '#991b1b', fontSize: 13 }} role="alert">
          {errorMsg}
        </span>
      ) : null}
    </form>
  );
}

'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

interface DevMailItem {
  id: string;
  recipient_email: string;
  purpose: string;
  subject: string;
  token_preview: string;
  action_url: string;
  created_at: string;
}

export function AuthPortalClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialModeParam = searchParams.get('modo');
  const initialToken = searchParams.get('token') ?? '';

  const [mode, setMode] = useState<AuthMode>(() => {
    if (initialModeParam === 'cadastro') return 'register';
    if (initialModeParam === 'verificar') return 'verify';
    if (initialModeParam === 'recuperar') return 'forgot';
    if (initialModeParam === 'redefinir') return 'reset';
    return 'login';
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [devMessages, setDevMessages] = useState<DevMailItem[]>([]);
  const [showDevBox, setShowDevBox] = useState(false);

  const loadDevMailbox = useCallback(async (targetEmail?: string) => {
    try {
      const qs = targetEmail ? `?email=${encodeURIComponent(targetEmail)}` : '';
      const res = await fetch(`/api/v1/dev/mailbox${qs}`);
      if (!res.ok) return;
      const data = (await res.json()) as { ok?: boolean; messages?: DevMailItem[] };
      if (data.ok && Array.isArray(data.messages)) {
        setDevMessages(data.messages);
        setShowDevBox(true);
      }
    } catch {
      // ignora em produção ou erro de rede
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'Não foi possível entrar.');
        if (data.code === 'email_not_verified') {
          await loadDevMailbox(email);
        }
        return;
      }
      router.push('/app');
      router.refresh();
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        devMailboxHint?: boolean;
      };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'Não foi possível criar sua conta.');
        return;
      }
      setSuccessMsg(
        data.message ||
          'Conta criada! Verifique seu e-mail para liberar o acesso à Área do Aluno.',
      );
      setMode('verify');
      if (data.devMailboxHint) {
        await loadDevMailbox(email);
      }
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'Código inválido ou expirado.');
        return;
      }
      setSuccessMsg(data.message || 'E-mail confirmado! Agora faça login.');
      setMode('login');
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Não foi possível processar o pedido.');
        return;
      }
      setSuccessMsg(data.message || 'Instruções enviadas se o e-mail estiver cadastrado.');
      await loadDevMailbox(email);
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'Não foi possível redefinir a senha.');
        return;
      }
      setSuccessMsg(data.message || 'Senha atualizada! Faça login com a nova senha.');
      setPassword('');
      setMode('login');
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card card-highlight">
      <div className="tabs-row" role="tablist" aria-label="Opções de acesso">
        <button
          type="button"
          role="tab"
          className="tab-btn"
          aria-selected={mode === 'login'}
          onClick={() => {
            setMode('login');
            setErrorMsg(null);
          }}
        >
          Entrar
        </button>
        <button
          type="button"
          role="tab"
          className="tab-btn"
          aria-selected={mode === 'register'}
          onClick={() => {
            setMode('register');
            setErrorMsg(null);
          }}
        >
          Criar conta
        </button>
        <button
          type="button"
          role="tab"
          className="tab-btn"
          aria-selected={mode === 'verify'}
          onClick={() => {
            setMode('verify');
            setErrorMsg(null);
          }}
        >
          Confirmar e-mail
        </button>
        <button
          type="button"
          role="tab"
          className="tab-btn"
          aria-selected={mode === 'forgot' || mode === 'reset'}
          onClick={() => {
            setMode('forgot');
            setErrorMsg(null);
          }}
        >
          Recuperar senha
        </button>
      </div>

      {errorMsg ? (
        <div className="alert-error" role="alert">
          {errorMsg}
        </div>
      ) : null}

      {successMsg ? (
        <div className="alert-success" role="status">
          {successMsg}
        </div>
      ) : null}

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="form-stack">
          <div className="field-group">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.nome@empresa.com.br"
            />
          </div>
          <div className="field-group">
            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 8 caracteres"
            />
          </div>
          <button type="submit" className="pill-btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar na Área do Aluno'}
          </button>
        </form>
      ) : null}

      {mode === 'register' ? (
        <form onSubmit={handleRegister} className="form-stack">
          <div className="field-group">
            <label htmlFor="reg-name">Nome completo</label>
            <input
              id="reg-name"
              type="text"
              required
              minLength={2}
              autoComplete="name"
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como deverá aparecer nos seus certificados"
            />
          </div>
          <div className="field-group">
            <label htmlFor="reg-email">E-mail</label>
            <input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Use o mesmo e-mail da sua compra, se já comprou"
            />
          </div>
          <div className="field-group">
            <label htmlFor="reg-password">Criar senha</label>
            <input
              id="reg-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Escolha uma senha com pelo menos 8 caracteres"
            />
          </div>
          <button type="submit" className="pill-btn" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar conta gratuita'}
          </button>
        </form>
      ) : null}

      {mode === 'verify' ? (
        <form onSubmit={handleVerify} className="form-stack">
          <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 14 }}>
            Cole abaixo o código de confirmação enviado para o seu e-mail.
          </p>
          <div className="field-group">
            <label htmlFor="verify-token">Código de confirmação</label>
            <input
              id="verify-token"
              type="text"
              required
              className="field-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole o código recebido"
            />
          </div>
          <button type="submit" className="pill-btn" disabled={loading}>
            {loading ? 'Validando...' : 'Confirmar meu e-mail'}
          </button>
        </form>
      ) : null}

      {mode === 'forgot' ? (
        <form onSubmit={handleForgot} className="form-stack">
          <p style={{ margin: 0, color: 'var(--cm-muted)', fontSize: 14 }}>
            Informe seu e-mail cadastrado. Enviaremos um código seguro para criar uma nova
            senha.
          </p>
          <div className="field-group">
            <label htmlFor="forgot-email">E-mail cadastrado</label>
            <input
              id="forgot-email"
              type="email"
              required
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <button type="submit" className="pill-btn" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar instruções'}
            </button>
            <button
              type="button"
              className="pill-btn pill-btn-secondary"
              onClick={() => setMode('reset')}
            >
              Já tenho o código
            </button>
          </div>
        </form>
      ) : null}

      {mode === 'reset' ? (
        <form onSubmit={handleReset} className="form-stack">
          <div className="field-group">
            <label htmlFor="reset-token">Código de recuperação</label>
            <input
              id="reset-token"
              type="text"
              required
              className="field-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label htmlFor="reset-password">Nova senha</label>
            <input
              id="reset-password"
              type="password"
              required
              minLength={8}
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 8 caracteres"
            />
          </div>
          <button type="submit" className="pill-btn" disabled={loading}>
            {loading ? 'Atualizando...' : 'Salvar nova senha'}
          </button>
        </form>
      ) : null}

      {showDevBox && devMessages.length > 0 ? (
        <div className="notice-box" role="region" aria-label="Caixa de entrada local de desenvolvimento">
          <strong>Caixa de entrada local (somente desenvolvimento):</strong> SMTP externo não
          está configurado neste ambiente. Use o código abaixo para testar o fluxo localmente:
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {devMessages.slice(0, 3).map((m) => (
              <li key={m.id} style={{ marginBottom: 6 }}>
                <strong>{m.subject}</strong> ({m.recipient_email}) —{' '}
                <button
                  type="button"
                  className="inline-link"
                  style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }}
                  onClick={() => {
                    setToken(m.token_preview);
                    setMode(m.purpose === 'reset_password' ? 'reset' : 'verify');
                  }}
                >
                  Preencher código automaticamente
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="meta-ref" style={{ marginTop: 4 }}>
        Precisa de ajuda com seu acesso?{' '}
        <Link href="/suporte" className="inline-link">
          Fale com o suporte
        </Link>
        .
      </p>
    </div>
  );
}

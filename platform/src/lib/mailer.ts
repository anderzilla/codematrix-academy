import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export interface OutgoingEmail {
  to: string;
  purpose: 'verify_email' | 'reset_password';
  subject: string;
  token: string;
  actionPath: string;
}

export function isDevMailboxEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ACADEMY_DEV_MAILBOX === '1') return true;
  if (env.ACADEMY_DEV_MAILBOX === '0') return false;
  return env.NODE_ENV !== 'production';
}

export function getMailerConfig(env: NodeJS.ProcessEnv = process.env) {
  const resendKey = env.RESEND_API_KEY?.trim() ?? '';
  const fromAddress = env.ACADEMY_MAIL_FROM?.trim() || 'CodeMatrix Academy <no-reply@academy.codematrix.com.br>';
  return {
    provider: resendKey ? 'resend' : isDevMailboxEnabled(env) ? 'dev_mailbox' : 'unconfigured',
    fromAddress,
    configured: Boolean(resendKey) || isDevMailboxEnabled(env),
  };
}

export function dispatchTransactionalEmail(
  db: DatabaseSync,
  email: OutgoingEmail,
  env: NodeJS.ProcessEnv = process.env,
): { delivered: boolean; channel: 'dev_mailbox' | 'resend_async' | 'unconfigured' } {
  const baseUrl = (env.ACADEMY_PUBLIC_URL || 'http://127.0.0.1:3100').replace(/\/+$/, '');
  const fullUrl = `${baseUrl}${email.actionPath}`;

  if (isDevMailboxEnabled(env)) {
    const id = `mail_${crypto.randomUUID().replace(/-/g, '')}`;
    db.prepare(
      `INSERT INTO dev_mailbox (id, recipient_email, purpose, subject, token_preview, action_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, email.to, email.purpose, email.subject, email.token, fullUrl);
    return { delivered: true, channel: 'dev_mailbox' };
  }

  const resendKey = env.RESEND_API_KEY?.trim() ?? '';
  if (resendKey) {
    const fromAddress =
      env.ACADEMY_MAIL_FROM?.trim() || 'CodeMatrix Academy <no-reply@academy.codematrix.com.br>';
    // Envio assíncrono não bloqueante via Resend API (compatível com Azure Container Apps sem depender de porta SMTP 25/587)
    void fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${resendKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email.to],
        subject: email.subject,
        text: `${email.subject}\n\nAcesse o link abaixo para continuar:\n${fullUrl}\n\nCódigo: ${email.token}\n\nSe você não solicitou esta ação, ignore este e-mail.`,
      }),
    }).catch(() => {
      // falha registrada apenas por observabilidade externa sem vazar token em logs
    });
    return { delivered: true, channel: 'resend_async' };
  }

  return { delivered: false, channel: 'unconfigured' };
}

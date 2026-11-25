/**
 * Utilitários de segurança de borda: validação CSRF por Origin em rotas mutáveis
 * autenticadas por cookie e geração de QR Code SVG leve para certificados.
 */
export function verifyCsrfOrigin(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): { ok: true } | { ok: false; error: string } {
  const origin = request.headers.get('origin');
  // Requisições server-to-server ou curl/testes sem header Origin não são bloqueadas aqui
  // (cookies SameSite=Lax + Origin check bloqueiam CSRF de navegadores cross-site)
  if (!origin) return { ok: true };

  const allowedOrigins = new Set<string>();
  const configured = env.ACADEMY_PUBLIC_URL?.trim();
  if (configured) {
    try {
      allowedOrigins.add(new URL(configured).origin);
    } catch {
      // ignora URL inválida
    }
  }
  const host = request.headers.get('host');
  if (host) {
    allowedOrigins.add(`http://${host}`);
    allowedOrigins.add(`https://${host}`);
  }

  if (allowedOrigins.size === 0 || allowedOrigins.has(origin)) {
    return { ok: true };
  }

  return {
    ok: false,
    error: 'Origem da requisição não autorizada (proteção CSRF).',
  };
}

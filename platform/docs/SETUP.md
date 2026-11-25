# Setup local, variáveis de ambiente e deploy/DNS

## Pré-requisitos

- Node.js `>= 22.13.0` (testado com Node `v24.19.0`)
- `npm.cmd` no PowerShell (Windows)

## Execução local

```powershell
cd G:\CodeMatrix\codematrix-academy\platform
Copy-Item .env.example .env.local
npm.cmd install
npm.cmd run seed
npm.cmd run dev
```

Acesse `http://127.0.0.1:3100`.

### Portas locais do workspace CodeMatrix

- `3000`: Site corporativo Next.js (`site/codematrix-corporate-live`)
- `3100`: CodeMatrix Academy (`site/codematrix-academy`)
- `8000`: CodeMatrix Integration Hub
- `8080`: CodeMatrix Agency CRM

## Variáveis de ambiente

Consulte `.env.example` para a lista completa. Nunca commite valores reais.

| Variável | Obrigatória em produção | Uso |
|---|---|---|
| `ACADEMY_PUBLIC_URL` | Sim | URL canônica (`https://academy.codematrix.com.br`) |
| `ACADEMY_CORPORATE_SITE_URL` | Sim | Link institucional (`https://www.codematrix.com.br`) |
| `ACADEMY_SUPPORT_EMAIL` | Sim | Canal de suporte exibido na vitrine |
| `ACADEMY_DB_PATH` | Local | Caminho do SQLite local (padrão `./data/academy.sqlite`) |
| `ACADEMY_COURSE_SOURCE_DIR` | Opcional | Pasta local de importação da Formação IA (`G:\Estudos de IA`) |
| `ACADEMY_SESSION_COOKIE_NAME` | Sim (Etapa 2+) | Nome isolado do cookie de sessão (`cm_academy_session`) |
| `ACADEMY_SESSION_SECRET` | Sim (Etapa 2+) | Segredo de assinatura de sessão (Secret Manager) |
| `HOTMART_MODE` | Sim | `sandbox` em dev/teste ou `production` em produção |
| `HOTMART_HOTTOK` | Sim (produção) | Token validado no header `X-HOTMART-HOTTOK` (fail-closed) |
| `HOTMART_CHECKOUT_BASE_URL` | Sim | Base URL do checkout Hotmart (`https://pay.hotmart.com`) |
| `HOTMART_PRODUCT_MAP_JSON` | Opcional | Mapeamento JSON de SKU interno para produto/oferta Hotmart |
| `CLOUDFLARE_STREAM_*` | Sim (Etapa 2+) | Credenciais server-side para URLs assinadas e allowlist |

## Deploy separado e DNS (referência — não aplicado na Etapa 1)

1. **Serviço dedicado:** publicar `site/codematrix-academy` em serviço Cloud Run próprio (`codematrix-academy`), separado do serviço do site corporativo (`www.codematrix.com.br`).
2. **DNS (Registro.br):** criar registro `CNAME` ou mapeamento gerenciado para `academy.codematrix.com.br` apontando para o endpoint HTTPS dedicado somente após aprovação do Founder e conclusão dos gates da Etapa 4.
3. **TLS e cabeçalhos:** HTTPS obrigatório com certificado gerenciado, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` restritiva e cookies `Secure; HttpOnly`.
4. **Segredos:** armazenar `HOTMART_HOTTOK`, `ACADEMY_SESSION_SECRET` e chaves Cloudflare Stream exclusivamente no Secret Manager.

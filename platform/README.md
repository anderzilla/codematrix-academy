# CodeMatrix Academy

Plataforma educacional fechada e multi-curso da CodeMatrix para `academy.codematrix.com.br`, separada logicamente do site corporativo (`https://www.codematrix.com.br`).

## Estado atual — Etapa 1 de 4 (Fundação e Vitrine Pública)

- **Vitrine pública:** página inicial (`/`), catálogo multi-curso (`/cursos`), página de detalhe do curso (`/cursos/[slug]`), página de oferta/checkout (`/oferta/[offerCode]`) e páginas institucionais editáveis (`/suporte`, `/privacidade`, `/termos`).
- **Persistência escalável:** banco SQLite dedicado via `node:sqlite` (zero compilação nativa), modelado para `tenant → course → course_version → module → block → lesson → asset`, além de `quiz_questions`, `offers`, `coupons`, `payment_events` e `cms_pages`.
- **Importação idempotente:** `npm run seed` importa exclusivamente o conteúdo verificável da **Formação IA / AnderZilla** (Módulo 1 disponível com 5 blocos, 15 aulas, 60 slides e 60 questões; Módulos 2 e 3 registrados como planejados, sem invenção de aulas) e gera `data/import-report.json`.
- **Adapter Hotmart + Webhook:** endpoint `POST /api/webhooks/hotmart` com validação de `X-HOTMART-HOTTOK` em tempo constante, validação de schema, sanitização de payload, idempotência por `provider_event_id` e modo fail-closed em produção. Direitos (`entitlements`) não são concedidos nesta etapa (preparado para a Etapa 2).
- **Contratos de superfícies:** rotas `/app`, `/partners`, `/admin` e API `/api/v1/contracts/surfaces` definidas com bloqueio por padrão, sem expor dados privados.

## Comandos

```powershell
npm.cmd install
npm.cmd run seed
npm.cmd run dev        # http://127.0.0.1:3100
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
```

## Documentação

- [Arquitetura e decisões](docs/ARCHITECTURE.md)
- [Setup local, env vars e deploy/DNS](docs/SETUP.md)
- [Identidade visual e tokens CodeMatrix](docs/VISUAL-TOKENS.md)

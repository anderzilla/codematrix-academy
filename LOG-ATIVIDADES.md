# LOG DE ATIVIDADES — CodeMatrix Academy

Memória compartilhada entre todos os modelos que trabalham nesta pasta (Claude, Codex, Gemini, Grok,
Ollama, Nemotron...). **Leia as entradas mais recentes antes de começar. Registre o que mudou ao terminar.**

Formato de cada entrada:
`### AAAA-MM-DD HH:MM · tipo · modelo · agente` + texto + arquivos.
Tipos: melhoria · regra · skill · aprendizado · erro · decisao · execucao (execuções rotineiras ficam só em `log/atividades.jsonl`).

Comando: `rex log add --modelo <modelo> --agente <id> --tipo <tipo> --texto "..." [--arquivos a,b]`

<!-- ENTRADAS: novas entradas são inseridas logo abaixo desta linha -->

### 2026-11-25 15:59 · melhoria · antigravity · plataforma-academy
Etapa 4/4 concluída em `platform/` (branch `feat/academy-platform-stage4`): painel administrativo `/admin` com MFA/step-up obrigatório (`src/lib/admin-auth.ts`, `session_mfa`), razão operacional financeira append-only (`financial_ledger`, exportação CSV), fechamento de parceiros maker-checker (2 admins distintos obrigatórios; bloqueia auto-aprovação com `403 maker_checker_violation`, pagamento exclusivamente manual com comprovante), gestão de direitos com motivo obrigatório, revogação justificada de certificados refletida na página pública, vinculação de `stream_uid` sem segredos, fila LGPD, runbook operacional (`docs/RUNBOOK-OPERACAO.md`) e matriz de permissões (`docs/PERMISSIONS-MATRIX.md`). Validado com `seed`, `lint`, `typecheck`, `build` (56 rotas) e `test` (6/6).
Arquivos: platform/src/lib/admin-auth.ts, platform/src/lib/ledger.ts, platform/src/lib/admin.ts, platform/src/app/admin/page.tsx, platform/src/components/AdminDashboardClient.tsx, platform/src/app/api/v1/admin/, platform/docs/RUNBOOK-OPERACAO.md, platform/docs/PERMISSIONS-MATRIX.md, platform/test/stage4.test.mjs

### 2026-11-25 15:29 · melhoria · antigravity · plataforma-academy
Etapas 1 e 2 alinhadas ao Manual de Identidade Visual Light Liquid Glass (sem personagens) e à arquitetura híbrida Azure PostgreSQL + NoSQL: removidos fundos escuros chapados em `.slide-visual` e aplicados painéis translúcidos em `.step-card`, `.block-card`, `.slide-deck`, `.video-shell`, `.quiz-fieldset`, `.cert-card` e `.academy-footer`; DDL `db/postgres/schema.sql` expandido para paridade completa das Etapas 1, 2 e 3; seed da Etapa 1 sincroniza snapshot documental no NoSQL (`content_documents`); Etapa 2 ganha anotações "Pare e Anote" persistidas no NoSQL (`GET/POST /api/v1/app/courses/[slug]/lessons/[lessonCode]/notes`) com proteção IDOR testada em `test/stage2.test.mjs`. Validado com `seed`, `lint`, `typecheck`, `build` e `test` (5/5).
Arquivos: platform/src/styles/academy.css, platform/db/postgres/schema.sql, platform/scripts/seed-catalog.mjs, platform/src/app/api/v1/app/courses/[slug]/lessons/[lessonCode]/notes/route.ts, platform/src/components/LessonPlayerClient.tsx, platform/docs/ARCHITECTURE.md, platform/test/stage2.test.mjs

### 2026-11-25 15:20 · melhoria · antigravity · plataforma-academy
Etapa 3/4 concluída em `platform/` (branch `feat/academy-platform-stage3`) + alinhamento ao Manual de Identidade Visual Light Liquid Glass (sem personagens) e arquitetura híbrida Azure PostgreSQL + Cosmos DB NoSQL: RBAC deny-by-default para `instructor`, `affiliate`, `seller` e `partner`; onboarding com aceite de termos e dados bancários cifrados (AES-256-GCM + resumo mascarado); links/cupons únicos separando desconto do cliente e remuneração do parceiro; agenda e checklist de professor isolados por atribuição; comissões versionadas com snapshot congelado não retroativo, bloqueio em refund/chargeback sem apagar trilha, antifraude proporcional com direito a recurso e exportação CSV reconciliada; DDL PostgreSQL 16 (`db/postgres/schema.sql`), adapter NoSQL (`src/lib/persistence/nosql.ts`) e guia Azure (`docs/AZURE-DATA-ARCHITECTURE.md`). Validado com `lint`, `typecheck`, `build` e `test` (5/5).
Arquivos: platform/src/lib/rbac.ts, platform/src/lib/partners.ts, platform/src/lib/audit.ts, platform/src/lib/persistence/nosql.ts, platform/db/postgres/schema.sql, platform/docs/AZURE-DATA-ARCHITECTURE.md, platform/src/app/partners/page.tsx, platform/src/components/PartnersDashboardClient.tsx, platform/src/styles/tokens.css, platform/src/styles/academy.css, platform/test/stage3.test.mjs

### 2026-11-25 15:04 · melhoria · antigravity · plataforma-academy
Etapa 2/4 concluída em `platform/` (branch `feat/academy-platform-stage2`): autenticação com `scrypt` + sessões `HttpOnly`, verificação de e-mail, recuperação de senha com revogação de sessões e `dev_mailbox` isolado para desenvolvimento; serviço central `entitlements` + histórico append-only (`entitlement_history`) conectado ao webhook Hotmart (concessão idempotente + revogação/suspensão em refund/chargeback); biblioteca do aluno (`/app`), sala do curso (`/app/cursos/[slug]`), aulas protegidas em telas (`/app/cursos/[slug]/aulas/[lessonCode]`), quiz de 10 questões 100% corrigido no servidor (`/app/cursos/[slug]/blocos/[blockCode]/quiz`), Cloudflare Stream assinado RS256 fail-closed (`/api/v1/app/stream/token`), agenda de lives autorizadas e certificados verificáveis públicos privacy-safe (`/certificados/[code]`). Validado com `lint`, `typecheck`, `build` e `test` (4/4).
Arquivos: platform/src/lib/schema.sql, platform/src/lib/auth.ts, platform/src/lib/entitlements.ts, platform/src/lib/student.ts, platform/src/lib/stream/cloudflare.ts, platform/src/lib/certificates.ts, platform/src/lib/lives.ts, platform/src/app/entrar/, platform/src/app/app/, platform/src/app/certificados/, platform/test/stage2.test.mjs

### 2026-11-25 14:26 · melhoria · antigravity · revisor-ui-ux
Revisão completa de UI/UX, fluxos e clareza de textos em `platform/`: remoção de jargão técnico interno da vitrine, adição de breadcrumbs de navegação, guia de progressão em 3 passos no detalhe do curso, exibição do objetivo prático de cada uma das 15 aulas, lista clara de entregáveis e liberação na página de oferta, guia de atendimento em `/suporte`, telas de acesso restrito (`/app`, `/partners`, `/admin`) em português natural sem nomes internos de roles e correção de contraste do botão ativo no cabeçalho. Validado em `lint`, `typecheck`, `build`, `test` (3/3) e inspeção visual no browser local.
Arquivos: platform/src/styles/academy.css, platform/src/components/Breadcrumbs.tsx, platform/src/components/AcademyFooter.tsx, platform/src/components/RestrictedSurfaceGate.tsx, platform/src/components/CmsPageView.tsx, platform/src/app/page.tsx, platform/src/app/cursos/page.tsx, platform/src/app/cursos/[slug]/page.tsx, platform/src/app/oferta/[offerCode]/page.tsx, platform/src/app/not-found.tsx, platform/scripts/seed-catalog.mjs

### 2026-11-25 13:57 · melhoria · antigravity · plataforma-academy
Etapa 1/4 da plataforma web CodeMatrix Academy adicionada em `platform/` (Next.js 16 + React 19 + TypeScript + `node:sqlite`): vitrine pública com identidade visual CodeMatrix, catálogo multi-curso (`published` vs `draft`), seed idempotente da Formação IA/AnderZilla (Módulo 1 com 5 blocos, 15 aulas, 60 slides e 60 questões no servidor; Módulos 2–3 marcados como planejados), adapter/webhook Hotmart autenticado por `X-HOTMART-HOTTOK` com idempotência e modo fail-closed (sem conceder direitos na Etapa 1) e gates de acesso para `/app`, `/partners` e `/admin`.
Arquivos: platform/, platform/docs/ARCHITECTURE.md, platform/docs/SETUP.md, platform/scripts/seed-catalog.mjs, platform/src/lib/payments/hotmart.ts, platform/test/stage1.test.mjs

### 2026-11-13 13:47 · aprendizado · claude-opus-5-5 · estrategista-oferta
Aula do Pocket = vídeo animado curto (cenas, ~1–2 min) + gravação de tela de 4–6 min usando o material; as cenas sozinhas não cobrem a duração-alvo do roteiro.


### 2026-11-13 13:47 · decisao · claude-opus-5-5 · estrategista-oferta
Founder pediu prompt para converter a área Cursos e kits do site em CodeMatrix Academy, a ser usado só depois dos 4 cursos publicados na Kiwify: planos/prompts/site-academy.md.


### 2026-11-13 13:47 · skill · claude-opus-5-5 · estrategista-oferta
Skill sprint-curso: executar o sprint de 2 dias de um curso a partir de rex sprint hoje e da pasta cursos/<id>/.


### 2026-11-13 13:47 · melhoria · claude-opus-5-5 · estrategista-oferta
Curso 1 (financas-familia) adiantado: 5 roteiros e 5 cenas do Pocket, quiz, planilha Pocket e planilha Completa com fórmulas testadas (scripts/planilhas/financas_familia.py), copy das páginas, anúncios, capas dos 8 produtos, jornada D0–D30, avaliação e remarketing.


### 2026-11-13 13:47 · melhoria · claude-opus-5-5 · estrategista-oferta
Estrutura versionada por curso em cursos/<id>/ (pocket, completo, paginas, marketing, retencao, kiwify, pareceres, metricas); catálogo dos 4 cursos com Pocket + Completo; comandos rex sprint (listar, hoje, iniciar, kiwify) e rex salvar (bloqueia segredos, e-mail/CPF e arquivos grandes fora do LFS); vídeos e áudios via Git LFS; painel e revisão funcionam na pasta do curso.


### 2026-11-13 13:32 · decisao · claude-opus-5-5 · estrategista-oferta
Founder definiu o modelo Pocket (barato, venda rápida, gera curiosidade) → Completo (mais caro, mais recursos) e sprint de 2 dias por curso com 5 passos. RN-003 atualizada. Roteiro a partir de 16/11 em planos/ROTEIRO-2026-11-16.md (ordem: Finanças, Produto digital, WhatsApp, App com IA; Black Friday 27–30/11).
Arquivos: planos/ROTEIRO-2026-11-16.md, regras/negocio/RN-003.md


### 2026-11-13 13:16 · skill · claude-opus-5-5 · especialista-marketing-de-imagem
Manual da marca, identidade visual e personagens gerado por scripts/gerar_manual.py (marca/manual/*.html e .pdf); regenerar sempre que mudar tokens, ilustrações ou poses.


### 2026-11-13 13:16 · aprendizado · claude-opus-5-5 · especialista-marketing-de-imagem
Personagens de terceiros (ex.: EVE, Disney/Pixar) não podem ser usados nem imitados; pedido de 'baseado em' foi atendido elevando a qualidade (porcelana brilhante, luz de estúdio, LED) com design próprio. Manter olhos de pixels no Trix e no Pixel — é o que os diferencia.


### 2026-11-13 13:16 · regra · claude-opus-5-5 · especialista-marketing-de-imagem
RC-012 (títulos com verbo de ação + subtítulo com 4–6 entregáveis) e RC-013 (personagens e ilustrações padronizados) — ativas por pedido do Founder.


### 2026-11-13 13:16 · decisao · claude-opus-5-5 · especialista-marketing-de-imagem
Founder pediu títulos com ação e subtítulos detalhados; fila de oportunidades reescrita (data/oportunidades_iniciais.csv) e regra RC-012 criada como ativa.


### 2026-11-13 13:16 · melhoria · claude-opus-5-5 · especialista-marketing-de-imagem
Ilustrações por trilha (marca/ilustracoes) e personagens próprios Trix (9 poses) e Pixel (3 expressões) em marca/personagens, gerados por scripts/gerar_ilustracoes.py; template de cena aceita 'personagem' e 'ilustracao' e encaixa títulos longos automaticamente.


### 2026-11-13 12:40 · melhoria · claude-opus-5-5
v0.2: projeto renomeado para CodeMatrix Academy (RN-004). Time de 18 agentes por setor e etapa (`agentes/`, `agentes/time.yaml`), painel de revisão automático no `rex dia` (`rex painel`), pasta `regras/` (RN-001..009, RC-001..011, `automaticas.yaml`), log de atividades, adaptadores para Codex/Gemini/Grok/Ollama/Nemotron (`rex sincronizar`), identidade visual liquid glass (`marca/`), pipeline de vídeo com narração e legenda (`rex video`).
Arquivos: agentes/, regras/, marca/, skills/, adaptadores/, rendaextra/video/, FLUXO.md

### 2026-11-13 12:40 · decisao · claude-opus-5-5
Founder definiu: nome CodeMatrix Academy; time com publicidade, redação, revisão, economia de vendas e de negócios, marketing digital e de imagem, jurídico de internet e vendas online; logs para troca de modelos; identidade baseada no site e nas capas light-glass dos guias de IA; vídeos com narração de alta qualidade e legenda.

### 2026-11-13 12:40 · aprendizado · claude-opus-5-5
Cores oficiais do site não puderam ser lidas de fora (imagens e CSS bloqueados para a ferramenta). `marca/tokens.json` está com paleta PROVISÓRIA. Rode `rex marca extrair` com o logo e as capas *-light-glass do site para trocar pelos valores reais.

### 2026-11-13 12:40 · skill · claude-opus-5-5
Skills criadas: oferta-diaria, modelagem-concorrente, revisao-compliance, analise-semanal, painel-revisao, video-aula, identidade-visual, registrar-atividade, nova-regra.

### 2026-11-13 11:40 · melhoria · claude-opus-5-5
v0.1: Fábrica de Ofertas — CLI `rex`, SQLite, roteador de IA (Ollama primeiro, cache, teto), integrações Kiwify/Hotmart somente leitura, compliance + originalidade, pipeline de 1 oferta por dia, análise semanal, MCP.

### 2026-11-13 11:20 · decisao · claude-opus-5-5
Founder escolheu: temas IA, marketing digital, renda extra, desenvolvimento pessoal/finanças; ritmo de 1 oferta testada por dia; modelar a estratégia dos mais vendidos sem copiar conteúdo.

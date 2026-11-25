# Matriz de Permissões (RBAC) — CodeMatrix Academy

Política global: **negação por padrão** (`deny-by-default`) validada exclusivamente no servidor. Um usuário pode acumular papéis, sempre limitados ao seu escopo de curso, campanha e contrato.

| Recurso / Ação | Visitante | Aluno (`student`) | Professor (`instructor`) | Afiliado / Vendedor (`affiliate`/`seller`) | Parceiro (`partner`) | Operação (`ops_support`) | Admin (`admin`) |
|---|---|---|---|---|---|---|---|
| Vitrine pública (`/`, `/cursos`, `/oferta/*`, `/certificados/*`) | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| Rascunhos de curso/oferta (`status = 'draft'`) | Não (`404`) | Não (`404`) | Não | Não | Não | Leitura (c/ MFA) | Completo (c/ MFA) |
| Aulas protegidas e "Pare e Anote" (`/app`, `/api/v1/app/*`) | Não (`401`) | Somente c/ `entitlement` + sequência | Somente se tiver `entitlement` | Somente se tiver `entitlement` | Somente se tiver `entitlement` | Não | Prévia controlada |
| Token Cloudflare Stream (`POST /api/v1/app/stream/token`) | Não (`401`) | Somente c/ `entitlement` (sem UID arbitrário) | Somente c/ `entitlement` | Somente c/ `entitlement` | Somente c/ `entitlement` | Não | Não (sem UID arbitrário) |
| Gabarito de quiz (`quiz_questions.correct_index`) | Nunca | Nunca antes do envio | Nunca | Nunca | Nunca | Nunca | Somente gestão |
| Painel de Parceiros (`/partners`, `/api/v1/partners/*`) | Não (`401`) | Não (`403`) | Somente atribuições próprias | Somente links/cupons/vendas próprias | Conforme escopo | Não | Não (usa `/admin`) |
| Lista de alunos / CPF / e-mail de comprador | Nunca | Nunca | Nunca | Nunca (comprador mascarado) | Nunca | Consulta atendimento | Gestão auditada (sem cartão) |
| Painel Admin (`/admin`, `/api/v1/admin/*`) | Não (`401`) | Não (`403`) | Não (`403`) | Não (`403`) | Não (`403`) | Leitura/Suporte (**MFA obrigatório**) | Completo (**MFA obrigatório**) |
| Aprovação de lote de repasse (Maker-Checker) | Não | Não | Não | Não | Não | Não | **Dois admins distintos** (`maker !== checker`) |
| Movimentação bancária automática | **Proibido** | **Proibido** | **Proibido** | **Proibido** | **Proibido** | **Proibido** | **Proibido (somente manual externo)** |

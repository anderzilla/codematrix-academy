# Runbook Operacional e Checklist de Lançamento — CodeMatrix Academy

> **Status:** ambiente local e de homologação concluídos (Etapas 1 a 4). **NÃO está pronto para produção** enquanto os gates externos abaixo (credenciais, gateway, jurídico, DNS/TLS, backup/restore testado e revisão contábil) permanecerem abertos.

## 1. Arquitetura de Produção Recomendada (Azure + Cloudflare)

1. **Aplicação isolada:** publicar `platform/` em **Azure Container Apps** (separado do site público `www.codematrix.com.br`), atrás de HTTPS/TLS gerenciado.
2. **DNS:** configurar `CNAME` para `academy.codematrix.com.br` no Registro.br / Cloudflare somente após aprovação formal do Founder.
3. **Bancos de dados:**
   - **Azure Database for PostgreSQL Flexible Server:** aplicar [db/postgres/schema.sql](../db/postgres/schema.sql), habilitar `sslmode=verify-full`, Private Endpoint, Managed Identity, Point-in-Time Restore (PITR) diário e Row-Level Security (RLS).
   - **Azure Cosmos DB for NoSQL:** habilitar containers `content_documents`, `student_notes` e `partner_telemetry` com particionamento por `tenantId`/`userId`/`partnerId`.
4. **Segredos:** armazenar `HOTMART_HOTTOK`, `ACADEMY_SESSION_SECRET`, `ACADEMY_PAYOUT_ENCRYPTION_KEY`, `ACADEMY_ADMIN_MFA_CODE`/TOTP, `DATABASE_URL` e chaves `CLOUDFLARE_STREAM_*` exclusivamente no **Azure Key Vault**.

## 2. Procedimentos Operacionais (Runbooks)

- **Webhook parado / evento não mapeado:** consultar `/admin` → Eventos Hotmart; conferir se `HOTMART_HOTTOK` e `HOTMART_PRODUCT_MAP_JSON` estão ativos; reenviar evento de forma idempotente (nunca concede direito duplicado).
- **Aluno sem acesso após compra:** verificar se o e-mail usado na compra corresponde ao e-mail verificado na conta; consultar `entitlements` e `entitlement_history`; concessão manual exige motivo obrigatório e MFA.
- **Chargeback / Reembolso:** o webhook revoga/suspende o direito, bloqueia a comissão vinculada e grava lançamento de ajuste no `financial_ledger` (append-only, sem apagar histórico).
- **Backup e Restore:** exercitar restauração PITR do Azure PostgreSQL em ambiente isolado antes do lançamento comercial e mensalmente após abertura.
- **Rollback de deploy:** manter revisão anterior pronta no Azure Container Apps; migrações SQL devem ser sempre aditivas (sem `DROP COLUMN` destrutivo no mesmo release).
- **Incidentes e LGPD:** pedidos de exportação/exclusão entram em `lgpd_requests` (`pending_approval`) para validação de identidade e aprovação humana.

## 3. Gates Restantes para Produção (não concluídos)

| Gate obrigatório | Estado atual | Dono sugerido |
|---|---|---|
| Conta Hotmart ativa + produtos/ofertas cadastrados + `HOTMART_HOTTOK` real | Pendente | Founder / Comercial |
| Preços oficiais, prazo de acesso e publicação das ofertas do Módulo 1 | Pendente | Founder / Produto |
| Conta Cloudflare Stream + upload dos vídeos privados (`requireSignedURLs`) + chave RS256 | Pendente | Conteúdo / Engenharia |
| Provisionamento Azure (Container Apps + PostgreSQL Flexible Server + Cosmos DB + Key Vault) | Pendente | Engenharia / Infra |
| DNS `academy.codematrix.com.br` + TLS + WAF/rate-limit de borda | Pendente | Engenharia / Infra |
| Teste real de backup + restore em ambiente separado | Pendente | Engenharia / Infra |
| Provedor SMTP transacional real (`ACADEMY_DEV_MAILBOX=0`) | Pendente | Engenharia / Operação |
| Revisão jurídica de Termos, Privacidade, Reembolso, Certificado e Contratos de Parceiros | Pendente | Jurídico |
| Validação contábil/fiscal de notas, tributos e repasses de parceiros | Pendente | Contabilidade / Financeiro |
| Revisão de segurança independente + MFA TOTP/OIDC definitivo para admins | Pendente | Segurança / Engenharia |

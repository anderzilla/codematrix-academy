# Pagamentos Próprios (Sem Hotmart) e Go-Live no Azure

## 1. Comparativo dos meios de pagamento avaliados

| Provedor | Pix | Cartão de Crédito | Google Pay / Apple Pay | Facilidade de API / Checkout Próprio | Recomendação |
|---|---|---|---|---|---|
| **Mercado Pago** | **~0,99%** (imediato) | **~3,98% (D+30) a 4,98% (na hora)** | **Sim (nativo via SDK/Checkout)** | **Excelente** (API REST madura, webhook HMAC-SHA256, antifraude incluso, zero PCI pesado) | **Escolhido como gateway principal (v1)** |
| **Banco Inter PJ** | **0%** (padrão) / ~0,9% CobV | Não focado em checkout web parcelado | Não | Boa API Pix/Boleto, mas exige mTLS e não resolve cartão/wallets | **2ª fase opcional** para Pix taxa 0% |
| **C6 Empresas** | **0%** (padrão) | Focado em maquininha C6 Pay | Não | API de e-commerce limitada | Conta bancária de recebimento / tesouraria |
| **PicPay Empresas** | ~0,99% comercial | Sob negociação / escalonado | Não unificado | Boa para carteira PicPay, menor alcance em Apple/Google Pay | Opcional futuro |

**Economia direta vs Hotmart:** a Hotmart cobrava **9,9% + R$ 2,49** por venda. Com **Mercado Pago próprio**, o Pix cai para **~0,99%** (economia de ~90% em taxas) e o cartão para **~3,98%–4,98%**, mantendo 100% da venda, cupons, links de parceiros, área do aluno e financeiro sob controle da CodeMatrix.

---

## 2. O que já foi implementado no código
- **Checkout próprio:** `POST /api/v1/checkout/create` + [OfferCheckoutClient.tsx](../src/components/OfferCheckoutClient.tsx) com suporte a **Pix**, **Cartão**, **Google Pay**, **Apple Pay**, cupons de parceiro e rastreio via `/r/[code]` (cookie `cm_partner_ref` + contagem de cliques).
- **Webhook Mercado Pago autenticado:** `POST /api/webhooks/mercadopago` com validação oficial HMAC-SHA256 (`x-signature`), idempotência, concessão/revogação automática de `entitlements`, cálculo de comissão congelada e lançamento append-only no `financial_ledger`.
- **Gestão Financeira & Balanço (DRE):** `GET /api/v1/admin/finance/balance` e `GET /api/v1/admin/ledger/export` (CSV) + fechamento de repasses de parceiros com **dupla aprovação Maker-Checker** e registro de comprovante manual.
- **Infraestrutura Azure pronta como código:** [Dockerfile](../Dockerfile), `GET /api/health` e [infra/azure/main.bicep](../infra/azure/main.bicep).

---

## 3. O que precisamos do Founder para colocar online no Azure

1. **Acesso Azure (`az login`):** assinatura Azure, Resource Group e aprovação explícita para rodar `az deployment group create --template-file infra/azure/main.bicep` (custo estimado inicial Burstable + Serverless).
2. **Credenciais Mercado Pago (no Azure Key Vault):**
   - `MERCADOPAGO_ACCESS_TOKEN`
   - `MERCADOPAGO_WEBHOOK_SECRET` (configurar URL `https://academy.codematrix.com.br/api/webhooks/mercadopago`)
   - `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
3. **E-mail transacional (Resend ou Azure Communication Services):** `RESEND_API_KEY` + `ACADEMY_MAIL_FROM` + validação DNS SPF/DKIM.
4. **Segredos de segurança (Azure Key Vault):** `ACADEMY_SESSION_SECRET`, `ACADEMY_PAYOUT_ENCRYPTION_KEY`, `ACADEMY_ADMIN_TOTP_SECRET` (Base32 para app autenticador) e chaves `CLOUDFLARE_STREAM_*`.
5. **DNS `academy.codematrix.com.br`:** apontar `CNAME` para o FQDN do Azure Container App após provisionamento.
6. **Observação técnica honesta:** o runtime local ainda usa `node:sqlite` + store NoSQL local; antes do primeiro deploy em produção no Azure Container Apps, instalar `pg` e `@azure/cosmos` e ativar o driver de produção no container (1 passo final assim que o PostgreSQL/Cosmos Azure estiverem provisionados).

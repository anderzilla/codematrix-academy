# Data Dictionary & Auditoria de Minimização LGPD — CodeMatrix Academy

> **Aviso de governança:** este documento é rascunho técnico de engenharia. Não substitui revisão formal por advogado, encarregado de dados (DPO) ou contador habilitado.

## 1. Inventário de Campos por Entidade (Princípio da Minimização — LGPD Art. 6º)

| Entidade | Campo | Obrigatório | Finalidade | Sensibilidade | Base Legal a Validar (Jurídico) | Retenção / Exclusão | Acesso |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `users` | `name` | Sim | Identificação do aluno e emissão de certificado | Baixa | Execução de contrato | Enquanto conta ativa + prazo legal | Titular, Admin |
| `users` | `email`, `email_hash` | Sim | Autenticação, verificação, recuperação e vínculo de pedidos | Média | Execução de contrato | Enquanto conta ativa + auditoria | Titular, Admin |
| `users` | `password_hash` | Sim | Autenticação segura (`scrypt` + salt) | Alta (segredo) | Legítimo interesse / segurança | Revogável; nunca exposto | Somente servidor |
| `user_communication_preferences` | `operational_enabled`, `marketing_opt_in` | Sim (default `1` / `0`) | Separar avisos operacionais de promocionais (opt-out) | Baixa | Consentimento (marketing) / Contrato (operacional) | Até revogação do titular | Titular, Admin |
| `orders` | `order_code`, `buyer_email_hash`, `gross_cents`, `provider_payment_id`, `status` | Sim | Conciliação financeira e entrega do curso (sem PAN/CVV) | Média | Obrigação legal / fiscal e contrato | 5 anos (obrigação fiscal) | Admin financeiro |
| `partner_profiles` | `display_name`, `contact_email`, `terms_version` | Sim | Contrato de parceria e atribuição por curso | Média | Execução de contrato | Vigência + 5 anos | Parceiro, Admin |
| `partner_profiles` | `payout_encrypted_blob`, `payout_masked_summary` | Opcional (só para repasse) | Dados PIX/TED cifrados com AES-256-GCM para repasse manual | Alta | Execução de contrato / obrigação fiscal | Enquanto contrato ativo + fiscal | Cifrado no servidor; mascarado na UI |
| `support_tickets` / `ticket_messages` | `subject`, `description`, `body`, `is_internal_note` | Sim | Atendimento ao aluno e histórico de suporte (CDC) | Média | Execução de contrato / CDC | Política de retenção a aprovar | Aluno (só públicas), Admin |
| `certificates` | `verification_code`, `student_display_name`, `course_title`, `status` | Sim | Verificação pública privacy-safe de curso livre | Baixa | Execução de contrato | Permanente / revogável | Público (sem e-mail/CPF) |

## 2. Dados Explicitamente NÃO Coletados por Padrão
- **CPF, data de nascimento e endereço residencial:** não são coletados no cadastro de aluno nem exigidos como senha/requisito pedagógico. Só devem ser solicitados em fluxo fiscal/contratual específico quando exigido para emissão de NFS-e, com aviso claro de finalidade.
- **PAN / CVV / dados de cartão:** nunca trafegam nem são armazenados pela CodeMatrix Academy (processados exclusivamente pelo Mercado Pago).
- **Dados sensíveis de saúde/acessibilidade:** não coletados por padrão.
- **Preenchimento por inferência/scraping:** proibido. Dados ausentes permanecem `NULL` / pendentes de confirmação do titular.

## 3. Referências Oficiais para Validação Jurídica e Contábil
- Constituição Federal: https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm
- LGPD (Lei nº 13.709/2018): https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
- CDC (Lei nº 8.078/1990): https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm
- Decreto nº 7.962/2013 (Comércio Eletrônico): https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm
- ANPD (Comunicação de Incidentes): https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis
- MEC (Cursos Livres — não usar nomenclatura de graduação/pós sem credenciamento): https://portal.mec.gov.br/conselho-nacional-de-educacao/atos-normativos--sumulas-pareceres-e-resolucoes/400-secretarias-112877938/seres-regulacao-e-supervisao-da-educacao-superio-1288707557/18540-perguntas-frequentes-seres

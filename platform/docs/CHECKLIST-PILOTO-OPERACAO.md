# Checklist de Piloto Operacional — CodeMatrix Academy

> **Status da validação de usabilidade:** **PENDENTE DE PILOTO REAL.** Este checklist prepara a execução assistida com usuários reais (sem benchmarks inventados) para medir tempo, erros e eventuais confusões entre avisos, tickets, calendário e financeiro.

## Perfil 1 — Administrador Escolar / Financeiro
- [ ] Criar um novo curso em `draft`, revisar em `review`, publicar em `published` e testar arquivamento (`archived`) sem exclusão física.
- [ ] Criar duas turmas (`T1` e `T2`) no mesmo curso em blocos diferentes e matricular alunos.
- [ ] Transferir um aluno de `T1` para `T2` com motivo e confirmar preservação integral do histórico de progresso.
- [ ] Agendar uma sessão ao vivo vinculada a professor autorizado, reagendar com motivo e confirmar disparo de aviso deduplicado apenas para a turma afetada.
- [ ] Responder um ticket de suporte com resposta pública + nota interna privada e confirmar clareza da separação na fila.
- [ ] Enviar um aviso operacional e um aviso promocional (conferir prévia de audiência e respeito ao opt-in).
- [ ] Conferir a Agenda Financeira e confirmar que o status deriva do ledger/PSP sem edição acidental por arraste.
- *Observações registradas (tempo, erros, pontos de confusão):* `______________________________`

## Perfil 2 — Aluno
- [ ] Visualizar seus cursos em `/app/courses` e diferenciar progresso de Curso A vs Curso B.
- [ ] Abrir `/app/agenda` e identificar o próximo evento no fuso `America/Sao_Paulo`.
- [ ] Abrir `/app/suporte`, ler um aviso na **Caixa de Avisos**, alternar a preferência de avisos promocionais e abrir um **Chamado de Suporte**.
- [ ] Confirmar que não há confusão entre **Caixa de Avisos** (comunicados) e **Chamados de Suporte** (atendimento).
- *Observações registradas (tempo, erros, pontos de confusão):* `______________________________`

## Perfil 3 — Professor / Afiliado / Parceiro
- [ ] Acessar `/partners/courses` e confirmar que vê somente cursos explicitamente atribuídos.
- [ ] Acessar `/partners/agenda` e confirmar visualização de sessões/campanhas próprias e previsão das próprias comissões (sem dados de outros parceiros ou lista de alunos).
- [ ] Confirmar compreensão clara da separação entre agenda pedagógica/campanhas e demonstrativo financeiro.
- *Observações registradas (tempo, erros, pontos de confusão):* `______________________________`

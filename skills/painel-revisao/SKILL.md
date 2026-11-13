---
name: painel-revisao
description: Põe o time de agentes para revisar uma oferta por etapa (economistas, juristas, corretor, compliance) e consolida os vereditos. Use antes de publicar ou quando o usuário pedir "revisão do time".
---

# Painel de revisão

1. `rex painel <pasta> [--etapas oferta,pagina,campanha,publicacao] [--motor local|barato|forte]`.
2. Leia `<pasta>/pareceres/RESUMO.md`. Para cada AJUSTAR/BLOQUEAR, abra o parecer e corrija a peça.
3. Rode o painel de novo só nas etapas corrigidas. BLOQUEAR pendente = não publica (RC-011).
4. Para página e anúncios que vão escalar, rode uma vez com outro modelo (`--motor barato` ou outra IA) — revisão do mesmo modelo não é independente.
5. Registre: `rex log add --tipo execucao --texto "painel <oferta>: <resultado>"`.

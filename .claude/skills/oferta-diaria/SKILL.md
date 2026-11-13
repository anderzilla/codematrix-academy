---
name: oferta-diaria
description: Roda o ciclo diário da Fábrica de Ofertas (escolher oportunidade, gerar oferta, página, anúncios, aula 1, checklist e revisão). Use quando o usuário pedir "oferta do dia", "rodar o dia" ou "próximo curso".
---

# Oferta diária

1. `rex status` — se o Ollama estiver indisponível, avise e pare (não gere tudo no seu contexto: gasta tokens).
2. `rex oportunidades` — mostre os 3 primeiros; se o usuário não escolher, use o de maior score.
3. `rex dia [--id N]` — gera a pasta em `saidas/`.
4. Leia apenas `oferta.md` e `revisao.md`. Se BLOQUEADO, corrija os trechos apontados e rode `rex revisar <pasta> --tema <tema>`.
5. Entregue ao usuário: nome recomendado, promessa, preço, sobra por venda (`rex conta <preço>`) e o caminho do checklist.
6. Não publique, não suba anúncio, não mexa em preço: isso é do usuário.

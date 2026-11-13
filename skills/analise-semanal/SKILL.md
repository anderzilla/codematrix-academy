---
name: analise-semanal
description: Análise semanal de resultados da Fábrica de Ofertas — onde estamos errando, o que melhorar, onde colocar esforço. Use às segundas ou quando o usuário perguntar como estão as vendas.
---

# Análise semanal

Siga `agentes/dados/analista-de-metricas.md`.
1. `rex sync` (se houver credenciais) e `rex analise --semanal`.
2. `rex decidir` — aplique as decisões: validar (`rex curso`), ajustar (`rex ajustar`), arquivar (`rex arquivar`).
3. `rex custos` — se a IA paga passou de 70% do teto, mude etapas para `local` em `config/settings.yaml`.
4. Entregue: lucro líquido estimado vs. meta, 3 ações da semana, o que parar. Diga quando os dados são poucos.

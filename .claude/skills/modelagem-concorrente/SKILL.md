---
name: modelagem-concorrente
description: Coleta e registra concorrentes de um tema (Hotmart, Kiwify, Biblioteca de Anúncios da Meta) e transforma o padrão do líder em novas oportunidades na fila. Use quando o usuário pedir para pesquisar o que vende num tema.
---

# Modelagem de concorrente

Siga `agentes/pesquisa/pesquisador.md`.
1. Para o tema pedido, encontre 5 produtos líderes (temperatura, vitrine, anúncios ativos há mais tempo).
2. Registre cada um: `rex concorrente add --plataforma ... --nome ... --tema ... --preco ... --promessa "<suas palavras>" --temperatura ... --anuncios ... --fonte ... --data <AAAA-MM-DD>`.
3. Opcional: salve um trecho público da página em `data/referencias/<nome>.txt` (só para a checagem de originalidade).
4. Escreva 3 oportunidades novas que modelam a ESTRATÉGIA do líder com diferenciação (avatar, entregável, prazo, bônus) em um CSV e importe com `rex importar`.
5. Nunca copie texto, nome, marca, aula ou imagem. Nunca colete dados de compradores nem acesse conteúdo pago.

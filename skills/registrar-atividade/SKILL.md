---
name: registrar-atividade
description: Protocolo de início e fim de sessão para qualquer IA que trabalhe nesta pasta — ler o que mudou e registrar o que foi feito. Use SEMPRE ao começar e ao terminar uma tarefa.
---

# Registrar atividade

Ao começar:
1. `rex log ver --n 15` (ou leia o topo de LOG-ATIVIDADES.md).
2. Leia `regras/INDICE.md` (só as linhas; abra a regra se a tarefa tocar nela).

Ao terminar, uma entrada por mudança relevante:
`rex log add --modelo <seu-modelo> --agente <id> --tipo <melhoria|regra|skill|aprendizado|erro|decisao> --texto "o que mudou e por quê" --arquivos a,b`
- Nova regra: `rex regra nova ...` (fica como proposta).
- Nova skill: crie em `skills/<nome>/SKILL.md`, rode `rex sincronizar` e registre com tipo `skill`.
- Errou algo que pode se repetir: tipo `aprendizado` com a correção.

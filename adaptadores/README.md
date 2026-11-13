# Usar o time em qualquer modelo

Fonte única: `agentes/`, `regras/`, `skills/`, `AGENTS.md`. Os arquivos daqui são **gerados** por `rex sincronizar`
(rode sempre que mudar agente, regra ou skill). Todos os modelos leem e escrevem o mesmo `LOG-ATIVIDADES.md`.

| Modelo / ferramenta | Como usa |
|---|---|
| Claude Code | `CLAUDE.md` + `.claude/skills/` (gerado) + MCP `rendaextra` |
| Codex CLI, OpenCode | Leem `AGENTS.md` na raiz automaticamente |
| Antigravity | `AGENTS.md` (se a sua versão não ler, cole `adaptadores/prompts/<agente>.txt`) |
| Gemini CLI | `GEMINI.md` (cópia gerada do AGENTS.md) |
| Grok, ChatGPT, Gemini web | Cole `adaptadores/prompts/<agente>.txt` como instrução do sistema/projeto |
| Ollama | `adaptadores/ollama/criar-modelos.ps1` (ou `.sh` no servidor) cria `cma-<agente>` sobre o modelo de texto do settings |
| Nemotron (via Ollama) | `adaptadores/nemotron/criar-modelos.sh` cria `cma-<agente>-nemo` sobre `nemotron-mini` |

Cada prompt gerado já inclui: o papel do agente, o resumo das regras ativas e as 5 mudanças mais recentes do LOG.

Exemplo no servidor de IA:
```bash
cd adaptadores/ollama && sh criar-modelos.sh
ollama run cma-corretor-revisor "Revise: ..."
```

Ao terminar uma sessão em qualquer modelo, registre no LOG (`rex log add ...` ou à mão, no mesmo formato).

# CodeMatrix Academy — instruções para qualquer IA

Vale para Claude, Codex, Antigravity, OpenCode, Gemini (via `GEMINI.md`), Grok, Ollama e Nemotron
(via `adaptadores/`). Esta pasta é a fábrica de cursos da **CodeMatrix Academy** (sub-marca da CodeMatrix),
vendidos na Kiwify e na Hotmart. Fluxo completo: `FLUXO.md`. Comandos: `README.md`.

## Protocolo de sessão (obrigatório)

**Ao começar**
1. Leia as últimas entradas de `LOG-ATIVIDADES.md` (ou `rex log ver --n 15`): o que mudou, regras novas, skills aprendidas.
2. Leia `regras/INDICE.md`. Abra a regra completa quando a tarefa tocar nela.
3. Carregue só o agente necessário (`agentes/<setor>/<id>.md`) — não o time inteiro.

**Ao terminar**
4. Registre cada mudança relevante:
   `rex log add --modelo <seu-modelo> --agente <id> --tipo <melhoria|regra|skill|aprendizado|erro|decisao> --texto "..."`
   Sem a CLI disponível, escreva a entrada à mão no topo da seção de entradas do LOG, no mesmo formato.
5. Mudou agente, skill ou regra? Rode `rex sincronizar` para atualizar os adaptadores dos outros modelos.

## Regras inegociáveis (resumo — fonte: `regras/`)

1. **RN-001** Nenhuma IA movimenta dinheiro: sem saque, reembolso, compra de mídia, assinatura ou mudança de preço publicado.
2. **RC-001** Modelar a estratégia do líder, nunca copiar conteúdo (originalidade checada por `rex revisar`).
3. **RC-002** Sem promessa de ganho/resultado garantido, cura, recomendação de investimento, escassez falsa ou prova social inventada.
4. **RN-007** Credenciais só no cofre; dados de comprador nunca em prompts, logs ou `kb/`.
5. **RN-008** IA local primeiro (economia de tokens); IA paga só onde `settings.yaml` manda, com teto.
6. **RC-011** Toda peça passa pelos revisores da etapa (`agentes/time.yaml`). Quem produz não revisa. BLOQUEAR impede publicar.
7. Uma IA pode **propor** regra (`rex regra nova`), nunca aprovar. Aprovação é do Founder (Anderson).

## Onde fica cada coisa

| Pasta | Conteúdo |
|---|---|
| `agentes/` | Time por setor + `time.yaml` (quem produz e quem revisa em cada etapa) + `TIME.md` |
| `regras/` | Regras de negócio (RN) e de cursos (RC), `automaticas.yaml`, `INDICE.md` |
| `skills/` | Skills canônicas (fonte única; `rex sincronizar` copia para `.claude/skills/`) |
| `marca/` | Identidade visual CodeMatrix Academy: tokens, cores por tema, templates liquid glass |
| `kb/` | Base de conhecimento do RAG local (mercado, plataformas, compliance, playbooks) |
| `adaptadores/` | Prompts de sistema e Modelfiles (Ollama/Nemotron) gerados para cada agente |
| `rendaextra/` | Aplicação Python (CLI `rex`) |
| `saidas/` | Ofertas, cursos, vídeos e relatórios gerados |
| `LOG-ATIVIDADES.md` | Memória compartilhada entre modelos |

## Código

Python 3.11+. Testes: `pytest -q` (com `REX_LLM_FAKE=1`). Integrações Kiwify/Hotmart são somente leitura;
não adicione endpoints de escrita financeira. Mudanças pequenas, testadas e registradas no LOG.

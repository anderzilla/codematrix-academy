# CodeMatrix Academy — fábrica de cursos (Kiwify e Hotmart)

Kit de ferramentas para **encontrar, modelar, testar, publicar, medir e melhorar** ofertas de cursos,
usando IA local (Ollama) sempre que possível e IA paga só onde ela faz diferença.

> Instalação: extraia esta pasta em `G:\Renda Extra\Ferramentas` e siga o **Passo a passo** abaixo.

---

## Como a fábrica funciona (1 oferta testada por dia)

```
 coletar ──► pontuar ──► modelar ──► produzir ──► revisar ──► publicar ──► medir ──► decidir
 (concor-    (score de    (promessa,   (página,     (compliance  (checklist   (sync      (escalar,
  rentes)     oportun.)    módulos,     anúncios,    + originali- Kiwify/      vendas     ajustar ou
                           preço)       aula 1)      dade)        Hotmart)     via API)   matar)
```

* **Dia D:** a fábrica escolhe a melhor oportunidade da fila, gera a oferta "modelada" no líder
  (estrutura, preço, promessa, bônus, ângulo — **com conteúdo 100% próprio**), a página de pré-venda,
  10 anúncios e o roteiro da aula 1. Você revisa, publica (checklist ~15 min) e divulga.
* **D+3 a D+7:** se a oferta atingir o critério de validação (`config/settings.yaml → validacao`),
  o curso completo é produzido. Se não, a oferta é ajustada uma vez ou arquivada.
* **Toda segunda:** análise semanal: o que vendeu, onde estamos errando, para onde levar o esforço.

Fluxo completo por etapa e por dia: **`FLUXO.md`**. Instruções para qualquer IA: **`AGENTS.md`**.

## O que tem aqui

| Pasta / arquivo | Conteúdo |
|---|---|
| `AGENTS.md` · `CLAUDE.md` · `GEMINI.md` | Instruções para Codex/OpenCode/Antigravity, Claude Code e Gemini CLI |
| `LOG-ATIVIDADES.md` · `log/` | Memória compartilhada entre modelos: melhorias, regras novas, skills, aprendizados |
| `agentes/` | Time de 18 agentes por setor + `time.yaml` (quem produz e quem revisa em cada etapa) + `TIME.md` |
| `regras/` | Regras de negócio (RN) e dos cursos (RC), checagens automáticas, índice |
| `skills/` | Skills canônicas (copiadas para `.claude/skills/` por `rex sincronizar`) |
| `marca/` | Identidade visual CodeMatrix Academy: tokens, cores por tema, fontes, template liquid glass, brand book |
| `adaptadores/` | Prompts e Modelfiles gerados para Grok, ChatGPT/Gemini web, Ollama e Nemotron |
| `rendaextra/` | Aplicação Python (CLI `rex`): banco, roteador de IA, pipeline, time, vídeo, integrações, análise |
| `config/` | `settings.yaml` (modelos, voz, metas, limites), `temas.yaml` |
| `data/` · `kb/` | Fila de oportunidades, concorrentes, base de conhecimento do RAG local |
| `mcp_server/` | Servidor MCP para Claude Desktop/Code |
| `scripts/` | Instalação, agendamento, servidor Ollama |
| `exemplos/aula-demo/` | Vídeo de demonstração 16:9 e 9:16 com legenda (narração simulada) |
| `saidas/` | Tudo o que a fábrica gera |

## Passo a passo (Windows, PowerShell)

1. **Pré-requisitos:** Python 3.11+ e acesso ao Ollama (no próprio PC ou no servidor `anderzilla-rog`).
2. Instale:
   ```powershell
   cd "G:\Renda Extra\Ferramentas"
   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
   ```
3. Ajuste `config\settings.yaml` (endereço do Ollama, nome da marca, limites de gasto de IA paga).
4. **Credenciais** (ficam no Gerenciador de Credenciais do Windows, nunca em arquivo):
   ```powershell
   .venv\Scripts\rex credenciais
   ```
   * **Kiwify:** painel → Apps → API → criar chave → copie `client_id`, `client_secret` e `account_id`.
   * **Hotmart:** `app-vlc.hotmart.com/tools/credentials` → Criar credencial → copie `client_id`,
     `client_secret` e `basic`.
   * **IA paga (opcional):** chave da API Anthropic e/ou OpenAI. Sem ela, tudo roda só no Ollama.
   * Crie as credenciais **com o menor escopo possível** (leitura de vendas/produtos).
5. Teste: `rex status` (mostra Ollama, credenciais, banco).
6. Carregue a base: `rex rag indexar` e `rex importar data\oportunidades_iniciais.csv`.
7. Rode o dia: `rex dia` → revise `saidas\<data>-<oferta>\` → publique seguindo `checklist_publicacao.md`.
8. Agende as rotinas: `scripts\agendar-tarefas.ps1` (sync de vendas 2×/dia e análise semanal).

## Comandos principais

| Comando | O que faz |
|---|---|
| `rex status` | Saúde do ambiente |
| `rex credenciais` | Cadastra/atualiza credenciais no cofre do Windows |
| `rex concorrente add` / `rex importar arquivo.csv` | Registra concorrentes ou oportunidades |
| `rex oportunidades` | Lista a fila ordenada por score |
| `rex dia [--id N]` | Pipeline completo de uma oferta |
| `rex curso <oferta_id>` | Gera o curso completo (só após validação) |
| `rex revisar <pasta>` | Compliance + checagem de originalidade |
| `rex sync` | Puxa vendas da Kiwify e Hotmart (somente leitura) |
| `rex analise [--semanal]` | Relatório: o que vende, onde erramos, onde investir esforço |
| `rex publicar <id> --produto-id X` | Liga a oferta ao produto publicado (para medir vendas) |
| `rex visitas <id> <n>` | Informa visitas da página (para calcular conversão) |
| `rex ajustar <id>` / `rex arquivar <id>` | Aplica a decisão sobre a oferta |
| `rex conta <preço> [--cpa X]` | Sobra por venda, CPA máximo e vendas para a meta |
| `rex decidir` | Aplica as regras de escalar / ajustar / matar em cada oferta |
| `rex rag indexar` / `rex rag buscar "pergunta"` | RAG local com embeddings do Ollama |
| `rex custos` | Gasto de IA paga no mês e economia do cache |
| `rex painel <pasta> [--etapas ...] [--motor ...]` | Time revisa por etapa (economistas, juristas, corretor, compliance) |
| `rex agentes listar` / `rex agentes prompt <id>` | Time e prompt de sistema de cada agente (para colar em qualquer IA) |
| `rex sincronizar` | Atualiza skills, GEMINI.md, prompts e Modelfiles (Ollama/Nemotron) |
| `rex log add ...` / `rex log ver` | Registro de atividades entre modelos |
| `rex regra listar|nova|aprovar|revogar|indice` | Regras de negócio e de cursos |
| `rex marca capa ...` / `rex marca extrair <imagens> --aplicar` | Capas/thumbnails e cores oficiais |
| `rex video status|cenas|previa|render` | Vídeo com narração e legenda (16:9 e `--vertical`) |

## Como economiza tokens

1. **Ollama primeiro:** pesquisa, rascunhos, roteiros, variações de anúncio e resumos rodam local.
2. **IA paga só nas etapas marcadas** em `settings.yaml → roteamento` (por padrão: revisão final da
   copy da página e a análise semanal) e com **teto mensal em US$**.
3. **Cache por hash:** o mesmo prompt nunca é pago duas vezes.
4. **RAG com poucos trechos:** cada etapa recebe só os 3 trechos relevantes da `kb/`, não a base toda.
5. **Janela reservada:** nada pesado roda no servidor entre 00:00 e 06:00 (treino QLoRA).

## Regras que a ferramenta impõe (não desligue)

* **Modelar, não copiar:** a checagem de originalidade bloqueia textos muito parecidos com os
  do concorrente (`rex revisar`). Ideia e estrutura podem ser modeladas; texto, aula, nome, marca e
  imagens de terceiros, não.
* **Sem promessa de ganho garantido, cura, "fique rico", escassez falsa ou depoimento inventado.**
* **Dinheiro só você movimenta:** as integrações não têm saque, reembolso, compra de mídia nem
  alteração de preço. Anúncios são gerados como texto/roteiro; quem sobe e paga é você.
* **Credenciais fora de arquivos e fora de prompts.** Logs mascaram e-mail e CPF de compradores.

## O que ainda é manual (e por quê)

* **Cadastro do produto e upload das aulas** na Kiwify/Hotmart: as APIs públicas não criam produto
  nem sobem conteúdo. Automatizar pelo navegador pode violar os termos e bloquear a conta.
* **Coleta de dados de concorrentes** (temperatura Hotmart, vitrine Kiwify, Biblioteca de Anúncios
  da Meta): feita por você ou pelo Claude no navegador, registrada com `rex concorrente add`.
* **Voz:** a narração local (Kokoro/Piper) exige baixar o modelo de voz uma vez; Azure/ElevenLabs exigem conta e teto
  aprovados por você. Sem nenhum, `--voz silencio` gera o vídeo com legenda e sem áudio, para revisar o visual.

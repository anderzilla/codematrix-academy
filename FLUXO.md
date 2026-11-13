# Fluxo da CodeMatrix Academy

Da oportunidade ao dinheiro na conta, com o time revisando cada etapa. Ritmo: **1 oferta testada por dia** (RN-003).

```
 1 PESQUISA ─► 2 OFERTA ─► 3 CONTEÚDO ─► 4 VISUAL/VÍDEO ─► 5 PÁGINA ─► 6 CAMPANHA ─► 7 VENDA ─► 8 GATE ─► publicar ─► 9 ANÁLISE
   pesquisador  estrategista  roteirista     imagem +          redator     publicitário  vendas      jurista     Founder     analista
                              redator        audiovisual       publicitário mkt digital              compliance
                                                                            tráfego
   rev: econ.   rev: econ.×2  rev: corretor  rev: corretor     rev: corretor rev: jurista  rev: econ.  (gate)                rev: econ.
   vendas       + jurista                                      + jurista     + corretor    vendas                            negócios
```

## Dia D (oferta nova)
| Hora | Etapa | Comando / quem | Saída |
|---|---|---|---|
| 08:40 | Sync automático | agendador | vendas atualizadas |
| 09:00 | Escolher oportunidade | `rex oportunidades` · Founder | id da oferta |
| 09:05 | 2–6 Gerar oferta, página, aula 1, anúncios, mensagens + painel do time | `rex dia --id N` (Ollama) | `saidas/<data>-<slug>/` |
| 09:30 | Ler pareceres e corrigir | Founder + `rex painel <pasta> --etapas ...` | pareceres APROVADO |
| 10:00 | Vídeo da aula 1 e criativo vertical | `rex video cenas aula1.md --tema X` → `previa` → `render` (+ `--vertical`) | `video.mp4`, `legendas.srt`, thumbnail |
| 10:40 | Capa do produto | `rex marca capa --titulo ... --tema X` | capa 1:1 |
| 11:00 | 8 Gate de publicação | `rex painel <pasta> --etapas publicacao --motor barato` | APROVADO |
| 11:15 | Publicar na Kiwify/Hotmart | Founder, `checklist_publicacao.md` | produto no ar |
| 11:30 | Registrar | `rex publicar <id> --produto-id X` · `rex log add ...` | oferta ligada às vendas |
| tarde | 6 Divulgação | vídeo curto, stories, WhatsApp/e-mail, parceiros | tráfego orgânico |

## D+1 a D+7 — validação
- `rex visitas <id> <n>` com as visitas da página (Kiwify/Hotmart/Analytics).
- `rex decidir` diz: VALIDAR → `rex curso <id>` + vídeos de todos os módulos; AJUSTAR → nova promessa (1 vez); ARQUIVAR.

## Curso validado (produção)
1. `rex curso <id>` → roteiros e slides de cada módulo (`curso/`).
2. Corretor revisa os roteiros (`rex painel <pasta>/curso --etapas conteudo`).
3. Para cada roteiro: `rex video cenas` → `previa` → `render`. Subir vídeo + `.srt` na área de membros.
4. Liberar o curso na data prometida (RC-004).

## Toda segunda — melhoria contínua
1. `rex analise --semanal` (analista + economista de negócios): onde estamos errando, o que melhorar, onde pôr esforço.
2. Erro que se repetiu → `rex regra nova` (proposta) → Founder aprova.
3. Skill nova aprendida → `skills/<nome>/SKILL.md` + `rex sincronizar` + `rex log add --tipo skill`.
4. `rex custos`: IA paga e narração dentro do teto.

## Trocar de modelo no meio do caminho
Qualquer IA (Claude, Codex, Gemini, Grok, Ollama, Nemotron) começa lendo `AGENTS.md` → últimas entradas do
`LOG-ATIVIDADES.md` → `regras/INDICE.md`, e termina registrando no LOG. Assim o próximo modelo sabe o que foi feito,
quais regras surgiram e quais skills foram aprendidas.

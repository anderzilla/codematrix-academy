# LOG DE ATIVIDADES — CodeMatrix Academy

Memória compartilhada entre todos os modelos que trabalham nesta pasta (Claude, Codex, Gemini, Grok,
Ollama, Nemotron...). **Leia as entradas mais recentes antes de começar. Registre o que mudou ao terminar.**

Formato de cada entrada:
`### AAAA-MM-DD HH:MM · tipo · modelo · agente` + texto + arquivos.
Tipos: melhoria · regra · skill · aprendizado · erro · decisao · execucao (execuções rotineiras ficam só em `log/atividades.jsonl`).

Comando: `rex log add --modelo <modelo> --agente <id> --tipo <tipo> --texto "..." [--arquivos a,b]`

<!-- ENTRADAS: novas entradas são inseridas logo abaixo desta linha -->

### 2026-11-13 13:32 · decisao · claude-opus-5-5 · estrategista-oferta
Founder definiu o modelo Pocket (barato, venda rápida, gera curiosidade) → Completo (mais caro, mais recursos) e sprint de 2 dias por curso com 5 passos. RN-003 atualizada. Roteiro a partir de 16/11 em planos/ROTEIRO-2026-11-16.md (ordem: Finanças, Produto digital, WhatsApp, App com IA; Black Friday 27–30/11).
Arquivos: planos/ROTEIRO-2026-11-16.md, regras/negocio/RN-003.md


### 2026-11-13 13:16 · skill · claude-opus-5-5 · especialista-marketing-de-imagem
Manual da marca, identidade visual e personagens gerado por scripts/gerar_manual.py (marca/manual/*.html e .pdf); regenerar sempre que mudar tokens, ilustrações ou poses.


### 2026-11-13 13:16 · aprendizado · claude-opus-5-5 · especialista-marketing-de-imagem
Personagens de terceiros (ex.: EVE, Disney/Pixar) não podem ser usados nem imitados; pedido de 'baseado em' foi atendido elevando a qualidade (porcelana brilhante, luz de estúdio, LED) com design próprio. Manter olhos de pixels no Trix e no Pixel — é o que os diferencia.


### 2026-11-13 13:16 · regra · claude-opus-5-5 · especialista-marketing-de-imagem
RC-012 (títulos com verbo de ação + subtítulo com 4–6 entregáveis) e RC-013 (personagens e ilustrações padronizados) — ativas por pedido do Founder.


### 2026-11-13 13:16 · decisao · claude-opus-5-5 · especialista-marketing-de-imagem
Founder pediu títulos com ação e subtítulos detalhados; fila de oportunidades reescrita (data/oportunidades_iniciais.csv) e regra RC-012 criada como ativa.


### 2026-11-13 13:16 · melhoria · claude-opus-5-5 · especialista-marketing-de-imagem
Ilustrações por trilha (marca/ilustracoes) e personagens próprios Trix (9 poses) e Pixel (3 expressões) em marca/personagens, gerados por scripts/gerar_ilustracoes.py; template de cena aceita 'personagem' e 'ilustracao' e encaixa títulos longos automaticamente.


### 2026-11-13 12:40 · melhoria · claude-opus-5-5
v0.2: projeto renomeado para CodeMatrix Academy (RN-004). Time de 18 agentes por setor e etapa (`agentes/`, `agentes/time.yaml`), painel de revisão automático no `rex dia` (`rex painel`), pasta `regras/` (RN-001..009, RC-001..011, `automaticas.yaml`), log de atividades, adaptadores para Codex/Gemini/Grok/Ollama/Nemotron (`rex sincronizar`), identidade visual liquid glass (`marca/`), pipeline de vídeo com narração e legenda (`rex video`).
Arquivos: agentes/, regras/, marca/, skills/, adaptadores/, rendaextra/video/, FLUXO.md

### 2026-11-13 12:40 · decisao · claude-opus-5-5
Founder definiu: nome CodeMatrix Academy; time com publicidade, redação, revisão, economia de vendas e de negócios, marketing digital e de imagem, jurídico de internet e vendas online; logs para troca de modelos; identidade baseada no site e nas capas light-glass dos guias de IA; vídeos com narração de alta qualidade e legenda.

### 2026-11-13 12:40 · aprendizado · claude-opus-5-5
Cores oficiais do site não puderam ser lidas de fora (imagens e CSS bloqueados para a ferramenta). `marca/tokens.json` está com paleta PROVISÓRIA. Rode `rex marca extrair` com o logo e as capas *-light-glass do site para trocar pelos valores reais.

### 2026-11-13 12:40 · skill · claude-opus-5-5
Skills criadas: oferta-diaria, modelagem-concorrente, revisao-compliance, analise-semanal, painel-revisao, video-aula, identidade-visual, registrar-atividade, nova-regra.

### 2026-11-13 11:40 · melhoria · claude-opus-5-5
v0.1: Fábrica de Ofertas — CLI `rex`, SQLite, roteador de IA (Ollama primeiro, cache, teto), integrações Kiwify/Hotmart somente leitura, compliance + originalidade, pipeline de 1 oferta por dia, análise semanal, MCP.

### 2026-11-13 11:20 · decisao · claude-opus-5-5
Founder escolheu: temas IA, marketing digital, renda extra, desenvolvimento pessoal/finanças; ritmo de 1 oferta testada por dia; modelar a estratégia dos mais vendidos sem copiar conteúdo.

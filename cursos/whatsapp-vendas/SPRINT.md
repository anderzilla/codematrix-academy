# Sprint — Aumente suas vendas usando o WhatsApp

Dia 1: **2026-11-23** · Dia 2: **2026-11-24** · Tema: `marketing` · Pasta: `cursos/whatsapp-vendas/`

## Dia 1
- [ ] 08:30 **Passo 1 — Analisar e organizar**: top 5 concorrentes (`rex concorrente add ... --tema marketing`), revisar `curso.yaml`
- [ ] 09:30 **Passo 2 — Marketing e publicidade**: conceito, ganchos, calendário → `marketing/`
- [ ] 10:30 Painel do time: `rex painel cursos/whatsapp-vendas --etapas oferta,campanha`
- [ ] 11:00 **Passo 3a — Pocket**: roteiros em `pocket/roteiros/`, cenas em `pocket/cenas/`
- [ ] 13:30 Prévia: `rex video previa cursos/whatsapp-vendas/pocket/cenas/aula-01.json` → olhar 3 quadros
- [ ] 14:00 Render das aulas: `rex video render ...` (16:9) · materiais e quiz do Pocket
- [ ] 17:30 `rex salvar -m "whatsapp-vendas: pocket pronto"` · `rex log add ...`

## Dia 2
- [ ] 08:30 **Passo 3b — Completo**: módulos 1 e 2 renderizados; roteiros dos demais com datas de liberação
- [ ] 12:30 **Passo 3c — Kiwify**: seguir `kiwify/montagem.md`
- [ ] 13:30 **Passo 4 — Retenção**: adaptar `retencao/` (jornada D0–D30, avaliação, cupons) e públicos de remarketing
- [ ] 15:00 Gate: `rex painel cursos/whatsapp-vendas --etapas pagina,publicacao --motor barato` + leitura do Founder
- [ ] 16:00 **Passo 5 — Publicar e divulgar**: produtos no ar, vídeo vertical (`--vertical`), stories, lista, parceiros
- [ ] 17:30 `rex salvar -m "whatsapp-vendas: publicado"` · `rex log add --tipo decisao ...`

**Regra de corte:** se às 13:00 do dia 2 o módulo 1 do Completo não estiver pronto, publicar só o Pocket e o Completo em pré-venda com data (RC-004).

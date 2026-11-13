# Segunda, 16/11/2026 — dia 1 do curso 1 (Finanças da família)

> Abra este arquivo de manhã. Tudo que dá para adiantar já está em `cursos/financas-familia/`.
> Comando do dia a qualquer hora: `rex sprint hoje`

## 07:30–08:30 — Preparação (uma vez só)
- [ ] `git clone https://github.com/anderzilla/codematrix-academy "G:\Renda Extra\Ferramentas"` (ou `git pull` se já clonou)
- [ ] `powershell -ExecutionPolicy Bypass -File scripts\segunda-setup.ps1` — instala, testa IA local, voz e render
- [ ] Decisões de domingo registradas: preços, teto de anúncio, voz, ferramenta de e-mail, perfis (`planos/ROTEIRO-2026-11-16.md` §7)
- [ ] Logo e capas oficiais em `marca/referencias` → `rex marca extrair marca/referencias/* --aplicar` → `python scripts/gerar_manual.py`

## O que já está pronto para o curso 1
| Item | Onde | Falta |
|---|---|---|
| Estrutura do Pocket e do Completo, preços propostos, bump, bônus | `curso.yaml` | sua aprovação |
| Roteiros das 5 aulas do Pocket | `pocket/roteiros/` | revisar a fala |
| Cenas das 5 aulas (vídeo animado de ~1–2 min cada) | `pocket/cenas/` | render com voz |
| Planilha Pocket e planilha Completa (fórmulas testadas) | `pocket/materiais/`, `completo/materiais/` | gravar a tela usando-as |
| Quiz do Pocket | `pocket/quizzes/quiz.yaml` | cadastrar na Kiwify |
| Copy das páginas Pocket e Completo, página de obrigado | `paginas/` | painel do time |
| Capas 1:1 do Pocket e do Completo | `paginas/capa-*.png` | — |
| Anúncios, ganchos, calendário de 7 dias | `marketing/` | painel do time |
| Jornada D0–D30, avaliação, remarketing | `retencao/` | ligar à ferramenta de e-mail |
| Checklist de montagem na Kiwify | `kiwify/montagem.md` | executar no dia 2 |

## Como fica cada aula do Pocket
Vídeo animado da Academy (Trix + legenda, `rex video render`) **+** gravação de tela de 4–6 min usando a planilha
(OBS ou o gravador do Windows), narrada por você ou pela voz escolhida. Os dois vão como aulas da mesma seção.

## Dia 1 — horário
- [ ] 08:30 Passo 1: `rex concorrente add` para 5 concorrentes de finanças pessoais (Hotmart/Kiwify/Biblioteca de Anúncios)
- [ ] 09:30 Passo 2: revisar `marketing/anuncios.md` e o calendário; escolher o conceito
- [ ] 10:30 `rex painel cursos/financas-familia --etapas oferta,campanha` → corrigir AJUSTAR/BLOQUEAR
- [ ] 11:00 Revisar roteiros → `rex video previa cursos/financas-familia/pocket/cenas/aula-01.json`
- [ ] 12:00 Render das 5 aulas: `rex video render cursos/financas-familia/pocket/cenas/aula-0N.json` (N = 1..5)
- [ ] 14:00 Gravar as 5 telas da planilha (4–6 min cada)
- [ ] 17:00 Corretor revisa legendas (`pocket/videos/*/legendas.srt`)
- [ ] 17:30 `rex salvar -m "financas-familia: pocket pronto"` e `rex log add --modelo <modelo> --tipo execucao --texto "..."`

Amanhã (dia 2): `rex sprint hoje --data 2026-11-17`.

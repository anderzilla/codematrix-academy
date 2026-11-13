---
name: sprint-curso
description: Executa o sprint de 2 dias de um curso da CodeMatrix Academy (Pocket + Completo) seguindo o roteiro de lançamento. Use quando o usuário pedir "o que fazer hoje", "começar o curso X" ou "sprint".
---

# Sprint de curso (2 dias, 5 passos)

1. `rex sprint hoje` (ou `--data AAAA-MM-DD`) — mostra o checklist do dia; a fonte é `cursos/<id>/SPRINT.md`.
2. Trabalhe só dentro de `cursos/<id>/`: `curso.yaml` (estrutura e preços propostos), `pocket/` e `completo/`
   (roteiros, cenas, vídeos, materiais, quizzes), `paginas/`, `marketing/`, `retencao/`, `kiwify/`.
3. Revisões: `rex painel cursos/<id> --etapas ...` e `rex revisar cursos/<id> --tema <tema>`.
4. Vídeos: `rex video previa|render cursos/<id>/pocket/cenas/aula-0N.json` → saem em `pocket/videos/aula-0N-16x9/`.
5. Ao fim de cada bloco: `rex salvar -m "<id>: <o que foi feito>"` e `rex log add ...`.
6. Preços em `curso.yaml` são propostas; publicar, cobrar e gastar só com aprovação do Founder (RN-001).
7. Regra de corte: sem o módulo 1 do Completo às 13:00 do dia 2 → publicar só o Pocket e o Completo em pré-venda com data.

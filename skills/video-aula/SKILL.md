---
name: video-aula
description: Transforma um roteiro de aula ou anúncio em vídeo CodeMatrix Academy com narração, legenda e visual liquid glass (16:9 ou 9:16). Use quando o usuário pedir vídeo de aula, corte ou criativo em vídeo.
---

# Vídeo de aula

Siga `agentes/produto-conteudo/diretor-audiovisual.md` e `marca/README.md`.
1. `rex video cenas <roteiro.md> --tema <ia|marketing|renda|pessoal>` → gera `cenas.json`. Revise: 1 ideia por cena, máx. 4 itens, narração natural.
2. `rex video previa <cenas.json>` → 3 quadros em `previa/`. Olhe os quadros (o mais cheio, o de código, o CTA) antes de seguir.
3. `rex video render <cenas.json> [--vertical] [--voz kokoro|azure|elevenlabs|piper]` → `video.mp4` + `legendas.srt`.
4. Corretor-revisor confere o texto das legendas (`legendas.srt`).
5. Voz paga (Azure/ElevenLabs) só com conta e teto aprovados pelo Founder (RN-001, RC-009).

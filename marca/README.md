# CodeMatrix Academy — identidade visual

> **Manual completo** (marca, identidade visual, imagens e personagens): `marca/manual/manual-codematrix-academy.html` e `.pdf`.
> Gerado por `python scripts/gerar_manual.py`. Ilustrações e personagens: `python scripts/gerar_ilustracoes.py` (RC-013).

Sub-marca de cursos da CodeMatrix. Mesma família visual do site e das capas *light glass* dos guias de IA
(ChatGPT, Claude, Gemini, Grok na prática): fundo claro, vidro fosco translúcido, esferas de vidro líquido,
cor como luz atrás do vidro — nunca como bloco chapado.

> **Status das cores: PROVISÓRIO.** As cores oficiais do site não puderam ser lidas daqui.
> Rode no seu PC, com o logo e as capas do site:
> ```
> rex marca extrair marca/referencias/codematrix-logo-wordmark-matrix-blue.png marca/referencias/*-light-glass-*.webp --aplicar
> ```
> e coloque o logo oficial em `marca/logo.png` (ele substitui o wordmark de texto em todas as peças).

## 1. Princípios
1. **Claro e respirado.** Fundo claro, muito espaço, 1 ideia por tela.
2. **Vidro em camadas.** Painel de vidro principal + esferas de vidro líquido que avançam sobre a borda do painel (profundidade).
3. **A cor é o tema.** Cada tema tem uma cor; ela aparece na luz de fundo, nas esferas, no destaque do título e nos números. Nunca duas cores de tema na mesma peça.
4. **Tipografia forte.** Títulos grandes em Inter Display ExtraBold; uma palavra-chave destacada com o gradiente do tema (`*palavra*` no texto).
5. **Legível no celular.** Texto mínimo de 26 px em 1080 de largura; contraste AA para texto.

## 2. Cores
| Uso | Hex (provisório) |
|---|---|
| Primária CodeMatrix (Matrix Blue) | `#1F5EFF` |
| Tinta (títulos) | `#0B1530` |
| Texto | `#0F172A` · suave `#475569` |
| Fundo | `#F3F6FF` |

| Tema | Acento (luz/esferas) | Secundária | Tinta (texto/botão, AA) |
|---|---|---|---|
| IA e Tecnologia | `#1F5EFF` | `#22D3EE` | `#1846D1` |
| Marketing e Vendas | `#FF3D7F` | `#FF8A3D` | `#C81E5B` |
| Renda Extra e Negócios | `#10B981` | `#A3E635` | `#047857` |
| Desenvolvimento e Finanças | `#8B5CF6` | `#F5A524` | `#6D28D9` |

Regra: texto colorido usa sempre a coluna **Tinta**; Acento e Secundária só em luz, esfera e gradiente.

## 3. Tipografia (fontes OFL incluídas em `fontes/`)
- Display: **Inter Display** 700/800 — títulos, números grandes.
- Texto: **Inter** 400–700 — corpo, itens, legendas.
- Código: **JetBrains Mono** 400/700.
- Escala 16:9 (1920 px): hero 112 · h1 96 · h2 66 · corpo 38–40 · rótulo 22–26 · legenda 50.

## 4. Vidro (receita)
- Painel: gradiente branco 68% → 30%, `backdrop-filter: blur(28px) saturate(1.6)`, borda 1,5 px branca 80%,
  brilho interno no topo, sombra longa e suave, raio 40 px.
- Esferas: brilho especular no canto superior esquerdo, cor do tema embaixo, sombra colorida. Uma grande sobre a quina
  superior direita do painel, uma pequena na borda, uma secundária no canto inferior esquerdo.
- Fundo: duas luzes desfocadas (acento e secundária) + grade "matrix" a 7% de opacidade, mascarada.

## 5. Peças e formatos
| Peça | Formato | Comando |
|---|---|---|
| Aula (slides e vídeo) | 16:9 1920×1080 | `rex video render cenas.json` |
| Reels, TikTok, Stories, anúncio vertical | 9:16 1080×1920 | `rex video render cenas.json --vertical` |
| Capa do produto (Kiwify/Hotmart) | 1:1 1080×1080 | `rex marca capa --titulo "..." --tema ia` |
| Feed / anúncio estático | 4:5 1080×1350 | `--formato 4x5` |
| Thumbnail YouTube / aula | 1280×720 | `--formato thumb` |

Tipos de cena: capa · secao · topicos (máx. 4) · passo · codigo · destaque · comparacao · cta.

## 6. Vídeo, narração e legenda
- 30 fps, H.264 CRF 18, áudio AAC 192 kbps, loudness −16 LUFS.
- Transição: fade de 0,3 s pela cor de fundo; empurrão lento de 4% por cena (desligue com `--parado`).
- Legenda: Inter SemiBold branca em caixa tinta translúcida; máx. 2 linhas × 42 caracteres (30 no vertical);
  `.srt` sempre entregue para a área de membros.
- Voz: uma voz por curso. Local: Kokoro (Apache-2.0) ou Piper. Premium: Azure Neural ou ElevenLabs (conta e teto aprovados pelo Founder).

## 7. Imagens e personagens
- Ilustração por trilha em `ilustracoes/` (capas, thumbnails e CTA usam automaticamente).
- Personagens em `personagens/`: **Trix** (guia, 9 poses) e **Pixel** (ajudante, 3 expressões). Em `cenas.json`: `"personagem": "trix-alerta"`.
- Assinaturas do Trix: olhos e boca de pixels, painel 3×3 no peito, fones e cotovelos na cor da trilha, antena com orbe, pés escuros com faixa, acabamento de porcelana brilhante.
- Nunca usar ou imitar personagens de terceiros.

## 8. Não fazer
- Logo, personagem, print ou imagem de terceiros; fotos de pessoas reais sem autorização.
- Fundo escuro chapado com vidro (perde a assinatura *light glass*).
- Mais de 4 itens por tela; texto corrido longo na tela (o detalhe vai na narração).
- Prometer ganho na peça (RC-002).

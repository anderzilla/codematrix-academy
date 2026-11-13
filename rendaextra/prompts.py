"""Prompts do pipeline. Curtos e com formato fixo: modelos locais rendem melhor assim."""

REGRAS = (
    "Regras: escreva em português do Brasil. Conteúdo 100% original: use concorrentes apenas como referência "
    "de estratégia (formato, preço, estrutura, ângulo), nunca reproduza frases, nomes ou marcas deles. "
    "Proibido: prometer ganho ou resultado garantido, valores de faturamento, cura, recomendação de investimento, "
    "escassez falsa, depoimentos ou números inventados. Prometa habilidade e entregável concreto."
)

OFERTA = """Modele uma oferta de curso para testar em pré-venda.

Oportunidade:
- Tema: {tema}
- Título provisório: {titulo}
- Subtítulo provisório: {subtitulo}
- Avatar: {avatar}
- Dor: {dor}
- Promessa provisória: {promessa}
- Preço alvo: R$ {preco}
- Formato: {formato}
- Marca/autor: {marca} ({autor}) — tom: {tom}
- Vantagem do autor: {vantagem}

O que os líderes deste tema fazem (referência de ESTRATÉGIA, não de texto):
{concorrentes}

Contexto da base de conhecimento:
{contexto}

{regras}

Responda SOMENTE em Markdown com exatamente estas seções:
## Nome do curso (3 opções, marque a recomendada)
Regra RC-012: cada título começa com verbo de ação no imperativo (Crie, Organize, Aumente, Domine, Automatize...)
ou com "Como ..." e diz o resultado concreto; até 70 caracteres. Cada um vem com um subtítulo de 1 frase que lista
4 a 6 entregáveis específicos do curso (ex.: "contas a pagar, reserva de emergência, metas e plano de aposentadoria").
## Avatar e momento de compra
## Dor principal e 5 dores secundárias
## Promessa (1 frase, habilidade + entregável + prazo realista)
## Por que agora
## Módulos (4 a 7, cada um com título e 3 aulas)
## Bônus (2 a 3, que custam pouco para produzir)
## Preço, ancoragem e order bump
## Garantia
## Objeções e respostas (5)
## Para quem NÃO é
## Diferencial frente aos líderes
## Riscos desta oferta
"""

PAGINA = """Escreva a copy da página de PRÉ-VENDA a partir da oferta abaixo.
A aula 1 é liberada na hora; o curso completo na data informada.

{oferta}

{regras}

Responda SOMENTE em Markdown com estas seções e nesta ordem:
# (headline — verbo de ação + resultado concreto, regra RC-012)
### (subheadline — 4 a 6 entregáveis específicos)
## Para quem é
## O que você vai conseguir fazer
## Como funciona a pré-venda
## Conteúdo do curso
## Bônus
## Quem ensina
## Investimento
## Garantia
## Perguntas frequentes
## Para quem não é
"""

REVISAO_COPY = """Revise a copy abaixo para conversão e conformidade. Mantenha a estrutura de seções.
Corte exageros, deixe cada promessa verificável, remova qualquer coisa que pareça promessa de ganho,
deixe as frases mais curtas e concretas. Devolva SOMENTE a copy revisada em Markdown.

{regras}

{copy}
"""

ANUNCIOS = """Crie peças de anúncio para a oferta abaixo (Meta/TikTok/Reels).

{oferta}

{regras}
Evite atributos pessoais ("você que está endividado"). Prefira mostrar processo e resultado concreto.

Responda em Markdown:
## 10 ganchos (até 12 palavras cada)
## 3 roteiros de vídeo curto (30–45s: gancho, demonstração, CTA; indique o que aparece na tela)
## 5 textos de anúncio (primário até 125 caracteres + título até 40)
## 3 sequências de stories (3 telas cada)
## Público e teste sugerido (sem orçamento; só estrutura do teste A/B)
"""

AULA = """Escreva o roteiro da aula "{aula}" do curso abaixo. Duração alvo: {minutos} minutos.

Curso:
{oferta}

{regras}

Responda em Markdown:
## Objetivo da aula (o que a pessoa sabe fazer ao final)
## Roteiro (blocos com tempo, fala e o que aparece na tela)
## Demonstração prática passo a passo
## Exercício
## Erros comuns
## Gancho para a próxima aula
"""

SLIDES = """Converta o roteiro abaixo em slides no formato Marp (Markdown com --- entre slides).
No máximo 12 slides, poucas palavras por slide, 1 ideia por slide. Comece com:
---
marp: true
theme: default
paginate: true
---

{roteiro}
"""

MENSAGENS = """Escreva a sequência de divulgação da pré-venda abaixo:
## WhatsApp (3 mensagens: anúncio, lembrete, último dia real)
## E-mail (3 e-mails com assunto)
## Post de lançamento (legenda Instagram/LinkedIn)

{oferta}

{regras}
"""

ANALISE = """Você é o analista da fábrica de ofertas. Analise os números agregados abaixo (sem dados pessoais).
Meta: R$ {meta} de lucro líquido por mês.

{dados}

Responda em Markdown, direto e honesto:
## Onde estamos errando (com evidência nos números)
## O que melhorar nesta semana (no máximo 3 ações, em ordem de impacto)
## Onde colocar esforço (temas/ofertas para escalar) e o que parar
## O que precisamos medir melhor
"""

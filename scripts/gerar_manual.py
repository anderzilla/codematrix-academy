"""Gera o Manual da CodeMatrix Academy (marca, identidade visual, imagens e personagens).

Saídas: marca/manual/manual-codematrix-academy.html (autocontido) e .pdf.
Tudo vem de marca/tokens.json, marca/ilustracoes, marca/personagens e do template de cenas,
então rodar de novo depois de mudar a marca atualiza o manual. Uso: python scripts/gerar_manual.py
"""
from __future__ import annotations

import base64
import html
import io
import json
import sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
sys.path.insert(0, str(RAIZ / "scripts"))

from rendaextra import marca  # noqa: E402
from gerar_ilustracoes import POSES  # noqa: E402

T = marca.tokens()
TEMAS = T["temas"]
SAIDA = RAIZ / "marca" / "manual"


def jpg(png: Path, largura: int) -> str:
    from PIL import Image
    im = Image.open(png).convert("RGB")
    im.thumbnail((largura, largura * 3))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=86, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def svg_tema(caminho: Path, tema: str) -> str:
    t = TEMAS[tema]
    return (f'<div class="svgbox" style="--acento:{t["acento"]};--sec:{t["secundaria"]};--tintaTema:{t["tinta"]};'
            f'--ink:{T["marca"]["tinta"]}">{caminho.read_text(encoding="utf-8")}</div>')


def renders() -> dict[str, str]:
    tmp = SAIDA / "_render"
    tmp.mkdir(parents=True, exist_ok=True)
    exemplos = {
        "capa-ia": ({"tipo": "capa_produto", "titulo": "Crie seu primeiro *aplicativo móvel* com IA como um profissional",
                     "subtitulo": "Da ideia à publicação nas lojas: telas, navegação, dados e testes, com a IA como copiloto.", "selo": "Curso", "tema": "ia"}, "1x1"),
        "capa-marketing": ({"tipo": "capa_produto", "titulo": "Aumente suas vendas usando o *WhatsApp*",
                            "subtitulo": "Catálogo, respostas rápidas, etiquetas, follow-up e mensagens automáticas.", "selo": "Curso", "tema": "marketing"}, "1x1"),
        "capa-renda": ({"tipo": "capa_produto", "titulo": "Como criar seu primeiro *produto digital* do jeito certo",
                        "subtitulo": "Tema, validação, criação com IA, página de vendas e publicação.", "selo": "Curso", "tema": "renda"}, "1x1"),
        "capa-pessoal": ({"tipo": "capa_produto", "titulo": "Organize as *finanças da família* em planilhas",
                          "subtitulo": "Contas a pagar, reserva de emergência, metas, dívidas e aposentadoria.", "selo": "Curso", "tema": "pessoal"}, "1x1"),
        "aula-capa": ({"tipo": "capa", "eyebrow": "Módulo 1 · Aula 1", "titulo": "Crie seu primeiro *aplicativo móvel* com IA",
                       "subtitulo": "Hoje: ideia em uma frase, tela inicial e primeiro teste no celular.", "tema": "ia",
                       "rotulo": "CodeMatrix Academy", "total": 8, "indice": 1}, "16x9"),
        "aula-alerta": ({"tipo": "topicos", "titulo": "Erros que *travam* o seu app", "itens": ["Pedir o app inteiro de uma vez", "Aceitar código sem ler",
                         "Pular o teste no celular"], "personagem": "trix-alerta", "tema": "ia", "rotulo": "Aula 1 · Erros comuns", "total": 8, "indice": 5}, "16x9"),
        "aula-codigo": ({"tipo": "codigo", "titulo": "Peça à IA a *estrutura* do app", "codigo": "npx create-expo-app meu-app\ncd meu-app\nnpx expo start",
                         "tema": "ia", "rotulo": "Aula 1 · Mão na massa", "total": 8, "indice": 4}, "16x9"),
        "aula-comparacao": ({"tipo": "comparacao", "titulo": "Atendimento no *WhatsApp*", "esquerda": {"titulo": "No improviso", "itens": ["Resposta demora", "Cliente esquece", "Venda se perde"]},
                             "direita": {"titulo": "Com rotina", "itens": ["Respostas rápidas", "Follow-up agendado", "Catálogo à mão"]}, "tema": "marketing", "rotulo": "Aula 2", "total": 6, "indice": 2}, "16x9"),
        "vertical": ({"tipo": "passo", "numero": 2, "titulo": "Separe as *contas fixas*", "texto": "Aluguel, luz, internet e escola primeiro; o que sobra vira meta e reserva.",
                      "personagem": "trix-explica", "tema": "pessoal", "rotulo": "Reels · Finanças", "total": 6, "indice": 2}, "9x16"),
        "thumb": ({"tipo": "thumb", "titulo": "Venda mais pelo *WhatsApp*", "tema": "marketing"}, "thumb"),
    }
    out = {}
    with marca.navegador() as b:
        for nome, (cena, fmt) in exemplos.items():
            p = tmp / f"{nome}.png"
            marca.render(cena, p, fmt, sem_legenda=fmt != "16x9", browser=b)
            out[nome] = jpg(p, {"1x1": 640, "16x9": 1100, "9x16": 420, "thumb": 760}[fmt])
    return out


CSS = """
:root{--ink:#0B1530;--txt:#0F172A;--suave:#475569;--linha:#E2E8F0;--fundo:#F6F8FD;--azul:#1F5EFF}
*{box-sizing:border-box}
body{margin:0;background:var(--fundo);color:var(--txt);font:16px/1.65 Inter,system-ui,sans-serif}
.capa{min-height:92vh;display:flex;flex-direction:column;justify-content:flex-end;padding:72px 7vw;
  background:radial-gradient(60% 70% at 85% 10%,rgba(31,94,255,.35),transparent 70%),radial-gradient(50% 60% at 0% 100%,rgba(34,211,238,.30),transparent 70%),linear-gradient(160deg,#fff,#EEF3FF)}
.capa .marca{display:flex;align-items:center;gap:14px;font-weight:700;font-size:22px;color:var(--ink);margin-bottom:auto}
.glifo{width:40px;height:40px;border-radius:11px;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:8px;background:linear-gradient(140deg,#1F5EFF,#0F3BB3)}
.glifo i{background:#fff;border-radius:2px}.glifo i:nth-child(2n){opacity:.45}
.capa h1{font-size:clamp(44px,7vw,92px);line-height:1;letter-spacing:-.035em;margin:0 0 18px;color:var(--ink);font-weight:800}
.capa p{font-size:20px;color:var(--suave);max-width:44em;margin:0}
.capa .partes{display:flex;gap:12px;flex-wrap:wrap;margin-top:34px}
.capa .partes a{padding:12px 20px;border-radius:999px;background:rgba(255,255,255,.75);border:1px solid #fff;color:var(--ink);text-decoration:none;font-weight:600;box-shadow:0 10px 30px -14px rgba(15,23,42,.35)}
main{max-width:1180px;margin:0 auto;padding:40px 6vw 120px}
.parte{margin-top:90px;padding-top:30px;border-top:2px solid var(--ink)}
.parte>.num{font:700 13px/1 Inter;letter-spacing:.16em;text-transform:uppercase;color:var(--azul)}
.parte>h2{font-size:48px;line-height:1.05;letter-spacing:-.03em;margin:10px 0 8px;color:var(--ink)}
.parte>.lead{font-size:19px;color:var(--suave);max-width:46em}
h3{font-size:26px;letter-spacing:-.015em;margin:56px 0 12px;color:var(--ink)}
h4{font-size:17px;margin:22px 0 6px;color:var(--ink)}
p{max-width:48em}
.grid{display:grid;gap:18px}.g2{grid-template-columns:repeat(2,1fr)}.g3{grid-template-columns:repeat(3,1fr)}.g4{grid-template-columns:repeat(4,1fr)}.g5{grid-template-columns:repeat(5,1fr)}
@media (max-width:800px){.g2,.g3,.g4,.g5{grid-template-columns:1fr 1fr}}
.card{background:#fff;border:1px solid var(--linha);border-radius:18px;padding:20px}
.card img{width:100%;display:block;border-radius:12px}
.card .leg{font-size:13.5px;color:var(--suave);margin-top:10px}
.sim,.nao{border-radius:14px;padding:16px 18px}
.sim{background:#ECFDF5;border:1px solid #A7F3D0}.nao{background:#FFF1F2;border:1px solid #FECDD3}
.sim b,.nao b{display:block;margin-bottom:6px}
.sim ul,.nao ul{margin:0;padding-left:18px}
.cor{border-radius:16px;overflow:hidden;border:1px solid var(--linha);background:#fff}
.cor .amostra{height:96px;display:flex;align-items:flex-end;padding:10px 12px;color:#fff;font-weight:700}
.cor .info{padding:10px 12px;font-size:13px;color:var(--suave)}
.cor code{font:600 13px "JetBrains Mono",monospace;color:var(--ink)}
.tema{border-radius:20px;padding:18px;background:#fff;border:1px solid var(--linha)}
.tema .faixa{display:flex;height:56px;border-radius:12px;overflow:hidden;margin:10px 0}
.tema .faixa span{flex:1}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden;font-size:15px}
th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--linha);vertical-align:top}
th{background:#F1F5FF;font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--suave)}
.svgbox{background:linear-gradient(160deg,#fff,#EEF3FF);border-radius:16px;aspect-ratio:1.1/1}
.svgbox svg{width:100%;height:100%}
.pose{background:#fff;border:1px solid var(--linha);border-radius:18px;padding:10px 12px 14px}
.pose .svgbox{aspect-ratio:1.13/1}
.pose b{display:block;font:700 14px "JetBrains Mono",monospace;color:var(--ink);margin-top:8px}
.pose span{font-size:13px;color:var(--suave)}
.tipo{display:flex;align-items:baseline;gap:18px;padding:14px 0;border-bottom:1px solid var(--linha)}
.tipo .rot{width:150px;font-size:12.5px;color:var(--suave);flex:none}
.nota{background:#FFFBEB;border:1px solid #FDE68A;border-radius:14px;padding:14px 18px;font-size:15px}
footer{margin-top:80px;font-size:13px;color:var(--suave)}
@media print{.capa{min-height:auto;padding:60px}.parte{break-before:page}.card,.pose,.tema,table{break-inside:avoid}}
"""


def secao_cores() -> str:
    m = T["marca"]
    base = [("Primária CodeMatrix", m["primaria"], "Wordmark, glifo, links, acento de IA"), ("Tinta", m["tinta"], "Títulos, visor do Trix, código"),
            ("Texto", m["texto"], "Corpo de texto"), ("Texto suave", m["texto_suave"], "Legendas, rótulos"), ("Fundo", m["fundo"], "Base de toda peça")]
    cards = "".join(f'<div class="cor"><div class="amostra" style="background:{h};color:{"#0B1530" if n=="Fundo" else "#fff"}">{n}</div>'
                    f'<div class="info"><code>{h}</code><br>{u}</div></div>' for n, h, u in base)
    temas = "".join(
        f'<div class="tema"><b>{t["nome"]}</b><div class="faixa"><span style="background:{t["acento"]}"></span><span style="background:{t["secundaria"]}"></span>'
        f'<span style="background:{t["tinta"]}"></span></div><div style="font-size:13px;color:#475569">Acento <code>{t["acento"]}</code> · Secundária <code>{t["secundaria"]}</code> · '
        f'Tinta <code>{t["tinta"]}</code></div></div>' for t in TEMAS.values())
    return f'<div class="grid g5">{cards}</div><h4>Cores por tema</h4><div class="grid g2">{temas}</div>'


def gerar() -> Path:
    r = renders()
    ilu = {k: svg_tema(RAIZ / "marca" / "ilustracoes" / f"{k}.svg", k) for k in TEMAS}
    poses = "".join(
        f'<div class="pose">{svg_tema(RAIZ / "marca" / "personagens" / f"{nome}.svg", "ia")}<b>{nome}</b><span>{html.escape(uso)}</span></div>'
        for nome, (_, _, _, _, uso) in POSES.items())
    pixels = "".join(f'<div class="pose">{svg_tema(RAIZ / "marca" / "personagens" / f"pixel-{o}.svg", "ia")}<b>pixel-{o}</b><span>{u}</span></div>'
                     for o, u in [("normal", "Nota lateral, lembrete"), ("feliz", "Parabéns curto, acerto"), ("surpreso", "Curiosidade, \"sabia que...\"")])
    trix_temas = "".join(f'<div class="pose">{svg_tema(RAIZ / "marca" / "personagens" / "trix-ola.svg", k)}<b>{t["nome"]}</b><span>Mesma forma; muda só a cor do tema</span></div>'
                         for k, t in TEMAS.items())
    status = html.escape(T.get("_status", ""))
    doc = f"""<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Manual da CodeMatrix Academy</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>
<section class="capa">
  <div class="marca"><span class="glifo"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>CodeMatrix <span style="color:#1846D1;font-weight:600">Academy</span></div>
  <h1>Manual da marca,<br>da identidade visual<br>e dos personagens</h1>
  <p>Como a CodeMatrix Academy fala, aparece e ensina — para pessoas e para qualquer IA que produza cursos, capas, aulas e anúncios.
  Versão de {date.today().strftime('%d/%m/%Y')}, gerada por <code>scripts/gerar_manual.py</code>.</p>
  <div class="partes"><a href="#marca">1 · Marca</a><a href="#identidade">2 · Identidade visual</a><a href="#personagens">3 · Imagens e personagens</a></div>
</section>
<main>
<div class="nota"><b>Cores provisórias.</b> {status}. As cores e o wordmark ainda não foram conferidos com os arquivos oficiais do site;
rode <code>rex marca extrair marca/referencias/* --aplicar</code>, coloque o logo em <code>marca/logo.png</code> e gere o manual de novo.</div>

<section class="parte" id="marca"><div class="num">Parte 1</div><h2>Manual da marca</h2>
<p class="lead">A CodeMatrix Academy é a escola de cursos práticos da CodeMatrix: cada curso termina com algo pronto e útil no dia seguinte.</p>
<h3>Essência</h3>
<div class="grid g3">
 <div class="card"><h4>Propósito</h4>Ensinar habilidades digitais que viram resultado no trabalho, no negócio e na vida financeira — sem enrolação.</div>
 <div class="card"><h4>Assinatura</h4><b style="font-size:20px;color:#0B1530">{html.escape(T['marca']['assinatura'])}</b></div>
 <div class="card"><h4>Promessa</h4>Você sai de cada curso com um entregável concreto: um app, uma planilha, uma rotina, uma página, uma campanha.</div>
</div>
<h3>Arquitetura</h3>
<table><tr><th>Nível</th><th>Nome</th><th>Função</th></tr>
<tr><td>Marca-mãe</td><td>CodeMatrix</td><td>Consultoria, tecnologia e IA aplicada. Dá credibilidade e regras.</td></tr>
<tr><td>Sub-marca</td><td>CodeMatrix Academy</td><td>Cursos e produtos digitais na Kiwify e na Hotmart.</td></tr>
<tr><td>Trilhas</td><td>{" · ".join(t["nome"] for t in TEMAS.values())}</td><td>Uma cor por trilha; mesma forma em tudo.</td></tr></table>
<h3>Personalidade e tom de voz</h3>
<div class="grid g4">
 <div class="card"><h4>Direta</h4>Diz o que a pessoa vai fazer na primeira frase.</div>
 <div class="card"><h4>Prática</h4>Mostra na tela, dá o modelo pronto, propõe o exercício.</div>
 <div class="card"><h4>Confiante, sem exagero</h4>Fala de habilidade e entregável, nunca de ganho garantido.</div>
 <div class="card"><h4>Próxima</h4>Você, frases curtas, exemplos brasileiros do dia a dia.</div>
</div>
<div class="grid g2" style="margin-top:18px">
 <div class="sim"><b>Falamos assim</b><ul><li>"Você sai desta aula com a tela inicial rodando no celular."</li><li>"Separe as contas fixas primeiro; o que sobra vira meta."</li><li>"Erro comum: pedir o app inteiro de uma vez."</li></ul></div>
 <div class="nao"><b>Nunca assim</b><ul><li>"Fature R$ 10 mil no primeiro mês." (RC-002)</li><li>"Últimas vagas!" sem limite real.</li><li>"Método secreto que os gurus escondem."</li></ul></div>
</div>
<h3>Títulos (regra RC-012)</h3>
<p>Verbo de ação no imperativo ou "Como...", resultado concreto, até 70 caracteres. Subtítulo com 4 a 6 entregáveis.</p>
<table><tr><th>Antes</th><th>Depois</th></tr>
<tr><td>Seu primeiro app com IA</td><td><b>Crie seu primeiro aplicativo móvel com IA como um profissional</b><br><span style="color:#475569">Da ideia à publicação nas lojas: telas, navegação, dados, testes e publicação.</span></td></tr>
<tr><td>Vendas pelo WhatsApp</td><td><b>Aumente suas vendas usando o WhatsApp</b><br><span style="color:#475569">Catálogo, respostas rápidas, etiquetas, follow-up e mensagens automáticas.</span></td></tr>
<tr><td>Seu primeiro produto digital</td><td><b>Como criar seu primeiro produto digital do jeito certo</b><br><span style="color:#475569">Tema, validação, criação com IA, página de vendas e publicação.</span></td></tr>
<tr><td>Finanças da família em uma planilha</td><td><b>Organize as finanças da família em planilhas</b><br><span style="color:#475569">Contas a pagar, reserva de emergência, metas, dívidas e plano de aposentadoria.</span></td></tr></table>
<h3>Limites da marca</h3>
<p>Sem promessa de ganho ou resultado garantido, sem escassez falsa, sem depoimento ou número inventado, sem marcas ou personagens de terceiros.
Regras completas em <code>regras/</code> (RN e RC).</p>
</section>

<section class="parte" id="identidade"><div class="num">Parte 2</div><h2>Manual de identidade visual</h2>
<p class="lead">Light liquid glass: fundo claro, vidro fosco translúcido, esferas de vidro e a cor do tema como luz atrás do vidro.</p>
<h3>Wordmark</h3>
<div class="grid g2"><div class="card" style="display:flex;align-items:center;justify-content:center;min-height:180px">
 <div class="marca" style="display:flex;align-items:center;gap:16px;font-weight:700;font-size:36px;color:#0B1530"><span class="glifo" style="width:56px;height:56px;padding:11px;gap:5px"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>CodeMatrix <span style="color:#1846D1;font-weight:600">Academy</span></div></div>
 <div class="card"><h4>Uso</h4>"CodeMatrix" em tinta, "Academy" na tinta do tema. Glifo de matriz 3×3 à esquerda. Área de proteção = altura do glifo em todos os lados.
 Substituído automaticamente pelo logo oficial quando <code>marca/logo.png</code> existir.<h4>Não fazer</h4>Esticar, mudar a fonte, aplicar sobre foto, escrever "Codematrix", "CodeMatrix academy" ou "Academia".</div></div>
<h3>Cores</h3>{secao_cores()}
<p style="font-size:14px;color:#475569">Texto colorido usa sempre a coluna <b>Tinta</b> (contraste AA). Acento e Secundária só em luz, esferas, gradientes e ilustrações. Nunca duas trilhas na mesma peça.</p>
<h3>Tipografia</h3>
<div class="card">
 <div class="tipo"><span class="rot">Hero · Inter Display 800</span><span style="font-size:56px;font-weight:800;letter-spacing:-.03em;color:#0B1530;line-height:1">Crie seu primeiro app</span></div>
 <div class="tipo"><span class="rot">Título · 700</span><span style="font-size:36px;font-weight:700;letter-spacing:-.02em;color:#0B1530">O que você vai construir hoje</span></div>
 <div class="tipo"><span class="rot">Corpo · Inter 400–500</span><span style="font-size:20px">Separe as contas fixas primeiro; o que sobra vira meta e reserva.</span></div>
 <div class="tipo"><span class="rot">Rótulo · 700 caixa alta</span><span style="font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#1846D1">Módulo 1 · Aula 1</span></div>
 <div class="tipo" style="border:0"><span class="rot">Código · JetBrains Mono</span><code style="font-size:18px">npx create-expo-app meu-app</code></div>
</div>
<p style="font-size:14px;color:#475569">Escala em 1920 px: hero 112 · h1 96 · h2 66 · corpo 38–40 · rótulo 22–26 · legenda 50. Uma palavra-chave do título pode receber o gradiente do tema (<code>*palavra*</code>).</p>
<h3>Vidro (receita)</h3>
<table><tr><th>Elemento</th><th>Especificação</th></tr>
<tr><td>Painel</td><td>Gradiente branco 68% → 30%, blur 28 px, saturação 1,6, borda branca 80% de 1,5 px, brilho interno no topo, raio 40 px, sombra longa e suave</td></tr>
<tr><td>Esferas</td><td>Brilho especular no alto à esquerda, cor do tema embaixo, sombra colorida; uma avança sobre a quina do painel</td></tr>
<tr><td>Fundo</td><td>Base #F3F6FF, duas luzes desfocadas (acento e secundária) e grade "matrix" a 7% mascarada</td></tr></table>
<h3>Formatos e aplicações</h3>
<div class="grid g4">
 <div class="card"><img src="{r['capa-ia']}" alt=""><div class="leg">Capa de produto 1:1 · trilha IA</div></div>
 <div class="card"><img src="{r['capa-marketing']}" alt=""><div class="leg">Capa 1:1 · Marketing e Vendas</div></div>
 <div class="card"><img src="{r['capa-renda']}" alt=""><div class="leg">Capa 1:1 · Renda Extra</div></div>
 <div class="card"><img src="{r['capa-pessoal']}" alt=""><div class="leg">Capa 1:1 · Desenvolvimento e Finanças</div></div>
</div>
<div class="grid g2" style="margin-top:18px">
 <div class="card"><img src="{r['aula-capa']}" alt=""><div class="leg">Aula 16:9 · abertura com ilustração do tema</div></div>
 <div class="card"><img src="{r['aula-codigo']}" alt=""><div class="leg">Aula 16:9 · código (sem personagem)</div></div>
 <div class="card"><img src="{r['aula-comparacao']}" alt=""><div class="leg">Aula 16:9 · comparação</div></div>
 <div class="card"><img src="{r['thumb']}" alt=""><div class="leg">Thumbnail 1280×720</div></div>
</div>
<div class="grid g3" style="margin-top:18px;align-items:start">
 <div class="card"><img src="{r['vertical']}" alt=""><div class="leg">Vertical 9:16 · Reels, TikTok, Stories (legenda queimada abaixo do painel)</div></div>
 <div class="card" style="grid-column:span 2"><h4>Áreas seguras</h4>16:9: margens de 80 px; 250 px livres embaixo para a legenda. 9:16: 420 px livres embaixo; personagem no alto.
 1:1 e 4:5: ilustração em cima, painel com título embaixo.<h4>Vídeo</h4>30 fps, H.264 CRF 18, AAC 192 kbps, −16 LUFS, fade de 0,3 s pela cor de fundo, empurrão lento de 4%.
 Legenda Inter SemiBold branca em caixa tinta, até 2 linhas × 42 caracteres (30 no vertical), .srt sempre entregue.
 <h4>Não fazer</h4>Fundo escuro chapado, mais de 4 itens por tela, texto corrido na tela, foto de banco genérica, duas cores de trilha.</div>
</div>
</section>

<section class="parte" id="personagens"><div class="num">Parte 3</div><h2>Manual de imagens e personagens</h2>
<p class="lead">Ilustrações e personagens próprios, gerados por código (<code>scripts/gerar_ilustracoes.py</code>), para que todo curso tenha o mesmo padrão — com qualquer IA ou pessoa produzindo.</p>
<h3>Estilo de ilustração</h3>
<p>Objetos do tema em vidro claro, cantos arredondados, sombra suave, cor da trilha em destaque e o Trix na cena.
A imagem precisa dizer o assunto sem ler o título: celular e código para IA; conversa, sacola e gráfico subindo para vendas;
notebook com produto e checklist de validação para produto digital; planilha, calendário de contas, escudo da reserva e cofrinho para finanças.</p>
<div class="grid g4">{"".join(f'<div class="pose">{ilu[k]}<b>ilustracoes/{k}.svg</b><span>{TEMAS[k]["nome"]}</span></div>' for k in TEMAS)}</div>

<h3>Trix — o guia</h3>
<div class="grid g2">
 <div class="card"><h4>Quem é</h4>Robô guia da CodeMatrix Academy. Explica, avisa dos erros, comemora as conquistas. Curioso, paciente e prático.
 Fala pouco na tela — a narração fala por ele.
 <h4>Assinaturas (não mudar)</h4><ul><li>Olhos e boca de pixels (vêm do glifo da matriz CodeMatrix)</li><li>Painel 3×3 de luzes no peito e faixa na cintura na cor da trilha</li>
 <li>Fones laterais e cotovelos na cor da trilha</li><li>Antena com orbe colorida</li><li>Pernas curtas e pés escuros com faixa colorida</li><li>Corpo de vidro branco-azulado</li></ul></div>
 <div class="card"><h4>Proporções</h4>Cabeça ≈ 40% da altura; visor ocupa 75% da largura da cabeça; tronco 60% da largura da cabeça.
 Sempre inteiro, de frente, com a sombra no chão.<h4>Cores</h4>Só muda a cor da trilha (acento e secundária). Visor sempre tinta <code>{T['marca']['tinta']}</code>.
 <h4>Nunca</h4><ul><li>Distorcer, cortar a cabeça, girar, espelhar com texto</li><li>Desenhar pose nova à mão (adicione no gerador)</li><li>Misturar com personagens, mascotes ou estilos reconhecíveis de filmes, jogos ou marcas</li><li>Colocar o Trix dizendo promessa de ganho</li></ul></div>
</div>
<h4>Mesmo personagem nas quatro trilhas</h4><div class="grid g4">{trix_temas}</div>
<h3>Biblioteca de poses — quando usar cada uma</h3>
<div class="grid g3">{poses}</div>
<h3>Pixel — o ajudante</h3>
<p>Esfera de vidro flutuante que acompanha o Trix em notas curtas, lembretes e curiosidades. Aparece pequeno, nunca no lugar do Trix.</p>
<div class="grid g3">{pixels}</div>
<h3>Uso nas aulas</h3>
<table><tr><th>Momento da aula</th><th>Personagem</th><th>Regra</th></tr>
<tr><td>Abertura</td><td>trix-ola</td><td>Uma vez por aula</td></tr>
<tr><td>Explicação de conceito</td><td>trix-explica · trix-apresenta</td><td>Personagem à direita, conteúdo à esquerda</td></tr>
<tr><td>Pergunta para o aluno</td><td>trix-pensa</td><td>Combine com cena "destaque"</td></tr>
<tr><td>Erro comum / cuidado</td><td>trix-alerta</td><td>Obrigatório em toda seção "Erros comuns"</td></tr>
<tr><td>Dica rápida</td><td>trix-dica · pixel-normal</td><td>No máximo 2 por aula</td></tr>
<tr><td>Exercício</td><td>trix-estuda</td><td>Na cena que propõe o exercício</td></tr>
<tr><td>Checklist concluído</td><td>trix-ok</td><td>—</td></tr>
<tr><td>Fim de módulo / conquista</td><td>trix-comemora</td><td>Antes do CTA da próxima aula</td></tr>
<tr><td>Código</td><td>nenhum</td><td>O código precisa da largura toda</td></tr></table>
<p>No <code>cenas.json</code>: <code>"personagem": "trix-alerta"</code>. Capas e CTA usam a ilustração da trilha automaticamente
(<code>"ilustracao": false</code> desliga).</p>
<h3>Como criar uma pose ou ilustração nova</h3>
<ol><li>Adicione a pose em <code>POSES</code> (ou a cena em <code>gerar_ilustracoes.py</code>) reutilizando <code>mascote()</code> e as mesmas assinaturas.</li>
<li>Rode <code>python scripts/gerar_ilustracoes.py</code> e <code>python scripts/gerar_manual.py</code>.</li>
<li>O especialista em marketing de imagem revisa; registre com <code>rex log add --tipo skill</code>.</li></ol>
</section>
<footer>CodeMatrix Academy · manual gerado automaticamente a partir de <code>marca/</code>. Regras relacionadas: RN-004, RC-002, RC-008, RC-012, RC-013.</footer>
</main></body></html>"""
    SAIDA.mkdir(parents=True, exist_ok=True)
    destino = SAIDA / "manual-codematrix-academy.html"
    destino.write_text(doc, encoding="utf-8")
    with marca.navegador() as b:
        pg = b.new_page(viewport={"width": 1280, "height": 900})
        pg.goto(destino.resolve().as_uri())
        pg.wait_for_timeout(500)
        pg.pdf(path=str(SAIDA / "manual-codematrix-academy.pdf"), format="A4", landscape=True, print_background=True,
               margin={"top": "10mm", "bottom": "10mm", "left": "8mm", "right": "8mm"})
        pg.close()
    for f in (SAIDA / "_render").glob("*.png"):
        f.unlink()
    (SAIDA / "_render").rmdir()
    return destino


if __name__ == "__main__":
    print(gerar())

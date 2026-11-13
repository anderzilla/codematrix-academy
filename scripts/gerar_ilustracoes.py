"""Gera as ilustrações SVG da CodeMatrix Academy (originais, sem marcas de terceiros).

Cores vêm das variáveis CSS do template (--acento, --sec, --tintaTema, --ink), então a mesma
ilustração muda de cor conforme o tema. Rode: python scripts/gerar_ilustracoes.py
"""
from pathlib import Path

A, S, T, K = "var(--acento,#1F5EFF)", "var(--sec,#22D3EE)", "var(--tintaTema,#1846D1)", "var(--ink,#0B1530)"

DEFS = f"""<defs>
  <linearGradient id="vidro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".55"/></linearGradient>
  <linearGradient id="vidroAz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#E6ECFF"/></linearGradient>
  <linearGradient id="tema" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:{A}"/><stop offset="1" style="stop-color:{T}"/></linearGradient>
  <linearGradient id="temaSec" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:{S}"/><stop offset="1" style="stop-color:{A}"/></linearGradient>
  <filter id="sombra" x="-60%" y="-60%" width="220%" height="240%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#0B1530" flood-opacity=".18"/></filter>
  <filter id="brilho" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <radialGradient id="porc" cx=".34" cy=".26" r=".85"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#F5F7FC"/><stop offset=".8" stop-color="#E1E8F4"/><stop offset="1" stop-color="#C7D2E6"/></radialGradient>
  <linearGradient id="porcLin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#D3DCEC"/><stop offset=".35" stop-color="#FFFFFF"/><stop offset="1" stop-color="#CBD5E8"/></linearGradient>
  <linearGradient id="visor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#24304F"/><stop offset=".55" stop-color="#0B1222"/><stop offset="1" stop-color="#03060D"/></linearGradient>
  <radialGradient id="joia" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" style="stop-color:{A}"/><stop offset="1" style="stop-color:{T}"/></radialGradient>
  <linearGradient id="sola" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A3556"/><stop offset="1" stop-color="#070B16"/></linearGradient>
  <filter id="led" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="macio" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
  <filter id="macio2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>
</defs>"""


def cartao(x, y, w, h, r=28, extra=""):
    return (f'<g filter="url(#sombra)"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="url(#vidro)" '
            f'stroke="#fff" stroke-width="3"/>{extra}</g>')


def brilho_estrela(x, y, s=1.0, cor=S):
    return (f'<path transform="translate({x} {y}) scale({s})" d="M0 -18 C3 -4 4 -3 18 0 C4 3 3 4 0 18 C-3 4 -4 3 -18 0 C-4 -3 -3 -4 0 -18Z" '
            f'style="fill:{cor}" opacity=".9"/>')


def _grade(cx, cy, cols, rows, passo=9, tam=7, cor=S, apagados=()):
    """Bloco de 'pixels' — a assinatura visual do Trix (vem do glifo da matriz CodeMatrix)."""
    x0, y0 = cx - (cols - 1) * passo / 2, cy - (rows - 1) * passo / 2
    return "".join(
        f'<rect x="{x0 + c * passo - tam / 2:.1f}" y="{y0 + r * passo - tam / 2:.1f}" width="{tam}" height="{tam}" rx="2" '
        f'style="fill:{cor}" opacity="{0.35 if (c, r) in apagados else 1}"/>'
        for r in range(rows) for c in range(cols))


OLHOS = {  # olhos de pixels (3x3), centrados em x=78 e x=122, y=90
    "normal": lambda: _grade(78, 90, 3, 3) + _grade(122, 90, 3, 3),
    "feliz": lambda: _grade(78, 92, 3, 2, apagados=((1, 0),)) + _grade(122, 92, 3, 2, apagados=((1, 0),)),
    "surpreso": lambda: _grade(78, 90, 3, 3, passo=10, tam=8, apagados=((1, 1),)) + _grade(122, 90, 3, 3, passo=10, tam=8, apagados=((1, 1),)),
    "pensando": lambda: _grade(78, 86, 3, 2) + _grade(122, 86, 3, 2),
    "piscando": lambda: _grade(78, 90, 3, 3) + _grade(122, 94, 3, 1),
}
BOCA = {  # boca de pixels
    "sorriso": lambda: "".join(f'<rect x="{x}" y="{y}" width="7" height="7" rx="2" style="fill:{S}"/>' for x, y in [(84, 112), (93, 117), (102, 117), (111, 112)]),
    "aberta": lambda: _grade(100, 117, 2, 2, passo=8, tam=7),
    "neutra": lambda: _grade(100, 116, 3, 1),
    "riso": lambda: "".join(f'<rect x="{x}" y="{y}" width="7" height="7" rx="2" style="fill:{S}"/>' for x, y in [(80, 110), (89, 116), (98, 118), (107, 116), (116, 110)]) + _grade(100, 112, 2, 1, passo=8, tam=6),
}
# braços articulados: ombro -> cotovelo -> mão
BRACOS = {
    "baixo": (((58, 176), (40, 204), (36, 232)), ((142, 176), (160, 204), (164, 232))),
    "acena": (((58, 176), (40, 204), (36, 232)), ((142, 174), (178, 156), (186, 118))),
    "aponta": (((58, 176), (40, 204), (36, 232)), ((142, 178), (176, 192), (206, 174))),
    "comemora": (((58, 172), (28, 150), (22, 112)), ((142, 172), (172, 150), (178, 112))),
    "queixo": (((58, 176), (40, 204), (36, 232)), ((142, 178), (166, 196), (132, 158))),
    "segura": (((58, 178), (44, 206), (74, 224)), ((142, 178), (156, 206), (126, 224))),
}


def _braco(pts):
    (ox, oy), (cx, cy), (mx, my) = pts
    return (f'<path d="M{ox} {oy} L{cx} {cy} L{mx} {my}" fill="none" stroke="#B9C6DE" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>'
            f'<path d="M{ox} {oy} L{cx} {cy} L{mx} {my}" fill="none" stroke="url(#porcLin)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="M{ox} {oy - 3} L{cx} {cy - 3} L{mx} {my - 3}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>'
            f'<circle cx="{cx}" cy="{cy}" r="8.5" fill="url(#joia)"/>'
            f'<circle cx="{mx}" cy="{my}" r="15" fill="url(#porc)" stroke="#C7D2E6" stroke-width="1.5"/>'
            f'<ellipse cx="{mx - 4}" cy="{my - 6}" rx="6" ry="3.5" fill="#fff" opacity=".95"/>')


def mascote(x, y, s=1.0, pose="acena", prop="", olhos="normal", boca="sorriso"):
    """Trix — mascote original da CodeMatrix Academy. Ver marca/manual e marca/personagens.
    Assinaturas: olhos e boca de pixels, painel 3x3 no peito, fones laterais e cotovelos na cor da trilha,
    antena com orbe, pernas curtas e pés escuros com faixa. Acabamento: porcelana brilhante com luz de estúdio."""
    bracos = "".join(_braco(b) for b in BRACOS[pose])
    painel = _grade(100, 196, 3, 3, passo=10, tam=7, cor=A, apagados=((0, 1), (2, 0), (1, 2)))
    return f"""<g transform="translate({x} {y}) scale({s})">
  <ellipse cx="100" cy="292" rx="70" ry="10" fill="#0B1530" opacity=".16" filter="url(#macio)"/>
  <ellipse cx="100" cy="290" rx="44" ry="5" fill="#0B1530" opacity=".18" filter="url(#macio2)"/>
  <!-- antena -->
  <rect x="96.5" y="16" width="7" height="30" rx="3.5" fill="url(#porcLin)"/>
  <circle cx="100" cy="13" r="12" fill="url(#joia)"/><circle cx="96" cy="8.5" r="3.6" fill="#fff"/>
  <circle cx="100" cy="13" r="18" style="fill:{A}" opacity=".18" filter="url(#macio2)"/>
  <!-- pernas e pés -->
  <rect x="72" y="234" width="18" height="38" rx="9" fill="url(#porcLin)"/>
  <rect x="110" y="234" width="18" height="38" rx="9" fill="url(#porcLin)"/>
  <path d="M56 287 q0 -20 24 -20 h10 q9 0 9 11 v9 z" fill="url(#sola)"/><rect x="61" y="280" width="34" height="4" rx="2" style="fill:{A}"/>
  <path d="M144 287 q0 -20 -24 -20 h-10 q-9 0 -9 11 v9 z" fill="url(#sola)"/><rect x="105" y="280" width="34" height="4" rx="2" style="fill:{A}"/>
  <path d="M64 272 q10 -4 20 -3" stroke="#fff" stroke-width="2" opacity=".35" fill="none" stroke-linecap="round"/>
  {bracos}
  <!-- tronco -->
  <rect x="56" y="158" width="88" height="86" rx="32" fill="url(#porc)"/>
  <rect x="56" y="158" width="88" height="86" rx="32" fill="none" stroke="#fff" stroke-width="2" opacity=".9"/>
  <rect x="58" y="226" width="84" height="9" style="fill:{A}" opacity=".9"/><rect x="58" y="226" width="84" height="3" fill="#fff" opacity=".35"/>
  <rect x="77" y="173" width="46" height="46" rx="13" fill="url(#visor)"/>
  <g filter="url(#led)">{painel}</g>
  <path d="M81 177 q12 -4 26 -2" stroke="#fff" stroke-width="2" opacity=".28" fill="none" stroke-linecap="round"/>
  <ellipse cx="76" cy="176" rx="14" ry="6" fill="#fff" opacity=".9" filter="url(#macio2)"/>
  <!-- sombra da cabeça sobre o tronco -->
  <ellipse cx="100" cy="162" rx="40" ry="8" fill="#5B6B8C" opacity=".35" filter="url(#macio2)"/>
  <rect x="86" y="146" width="28" height="16" rx="7" fill="url(#porcLin)"/>
  <!-- fones laterais -->
  <rect x="14" y="74" width="24" height="50" rx="12" fill="url(#joia)"/><rect x="162" y="74" width="24" height="50" rx="12" fill="url(#joia)"/>
  <rect x="19" y="82" width="6" height="22" rx="3" fill="#fff" opacity=".7"/><rect x="167" y="82" width="6" height="22" rx="3" fill="#fff" opacity=".7"/>
  <!-- cabeça -->
  <rect x="28" y="36" width="144" height="118" rx="48" fill="url(#porc)"/>
  <rect x="28" y="36" width="144" height="118" rx="48" fill="none" stroke="#fff" stroke-width="2.5" opacity=".95"/>
  <rect x="42" y="56" width="116" height="84" rx="33" fill="#B4C1DB" opacity=".55" filter="url(#macio2)"/>
  <rect x="45" y="58" width="110" height="78" rx="31" fill="url(#visor)"/>
  <rect x="45" y="58" width="110" height="78" rx="31" fill="none" stroke="#3A4870" stroke-width="1.5" opacity=".7"/>
  <g filter="url(#led)">{OLHOS[olhos]()}{BOCA[boca]()}</g>
  <path d="M56 74 Q70 62 96 62" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".22"/>
  <path d="M142 118 Q150 108 150 96" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".18"/>
  <ellipse cx="66" cy="50" rx="26" ry="9" fill="#fff" opacity=".95" filter="url(#macio2)"/>
  <circle cx="152" cy="54" r="3.5" fill="#fff" opacity=".9"/>
  {prop}
</g>"""


def pixel(x, y, s=1.0, olhos="normal"):
    """Pixel — ajudante de Trix: esfera de vidro flutuante (dicas curtas, notas de rodapé)."""
    olho = {"normal": _grade(-11, 0, 2, 3, passo=7, tam=5.5) + _grade(11, 0, 2, 3, passo=7, tam=5.5),
            "feliz": _grade(-11, 2, 3, 1, passo=6, tam=5) + _grade(-11, -4, 1, 1, tam=5) + _grade(11, 2, 3, 1, passo=6, tam=5) + _grade(11, -4, 1, 1, tam=5),
            "surpreso": _grade(-11, 0, 3, 3, passo=6, tam=5, apagados=((1, 1),)) + _grade(11, 0, 3, 3, passo=6, tam=5, apagados=((1, 1),))}[olhos]
    return f"""<g transform="translate({x} {y}) scale({s})">
  <ellipse cx="0" cy="70" rx="30" ry="6" fill="#0B1530" opacity=".08"/>
  <path d="M-28 -36 Q0 -54 28 -36" fill="none" style="stroke:{A}" stroke-width="5" stroke-linecap="round" opacity=".8"/>
  <circle r="42" fill="url(#porc)"/><circle r="42" fill="none" stroke="#fff" stroke-width="2"/>
  <rect x="-29" y="-21" width="58" height="40" rx="19" fill="url(#visor)"/><g filter="url(#led)">{olho}</g>
  <ellipse cx="-16" cy="-29" rx="12" ry="5" fill="#fff" opacity=".95" filter="url(#macio2)"/>
  <rect x="-6" y="34" width="12" height="6" rx="3" fill="url(#joia)"/>
</g>"""


def celular(x, y, conteudo, w=240, h=440):
    return f"""<g filter="url(#sombra)" transform="translate({x} {y})">
  <rect width="{w}" height="{h}" rx="42" style="fill:{K}"/>
  <rect x="12" y="12" width="{w-24}" height="{h-24}" rx="32" fill="#F8FAFF"/>
  <rect x="{w/2-36}" y="22" width="72" height="16" rx="8" style="fill:{K}"/>
  {conteudo}
</g>"""


def svg(corpo):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 600" width="100%" height="100%">{DEFS}{corpo}</svg>'


def cena_ia():
    tela = f"""
  <rect x="28" y="54" width="184" height="54" rx="16" fill="url(#tema)"/>
  <circle cx="54" cy="81" r="12" fill="#fff" opacity=".9"/><rect x="74" y="72" width="90" height="10" rx="5" fill="#fff" opacity=".9"/><rect x="74" y="88" width="56" height="8" rx="4" fill="#fff" opacity=".6"/>
  {''.join(f'<rect x="28" y="{124+i*72}" width="184" height="60" rx="16" fill="#fff" stroke="#E2E8F0" stroke-width="2"/><rect x="42" y="{138+i*72}" width="32" height="32" rx="10" style="fill:{S}" opacity="{.9-i*.2}"/><rect x="86" y="{142+i*72}" width="{100-i*14}" height="10" rx="5" fill="#CBD5E1"/><rect x="86" y="{158+i*72}" width="{70-i*8}" height="8" rx="4" fill="#E2E8F0"/>' for i in range(3))}
  <rect x="60" y="356" width="120" height="44" rx="22" fill="url(#tema)"/><path d="M110 378 h20 M120 368 v20" stroke="#fff" stroke-width="5" stroke-linecap="round"/>"""
    corpo = celular(150, 70, tela)
    corpo += cartao(40, 70, 130, 96, 26, f'<text x="105" y="134" text-anchor="middle" font-family="JetBrains Mono,monospace" font-weight="700" font-size="44" style="fill:{T}">&lt;/&gt;</text>')
    corpo += cartao(28, 400, 150, 92, 24, f'<rect x="48" y="422" width="22" height="22" rx="6" style="fill:{A}"/><rect x="80" y="426" width="78" height="10" rx="5" fill="#CBD5E1"/><rect x="48" y="456" width="22" height="22" rx="6" style="fill:{S}"/><rect x="80" y="460" width="60" height="10" rx="5" fill="#CBD5E1"/>')
    corpo += brilho_estrela(420, 90, 1.2) + brilho_estrela(122, 220, .7, A) + brilho_estrela(600, 300, .8)
    corpo += mascote(410, 262, 0.98, "acena")
    return svg(corpo)


def cena_marketing():
    bolhas = ""
    ys = [(70, "e", 150), (130, "d", 130), (190, "e", 110), (250, "d", 150), (310, "d", 96)]
    for y, lado, w in ys:
        if lado == "e":
            bolhas += f'<rect x="26" y="{y}" width="{w}" height="46" rx="18" fill="#fff" stroke="#E2E8F0" stroke-width="2"/><rect x="40" y="{y+14}" width="{w-40}" height="9" rx="4.5" fill="#CBD5E1"/><rect x="40" y="{y+28}" width="{w-70}" height="7" rx="3.5" fill="#E2E8F0"/>'
        else:
            bolhas += f'<rect x="{214-w}" y="{y}" width="{w}" height="46" rx="18" fill="url(#tema)"/><rect x="{228-w}" y="{y+14}" width="{w-40}" height="9" rx="4.5" fill="#fff" opacity=".9"/><path d="M{190} {y+34} l5 5 l10 -10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>'
    bolhas += f'<rect x="26" y="380" width="188" height="36" rx="18" fill="#fff" stroke="#E2E8F0" stroke-width="2"/><circle cx="194" cy="398" r="13" fill="url(#tema)"/>'
    corpo = celular(150, 70, bolhas)
    # gráfico subindo
    barras = "".join(f'<rect x="{462+i*34}" y="{210-hh}" width="22" height="{hh}" rx="8" fill="url(#temaSec)" opacity="{.55+i*.15}"/>' for i, hh in enumerate([40, 64, 92, 124]))
    corpo += cartao(440, 60, 170, 170, 30, barras + f'<path d="M466 150 L506 126 L540 112 L584 70" fill="none" style="stroke:{T}" stroke-width="5" stroke-linecap="round"/><path d="M570 66 L588 66 L588 84" fill="none" style="stroke:{T}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>')
    # sacola de compras
    corpo += f'<g filter="url(#sombra)"><path d="M44 300 h112 l-10 128 h-92z" fill="url(#vidro)" stroke="#fff" stroke-width="3"/><path d="M74 300 v-18 a26 26 0 0 1 52 0 v18" fill="none" style="stroke:{T}" stroke-width="7" stroke-linecap="round"/><path d="M100 380 c-14 -12 -26 -20 -16 -32 c6 -7 14 -4 16 2 c2 -6 10 -9 16 -2 c10 12 -2 20 -16 32z" style="fill:{A}"/></g>'
    # notificação
    corpo += f'<g filter="url(#sombra)"><circle cx="384" cy="92" r="26" style="fill:{A}"/><text x="384" y="102" text-anchor="middle" font-family="Inter,sans-serif" font-weight="800" font-size="26" fill="#fff">3</text></g>'
    corpo += brilho_estrela(430, 270, .9) + brilho_estrela(70, 210, .7, A)
    corpo += mascote(418, 268, 0.95, "aponta", "", "feliz")
    return svg(corpo)


def cena_renda():
    tela = f"""
  <rect x="96" y="110" width="250" height="168" rx="12" fill="#F8FAFF"/>
  <rect x="116" y="126" width="92" height="132" rx="10" fill="url(#temaSec)"/>
  <rect x="128" y="146" width="66" height="10" rx="5" fill="#fff" opacity=".95"/><rect x="128" y="162" width="48" height="8" rx="4" fill="#fff" opacity=".7"/>
  <circle cx="162" cy="214" r="20" fill="#fff" opacity=".35"/>
  <rect x="224" y="132" width="104" height="12" rx="6" fill="#94A3B8"/><rect x="224" y="152" width="80" height="9" rx="4.5" fill="#CBD5E1"/>
  <rect x="224" y="178" width="78" height="30" rx="15" style="fill:{K}"/><text x="263" y="199" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="15" fill="#fff">R$ 97</text>
  <rect x="224" y="220" width="104" height="34" rx="17" fill="url(#tema)"/><text x="276" y="242" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="14" fill="#fff">Comprar</text>"""
    corpo = (f'<g filter="url(#sombra)"><rect x="80" y="94" width="282" height="200" rx="18" style="fill:{K}"/>{tela}'
             f'<path d="M50 300 h342 l-20 26 h-302z" fill="url(#vidroAz)" stroke="#fff" stroke-width="3"/></g>')
    # checklist de validação
    itens = "".join(f'<circle cx="{66}" cy="{392+i*40}" r="13" style="fill:{A if i < 2 else "#CBD5E1"}"/><path d="M60 {392+i*40} l5 5 l9 -10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="90" y="{386+i*40}" width="{110-i*16}" height="11" rx="5.5" fill="#CBD5E1"/>' for i in range(3))
    corpo += cartao(40, 360, 200, 136, 26, itens)
    # lâmpada (ideia)
    corpo += f'<g filter="url(#sombra)" transform="translate(470 60)"><circle cx="50" cy="50" r="58" style="fill:{S}" opacity=".35" filter="url(#brilho)"/><path d="M50 8 a40 40 0 0 1 24 72 v14 h-48 v-14 a40 40 0 0 1 24 -72z" fill="url(#vidro)" stroke="#fff" stroke-width="3"/><path d="M38 60 l12 12 l12 -12" fill="none" style="stroke:{T}" stroke-width="5" stroke-linecap="round"/><rect x="30" y="98" width="40" height="10" rx="5" style="fill:{K}"/></g>'
    corpo += brilho_estrela(420, 60, .9) + brilho_estrela(270, 360, .7, A)
    corpo += mascote(400, 266, 0.98, "comemora", "", "feliz", "riso")
    return svg(corpo)


def cena_pessoal():
    cel = ""
    for r in range(5):
        for c in range(4):
            x, y = 66 + c * 62, 132 + r * 40
            if r == 0:
                cel += f'<rect x="{x}" y="{y}" width="56" height="32" rx="7" fill="url(#tema)"/>'
            else:
                cor = A if (r + c) % 4 == 0 else (S if (r * c) % 5 == 1 else "#fff")
                op = ".85" if cor != "#fff" else "1"
                cel += f'<rect x="{x}" y="{y}" width="56" height="32" rx="7" style="fill:{cor}" opacity="{op}" stroke="#E2E8F0" stroke-width="1.5"/>'
                if cor == "#fff":
                    cel += f'<rect x="{x+10}" y="{y+12}" width="{26 + (r*c) % 12}" height="8" rx="4" fill="#CBD5E1"/>'
    corpo = cartao(44, 84, 296, 290, 30, f'<rect x="66" y="104" width="120" height="14" rx="7" style="fill:{K}"/>' + cel)
    # calendário de contas
    corpo += cartao(380, 50, 150, 150, 26, f'<rect x="380" y="50" width="150" height="44" rx="22" fill="url(#tema)"/><rect x="380" y="72" width="150" height="22" fill="url(#tema)"/><text x="455" y="80" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="18" fill="#fff">CONTAS</text><text x="455" y="164" text-anchor="middle" font-family="Inter Display,Inter,sans-serif" font-weight="800" font-size="62" style="fill:{K}">10</text>')
    # escudo da reserva
    corpo += f'<g filter="url(#sombra)" transform="translate(560 120)"><path d="M0 -10 L52 8 V48 C52 84 26 104 0 116 C-26 104 -52 84 -52 48 V8 Z" fill="url(#vidro)" stroke="#fff" stroke-width="3"/><path d="M-20 50 l14 14 l28 -30" fill="none" style="stroke:{T}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></g>'
    # cofrinho
    corpo += f"""<g filter="url(#sombra)" transform="translate(70 420)">
  <ellipse cx="90" cy="70" rx="84" ry="62" style="fill:{S}"/><ellipse cx="70" cy="44" rx="40" ry="16" fill="#fff" opacity=".35"/>
  <path d="M60 18 l14 -26 l16 22z" style="fill:{S}"/>
  <rect x="160" y="56" width="30" height="30" rx="12" style="fill:{S}"/><circle cx="170" cy="70" r="3.5" style="fill:{K}"/><circle cx="181" cy="70" r="3.5" style="fill:{K}"/>
  <circle cx="132" cy="50" r="6" style="fill:{K}"/>
  <rect x="34" y="118" width="22" height="22" rx="8" style="fill:{S}"/><rect x="118" y="118" width="22" height="22" rx="8" style="fill:{S}"/>
  <rect x="74" y="12" width="40" height="8" rx="4" style="fill:{K}" opacity=".6"/>
  <circle cx="94" cy="-26" r="22" fill="url(#tema)"/><text x="94" y="-19" text-anchor="middle" font-family="Inter,sans-serif" font-weight="800" font-size="18" fill="#fff">R$</text>
</g>"""
    corpo += brilho_estrela(360, 250, .8) + brilho_estrela(620, 300, .7, A)
    corpo += mascote(410, 276, 0.94, "aponta", "", "piscando")
    return svg(corpo)


def balao(x, y, texto, cor=T, r=34):
    return (f'<g filter="url(#sombra)"><circle cx="{x}" cy="{y}" r="{r}" fill="url(#vidro)" stroke="#fff" stroke-width="3"/>'
            f'<text x="{x}" y="{y + r * .38}" text-anchor="middle" font-family="Inter Display,Inter,sans-serif" font-weight="800" '
            f'font-size="{r * 1.15}" style="fill:{cor}">{texto}</text></g>')


def confete():
    cores = [A, S, T]
    return "".join(f'<rect x="{x}" y="{y}" width="12" height="6" rx="3" transform="rotate({rot} {x} {y})" style="fill:{cores[i % 3]}"/>'
                   for i, (x, y, rot) in enumerate([(-30, -20, 30), (230, -10, -25), (-10, 40, 60), (210, 50, -50), (40, -40, 10), (170, -35, 70)]))


def quadro():
    barras = "".join(f'<rect x="{20 + i * 30}" y="{86 - h}" width="20" height="{h}" rx="6" fill="url(#temaSec)"/>'
                     for i, h in enumerate([24, 40, 58, 72]))
    return (f'<g filter="url(#sombra)" transform="translate(218 60)"><rect width="150" height="110" rx="16" '
            f'fill="url(#vidro)" stroke="#fff" stroke-width="3"/>{barras}</g>')


POSES = {
    # nome: (pose dos braços, olhos, boca, extra, uso)
    "trix-ola": ("acena", "normal", "sorriso", "", "Abertura de aula e boas-vindas"),
    "trix-explica": ("aponta", "normal", "sorriso", "", "Explicação; aponta para o conteúdo à direita"),
    "trix-pensa": ("queixo", "pensando", "neutra", lambda: balao(196, 10, "?"), "Pergunta, reflexão, 'por que isso importa'"),
    "trix-alerta": ("baixo", "surpreso", "aberta", lambda: balao(196, 10, "!", "#E11D48"), "Erro comum, cuidado, atenção"),
    "trix-dica": ("acena", "piscando", "sorriso", lambda: balao(214, 40, "★"), "Dica rápida, atalho"),
    "trix-comemora": ("comemora", "feliz", "riso", lambda: confete(), "Conquista, fim de módulo, exercício concluído"),
    "trix-ok": ("aponta", "feliz", "sorriso", lambda: f'<g filter="url(#sombra)"><circle cx="226" cy="150" r="24" fill="url(#tema)"/><path d="M215 150 l8 8 l15 -16" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/></g>', "Confirmação, checklist, 'pronto'"),
    "trix-estuda": ("segura", "normal", "sorriso", lambda: f'<g filter="url(#sombra)"><rect x="52" y="196" width="96" height="62" rx="10" style="fill:{K}"/><rect x="60" y="204" width="80" height="44" rx="6" fill="#F8FAFF"/><rect x="68" y="212" width="40" height="7" rx="3.5" style="fill:{A}"/><rect x="68" y="224" width="56" height="6" rx="3" fill="#CBD5E1"/><rect x="68" y="235" width="44" height="6" rx="3" fill="#CBD5E1"/></g>', "Exercício, mão na massa, estudo"),
    "trix-apresenta": ("aponta", "normal", "aberta", lambda: quadro(), "Dados, resultados, comparação"),
}


def personagens(destino: Path):
    destino.mkdir(parents=True, exist_ok=True)
    for nome, (pose, olhos, boca, extra, _) in POSES.items():
        p = extra() if callable(extra) else extra
        corpo = mascote(0, 0, 1, pose, p, olhos, boca)
        (destino / f"{nome}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -70 440 390" width="100%" height="100%">{DEFS}{corpo}</svg>', encoding="utf-8")
    for o in ("normal", "feliz", "surpreso"):
        (destino / f"pixel-{o}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-70 -70 140 150" width="100%" height="100%">{DEFS}{pixel(0, 0, 1, o)}</svg>', encoding="utf-8")


if __name__ == "__main__":
    destino = Path(__file__).resolve().parent.parent / "marca" / "ilustracoes"
    destino.mkdir(parents=True, exist_ok=True)
    for nome, fn in {"ia": cena_ia, "marketing": cena_marketing, "renda": cena_renda, "pessoal": cena_pessoal}.items():
        (destino / f"{nome}.svg").write_text(fn(), encoding="utf-8")
    (destino / "mascote.svg").write_text(svg(mascote(190, 90, 1.6, "acena")), encoding="utf-8")
    personagens(destino.parent / "personagens")
    print("ilustrações e personagens gerados em", destino.parent)

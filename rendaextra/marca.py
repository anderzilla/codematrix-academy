"""Identidade visual CodeMatrix Academy: render de cenas/capas (Playwright) e extração de cores oficiais."""
from __future__ import annotations

import base64
import colorsys
import json
from contextlib import contextmanager
from pathlib import Path

from . import atividades
from .config import raiz

FORMATOS = {"16x9": (1920, 1080), "9x16": (1080, 1920), "1x1": (1080, 1080), "4x5": (1080, 1350), "thumb": (1280, 720)}


def tokens() -> dict:
    return json.loads((raiz() / "marca" / "tokens.json").read_text(encoding="utf-8"))


def _logo_data_uri() -> str | None:
    for nome in ("logo.png", "logo.webp", "logo.svg"):
        p = raiz() / "marca" / nome
        if p.exists():
            mime = {"png": "image/png", "webp": "image/webp", "svg": "image/svg+xml"}[p.suffix[1:]]
            return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()
    return None


COM_ILUSTRACAO_PADRAO = {"capa", "capa_produto", "thumb", "cta"}


def _ilustracao(cena: dict) -> str | None:
    """SVG da cena: `ilustracao` pode ser nome de arquivo em marca/ilustracoes, False para nenhuma,
    ou ausente (capas e CTA usam a ilustração do tema)."""
    escolha = cena.get("ilustracao", cena.get("tema", "ia") if cena.get("tipo") in COM_ILUSTRACAO_PADRAO else None)
    if not escolha:
        return None
    p = raiz() / "marca" / "ilustracoes" / f"{escolha}.svg"
    return p.read_text(encoding="utf-8") if p.exists() else None


@contextmanager
def navegador():
    try:
        from playwright.sync_api import sync_playwright  # noqa: PLC0415
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("Instale o Playwright: pip install playwright && python -m playwright install chromium") from e
    with sync_playwright() as pw:
        try:
            b = pw.chromium.launch()
        except Exception:  # usa o Chrome do sistema se o Chromium do Playwright não estiver instalado
            b = pw.chromium.launch(channel="chrome")
        try:
            yield b
        finally:
            b.close()


def render(cena: dict, saida: Path, formato: str = "16x9", sem_legenda: bool = False, browser=None) -> Path:
    """Desenha uma cena/capa no tamanho final e salva PNG."""
    w, h = FORMATOS[formato]
    tpl = (raiz() / "marca" / "templates" / "cena.html").resolve()
    script = (
        f"window.CENA={json.dumps(cena, ensure_ascii=False)};window.TOKENS={json.dumps(tokens(), ensure_ascii=False)};"
        f"window.FORMATO={json.dumps(formato)};window.SEM_LEGENDA={json.dumps(sem_legenda)};"
    )
    if cena.get("personagem"):
        pp = raiz() / "marca" / "personagens" / f"{cena['personagem']}.svg"
        if pp.exists():
            script += f"window.PERSONAGEM={json.dumps(pp.read_text(encoding='utf-8'))};"
    ilu = _ilustracao(cena)
    if ilu:
        script += f"window.ILUSTRACAO={json.dumps(ilu)};"
    logo = _logo_data_uri()
    if logo:
        script += f"window.LOGO={json.dumps(logo)};"

    def _fazer(b):
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
        pg.add_init_script(script)
        pg.goto(tpl.as_uri())
        pg.wait_for_function("document.body.dataset.pronto==='1'")
        pg.evaluate("document.fonts.ready")
        saida.parent.mkdir(parents=True, exist_ok=True)
        pg.screenshot(path=str(saida), type="png")
        pg.close()

    if browser is not None:
        _fazer(browser)
    else:
        with navegador() as b:
            _fazer(b)
    return saida


def capa(titulo: str, tema: str, formato: str = "1x1", subtitulo: str = "", selo: str = "Curso", saida: Path | None = None) -> Path:
    tipo = {"thumb": "thumb"}.get(formato, "capa_produto")
    saida = saida or raiz() / "saidas" / "marca" / f"capa-{tema}-{formato}.png"
    return render({"tipo": tipo, "titulo": titulo, "subtitulo": subtitulo, "selo": selo, "tema": tema}, saida, formato, sem_legenda=True)


# ------------------------------------------------------------------ cores oficiais

def _hex(rgb) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def extrair_cores(imagens: list[Path], n: int = 6) -> list[dict]:
    """Paleta dominante (sem branco/cinza) das imagens oficiais da marca."""
    from PIL import Image  # noqa: PLC0415

    contagem: dict[tuple, int] = {}
    for p in imagens:
        im = Image.open(p).convert("RGBA")
        im.thumbnail((300, 300))
        q = im.convert("RGB").quantize(colors=16, method=Image.Quantize.MEDIANCUT)
        pal = q.getpalette()
        for qtd, idx in q.getcolors():
            rgb = tuple(pal[idx * 3: idx * 3 + 3])
            _, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
            if s < 0.25 or l > 0.92 or l < 0.08:  # ignora branco, cinza e quase preto
                continue
            contagem[rgb] = contagem.get(rgb, 0) + qtd
    top = sorted(contagem.items(), key=lambda x: -x[1])[:n]
    total = sum(q for _, q in top) or 1
    return [{"hex": _hex(rgb), "peso": round(q / total, 3)} for rgb, q in top]


def aplicar_cor_primaria(hex_cor: str, modelo: str | None = None) -> None:
    p = raiz() / "marca" / "tokens.json"
    t = json.loads(p.read_text(encoding="utf-8"))
    antiga = t["marca"]["primaria"]
    t["marca"]["primaria"] = hex_cor
    t["temas"]["ia"]["acento"] = hex_cor
    t["_status"] = "primária alinhada às imagens oficiais; revise as cores dos temas"
    p.write_text(json.dumps(t, ensure_ascii=False, indent=2), encoding="utf-8")
    atividades.registrar("decisao", f"marca: cor primária {antiga} → {hex_cor} (extraída das imagens oficiais)", modelo=modelo,
                         arquivos=["marca/tokens.json"])

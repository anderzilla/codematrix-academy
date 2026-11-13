"""Conversor Markdown → HTML mínimo (sem dependências) e montagem da página de vendas."""
from __future__ import annotations

import html
import re
from pathlib import Path

TEMPLATE = Path(__file__).parent / "templates" / "pagina_vendas.html"


def _inline(t: str) -> str:
    t = html.escape(t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"\*(.+?)\*", r"<em>\1</em>", t)
    return t


def md_para_html(md: str) -> str:
    out, lista = [], None
    for linha in md.splitlines():
        s = linha.rstrip()
        m_ul = re.match(r"^\s*[-*]\s+(.*)", s)
        m_ol = re.match(r"^\s*\d+[.)]\s+(.*)", s)
        if m_ul or m_ol:
            tipo = "ul" if m_ul else "ol"
            if lista != tipo:
                if lista:
                    out.append(f"</{lista}>")
                out.append(f"<{tipo}>")
                lista = tipo
            out.append(f"<li>{_inline((m_ul or m_ol).group(1))}</li>")
            continue
        if lista:
            out.append(f"</{lista}>")
            lista = None
        h = re.match(r"^(#{1,4})\s+(.*)", s)
        if h:
            n = len(h.group(1))
            out.append(f"<h{n}>{_inline(h.group(2))}</h{n}>")
        elif s.strip():
            out.append(f"<p>{_inline(s.strip())}</p>")
    if lista:
        out.append(f"</{lista}>")
    return "\n".join(out)


def pagina(copy_md: str, titulo: str, checkout_url: str = "#CHECKOUT", marca: str = "") -> str:
    corpo = md_para_html(copy_md)
    tpl = TEMPLATE.read_text(encoding="utf-8")
    return (
        tpl.replace("{{TITULO}}", html.escape(titulo))
        .replace("{{MARCA}}", html.escape(marca))
        .replace("{{CHECKOUT}}", html.escape(checkout_url))
        .replace("{{CORPO}}", corpo)
    )

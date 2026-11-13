"""RAG local: indexa kb/*.md em trechos, embeddings do Ollama, busca por cosseno.

Cai para busca por palavras-chave quando os embeddings não estão disponíveis.
"""
from __future__ import annotations

import json
import math
import re

from . import llm
from .config import caminho
from .db import sessao


def _trechos(texto: str, max_chars: int = 900) -> list[tuple[str, str]]:
    partes, titulo, buf = [], "", []
    for linha in texto.splitlines():
        if linha.startswith("#"):
            if buf:
                partes.append((titulo, "\n".join(buf).strip()))
                buf = []
            titulo = linha.lstrip("# ").strip()
        else:
            buf.append(linha)
            if sum(len(x) for x in buf) > max_chars:
                partes.append((titulo, "\n".join(buf).strip()))
                buf = []
    if buf:
        partes.append((titulo, "\n".join(buf).strip()))
    return [(t, x) for t, x in partes if x]


def indexar() -> int:
    pasta = caminho("kb")
    itens = []
    for arq in sorted(pasta.glob("**/*.md")):
        for titulo, texto in _trechos(arq.read_text(encoding="utf-8")):
            itens.append((arq.name, titulo, texto))
    try:
        vetores = llm.embed([f"{t}\n{x}" for _, t, x in itens]) if itens else []
    except llm.IAIndisponivel:
        vetores = [None] * len(itens)
    with sessao() as con:
        con.execute("DELETE FROM kb_chunks")
        con.executemany(
            "INSERT INTO kb_chunks(arquivo,titulo,texto,vetor) VALUES (?,?,?,?)",
            [(a, t, x, json.dumps(v) if v else None) for (a, t, x), v in zip(itens, vetores)],
        )
    return len(itens)


def _cos(a, b) -> float:
    num = sum(x * y for x, y in zip(a, b))
    den = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return num / den if den else 0.0


def buscar(pergunta: str, k: int = 3) -> list[dict]:
    with sessao() as con:
        rows = [dict(r) for r in con.execute("SELECT arquivo,titulo,texto,vetor FROM kb_chunks")]
    if not rows:
        return []
    try:
        qv = llm.embed([pergunta])[0] if rows[0]["vetor"] else None
    except llm.IAIndisponivel:
        qv = None
    if qv:
        for r in rows:
            r["score"] = _cos(qv, json.loads(r["vetor"])) if r["vetor"] else 0.0
    else:
        termos = set(re.findall(r"\w{4,}", pergunta.lower()))
        for r in rows:
            r["score"] = len(termos & set(re.findall(r"\w{4,}", (r["titulo"] + " " + r["texto"]).lower())))
    rows.sort(key=lambda r: r["score"], reverse=True)
    return [{k2: r[k2] for k2 in ("arquivo", "titulo", "texto", "score")} for r in rows[:k]]


def contexto(pergunta: str, k: int = 3) -> str:
    """Bloco curto de contexto para colar no prompt (economiza tokens)."""
    return "\n\n".join(f"[{r['arquivo']} › {r['titulo']}]\n{r['texto']}" for r in buscar(pergunta, k))

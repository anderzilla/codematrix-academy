"""Regras de negócio (RN) e de cursos (RC) em regras/, com índice e checagens automáticas."""
from __future__ import annotations

from datetime import date
from pathlib import Path

import yaml

from . import atividades, frontmatter
from .config import raiz

PASTAS = {"RN": "negocio", "RC": "cursos"}


def _pasta() -> Path:
    return raiz() / "regras"


def listar(status: str | None = None) -> list[dict]:
    saida = []
    for pref, sub in PASTAS.items():
        for arq in sorted((_pasta() / sub).glob(f"{pref}-*.md")):
            meta, corpo = frontmatter.ler(arq)
            meta.update(texto=corpo, arquivo=str(arq.relative_to(raiz())))
            if not status or meta.get("status") == status:
                saida.append(meta)
    return saida


def automaticas() -> list[dict]:
    p = _pasta() / "automaticas.yaml"
    return yaml.safe_load(p.read_text(encoding="utf-8")) if p.exists() else []


def nova(tipo: str, titulo: str, texto: str, origem: str, verificacao: str = "manual", modelo: str | None = None) -> str:
    tipo = tipo.upper()
    pasta = _pasta() / PASTAS[tipo]
    nums = [int(p.stem.split("-")[1]) for p in pasta.glob(f"{tipo}-*.md")]
    rid = f"{tipo}-{(max(nums) + 1) if nums else 1:03d}"
    frontmatter.escrever(pasta / f"{rid}.md", {
        "id": rid, "titulo": titulo, "status": "proposta", "origem": origem,
        "data": date.today().isoformat(), "verificacao": verificacao,
    }, texto)
    gerar_indice()
    atividades.registrar("regra", f"{rid} proposta: {titulo}. Origem: {origem}", modelo=modelo,
                         arquivos=[f"regras/{PASTAS[tipo]}/{rid}.md"])
    return rid


def mudar_status(rid: str, status: str, motivo: str = "", modelo: str | None = None) -> None:
    arq = _pasta() / PASTAS[rid.split("-")[0].upper()] / f"{rid.upper()}.md"
    meta, corpo = frontmatter.ler(arq)
    meta["status"] = status
    if motivo:
        meta["motivo_status"] = motivo
    frontmatter.escrever(arq, meta, corpo)
    gerar_indice()
    atividades.registrar("regra", f"{rid} → {status}. {motivo}".strip(), modelo=modelo)


def gerar_indice() -> Path:
    linhas = ["# Índice de regras (gerado por `rex regra indice` — não edite à mão)", ""]
    for pref, sub in PASTAS.items():
        linhas += [f"## {'Negócio' if pref == 'RN' else 'Cursos'}", "", "| ID | Status | Título | Verificação |", "|---|---|---|---|"]
        for r in [x for x in listar() if x["id"].startswith(pref)]:
            linhas.append(f"| [{r['id']}]({sub}/{r['id']}.md) | {r['status']} | {r['titulo']} | {r.get('verificacao', '')} |")
        linhas.append("")
    p = _pasta() / "INDICE.md"
    p.write_text("\n".join(linhas), encoding="utf-8")
    return p


def resumo_para_prompt(somente_ativas: bool = True) -> str:
    """Uma linha por regra: barato de colar em qualquer prompt."""
    return "\n".join(f"- {r['id']}: {r['titulo']}" for r in listar("ativa" if somente_ativas else None))

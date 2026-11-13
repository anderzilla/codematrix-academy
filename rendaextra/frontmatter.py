"""Leitura de Markdown com cabeçalho YAML (--- ... ---)."""
from __future__ import annotations

from pathlib import Path

import yaml


def ler(caminho: Path) -> tuple[dict, str]:
    texto = caminho.read_text(encoding="utf-8")
    if texto.startswith("---"):
        partes = texto.split("---", 2)
        if len(partes) == 3:
            return yaml.safe_load(partes[1]) or {}, partes[2].strip()
    return {}, texto.strip()


def escrever(caminho: Path, meta: dict, corpo: str) -> None:
    cab = yaml.safe_dump(meta, allow_unicode=True, sort_keys=False).strip()
    caminho.write_text(f"---\n{cab}\n---\n{corpo.strip()}\n", encoding="utf-8")

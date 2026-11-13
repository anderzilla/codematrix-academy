"""Carrega config/settings.yaml e config/temas.yaml, com sobrescrita por variáveis de ambiente."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import yaml


def raiz() -> Path:
    """Pasta da fábrica (onde está config/settings.yaml)."""
    env = os.environ.get("REX_ROOT")
    if env:
        return Path(env).resolve()
    aqui = Path(__file__).resolve().parent.parent
    return aqui


@lru_cache(maxsize=1)
def settings() -> dict:
    caminho = raiz() / "config" / "settings.yaml"
    with open(caminho, encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    if os.environ.get("REX_OLLAMA_HOST"):
        cfg.setdefault("ia_local", {})["host"] = os.environ["REX_OLLAMA_HOST"]
    if os.environ.get("REX_DB_PATH"):
        cfg.setdefault("caminhos", {})["db"] = os.environ["REX_DB_PATH"]
    if os.environ.get("REX_SAIDAS"):
        cfg.setdefault("caminhos", {})["saidas"] = os.environ["REX_SAIDAS"]
    if os.environ.get("REX_SEM_IA_PAGA") == "1":
        cfg.setdefault("ia_paga", {})["habilitada"] = False
    return cfg


@lru_cache(maxsize=1)
def temas() -> list[dict]:
    with open(raiz() / "config" / "temas.yaml", encoding="utf-8") as f:
        return (yaml.safe_load(f) or {}).get("temas", [])


def caminho(chave: str) -> Path:
    p = Path(settings().get("caminhos", {}).get(chave, chave))
    return p if p.is_absolute() else raiz() / p


def limpar_cache() -> None:
    settings.cache_clear()
    temas.cache_clear()

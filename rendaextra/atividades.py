"""Log de atividades compartilhado entre modelos (Claude, Codex, Gemini, Grok, Ollama, Nemotron...).

Dois formatos do mesmo registro:
- LOG-ATIVIDADES.md  → leitura humana e por qualquer IA (mais recente no topo da seção de entradas)
- log/atividades.jsonl → leitura por script
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

from .config import raiz

TIPOS = ("melhoria", "regra", "skill", "aprendizado", "erro", "decisao", "execucao")
MARCADOR = "<!-- ENTRADAS: novas entradas são inseridas logo abaixo desta linha -->"


def _arquivos():
    if os.environ.get("REX_LOG_DIR"):  # testes e ensaios não poluem o log real
        d = Path(os.environ["REX_LOG_DIR"])
        d.mkdir(parents=True, exist_ok=True)
        return d / "LOG-ATIVIDADES.md", d / "atividades.jsonl"
    r = raiz()
    (r / "log").mkdir(exist_ok=True)
    return r / "LOG-ATIVIDADES.md", r / "log" / "atividades.jsonl"


def registrar(tipo: str, texto: str, modelo: str | None = None, agente: str | None = None,
              arquivos: list[str] | None = None, automatico: bool = False) -> dict:
    if tipo not in TIPOS:
        raise ValueError(f"tipo deve ser um de {TIPOS}")
    entrada = {
        "data": datetime.now().isoformat(timespec="minutes"),
        "tipo": tipo,
        "modelo": modelo or os.environ.get("REX_MODELO", "nao-informado"),
        "agente": agente or "-",
        "texto": texto.strip(),
        "arquivos": arquivos or [],
    }
    md, jl = _arquivos()
    with open(jl, "a", encoding="utf-8") as f:
        f.write(json.dumps(entrada, ensure_ascii=False) + "\n")
    if automatico and tipo == "execucao":
        return entrada  # execuções rotineiras ficam só no jsonl, para não poluir o .md
    bloco = (
        f"\n### {entrada['data'].replace('T', ' ')} · {tipo} · {entrada['modelo']}"
        + (f" · {entrada['agente']}" if entrada["agente"] != "-" else "")
        + f"\n{entrada['texto']}\n"
        + (f"Arquivos: {', '.join(entrada['arquivos'])}\n" if entrada["arquivos"] else "")
    )
    conteudo = md.read_text(encoding="utf-8") if md.exists() else f"# LOG DE ATIVIDADES\n\n{MARCADOR}\n"
    if MARCADOR not in conteudo:
        conteudo += f"\n{MARCADOR}\n"
    md.write_text(conteudo.replace(MARCADOR, MARCADOR + "\n" + bloco, 1), encoding="utf-8")
    return entrada


def ultimas(n: int = 20, tipo: str | None = None) -> list[dict]:
    _, jl = _arquivos()
    if not jl.exists():
        return []
    linhas = [json.loads(x) for x in jl.read_text(encoding="utf-8").splitlines() if x.strip()]
    if tipo:
        linhas = [x for x in linhas if x["tipo"] == tipo]
    return linhas[-n:][::-1]


def resumo_para_prompt(n: int = 8) -> str:
    """Contexto curto para outro modelo saber o que mudou (regras novas, skills, aprendizados)."""
    itens = [x for x in ultimas(60) if x["tipo"] in ("regra", "skill", "aprendizado", "melhoria", "decisao")][:n]
    return "\n".join(f"- {x['data'][:10]} [{x['tipo']}] {x['texto'][:200]}" for x in itens)

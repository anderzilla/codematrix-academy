"""Time de agentes: carregamento, prompt de sistema, painel de revisão e exportação para outros modelos."""
from __future__ import annotations

import re
import shutil
from functools import lru_cache
from pathlib import Path

import yaml

from . import atividades, frontmatter, llm, regras
from .config import raiz, settings

PROMPT_PARECER = """Você é {nome}. Dê seu parecer sobre a etapa "{etapa}" da oferta abaixo,
seguindo estritamente seu papel. Seja específico: cite o trecho e diga a correção.

Regras ativas do projeto (resumo):
{regras}

Material:
{material}

Responda neste formato exato:
VEREDITO: APROVADO | AJUSTAR | BLOQUEAR
RISCO: baixo | medio | alto
PONTOS:
- trecho ou item → problema → correção
AÇÃO: uma frase
"""


@lru_cache(maxsize=1)
def todos() -> dict[str, dict]:
    saida = {}
    for arq in sorted((raiz() / "agentes").glob("*/*.md")):
        meta, corpo = frontmatter.ler(arq)
        if meta.get("id"):
            meta.update(corpo=corpo, arquivo=str(arq.relative_to(raiz())))
            saida[meta["id"]] = meta
    return saida


def time() -> dict:
    return yaml.safe_load((raiz() / "agentes" / "time.yaml").read_text(encoding="utf-8"))


def sistema(agente_id: str, com_contexto: bool = True) -> str:
    a = todos().get(agente_id)
    if not a:
        return ""
    partes = [a["corpo"]]
    if com_contexto:
        partes.append("Regras ativas:\n" + regras.resumo_para_prompt())
        log = atividades.resumo_para_prompt(5)
        if log:
            partes.append("Mudanças recentes do projeto:\n" + log)
    return "\n\n".join(partes)


def _veredito(texto: str) -> str:
    m = re.search(r"VEREDITO:\s*\**\s*(APROVADO|AJUSTAR|BLOQUEAR)", texto, flags=re.I)
    return m.group(1).upper() if m else "SEM_VEREDITO"


ARQUIVOS_CURSO = {  # quando a pasta é um curso (cursos/<id>/ com curso.yaml)
    "oferta": ["curso.yaml"],
    "conteudo": ["pocket/roteiros/*.md", "completo/roteiros/*.md"],
    "visual": ["pocket/cenas/*.json"],
    "pagina": ["paginas/pocket.md", "paginas/completo.md"],
    "campanha": ["marketing/anuncios.md", "marketing/calendario-7-dias.md"],
    "venda": ["curso.yaml", "kiwify/montagem.md"],
    "publicacao": ["paginas/pocket.md", "paginas/completo.md", "retencao/jornada.md"],
}
LIMITE_MATERIAL = 12000  # caracteres por parecer (modelos locais têm contexto curto)


def _arquivos_da_etapa(pasta: Path, etapa: dict) -> list[Path]:
    if (pasta / "curso.yaml").exists():
        saida = []
        for padrao in ARQUIVOS_CURSO.get(etapa["id"], []):
            saida += sorted(pasta.glob(padrao))
        return saida
    return [pasta / f for f in etapa.get("arquivos", []) if (pasta / f).exists()]


def painel(pasta: Path, etapas: list[str] | None = None, motor: str | None = None) -> list[dict]:
    """Roda os revisores de cada etapa sobre os arquivos da etapa e grava pareceres/<etapa>__<agente>.md."""
    t = time()
    etapas = etapas or t.get("revisao_automatica_no_dia", [])
    destino = pasta / "pareceres"
    destino.mkdir(exist_ok=True)
    resultado = []
    for e in t["etapas"]:
        if e["id"] not in etapas:
            continue
        material = "\n\n".join(
            f"### {f.relative_to(pasta)}\n{f.read_text(encoding='utf-8')[:6000]}" for f in _arquivos_da_etapa(pasta, e)
        )[:LIMITE_MATERIAL]
        if not material:
            continue
        for rid in e["revisores"]:
            a = todos().get(rid)
            if not a:
                continue
            etapa_motor = motor or ("local" if a.get("modelo_sugerido", "local").startswith("local") else
                                    a["modelo_sugerido"].split(":", 1)[1])
            texto = llm.gerar(
                "painel_revisao",
                PROMPT_PARECER.format(nome=a["nome"], etapa=e["nome"], regras=regras.resumo_para_prompt(), material=material),
                sistema(rid, com_contexto=False),
                motor=etapa_motor,
            )
            v = _veredito(texto)
            (destino / f"{e['id']}__{rid}.md").write_text(f"# Parecer — {a['nome']} — {e['nome']}\n\n{texto}\n", encoding="utf-8")
            resultado.append({"etapa": e["id"], "agente": rid, "veredito": v})
    linhas = ["# Painel de revisão", "", "| Etapa | Agente | Veredito |", "|---|---|---|"]
    linhas += [f"| {r['etapa']} | {r['agente']} | **{r['veredito']}** |" for r in resultado]
    (destino / "RESUMO.md").write_text("\n".join(linhas) + "\n", encoding="utf-8")
    return resultado


def bloqueios(pasta: Path) -> list[str]:
    d = pasta / "pareceres"
    if not d.exists():
        return []
    return [p.stem for p in d.glob("*__*.md") if _veredito(p.read_text(encoding="utf-8")) == "BLOQUEAR"]


# ------------------------------------------------------------------ adaptadores para outros modelos

def modelfile(agente_id: str, base: str) -> str:
    corpo = sistema(agente_id).replace('"""', "'''")
    return f'FROM {base}\nPARAMETER temperature 0.6\nPARAMETER num_ctx 8192\nSYSTEM """\n{corpo}\n"""\n'


def sincronizar(modelo: str | None = None) -> dict:
    """Fonte única → adaptadores: skills, GEMINI.md, prompts Grok/genéricos, Modelfiles Ollama/Nemotron, índice de regras."""
    r = raiz()
    todos.cache_clear()
    regras.gerar_indice()

    # skills canônicas em skills/ → .claude/skills (Claude Code descobre lá)
    origem, alvo = r / "skills", r / ".claude" / "skills"
    if alvo.exists():
        shutil.rmtree(alvo)
    shutil.copytree(origem, alvo)

    # GEMINI.md (Gemini CLI) = AGENTS.md
    agents_md = (r / "AGENTS.md").read_text(encoding="utf-8")
    (r / "GEMINI.md").write_text("<!-- gerado por `rex sincronizar` a partir de AGENTS.md; não edite -->\n" + agents_md, encoding="utf-8")

    # prompts de sistema para colar em qualquer chat (Grok, ChatGPT, Gemini web...)
    pdir = r / "adaptadores" / "prompts"
    pdir.mkdir(parents=True, exist_ok=True)
    for aid in todos():
        (pdir / f"{aid}.txt").write_text(sistema(aid), encoding="utf-8")

    # Modelfiles para Ollama: base padrão e Nemotron
    bases = {"ollama": settings()["ia_local"]["modelos"]["texto"], "nemotron": "nemotron-mini"}
    for nome, base in bases.items():
        d = r / "adaptadores" / nome
        d.mkdir(parents=True, exist_ok=True)
        for aid in todos():
            (d / f"cma-{aid}.Modelfile").write_text(modelfile(aid, base), encoding="utf-8")
        cmds = "\n".join(f"ollama create cma-{aid}{'-nemo' if nome == 'nemotron' else ''} -f cma-{aid}.Modelfile" for aid in todos())
        (d / "criar-modelos.sh").write_text("#!/usr/bin/env sh\ncd \"$(dirname \"$0\")\"\n" + cmds + "\n", encoding="utf-8")
        (d / "criar-modelos.ps1").write_text("Set-Location $PSScriptRoot\n" + cmds + "\n", encoding="utf-8")

    res = {"agentes": len(todos()), "skills": len(list(origem.glob("*/SKILL.md"))), "regras": len(regras.listar())}
    atividades.registrar("execucao", f"sincronizar: {res}", modelo=modelo, automatico=True)
    return res

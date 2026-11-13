"""Roteador de IA: Ollama local primeiro, IA paga só nas etapas marcadas, com cache e teto de gasto.

Variável REX_LLM_FAKE=1 devolve respostas simuladas (testes e ensaio sem GPU).
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, time

import requests

from . import credentials
from .config import settings
from .db import agora, sessao


class IAIndisponivel(RuntimeError):
    pass


def _chave_cache(modelo: str, sistema: str, prompt: str) -> str:
    return hashlib.sha256(f"{modelo}\x00{sistema}\x00{prompt}".encode()).hexdigest()


def _na_janela_bloqueada(agora_dt: datetime | None = None) -> bool:
    janela = settings().get("ia_local", {}).get("janela_bloqueada")
    if not janela:
        return False
    ini, fim = (time.fromisoformat(h) for h in janela)
    t = (agora_dt or datetime.now()).time()
    return ini <= t < fim if ini < fim else (t >= ini or t < fim)


def gasto_mes_usd() -> float:
    mes = datetime.now().strftime("%Y-%m")
    with sessao() as con:
        r = con.execute(
            "SELECT COALESCE(SUM(custo_usd),0) FROM llm_uso WHERE substr(data,1,7)=?", (mes,)
        ).fetchone()
    return float(r[0])


def _registrar(etapa, motor, modelo, te, ts, custo, cache):
    with sessao() as con:
        con.execute(
            "INSERT INTO llm_uso(data,etapa,motor,modelo,tokens_entrada,tokens_saida,custo_usd,cache)"
            " VALUES (?,?,?,?,?,?,?,?)",
            (agora(), etapa, motor, modelo, te, ts, custo, int(cache)),
        )


# ---------------------------------------------------------------- provedores

def _ollama_chat(modelo: str, sistema: str, prompt: str) -> tuple[str, int, int]:
    cfg = settings()["ia_local"]
    if _na_janela_bloqueada():
        raise IAIndisponivel("Janela 00:00–06:00 reservada no servidor de IA local.")
    try:
        r = requests.post(
            cfg["host"].rstrip("/") + "/api/chat",
            json={
                "model": modelo,
                "stream": False,
                "messages": [{"role": "system", "content": sistema}, {"role": "user", "content": prompt}],
                "options": {"temperature": 0.7, "num_ctx": 8192},
            },
            timeout=cfg.get("timeout_s", 600),
        )
        r.raise_for_status()
    except requests.RequestException as e:
        raise IAIndisponivel(f"Ollama indisponível em {cfg['host']}: {e}") from e
    d = r.json()
    return d["message"]["content"], d.get("prompt_eval_count", 0), d.get("eval_count", 0)


def _anthropic(modelo: str, sistema: str, prompt: str) -> tuple[str, int, int]:
    chave = credentials.obter("anthropic_api_key")
    if not chave:
        raise IAIndisponivel("Sem anthropic_api_key no cofre.")
    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        json={
            "model": modelo,
            "max_tokens": settings()["ia_paga"].get("max_tokens_saida", 4000),
            "system": sistema,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=300,
    )
    if r.status_code >= 400:
        raise IAIndisponivel(f"Anthropic {r.status_code}: {r.text[:200]}")
    d = r.json()
    texto = "".join(b.get("text", "") for b in d.get("content", []) if b.get("type") == "text")
    u = d.get("usage", {})
    return texto, u.get("input_tokens", 0), u.get("output_tokens", 0)


def _openai(modelo: str, sistema: str, prompt: str) -> tuple[str, int, int]:
    chave = credentials.obter("openai_api_key")
    if not chave:
        raise IAIndisponivel("Sem openai_api_key no cofre.")
    r = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {chave}"},
        json={"model": modelo, "messages": [{"role": "system", "content": sistema}, {"role": "user", "content": prompt}]},
        timeout=300,
    )
    if r.status_code >= 400:
        raise IAIndisponivel(f"OpenAI {r.status_code}: {r.text[:200]}")
    d = r.json()
    u = d.get("usage", {})
    return d["choices"][0]["message"]["content"], u.get("prompt_tokens", 0), u.get("completion_tokens", 0)


def _fake(modelo: str, sistema: str, prompt: str) -> tuple[str, int, int]:
    titulo = prompt.strip().splitlines()[0][:80]
    texto = (
        f"# Rascunho simulado ({modelo})\n\n## Resumo\nConteúdo de ensaio para: {titulo}.\n\n"
        "## Seções\n- Item 1: explicação prática.\n- Item 2: exemplo aplicado.\n- Item 3: exercício.\n\n"
        "## Próximo passo\nRevise e substitua por conteúdo gerado pelo modelo real."
    )
    return texto, len(prompt) // 4, len(texto) // 4


# ---------------------------------------------------------------- API pública

def gerar(etapa: str, prompt: str, sistema: str = "", motor: str | None = None, usar_cache: bool = True) -> str:
    """Gera texto para uma etapa do pipeline respeitando roteamento, teto e cache."""
    cfg = settings()
    motor = motor or cfg.get("roteamento", {}).get(etapa, "local")
    pago_cfg = cfg.get("ia_paga", {})

    if motor != "local":
        if not pago_cfg.get("habilitada"):
            motor = "local"
        elif gasto_mes_usd() >= float(pago_cfg.get("teto_mensal_usd", 0)):
            motor = "local"

    if os.environ.get("REX_LLM_FAKE") == "1":
        modelo, fn = "fake", _fake
    elif motor == "local":
        tipo = "rapido" if etapa in ("pontuar_oportunidade", "resumo_concorrente") else "texto"
        modelo, fn = cfg["ia_local"]["modelos"][tipo], _ollama_chat
    else:
        modelo = pago_cfg["modelos"][motor]
        fn = _anthropic if pago_cfg.get("provedor") == "anthropic" else _openai

    chave = _chave_cache(modelo, sistema, prompt)
    if usar_cache:
        with sessao() as con:
            hit = con.execute("SELECT resposta FROM llm_cache WHERE chave=?", (chave,)).fetchone()
        if hit:
            _registrar(etapa, motor, modelo, 0, 0, 0.0, True)
            return hit["resposta"]

    try:
        texto, te, ts = fn(modelo, sistema, prompt)
    except IAIndisponivel:
        if motor != "local" and os.environ.get("REX_LLM_FAKE") != "1":
            # IA paga falhou: cai para o Ollama, nunca o contrário (evita gasto surpresa)
            return gerar(etapa, prompt, sistema, motor="local", usar_cache=usar_cache)
        raise

    custo = 0.0
    if motor != "local" and modelo != "fake":
        p = pago_cfg.get("precos_usd_mtok", {}).get(modelo, {"entrada": 0, "saida": 0})
        custo = te / 1e6 * p["entrada"] + ts / 1e6 * p["saida"]
    _registrar(etapa, motor, modelo, te, ts, custo, False)
    with sessao() as con:
        con.execute(
            "INSERT OR REPLACE INTO llm_cache(chave,modelo,resposta,criado_em) VALUES (?,?,?,?)",
            (chave, modelo, texto, agora()),
        )
    return texto


def embed(textos: list[str]) -> list[list[float]]:
    if os.environ.get("REX_LLM_FAKE") == "1":
        return [_vetor_fake(t) for t in textos]
    cfg = settings()["ia_local"]
    if _na_janela_bloqueada():
        raise IAIndisponivel("Janela reservada no servidor de IA local.")
    try:
        r = requests.post(
            cfg["host"].rstrip("/") + "/api/embed",
            json={"model": cfg["modelos"]["embeddings"], "input": textos},
            timeout=cfg.get("timeout_s", 600),
        )
        r.raise_for_status()
    except requests.RequestException as e:
        raise IAIndisponivel(f"Embeddings indisponíveis: {e}") from e
    return r.json()["embeddings"]


def _vetor_fake(t: str, dim: int = 64) -> list[float]:
    v = [0.0] * dim
    for palavra in t.lower().split():
        v[int(hashlib.md5(palavra.encode()).hexdigest(), 16) % dim] += 1.0
    return v


def status_ollama() -> dict:
    cfg = settings()["ia_local"]
    try:
        r = requests.get(cfg["host"].rstrip("/") + "/api/tags", timeout=5)
        r.raise_for_status()
        modelos = [m["name"] for m in r.json().get("models", [])]
        faltando = [m for m in cfg["modelos"].values() if not any(x.startswith(m) for x in modelos)]
        return {"ok": True, "modelos": modelos, "faltando": faltando}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "erro": str(e)}


def resumo_custos() -> dict:
    mes = datetime.now().strftime("%Y-%m")
    with sessao() as con:
        rows = con.execute(
            "SELECT motor, COUNT(*) n, SUM(cache) hits, SUM(custo_usd) custo,"
            " SUM(tokens_entrada+tokens_saida) tokens FROM llm_uso WHERE substr(data,1,7)=? GROUP BY motor",
            (mes,),
        ).fetchall()
    return {"mes": mes, "teto_usd": settings()["ia_paga"].get("teto_mensal_usd"), "por_motor": [dict(r) for r in rows]}


def extrair_json(texto: str):
    """Extrai o primeiro bloco JSON de uma resposta (modelos locais às vezes cercam com texto)."""
    ini = min([i for i in (texto.find("{"), texto.find("[")) if i >= 0], default=-1)
    if ini < 0:
        raise ValueError("Resposta sem JSON")
    for fim in range(len(texto), ini, -1):
        try:
            return json.loads(texto[ini:fim])
        except json.JSONDecodeError:
            continue
    raise ValueError("JSON inválido na resposta")

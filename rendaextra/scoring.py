"""Score de oportunidade (0–10) e conta de lucro líquido por venda."""
from __future__ import annotations

from .config import settings

PESOS = {"demanda": 0.30, "vantagem": 0.25, "velocidade": 0.20, "concorrencia": 0.15, "risco": 0.10}


def score(demanda: int, concorrencia: int, vantagem: int, velocidade: int, risco: int, preco: float = 0) -> float:
    """Notas de 1 a 5. Concorrência e risco altos reduzem o score."""
    base = (
        PESOS["demanda"] * demanda
        + PESOS["vantagem"] * vantagem
        + PESOS["velocidade"] * velocidade
        + PESOS["concorrencia"] * (6 - concorrencia)
        + PESOS["risco"] * (6 - risco)
    )
    s = base * 2  # escala 0–10
    # leve bônus para ticket médio (margem suporta anúncio) e penalidade para muito barato
    if preco >= 197:
        s += 0.3
    elif 0 < preco < 47:
        s -= 0.5
    return round(max(0.0, min(10.0, s)), 2)


def liquido_por_venda(preco: float, plataforma: str | None = None) -> float:
    cfg = settings()["financeiro"]
    plat = cfg[plataforma or settings()["marca"].get("plataforma_principal", "kiwify")]
    return round(preco - preco * plat["percentual"] - plat["fixo"] - preco * cfg["imposto_sobre_faturamento"], 2)


def cpa_maximo(preco: float, plataforma: str | None = None) -> float:
    """CPA no gerenciador de anúncios acima do qual a venda dá prejuízo."""
    return round(liquido_por_venda(preco, plataforma) / (1 + settings()["financeiro"]["acrescimo_imposto_anuncio_meta"]), 2)


def vendas_para_meta(preco: float, cpa: float = 0.0, plataforma: str | None = None) -> float | None:
    margem = liquido_por_venda(preco, plataforma) - cpa * (1 + settings()["financeiro"]["acrescimo_imposto_anuncio_meta"])
    if margem <= 0:
        return None
    return round(settings()["financeiro"]["meta_lucro_liquido_mensal"] / margem, 1)

"""Sync de vendas, métricas por oferta, decisões automáticas e análise semanal."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from . import llm, prompts, scoring
from .config import caminho, settings
from .db import evento, sessao

APROVADAS = ("approved", "paid", "complete", "completed")
REEMBOLSO = ("refunded", "chargedback", "chargeback", "cancelled")


def sync(dias: int = 30) -> dict:
    from .integrations.hotmart import Hotmart
    from .integrations.kiwify import Kiwify
    from . import credentials

    fim, inicio = date.today(), date.today() - timedelta(days=dias)
    resultado = {}
    for nome, grupo, cls in (("kiwify", "kiwify", Kiwify), ("hotmart", "hotmart", Hotmart)):
        if not credentials.tem(grupo):
            resultado[nome] = "sem credenciais"
            continue
        try:
            vendas = cls().vendas(inicio, fim)
        except Exception as e:  # noqa: BLE001
            resultado[nome] = f"erro: {e}"
            continue
        with sessao() as con:
            con.executemany(
                "INSERT OR REPLACE INTO vendas(plataforma,pedido_id,produto_id,produto_nome,status,valor_bruto,"
                "valor_liquido,comprador_hash,data) VALUES (:plataforma,:pedido_id,:produto_id,:produto_nome,:status,"
                ":valor_bruto,:valor_liquido,:comprador_hash,:data)",
                vendas,
            )
        resultado[nome] = len(vendas)
    evento("sync", str(resultado))
    return resultado


def metricas(dias: int = 30) -> list[dict]:
    desde = (datetime.now() - timedelta(days=dias)).isoformat()
    cfg = settings()
    with sessao() as con:
        ofertas = [dict(r) for r in con.execute(
            "SELECT o.*, p.tema, p.titulo FROM ofertas o JOIN oportunidades p ON p.id=o.oportunidade_id")]
        for of in ofertas:
            rows = con.execute(
                "SELECT status, valor_bruto, valor_liquido FROM vendas WHERE produto_id=? AND plataforma=? AND data>=?",
                (of["produto_id"], of["plataforma"], desde),
            ).fetchall() if of["produto_id"] else []
            ok = [r for r in rows if (r["status"] or "").lower() in APROVADAS]
            reemb = [r for r in rows if (r["status"] or "").lower() in REEMBOLSO]
            bruto = sum(r["valor_bruto"] or of["preco"] or 0 for r in ok)
            liq = sum(
                (r["valor_liquido"] if r["valor_liquido"] is not None else scoring.liquido_por_venda(r["valor_bruto"] or of["preco"], of["plataforma"]))
                - (r["valor_bruto"] or of["preco"]) * (cfg["financeiro"]["imposto_sobre_faturamento"] if r["valor_liquido"] is not None else 0)
                for r in ok
            )
            of.update(
                vendas=len(ok), reembolsos=len(reemb), faturamento=round(bruto, 2), lucro_liquido_est=round(liq, 2),
                taxa_reembolso=round(len(reemb) / max(1, len(ok) + len(reemb)), 3),
                conversao=round(len(ok) / of["visitas"], 4) if of["visitas"] else None,
            )
    return ofertas


def decidir() -> list[dict]:
    cfg = settings()
    dec, val = cfg["decisao"], cfg["validacao"]
    saida = []
    for m in metricas(30):
        if m["status"] not in ("publicada", "validada", "ajustar"):
            continue
        dias_pub = (datetime.now() - datetime.fromisoformat(m["publicado_em"])).days if m["publicado_em"] else 0
        if m["status"] == "publicada" and dias_pub >= val["janela_dias"]:
            passou = m["vendas"] >= val["pre_vendas_minimas"] or (m["conversao"] or 0) >= val["conversao_pagina_minima"]
            acao = "VALIDAR → rex curso" if passou else ("AJUSTAR promessa" if m["ajustes"] < val["max_ajustes_antes_de_arquivar"] else "ARQUIVAR")
        elif dias_pub >= 14 and m["lucro_liquido_est"] > dec["escalar_se_lucro_liquido_mensal_maior_que"]:
            acao = "ESCALAR (nova turma, colab, anúncio com teto)"
        elif dias_pub >= 14 and m["vendas"] < dec["matar_se_vendas_14d_menor_que"]:
            acao = "MATAR ou reposicionar"
        else:
            acao = "AGUARDAR dados"
        if m["taxa_reembolso"] > dec["alerta_reembolso_maior_que"]:
            acao += " · ALERTA reembolso alto: revisar promessa x entrega"
        saida.append({"oferta_id": m["id"], "titulo": m["titulo"], "dias": dias_pub, "vendas": m["vendas"],
                      "lucro_liquido_est": m["lucro_liquido_est"], "acao": acao})
    return saida


def relatorio(semanal: bool = False) -> str:
    cfg = settings()
    ms = metricas(30)
    total = sum(m["lucro_liquido_est"] for m in ms)
    por_tema: dict[str, float] = {}
    for m in ms:
        por_tema[m["tema"]] = por_tema.get(m["tema"], 0) + m["lucro_liquido_est"]
    with sessao() as con:
        fila_n = con.execute("SELECT COUNT(*) FROM oportunidades WHERE status='fila'").fetchone()[0]
    custos = llm.resumo_custos()
    linhas = [
        f"# Relatório — {date.today().strftime('%d/%m/%Y')}",
        "",
        f"- Lucro líquido estimado (30 dias): **R$ {total:,.2f}** de meta R$ {cfg['financeiro']['meta_lucro_liquido_mensal']:,.0f}",
        f"- Ofertas: {len(ms)} · na fila: {fila_n}",
        f"- IA paga no mês: US$ {sum((x['custo'] or 0) for x in custos['por_motor']):.2f} de teto US$ {custos['teto_usd']}",
        "",
        "| Oferta | Tema | Status | Vendas | Reemb. | Conv. | Lucro líq. est. |",
        "|---|---|---|---|---|---|---|",
    ]
    for m in sorted(ms, key=lambda x: x["lucro_liquido_est"], reverse=True):
        conv = f"{m['conversao']:.1%}" if m["conversao"] is not None else "—"
        linhas.append(f"| {m['titulo']} | {m['tema']} | {m['status']} | {m['vendas']} | {m['reembolsos']} | {conv} | R$ {m['lucro_liquido_est']:,.2f} |")
    linhas += ["", "## Por tema"] + [f"- {t}: R$ {v:,.2f}" for t, v in sorted(por_tema.items(), key=lambda x: -x[1])]
    linhas += ["", "## Decisões sugeridas"] + [f"- #{d['oferta_id']} {d['titulo']}: **{d['acao']}**" for d in decidir()]
    texto = "\n".join(linhas)
    if semanal:
        insight = llm.gerar("analise_semanal", prompts.ANALISE.format(meta=cfg["financeiro"]["meta_lucro_liquido_mensal"], dados=texto),
                            "Você é um analista de negócios digitais, direto e cético.", usar_cache=False)
        texto += "\n\n---\n\n" + insight
    destino = caminho("saidas") / "relatorios"
    destino.mkdir(parents=True, exist_ok=True)
    (destino / f"{date.today().isoformat()}{'-semanal' if semanal else ''}.md").write_text(texto, encoding="utf-8")
    return texto

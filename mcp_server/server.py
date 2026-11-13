"""Servidor MCP da Fábrica de Ofertas (stdio). Ferramentas somente de leitura e geração local.

Nada aqui publica, gasta dinheiro ou acessa dados pessoais de compradores.
Registro no Claude Desktop/Code: veja mcp_server/README.md.
"""
from __future__ import annotations

import json
from pathlib import Path

try:  # mcp >= 2
    from mcp.server.mcpserver import MCPServer as _Servidor
except ImportError:  # mcp 1.x
    from mcp.server.fastmcp import FastMCP as _Servidor

from rendaextra import agentes, analytics, atividades, llm, pipeline, rag, regras, scoring

mcp = _Servidor("rendaextra")


@mcp.tool()
def status() -> str:
    """Saúde do ambiente: Ollama, gasto de IA paga e tamanho da fila."""
    return json.dumps({"ollama": llm.status_ollama(), "gasto_mes_usd": llm.gasto_mes_usd(),
                       "fila": len(pipeline.fila())}, ensure_ascii=False)


@mcp.tool()
def oportunidades(status: str = "fila", limite: int = 10) -> str:
    """Fila de oportunidades ordenada por score."""
    campos = ("id", "tema", "titulo", "preco", "score", "status")
    return json.dumps([{k: o[k] for k in campos} for o in pipeline.fila(status)[:limite]], ensure_ascii=False)


@mcp.tool()
def gerar_oferta_do_dia(oportunidade_id: int | None = None) -> str:
    """Roda o pipeline do dia (usa Ollama local). Retorna a pasta gerada e o resultado da revisão."""
    return json.dumps(pipeline.rodar_dia(oportunidade_id), ensure_ascii=False)


@mcp.tool()
def revisar(pasta: str, tema: str = "") -> str:
    """Compliance + originalidade de uma pasta de oferta."""
    return pipeline.revisar_pasta(Path(pasta), tema).markdown()


@mcp.tool()
def relatorio(semanal: bool = False) -> str:
    """Relatório de vendas agregadas por oferta e tema, com decisões sugeridas."""
    return analytics.relatorio(semanal)


@mcp.tool()
def sincronizar_vendas(dias: int = 30) -> str:
    """Puxa vendas da Kiwify e Hotmart (somente leitura; comprador salvo apenas como hash)."""
    return json.dumps(analytics.sync(dias), ensure_ascii=False)


@mcp.tool()
def buscar_conhecimento(pergunta: str, k: int = 3) -> str:
    """Busca na base de conhecimento local (kb/)."""
    return json.dumps(rag.buscar(pergunta, k), ensure_ascii=False)


@mcp.tool()
def conta_de_preco(preco: float, cpa: float = 0.0) -> str:
    """Sobra por venda, CPA máximo e vendas necessárias para a meta mensal."""
    return json.dumps({"sobra_por_venda": scoring.liquido_por_venda(preco), "cpa_maximo": scoring.cpa_maximo(preco),
                       "vendas_para_meta": scoring.vendas_para_meta(preco, cpa)}, ensure_ascii=False)


@mcp.tool()
def painel_revisao(pasta: str, etapas: str = "", motor: str = "") -> str:
    """Time revisa a oferta por etapa (economistas, juristas, corretor, compliance). Vereditos por agente."""
    return json.dumps(agentes.painel(Path(pasta), etapas.split(",") if etapas else None, motor or None), ensure_ascii=False)


@mcp.tool()
def prompt_do_agente(agente_id: str) -> str:
    """Prompt de sistema de um agente do time (papel + regras ativas + mudanças recentes)."""
    return agentes.sistema(agente_id)


@mcp.tool()
def regras_ativas() -> str:
    """Resumo das regras de negócio (RN) e de cursos (RC) ativas."""
    return regras.resumo_para_prompt()


@mcp.tool()
def registrar_atividade(tipo: str, texto: str, modelo: str, agente: str = "") -> str:
    """Registra no LOG-ATIVIDADES (tipos: melhoria, regra, skill, aprendizado, erro, decisao)."""
    return json.dumps(atividades.registrar(tipo, texto, modelo, agente or None), ensure_ascii=False)


@mcp.tool()
def ultimas_atividades(n: int = 15) -> str:
    """Últimas entradas do log compartilhado entre modelos."""
    return json.dumps(atividades.ultimas(n), ensure_ascii=False)


if __name__ == "__main__":
    mcp.run()

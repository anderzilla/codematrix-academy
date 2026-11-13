"""Banco SQLite local: oportunidades, concorrentes, ofertas, vendas, cache e uso de IA."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime

from .config import caminho

SCHEMA = """
CREATE TABLE IF NOT EXISTS oportunidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tema TEXT NOT NULL, titulo TEXT NOT NULL, subtitulo TEXT, avatar TEXT, dor TEXT, promessa TEXT,
  preco REAL, formato TEXT,
  demanda INTEGER, concorrencia INTEGER, vantagem INTEGER, velocidade INTEGER, risco INTEGER,
  score REAL, fonte TEXT,
  status TEXT NOT NULL DEFAULT 'fila',      -- fila | em_teste | validada | arquivada
  criado_em TEXT NOT NULL,
  UNIQUE(tema, titulo)
);
CREATE TABLE IF NOT EXISTS concorrentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plataforma TEXT, nome TEXT, url TEXT, tema TEXT, assunto TEXT, preco REAL, formato TEXT,
  promessa_resumo TEXT, bonus TEXT, garantia_dias INTEGER, temperatura REAL,
  anuncios_ativos INTEGER, fonte TEXT, data_coleta TEXT,
  texto_referencia TEXT                     -- trecho público usado só para checar originalidade
);
CREATE TABLE IF NOT EXISTS ofertas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  oportunidade_id INTEGER REFERENCES oportunidades(id),
  slug TEXT, pasta TEXT, preco REAL,
  plataforma TEXT, produto_id TEXT,          -- id do produto na Kiwify/Hotmart após publicar
  status TEXT NOT NULL DEFAULT 'rascunho',   -- rascunho | aprovada | publicada | validada | ajustar | arquivada
  ajustes INTEGER NOT NULL DEFAULT 0,
  visitas INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL, publicado_em TEXT
);
CREATE TABLE IF NOT EXISTS vendas (
  plataforma TEXT NOT NULL, pedido_id TEXT NOT NULL,
  produto_id TEXT, produto_nome TEXT, status TEXT,
  valor_bruto REAL, valor_liquido REAL, comprador_hash TEXT, data TEXT,
  PRIMARY KEY (plataforma, pedido_id)
);
CREATE TABLE IF NOT EXISTS llm_cache (
  chave TEXT PRIMARY KEY, modelo TEXT, resposta TEXT, criado_em TEXT
);
CREATE TABLE IF NOT EXISTS llm_uso (
  id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, etapa TEXT, motor TEXT, modelo TEXT,
  tokens_entrada INTEGER, tokens_saida INTEGER, custo_usd REAL, cache INTEGER
);
CREATE TABLE IF NOT EXISTS kb_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, arquivo TEXT, titulo TEXT, texto TEXT, vetor TEXT
);
CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, tipo TEXT, detalhe TEXT
);
"""


def agora() -> str:
    return datetime.now().isoformat(timespec="seconds")


def conectar() -> sqlite3.Connection:
    p = caminho("db")
    p.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(p)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    try:  # bancos criados antes da v0.3
        con.execute("ALTER TABLE oportunidades ADD COLUMN subtitulo TEXT")
    except sqlite3.OperationalError:
        pass
    return con


@contextmanager
def sessao():
    con = conectar()
    try:
        yield con
        con.commit()
    finally:
        con.close()


def evento(tipo: str, detalhe: str) -> None:
    with sessao() as con:
        con.execute("INSERT INTO eventos(data,tipo,detalhe) VALUES (?,?,?)", (agora(), tipo, detalhe))

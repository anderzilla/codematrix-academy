"""Cliente Kiwify (public-api.kiwify.com/v1) — SOMENTE LEITURA.

Endpoints usados: /oauth/token, /products, /sales, /stats.
Saque (/payouts POST) e reembolso (/sales/{id}/refund) existem na API e são BLOQUEADOS aqui.
Docs: https://docs.kiwify.com.br/api-reference
"""
from __future__ import annotations

import time
from datetime import date, timedelta

import requests

from .. import credentials
from . import hash_comprador

BASE = "https://public-api.kiwify.com/v1"
PERMITIDOS = ("/products", "/sales", "/stats")


class Kiwify:
    def __init__(self, sessao: requests.Session | None = None):
        self.http = sessao or requests.Session()
        self._token, self._expira = None, 0.0
        self.account_id = credentials.obter("kiwify_account_id")

    def _auth(self) -> str:
        if self._token and time.time() < self._expira - 60:
            return self._token
        cid, sec = credentials.obter("kiwify_client_id"), credentials.obter("kiwify_client_secret")
        if not (cid and sec and self.account_id):
            raise RuntimeError("Credenciais Kiwify ausentes. Rode `rex credenciais`.")
        r = self.http.post(f"{BASE}/oauth/token", data={"client_id": cid, "client_secret": sec}, timeout=30)
        r.raise_for_status()
        d = r.json()
        self._token = d["access_token"]
        self._expira = time.time() + float(d.get("expires_in", 3600))
        return self._token

    def _get(self, caminho: str, params: dict | None = None) -> dict:
        if not caminho.startswith(PERMITIDOS) or "refund" in caminho or "payout" in caminho:
            raise PermissionError(f"Endpoint não permitido nesta ferramenta: {caminho}")
        r = self.http.get(
            BASE + caminho,
            params=params,
            headers={"Authorization": f"Bearer {self._auth()}", "x-kiwify-account-id": self.account_id},
            timeout=60,
        )
        r.raise_for_status()
        return r.json()

    def produtos(self) -> list[dict]:
        return self._get("/products", {"page_size": "100"}).get("data", [])

    def vendas(self, inicio: date, fim: date) -> list[dict]:
        """Vendas no período (a API limita 90 dias por consulta; fatiamos)."""
        saida, cursor = [], inicio
        while cursor <= fim:
            ate = min(fim, cursor + timedelta(days=89))
            pagina = 1
            while True:
                d = self._get(
                    "/sales",
                    {"start_date": cursor.isoformat(), "end_date": ate.isoformat(),
                     "page_size": "100", "page_number": str(pagina), "view_full_sale_details": "true"},
                )
                itens = d.get("data", [])
                saida += [normalizar(v) for v in itens]
                if len(itens) < 100:
                    break
                pagina += 1
            cursor = ate + timedelta(days=1)
        return saida


def _valor(v) -> float | None:
    """A doc não informa a unidade; valores inteiros são tratados como centavos. CONFIRA no 1º sync."""
    if v is None:
        return None
    return v / 100 if isinstance(v, int) else float(v)


def normalizar(v: dict) -> dict:
    pg = v.get("payment") or {}
    return {
        "plataforma": "kiwify",
        "pedido_id": str(v.get("id")),
        "produto_id": str((v.get("product") or {}).get("id")),
        "produto_nome": (v.get("product") or {}).get("name"),
        "status": v.get("status"),
        "valor_bruto": _valor(pg.get("charge_amount") or pg.get("product_base_price")),
        "valor_liquido": _valor(v.get("net_amount") or pg.get("net_amount")),
        "comprador_hash": hash_comprador((v.get("customer") or {}).get("email")),
        "data": v.get("approved_date") or v.get("created_at"),
    }

"""Cliente Hotmart Developers — SOMENTE LEITURA (vendas e produtos).

Credenciais: app-vlc.hotmart.com/tools/credentials (client_id, client_secret, basic).
Docs: https://developers.hotmart.com
"""
from __future__ import annotations

import time
from datetime import date, datetime

import requests

from .. import credentials
from . import hash_comprador

TOKEN_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token"
BASE = "https://developers.hotmart.com"
PERMITIDOS = ("/payments/api/v1/sales/history", "/payments/api/v1/sales/summary", "/products/api/v1/products")


class Hotmart:
    def __init__(self, sessao: requests.Session | None = None):
        self.http = sessao or requests.Session()
        self._token, self._expira = None, 0.0

    def _auth(self) -> str:
        if self._token and time.time() < self._expira - 60:
            return self._token
        cid, sec, basic = (credentials.obter(k) for k in ("hotmart_client_id", "hotmart_client_secret", "hotmart_basic"))
        if not (cid and sec and basic):
            raise RuntimeError("Credenciais Hotmart ausentes. Rode `rex credenciais`.")
        basic = basic.removeprefix("Basic ").strip()
        r = self.http.post(
            TOKEN_URL,
            params={"grant_type": "client_credentials", "client_id": cid, "client_secret": sec},
            headers={"Authorization": f"Basic {basic}"},
            timeout=30,
        )
        r.raise_for_status()
        d = r.json()
        self._token = d["access_token"]
        self._expira = time.time() + float(d.get("expires_in", 3600))
        return self._token

    def _get(self, caminho: str, params: dict | None = None) -> dict:
        if not caminho.startswith(PERMITIDOS):
            raise PermissionError(f"Endpoint não permitido nesta ferramenta: {caminho}")
        r = self.http.get(BASE + caminho, params=params, headers={"Authorization": f"Bearer {self._auth()}"}, timeout=60)
        r.raise_for_status()
        return r.json()

    def produtos(self) -> list[dict]:
        return self._get("/products/api/v1/products", {"max_results": 50}).get("items", [])

    def vendas(self, inicio: date, fim: date) -> list[dict]:
        ms = lambda d, h: int(datetime.combine(d, h).timestamp() * 1000)  # noqa: E731
        params = {
            "start_date": ms(inicio, datetime.min.time()),
            "end_date": ms(fim, datetime.max.time()),
            "max_results": 100,
            "transaction_status": "APPROVED,COMPLETE,REFUNDED,CHARGEBACK,CANCELLED",
        }
        saida = []
        while True:
            d = self._get("/payments/api/v1/sales/history", params)
            saida += [normalizar(v) for v in d.get("items", [])]
            prox = (d.get("page_info") or {}).get("next_page_token")
            if not prox:
                break
            params["page_token"] = prox
        return saida


def normalizar(v: dict) -> dict:
    compra = v.get("purchase") or {}
    preco = (compra.get("price") or {}).get("value")
    data_ms = compra.get("approved_date") or compra.get("order_date")
    return {
        "plataforma": "hotmart",
        "pedido_id": str(compra.get("transaction")),
        "produto_id": str((v.get("product") or {}).get("id")),
        "produto_nome": (v.get("product") or {}).get("name"),
        "status": (compra.get("status") or "").lower(),
        "valor_bruto": float(preco) if preco is not None else None,
        "valor_liquido": None,  # comissão líquida vem de outro endpoint; estimamos pela taxa
        "comprador_hash": hash_comprador((v.get("buyer") or {}).get("email")),
        "data": datetime.fromtimestamp(data_ms / 1000).isoformat() if data_ms else None,
    }

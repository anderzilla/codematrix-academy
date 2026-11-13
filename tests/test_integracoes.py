import pytest

from rendaextra.integrations import kiwify, hotmart


def test_kiwify_bloqueia_saque_e_reembolso(monkeypatch):
    k = kiwify.Kiwify()
    monkeypatch.setattr(k, "_auth", lambda: "t")
    for caminho in ("/sales/1/refund", "/payouts", "/withdrawals"):
        with pytest.raises(PermissionError):
            k._get(caminho)


def test_hotmart_so_leitura(monkeypatch):
    h = hotmart.Hotmart()
    monkeypatch.setattr(h, "_auth", lambda: "t")
    with pytest.raises(PermissionError):
        h._get("/payments/api/v1/subscriptions/cancel")


def test_normalizacao_nao_guarda_email():
    v = kiwify.normalizar({"id": "o1", "status": "paid", "net_amount": 8000, "product": {"id": "p", "name": "C"},
                           "customer": {"email": "Fulano@x.com", "cpf": "000"}, "created_at": "2026-11-13"})
    assert v["valor_liquido"] == 80.0
    assert "@" not in str(v) and "000" not in str(v.values())
    h = hotmart.normalizar({"purchase": {"transaction": "HP1", "status": "APPROVED", "price": {"value": 197},
                                         "order_date": 1763000000000}, "product": {"id": 9, "name": "X"},
                            "buyer": {"email": "a@b.com"}})
    assert h["status"] == "approved" and h["valor_bruto"] == 197.0 and "@" not in str(h)

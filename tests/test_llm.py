from rendaextra import llm
from rendaextra.db import sessao


def test_cache_evita_segunda_chamada():
    a = llm.gerar("modelar_oferta", "prompt X")
    b = llm.gerar("modelar_oferta", "prompt X")
    assert a == b
    with sessao() as con:
        hits = con.execute("SELECT SUM(cache) FROM llm_uso").fetchone()[0]
    assert hits == 1


def test_teto_zerado_forca_local(monkeypatch):
    from rendaextra import config
    cfg = config.settings()
    monkeypatch.setitem(cfg["ia_paga"], "teto_mensal_usd", 0)
    llm.gerar("revisao_final_copy", "copy")
    with sessao() as con:
        motor = con.execute("SELECT motor FROM llm_uso ORDER BY id DESC LIMIT 1").fetchone()[0]
    assert motor == "local"


def test_janela_bloqueada():
    from datetime import datetime
    assert llm._na_janela_bloqueada(datetime(2026, 1, 1, 3, 0))
    assert not llm._na_janela_bloqueada(datetime(2026, 1, 1, 9, 0))


def test_extrair_json():
    assert llm.extrair_json('Claro! {"a": 1} fim') == {"a": 1}

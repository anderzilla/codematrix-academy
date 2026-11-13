from pathlib import Path

from rendaextra import analytics, pipeline
from rendaextra.config import raiz
from rendaextra.db import sessao


def test_fluxo_completo_dia_publicar_vendas_decidir():
    assert pipeline.importar_oportunidades(raiz() / "data" / "oportunidades_iniciais.csv") == 8
    r = pipeline.rodar_dia()
    pasta = Path(r["pasta"])
    for f in ("oferta.md", "pagina.html", "anuncios.md", "aula1.md", "checklist_publicacao.md", "revisao.md"):
        assert (pasta / f).exists(), f
    pipeline.publicar(r["oferta_id"], "prod-1", "kiwify")
    with sessao() as con:
        con.execute("INSERT INTO vendas VALUES ('kiwify','o1','prod-1','C','paid',397,357.0,'h',datetime('now'))")
        con.execute("INSERT INTO vendas VALUES ('kiwify','o2','prod-1','C','refunded',397,0,'h2',datetime('now'))")
    m = [x for x in analytics.metricas() if x["id"] == r["oferta_id"]][0]
    assert m["vendas"] == 1 and m["reembolsos"] == 1
    assert 0 < m["lucro_liquido_est"] < 397
    rel = analytics.relatorio()
    assert "Decisões sugeridas" in rel


def test_reimportar_nao_duplica():
    arq = raiz() / "data" / "oportunidades_iniciais.csv"
    pipeline.importar_oportunidades(arq)
    assert pipeline.importar_oportunidades(arq) == 0


def test_modulos_extraidos():
    md = "## Módulos (4 a 7)\n1. Fundamentos\n   - aula a\n2. Prática\n3. Publicação\n## Bônus\n- x"
    assert pipeline._modulos(md) == ["Fundamentos", "Prática", "Publicação"]

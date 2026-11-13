from rendaextra import scoring


def test_conta_kiwify_bate_com_relatorio():
    assert scoring.liquido_por_venda(97) == 79.97
    assert scoring.liquido_por_venda(497) == 420.01
    assert scoring.cpa_maximo(97) == 71.31


def test_vendas_para_meta_inviavel_quando_cpa_alto():
    assert scoring.vendas_para_meta(97, cpa=75) is None
    assert scoring.vendas_para_meta(497, cpa=150) == 19.9


def test_score_premia_vantagem_e_pune_risco():
    alto = scoring.score(5, 3, 5, 3, 1, preco=397)
    baixo = scoring.score(5, 3, 2, 3, 5, preco=397)
    assert alto > baixo

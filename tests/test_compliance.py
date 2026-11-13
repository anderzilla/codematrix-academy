from rendaextra import compliance


def test_bloqueia_promessa_de_ganho():
    r = compliance.revisar_texto("Ganhe R$ 10.000 por mês com renda garantida!", "x.md", {})
    assert not r.aprovado
    assert any(a["severidade"] == "bloqueia" for a in r.achados)


def test_texto_limpo_aprovado():
    r = compliance.revisar_texto("Você vai montar sua planilha e publicar seu primeiro app.", "x.md", {})
    assert r.aprovado


def test_bloqueia_copia_de_concorrente():
    deles = "aprenda o metodo exclusivo que transforma iniciantes em especialistas de vendas pelo whatsapp em poucas semanas de pratica guiada"
    nosso = "Neste curso: aprenda o metodo exclusivo que transforma iniciantes em especialistas de vendas pelo whatsapp em poucas semanas."
    r = compliance.revisar_texto(nosso, "p.md", {"concorrente": deles})
    assert r.similaridade_max > 0.35
    assert not r.aprovado


def test_modelar_estrutura_nao_e_copia():
    deles = "curso completo de vendas no whatsapp com scripts prontos e bonus de planilha de follow up"
    nosso = "Organize o atendimento do seu negócio: catálogo, respostas rápidas e rotina de retorno ao cliente."
    assert compliance.similaridade(nosso, deles) < 0.1

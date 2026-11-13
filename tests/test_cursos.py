import shutil

import yaml

from rendaextra import agentes, cursos
from rendaextra.config import raiz


def _copia(tmp_path, monkeypatch):
    for d in ("config", "cursos", "modelos", "regras", "agentes", "kb"):
        shutil.copytree(raiz() / d, tmp_path / d)
    monkeypatch.setenv("REX_ROOT", str(tmp_path))
    from rendaextra import config
    config.limpar_cache()
    agentes.todos.cache_clear()
    return tmp_path


def test_catalogo_tem_4_cursos_com_pocket_e_completo():
    cat = cursos.catalogo()["cursos"]
    assert [c["id"] for c in cat] == ["financas-familia", "produto-digital", "whatsapp-vendas", "app-com-ia"]
    for c in cat:
        y = cursos.curso(c["id"])
        assert y["pocket"]["preco_proposto"] < y["completo"]["preco_proposto"]
        assert y["completo"]["titulo"].split()[0] in ("Organize", "Como", "Aumente", "Crie")
        assert y["completo"]["modulos"][0]["liberacao_dias"] == 0


def test_iniciar_cria_estrutura_e_preenche_modelos(tmp_path, monkeypatch):
    r = _copia(tmp_path, monkeypatch)
    base = cursos.iniciar("whatsapp-vendas")
    for sub in cursos.PASTAS:
        assert (base / sub).is_dir()
    jornada = (base / "retencao" / "jornada.md").read_text(encoding="utf-8")
    assert "{{" not in jornada and "R$ 170" in jornada
    assert "Módulo 5" in (base / "kiwify" / "montagem.md").read_text(encoding="utf-8")
    assert r


def test_hoje_aponta_o_curso_certo():
    from datetime import date
    assert "financas-familia" in cursos.hoje(date(2026, 11, 17))
    assert "app-com-ia" in cursos.hoje(date(2026, 11, 26))
    assert "Nenhum sprint" in cursos.hoje(date(2026, 11, 20))


def test_salvar_bloqueia_dados_de_comprador(tmp_path, monkeypatch):
    import subprocess
    r = _copia(tmp_path, monkeypatch)
    subprocess.run(["git", "init", "-q"], cwd=r, check=True)
    (r / "cursos" / "financas-familia" / "metricas" / "vendas.csv").parent.mkdir(parents=True, exist_ok=True)
    (r / "cursos" / "financas-familia" / "metricas" / "vendas.csv").write_text("nome,email\nAna,ana@gmail.com\n", encoding="utf-8")
    problemas = cursos.verificar_antes_de_salvar()
    assert any("e-mail/CPF" in p for p in problemas)


def test_painel_usa_arquivos_do_curso():
    e = next(x for x in agentes.time()["etapas"] if x["id"] == "pagina")
    arqs = agentes._arquivos_da_etapa(raiz() / "cursos" / "financas-familia", e)
    assert {a.name for a in arqs} == {"pocket.md", "completo.md"}


def test_cenas_do_pocket_validas():
    for n in range(1, 6):
        d = yaml.safe_load((raiz() / "cursos" / "financas-familia" / "pocket" / "cenas" / f"aula-0{n}.json").read_text(encoding="utf-8"))
        assert d["cenas"][0]["tipo"] == "capa" and d["cenas"][-1]["tipo"] == "cta"
        assert all(c["tema"] == "pessoal" and c["narracao"] for c in d["cenas"])

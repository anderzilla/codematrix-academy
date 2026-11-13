import json
import shutil
from pathlib import Path

from rendaextra import agentes, atividades, compliance, pipeline, video
from rendaextra.config import raiz


def test_time_completo_e_etapas_validas():
    ids = set(agentes.todos())
    obrigatorios = {"publicitario", "redator-publicitario", "corretor-revisor", "economista-de-vendas", "economista-de-negocios",
                    "especialista-marketing-digital", "especialista-marketing-de-imagem", "jurista-direito-digital",
                    "jurista-consumidor-publicidade", "especialista-vendas-internet", "diretor-audiovisual"}
    assert obrigatorios <= ids
    for e in agentes.time()["etapas"]:
        for a in e["revisores"]:
            assert a in ids, a
            assert a not in e["responsaveis"], f"{a} revisa a própria etapa {e['id']}"


def test_prompt_de_agente_inclui_regras():
    p = agentes.sistema("jurista-consumidor-publicidade")
    assert "CDC" in p and "RC-001" in p


def test_painel_grava_pareceres(tmp_path):
    (tmp_path / "oferta.md").write_text("## Promessa\nMonte seu app.", encoding="utf-8")
    r = agentes.painel(tmp_path, ["oferta"])
    assert {x["agente"] for x in r} == {"economista-de-vendas", "economista-de-negocios", "jurista-consumidor-publicidade"}
    assert (tmp_path / "pareceres" / "RESUMO.md").exists()


def test_bloquear_impede(tmp_path):
    d = tmp_path / "pareceres"; d.mkdir()
    (d / "pagina__jurista-consumidor-publicidade.md").write_text("VEREDITO: BLOQUEAR\nRISCO: alto", encoding="utf-8")
    assert agentes.bloqueios(tmp_path) == ["pagina__jurista-consumidor-publicidade"]


def test_log_compartilhado():
    atividades.registrar("regra", "RC-099 proposta: teste", modelo="codex")
    atividades.registrar("execucao", "rotina", automatico=True)
    ult = atividades.ultimas(5)
    assert ult[0]["tipo"] == "execucao" and ult[1]["modelo"] == "codex"
    md = (Path(__import__("os").environ["REX_LOG_DIR"]) / "LOG-ATIVIDADES.md").read_text(encoding="utf-8")
    assert "RC-099" in md and "rotina" not in md
    assert "RC-099" in atividades.resumo_para_prompt()


def test_regra_nova_fica_proposta(tmp_path, monkeypatch):
    for d in ("config", "regras"):
        shutil.copytree(raiz() / d, tmp_path / d)
    monkeypatch.setenv("REX_ROOT", str(tmp_path))
    from rendaextra import config, regras
    config.limpar_cache()
    rid = regras.nova("RC", "Teste", "texto", "teste")
    assert rid == "RC-014"
    meta = [r for r in regras.listar() if r["id"] == rid][0]
    assert meta["status"] == "proposta"
    regras.mudar_status(rid, "ativa")
    assert any(r["id"] == rid for r in regras.listar("ativa"))


def test_regra_automatica_de_marca():
    r = compliance.revisar_texto("Bem-vindo à CodeMatrix academy", "x.md", {})
    assert any("RC-008" in a["motivo"] for a in r.achados)
    r2 = compliance.revisar_texto("Bem-vindo à CodeMatrix Academy", "x.md", {})
    assert not any("RC-008" in a["motivo"] for a in r2.achados)


def test_legendas_respeitam_limites():
    t = "São quatro entregas: a ideia em uma frase, a tela inicial gerada com IA, o primeiro teste no seu celular e a lista do que falta para publicar."
    blocos = video.blocos_legenda(t, 42, 2)
    assert all(len(b.split("\n")) <= 2 and all(len(l) <= 42 for l in b.split("\n")) for b in blocos)
    cues = video.tempos(blocos, 0.35, 8.0)
    assert abs(cues[-1][1] - 8.35) < 1e-6
    assert "\\N" in video.ass(cues, 1920, 1080, False)


def test_cenas_fallback_sem_ia(tmp_path, monkeypatch):
    rot = tmp_path / "aula.md"
    rot.write_text("# Aula 1\n## Objetivo\nVocê sai com a tela pronta.\n## Passos\n- Criar projeto\n- Pedir tela\n", encoding="utf-8")
    monkeypatch.setattr(video.llm, "gerar", lambda *a, **k: "sem json")
    p = video.gerar_cenas(rot, "ia")
    cenas = json.loads(p.read_text(encoding="utf-8"))["cenas"]
    assert cenas[0]["tipo"] == "capa" and cenas[-1]["tipo"] == "cta"
    assert all(c["narracao"] and c["tema"] == "ia" for c in cenas)


def test_extrair_cores(tmp_path):
    from PIL import Image
    from rendaextra import marca
    im = Image.new("RGB", (200, 200), "white")
    im.paste((31, 94, 255), (0, 0, 120, 200))
    im.save(tmp_path / "x.png")
    cores = marca.extrair_cores([tmp_path / "x.png"])
    assert cores and cores[0]["hex"].startswith("#1")


def test_personagens_e_ilustracoes_existem():
    from rendaextra import marca
    for nome in ("trix-ola", "trix-alerta", "trix-comemora", "pixel-normal"):
        assert (raiz() / "marca" / "personagens" / f"{nome}.svg").exists()
    assert marca._ilustracao({"tipo": "capa_produto", "tema": "renda"})
    assert marca._ilustracao({"tipo": "topicos", "tema": "renda"}) is None
    assert marca._ilustracao({"tipo": "capa", "tema": "ia", "ilustracao": False}) is None


def test_titulos_da_fila_tem_acao():
    import csv
    verbos = ("Crie", "Automatize", "Aumente", "Como", "Organize", "Domine", "Venda")
    for r in csv.DictReader(open(raiz() / "data" / "oportunidades_iniciais.csv", encoding="utf-8")):
        assert r["titulo"].startswith(verbos), r["titulo"]
        assert len(r["subtitulo"]) > 40

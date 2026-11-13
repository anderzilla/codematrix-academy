"""CLI `rex` da Fábrica de Ofertas."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import agentes, analytics, cursos, atividades, credentials, llm, marca, pipeline, rag, regras, scoring, video
from .config import caminho, settings
from .db import sessao


def _status(_):
    st = llm.status_ollama()
    print("Ollama:", "ok" if st["ok"] else f"INDISPONÍVEL ({st.get('erro')})", "·", settings()["ia_local"]["host"])
    if st.get("faltando"):
        print("  modelos faltando (ollama pull):", ", ".join(st["faltando"]))
    for g in credentials.CHAVES:
        print(f"Credenciais {g}:", "ok" if credentials.tem(g) else "não cadastradas")
    print("IA paga:", "habilitada" if settings()["ia_paga"]["habilitada"] else "desligada",
          f"· gasto do mês US$ {llm.gasto_mes_usd():.2f} / teto {settings()['ia_paga']['teto_mensal_usd']}")
    with sessao() as con:
        for t in ("oportunidades", "concorrentes", "ofertas", "vendas", "kb_chunks"):
            print(f"{t}:", con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0])


def _importar(a):
    arq = Path(a.arquivo)
    head = arq.read_text(encoding="utf-8").splitlines()[0]
    if "plataforma" in head and "promessa_resumo" in head:
        print("concorrentes importados:", pipeline.importar_concorrentes(arq))
    else:
        print("oportunidades importadas:", pipeline.importar_oportunidades(arq))


def _concorrente_add(a):
    campos = dict(plataforma=a.plataforma, nome=a.nome, url=a.url, tema=a.tema, assunto=a.assunto, preco=a.preco,
                  formato=a.formato, promessa_resumo=a.promessa, bonus=a.bonus, garantia_dias=a.garantia,
                  temperatura=a.temperatura, anuncios_ativos=a.anuncios, fonte=a.fonte, data_coleta=a.data,
                  texto_referencia=Path(a.texto).read_text(encoding="utf-8") if a.texto else None)
    with sessao() as con:
        con.execute(f"INSERT INTO concorrentes({','.join(campos)}) VALUES ({','.join('?' * len(campos))})", list(campos.values()))
    print("registrado.")


def _oportunidades(a):
    for o in pipeline.fila(a.status):
        liq = scoring.liquido_por_venda(o["preco"])
        print(f"#{o['id']:>3}  score {o['score']:>4}  [{o['tema']}]  R$ {o['preco']:>6.0f} (sobra R$ {liq:.0f})  {o['titulo']}")


def _dia(a):
    r = pipeline.rodar_dia(a.id, a.entrega)
    print(json.dumps(r, ensure_ascii=False, indent=2))
    print("\nAbra a pasta, revise e siga checklist_publicacao.md.")


def _revisar(a):
    res = pipeline.revisar_pasta(Path(a.pasta), a.tema or "")
    print(res.markdown())
    sys.exit(0 if res.aprovado else 2)


def _rag(a):
    if a.acao == "indexar":
        print("trechos indexados:", rag.indexar())
    else:
        for r in rag.buscar(a.pergunta or "", 3):
            print(f"[{r['score']:.2f}] {r['arquivo']} › {r['titulo']}\n{r['texto'][:300]}\n")


def _visitas(a):
    with sessao() as con:
        con.execute("UPDATE ofertas SET visitas=? WHERE id=?", (a.n, a.oferta_id))
    print("ok")


def _ajustar(a):
    with sessao() as con:
        con.execute("UPDATE ofertas SET status='ajustar', ajustes=ajustes+1 WHERE id=?", (a.oferta_id,))
    print("marcada para ajuste; edite oferta.md/pagina_copy.md e rode `rex revisar`.")


def _arquivar(a):
    with sessao() as con:
        con.execute("UPDATE ofertas SET status='arquivada' WHERE id=?", (a.oferta_id,))
        con.execute("UPDATE oportunidades SET status='arquivada' WHERE id=(SELECT oportunidade_id FROM ofertas WHERE id=?)", (a.oferta_id,))
    print("arquivada.")


def _conta(a):
    print(f"Preço R$ {a.preco:.2f}: sobra R$ {scoring.liquido_por_venda(a.preco):.2f}/venda · "
          f"CPA máximo R$ {scoring.cpa_maximo(a.preco):.2f} · "
          f"vendas p/ meta (CPA {a.cpa}): {scoring.vendas_para_meta(a.preco, a.cpa) or 'inviável'}")


def _painel(a):
    etapas = a.etapas.split(",") if a.etapas else None
    for r in agentes.painel(Path(a.pasta), etapas, a.motor):
        print(f"{r['etapa']:<12} {r['agente']:<34} {r['veredito']}")
    print("Detalhes em", Path(a.pasta) / "pareceres")


def _log(a):
    if a.acao == "add":
        e = atividades.registrar(a.tipo, a.texto, a.modelo, a.agente, a.arquivos.split(",") if a.arquivos else None)
        print("registrado:", e["data"], e["tipo"])
    else:
        for e in atividades.ultimas(a.n, a.tipo if a.tipo != "melhoria" or a.filtrar else None):
            print(f"{e['data']} [{e['tipo']}] {e['modelo']} {e['agente']}: {e['texto'][:160]}")


def _regra(a):
    if a.acao == "nova":
        print(regras.nova(a.tipo, a.titulo, a.texto, a.origem, a.verificacao, a.modelo))
    elif a.acao == "aprovar":
        regras.mudar_status(a.id, "ativa", "aprovada pelo Founder", a.modelo)
        print("ativa:", a.id)
    elif a.acao == "revogar":
        regras.mudar_status(a.id, "revogada", a.motivo or "", a.modelo)
        print("revogada:", a.id)
    elif a.acao == "indice":
        print(regras.gerar_indice())
    else:
        for r in regras.listar(a.status):
            print(f"{r['id']}  [{r['status']}]  {r['titulo']}")


def _agentes(a):
    if a.acao == "prompt":
        print(agentes.sistema(a.id))
    else:
        for aid, ag in agentes.todos().items():
            print(f"{ag['setor']:<22} {aid:<34} {', '.join(ag.get('etapas', []))}")


def _marca(a):
    if a.acao == "capa":
        print(marca.capa(a.titulo, a.tema, a.formato, a.subtitulo or "", a.selo))
    else:
        cores = marca.extrair_cores([Path(x) for x in a.imagens])
        for c in cores:
            print(c["hex"], f"{c['peso']:.0%}")
        if a.aplicar and cores:
            marca.aplicar_cor_primaria(cores[0]["hex"], a.modelo)
            print("primária atualizada para", cores[0]["hex"], "— revise marca/tokens.json")


def _video(a):
    if a.acao == "status":
        print(json.dumps(video.disponivel(), indent=2))
    elif a.acao == "cenas":
        print(video.gerar_cenas(Path(a.arquivo), a.tema, a.titulo))
    elif a.acao == "previa":
        print(video.render(Path(a.arquivo), vertical=a.vertical, so_previa=True))
    else:
        print(json.dumps(video.render(Path(a.arquivo), vertical=a.vertical, motor_voz=a.voz,
                                      movimento=not a.parado, legenda_queimada=not a.sem_legenda), ensure_ascii=False, indent=2))


def _sprint(a):
    if a.acao == "iniciar":
        print("estrutura pronta em", cursos.iniciar(a.curso))
    elif a.acao == "kiwify":
        print((cursos.pasta(a.curso) / "kiwify" / "montagem.md").read_text(encoding="utf-8"))
    elif a.acao == "listar":
        for x in cursos.catalogo()["cursos"]:
            c = cursos.curso(x["id"])
            print(f"{x['ordem']}. {x['id']:<18} {x['sprint'][0]} → {x['sprint'][1]}  Pocket R$ {c['pocket']['preco_proposto']} · Completo R$ {c['completo']['preco_proposto']}  {c['completo']['titulo']}")
    else:
        from datetime import date
        print(cursos.hoje(date.fromisoformat(a.data) if a.data else None))


def _salvar(a):
    print(cursos.salvar(a.mensagem, enviar=not a.sem_enviar))


def main(argv=None):
    p = argparse.ArgumentParser(prog="rex", description="Fábrica de Ofertas — Renda Extra")
    sp = p.add_subparsers(dest="cmd", required=True)

    sp.add_parser("status").set_defaults(f=_status)
    sp.add_parser("credenciais").set_defaults(f=lambda a: credentials.assistente_interativo())

    x = sp.add_parser("importar"); x.add_argument("arquivo"); x.set_defaults(f=_importar)

    c = sp.add_parser("concorrente").add_subparsers(dest="sub", required=True).add_parser("add")
    for nome, kw in {"--plataforma": {"required": True}, "--nome": {"required": True}, "--tema": {"required": True},
                     "--url": {}, "--assunto": {}, "--preco": {"type": float}, "--formato": {}, "--promessa": {},
                     "--bonus": {}, "--garantia": {"type": int}, "--temperatura": {"type": float},
                     "--anuncios": {"type": int}, "--fonte": {}, "--data": {},
                     "--texto": {"help": "arquivo .txt com trecho público da página (só para checar originalidade)"}}.items():
        c.add_argument(nome, **kw)
    c.set_defaults(f=_concorrente_add)

    x = sp.add_parser("oportunidades"); x.add_argument("--status", default="fila"); x.set_defaults(f=_oportunidades)
    x = sp.add_parser("dia"); x.add_argument("--id", type=int); x.add_argument("--entrega", type=int, default=14,
                                                                           help="dias até liberar o curso completo"); x.set_defaults(f=_dia)
    x = sp.add_parser("curso"); x.add_argument("oferta_id", type=int); x.set_defaults(f=lambda a: print(pipeline.gerar_curso(a.oferta_id)))
    x = sp.add_parser("revisar"); x.add_argument("pasta"); x.add_argument("--tema"); x.set_defaults(f=_revisar)
    x = sp.add_parser("publicar"); x.add_argument("oferta_id", type=int); x.add_argument("--produto-id", required=True)
    x.add_argument("--plataforma", default="kiwify", choices=["kiwify", "hotmart"])
    x.set_defaults(f=lambda a: (pipeline.publicar(a.oferta_id, a.produto_id, a.plataforma), print("ok")))
    x = sp.add_parser("visitas"); x.add_argument("oferta_id", type=int); x.add_argument("n", type=int); x.set_defaults(f=_visitas)
    x = sp.add_parser("ajustar"); x.add_argument("oferta_id", type=int); x.set_defaults(f=_ajustar)
    x = sp.add_parser("arquivar"); x.add_argument("oferta_id", type=int); x.set_defaults(f=_arquivar)

    x = sp.add_parser("sync"); x.add_argument("--dias", type=int, default=30); x.set_defaults(f=lambda a: print(analytics.sync(a.dias)))
    x = sp.add_parser("analise"); x.add_argument("--semanal", action="store_true"); x.set_defaults(f=lambda a: print(analytics.relatorio(a.semanal)))
    sp.add_parser("decidir").set_defaults(f=lambda a: [print(f"#{d['oferta_id']} {d['titulo']}: {d['acao']}") for d in analytics.decidir()] or None)
    sp.add_parser("custos").set_defaults(f=lambda a: print(json.dumps(llm.resumo_custos(), ensure_ascii=False, indent=2)))
    x = sp.add_parser("conta"); x.add_argument("preco", type=float); x.add_argument("--cpa", type=float, default=0); x.set_defaults(f=_conta)

    x = sp.add_parser("rag"); x.add_argument("acao", choices=["indexar", "buscar"]); x.add_argument("pergunta", nargs="?")
    x.set_defaults(f=_rag)

    x = sp.add_parser("painel", help="revisão do time por etapa"); x.add_argument("pasta"); x.add_argument("--etapas")
    x.add_argument("--motor", choices=["local", "barato", "forte"]); x.set_defaults(f=_painel)

    x = sp.add_parser("log", help="log de atividades compartilhado entre modelos"); x.add_argument("acao", choices=["add", "ver"])
    x.add_argument("--tipo", default="melhoria", choices=list(atividades.TIPOS)); x.add_argument("--texto", default="")
    x.add_argument("--modelo"); x.add_argument("--agente"); x.add_argument("--arquivos"); x.add_argument("--n", type=int, default=15)
    x.add_argument("--filtrar", action="store_true", help="em 'ver', filtra pelo --tipo"); x.set_defaults(f=_log)

    x = sp.add_parser("regra", help="regras de negócio (RN) e de cursos (RC)")
    x.add_argument("acao", choices=["listar", "nova", "aprovar", "revogar", "indice"]); x.add_argument("id", nargs="?")
    x.add_argument("--tipo", choices=["RN", "RC"]); x.add_argument("--titulo"); x.add_argument("--texto")
    x.add_argument("--origem", default="não informada"); x.add_argument("--verificacao", default="manual")
    x.add_argument("--motivo"); x.add_argument("--status"); x.add_argument("--modelo"); x.set_defaults(f=_regra)

    x = sp.add_parser("agentes", help="time de agentes"); x.add_argument("acao", choices=["listar", "prompt"]); x.add_argument("id", nargs="?")
    x.set_defaults(f=_agentes)
    x = sp.add_parser("sincronizar", help="gera adaptadores para Codex/Gemini/Grok/Ollama/Nemotron e copia skills")
    x.add_argument("--modelo"); x.set_defaults(f=lambda a: print(agentes.sincronizar(a.modelo)))

    x = sp.add_parser("marca", help="identidade visual"); x.add_argument("acao", choices=["capa", "extrair"])
    x.add_argument("imagens", nargs="*"); x.add_argument("--titulo"); x.add_argument("--tema", default="ia", choices=["ia", "marketing", "renda", "pessoal"])
    x.add_argument("--formato", default="1x1", choices=list(marca.FORMATOS)); x.add_argument("--subtitulo"); x.add_argument("--selo", default="Curso")
    x.add_argument("--aplicar", action="store_true"); x.add_argument("--modelo"); x.set_defaults(f=_marca)

    x = sp.add_parser("video", help="vídeo com narração e legenda"); x.add_argument("acao", choices=["status", "cenas", "previa", "render"])
    x.add_argument("arquivo", nargs="?", help="roteiro .md (cenas) ou cenas.json (previa/render)")
    x.add_argument("--tema", default="ia", choices=["ia", "marketing", "renda", "pessoal"]); x.add_argument("--titulo")
    x.add_argument("--vertical", action="store_true"); x.add_argument("--voz", choices=["kokoro", "piper", "azure", "elevenlabs", "silencio"])
    x.add_argument("--parado", action="store_true", help="sem o zoom lento"); x.add_argument("--sem-legenda", action="store_true")
    x.set_defaults(f=_video)

    x = sp.add_parser("sprint", help="sprints dos cursos (roteiro de 2 dias)")
    x.add_argument("acao", choices=["hoje", "listar", "iniciar", "kiwify"]); x.add_argument("curso", nargs="?")
    x.add_argument("--data", help="AAAA-MM-DD (padrão: hoje)"); x.set_defaults(f=_sprint)
    x = sp.add_parser("salvar", help="confere segredos/dados pessoais/arquivos grandes e envia tudo ao git")
    x.add_argument("-m", "--mensagem", required=True); x.add_argument("--sem-enviar", action="store_true"); x.set_defaults(f=_salvar)

    a = p.parse_args(argv)
    caminho("saidas").mkdir(parents=True, exist_ok=True)
    try:
        a.f(a)
    except llm.IAIndisponivel as e:
        print("IA indisponível:", e, file=sys.stderr)
        sys.exit(3)
    except RuntimeError as e:
        print("Erro:", e, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

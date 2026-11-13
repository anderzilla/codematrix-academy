"""Pipeline diário: oportunidade → oferta → página → anúncios → aula 1 → mensagens → checklist → revisão."""
from __future__ import annotations

import csv
import re
import unicodedata
from datetime import date, timedelta
from pathlib import Path

from . import agentes, atividades, compliance, llm, prompts, rag, render, scoring
from .config import caminho, raiz, settings, temas
from .db import agora, evento, sessao


def slugify(t: str) -> str:
    t = unicodedata.normalize("NFKD", t.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:50]


def _agente(nome: str) -> str:
    return agentes.sistema(nome)


# ------------------------------------------------------------------ fila

def importar_oportunidades(arquivo: Path) -> int:
    n = 0
    with open(arquivo, encoding="utf-8") as f, sessao() as con:
        for r in csv.DictReader(f):
            nums = {k: int(r[k]) for k in ("demanda", "concorrencia", "vantagem", "velocidade", "risco")}
            preco = float(r.get("preco") or 0)
            s = scoring.score(**nums, preco=preco)
            cur = con.execute(
                "INSERT OR IGNORE INTO oportunidades(tema,titulo,subtitulo,avatar,dor,promessa,preco,formato,demanda,"
                "concorrencia,vantagem,velocidade,risco,score,fonte,criado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (r["tema"], r["titulo"], r.get("subtitulo"), r["avatar"], r["dor"], r["promessa"], preco, r["formato"],
                 *nums.values(), s, r.get("fonte"), agora()),
            )
            n += cur.rowcount
    return n


def importar_concorrentes(arquivo: Path) -> int:
    campos = ["plataforma", "nome", "url", "tema", "assunto", "preco", "formato", "promessa_resumo", "bonus",
              "garantia_dias", "temperatura", "anuncios_ativos", "fonte", "data_coleta"]
    n = 0
    with open(arquivo, encoding="utf-8") as f, sessao() as con:
        for r in csv.DictReader(f):
            if r.get("nome", "").startswith("<"):
                continue
            con.execute(
                f"INSERT INTO concorrentes({','.join(campos)}) VALUES ({','.join('?' * len(campos))})",
                [r.get(c) or None for c in campos],
            )
            n += 1
    return n


def fila(status: str = "fila") -> list[dict]:
    with sessao() as con:
        return [dict(r) for r in con.execute(
            "SELECT * FROM oportunidades WHERE status=? ORDER BY score DESC", (status,))]


def _referencias(tema: str) -> dict[str, str]:
    """Textos de concorrentes usados só na checagem de originalidade."""
    refs = {}
    with sessao() as con:
        for r in con.execute("SELECT nome, texto_referencia FROM concorrentes WHERE tema=? AND texto_referencia IS NOT NULL", (tema,)):
            refs[r["nome"]] = r["texto_referencia"]
    pasta = raiz() / "data" / "referencias"
    if pasta.exists():
        for arq in pasta.glob("*.txt"):
            refs[arq.stem] = arq.read_text(encoding="utf-8")
    return refs


def _resumo_concorrentes(tema: str) -> str:
    with sessao() as con:
        rows = con.execute(
            "SELECT nome,preco,formato,promessa_resumo,bonus,garantia_dias,temperatura,anuncios_ativos "
            "FROM concorrentes WHERE tema=? ORDER BY COALESCE(temperatura,0) DESC, COALESCE(anuncios_ativos,0) DESC LIMIT 5",
            (tema,),
        ).fetchall()
    if not rows:
        return "(sem concorrentes registrados ainda — use padrões do mercado da base de conhecimento)"
    return "\n".join(
        f"- {r['nome']}: R$ {r['preco']}, {r['formato']}; promessa: {r['promessa_resumo']}; bônus: {r['bonus']}; "
        f"garantia {r['garantia_dias']}d; temperatura {r['temperatura']}; anúncios ativos {r['anuncios_ativos']}"
        for r in rows
    )


# ------------------------------------------------------------------ revisão

def revisar_pasta(pasta: Path, tema: str) -> compliance.Resultado:
    refs = _referencias(tema)
    res = compliance.Resultado()
    for arq in sorted(pasta.glob("*.md")) + sorted(pasta.glob("*.html")):
        if arq.name in ("revisao.md", "checklist_publicacao.md", "RESUMO.md"):
            continue
        compliance.revisar_texto(arq.read_text(encoding="utf-8"), arq.name, refs, res)
    (pasta / "revisao.md").write_text(res.markdown(), encoding="utf-8")
    return res


# ------------------------------------------------------------------ checklist (sem IA: economiza tokens)

def checklist(op: dict, slug: str, entrega: date) -> str:
    cfg = settings()
    plat = cfg["marca"].get("plataforma_principal", "kiwify")
    liq = scoring.liquido_por_venda(op["preco"], plat)
    cpa = scoring.cpa_maximo(op["preco"], plat)
    return f"""# Checklist de publicação — {op['titulo']}

Plataforma: **{plat}** · Preço: **R$ {op['preco']:.2f}** · Sobra por venda: **R$ {liq:.2f}** · CPA máximo: **R$ {cpa:.2f}**

## Antes
- [ ] `revisao.md` está APROVADO e você leu a página inteira
- [ ] Nome final escolhido em `oferta.md` e domínio/perfil sem conflito de marca

## Cadastro ({plat})
- [ ] Criar produto: tipo curso/área de membros, categoria do tema "{op['tema']}"
- [ ] Descrição curta = promessa de `oferta.md`
- [ ] Preço R$ {op['preco']:.2f}; parcelamento ligado; order bump (se houver) cadastrado
- [ ] Garantia: 7 dias (mínimo legal) ou a definida na oferta
- [ ] Área de membros: módulo "Aula 1" liberado na compra; demais módulos com liberação em {entrega.strftime('%d/%m/%Y')}
- [ ] Subir a aula 1 (roteiro em `aula1.md`, slides em `aula1_slides.md`)
- [ ] Página: colar `pagina.html` (ou usar a página da plataforma com a copy de `pagina_copy.md`); trocar #CHECKOUT pelo link
- [ ] Pixel/UTM: utm_source, utm_campaign={slug}
- [ ] Afiliação/cupom de parceiro (se for usar)
- [ ] Copiar o ID do produto e rodar: `rex publicar <oferta_id> --produto-id <ID> --plataforma {plat}`

## Divulgação do dia
- [ ] 1 vídeo curto (roteiro 1 de `anuncios.md`)
- [ ] 3 stories (sequência 1)
- [ ] Mensagem 1 do WhatsApp/e-mail (`mensagens.md`) para lista e parceiros
- [ ] Anúncio pago: SÓ com teto aprovado por você

## Validação (até {(date.today() + timedelta(days=cfg['validacao']['janela_dias'])).strftime('%d/%m')})
- Meta: {cfg['validacao']['pre_vendas_minimas']} pré-vendas ou conversão ≥ {cfg['validacao']['conversao_pagina_minima']:.0%} da página
- Atingiu → `rex curso <oferta_id>` · Não atingiu → ajustar promessa 1 vez ou arquivar
"""


# ------------------------------------------------------------------ pipeline do dia

def rodar_dia(op_id: int | None = None, entrega_dias: int = 14, revisao_painel: bool = True) -> dict:
    cfg = settings()
    with sessao() as con:
        if op_id:
            op = con.execute("SELECT * FROM oportunidades WHERE id=?", (op_id,)).fetchone()
        else:
            op = con.execute("SELECT * FROM oportunidades WHERE status='fila' ORDER BY score DESC LIMIT 1").fetchone()
    if not op:
        raise RuntimeError("Fila vazia. Importe oportunidades com `rex importar`.")
    op = dict(op)
    tema_cfg = next((t for t in temas() if t["id"] == op["tema"]), {})
    slug = slugify(op["titulo"])
    pasta = caminho("saidas") / f"{date.today().isoformat()}-{slug}"
    pasta.mkdir(parents=True, exist_ok=True)
    entrega = date.today() + timedelta(days=entrega_dias)
    marca = cfg["marca"]

    sistema_estr = _agente("estrategista-oferta") + "\n\n" + prompts.REGRAS
    oferta = llm.gerar("modelar_oferta", prompts.OFERTA.format(
        tema=tema_cfg.get("nome", op["tema"]), titulo=op["titulo"], subtitulo=op.get("subtitulo") or "", avatar=op["avatar"], dor=op["dor"],
        promessa=op["promessa"], preco=op["preco"], formato=op["formato"], marca=marca["nome"],
        autor=marca["autor"], tom=marca["tom"], vantagem=tema_cfg.get("vantagem_injusta", ""),
        concorrentes=_resumo_concorrentes(op["tema"]),
        contexto=rag.contexto(f"{op['titulo']} {op['tema']} oferta preço", 3), regras=prompts.REGRAS,
    ), sistema_estr)
    (pasta / "oferta.md").write_text(oferta, encoding="utf-8")

    sistema_copy = _agente("redator-publicitario") + "\n\n" + prompts.REGRAS
    copy = llm.gerar("pagina_vendas", prompts.PAGINA.format(oferta=oferta, regras=prompts.REGRAS), sistema_copy)
    copy = llm.gerar("revisao_final_copy", prompts.REVISAO_COPY.format(copy=copy, regras=prompts.REGRAS), sistema_copy)
    (pasta / "pagina_copy.md").write_text(copy, encoding="utf-8")
    (pasta / "pagina.html").write_text(render.pagina(copy, op["titulo"], marca=marca["nome"]), encoding="utf-8")

    (pasta / "anuncios.md").write_text(
        llm.gerar("anuncios", prompts.ANUNCIOS.format(oferta=oferta, regras=prompts.REGRAS), _agente("publicitario")),
        encoding="utf-8")

    sistema_rot = _agente("roteirista") + "\n\n" + prompts.REGRAS
    aula1 = llm.gerar("roteiro_aula", prompts.AULA.format(aula="Aula 1 (amostra da pré-venda)", minutos=15,
                                                          oferta=oferta, regras=prompts.REGRAS), sistema_rot)
    (pasta / "aula1.md").write_text(aula1, encoding="utf-8")
    (pasta / "aula1_slides.md").write_text(llm.gerar("roteiro_aula", prompts.SLIDES.format(roteiro=aula1)), encoding="utf-8")

    (pasta / "mensagens.md").write_text(
        llm.gerar("anuncios", prompts.MENSAGENS.format(oferta=oferta, regras=prompts.REGRAS), sistema_copy),
        encoding="utf-8")

    (pasta / "checklist_publicacao.md").write_text(checklist(op, slug, entrega), encoding="utf-8")
    res = revisar_pasta(pasta, op["tema"])
    painel = agentes.painel(pasta) if revisao_painel else []
    bloq = agentes.bloqueios(pasta)
    pendentes = [f"{r['etapa']}/{r['agente']}:{r['veredito']}" for r in painel if r["veredito"] != "APROVADO"]
    aprovado = res.aprovado and not bloq and not pendentes  # AJUSTAR ou sem veredito = rascunho até resolver

    with sessao() as con:
        cur = con.execute(
            "INSERT INTO ofertas(oportunidade_id,slug,pasta,preco,plataforma,status,criado_em) VALUES (?,?,?,?,?,?,?)",
            (op["id"], slug, str(pasta), op["preco"], marca.get("plataforma_principal"),
             "aprovada" if aprovado else "rascunho", agora()),
        )
        oferta_id = cur.lastrowid
        con.execute("UPDATE oportunidades SET status='em_teste' WHERE id=?", (op["id"],))
    evento("dia", f"oferta {oferta_id} gerada em {pasta.name}; revisão {'ok' if aprovado else 'bloqueada'}")
    atividades.registrar("execucao", f"rex dia: oferta {oferta_id} '{op['titulo']}' → {pasta.name}; "
                         f"aprovado={aprovado}; bloqueios={bloq}", automatico=True)
    return {"oferta_id": oferta_id, "pasta": str(pasta), "aprovado": aprovado, "titulo": op["titulo"],
            "painel": painel, "bloqueios": bloq, "pendentes": pendentes}


def _modulos(oferta_md: str) -> list[str]:
    bloco = re.split(r"^##\s+Módulos.*$", oferta_md, flags=re.M | re.I)
    if len(bloco) < 2:
        return []
    corpo = re.split(r"^##\s", bloco[1], flags=re.M)[0]
    itens = [re.sub(r"^[\s\-\*\d\.\)#]+", "", linha).strip() for linha in corpo.splitlines()]
    principais = [i for i, linha in zip(itens, corpo.splitlines()) if i and not linha.startswith(("  ", "\t"))]
    return principais[:7]


def gerar_curso(oferta_id: int) -> str:
    with sessao() as con:
        of = con.execute("SELECT * FROM ofertas WHERE id=?", (oferta_id,)).fetchone()
    if not of:
        raise RuntimeError(f"Oferta {oferta_id} não encontrada")
    pasta = Path(of["pasta"])
    oferta = (pasta / "oferta.md").read_text(encoding="utf-8")
    modulos = _modulos(oferta) or ["Módulo 1", "Módulo 2", "Módulo 3", "Módulo 4"]
    destino = pasta / "curso"
    destino.mkdir(exist_ok=True)
    sistema = _agente("roteirista") + "\n\n" + prompts.REGRAS
    for i, mod in enumerate(modulos, 1):
        rot = llm.gerar("curso_completo", prompts.AULA.format(aula=mod, minutos=20, oferta=oferta, regras=prompts.REGRAS), sistema)
        (destino / f"{i:02d}_roteiro.md").write_text(rot, encoding="utf-8")
        (destino / f"{i:02d}_slides.md").write_text(llm.gerar("curso_completo", prompts.SLIDES.format(roteiro=rot)), encoding="utf-8")
    with sessao() as con:
        con.execute("UPDATE ofertas SET status='validada' WHERE id=?", (oferta_id,))
    evento("curso", f"curso da oferta {oferta_id}: {len(modulos)} módulos")
    revisar_pasta(destino, "")
    return str(destino)


def publicar(oferta_id: int, produto_id: str, plataforma: str) -> None:
    with sessao() as con:
        con.execute(
            "UPDATE ofertas SET status='publicada', produto_id=?, plataforma=?, publicado_em=? WHERE id=?",
            (produto_id, plataforma, agora(), oferta_id),
        )
    evento("publicar", f"oferta {oferta_id} → {plataforma}:{produto_id}")

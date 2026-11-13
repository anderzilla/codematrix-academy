"""Estrutura versionada dos cursos (cursos/<id>/...), checklists do sprint e salvamento seguro no git.

Tudo que a fábrica produz para um curso fica em cursos/<id>/ — roteiros, cenas, vídeos, materiais, quizzes,
páginas, marketing, retenção e configuração da Kiwify — e vai para o git com `rex salvar`.
`saidas/` continua sendo rascunho descartável (fora do git).
"""
from __future__ import annotations

import re
import subprocess
from datetime import date
from pathlib import Path

import yaml

from . import atividades, scoring
from .config import raiz

PASTAS = {
    "pocket/roteiros": "Roteiro de cada aula do Pocket (aula-01.md...). Escrito para ser narrado.",
    "pocket/cenas": "cenas.json de cada vídeo do Pocket (entrada do `rex video render`).",
    "pocket/videos": "Vídeos finais do Pocket (.mp4 via Git LFS) e legendas .srt.",
    "pocket/materiais": "Planilhas, PDFs e modelos entregues no Pocket.",
    "pocket/quizzes": "Quiz do Pocket (quiz.yaml) para cadastrar na área de membros.",
    "completo/roteiros": "Roteiros do Completo por módulo (m01-a01.md...).",
    "completo/cenas": "cenas.json dos vídeos do Completo.",
    "completo/videos": "Vídeos finais do Completo (.mp4 via Git LFS) e legendas .srt.",
    "completo/materiais": "Planilhas, modelos, apostila final.",
    "completo/quizzes": "Quizzes por módulo (m01.yaml...).",
    "paginas": "Copy das páginas (pocket.md, completo.md), página de obrigado, FAQ, capas.",
    "marketing": "Ângulos, anúncios, calendário de 7 dias, roteiros de vídeos curtos, criativos.",
    "retencao": "E-mails/WhatsApp da jornada, avaliação pós-curso, cupons de cross-sell.",
    "kiwify": "Checklist de montagem: produtos, área de membros, liberação, bump, upsell, pixels.",
    "pareceres": "Pareceres do time (rex painel) e revisão de compliance.",
    "metricas": "Relatórios do curso (sem dados pessoais de compradores).",
}

EXT_LFS = (".mp4", ".mov", ".wav", ".mp3", ".m4a")
LIMITE_MB = 45  # acima disso, só via LFS
PADROES_SEGREDO = [
    r"sk-[A-Za-z0-9_\-]{20,}", r"xi-api-key", r"client_secret\s*[:=]\s*['\"]?[A-Za-z0-9]{12,}",
    r"Ocp-Apim-Subscription-Key\s*[:=]\s*[A-Za-z0-9]{20,}", r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
]
PADRAO_PII = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b")  # e-mail ou CPF


def catalogo() -> dict:
    return yaml.safe_load((raiz() / "cursos" / "catalogo.yaml").read_text(encoding="utf-8"))


def curso(cid: str) -> dict:
    return yaml.safe_load((raiz() / "cursos" / cid / "curso.yaml").read_text(encoding="utf-8"))


def pasta(cid: str) -> Path:
    return raiz() / "cursos" / cid


# ------------------------------------------------------------------ estrutura

def iniciar(cid: str) -> Path:
    """Cria a estrutura do curso, os READMEs de cada pasta e os checklists gerados a partir do curso.yaml."""
    c, base = curso(cid), pasta(cid)
    for sub, desc in PASTAS.items():
        d = base / sub
        d.mkdir(parents=True, exist_ok=True)
        leia = d / "LEIA-ME.md"
        if not leia.exists():
            leia.write_text(f"# {sub}\n\n{desc}\n", encoding="utf-8")
    (base / "kiwify" / "montagem.md").write_text(checklist_kiwify(c), encoding="utf-8")
    preencher_modelos(c, base)
    sprint = next((x["sprint"] for x in catalogo()["cursos"] if x["id"] == cid), ["", ""])
    (base / "SPRINT.md").write_text(checklist_sprint(c, sprint), encoding="utf-8")
    atividades.registrar("execucao", f"rex sprint iniciar {cid}", automatico=True)
    return base


MODELOS = {
    "retencao-jornada.md": "retencao/jornada.md",
    "avaliacao-pos-curso.md": "retencao/avaliacao.md",
    "remarketing.md": "retencao/remarketing.md",
    "calendario-7-dias.md": "marketing/calendario-7-dias.md",
    "pagina-obrigado.md": "paginas/obrigado.md",
    "kiwify-links.yaml": "kiwify/links.yaml",
}


def preencher_modelos(c: dict, base: Path) -> list[Path]:
    """Copia os modelos de modelos/ para o curso, trocando {{CAMPOS}}. Não sobrescreve arquivos já editados."""
    p, k = c["pocket"], c["completo"]
    titulos = {x["id"]: curso(x["id"])["completo"]["titulo"] for x in catalogo()["cursos"]}
    cross = catalogo().get("cross_sell", {}).get(c["id"], [])
    valores = {
        "CURSO": k["titulo"], "POCKET": p["titulo"], "COMPLETO": k["titulo"],
        "MIN_AULA1": str(p["aulas"][0]["minutos"]), "RESULTADO_AULA1": p["entregavel"][0].lower() + p["entregavel"][1:],
        "ENTREGAVEIS": ", ".join(k.get("entregaveis", [])),
        "PRECO_UPGRADE": str(k["preco_proposto"] - p["preco_proposto"]), "PRECO_COMPLETO": str(k["preco_proposto"]),
        "CROSS_SELL": " ou ".join(titulos[x] for x in cross if x in titulos) or "o próximo curso da Academy",
        "CUPOM_ALUNO": "ALUNO-" + c["id"].split("-")[0].upper(),
    }
    criados = []
    for origem, destino in MODELOS.items():
        alvo = base / destino
        if alvo.exists():
            continue
        texto = (raiz() / "modelos" / origem).read_text(encoding="utf-8")
        for chave, valor in valores.items():
            texto = texto.replace("{{" + chave + "}}", valor)
        alvo.parent.mkdir(parents=True, exist_ok=True)
        alvo.write_text(texto, encoding="utf-8")
        criados.append(alvo)
    return criados


def _drip(dias: int) -> str:
    return "imediata na compra" if not dias else f"{dias} dia(s) após a compra"


def checklist_kiwify(c: dict) -> str:
    p, k = c["pocket"], c["completo"]
    sob_p, sob_k = scoring.liquido_por_venda(p["preco_proposto"]), scoring.liquido_por_venda(k["preco_proposto"])
    upgrade = k["preco_proposto"] - p["preco_proposto"]
    linhas = [
        f"# Montagem na Kiwify — {k['titulo']}", "",
        "> Gerado de `curso.yaml` por `rex sprint iniciar`. Preços são propostas até aprovação do Founder (RN-001).", "",
        "## Produtos",
        f"- [ ] **Pocket** — {p['titulo']} · R$ {p['preco_proposto']} (sobra ~R$ {sob_p:.2f})",
        f"- [ ] **Completo** — {k['titulo']} · R$ {k['preco_proposto']} (sobra ~R$ {sob_k:.2f})",
        f"- [ ] **Upgrade com crédito** (upsell 1 clique após o Pocket) — R$ {upgrade} · válido 72 h (prazo real)",
        f"- [ ] Order bump do Pocket: {p['bump']['titulo']} · R$ {p['bump']['preco_proposto']}",
        f"- [ ] Order bump do Completo: {k['bump']['titulo']} · R$ {k['bump']['preco_proposto']}",
        "- [ ] Garantia 7 dias em todos (RC-005) · descrição = subtítulo do curso.yaml",
        "",
        "## Área de membros (Completa — espaço único CodeMatrix Academy)",
        "- [ ] Curso Pocket e curso Completo dentro do mesmo espaço",
        "- [ ] Grupos: comprador do Pocket vê o Completo bloqueado com prévia (aula 1 do módulo 1 liberada como amostra)",
        "- [ ] Venda pela área de membros: botão do Completo e dos cursos do cross-sell",
        "- [ ] Comentários ativados · e-mail de suporte configurado · certificado com a identidade da marca",
        "",
        "### Pocket",
    ]
    for a in p["aulas"]:
        linhas.append(f"- [ ] Aula {a['n']}: {a['titulo']} ({a['minutos']} min) — vídeo + legenda .srt · liberação imediata")
    linhas += [f"- [ ] Quiz: {p['quiz']}", f"- [ ] Materiais: {', '.join(p['materiais'])}", "", "### Completo"]
    for m in k["modulos"]:
        linhas.append(f"- [ ] **Módulo {m['n']} — {m['titulo']}** · liberação {_drip(m.get('liberacao_dias', 0))}")
        for i, a in enumerate(m["aulas"], 1):
            linhas.append(f"  - [ ] Aula {m['n']}.{i}: {a}")
        if m.get("quiz"):
            linhas.append(f"  - [ ] Quiz do módulo {m['n']}")
        if m.get("material_final"):
            linhas.append(f"  - [ ] Material final para download: {m['material_final']} (só neste módulo, para incentivar a conclusão)")
    linhas += [
        "", "## Checkout e rastreamento",
        "- [ ] Pixel Meta + Google em todos os produtos · domínio verificado",
        "- [ ] Página de obrigado: boas-vindas, vídeo de 30 s, link do grupo · `paginas/obrigado.md`",
        "- [ ] Upsell 1 clique configurado no Pocket (IDs dos botões conforme a ajuda da Kiwify)",
        "- [ ] Cupons: parceiro, aluno (cross-sell), Black Friday — margem conferida com `rex conta`",
        "- [ ] Webhook de compra aprovada → ferramenta de e-mail escolhida (seção retenção)",
        "- [ ] Registrar IDs: `rex publicar <oferta> --produto-id <id>` para Pocket e Completo",
    ]
    return "\n".join(linhas) + "\n"


def checklist_sprint(c: dict, datas: list[str]) -> str:
    d1, d2 = (datas + ["", ""])[:2]
    cid = c["id"]
    return f"""# Sprint — {c['completo']['titulo']}

Dia 1: **{d1}** · Dia 2: **{d2}** · Tema: `{c['tema']}` · Pasta: `cursos/{cid}/`

## Dia 1
- [ ] 08:30 **Passo 1 — Analisar e organizar**: top 5 concorrentes (`rex concorrente add ... --tema {c['tema']}`), revisar `curso.yaml`
- [ ] 09:30 **Passo 2 — Marketing e publicidade**: conceito, ganchos, calendário → `marketing/`
- [ ] 10:30 Painel do time: `rex painel cursos/{cid} --etapas oferta,campanha`
- [ ] 11:00 **Passo 3a — Pocket**: roteiros em `pocket/roteiros/`, cenas em `pocket/cenas/`
- [ ] 13:30 Prévia: `rex video previa cursos/{cid}/pocket/cenas/aula-01.json` → olhar 3 quadros
- [ ] 14:00 Render das aulas: `rex video render ...` (16:9) · materiais e quiz do Pocket
- [ ] 17:30 `rex salvar -m "{cid}: pocket pronto"` · `rex log add ...`

## Dia 2
- [ ] 08:30 **Passo 3b — Completo**: módulos 1 e 2 renderizados; roteiros dos demais com datas de liberação
- [ ] 12:30 **Passo 3c — Kiwify**: seguir `kiwify/montagem.md`
- [ ] 13:30 **Passo 4 — Retenção**: adaptar `retencao/` (jornada D0–D30, avaliação, cupons) e públicos de remarketing
- [ ] 15:00 Gate: `rex painel cursos/{cid} --etapas pagina,publicacao --motor barato` + leitura do Founder
- [ ] 16:00 **Passo 5 — Publicar e divulgar**: produtos no ar, vídeo vertical (`--vertical`), stories, lista, parceiros
- [ ] 17:30 `rex salvar -m "{cid}: publicado"` · `rex log add --tipo decisao ...`

**Regra de corte:** se às 13:00 do dia 2 o módulo 1 do Completo não estiver pronto, publicar só o Pocket e o Completo em pré-venda com data (RC-004).
"""


def hoje(dia: date | None = None) -> str:
    dia = dia or date.today()
    iso = dia.isoformat()
    for x in catalogo()["cursos"]:
        if iso in x["sprint"]:
            n = x["sprint"].index(iso) + 1
            sp = pasta(x["id"]) / "SPRINT.md"
            if not sp.exists():
                iniciar(x["id"])
            texto = sp.read_text(encoding="utf-8")
            bloco = texto.split(f"## Dia {n}")[1].split("## Dia")[0].split("**Regra de corte")[0]
            return f"Hoje: dia {n} do sprint de `{x['id']}`\n{bloco.strip()}\n"
    return f"Nenhum sprint em {dia.strftime('%d/%m')}. Veja planos/ROTEIRO-2026-11-16.md."


# ------------------------------------------------------------------ salvar no git

def _git(*args, check=True) -> str:
    r = subprocess.run(["git", *args], cwd=raiz(), capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or r.stdout.strip())
    return r.stdout


def verificar_antes_de_salvar() -> list[str]:
    """Bloqueia segredos, dados pessoais de compradores e arquivos grandes fora do LFS."""
    problemas = []
    alterados = [l[3:].strip().strip('"') for l in _git("status", "--porcelain", "-uall").splitlines() if l and l[1] != "D" and l[0] != "D"]
    for rel in alterados:
        p = raiz() / rel
        if not p.is_file():
            continue
        mb = p.stat().st_size / 1e6
        if mb > LIMITE_MB and p.suffix.lower() not in EXT_LFS:
            problemas.append(f"{rel}: {mb:.0f} MB fora do Git LFS")
        if p.suffix.lower() in (".md", ".txt", ".yaml", ".yml", ".json", ".csv", ".py", ".html", ".srt"):
            texto = p.read_text(encoding="utf-8", errors="ignore")
            if any(re.search(pat, texto) for pat in PADROES_SEGREDO):
                problemas.append(f"{rel}: parece conter credencial")
            if "metricas" in rel or p.suffix.lower() == ".csv":
                achados = [m for m in PADRAO_PII.findall(texto) if not m.endswith(("codematrix.com.br", "exemplo.com"))]
                if achados:
                    problemas.append(f"{rel}: parece conter e-mail/CPF de pessoas ({len(achados)} ocorrência(s))")
    return problemas


def salvar(mensagem: str, enviar: bool = True) -> str:
    problemas = verificar_antes_de_salvar()
    if problemas:
        raise RuntimeError("Salvamento bloqueado:\n- " + "\n- ".join(problemas))
    _git("add", "-A")
    if not _git("status", "--porcelain"):
        return "Nada para salvar."
    _git("commit", "-m", mensagem)
    saida = f"Commit: {_git('log', '-1', '--format=%h %s').strip()}"
    if enviar:
        _git("push", check=False)
        saida += " · enviado ao GitHub (confira com `git status`)"
    return saida

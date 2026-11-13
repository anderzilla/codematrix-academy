"""Revisão automática: promessas proibidas e originalidade frente a textos de concorrentes."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from .config import settings

# (padrão, motivo, severidade) — severidade "bloqueia" impede publicar; "ajustar" pede revisão
REGRAS = [
    (r"\b(renda|lucro|ganho|resultado)s?\s+garantid[oa]s?", "Promessa de ganho/resultado garantido", "bloqueia"),
    (r"\bgaranti(mos|do)\s+que\s+voc[eê]\s+(vai|ir[aá])\s+(ganhar|faturar|lucrar)", "Garantia de ganho", "bloqueia"),
    (r"\b(ganhe|fature|lucre)\s+(at[eé]\s+)?r\$\s?\d", "Valor de ganho prometido", "bloqueia"),
    (r"\bfique\s+rico|enrique[cç]a\b|dinheiro\s+f[aá]cil", "Promessa de enriquecimento", "bloqueia"),
    (r"\b(cura|curar|tratamento\s+definitivo)\b", "Alegação de saúde", "bloqueia"),
    (r"\b(compre|invista\s+em)\s+(a[cç][aã]o|a[cç][oõ]es|bitcoin|cripto)", "Recomendação de investimento", "bloqueia"),
    (r"[uú]ltimas?\s+vagas|s[oó]\s+hoje|vagas\s+limitadas", "Escassez — confirme que é real", "ajustar"),
    (r"\bvoc[eê]\s+(que\s+)?(est[aá]|é)\s+(endividad|obes|deprimid|desempregad)", "Atributo pessoal (reprova na Meta)", "ajustar"),
    (r"\bem\s+\d+\s+dias\s+voc[eê]\s+(vai|ir[aá])", "Prazo de resultado — confirme que a aula entrega", "ajustar"),
    (r"\d[\d\.]*\s+alunos|depoimento|aluno\s+\w+\s+faturou", "Prova social — use só se for real", "ajustar"),
]


@dataclass
class Resultado:
    achados: list[dict] = field(default_factory=list)
    similaridade_max: float = 0.0
    concorrente_mais_parecido: str | None = None

    @property
    def aprovado(self) -> bool:
        lim = settings().get("originalidade", {}).get("limite_similaridade", 0.35)
        return not any(a["severidade"] == "bloqueia" for a in self.achados) and self.similaridade_max < lim

    def markdown(self) -> str:
        lim = settings().get("originalidade", {}).get("limite_similaridade", 0.35)
        linhas = [f"# Revisão automática — {'APROVADO' if self.aprovado else 'BLOQUEADO'}", ""]
        linhas.append(
            f"- Originalidade: similaridade máxima {self.similaridade_max:.0%} (limite {lim:.0%})"
            + (f" com '{self.concorrente_mais_parecido}'" if self.concorrente_mais_parecido else "")
        )
        if not self.achados:
            linhas.append("- Nenhuma promessa proibida encontrada.")
        for a in self.achados:
            linhas.append(f"- [{a['severidade'].upper()}] {a['motivo']} — `{a['trecho']}` ({a['arquivo']})")
        linhas += ["", "Revisão automática não substitui a sua leitura antes de publicar."]
        return "\n".join(linhas)


def _normalizar(t: str) -> str:
    t = unicodedata.normalize("NFKD", t.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9\s]", " ", t)


def _shingles(t: str, n: int) -> set[tuple[str, ...]]:
    p = _normalizar(t).split()
    return {tuple(p[i : i + n]) for i in range(max(0, len(p) - n + 1))}


def similaridade(nosso: str, deles: str, n: int | None = None) -> float:
    """Fração dos n-gramas do texto deles que aparecem no nosso (pega cópia parcial)."""
    n = n or settings().get("originalidade", {}).get("ngram", 5)
    a, b = _shingles(nosso, n), _shingles(deles, n)
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def _regras_ativas() -> list[dict]:
    """regras/automaticas.yaml; se não existir, usa a lista embutida."""
    try:
        from .regras import automaticas  # noqa: PLC0415

        extra = automaticas()
    except Exception:  # noqa: BLE001
        extra = []
    if extra:
        return extra
    return [{"padrao": p, "motivo": m, "severidade": s, "regra": "RC-002"} for p, m, s in REGRAS]


def revisar_texto(texto: str, arquivo: str, referencias: dict[str, str], res: Resultado | None = None) -> Resultado:
    res = res or Resultado()
    for r in _regras_ativas():
        flags = 0 if r.get("sensivel_caixa") else re.IGNORECASE
        for m in re.finditer(r["padrao"], texto, flags=flags):
            res.achados.append({"motivo": f"{r['motivo']} ({r.get('regra', '-')})", "severidade": r["severidade"],
                                "trecho": m.group(0), "arquivo": arquivo})
    for nome, ref in referencias.items():
        s = similaridade(texto, ref)
        if s > res.similaridade_max:
            res.similaridade_max, res.concorrente_mais_parecido = s, nome
    return res

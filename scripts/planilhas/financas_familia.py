"""Gera as planilhas do curso "Organize as finanças da família em planilhas".

- Pocket:   cursos/financas-familia/pocket/materiais/planilha-pocket.xlsx  (Como usar, Mês, Resumo)
- Completo: cursos/financas-familia/completo/materiais/planilha-completa.xlsx (+ Contas do ano, Contas a pagar,
            Reserva, Dívidas, Metas, Aposentadoria, Painel)

Uso: python scripts/planilhas/financas_familia.py   (depois: recalcular com LibreOffice para gravar os valores)
Conteúdo educativo: não recomenda produto financeiro (RC-002).
"""
from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

RAIZ = Path(__file__).resolve().parents[2]
BASE = RAIZ / "cursos" / "financas-familia"

ROXO, ROXO_CLARO, TINTA = "6D28D9", "EDE9FE", "0B1530"
F = "Arial"
BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00;"-"'
PCT = '0.0%;-0.0%;"-"'
DATA = "dd/mm/yyyy"
ENTRADA = PatternFill("solid", fgColor="FFF59D")      # células para preencher
CAB = PatternFill("solid", fgColor=ROXO)
SUB = PatternFill("solid", fgColor=ROXO_CLARO)
FINO = Side(style="thin", color="D9D3F5")
BORDA = Border(left=FINO, right=FINO, top=FINO, bottom=FINO)
N_GASTOS = 300

CATEGORIAS = [
    ("Moradia", "Fixo"), ("Escola e cursos", "Fixo"), ("Internet e telefone", "Fixo"), ("Seguros", "Fixo"),
    ("Mercado", "Essencial"), ("Energia e água", "Essencial"), ("Transporte e combustível", "Essencial"),
    ("Saúde e farmácia", "Essencial"), ("Delivery e restaurantes", "Livre"), ("Assinaturas e apps", "Livre"),
    ("Lazer", "Livre"), ("Roupas e beleza", "Livre"), ("Tarifas e juros", "Livre"), ("Presentes", "Livre"), ("Outros", "Livre"),
]


def fonte(ws):
    for row in ws.iter_rows():
        for c in row:
            if c.font is None or c.font.name != F:
                c.font = Font(name=F, size=c.font.size if c.font and c.font.size else 11, bold=c.font.bold if c.font else False,
                              color=c.font.color if c.font and c.font.color else None)


def titulo(ws, texto, sub=None):
    ws["A1"] = texto
    ws["A1"].font = Font(name=F, size=18, bold=True, color=TINTA)
    if sub:
        ws["A2"] = sub
        ws["A2"].font = Font(name=F, size=10, italic=True, color="475569")
    ws.sheet_view.showGridLines = False


def cabecalho(ws, linha, nomes, col=1):
    for i, n in enumerate(nomes):
        c = ws.cell(row=linha, column=col + i, value=n)
        c.font = Font(name=F, bold=True, color="FFFFFF")
        c.fill = CAB
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BORDA


def larguras(ws, mapa):
    for col, w in mapa.items():
        ws.column_dimensions[col].width = w


def entrada(c, fmt=None):
    c.fill = ENTRADA
    c.border = BORDA
    c.font = Font(name=F, color="0000FF")
    if fmt:
        c.number_format = fmt


def formula(c, f, fmt=None, bold=False):
    c.value = f
    c.border = BORDA
    c.font = Font(name=F, bold=bold, color="000000")
    if fmt:
        c.number_format = fmt


# ------------------------------------------------------------------ abas comuns

def aba_como_usar(wb, completo: bool):
    ws = wb.active
    ws.title = "Como usar"
    titulo(ws, "Finanças da família — " + ("planilha completa" if completo else "planilha Pocket"),
           "CodeMatrix Academy · Organize as finanças da família em planilhas")
    linhas = [
        ("Legenda", ""),
        ("Células amarelas com texto azul", "você preenche"),
        ("Células brancas com texto preto", "fórmulas — não apague"),
        ("", ""),
        ("Passo a passo", ""),
        ("1. Aba Mês", "Lance as entradas e todos os gastos do mês (data, descrição, valor, categoria). O grupo é preenchido sozinho."),
        ("2. Aba Resumo", "Veja saldo, peso de cada grupo na renda e as 3 categorias livres que mais pesam."),
        ("3. Meus cortes", "No Resumo, escreva 3 ações com valor e data de início."),
    ]
    if completo:
        linhas += [
            ("4. Contas do ano", "IPVA, IPTU, matrícula, seguros: quanto separar por mês."),
            ("5. Contas a pagar", "Vencimentos do mês com aviso de 'vence em breve'."),
            ("6. Reserva", "Meta de reserva de emergência e em quantos meses você chega lá."),
            ("7. Dívidas", "Ordem de pagamento pelos juros (avalanche) ou pelo saldo (bola de neve)."),
            ("8. Metas", "Quanto guardar por mês para cada objetivo."),
            ("9. Aposentadoria", "Simulação educativa com premissas que você ajusta."),
            ("10. Painel", "Os números da família em uma tela."),
        ]
    linhas += [("", ""), ("Importante", "Material educativo. Não é recomendação de investimento ou produto financeiro.")]
    for i, (a, b) in enumerate(linhas, start=4):
        ws.cell(row=i, column=1, value=a).font = Font(name=F, bold=bool(a and not b) or a in ("Legenda", "Passo a passo", "Importante"))
        ws.cell(row=i, column=2, value=b).font = Font(name=F)
    ws["A5"].fill = ENTRADA
    ws["A5"].font = Font(name=F, color="0000FF")
    larguras(ws, {"A": 34, "B": 100})


def aba_categorias(wb):
    ws = wb.create_sheet("Categorias")
    titulo(ws, "Categorias", "Você pode renomear ou acrescentar categorias nas linhas amarelas (mantenha o grupo).")
    cabecalho(ws, 4, ["Categoria", "Grupo"])
    for i, (cat, grp) in enumerate(CATEGORIAS, start=5):
        entrada(ws.cell(row=i, column=1, value=cat))
        entrada(ws.cell(row=i, column=2, value=grp))
    for i in range(5 + len(CATEGORIAS), 5 + len(CATEGORIAS) + 5):
        entrada(ws.cell(row=i, column=1))
        entrada(ws.cell(row=i, column=2))
    dv = DataValidation(type="list", formula1='"Fixo,Essencial,Livre"', allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(f"B5:B{4 + len(CATEGORIAS) + 5}")
    larguras(ws, {"A": 30, "B": 14})
    return f"Categorias!$A$5:$A${4 + len(CATEGORIAS) + 5}", f"Categorias!$B$5:$B${4 + len(CATEGORIAS) + 5}"


def aba_mes(wb, rng_cat, rng_grp):
    ws = wb.create_sheet("Mês")
    titulo(ws, "Mês", "Lance tudo que entrou e saiu. Exemplo nas primeiras linhas — apague e use as suas.")
    ws["A4"] = "ENTRADAS"
    ws["A4"].font = Font(name=F, bold=True, color=ROXO)
    cabecalho(ws, 5, ["Descrição", "Valor"])
    exemplos_ent = [("Salário 1", 3800), ("Salário 2", 2200)]
    for i in range(6, 16):
        entrada(ws.cell(row=i, column=1))
        entrada(ws.cell(row=i, column=2), BRL)
    for i, (d, v) in enumerate(exemplos_ent, start=6):
        ws.cell(row=i, column=1, value=d)
        ws.cell(row=i, column=2, value=v)
    ws["A16"] = "Total de entradas"
    ws["A16"].font = Font(name=F, bold=True)
    formula(ws["B16"], "=SUM(B6:B15)", BRL, True)

    ws["D4"] = "GASTOS"
    ws["D4"].font = Font(name=F, bold=True, color=ROXO)
    cabecalho(ws, 5, ["Data", "Descrição", "Valor", "Categoria", "Grupo"], col=4)
    exemplos = [
        ("2026-11-05", "Aluguel", 1800, "Moradia"), ("2026-11-06", "Supermercado", 620, "Mercado"),
        ("2026-11-08", "Pedido de pizza", 68, "Delivery e restaurantes"), ("2026-11-10", "Streaming", 45, "Assinaturas e apps"),
        ("2026-11-10", "Tarifa do pacote do banco", 39, "Tarifas e juros"),
    ]
    from datetime import date
    dv = DataValidation(type="list", formula1=f"={rng_cat}", allow_blank=True)
    ws.add_data_validation(dv)
    ultimo = 5 + N_GASTOS
    for i in range(6, ultimo + 1):
        entrada(ws.cell(row=i, column=4), DATA)
        entrada(ws.cell(row=i, column=5))
        entrada(ws.cell(row=i, column=6), BRL)
        entrada(ws.cell(row=i, column=7))
        formula(ws.cell(row=i, column=8), f'=IF(G{i}="","",IFERROR(INDEX({rng_grp},MATCH(G{i},{rng_cat},0)),"?"))')
    dv.add(f"G6:G{ultimo}")
    for i, (d, desc, v, cat) in enumerate(exemplos, start=6):
        ws.cell(row=i, column=4, value=date.fromisoformat(d))
        ws.cell(row=i, column=5, value=desc)
        ws.cell(row=i, column=6, value=v)
        ws.cell(row=i, column=7, value=cat)
    ws.freeze_panes = "D6"
    larguras(ws, {"A": 22, "B": 14, "C": 3, "D": 12, "E": 32, "F": 14, "G": 26, "H": 12})
    return ultimo


def aba_resumo(wb, ultimo, rng_cat, rng_grp):
    ws = wb.create_sheet("Resumo")
    titulo(ws, "Resumo do mês", "Tudo aqui é calculado a partir da aba Mês.")
    g = f"'Mês'!$H$6:$H${ultimo}"
    v = f"'Mês'!$F$6:$F${ultimo}"
    c = f"'Mês'!$G$6:$G${ultimo}"
    cabecalho(ws, 4, ["Indicador", "Valor", "% da renda"])
    itens = [
        ("Entradas", "='Mês'!B16", None),
        ("Gastos fixos", f'=SUMIFS({v},{g},"Fixo")', "=IFERROR(B6/$B$5,0)"),
        ("Gastos essenciais", f'=SUMIFS({v},{g},"Essencial")', "=IFERROR(B7/$B$5,0)"),
        ("Gastos livres", f'=SUMIFS({v},{g},"Livre")', "=IFERROR(B8/$B$5,0)"),
        ("Total de gastos", "=SUM(B6:B8)", "=IFERROR(B9/$B$5,0)"),
        ("Saldo do mês", "=B5-B9", "=IFERROR(B10/$B$5,0)"),
    ]
    for i, (n, f, p) in enumerate(itens, start=5):
        ws.cell(row=i, column=1, value=n).font = Font(name=F, bold=n in ("Total de gastos", "Saldo do mês"))
        formula(ws.cell(row=i, column=2), f, BRL, n == "Saldo do mês")
        if p:
            formula(ws.cell(row=i, column=3), p, PCT)
    ws.conditional_formatting.add("B10", CellIsRule(operator="lessThan", formula=["0"], font=Font(name=F, bold=True, color="C81E5B")))

    # gastos livres por categoria + top 3 (desempate pela linha)
    ws["E4"] = "Gastos livres por categoria"
    ws["E4"].font = Font(name=F, bold=True, color=ROXO)
    cabecalho(ws, 5, ["Categoria", "Total", "Ordem"], col=5)
    n = len(CATEGORIAS) + 5
    for i in range(n):
        r = 6 + i
        formula(ws.cell(row=r, column=5), f'=IF(INDEX({rng_grp},{i + 1})="Livre",INDEX({rng_cat},{i + 1}),"")')
        formula(ws.cell(row=r, column=6), f'=IF(E{r}="",0,SUMIFS({v},{c},E{r}))', BRL)
        formula(ws.cell(row=r, column=7), f"=F{r}+ROW()/1000000")
    fim = 6 + n - 1
    ws["E" + str(fim + 2)] = "Top 3 para cortar"
    ws["E" + str(fim + 2)].font = Font(name=F, bold=True, color=ROXO)
    for k in range(1, 4):
        r = fim + 2 + k
        formula(ws.cell(row=r, column=5), f"=IF(LARGE($G$6:$G${fim},{k})<1,\"-\",INDEX($E$6:$E${fim},MATCH(LARGE($G$6:$G${fim},{k}),$G$6:$G${fim},0)))")
        formula(ws.cell(row=r, column=6), f"=IF(E{r}=\"-\",0,INDEX($F$6:$F${fim},MATCH(LARGE($G$6:$G${fim},{k}),$G$6:$G${fim},0)))", BRL)
    ws.column_dimensions["G"].hidden = True

    # meus cortes
    ws["A13"] = "Meus cortes"
    ws["A13"].font = Font(name=F, bold=True, color=ROXO)
    cabecalho(ws, 14, ["Ação (reduzir, trocar ou cancelar)", "Economia por mês", "Início", "Economia no ano"])
    exemplo = ("Delivery de 10 para 4 pedidos", 270)
    for r in range(15, 18):
        entrada(ws.cell(row=r, column=1))
        entrada(ws.cell(row=r, column=2), BRL)
        entrada(ws.cell(row=r, column=3), DATA)
        formula(ws.cell(row=r, column=4), f"=B{r}*12", BRL)
    ws["A15"], ws["B15"] = exemplo
    ws["A18"] = "Total"
    ws["A18"].font = Font(name=F, bold=True)
    formula(ws["B18"], "=SUM(B15:B17)", BRL, True)
    formula(ws["D18"], "=SUM(D15:D17)", BRL, True)
    ws["A19"] = "Novo saldo do mês com os cortes"
    formula(ws["B19"], "=B10+B18", BRL, True)
    larguras(ws, {"A": 38, "B": 18, "C": 14, "D": 18, "E": 28, "F": 16})
    return ws


# ------------------------------------------------------------------ abas do Completo

def aba_contas_ano(wb):
    ws = wb.create_sheet("Contas do ano")
    titulo(ws, "Contas do ano", "Contas que vencem uma vez por ano: separe um pouco todo mês.")
    cabecalho(ws, 4, ["Conta", "Mês de vencimento (1–12)", "Valor anual", "Separar por mês"])
    ex = [("IPVA", 1, 2400), ("IPTU", 2, 1800), ("Material escolar e matrícula", 1, 1500), ("Seguro do carro", 8, 2600)]
    for r in range(5, 21):
        entrada(ws.cell(row=r, column=1))
        entrada(ws.cell(row=r, column=2))
        entrada(ws.cell(row=r, column=3), BRL)
        formula(ws.cell(row=r, column=4), f"=IF(C{r}=\"\",0,C{r}/12)", BRL)
    for r, (a, b, c) in enumerate(ex, start=5):
        ws.cell(row=r, column=1, value=a)
        ws.cell(row=r, column=2, value=b)
        ws.cell(row=r, column=3, value=c)
    ws["A21"] = "Total"
    ws["A21"].font = Font(name=F, bold=True)
    formula(ws["C21"], "=SUM(C5:C20)", BRL, True)
    formula(ws["D21"], "=SUM(D5:D20)", BRL, True)
    larguras(ws, {"A": 34, "B": 22, "C": 16, "D": 18})


def aba_contas_pagar(wb):
    from datetime import date
    ws = wb.create_sheet("Contas a pagar")
    titulo(ws, "Contas a pagar", "Status 'Pago' tira o alerta. Aviso aparece 3 dias antes do vencimento.")
    cabecalho(ws, 4, ["Vencimento", "Conta", "Valor", "Status", "Aviso"])
    dv = DataValidation(type="list", formula1='"Aberto,Pago"', allow_blank=True)
    ws.add_data_validation(dv)
    for r in range(5, 45):
        entrada(ws.cell(row=r, column=1), DATA)
        entrada(ws.cell(row=r, column=2))
        entrada(ws.cell(row=r, column=3), BRL)
        entrada(ws.cell(row=r, column=4))
        formula(ws.cell(row=r, column=5),
                f'=IF(OR(A{r}="",D{r}="Pago"),"",IF(A{r}<TODAY(),"Atrasada",IF(A{r}-TODAY()<=3,"Vence em breve","")))')
    dv.add("D5:D44")
    ws["A5"], ws["B5"], ws["C5"], ws["D5"] = date(2026, 12, 10), "Cartão de crédito", 1350, "Aberto"
    ws.conditional_formatting.add("E5:E44", FormulaRule(formula=['E5="Atrasada"'], font=Font(name=F, bold=True, color="C81E5B")))
    ws.conditional_formatting.add("E5:E44", FormulaRule(formula=['E5="Vence em breve"'], font=Font(name=F, bold=True, color="B45309")))
    ws["A46"] = "Em aberto"
    ws["A46"].font = Font(name=F, bold=True)
    formula(ws["C46"], '=SUMIFS(C5:C44,D5:D44,"<>Pago")', BRL, True)
    larguras(ws, {"A": 14, "B": 32, "C": 14, "D": 12, "E": 18})


def aba_reserva(wb):
    ws = wb.create_sheet("Reserva")
    titulo(ws, "Reserva de emergência", "Meta = custo essencial do mês × meses de proteção. Ajuste as células amarelas.")
    linhas = [
        ("Custo fixo + essencial por mês (do Resumo)", "=Resumo!B6+Resumo!B7", BRL, False),
        ("Meses de proteção desejados", 6, "0", True),
        ("Meta da reserva", "=B4*B5", BRL, False),
        ("Quanto já tenho guardado", 0, BRL, True),
        ("Quanto vou guardar por mês", 300, BRL, True),
        ("Falta", "=MAX(0,B6-B7)", BRL, False),
        ("Meses para chegar lá", '=IF(B9=0,0,IFERROR(ROUNDUP(B9/B8,0),"defina o aporte"))', "0", False),
        ("Progresso", "=IFERROR(MIN(1,B7/B6),0)", PCT, False),
    ]
    for i, (n, v, fmt, inp) in enumerate(linhas, start=4):
        ws.cell(row=i, column=1, value=n).font = Font(name=F)
        c = ws.cell(row=i, column=2, value=v)
        (entrada if inp else formula)(c, *([fmt] if inp else [v, fmt]))
    ws["A13"] = "Premissa: 6 meses é uma referência comum para quem tem renda estável; autônomos costumam usar mais. Ajuste à sua realidade."
    ws["A13"].font = Font(name=F, italic=True, size=9, color="475569")
    larguras(ws, {"A": 46, "B": 18})


def aba_dividas(wb):
    ws = wb.create_sheet("Dívidas")
    titulo(ws, "Dívidas — plano de saída", "Avalanche: paga primeiro o maior juro (economiza mais). Bola de neve: o menor saldo (motiva mais).")
    cabecalho(ws, 4, ["Credor", "Saldo devedor", "Juros ao mês", "Parcela mínima", "Ordem avalanche", "Ordem bola de neve", "Juros do mês"])
    ex = [("Cartão de crédito", 3200, 0.12, 320), ("Empréstimo pessoal", 6500, 0.045, 410), ("Cheque especial", 900, 0.08, 90)]
    for r in range(5, 17):
        entrada(ws.cell(row=r, column=1))
        entrada(ws.cell(row=r, column=2), BRL)
        entrada(ws.cell(row=r, column=3), PCT)
        entrada(ws.cell(row=r, column=4), BRL)
        formula(ws.cell(row=r, column=5), f'=IF(B{r}="","",RANK(C{r},$C$5:$C$16,0)+COUNTIF($C$5:C{r},C{r})-1)')
        formula(ws.cell(row=r, column=6), f'=IF(B{r}="","",RANK(B{r},$B$5:$B$16,1)+COUNTIF($B$5:B{r},B{r})-1)')
        formula(ws.cell(row=r, column=7), f'=IF(B{r}="",0,B{r}*C{r})', BRL)
    for r, (a, b, c, d) in enumerate(ex, start=5):
        ws.cell(row=r, column=1, value=a)
        ws.cell(row=r, column=2, value=b)
        ws.cell(row=r, column=3, value=c)
        ws.cell(row=r, column=4, value=d)
    ws["A18"] = "Totais"
    ws["A18"].font = Font(name=F, bold=True)
    formula(ws["B18"], "=SUM(B5:B16)", BRL, True)
    formula(ws["D18"], "=SUM(D5:D16)", BRL, True)
    formula(ws["G18"], "=SUM(G5:G16)", BRL, True)
    ws["A20"] = "Juros ao mês: use a taxa do contrato ou da fatura. Negocie primeiro as dívidas com juros mais altos."
    ws["A20"].font = Font(name=F, italic=True, size=9, color="475569")
    larguras(ws, {"A": 26, "B": 16, "C": 14, "D": 16, "E": 16, "F": 18, "G": 16})


def aba_metas(wb):
    from datetime import date
    ws = wb.create_sheet("Metas")
    titulo(ws, "Metas da família", "Valor, data e quanto já tem: a planilha diz quanto guardar por mês.")
    cabecalho(ws, 4, ["Meta", "Valor", "Data", "Já guardado", "Meses até a data", "Guardar por mês"])
    for r in range(5, 17):
        entrada(ws.cell(row=r, column=1))
        entrada(ws.cell(row=r, column=2), BRL)
        entrada(ws.cell(row=r, column=3), DATA)
        entrada(ws.cell(row=r, column=4), BRL)
        formula(ws.cell(row=r, column=5), f'=IF(C{r}="","",MAX(1,DATEDIF(TODAY(),C{r},"m")))', "0")
        formula(ws.cell(row=r, column=6), f'=IF(OR(B{r}="",E{r}=""),0,MAX(0,(B{r}-D{r})/E{r}))', BRL)
    ws["A5"], ws["B5"], ws["C5"], ws["D5"] = "Viagem de férias", 6000, date(2027, 12, 15), 500
    ws["A18"] = "Total por mês"
    ws["A18"].font = Font(name=F, bold=True)
    formula(ws["F18"], "=SUM(F5:F16)", BRL, True)
    larguras(ws, {"A": 30, "B": 14, "C": 14, "D": 14, "E": 16, "F": 16})


def aba_aposentadoria(wb):
    ws = wb.create_sheet("Aposentadoria")
    titulo(ws, "Aposentadoria — primeiro plano (simulação educativa)",
           "Premissas em amarelo. Não é recomendação de investimento; revise com um profissional certificado se precisar.")
    linhas = [
        ("Idade atual", 35, "0", True),
        ("Idade em que quer parar de depender do trabalho", 65, "0", True),
        ("Renda mensal desejada (em valores de hoje)", 5000, BRL, True),
        ("Já acumulado para isso", 10000, BRL, True),
        ("Rentabilidade real anual (acima da inflação) — premissa", 0.04, PCT, True),
        ("Taxa de retirada anual — premissa", 0.04, PCT, True),
        ("Anos até a meta", "=MAX(0,B5-B4)", "0", False),
        ("Patrimônio necessário", "=IFERROR(B6*12/B9,0)", BRL, False),
        ("Rentabilidade real ao mês", "=(1+B8)^(1/12)-1", '0.000%', False),
        ("Quanto guardar por mês", "=IF(B10=0,0,MAX(0,-PMT(B12,B10*12,-B7,B11)))", BRL, False),
    ]
    for i, (n, v, fmt, inp) in enumerate(linhas, start=4):
        ws.cell(row=i, column=1, value=n).font = Font(name=F, bold=n == "Quanto guardar por mês")
        c = ws.cell(row=i, column=2, value=v)
        (entrada if inp else formula)(c, *([fmt] if inp else [v, fmt]))
    ws["A15"] = ("Premissas ilustrativas: 4% de retirada anual é uma referência usada em planejamento; rentabilidades reais "
                 "variam e não são garantidas. Revise a simulação uma vez por ano.")
    ws["A15"].font = Font(name=F, italic=True, size=9, color="475569")
    ws["A15"].alignment = Alignment(wrap_text=True)
    ws.row_dimensions[15].height = 30
    larguras(ws, {"A": 56, "B": 18})


def aba_painel(wb):
    ws = wb.create_sheet("Painel", 1)
    titulo(ws, "Painel da família", "Os números que importam, atualizados pelas outras abas.")
    cabecalho(ws, 4, ["Indicador", "Valor"])
    itens = [
        ("Saldo do mês", "=Resumo!B10", BRL), ("Saldo com os cortes", "=Resumo!B19", BRL),
        ("Separar por mês para contas do ano", "='Contas do ano'!D21", BRL), ("Contas em aberto", "='Contas a pagar'!C46", BRL),
        ("Reserva: progresso", "=Reserva!B11", PCT), ("Reserva: meses para chegar", "=Reserva!B10", "0"),
        ("Dívidas: saldo total", "=Dívidas!B18", BRL), ("Dívidas: juros pagos por mês", "=Dívidas!G18", BRL),
        ("Metas: guardar por mês", "=Metas!F18", BRL), ("Aposentadoria: guardar por mês", "=Aposentadoria!B13", BRL),
    ]
    for i, (n, f, fmt) in enumerate(itens, start=5):
        ws.cell(row=i, column=1, value=n).font = Font(name=F)
        formula(ws.cell(row=i, column=2), f, fmt, True)
        ws.cell(row=i, column=1).fill = SUB if i % 2 else PatternFill()
    larguras(ws, {"A": 40, "B": 18})


def gerar(completo: bool) -> Path:
    wb = Workbook()
    aba_como_usar(wb, completo)
    rng_cat, rng_grp = aba_categorias(wb)
    ultimo = aba_mes(wb, rng_cat, rng_grp)
    aba_resumo(wb, ultimo, rng_cat, rng_grp)
    if completo:
        aba_contas_ano(wb)
        aba_contas_pagar(wb)
        aba_reserva(wb)
        aba_dividas(wb)
        aba_metas(wb)
        aba_aposentadoria(wb)
        aba_painel(wb)
    # ordem: Como usar, (Painel), Mês, Resumo, ..., Categorias no fim
    wb.move_sheet("Categorias", offset=len(wb.sheetnames) - wb.sheetnames.index("Categorias") - 1)
    for ws in wb.worksheets:
        ws.sheet_properties.tabColor = ROXO
    destino = BASE / ("completo/materiais/planilha-completa.xlsx" if completo else "pocket/materiais/planilha-pocket.xlsx")
    destino.parent.mkdir(parents=True, exist_ok=True)
    wb.save(destino)
    return destino


if __name__ == "__main__":
    for c in (False, True):
        print(gerar(c))

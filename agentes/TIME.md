# Time da CodeMatrix Academy

Cada agente é um arquivo Markdown com cabeçalho YAML (`id`, `setor`, `etapas`, `papel`, `modelo_sugerido`).
Qualquer IA usa o mesmo arquivo: Claude, Codex, Gemini, Grok, Ollama, Nemotron (veja `adaptadores/`).

## Por setor
| Setor | Agentes |
|---|---|
| Estratégia e negócio | estrategista-oferta · economista-de-negocios · economista-de-vendas |
| Pesquisa | pesquisador |
| Produto e conteúdo | roteirista · redator-de-conteudo · especialista-marketing-de-imagem · diretor-audiovisual |
| Marketing e publicidade | publicitario · redator-publicitario · especialista-marketing-digital · gestor-de-trafego |
| Vendas | especialista-vendas-internet |
| Jurídico | jurista-direito-digital · jurista-consumidor-publicidade |
| Revisão | corretor-revisor · revisor-compliance |
| Dados | analista-de-metricas |

## Por etapa (quem faz → quem revisa)
| Etapa | Produz | Revisa |
|---|---|---|
| 1. Pesquisa | pesquisador | economista-de-vendas |
| 2. Oferta | estrategista-oferta | economista-de-vendas, economista-de-negocios, jurista-consumidor-publicidade |
| 3. Conteúdo | roteirista, redator-de-conteudo | corretor-revisor |
| 4. Visual e vídeo | especialista-marketing-de-imagem, diretor-audiovisual | corretor-revisor |
| 5. Página | redator-publicitario | corretor-revisor, jurista-consumidor-publicidade |
| 6. Campanha | publicitario, redator-publicitario, especialista-marketing-digital, gestor-de-trafego | jurista-consumidor-publicidade, corretor-revisor |
| 7. Venda | especialista-vendas-internet | economista-de-vendas |
| 8. Gate de publicação | Founder | jurista-direito-digital, revisor-compliance |
| 9. Análise | analista-de-metricas | economista-de-negocios |

## Limites honestos
- Os agentes jurídicos fazem **triagem**, não parecer de advogado. Risco alto → advogado humano antes de publicar.
- Os economistas trabalham com premissas declaradas; CPA e conversão sem dado são hipóteses.
- Pareceres gerados pelo mesmo modelo que produziu a peça são uma segunda leitura, não revisão independente.
  Para peças de maior risco (página e anúncios de escala), rode o painel com outro modelo
  (`rex painel <pasta> --motor barato` ou em outra IA) e registre no LOG.

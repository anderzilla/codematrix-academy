# Regras da CodeMatrix Academy

Fonte única de regras para pessoas e IAs. Duas famílias:

| Prefixo | Pasta | O que é |
|---|---|---|
| RN | `negocio/` | Regras de negócio: dinheiro, metas, marca, dados, IA, decisões |
| RC | `cursos/` | Regras dos cursos: conteúdo, promessa, vídeo, marca, público, revisão |

Checagens automáticas (regex) ficam em `automaticas.yaml` e rodam em `rex revisar`.

## Status
- **ativa** — decidida pelo Founder ou exigida por lei/plataforma. Vale para todos.
- **proposta** — sugerida por uma IA ou agente. Só vira ativa quando o Founder aprovar (`rex regra aprovar RN-005`).
- **revogada** — mantida para histórico, com o motivo.

## Como criar uma regra
```
rex regra nova --tipo RC --titulo "..." --texto "..." --origem "<quem pediu / qual erro>"
```
Isso cria o arquivo com o próximo ID, como **proposta**, atualiza `INDICE.md` e registra no `LOG-ATIVIDADES.md`.
Uma IA nunca marca a própria regra como ativa.

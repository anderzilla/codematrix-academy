---
name: nova-regra
description: Cria, aprova ou revoga regras de negócio (RN) e de cursos (RC) da CodeMatrix Academy. Use quando o usuário definir uma regra nova ou quando um erro se repetir.
---

# Nova regra

1. `rex regra nova --tipo RN|RC --titulo "..." --texto "..." --origem "..."` → cria como **proposta**.
2. Se dá para checar por texto, acrescente o padrão em `regras/automaticas.yaml` com o ID da regra.
3. Só o Founder aprova: `rex regra aprovar <ID>` / `rex regra revogar <ID> --motivo "..."`.
4. `rex sincronizar` para os outros modelos receberem a regra.

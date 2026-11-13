# Servidor MCP `rendaextra`

Expõe a fábrica para Claude Desktop, Claude Code ou outro cliente MCP. Roda local (stdio); credenciais
continuam no cofre do Windows e nunca passam pelo cliente.

## Claude Code (na pasta da fábrica)
```powershell
claude mcp add rendaextra -- "G:\Renda Extra\Ferramentas\.venv\Scripts\python.exe" -m mcp_server.server
```

## Claude Desktop
Copie o bloco de `claude_desktop_config.example.json` para o seu `claude_desktop_config.json`.

## Ferramentas
status · oportunidades · gerar_oferta_do_dia · revisar · relatorio · sincronizar_vendas · buscar_conhecimento · conta_de_preco

Não há ferramenta de publicar, reembolsar, sacar ou anunciar — de propósito.

## Hotmart MCP de terceiros
Existe um MCP comunitário para a API da Hotmart (github.com/thaleslaray/hotmart-mcp) com mais endpoints,
incluindo criação de cupom e cancelamento de assinatura. Se usar, crie credencial separada e avalie o risco:
quem tem a credencial mexe na conta inteira.

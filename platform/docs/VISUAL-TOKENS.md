# Identidade Visual e Tokens — CodeMatrix Academy

Todos os tokens abaixo foram derivados diretamente da identidade oficial existente no repositório `CodeMatrix-Agency`:

- `design-system/codematrix-public.tokens.json` (versão `2026-08-27`)
- `site/codematrix-corporate-live/public/assets/apple-home.css`
- Assets oficiais copiados sem alteração para `public/assets/`:
  - `codematrix-logo-blue.png` (favicon / ícone)
  - `codematrix-logo-wordmark-matrix-blue.png` (wordmark principal no header e footer)

## Paleta oficial centralizada (`src/styles/tokens.css`)

| Token CSS | Valor | Uso |
|---|---|---|
| `--cm-blue` | `#174EA6` | Cor primária da marca, CTAs principais, links de destaque |
| `--cm-blue-bright` | `#2563C7` | Estado hover de botões e ações primárias |
| `--cm-navy` | `#071B3D` | Blocos escuros de destaque e contraste estrutural |
| `--cm-ink` | `#101114` | Texto principal sobre fundo claro (contraste > 16:1) |
| `--cm-muted` | `#52525B` / `#6E6E73` | Textos secundários e metadados (contraste WCAG AA verificado) |
| `--cm-paper` | `#FFFFFF` | Fundo principal e superfícies de leitura |
| `--cm-soft` | `#F5F5F7` | Superfícies secundárias, cards de módulo e rodapé |
| `--cm-focus` | `#68A4FF` | Contorno de foco acessível (`outline: 3px solid`) |
| `--cm-line` | `rgba(0, 0, 0, 0.14)` | Bordas sutis e divisores |

## Tipografia, geometria e hierarquia de estudo

- **Família:** `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- **Raios:** `--cm-radius-pill: 999px`, `--cm-radius-card: 28px`, `--cm-radius-panel: 20px`
- **Larguras máximas:** `--cm-max-content: 1024px`, `--cm-max-commercial: 1120px`
- **Tom de voz:** português do Brasil, direto, prático, sem promessas irreais, com escopo transparente entre conteúdo disponível e conteúdo planejado.
- **Acessibilidade:** link "Pular para o conteúdo principal", navegação por teclado, `aria-current`, contraste adequado em temas claros e seções `navy`, suporte a `prefers-reduced-motion`.

# Prompt — converter "Cursos e kits" do site da CodeMatrix em "CodeMatrix Academy"

**Quando usar:** somente depois que os 4 cursos (Pocket + Completo) estiverem **publicados na Kiwify** e com os links
de checkout registrados em `cursos/<id>/kiwify/links.yaml`. Antes disso, não rode.

**Onde usar:** Claude Code (ou Antigravity/Codex) aberto no repositório do site institucional
(checkout de deploy em `%USERPROFILE%\cm-deploy`). Cole o bloco abaixo como primeira mensagem.

---

```text
Contexto
Você vai alterar o site institucional da CodeMatrix (www.codematrix.com.br, Next.js). A área atual
"Cursos e kits" (/pt/cursos-e-kits e equivalente em inglês) passa a ser a vitrine da CodeMatrix Academy,
sub-marca de cursos da CodeMatrix. Produção do site: Azure Static Web Apps (codematrix-corporate).
Google Cloud Run é histórico para este site e NÃO deve receber deploy.

Fontes de verdade (leia antes de editar; estão no repositório anderzilla/codematrix-academy):
- cursos/catalogo.yaml e cursos/<id>/curso.yaml — títulos, subtítulos, módulos, entregáveis
- cursos/<id>/kiwify/links.yaml — URLs de checkout do Pocket e do Completo, IDs dos produtos, preço publicado
- marca/manual/manual-codematrix-academy.html — identidade visual (light liquid glass, cor por trilha, Trix e Pixel)
- marca/ilustracoes/*.svg e exemplos/marca/capa-*.png — ilustrações e capas por trilha
- regras/ — RC-002 (sem promessa de ganho), RC-012 (títulos com ação), RC-013 (personagens padronizados)

Objetivo
1. Criar a página /pt/academy (e /en/academy) com:
   - Hero: "CodeMatrix Academy — Aprenda fazendo. Use no dia seguinte." + 1 parágrafo do propósito
   - Quatro trilhas (IA e Tecnologia, Marketing e Vendas, Renda Extra e Negócios, Desenvolvimento e Finanças),
     cada uma com a cor da trilha e a ilustração correspondente
   - Card de cada curso: capa, título (verbo de ação), subtítulo, entregáveis, preço publicado do Completo,
     botão "Começar pelo Pocket — R$ X" e botão "Ver o curso completo"; links vindos de links.yaml
   - Seção "Como funciona": Pocket → Completo, área de membros, certificado, garantia de 7 dias
   - Seção "Guias e kits": os produtos atuais da Kiwify (guias de IA e Dev Kits) que continuarem ativos
   - FAQ (acesso, garantia, certificado, suporte) e rodapé com dados da empresa
2. Redirecionar /pt/cursos-e-kits → /pt/academy e /en/... equivalente com 301, mantendo UTMs.
3. Atualizar menu, rodapé, sitemap.xml, robots, metadados (title, description, Open Graph com a capa da Academy)
   e dados estruturados JSON-LD do tipo Course para cada curso (provider = CodeMatrix, offers com o preço publicado).
4. Manter a identidade visual e os contratos existentes do site: rotas atuais, /api/v1/leads, consentimento,
   componentes e tokens. Não redesenhar outras páginas.

Regras
- Nada de depoimentos, números de alunos, avaliações ou escassez que não existam de verdade.
- Nenhuma promessa de ganho ou resultado garantido; títulos e textos exatamente como em curso.yaml
  (ou revisados pelo Founder).
- Preços só os publicados na Kiwify (links.yaml), nunca os "preco_proposto".
- Imagens: apenas as da pasta marca/ e as capas geradas; nada de imagens ou personagens de terceiros.
- Acessibilidade: textos alternativos, contraste AA, foco visível, navegação por teclado.
- Performance: imagens otimizadas (WebP/AVIF), lazy loading, sem bibliotecas novas pesadas.

Entrega
- Branch de tarefa, mudanças pequenas e testadas (build, lint, testes existentes, verificação dos redirects e do
  JSON-LD com um validador), PR privado com prints de desktop e celular.
- NÃO fazer merge nem deploy: isso exige autorização do Founder.
- Listar no PR o que precisa de decisão (ex.: manter ou retirar algum guia/kit antigo).

Critérios de aceite
- /pt/academy e /en/academy renderizam os 4 cursos com links de checkout corretos (testar cada link).
- /pt/cursos-e-kits responde 301 para /pt/academy.
- Sitemap, menu e rodapé atualizados; nenhum link quebrado (rodar um verificador de links).
- Lighthouse em celular: Performance ≥ 85, Acessibilidade ≥ 95, SEO ≥ 95.
- Nenhuma alteração em /api/v1/leads, /admin ou outras rotas.
```

---

**Antes de rodar, conferir:**
- [ ] Os 4 cursos publicados e aprovados no gate (`rex painel ... --etapas publicacao`)
- [ ] `cursos/<id>/kiwify/links.yaml` preenchido para os 4 (modelo em `modelos/kiwify-links.yaml`)
- [ ] Logo oficial em `marca/logo.png` e cores conferidas (`rex marca extrair --aplicar`)
- [ ] Decisão sobre os guias e Dev Kits antigos: manter, agrupar em "Guias e kits" ou retirar

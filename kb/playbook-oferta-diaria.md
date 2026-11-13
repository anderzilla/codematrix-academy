# Playbook — 1 oferta testada por dia

## Manhã (fábrica, ~1h de revisão sua)
1. `rex oportunidades` → confira a fila; `rex dia` pega a de maior score (ou `--id N`).
2. A fábrica gera em `saidas/<data>-<slug>/`:
   - `oferta.md` — avatar, dor, promessa, módulos, bônus, preço, garantia, objeções, para quem não é.
   - `pagina.html` — página de pré-venda pronta para colar/hospedar.
   - `anuncios.md` — 10 ganchos, 3 roteiros de vídeo curto, 5 textos de anúncio, 3 stories.
   - `aula1.md` — roteiro da aula 1 (entregue na pré-venda como amostra).
   - `whatsapp_email.md` — sequência de 3 mensagens.
   - `checklist_publicacao.md` — passo a passo Kiwify/Hotmart.
   - `revisao.md` — compliance e originalidade.
3. Revise. Só publique com `revisao.md` = APROVADO.

## Tarde (publicação e divulgação, ~1h)
4. Cadastre o produto (pré-venda, entrega da aula 1 imediata e do curso na data prometida).
5. Poste 1 vídeo curto + stories; mande para a lista/parceiros com cupom.
6. Registre a oferta como publicada: `rex publicar <id> --produto-id <id_na_plataforma>`.

## D+1 a D+7
- `rex sync` roda sozinho 2×/dia. `rex decidir` aponta: validar → `rex curso <id>`; ajustar → nova promessa; arquivar.

## Toda segunda
- `rex analise --semanal`: onde estamos errando, o que melhorar, onde colocar esforço.

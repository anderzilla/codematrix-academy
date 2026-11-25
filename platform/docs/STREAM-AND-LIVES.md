# Cloudflare Stream e Aulas ao Vivo — Guia Operacional (Etapa 2)

## Princípios de segurança aplicados

1. **Assets privados (`requireSignedURLs`):** todos os vídeos gravados e replays de lives devem ser criados no Cloudflare Stream com `requireSignedURLs = true` e `allowedOrigins = ["academy.codematrix.com.br"]`.
2. **Backend como única autoridade:** o endpoint `POST /api/v1/app/stream/token` **nunca aceita `stream_uid` enviado pelo navegador**. Ele recebe apenas `{ courseSlug, lessonCode, assetCode }` (ou `{ liveCode }`), valida a sessão autenticada e o `entitlement` do aluno no banco, recupera o UID interno do asset e assina um token JWT RS256 de curta duração (15 minutos).
3. **Falha fechada:** quando `CLOUDFLARE_STREAM_SIGNING_KEY_ID` ou `CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY` não estão configurados no servidor/Secret Manager, ou quando o `stream_uid` ainda não foi cadastrado, o endpoint retorna `503` (`stream_not_configured`) ou `404` (`video_unavailable`).
4. **RTMPS Stream Keys fora do banco/cliente:** chaves de transmissão ao vivo nunca são gravadas em texto claro no banco nem enviadas ao navegador; ficam exclusivamente no cofre/Secret Manager e no painel da Cloudflare.
5. **Transparência sobre limites:** URLs assinadas e allowlist dificultam hotlinking e compartilhamento direto de link, mas não impedem gravação de tela no dispositivo do usuário.

## Variáveis de ambiente necessárias (somente servidor)

- `CLOUDFLARE_STREAM_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_API_TOKEN`
- `CLOUDFLARE_STREAM_SIGNING_KEY_ID`
- `CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY` (PEM ou base64 PEM)
- `CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN` (opcional; ex.: `customer-xxxx.cloudflarestream.com`)
- `CLOUDFLARE_STREAM_ALLOWED_ORIGINS` (padrão: `academy.codematrix.com.br`)

## Vinculação mínima de IDs de vídeo

Os vídeos ficam vinculados na tabela `assets` (`kind = 'stream_video'`) com `course_id`, `module_id`, `lesson_id`, `stream_uid` e `status = 'ready'`. As lives ficam em `live_events` com `live_input_uid`, `replay_stream_uid`, `retention_days` e `access_scope`. A gestão visual completa de IDs será entregue no painel `/admin` na Etapa 4.

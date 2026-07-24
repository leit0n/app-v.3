# Guardiões da Natureza

Aplicação web e móvel para registar ocorrências ambientais, obter GPS/fotografia e encaminhar cada reporte para a autoridade geográfica correspondente.

## Arranque local

1. Em `backend`, copie `.env.example` para `.env` e substitua `SUBSTITUIR_PELA_SUA_PALAVRA_PASSE` pela palavra-passe local do PostgreSQL.
2. Execute `npm ci`, `npm run db:setup` e `npm start` dentro de `backend`.
3. Abra `http://localhost:3000`.

O instalador PostgreSQL encontrado neste computador está em `C:\Program Files\PostgreSQL\18`, com o serviço a escutar em `127.0.0.1:5433`.

## Verificação

Execute `npm test` em `backend` para validar as regras de submissão. A configuração da base de dados é intencionalmente mantida fora do controlo de versões.

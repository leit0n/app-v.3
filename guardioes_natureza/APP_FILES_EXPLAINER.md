# Guardiões da Natureza — Arquivos e Pastas (explicação completa)

Este documento descreve **todas as pastas e arquivos** do repositório **guardioes_natureza**, com foco em:
- Responsabilidade de cada arquivo
- Como ele se conecta com os outros
- Quais dados/estado ele cria, lê, persiste ou transforma
- Fluxos principais (SPA web, API backend, banco/PostGIS, e app mobile)

---

## Estrutura geral do projeto

O repositório está dividido em 5 áreas principais:

1. **`web/`**: Frontend SPA (Single Page Application) em JavaScript (ES Modules). Usa um router simples, store global com persistência em `localStorage`, e chama a API real do backend.
2. **`backend/`**: API HTTP Node.js (Express) com PostgreSQL + PostGIS para reports, perfil de utilizador, painel admin, e migrações de base de dados.
3. **`database/`**: Script SQL de schema (PostgreSQL + PostGIS) para criar tipos, tabelas, constraints e dados de seed.
4. **`mobile/`**: Aplicação Flutter com câmara, geolocalização real e consumo da mesma API do backend.
5. **Raiz**: Ficheiros de configuração e documentação geral (`README.md`, `render.yaml`, `.gitignore`, `TODO.md`, `errors-report.md`).

---

# Raiz (arquivos no diretório principal)

## `README.md`

Documentação de arranque rápido do projeto.

- Explica os passos para configurar o backend localmente (cópia de `.env.example`, `npm ci`, `npm run db:setup`, `npm start`).
- Indica que o PostgreSQL local está em `C:\Program Files\PostgreSQL\18` a escutar em `127.0.0.1:5433`.
- Refere que o teste se executa com `npm test` em `backend`.

Conecta-se com `backend/config.js` (carrega `.env`) e `backend/scripts/setup-db.js` (prepara a base de dados).

---

## `render.yaml`

Ficheiro de configuração para deploy no Render (PaaS).

- Define um serviço `web` (Node.js) com build command `npm install` e start command `node server.js`.
- Conecta uma base de dados PostgreSQL (`guardioes-natureza-db`) e injeta `DATABASE_URL` como variável de ambiente.
- Permite configurar `ADMIN_USER` e `ADMIN_PASSWORD` (necessários para o painel de administração).

O deploy no Render depende de `backend/package.json` para dependências e `backend/server.js` como entrypoint.

---

## `.gitignore`

Lista ficheiros/pastas excluídos do controlo de versões:

- `backend/.env` — ficheiro de configuração local com credenciais.
- `backend/node_modules/` — dependências instaladas.
- `mobile/.dart_tool/`, `mobile/.flutter-plugins*`, `mobile/build/` — artefactos do Flutter/Dart.

---

## `errors-report.md`

Relatório de problemas encontrado por inspeção estática do código. Inclui:

- **Backend**: registo de `EADDRINUSE` ao iniciar servidor duplicado; validação de request e `DATABASE_URL` ausente; global error handler.
- **Web**: risco de mutação por referência em `web/state/store.js`; `rawSetState` (já removido na versão atual); variável não usada `nextSettings` (já removida).
- **Mobile**: app mock vs real; nenhum problema detetado na leitura estática.
- **Database**: necessidade de validação runtime do PostGIS.

Nota: Vários dos issues mencionados foram corrigidos na versão atual do código. Este ficheiro funciona como documentação histórica de QA.

---

## `TODO.md`

Plano/estado de implementação com secções:

- **Web (SPA) — DONE**: correções de UUID, persistência de settings, remoção de código inválido.
- **Backend (Node/Express) — NEXT**: validação de request, tratamento de erros.
- **Database — NEXT**: verificar execução do schema.
- **Mobile (Flutter) — NEXT**: `flutter analyze` / `flutter build`.
- **Verification — NEXT**: smoke test web.

O TODO reflete o estado de desenvolvimento e conecta-se com correções em `web/state/store.js`, `web/state/uuid.js` e `backend/app.js`.

---

# Pasta `backend/`

## `backend/package.json`

Configuração do pacote Node do backend.

- `name`: `guardioes-natureza-backend`
- `version`: `1.0.0`
- `description`: "API Core com Roteamento Espacial PostGIS"
- `scripts`:
  - `start`: `node server.js`
  - `db:migrate`: `node scripts/migrate.js`
  - `db:setup`: `node scripts/setup-db.js`
  - `test`: `node --test`
- `dependencies`:
  - `dotenv: ^16.6.1` — carrega variáveis de ambiente do ficheiro `.env`
  - `express: ^4.19.2` — framework web
  - `pg: ^8.12.0` — driver PostgreSQL

Dependências instaladas via `npm ci` ou `npm install`, com versões fixas em `package-lock.json`.

---

## `backend/config.js`

Configuração de ambiente. Carrega variáveis do ficheiro `.env` usando `dotenv`.

- Lê `process.env.ENV_FILE` ou assume `.env` no mesmo diretório.
- É importado por `server.js`, `scripts/migrate.js` e `scripts/setup-db.js`.

Sem este ficheiro, `DATABASE_URL`, `ADMIN_USER` e `ADMIN_PASSWORD` não estariam disponíveis.

---

## `backend/app.js`

Núcleo da aplicação Express. Exporta `createApp({ pool, webRoot })` e `validateReport(body)`.

### `createApp({ pool, webRoot })`

Constrói e retorna uma aplicação Express completa:

#### Middleware global
- `express.json({ limit: '7mb' })` — parsing de JSON com suporte para fotos em base64.

#### Endpoints públicos

1. **`GET /api/health`** — Devolve estado da base de dados e versão do PostGIS. Requer pool ativo.

2. **`GET /api/profile/:userId`** — Obtém perfil de utilizador (id, nickname, email, schoolName, createdAt).

3. **`PUT /api/profile/:userId`** — Atualiza nickname do utilizador. Valida nome (max 50 chars). Retorna 409 se nome duplicado.

4. **`GET /api/reports`** — Lista reports (opcionalmente filtrados por userId). Junta com tickets e authorities. Inclui coordenadas e indicador de foto.

5. **`POST /api/reports`** — Endpoint principal de submissão:
   - Valida body com `validateReport()`.
   - Usa transação SQL (`BEGIN`/`COMMIT`/`ROLLBACK`).
   - Verifica existência do utilizador.
   - Consulta `authorities` com `ST_Covers(geom, ST_SetSRID(ST_Point(...), 4326))`.
   - Insere em `reports` com geometria, accuracy, categoria, local, descrição e foto.
   - Insere em `tickets` com estado `'Encaminhado'`.
   - Retorna `201` com reportId, ticketId, status, authority contact.

#### Endpoints de administração (protegidos por Basic Auth)

- `requireAdminAuth` — middleware que verifica `ADMIN_USER`/`ADMIN_PASSWORD` via `timingSafeEqualStr`.
- `GET /admin` — Serve `admin.html`.
- `GET /api/admin/reports` — Lista completa com filtros por estado/categoria.
- `GET /api/admin/reports/:id/photo` — Serve fotografia como imagem.
- `PATCH /api/admin/reports/:id` — Atualiza estado do ticket.

#### Servir ficheiros estáticos
- `express.static(publicRoot)` e fallback para `index.html` (SPA).

#### Error handler global
- Captura erros não tratados e retorna `500`.

### `validateReport(body)`

Função de validação do body do reporte. Verifica:
- `latitude`: `-90..90`, finita
- `longitude`: `-180..180`, finita
- `accuracy`: `0..50`, finita
- `category`: deve estar em `VALID_CATEGORIES` (`lixo`, `desmatamento`, `incendio`)
- `location`: string não vazia, max 250 chars
- `description`: string não vazia, max 2000 chars
- `userId`: inteiro seguro >= 1
- `photoDataUrl`: se presente, deve começar com `data:image/` e ter <= 6MB

Retorna `{ error: mensagem }` ou `{ value: { ... } }`.

### Acoplamento
- Depende de `database/schema.sql` para a estrutura das tabelas.
- Os endpoints são consumidos por `web/state/store.js` (frontend SPA) e `mobile/lib/api_client.dart` (app Flutter).

---

## `backend/server.js`

Entrypoint do servidor. Configura Pool PostgreSQL, cria app com `createApp`, e inicia o listener.

### Fluxo
1. Carrega `config.js` para variáveis de ambiente.
2. Cria `Pool` com `DATABASE_URL` (ou `null` se não configurado).
3. Chama `createApp({ pool, webRoot })` — `webRoot` aponta para `../web`.
4. Inicia servidor na porta `process.env.PORT || 3000`.
5. Regista handlers para `SIGINT`/`SIGTERM` — fecha servidor e pool.

### Observações
- Se `DATABASE_URL` não existir, a API devolve `503` em todos os endpoints que precisam de base de dados.
- O servidor funciona mesmo sem base de dados para servir o frontend SPA.

---

## `backend/scripts/migrate.js`

Script de migração da base de dados.

- Lê `database/schema.sql` do sistema de ficheiros.
- Executa o SQL contra a base de dados usando um pool dedicado.
- Pode ser chamado via `npm run db:migrate` ou importado por `setup-db.js`.

### Tratamento de erros
- Requer `DATABASE_URL` configurada.
- Imprime erro e sai com código 1 em caso de falha.

---

## `backend/scripts/setup-db.js`

Script completo de configuração da base de dados.

### Fluxo
1. Conecta-se à base de dados `postgres` (admin) para criar a base de dados alvo se não existir.
2. Executa `migrate()` que corre o `schema.sql`.

Pode ser chamado via `npm run db:setup`. Depende de `config.js` e `migrate.js`.

---

## `backend/test/report-validation.test.js`

Testes unitários para a função `validateReport` (usando o módulo `node:test` nativo).

### Testes incluídos
1. **Aceita um reporte válido** — verifica que não há erro.
2. **Rejeita precisão fora do intervalo** — accuracy = 51 deve falhar.
3. **Rejeita userId não inteiro** — userId = 1.5 deve falhar.

Executa-se com `npm test` (que corre `node --test`). Depende de `backend/app.js` (importa `validateReport`).

---

# Pasta `database/`

## `database/schema.sql`

Script SQL completo para PostgreSQL + PostGIS.

### PostGIS
- `CREATE EXTENSION IF NOT EXISTS postgis;`

### Enums (com proteção `DO $$ ... EXCEPTION WHEN duplicate_object`)
- `authority_type`: `'Junta', 'Câmara', 'Governo'`
- `ticket_state`: `'Novo', 'Encaminhado', 'Em_Tratamento', 'Resolvido', 'Arquivado'`
- `report_category`: `'lixo', 'desmatamento', 'incendio'`

### Tabela `users`
- `id SERIAL PRIMARY KEY`
- `nickname VARCHAR(50) UNIQUE NOT NULL`
- `email VARCHAR(100) UNIQUE`
- `role VARCHAR(20) NOT NULL DEFAULT 'user'`
- `school_name VARCHAR(100)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`

### Tabela `authorities`
- `id SERIAL PRIMARY KEY`
- `name VARCHAR(100) NOT NULL`
- `type authority_type NOT NULL`
- `geom geometry(MultiPolygon, 4326) NOT NULL`
- `contact_email VARCHAR(100) NOT NULL`
- Index GIST em `geom` para consultas espaciais.

### Tabela `reports`
- `id SERIAL PRIMARY KEY`
- `user_id INT REFERENCES users(id) ON DELETE SET NULL`
- `geom geometry(Point, 4326) NOT NULL`
- `accuracy_meters NUMERIC(5,2) NOT NULL CHECK (accuracy >= 0 AND accuracy <= 50)`
- `category report_category NOT NULL DEFAULT 'lixo'`
- `location_label VARCHAR(250) NOT NULL DEFAULT ''`
- `description VARCHAR(2000) NOT NULL DEFAULT ''`
- `photo_data_url TEXT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
- Index GIST em `geom`, index composto em `(user_id, created_at DESC)`.

### Tabela `tickets`
- `id SERIAL PRIMARY KEY`
- `report_id INT UNIQUE NOT NULL REFERENCES reports(id) ON DELETE CASCADE`
- `authority_id INT NOT NULL REFERENCES authorities(id)`
- `state ticket_state NOT NULL DEFAULT 'Novo'`
- `sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
- Index em `(authority_id, state)`.

### Dados de seed
- Utilizador `convidado` (role `guest`, nickname `convidado`).
- Autoridade exemplo: `Câmara Municipal de Ponta Delgada` com um polígono que cobre grande parte de São Miguel.

### Contrato com o backend
- O endpoint `POST /api/reports` em `backend/app.js` faz `ST_Covers(geom, ST_Point(...))` — requer geometria MultiPolygon em SRID 4326.
- As colunas `category`, `location_label`, `description` e `photo_data_url` são usadas pelo backend e também pelos endpoints de listagem.

---

# Pasta `web/`

## `web/manifest.json`

Manifest da Progressive Web App (PWA).

- `name`: "Guardiões da Natureza"
- `short_name`: "Guardiões"
- `display`: "standalone" — permite instalação como app no ecrã inicial.
- `background_color` / `theme_color`: tons de verde escuro.
- `icons`: 192px, 512px e 512px maskable.
- `lang`: "pt-PT"

Conecta-se com `web/index.html` (que referencia o manifest na `<head>`) e com `web/sw.js` (que usa o manifest para cache).

---

## `web/sw.js`

Service Worker para suporte offline (estratégia "Network First" com fallback para cache).

### `install`
- Cacheia os ficheiros do shell da SPA: `index.html`, `app.js`, `manifest.json`, `router/router.js`, `state/*.js`, `ui/dom.js`, `screens/*.js`, e ícones.

### `activate`
- Limpa caches antigos.

### `fetch`
- Para pedidos não-GET ou que comecem com `/api/` ou `/admin`, não faz cache (sempre rede).
- Para outros pedidos: tenta rede primeiro; se falhar, recorre ao cache.

Isto garante que a API nunca é servida de cache (dados frescos sempre), mas a shell da app funciona offline.

---

## `web/index.html`

Arquivo HTML principal da SPA.

### Responsabilidade
- Layout base (header com nav, main com container de app).
- CSS embutido com design escuro (tema verde).
- Meta tags para PWA e iOS "Add to Home Screen".
- Carrega Leaflet (CSS + JS) de CDN para mapas interativos.
- `<script type="module" src="/app.js"></script>` — entrypoint da SPA.

### Componentes-chave
- Header: cinco tabs com `data-route`: `/`, `/map`, `/report`, `/challenges`, `/profile`.
- Main: `<div id="app">` onde o SPA injeta telas.
- Toast: `<div class="toast" id="toast">` para notificações temporárias.

O JS de `web/app.js` usa `document.getElementById('app')` e `document.getElementById('toast')`.

---

## `web/app.js`

Ponto de entrada do frontend web (SPA).

### Responsabilidade
1. Registrar service worker para suporte offline.
2. Criar store global (`createStore`).
3. Criar router (`new Router`).
4. Definir rotas e renderizadores para cada tela.
5. Fazer wiring dos cliques na navegação.
6. Iniciar router e bootstrap do store (que faz fetch inicial à API).

### Fluxo
- Importa `createStore`, `Router` e renderers de cada screen.
- `toast(msg, tone)` — mostra notificação temporária com cor conforme o tipo.
- `wireNav()` — delegação de eventos nos tabs de navegação.
- `store.bootstrap()` — faz fetch de `/api/reports`, `/api/reports?userId=...`, e `/api/profile/...` para carregar dados reais do backend.

### Acoplamento
As telas recebem sempre `root` (container DOM), `store` (estado e ações), e `router` (navegação).

---

## `web/router/router.js`

Implementação simples de router SPA.

### API
- `constructor({ mode='history', onRoute })` — suporta modo history (usado) e hash.
- `start()` — regista evento `popstate` e faz `_emit()` inicial.
- `navigate(path)` — normaliza path, faz `pushState` e chama `_emit()`.
- `_emit(pathOverride)` — calcula path atual e chama `onRoute({ path })`.
- `_normalize(path)` — garante `/` inicial, remove trailing slash excepto na raiz.

O router é apenas controlador de UI; não carrega dados.

---

## Pasta `web/state/`

### `web/state/storage.js`

Camada de persistência com `localStorage`.

- `KEY = 'guardioes_natureza_state_v1'`
- `persist(state)` — serializa e guarda em localStorage (ignora erros de quota).
- `load()` — lê e faz parse do JSON; retorna `null` em caso de erro ou inexistência.

Usado exclusivamente por `web/state/store.js`.

---

### `web/state/uuid.js`

Helper seguro para geração de UUIDs.

- `safeUUID()` — tenta `globalThis.crypto?.randomUUID` (navegadores modernos).
- Fallback: gera UUIDv4-like com `Math.random()` para ambientes sem `crypto` (HTTP, WebViews antigos).

É usado por `web/state/store.js` e `web/screens/screen-map.js` para criar IDs de reports e notificações.

---

### `web/state/state.js`

Cria o estado inicial do SPA.

#### Estrutura do estado inicial
- `profile`: `{ id: 'local', userId: 1, name: 'Guardião(a)', createdAt, settings: { notificationsEnabled: true, reduceMotion: false } }`
- `notifications`: array com duas notificações de boas-vindas.
- `reports`: array vazio (será preenchido com dados da API).
- `myReports`: array vazio (reports do utilizador atual).
- `mapFilters`: `{ types: { desmatamento: true, lixo: true, incendio: true }, onlyNearby: false, lastHotspot: null }`
- `challenges`: três desafios — `first_report` (target 1), `report_eco` (target 5), `photo_report` (target 3).

---

### `web/state/store.js`

O "cérebro" do estado global. Mantém estado em memória, persiste em `localStorage`, e faz chamadas reais à API do backend.

#### Configuração
- `API_BASE = globalThis.GUARDIOES_API_BASE ?? ''` — permite configurar URL do backend em desenvolvimento.
- `createStore({ onToast })` — devolve objeto com estado e ações.

#### Funções internas
- `getState()` — retorna estado atual (por referência).
- `setState(partial)` — merge, persist, notifica listeners.
- `bootstrap()` — carrega estado do localStorage e faz fetch inicial de:
  - Todos os reports (`/api/reports`)
  - Reports do utilizador (`/api/reports?userId=...`)
  - Perfil (`/api/profile/...`)
- Persiste dados recebidos no estado local.

#### Ações

##### `markNotificationRead(id)`
- Marca notificação como lida (atualização imutável).

##### `addNotification(note)`
- Adiciona notificação ao início da lista (max 20).

##### `updateProfile({ name })`
- Envia `PUT /api/profile/:userId` com o novo nome.
- Retorna `{ ok: true }` ou `{ ok: false, error }`.

##### `updateSettings({ notificationsEnabled, reduceMotion })`
- Atualiza settings localmente (persistido).

##### `addReport({ type, location, desc, photoDataUrl, latitude, longitude, accuracy, userId })`
- **Fluxo real**:
  1. Cria report local com ID temporário e status `a_enviar`.
  2. Envia `POST /api/reports` com todos os dados.
  3. Se sucesso: atualiza status para `encaminhado`, guarda dados da autoridade, adiciona notificação, atualiza desafios.
  4. Se falha: marca como `falhou` com mensagem de erro, mostra toast de erro.
  5. Em caso de exceção de rede: marca como `falhou` com mensagem "Sem ligação ao servidor".

##### `bumpChallengesForReport(report)`
- Atualiza progresso dos desafios baseado no report enviado.
- `report_eco`: incrementa 1.
- `first_report`: marca completo se primeiro report.
- `photo_report`: incrementa apenas se `hasPhoto`.

##### `setMapFilters(filters)`
- Atualiza filtros do mapa (merge com estado atual).

---

## Pasta `web/ui/`

### `web/ui/dom.js`

Utilitários para manipulação de DOM.

- `html(str)` — cria elemento a partir de string HTML (usa `<template>`).
- `escapeHtml(value)` — escapa caracteres HTML especiais (`&`, `<`, `>`, `"`, `'`) para prevenir XSS.

Usado por todas as screens para renderizar HTML seguro.

---

## Pasta `web/screens/`

Cada arquivo exporta `renderX({ root, store, router })` que limpa o root, gera HTML, anexa e faz wiring de eventos.

### `web/screens/screen-home.js`

Tela inicial (dashboard).

#### O que mostra
- KPI de notificações não lidas.
- "Próxima missão" com base na primeira notificação não lida.
- Atalhos para Mapa e Reportar.
- Estado global (nota sobre persistência).

#### Eventos
- `homeMissionBtn.onclick` — marca notificação como lida e navega para a rota associada.
- `markAllBtn.onclick` — marca todas as notificações como lidas.

---

### `web/screens/screen-map.js`

Tela de mapa interativo com Leaflet.

#### Responsabilidade
- Renderizar mapa real com OpenStreetMap tiles (via Leaflet).
- Mostrar hotspots persistentes (baseados em `state.reports` com coordenadas) ou seeded se não houver reports.
- Aplicar filtros de tipo e proximidade.
- Clique em hotspot inicia fluxo de reporte.
- Clique no mapa permite selecionar localização manual.

#### Hotspots
- **Persistentes**: reports do backend que têm `latitude` e `longitude` numéricas.
- **Seeded**: 3 hotspots fictícios (lixo, desmatamento, incendio).

#### Mapa Leaflet
- Inicializado quando `window.L` está disponível.
- Marcadores com popup para cada hotspot.
- Clique no mapa cria `lastHotspot` com coordenadas do clique e navega para `/report`.

#### Filtros
- Checkboxes para tipos (`desmatamento`, `lixo`, `incendio`).
- Checkbox "Apenas próximos" (filtro simulado).
- Botões "Aplicar filtros" e "Reset".

#### Importante: UUID
Usa `safeUUID()` de `web/state/uuid.js` para gerar IDs de notificações (evita uso direto de `crypto.randomUUID()`).

---

### `web/screens/screen-report.js`

Tela de reporte com fluxo completo em 3 passos.

#### Estrutura
1. **Detalhes**: select de tipo, input de local, textarea de descrição.
2. **Localização GPS**: botão para obter geolocalização real, campos para coordenadas manuais, indicador de hotspot selecionado.
3. **Fotografia**: câmara real (via `getUserMedia`), captura, e câmara simulada (fallback).

#### Funcionalidades-chave
- **Câmara real**: ativa `navigator.mediaDevices.getUserMedia` com `facingMode: 'environment'`. Permite capturar frame e converte para `dataURL`.
- **Câmara simulada**: fallback quando câmara não disponível — desenha frame com gradiente, scanlines, vignette, HUD e retângulo de foco.
- **Geolocalização**: `navigator.geolocation.getCurrentPosition` com timeout de 20s.
- **Coordenadas manuais**: input de latitude/longitude com validação.
- **Confirmação**: sumário dinâmico que atualiza com base nos campos preenchidos.
- **Envio**: chama `store.addReport()` com todos os dados (tipo, local, descrição, foto, coordenadas, precisão).

#### Validação de submissão
- Tipo, local, descrição, fotografia e GPS válido (precisão <= 50m) são obrigatórios.
- Botão "Enviar reporte" só é ativado quando todos os campos estão preenchidos.
- Confirmação com `window.confirm` antes de enviar.
- Spinner de progresso durante o envio.

---

### `web/screens/screen-challenges.js`

Tela de desafios e progressão.

#### Responsabilidade
- Exibir lista de desafios com barra de progresso (`%`).
- Exibir troféus desbloqueados.
- Exibir últimos reportes do utilizador (de `state.myReports`).
- Oferecer atalhos para Mapa e Reportar.

#### Funções auxiliares
- `pct(c)` — percentagem arredondada.
- `trophyList(challenges)` — string com troféus dos desafios completos.
- `formatMaybeDate(ts)` — formata timestamp ou retorna vazio.

#### Dados
- Progresso baseado em `state.challenges` (atualizado via `bumpChallengesForReport` no store).
- Últimos reportes de `state.myReports.slice(0, 4)`.

---

### `web/screens/screen-profile.js`

Tela de perfil do utilizador.

#### Responsabilidade
- Editar nome (via API `PUT /api/profile/:userId`).
- Exibir histórico de reports (`state.myReports`) e notificações.
- Configurar settings (persistidos via store).
- Reset do estado (limpa localStorage).

#### Eventos
- `#saveName` — chama `store.updateProfile({ name })` (chamada real à API).
- `#saveSettings` — chama `store.updateSettings()` com checkboxes.
- `#resetState` — remove chave do localStorage e recarrega página.
- Botões em notificações — marcam como lidas e navegam para a rota correspondente.

#### Histórico
- Reports: até 30 items, mostra tipo, status, local, descrição (truncada a 120 chars).
- Notificações: até 20 items, com indicador "lida"/"nova".

---

## `web/admin.html`

Painel de administração protegido por password.

### Responsabilidade
- Listar todos os reports com filtros por estado e categoria.
- Mostrar fotografias dos reports.
- Alterar estado dos tickets.

### Funcionalidades
- Tabela com colunas: Foto, ID, Data, Categoria, Local, Descrição, Reportado por, Autoridade, Estado.
- **Filtros**: dropdown para estado (`Novo`, `Encaminhado`, `Em_Tratamento`, `Resolvido`, `Arquivado`) e categoria.
- **Fotografias**: miniaturas clicáveis que abrem modal com imagem completa.
- **Alteração de estado**: dropdown inline que faz `PATCH /api/admin/reports/:id` com o novo estado.
- Coordenadas no tooltip do local.
- Autenticação Basic Auth (configurada em `backend/app.js` via `requireAdminAuth`).

---

# Pasta `web/icons/`

Contém os ícones da PWA:

- `apple-touch-icon.png` — ícone para iOS "Add to Home Screen".
- `icon-192.png` — ícone 192x192.
- `icon-512.png` — ícone 512x512.
- `icon-512-maskable.png` — ícone maskable 512x512 (para Android adaptive icons).

Referenciados por `web/manifest.json` e `web/index.html`.

---

# Pasta `mobile/`

## `mobile/README.md`

Documentação para o cliente Flutter.

- Explica como gerar plataformas (`flutter create .`).
- Instruções para adicionar permissões de câmara e localização.
- Comandos para correr: `flutter pub get` e `flutter run --dart-define=API_BASE=...`.
- Nota sobre emulador Android: `API_BASE=http://10.0.2.2:3000`.

---

## `mobile/pubspec.yaml`

Manifest do app Flutter.

- `name`: `guardioes_natureza_mobile`
- `version`: `1.0.0+1`
- `environment`: SDK `>=3.0.0 <4.0.0`
- `dependencies`:
  - `flutter` SDK
  - `geolocator: ^13.0.2` — localização GPS
  - `http: ^1.2.2` — cliente HTTP
  - `image_picker: ^1.1.2` — câmara e galeria
- `dev_dependencies`: `flutter_test` e `flutter_lints: ^3.0.0`

---

## `mobile/analysis_options.yaml`

Configuração do linter Flutter/Dart.

- Inclui `package:flutter_lints/flutter.yaml`.
- Regras: `prefer_const_constructors` e `prefer_const_declarations`.

---

## `mobile/lib/api_client.dart`

Cliente HTTP para comunicar com a API do backend.

### Construtor
- `baseUrl` — configurável via `API_BASE` (define de compilação). Default: `http://10.0.2.2:3000` (emulador Android).

### Métodos
- `fetchReports()` — `GET /api/reports`, retorna lista de reports.
- `submitReport(Map<String, dynamic>)` — `POST /api/reports`, envia reporte e retorna resposta.
- `_decode(http.Response)` — faz parse de JSON, retorna `{}` em caso de erro.

### ApiException
- Exceção personalizada com `message`.

Usado por `mobile/lib/main.dart` para carregar e submeter reports.

---

## `mobile/lib/main.dart`

Aplicação Flutter com duas abas: Reportar e Ocorrências.

### Estrutura
- `GuardioesApp` — `StatelessWidget` com tema Material3.
- `HomeScreen` — `StatefulWidget` com `NavigationBar` de duas abas.

### Aba "Reportar" (`_buildReportForm`)
Formulário completo com:
- `DropdownButtonFormField` para selecionar categoria (`lixo`, `desmatamento`, `incendio`).
- `TextField` para referência do local e descrição.
- `OutlinedButton` para obter localização GPS (via `Geolocator`).
- `OutlinedButton` para tirar fotografia (via `ImagePicker`).
- `FilledButton` para submeter ocorrência.
- Validação: local, descrição, GPS e foto obrigatórios.
- Envio: converte foto para base64, chama `ApiClient.submitReport()`, mostra resultado.

### Aba "Ocorrências" (`_buildReports`)
- Lista de reports carregados da API.
- `RefreshIndicator` para recarregar.
- Cartões com ícone por tipo, local, autoridade e estado.
- Estado vazio: "Ainda não existem ocorrências."

### Estado local
- `_category`, `_photo` (XFile), `_position` (Position), `_sending`, `_loadingReports`, `_reports`, `_currentTab`.

---

# Conclusão: como as peças se conectam

1. **Web SPA (`web/`)**:
   - `web/index.html` + `web/manifest.json` + `web/sw.js` formam uma PWA instalável.
   - `web/app.js` monta store + router e chama renderers.
   - `web/state/store.js` mantém estado, persiste em `localStorage`, e faz chamadas reais à API.
   - Telas em `web/screens/` renderizam UI e chamam ações do store.
   - `web/admin.html` é servido pelo backend com autenticação.

2. **Backend (`backend/`)**:
   - `backend/server.js` inicia servidor e pool de BD.
   - `backend/app.js` contém toda a lógica dos endpoints (criada por `createApp`).
   - `backend/config.js` carrega variáveis de ambiente.
   - `backend/scripts/` contém utilitários de setup/migração.
   - `backend/test/` contém testes unitários para `validateReport`.

3. **Database (`database/`)**:
   - `database/schema.sql` define tabelas, enums, constraints e dados de seed.
   - Executado por `backend/scripts/migrate.js` ou `setup-db.js`.

4. **Mobile (`mobile/`)**:
   - `mobile/lib/main.dart` — app Flutter com câmara, GPS e API client.
   - `mobile/lib/api_client.dart` — cliente HTTP para a API.
   - Usa os mesmos endpoints do backend (`GET /api/reports`, `POST /api/reports`).

5. **Configuração/Deploy**:
   - `render.yaml` — configuração para deploy no Render.
   - `.gitignore` — exclui ficheiros sensíveis/gerados.
   - `README.md` — instruções de arranque local.

---

# Lista completa de arquivos (checklist do snapshot)

- `README.md`
- `render.yaml`
- `.gitignore`
- `errors-report.md`
- `TODO.md`
- `backend/server.js`
- `backend/app.js`
- `backend/config.js`
- `backend/package.json`
- `backend/package-lock.json`
- `backend/scripts/migrate.js`
- `backend/scripts/setup-db.js`
- `backend/test/report-validation.test.js`
- `database/schema.sql`
- `mobile/README.md`
- `mobile/lib/main.dart`
- `mobile/lib/api_client.dart`
- `mobile/pubspec.yaml`
- `mobile/analysis_options.yaml`
- `web/index.html`
- `web/app.js`
- `web/manifest.json`
- `web/sw.js`
- `web/admin.html`
- `web/router/router.js`
- `web/state/state.js`
- `web/state/storage.js`
- `web/state/store.js`
- `web/state/uuid.js`
- `web/ui/dom.js`
- `web/screens/screen-home.js`
- `web/screens/screen-map.js`
- `web/screens/screen-report.js`
- `web/screens/screen-challenges.js`
- `web/screens/screen-profile.js`
- `web/icons/apple-touch-icon.png`
- `web/icons/icon-192.png`
- `web/icons/icon-512.png`
- `web/icons/icon-512-maskable.png`

---

## Observações de consistência (importante)

- **Fluxo real**: Ao contrário de versões anteriores simuladas, o `store.addReport()` agora faz `POST /api/reports` ao backend real, com validação, transação SQL e resposta da autoridade competente.
- **Duas fontes de reports**: O store carrega `reports` (todos) e `myReports` (apenas do utilizador) da API durante o `bootstrap()`. A tela de desafios e perfil usam `myReports`.
- **PWA completa**: O projeto inclui manifest, service worker com cache da shell, e ícones para instalação em ecrã inicial.
- **Mobile real**: O app Flutter usa geolocalização, câmara real e comunicacão HTTP com o backend — não é mais um mock.
- **Backend completo**: Com endpoints para reports, perfil, health check, administração (protegida por password), migrações e testes unitários.
- **Painel admin**: `web/admin.html` + endpoints `/api/admin/*` permitem gestão completa dos reports com autenticação Basic Auth.


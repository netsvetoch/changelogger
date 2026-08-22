---
author: Артём Нецветаев
pubDatetime: 2026-08-22T18:45:26.000Z
title: "OpenHands 1.14.0: структурированные ошибки, LLM pre-flight, Git Sync и Kimi K3 по умолчанию"
slug: openhands-v1-14-0
featured: false
draft: false
tags:
  - release
  - openhands
  - ai-agents
  - canvas
  - llm
  - automations
  - ui
  - github
description: "Разбор OpenHands v1.14.0: классификация ошибок чата в банерах + единый telemetry event error_outcome, pre-flight валидация LLM-профилей перед сохранением, страница Git Sync для автомаций, кimi-k3 как бесплатная модель по умолчанию, backend-скоуп в ссылках, dev без запечённого VITE_BACKEND_BASE_URL и полное дерево файлов на cloud-бэкенде."
---

[OpenHands](https://github.com/OpenHands/OpenHands) выпустил минорный релиз [`v1.14.0`](https://github.com/OpenHands/OpenHands/releases/tag/v1.14.0) (17 августа 2026). Тематика — надёжность конфигурации LLM и диагностика: chat начинает различать классы ошибок вместо «сырого» текста, сохранять профиль с некорректной LLM-конфигурацией теперь мешает pre-flight валидация, у автомаций появляется полноценная страница **Git Sync** (зеркалирование в git-репозиторий), а Canvas переходит на бесплатную **Kimi K3** как модель по умолчанию.

Основа статьи — GitHub Release [`v1.14.0`](https://github.com/OpenHands/OpenHands/releases/tag/v1.14.0), compare [`v1.13.0...v1.14.0`](https://github.com/OpenHands/OpenHands/compare/v1.13.0...v1.14.0) (16 commits, 140 files) и исходные PR: [#16231](https://github.com/OpenHands/OpenHands/pull/16231), [#16417](https://github.com/OpenHands/OpenHands/pull/16417), [#16521](https://github.com/OpenHands/OpenHands/pull/16521), [#16657](https://github.com/OpenHands/OpenHands/pull/16657), [#16531](https://github.com/OpenHands/OpenHands/pull/16531), [#16091](https://github.com/OpenHands/OpenHands/pull/16091), [#16605](https://github.com/OpenHands/OpenHands/pull/16605), [#16332](https://github.com/OpenHands/OpenHands/pull/16332), [#16344](https://github.com/OpenHands/OpenHands/pull/16344).

Pin в `config/defaults.json` на теге `v1.14.0`:

| Component                        | Version                      |
| -------------------------------- | ---------------------------- |
| `agentCanvas`                    | `1.14.0`                     |
| `agentServer`                    | `1.42.1`                     |
| `automation`                     | `1.7.1`                      |
| constraint `agentClientProtocol` | `agent-client-protocol<0.11` |

## Структурированные ошибки чата

[PR #16231](https://github.com/OpenHands/OpenHands/pull/16231) (closes [#16428](https://github.com/OpenHands/OpenHands/issues/16428)) меняет то, как Canvas показывает ошибки диалога. Раньше они всплывали в UI как неструктурированный текст, а в telemetry не было классификации — нельзя было отличить транзиентный/internal сбой от action-able проблемы и коррелировать диагностику.

Теперь `src/utils/error-handler.ts` классифицирует ошибку по контракту `ErrorClassification` от agent-server (`internal` / `transient` / `actionable` и т.д.) и рендерит соответствующий вариант банера:

- recoverable/actionable (например auth) → banner с warning-иконкой и токеном `--oh-warning`,
- internal → banner с error-иконкой.

`ErrorMessageBanner` проверяется тестами на иконку/текст для каждого класса (warning vs error icon).

Одновременно в telemetry эмитится **единый** event `error_outcome` с полями `error_source`, `error_kind`, `error_id`, `error_telemetry`, производными от классификации. Ключевой нюанс (`f4e0ad73c`): `error-handler.ts` вырезает эти reserved-поля из caller-supplied `metadata` до merge, чтобы вызывающий код не мог «подделать» outcome (раньше `error_id: "spoofed"` из метаданных протекал в финальный event). `ErrorDetails` также потерял поле `message` — текст ошибки больше не попадает в вызов `trackError`, но диагностика остаётся коррелируемой через `error_id` без захвата сырых сообщений.

## LLM pre-flight валидация профилей

[PR #16417](https://github.com/OpenHands/OpenHands/pull/16417) (fixes [#16416](https://github.com/OpenHands/OpenHands/issues/16416)) закрывает проблему: ошибки LLM-конфигурации всплывали только при старте диалога — то есть профиль с неработающей конфигурацией уже успевал сохраниться и «выстреливал» потом.

Теперь перед сохранением локального LLM-профиля (Settings → LLM Profiles) backend валидирует конфигурацию:

- невалидный save блокируется, показывается ошибка backend'а,
- во время проверки кнопка save показывает состояния `validating`,
- используется типизированный метод `ProfilesClient.validateProfile` из `@openhands/typescript-client`.

Совместимость сохраняется: если старый agent-server не знает endpoint валидации и отвечает 404, Canvas просто продолжает обычный save (никаких поломок на старых backends). Это работает только в supported-конфигурациях — на неподдерживаемом backend-ответе ошибка отображается напрямую.

## Automations: страница Git Sync

[PR #16521](https://github.com/OpenHands/OpenHands/pull/16521) добавляет UI для фичи автомаций (backend в `OpenHands/automation#327`): зеркалирование автомаций в git-репозиторий для видимости, версионирования и бэкапа. Раньше всё это настраивалось только вызовами endpoint'ов вручную.

Новая страница **Git Sync** на `/automations/git-sync` (кнопка в списке автомаций) показывает:

- включён ли sync (pill Enabled/Disabled),
- репозиторий / ветку / путь,
- последний синхронизированный commit и время,
- сколько автомаций ждут push'а,
- последнюю ошибку синхронизации,
- кнопку **Sync now** и форму настроек.

В `AutomationService` добавлены `getGitSyncStatus` / `updateGitSyncConfig` / `triggerGitSync` с query/mutation-хуками. Dev-лаунчер получил `OH_AUTOMATION_LOCAL_PATH`, зеркалирующий `OH_AGENT_SERVER_LOCAL_PATH`, чтобы запускать стек против локального checkout автоматизаций.

```bash
git clone https://github.com/OpenHands/automation ~/automation
git -C ~/automation checkout vasco/git-sync

OH_AUTOMATION_LOCAL_PATH=~/automation \
AUTOMATION_GIT_SYNC_ENABLED=1 \
AUTOMATION_GIT_SYNC_REPO_URL=/tmp/git-sync-remote.git \
npm run dev:automation
```

Три важных проектных решения:

1. **Только локальные backends.** Один репозиторий маппится на один agent-server; cloud-бэкенды получают пояснительное пустое состояние вместо сломанной страницы.
2. **Write-only секреты.** Токен доступа и encryption key **никогда не возвращаются** API, поэтому форма их не пре-филит и не делает вид, что знает текущее значение. У каждого есть явный контрол «clear», так что удаление креды отличимо от «оставить как есть».
3. **Частичные (partial) апдейты.** `updateGitSyncConfig` принимает частичные изменения — смена ветки не трогает остальные поля. `Sync every (seconds)` меняется на лету; `0` — только ручной sync.

Endpoint-пути git-sync заданы литерально, а не через `getAutomationEndpoint`: `InterfaceEndpoints` требует каждый объявленный ключ, и добавление git-sync ключей сломало бы существующие манифесты — это local-mode фича вне этого контракта.

## Kimi K3 — бесплатная модель по умолчанию

[PR #16657](https://github.com/OpenHands/OpenHands/pull/16657) делает `openhands/kimi-k3` дефолтной моделью Canvas и помечает её как **free**, по образцу rollout `glm-5.2` (#[16146](https://github.com/OpenHands/OpenHands/pull/16146) и #[16281](https://github.com/OpenHands/OpenHands/pull/16281)):

- `src/services/settings.ts`: `DEFAULT_SETTINGS.llm_model` и `agent_settings.llm.model` → `openhands/kimi-k3`;
- `src/components/features/onboarding/steps/setup-llm-step.tsx`: `ONBOARDING_DEFAULT_LLM_MODEL` → `openhands/kimi-k3`;
- `src/utils/format-model-name.ts`: в `FREE_OPENHANDS_MODELS` добавлен `"openhands/kimi-k3": "OpenHands Kimi K3 (free)"` (первым в списке).

```ts
// src/utils/format-model-name.ts
"openhands/kimi-k3": "OpenHands Kimi K3 (free)",
```

`kimi-k3` уже есть в SDK-константе `VERIFIED_OPENHANDS_MODELS`, так что SDK-изменения не нужны. Free-serving зависит от конфигурации LiteLLM-прокси и SaaS-сайта (companion PR в `OpenHands/saas-deploy` и enterprise).

### Onboarding: провайдер больше не «уезжает»

Связанный фикс [PR #16531](https://github.com/OpenHands/OpenHands/pull/16531) (fixes [#15685](https://github.com/OpenHands/OpenHands/issues/15685)) чинит mismatch в первом запуске: выбрав агента **OpenHands**, пользователь попадал на шаг LLM-setup, где пре-фил `openai/gpt-5.5` молча переключал dropdown провайдера на **OpenAI**. Теперь дефолт шага совпадает с `DEFAULT_SETTINGS.llm_model`, и выбранный OpenHands-провайдер остаётся выбранным. (В v1.13.0 дефолтом был `openhands/glm-5.2`; в этом релизе из-за #16657 итоговый pre-fill — `openhands/kimi-k3`.)

## Dev без запечённого VITE_BACKEND_BASE_URL

[PR #16605](https://github.com/OpenHands/OpenHands/pull/16605) (fixes [#16604](https://github.com/OpenHands/OpenHands/issues/16604)) убирает из `npm run dev` запекание абсолютного `VITE_BACKEND_BASE_URL=http://127.0.0.1:<ingressPort>` в Vite-окружение. Через SSH-туннели / ngrok / LAN этот loopback был недостижим из браузера, и приложение падало в «Disconnected (check URL or network)» toast.

Фронтенд теперь падает на `window.location.origin` (same-origin) точно так же, как это уже делали `dev:static` и production-бинарник `agent-canvas`. Дополнительно добавлена TLS-пропагация: если пользователь явно задал `VITE_BACKEND_BASE_URL` со схемой `https://`, выставляется `VITE_USE_TLS`, чтобы Vite dev-server proxy форвардил по TLS; явный `VITE_USE_TLS` остаётся в приоритете.

```bash
VITE_BACKEND_BASE_URL=https://my-backend.example.com npm run dev:frontend-only
# proxy использует HTTPS
```

Проксирования это не ломает: `vite.config.ts` маршрутизирует `/api`, `/sockets` и т.д. по `VITE_BACKEND_HOST` (который сохранён), а не по `VITE_BACKEND_BASE_URL`.

## Automations: локальный responder URL из origin

[PR #16332](https://github.com/OpenHands/OpenHands/pull/16332) (fixes [#16299](https://github.com/OpenHands/OpenHands/issues/16299), первый вклад [@adbcodes](https://github.com/adbcodes)) чинит сломанные ссылки responder'ов: при отсутствии `OPENHANDS_URL` они фолбэчились на `http://localhost:8000`, что давало нерабочие ссылки, когда Canvas доступен через VM-домен или публичный URL.

Перед настройкой локального responder'а `OPENHANDS_URL` теперь создаётся из `window.location.origin`. Пара пограничных случаев:

- существующее кастомное значение **сохраняется** (creation — это upsert, поэтому failed secret read не должен трактоваться как missing secret — тут использован свежий строгий read);
- при ошибке чтения/сохранения modal остаётся открытым на retry;
- кэш секретов сбрасывается после создания; дублирующие действия блокируются, пока setup в процессе.

## Files tab: полное дерево файлов на cloud

[PR #16344](https://github.com/OpenHands/OpenHands/pull/16344) (fixes [OHE-3053](https://linear.app/all-hands-ai/issue/OHE-3053)): на **cloud**-бэкенде вкладка Files для свежесклонированного репозитория показывала «No files in workspace», хотя VSCode видел полное дерево. На локальном хостинге всё работало.

Причина: `useWorkspaceFiles` деривировал cloud-список из `git status` (`useUnifiedGetGitChanges`), который сообщает только изменённые/untracked файлы — чистый working tree давал пустой список, а полного listing-эндпоинта для workspace в cloud API не было.

Решение — новый first-class endpoint `GET /api/v1/app-conversations/{id}/files`, который выполняет тот же ограниченный `find` **server-side** на runtime диалога и возвращает полное дерево:

- `src/api/cloud/conversation-service.api.ts`: добавлен `listCloudConversationFiles(conversationId, path)`, зеркалящий `readCloudConversationFile`;
- `useCloudWorkspaceFiles` переписан на этот endpoint с той же логикой `normalizePath` / дедупликации / cap, что и локальный путь; зависимость от `useUnifiedGetGitChanges` из хука убрана;
- локальный путь не тронут (по-прежнему bash `find` напрямую).

Cloud теперь тоже показывает неизменённые tracked файлы, как локальный хостинг. Удалённые файлы не отображаются (их всё равно нельзя открыть); для просмотра удалений остаётся diff view. Endpoint требует companion-часть на backend (**OpenHands/enterprise#135**).

## Backend-скоуп в ссылках диалогов

[PR #16091](https://github.com/OpenHands/OpenHands/pull/16091) (closes [#15574](https://github.com/OpenHands/OpenHands/issues/15574)): sidebar-ссылки на диалоги и start-task ссылки не были привязаны к бэкенду-владельцу — в multi-backend сетапе открытие из sidebar/новой вкладки могло попасть не на тот бэкенд (фолбэк на tab/global storage). Меж двух одноимённых PR (в `main` уже был #16243 с другим API-поверхностным набором) merge-коммит объединил обе реализации.

Итог — канонический набор: query-параметры `?backend=` / `?org=` в sidebar и start-task ссылках, helper `useBackendScopedPath`, активный выбор backend'а инициализируется из URL-параметров до фолбэка на tab/global storage (новая вкладка тянет диалоги с owning backend), а `NavigationLink` сохраняет active-состояние по pathname при наличии query-параметров.

## Документация и maintenance

- **Repository map** — [PR #16612](https://github.com/OpenHands/OpenHands/pull/16612): документ-карта репозитория, поясняющая, что и где лежит.
- [PR #16549](https://github.com/OpenHands/OpenHands/pull/16549): удалён сломанный workflow QA Changes.
- [PR #16607](https://github.com/OpenHands/OpenHands/pull/16607): проверка описания PR снова запускается при новых push'ах.
- [PR #16547](https://github.com/OpenHands/OpenHands/pull/16547): проверка описания PR работает и на draft PR.
- [PR #16606](https://github.com/OpenHands/OpenHands/pull/16606): удалены недостижимые frontend-модули и их тесты.
- [PR #16660](https://github.com/OpenHands/OpenHands/pull/16660): тесты захватывают логи Docker E2E-контейнеров.

## Новые контрибьюторы

Первый merged contribution: [@adbcodes](https://github.com/adbcodes) (#16332).

## Кому обновляться

| Роль                        | Зачем 1.14.0                                                                |
| --------------------------- | --------------------------------------------------------------------------- |
| Daily Canvas users          | ошибки различимы по классу; дефолтная бесплатная Kimi K3                    |
| Локальные LLM-профили       | pre-flight валидация не даст сохранить неработающую конфигурацию            |
| Automations / операторы     | страница Git Sync: видимость, версионирование, бэкап автомаций в git        |
| Multi-backend setup         | ссылки диалогов держат `?backend=`/`?org=` и не «уезжают» на чужой бэкенд   |
| Cloud-пользователи          | Files tab показывает полное дерево, а не пустоту на чистом репозитории      |
| dev через туннели/ngrok/LAN | `npm run dev` больше не падает с «Disconnected» из-за запечённого 127.0.0.1 |

Upgrade path для npm package:

```bash
npm install -g @openhands/agent-canvas@1.14.0
agent-canvas
# http://localhost:8000
```

Полный changelog: [`v1.13.0...v1.14.0`](https://github.com/OpenHands/OpenHands/compare/v1.13.0...v1.14.0).

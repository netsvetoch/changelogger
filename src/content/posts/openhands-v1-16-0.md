---
author: Артём Нецветаев
pubDatetime: 2026-08-27T18:31:15.000Z
title: "OpenHands 1.16.0: Canvas Extensions, allow-list скиллов, выбор провайдеров LLM и Linux-инсталлятор"
slug: openhands-v1-16-0
featured: false
draft: false
tags:
  - release
  - openhands
  - ai-agents
  - canvas
  - extensions
  - skills
  - llm
  - automations
  - ui
description: "Разбор OpenHands v1.16.0: runtime-расширения Canvas (страницы, сайдбар, установка), замена «все-включено» каталога скиллов на явный allow-list, выбор поддерживаемых LLM-провайдеров вместо free-text, тумблер switch_llm, дефолт openai/gpt-5.6-sol, Linux-инсталлятор (AppImage + deb) и live-фаза автомаций."
---

[OpenHands](https://github.com/OpenHands/OpenHands) выпустил минорный релиз [`v1.16.0`](https://github.com/OpenHands/OpenHands/releases/tag/v1.16.0) (27 августа 2026). Тематика — настраиваемость интерфейса и здоровье LLM-контекста: в Canvas приходят runtime-расширения **Canvas Extensions** (собственные страницы без форка кодовой базы), каталог скиллов перестаёт быть «всё включено» и заменяется на явный **allow-list**, форма добавления LLM-провайдера учится выбирать из поддерживаемого списка, отдельным тумблером становится управление инструментом **switch_llm**, а дефолтная модель меняется на **openai/gpt-5.6-sol**. Отдельно — полноценный Linux-инсталлятор для десктоп-приложения.

Основа статьи — GitHub Release [`v1.16.0`](https://github.com/OpenHands/OpenHands/releases/tag/v1.16.0), compare [`v1.15.0...v1.16.0`](https://github.com/OpenHands/OpenHands/compare/v1.15.0...v1.16.0) (40 commits, 238 files) и исходные PR: [#16895](https://github.com/OpenHands/OpenHands/pull/16895), [#16860](https://github.com/OpenHands/OpenHands/pull/16860), [#16772](https://github.com/OpenHands/OpenHands/pull/16772), [#16441](https://github.com/OpenHands/OpenHands/pull/16441), [#16922](https://github.com/OpenHands/OpenHands/pull/16922), [#16656](https://github.com/OpenHands/OpenHands/pull/16656), [#16931](https://github.com/OpenHands/OpenHands/pull/16931), [#16740](https://github.com/OpenHands/OpenHands/pull/16740), [#16181](https://github.com/OpenHands/OpenHands/pull/16181), [#16868](https://github.com/OpenHands/OpenHands/pull/16868).

Pin в `config/defaults.json` на теге `v1.16.0`:

| Component                        | Version                      |
| -------------------------------- | ---------------------------- |
| `agentCanvas`                    | `1.16.0`                     |
| `agentServer`                    | `1.44.0`                     |
| `automation`                     | `1.9.0`                      |
| `minimumAgentServer`             | `1.28.0`                     |
| constraint `agentClientProtocol` | `agent-client-protocol<0.11` |

Обновление пинов ([#16968](https://github.com/OpenHands/OpenHands/pull/16968)) подтягивает `openhands-agent-server` 1.42.1 → **1.44.0**, `openhands-automation` 1.8.0 → **1.9.0** и `@openhands/extensions` 0.18.0 → **0.19.0**. Именно `extensions@0.19.0` приносит флаг `defaultEnabled` в каталоге — основу для allow-list скиллов (см. ниже).

## Canvas Extensions: runtime-страницы, сайдбар и управление установкой

[PR #16895](https://github.com/OpenHands/OpenHands/pull/16895) (fixes [#16787](https://github.com/OpenHands/OpenHands/issues/16787)) переносит фронтенд **Canvas Extensions** в основную кодовую базу. Идея: пользователь или команда могут добавлять в Agent Canvas собственные страницы — single-page-приложения, загружаемые в рантайме, — не форкая репозиторий. Backend-часть (валидация манифеста, персистентность установки, staged refresh) уже живёт в `OpenHands/software-agent-sdk`, а frontend до релиза существовал только как прототип на форке с MSW-моком, чей контракт разошёлся с реальным API.

Что делает фронтенд-часть:

- **Активация расширений** из активного локального бэкенда: аутентифицированная загрузка бандла → импорт ESM по `Blob`-URL → вызов `activate(host)` с `registerPage`, доступным только по разрешениям манифеста. Страницы рендерятся на `/extensions/{name}/{path}` и появляются элементами в сайдбаре.
- **Teardown** при отключении, удалении или смене бэкенда, плюс per-extension состояния ошибки — расширение не «зависает» навигацией.
- **Customize → Extensions**: установка из Git-источника или локального пути на бэкенде (source / ref / repo path, по образцу flow плагинов), включение за локализованным подтверждением доверия (trust confirmation), удаление и постоянное уведомление о доверии.
- **Cloud исключён**: страница и все запросы к расширениям отключены на cloud-бэкендах.

Фронтенд подогнан под реальный REST-контракт: конверт списка `canvas_extensions`, `requested_ref` в типе, опциональный/nullable `manifest` с graceful-деградацией (пока не пришли page-contributions) и абсолютная нормализация путей страниц в манифесте. Отдельно зафиксирована парная правка: value-keyed effect активации чинит render-loop → OOM и лишнюю реактивацию при refetch по фокусу.

Демо-фикстура лежит в `src/fixtures/canvas-extensions/demo-page`; для неё добавлен mock-LLM E2E-спека жизненного цикла. Локальная проверка без бэкенда:

```bash
npm run dev:mock
# Customize → Extensions → install source src/fixtures/canvas-extensions/demo-page
# → включить (сработает trust confirmation) → пункт "Extension demo" в сайдбаре
# → страница /extensions/demo-page/hello (вложенные пути типа
#   /extensions/demo-page/hello/nested рендерят остаток)
```

Пините связанную фичу: [PR #16868](https://github.com/OpenHands/OpenHands/pull/16868) учит закреплять избранную страницу сайдбара как домашний роут. Это `src/hooks/use-pinned-home-route.ts` с per-backend+org пином в localStorage (`oh:pinned-home-route:{backendId}:{orgId}`), allowlist `isPinnableRoute` (`/customize`, `/automations` только при `hasAutomationInterface()`, никогда `/`), а `src/routes/index-home.tsx` получает `clientLoader`, который редиректит `/` на валидный пин. `SidebarNavLink` получает `pinAction` (hover-тумблер, на тач-экранах виден всегда). Валидация спроектирована так, чтобы в allowlist впоследствии подключались и страницы расширений.

## Скиллы: allow-list вместо «всё включено»

[PR #16860](https://github.com/OpenHands/OpenHands/pull/16860) (fixes [#16302](https://github.com/OpenHands/OpenHands/issues/16302)) — фаз 1–2 плана из #16302, и это заметное изменение контекста. Раньше весь каталог `@openhands/extensions` запекался в бандл и мержился в `agent_context.skills` для каждого диалога, а `disabled_skills` был единственным escape hatch'ем. Итог — ~60 тел скиллов и ~60 триггер-сетов конкурируют в каждом system prompt'е, и любое добавление в каталог автоматически включено для всех.

Теперь:

- **`enabled_skills`** — allow-list **только по запечённому каталогу**, по умолчанию включающий 11 записей, помеченных в каталоге `defaultEnabled`. `disabled_skills` сохраняет свою роль для user/project-скиллов, которые обнаруживаются в рантайме из `.agents/skills/` и должны появляться сразу. `src/utils/skill-enablement.ts` — единственное место, решающее, в какой список попадает скилл.
- **Одноразовая миграция** `useMigrateEnabledSkills`: воркспейс с deny-list, называющим скилл из каталога, сохраняет всё остальное включённым; свежий получает курируемый дефолт; уже имеющий `enabled_skills` не трогается. Обе ветки сохраняют **явный** список — это не даёт будущему `defaultEnabled`-добавлению включить себя само.
- **Открытие по имени**: скилл, вызываемый открывающим сообщением напрямую (`/standup-digest:setup`, или `/название-скилла` из кнопки «Use skill»), загружается для этого диалога независимо от списков — иначе 18 из 24 slash-команд каталога, принадлежащих скиллам off by default, молча бы «не работали» с карточек automation-пресетов.
- **Customize и диалог** получили общий хук `useSkillEnablement` вместо двух отдельный копий логики hydrate/auto-save/toggle; добавились бейдж и фасет «Recommended».

На странице Customize → Skills это 59 карточек, из них 11 включены по умолчанию и 48 выключены; `add-javadoc` (скилл из репорта) и `bitbucket*` теперь стартуют off, а toggle пишет в `enabled_skills`, а не в `disabled_skills`.

Два важных нюанса области применения:

- **Cloud не тронут**: он создаёт диалоги из собственного server-side каталога и не читает `agent_context`, поэтому и миграция, и allow-list UI ограничены локальным режимом. Cloud сохраняет старое deny-list-поведение.
- В `agent_context` теперь реально уходит и deny-list: [PR #16812](https://github.com/OpenHands/OpenHands/pull/16812) форвардит `disabled_skills` через `buildAgentContext`, чтобы backend не применял пустой deny-list и не возвращал отключённые user/project-скиллы (которые он авто-подгружает через `load_user_skills` / `load_project_skills` и лениво резолвит для project) обратно в system prompt.

## Настройки LLM и провайдеров

Этот релиз заметно доводит до ума управление LLM-конфигурацией.

**Выбор поддерживаемых провайдеров.** [PR #16772](https://github.com/OpenHands/OpenHands/pull/16772) (fixes [#16760](https://github.com/OpenHands/OpenHands/issues/16760)) убирает free-text поле идентификатора провайдера из модалки **Add provider**: теперь это поисковый селектор поддерживаемых провайдеров на базе `useSearchProviders()`, переиспользующий существующую группировку verified/other и маппинг display-name. Сохранение нового подключения требует выбора провайдера. Существующие подключения сохраняют free-text редактирование — legacy/custom идентификаторы остаются обслуживаемыми.

```ts
// create-путь: селектор вместо text input,
// загрузка списка через useSearchProviders()
const { providers } = useSearchProviders();
// выбор обязателен — без него save заблокирован
```

**Тумблер LLM-switching.** [PR #16441](https://github.com/OpenHands/OpenHands/pull/16441) делает достижимым встроенный в SDK флаг `enable_switch_llm_tool`. Суть: инструмент `switch_llm` даёт агенту право самостоятельно переводить диалог на любой сохранённый LLM-профиль, по умолчанию включён (`enable_switch_llm_tool: bool = Field(default=True)`) и под политикой `NeverConfirm` срабатывает без одобрения — то есть пользователь может «уехать» на модель, которую не выбирал. SDK отключатель уже отдавал, но Canvas его не рендерил. Теперь в редакторе профиля Agent появился `SettingsSwitch` «Let the agent switch LLM profiles» (между тумблером sub-agents и Parallel tool calls). Выключение убирает `SwitchLLMTool` из дефолтного тулсета агента.

Эмиссия поля версионируется: поле дошло до `AgentSettingsConfig` в 1.22.0, но в `OpenHandsAgentProfile` — только в 1.31.0 (`software-agent-sdk#3870`), а профили в целом появились в 1.29.0. Так как `AgentProfileBase` — `extra="forbid"`, на версиях 1.29.0–1.30.x управление скрывается, а не отдаёт 422 на сохранении всего профиля. Кстати, PR сознательно не меняет дефолт (`switch_llm` остаётся on под `NeverConfirm`) — он делает выключатель доступным как «kill switch», дизайн-вопрос значения по умолчанию вынесен в [#16442](https://github.com/OpenHands/OpenHands/issues/16442).

**Дефолтная и бесплатная модель.** [PR #16922](https://github.com/OpenHands/OpenHands/pull/16922) (fixes [#16914](https://github.com/OpenHands/OpenHands/issues/16914)) делает **`openai/gpt-5.6-sol`** дефолтной моделью Canvas и онбординга (через `DEFAULT_SETTINGS.llm_model` и `ONBOARDING_DEFAULT_LLM_MODEL`). Одновременно в frontend-лейблах бесплатных моделей остаётся ровно одна запись — `openhands/deepseek-v4-flash`: она единственная помечена Free, а `glm-5.2` этой метки уже не несёт. (В v1.14.0 дефолтом был `openhands/kimi-k3`, в v1.15.x — другая выборка; итоговая точка — OpenAI.)

Связанные фиксы по провайдерам:

- [#16863](https://github.com/OpenHands/OpenHands/pull/16863) — на cloud-бэкенде для провайдера OpenHands (`openhands/*`) ключ выдаёт сама платформа, поэтому поля API Key и Base URL (и ссылка-помощь) в «Add LLM Profile» теперь не рендерятся; для локального бэкенда и не-OpenHands-провайдеров — по-прежнему рендерятся.
- [#16758](https://github.com/OpenHands/OpenHands/pull/16758) — `useSearchProviders` не следовал `next_page_id` (в отличие от sibling-пути `searchModels`), из-за чего на cloud-провайдерском списке из 135 записей реальный `xAI` уезжал за границу страницы по умолчанию и не находился поиском. Теперь курсор-пагинация работает как в `searchModels`.
- [#16840](https://github.com/OpenHands/OpenHands/pull/16840) — онбординг-шаг подключения локального бэкенда валидировал API-ключ только через unauthenticated `/server_info`, который возвращает 200 независимо от ключа. Добавлен авторизованный pre-flight вызов `SettingsClient.getSettings()` (как в `probeBackend`), `401` явно маппится в `INVALID_BACKEND_API_KEY_ERROR`, и шаг больше не «проскакивает».

**Онбординг на настроенном бэкенде.** [PR #16931](https://github.com/OpenHands/OpenHands/pull/16931) (fixes [#16930](https://github.com/OpenHands/OpenHands/issues/16930)) расширяет скип онбординга «already configured»: раньше он был только для cloud, а для локальных бэкендов единственным гейтом был браузерный флаг `openhands-onboarded`. На общем self-hosted-сервере это означало: свежий браузер — новый человек, и онбординг затирал уже настроенный общий LLM-профиль (профиль активировался с `llm_api_key_is_set: false`). `OnboardingHost` теперь доверяет `hasUsableLlm()` (переименовано из `hasUsableCloudLlm`) для любого бэкенда, на который пользователь указал явно, — Cloud или добавленного через «Add Backend». Launcher-seeded `default-local` бэкенд намеренно исключён и сохраняет первичное вхождение по флагу.

## Automations: live-фаза запуска

[PR #16740](https://github.com/OpenHands/OpenHands/pull/16740) выводит текущую фазу запуска автоматизации (данные приходят из парного backend-изменения `OpenHands/automation#353`). Раньше запуск показывал `RUNNING` всё время работы и ничего не говорил о том, где упал. Теперь фаза появляется на трёх поверхностях, показывающих состояние запуска: строка activity-log на странице деталей автоматизации, карточки автоматизаций и закреплённые карточки на home.

Фаза показывается, только пока несёт полезную информацию — `PENDING`, `RUNNING`, `FAILED`; завершённый/отменённый запуск исчерпывается бейджем статуса. Общий предикат управляет всеми поверхностями, так что запуск не может показывать фазу в одном месте и прятать в другом (экспорт activity-log намеренно его игнорирует — для записи последняя фаза завершённого запуска важна). Известные коды рендерятся переведённым интерфейсным текстом (6 ключей × 15 языков), неизвестные — фолбэк на собственный label автора автоматизации и на сырой код. Пока запуск в полёте, рядом выводится локализованное относительное время удержания фазы: `Running agent · 12m ago`.

## Чат: файлы открываются в Files drawer

[PR #16181](https://github.com/OpenHands/OpenHands/pull/16181) (fixes [#16125](https://github.com/OpenHands/OpenHands/issues/16125)) делает ссылки на файлы в чате кликабельными. Раньше после закрытия Files drawer открыть созданный/изменённый файл можно было только через изначальный `navigate_to_file` (или вручную искать в воркспейсе). Теперь:

- добавлен `openWorkspaceFile()`, переиспользующий `navigate_to_file` после нормализации путей воркспейса;
- в chat-scoped Markdown пути, существующие в воркспейсе (в `code` / **bold** / бэктиках), открывают Files и фокусируются на файле; отсутствующие пути остаются некликабельными;
- `FilePathChip` / `PathComponent` кликабельны, заголовки `EventGroup` не вкладываются, ссылаются только пути из списка файлов воркспейса.

## Linux-инсталлятор для десктопа

[PR #16656](https://github.com/OpenHands/OpenHands/pull/16656) (closes [#16658](https://github.com/OpenHands/OpenHands/issues/16658)) закрывает пробел дистрибуции: десктоп-приложение собиралось для macOS и Windows, а Linux-пользователи были обречены на npm-лаунчер (Node + uv + открытый терминал). Хотя `electron-builder.config.mjs` уже перечислял Linux-таргеты (AppImage + deb), они ни разу не были прогнаны через CI, а deb вообще не собирался — fpm требовал maintainer, которого в `electron/package.json` не было.

Изменения:

- `.github/workflows/desktop-linux.yml`, зеркалирующий `desktop-macos.yml` / `desktop-windows.yml`: paths-filtered PR-смоук-сборка с артефактами, attach к релизу и `workflow_dispatch`.
- `linux.maintainer` в `electron-builder.config.mjs` (4 строки), чтобы существующий deb-таргет собирался.

Проверено на Fedora 43 (v1.13.0): `npx electron-builder --config electron-builder.config.mjs --publish never --linux` собирает оба таргета — `OpenHands Agent Canvas-1.13.0.AppImage` (197 MB) и `agent-canvas_1.13.0_amd64.deb` (150 MB), стек поднимается за ~5 с (`curl localhost:8000/health` → `{"status":"ok"}`). rpm намеренно не включён — AppImage покрывает Fedora/RHEL. Локальная проверка:

```bash
npm ci
npm run build:desktop
ls dist-electron/*.AppImage dist-electron/*.deb
./dist-electron/"OpenHands Agent Canvas"-*.AppImage   # окно, стек healthy на :8000
```

## Прочие фиксы

- **Windows desktop**: [#16381](https://github.com/OpenHands/OpenHands/pull/16381) — в поставку десктоп-приложения входит bundled Node, но без его `npm` на Windows; теперь npm поставляется.
- **VSCode-кнопка на self-hosted**: [#16106](https://github.com/OpenHands/OpenHands/pull/16106) — кнопка VSCode снова рендерится на локальных (self-hosted) бэкендах.
- **agent-canvas working_dir**: [#16759](https://github.com/OpenHands/OpenHands/pull/16759) — запечённый `working_dir` скоупится только под default-local backend.
- **Automations**: [#16867](https://github.com/OpenHands/OpenHands/pull/16867) — ограничен fan-out истории запусков и приостановлен polling сайдбара.
- **Conversation title на cloud**: [#16966](https://github.com/OpenHands/OpenHands/pull/16966) — переименование заголовка диалога корректно работает на cloud-бэкендах.
- **Home**: [#16881](https://github.com/OpenHands/OpenHands/pull/16881) — запоминается выбор режима локального воркспейса.
- **Telemetry Canvas identity**: [#16796](https://github.com/OpenHands/OpenHands/pull/16796) — локальная телеметрия диалога коррелируется с идентичностью Canvas.
- **ACP banner**: [#16145](https://github.com/OpenHands/OpenHands/pull/16145) — состояние «credentials configured» в баннере корректно отображается на Docker/cloud.
- **CI/process**: [#16595](https://github.com/OpenHands/OpenHands/pull/16595), [#16514](https://github.com/OpenHands/OpenHands/pull/16514), [#16828](https://github.com/OpenHands/OpenHands/pull/16828), [#16591](https://github.com/OpenHands/OpenHands/pull/16591), [#16830](https://github.com/OpenHands/OpenHands/pull/16830) — исправления readiness/смоук-проверок, reproduction steps и правки mock-LLM E2E комментариев; [#16280](https://github.com/OpenHands/OpenHands/pull/16280), [#16279](https://github.com/OpenHands/OpenHands/pull/16279) — чистка dev:extra-backend / dev:minimal сервисов по SIGHUP.

## Вердикт

`v1.16.0` — релиз, в котором OpenHands заметно меняет модель расширяемости: появляются runtime-расширения Canvas и песочница управления скиллами переходит с deny-list на allow-list, из-за чего контекст диалогов перестаёт раздуваться дефолтно-включённым каталогом. Рядом — доведение LLM-настроек (селектор провайдеров, тумблер switch_llm, дефолт OpenAI), доступный Linux-инсталлятор и полезные фиксы автомаций и чата. Для тех, кто использует облачный Canvas, ключевая часть про скиллы и расширения недоступна (cloud-бэкенды сохраняют старое поведение) — актуально в первую очередь для self-hosted-установок и десктопа.

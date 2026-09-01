---
author: Артём Нецветаев
pubDatetime: 2026-09-01T14:27:43.000Z
title: "oh-my-pi 18.1.0: нативные провайдеры ClinePass и Devin, политики моделей вместо name-matching, Agent Hub Activity"
slug: oh-my-pi-v18-1-0
featured: false
draft: false
tags:
  - release
  - oh-my-pi
  - coding-agent
  - provider
  - devin
  - clinepass
description: "Разбор oh-my-pi v18.1.0: нативные ClinePass и Devin провайдеры (CLINE_API_KEY, роутер + квоты в omp usage), переключение поведения провайдеров на resolved-политики моделей вместо name-matching, совместимый слой для Codex/Responses, Agent Hub Activity, /usage dashboard, snapcompact compat-компилятор и новые модели в каталоге."
---

[oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`) — форк терминального coding-агента [Pi](https://github.com/badlogic/pi-mono). 1 сентября 2026 вышел минорный релиз [`v18.1.0`](https://github.com/can1357/oh-my-pi/releases/tag/v18.1.0) — крупный по объёму (compare [`v18.0.11...v18.1.0`](https://github.com/can1357/oh-my-pi/compare/v18.0.11...v18.1.0), 311 коммитов, ~300 файлов), но без breaking-изменений: это в основном два новых нативных провайдера (ClinePass и Devin), перестройка внутренней логики выбора поведения моделей и большое количество фиксов вокруг воспроизведения истории OpenAI Codex/Responses.

Источники: [GitHub Release v18.1.0](https://github.com/can1357/oh-my-pi/releases/tag/v18.1.0), compare [`v18.0.11...v18.1.0`](https://github.com/can1357/oh-my-pi/compare/v18.0.11...v18.1.0), PR [#7863](https://github.com/can1357/oh-my-pi/pull/7863) (ClinePass) и [#8590](https://github.com/can1357/oh-my-pi/pull/8590) (Devin).

## Нативный провайдер ClinePass (`cline-pass`)

В `@oh-my-pi/pi-ai` добавлена поддержка платной подписки Cline Pass через официальную переменную окружения `CLINE_API_KEY` — или через логин `/login cline-pass`. PR [#7863](https://github.com/can1357/oh-my-pi/pull/7863) описывает её как аддитивный провайдер: логин валидирует аккаунт через `/users/me`, поэтому не тратит квоту и не зависит от стабильности списка моделей.

Ключевые детали:

- **Учёт и квоты**: `omp usage` показывает катящиеся (rolling) окна — пять часов, неделю и месяц.
- **Каталог**: членство определяется публичным ответом `recommended-models`, а не приватным состоянием Cline. Сейчас это 16 моделей, включая три бесплатные записи $0 на OpenRouter. Неизвестные живые id остаются доступными с консервативной метаданной и без придуманной «лестницы» reasoning, затем дообогащаются из публичного каталога OpenRouter, как это делает сам клиент Cline.
- **Транспорт** повторяет актуальный контракт Cline: официальные identity-заголовки, стабильный `X-Task-ID`, производный из сессии, mapping публичных id в wire-id, брейкпоинты промпт-кэша Qwen и точные effort-лестницы. Например, `Qwen3.7 Plus` мапит effort OMP в вложенные бюджеты `reasoning.max_tokens`.
- **Цены**: стримленный `usage.cost` перекрывает оценки каталога API-эквивалентной ценой, сохраняя реальный биллинг Cline.
- Для моделей, у которых ещё нет метаданных ClinePass, исключается «утечка» лимитов и цен в несвязанные модели LiteLLM с тем же bare-id.

## Devin: нативный CLI-интерфейс, роутер и учёт

PR [#8590](https://github.com/can1357/oh-my-pi/pull/8590) — давно назревшая переделка: раньше OMP общался с Devin под legacy-identity редактора Windsurf, и сервер отвечал «замороженным» каталогом из одной модели — подписчик видел только `SWE-1.6` и никак не получал ни SWE-1.7, ни Claude Fable 5, ни Adaptive-роутер, ни данные плана/кредитов. Теперь OMP принимает нативный identity Devin CLI (версия прижата к релизной `3000.6.2`).

Что изменилось по факту:

- **Модели**: `/models` показывает живой каталог аккаунта (у текущего Pro-аккаунта — 51 логическая модель), обновляемый по каждому credential, с точными ценами, лимитами контекста/вывода и support картинок.
- **Effort и Fast Mode**: effort-лестницы, fast-ленты и маршруты включения/выключения thinking выводятся из семейной метадаты сервера, а не из ручной таблицы. Отдельные ленты для 1M-контекста тоже сохраняются.
- **Adaptive-роутер**: теперь выбирается как обычная модель; OMP выполняет assignment handshake, и `/session` сообщает, какие конкретные модели реально обслуживали каждый ход.
- **Учёт**: `/usage` для Devin теперь показывает тарифный план, балансы кредитов, окна дневных/недельных квот со временем сброса и overage-баланс. Стоимость каждого хода в кредитах попадает в `/session` (Credits / Committed Credits / Committed ACU).
- **Селекторы**: работают нативные короткие алиасы (`devin/opus`, `devin/swe`) и точечные upstream-написания.
- **Parallel tool calls**: включаются, когда каталог модели это декларирует.
- **Seed**: добавлены статические дефолты SWE-1.6, чтобы провайдер резолвил модель по умолчанию до завершения discovery.

Из не-целей PR: Fusion, отдельное измерение picker'а для Fast-Mode (fast-ленты — отдельные модели), административные настройки команды и per-model multiplier кредитов (поле существует, но Devin-интерфейс его не показывает). Устанавливать Devin CLI не требуется — авторизация остаётся на хранилище OMP / `DEVIN_API_KEY`.

## Поведение провайдеров: resolved-политики вместо name-matching

Сквозное изменение в `@oh-my-pi/pi-ai` и каталоге: поведение провайдера теперь управляется resolved compatibility / identity / thinking / behavior-политиками конкретной модели, а не сопоставлением по имени. Это заложено и в новую декларативную систему правил в `@oh-my-pi/snapcompact`.

`@oh-my-pi/snapcompact` (Added):

- Добавлена **declarative compatibility rules system** — единообразное определение identity, capabilities, политик и подповедения моделей по классам, семействам и ревизиям.
- Добавлен **compat-compiler CLI** для управления правилами identity и capabilities через **KDL-конфигурацию**.
- Стандартизирована обработка ревизий моделей и резолв совместимости между discovery и runtime.

В `@oh-my-pi/pi-catalog` это дало более надёжное распознавание семейств, ревизий, reasoning-вариантов и провайдер-специфичных capabilities через структурированные model identities, а также фиксы вроде корректной детекции vendor-prefixed GLM на Mistral и Cerebras (восстановлен нужный токенизатор и reasoning-history) и исправленной классификации параметризованных id (Qwen, Fireworks Kimi, Cursor-wrapped Grok).

## Новые провайдеры и модели в каталоге

`@oh-my-pi/pi-catalog` (Added):

- Провайдеры: **GitLab Duo**, **Llama.cpp**, **LM Studio**, **Minimax**.
- Модели: **Qwen 3.8 27B**, **Granite 4.2 8B**, **Abliterated-варианты**, **GLM 5.3**, **Qwen 3.8 Flash Next**.
- Метаданные совместимости для `context management` и reasoning-summaries на поддерживаемых endpoint'ах.

Changed / Fixed в каталоге:

- Обновлены цены под актуальные ставки провайдеров; стандартизированы display-имена; добавлена поддержка per-tier и long-context pricing, а также expanded метадата (limits, API routes, input modalities, provider-specific aliases).
- Исправлен костинг **Codex Daybreak**-алиасов (включая worker-варианты), reasoning-effort-вариантов локальных Ollama-моделей и DeepSeek V4, prompt-cache для Bedrock Nova.
- Исправлена обработка reasoning-effort у **Kimi K3** на OpenAI-совместимых хостах (LiteLLM, vLLM).
- Удалён obsolete-слайс провайдера OpenCode, показывавший недоступные модели Zen.

## Фиксы Codex/Responses-воспроизведения и работы с инструментами

Целая группа фиксов в `@oh-my-pi/pi-ai` посвящена стабильности истории OpenAI Responses:

- Исправлено открытое **remote-compaction replay** для сохранённых сессий: ходы с ранее сохранёнными compaction-элементами снова корректно возобновляются.
- Исправлена потеря tool results, когда составные id вызовов (composite call identifiers) не спаривались с соответствующим assistant call — для OpenAI Codex/Responses теперь спаривание идёт по `call_`-компоненту.
- Исправлено залипание нативного OpenAI Responses replay на битых или обрезанных аргументах `function_call`: невалидные элементы истории теперь отбрасываются, и сессия может продолжиться.
- Исправлены запросы **Cursor Fable**, падавшие, когда рекламируемые инструменты использовали JSON Schema composition keywords.

## Client: Agent Hub Activity, /usage dashboard, /trace и TUI-фиксы

`@oh-my-pi/pi-coding-agent` (Added / Changed):

- Новый **Activity view в Agent Hub**: ищемая и фильтруемая временная линия по live-прогрессу и сохранённым транскриптам. `/hub` теперь точка входа live-операций, `/agents` сохраняет поведение Control Center.
- **`/trace`** — slash-команда, показывающая URL трейса сессии в stats dashboard.
- **`/usage`** переработан в fullscreen-overlay (без вывода в транскрипт): компактная сетка подписок по провайдерам (неиспользуемые свёрнуты в одну строку), GitHub-style дневная activity-heatmap из локальной статистики и классический полный отчёт в один keypress.
- **`/copy`** использует fullscreen-селектор транскрипта — можно копировать ход или углубляться во вложенный контент (code, quotes, commands, tool output).
- Навигация по транскрипту: fullscreen rewind-селектор по двойному Escape с rendered-item навигацией, прыжками по user-ходам, branching rewind и выбором веток session-tree.
- Standalone `CLAUDE.md` в директории проекта и выше теперь грузятся как контекст рядом с `AGENTS.md` (при сохранении приоритета config-директории). Теперь supported в discovery `injectV1: false` — запрос `{baseUrl}/models` без суффикса `/v1`.
- Client для extension: `icon.advisorClosed` symbol-theme токен (глаз советника закрывается после завершения обзора), а `HookUIContext.custom` теперь получает документированный аргумент `keybindings`.

Fixed в editing/tooling:

- Edit-tool операции `＋`/`－` теперь матчат анкоры лениво по whitespace (indentation, miscounting пустых строк) вместо byte-for-byte; о неточном совпадении сообщается.
- Исправлен REWRITE, состоящий только из `＋`-строк: раньше он молча заменял (удалял) совпавший текст, теперь вставляет после сохранённого MATCH.
- Улучшена навигация по транскрипту для sloppy/SPARSE no-match (низкодоверительные совпадения не дают unsafe copy-ready операций).
- Long OpenCode Go usage-limit ожидания переключают replay-safe ходы на сконфигурированный альтернативный провайдер, когда задержка превышает `retry.maxDelayMs`.

## Статистика и TUI

`@oh-my-pi/omp-stats` (Added):

- API ежедневной активности: агрегаты cost, requests и tokens.
- **Traces dashboard** для детального анализа сессий: интерактивная временная линия, искомые/фильтруемые транскрипты, сводки token/cost и агрегаты использования инструментов и таймингов.

`@oh-my-pi/pi-tui` (Fixed):

- Улучшена стабильность терминала при возобновлении image-heavy сессий: крупные перерисовки транскриптов больше не принимаются за зависший вывод и не превышают лимит вывода.
- Встроенные картинки не оставляют пустых строк в Herdr-панелях при resume/рендере в вложенных терминалах.
- Исправлен краш на reference-style Markdown-ссылках, чьи labels совпадают с встроенными именами JavaScript (теперь рендерятся как plain text); аналогично в `pi-utils` — labels вроде `constructor`/`__proto__` больше не трактуются как определения ([#10283](https://github.com/can1357/oh-my-pi/issues/10283)).
- Исправлен ввод Enter, игнорируемый на первом ходу, когда `omp` стартует с initial prompt.

`@oh-my-pi/pi-ai` (Added): появился опциональный колбэк `completeSimple`, который наблюдает каждый результат, включая результаты внутренних retry в thinking-цикле.

## Что это значит на практике

Для пользователя `omp` v18.1.0 — это прежде всего два полноценных способа подключить платные планы (Cline Pass через `CLINE_API_KEY` и Devin со своим роутером), избавиться от залипаний на истории Codex/Responses и получить заметно более аккуратный учёт стоимости и квот. Архитектурно релиз закладывает замену хрупкого name-matching на декларативные правила моделей (`snapcompact`), что в дальнейшем должно упростить добавление новых провайдеров и моделей без ручных таблиц совместимости.

> Статья написана по материалам GitHub Release [`can1357/oh-my-pi@v18.1.0`](https://github.com/can1357/oh-my-pi/releases/tag/v18.1.0) и связанных PR [#7863](https://github.com/can1357/oh-my-pi/pull/7863), [#8590](https://github.com/can1357/oh-my-pi/pull/8590). Это независимый обзор, а не перевод официального поста: официального announcement-поста у релиза нет, а release body содержит детальный changelog по всем пакетам монорепозитория.

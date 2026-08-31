---
author: Артём Нецветаев
pubDatetime: 2026-08-31T19:41:38.000Z
title: "Hermes Agent 0.21.0: Pantheon — Bot Mode, hermes peer, cron-память и MCP-командный центр"
slug: hermes-agent-v2026-8-31
featured: false
draft: false
tags:
  - release
  - hermes-agent
  - ai-agents
  - cli
  - desktop
  - mcp
  - multi-agent
description: "Технический разбор Hermes Agent 0.21.0 (v2026.8.31): встроенный Bot Mode для desktop, hermes peer для bot-to-bot переписки через шлюзы, cron с памятью и continuity=true, live-оркестрация subagent в delegate_task, MCP-командный центр, model_overrides, drive_preview и security-hardening."
---

[`Hermes Agent`](https://github.com/NousResearch/hermes-agent) выпустил минорный релиз [`v2026.8.31`](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.31), соответствующий версии `0.21.0` и названный **The Pantheon Release**. По данным GitHub Release, с `v0.20.0` в окно вошли ~5 800 коммитов, ~2 475 смёрженных PR, ~5 680 затронутых файлов, ~2 100 закрытых issues и 760+ contributors. Релиз также документирует инфраструктурные patch-tag окна `v0.20.1`–`v0.20.6` (13–27 августа), чьи заметки по rollup-политике были отложены в этот minor.

Источники: [GitHub Release](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.31), [full changelog `v2026.8.3...v2026.8.31`](https://github.com/NousResearch/hermes-agent/compare/v2026.8.3...v2026.8.31) и PR: [#87886](https://github.com/NousResearch/hermes-agent/pull/87886), [#88725](https://github.com/NousResearch/hermes-agent/pull/88725), [#91447](https://github.com/NousResearch/hermes-agent/pull/91447), [#80774](https://github.com/NousResearch/hermes-agent/pull/80774), [#81138](https://github.com/NousResearch/hermes-agent/pull/81138), [#81139](https://github.com/NousResearch/hermes-agent/pull/81139), [#85232](https://github.com/NousResearch/hermes-agent/pull/85232), [#81144](https://github.com/NousResearch/hermes-agent/pull/81144), [#85560](https://github.com/NousResearch/hermes-agent/pull/85560), [#81137](https://github.com/NousResearch/hermes-agent/pull/81137), [#90197](https://github.com/NousResearch/hermes-agent/pull/90197), [#90730](https://github.com/NousResearch/hermes-agent/pull/90730), [#87525](https://github.com/NousResearch/hermes-agent/pull/87525), [#81152](https://github.com/NousResearch/hermes-agent/pull/81152).

## Bot Mode: агенты как общество, встроено в desktop

[#87886](https://github.com/NousResearch/hermes-agent/pull/87886) делает Bot Mode bundled-плагином desktop-приложения, включённым **по умолчанию**. Бот-к-боту протокол переезжает из пользовательских `SOUL.md` в стабильную секцию system prompt, покрывающую все сессии всех профилей — включая headless `hermes -p <bot> chat` сессии, которые запускают тиммейты. Профиль агента получает имя, детерминированное avatar-лицо (с контролами randomize/lock) и место в общем roster.

Создаются Discord-style групповые чаты: несколько ботов и вы общаетесь в одной комнате, @-упоминаете любого бота из composer, даёте комнатам имена и картинки. Полная суб-категория: attributed agent-to-agent карточки сообщений ([#85855](https://github.com/NousResearch/hermes-agent/pull/85855)), sender-side delivery notices ([#85888](https://github.com/NousResearch/hermes-agent/pull/85888)), paint-first hydration для мгновенного «пробуждения» комнат ([#89510](https://github.com/NousResearch/hermes-agent/pull/89510)), редактируемые названия и картинки комнат ([#89371](https://github.com/NousResearch/hermes-agent/pull/89371)), отдельная панель Routines ([#88731](https://github.com/NousResearch/hermes-agent/pull/88731)), пересборка на дизайн-системе приложения ([#96726](https://github.com/NousResearch/hermes-agent/pull/96726)).

## `hermes peer`: bot-to-bot переписка между машинами

[#88725](https://github.com/NousResearch/hermes-agent/pull/88725) добавляет CLI-подсистему `hermes peer`, которая регистрирует другие шлюзы Hermes как peers и доставляет сообщения в каноничный **Bot Chat** удалённого агента поверх его API-сервера — без desktop в цепочке. Боты на разных шлюзах могут писать друг другу по handle, и протокол Bot Mode автоматически учит каждого агента peer roster и паттерну `hermes peer dm`:

```bash
hermes peer add   coding-gateway https://coding-host:port/api
hermes peer list
hermes peer remove coding-gateway
hermes peer dm coding-gateway research-bot "передай сводку моему coding-боту"
```

Ответы попадают в каноничный Bot Chat каждого агента, так что переписка между агентами долговечна и инспектируема, а не fire-and-forget. Подробности mesh-доставки и формат `dm` — в [PR #88725](https://github.com/NousResearch/hermes-agent/pull/88725).

## Cron, который запоминает

Раньше cron-агенты были «золотыми рыбками»: планировщик жёстко зашивал `skip_memory=True` и запрет memory-toolset, и даже per-job `enabled_toolsets: ["memory"]` молча игнорировался. [#91447](https://github.com/NousResearch/hermes-agent/pull/91447) это чинит — теперь cron-задачи загружают и обновляют персистентную память (`MEMORY.md` / `USER.md`) как любой другой агент.

Поверх памяти — четыре новых механизма:

- **`continuity=true`** ([#80774](https://github.com/NousResearch/hermes-agent/pull/80774)): recurring job инжектит в каждый прогон собственный последний output (внутренне — как reserved `self` entry в `context_from`), чтобы скраупер дедуплицировал «что я уже сообщил» и продолжал с места остановки.
- **Per-job durable notepad** ([#81139](https://github.com/NousResearch/hermes-agent/pull/81139)): KV-скретчпад в `~/.hermes/cron/notepad.db` для курсоров/watermark/watchlist. Капы: 16 KB на значение, 128 символов на ключ, 64 KB на задачу; oversized записи падают громко.
- **Monitor-mode** ([#81138](https://github.com/NousResearch/hermes-agent/pull/81138)): дешёвый `monitor_script` (под `~/.hermes/scripts/`) или bounded-GET `monitor_url` гоняется каждый тик до сборки агент-machinery; output хэшируется по байтам — без изменений агентный запуск полностью подавляется (никакой LLM-платы), при изменении в промпт инжектится блок `MONITOR CHANGE DETECTED` с capped unified diff.
- **`deliver: bot-chat[:<profile>]`** ([#91487](https://github.com/NousResearch/hermes-agent/pull/91487)): output задачи доставляется в каноничный Bot Chat бота как real-сообщение, которое бот читает и отвечает (через ту же лану, что и agent-to-agent: `chat --in ~ -c "Bot Chat"`).

```yaml
cron:
  monitoring:
    schedule: "0 9 * * *"
    memory: true # больше не skip_memory
    continuity: true # carry-прошлого output между прогонами
    monitor_script: ~/.hermes/scripts/stock_check.py
    deliver: bot-chat # или bot-chat:backup-bot
```

## Live-оркестрация subagent в `delegate_task`

[#85232](https://github.com/NousResearch/hermes-agent/pull/85232) добавляет прямо в `delegate_task` управление бегущими детьми без новых инструментов — через параметры `action` / `subagent_id` / `message`:

- `action='list'` — показать текущих детей этой беседы;
- `action='steer'` — направлять одного по ходу выполнения (course correction без остановки);
- `action='stop'` — завершить раньше и забрать частичный результат.

Дополнительно: **optional `output_schema`** (JSON Schema) на task item и на single-goal форме ([#81144](https://github.com/NousResearch/hermes-agent/pull/81144)) — ребёнок получает блок `OUTPUT CONTRACT` в контексте, а родитель валидирует финальный ответ через `jsonschema` и при провале шлёт ровно один bounded retry turn с текстом ошибок валидации. Подняты дефолты: **250 итераций** на делегата и **10 параллельных детей**. Делегирование из «запустить и молиться» стало реально управляемой параллелью.

## MCP-командный центр

Пять PR ([#87525](https://github.com/NousResearch/hermes-agent/pull/87525) et al.) сливают MCP-серверы и каталог в одну страницу desktop: drag-in импорт «вставь что угодно», фоновые health checks, которые предлагают переавторизоваться до того, как tool call упадёт, fleet overlay со schema-token estimates и 30-дневным usage на сервер, и `hermes://` deep links, устанавливающие MCP-сервер с явным подтверждением. Управление двадцатью серверами превратилось из археологии по конфигам в dashboard.

## CLI power wave

[#90730](https://github.com/NousResearch/hermes-agent/pull/90730) делает 100+ команд discoverable: `Ctrl+P` — fuzzy command palette; старый `/help` больше не валит 69 skill-команд одной стеной (теперь одна строка `⚡ Skill Commands: 69 installed — /help skills`, плюс `/help <text>` фильтрует по подстроке). Отдельно: `/model`-пикер фильтрует по мере ввода, `/status` показывает reasoning mode, pending approvals и usage контекста, а статус-бар умеет выводить live cache-hit %, latency и tokens/sec с per-field toggles (последние — из salvaged community работы, [#90745](https://github.com/NousResearch/hermes-agent/pull/90745) et al.).

Из апрув-machinery — dry-run вердикт без выполнения команды. Команда в release названа `hermes approval-check` (PR #81137), но фактический CLI-контракт из PR — `hermes approvals test`:

```bash
$ hermes approvals test -- rm -rf /tmp/x     # exit 2 (ask-approval)
$ hermes approvals test --json -- 'r\m' -rf / # exit 3, нормализованный trace "rm -rf /"
```

Он собирает реальные runtime-оценщики из `tools/approval.py` в порядке `check_all_command_guards` (hardline floor → sudo-stdin guard → `approvals.deny` → yolo/off bypass → allowlist → dangerous patterns), ничего не исполняя и не спрашивая. И — да — Ghostty-level **terminal pets**, `#98250`. Плюс фикс `Ctrl+C`, который больше не толкает Kitty keyboard protocol и не ломает interrupts ([#87074](https://github.com/NousResearch/hermes-agent/pull/87074)).

## Агент водит браузер desktop

[#90197](https://github.com/NousResearch/hermes-agent/pull/90197) закрывает «одностороннее зеркало»: раньше `open_preview`/`read_preview` только показывали страницу агенту, а любой клик уходил в невидимый отдельный Chromium через `browser_*`-tools, где нет сессий пользователя. Теперь в toolset `desktop_ui` добавлены **`drive_preview`** и **`annotate_preview`**: `action="elements"` инвентаризирует кликабельное и набираемое, дальше `action="click"` / `"type"` / и т.д. работают прямо в видимой вкладке твоего приложения. Страницы можно выталкивать в системный браузер с полным link context menu ([#89366](https://github.com/NousResearch/hermes-agent/pull/89366)). «Залогинься и выгрузи мои счета» больше не значит работать в браузере, отличном от того, что на экране.

## Провайдеры: шесть новых + `model_overrides`

Добавлены провайдеры: Meta Model API (Muse Spark) как built-in plugin ([#88565](https://github.com/NousResearch/hermes-agent/pull/88565)), CommandCode с GOAT/Pro/Max планами (salvage [#32909]), Tencent TokenPlan ([#97917](https://github.com/NousResearch/hermes-agent/pull/97917)), Nebius Token Factory ([#97916](https://github.com/NousResearch/hermes-agent/pull/97916)), Ramp Router ([#97915](https://github.com/NousResearch/hermes-agent/pull/97915)) и Actual Computer inference (salvage [#26491]). Каталог пополнился GLM-5.3-Flash, qwen3.8-max/flash, Gemini 3.7 Flash, MiniMax M3 free и Nemotron 3.5 Lightning.

Практически важное — **`model_overrides`** ([#85560](https://github.com/NousResearch/hermes-agent/pull/85560)): можно самому пропатчить `context_window`, `max_output_tokens`, capabilities (`supports_tools` / `supports_vision` / `supports_reasoning`) или `model_family` для любого провайдера+модели, не дожидаясь релиза с актуальным models.dev:

```yaml
model_overrides:
  upstage:
    solar-pro4:
      context_window: 524288
  custom:my-local-vllm:
    my-llava-model:
      context_window: 8192
      supports_vision: true
    _default:
      model_family: openai
```

## Security hardening

- **Protected instruction files** ([#81152](https://github.com/NousResearch/hermes-agent/pull/81152)): запись в `AGENTS.md`, skills и memory-хранилища теперь всегда требует approval — prompt-inject-агент не может тихо переписать собственные standing orders.
- **Redaction sweep** ([#80965](https://github.com/NousResearch/hermes-agent/pull/80965) и др.): закрыты утечки секретов в terminal errors, `.env`-редах через file-read detection, checkpoints, process(list), ACP stderr, SSH target logging.
- **Windows approval coverage** ([#84428](https://github.com/NousResearch/hermes-agent/pull/84428)): деструктивные Windows-команды и пути типа `rmdir /s` теперь тоже триггерят approval.
- **macOS TCC identity** ([#95091](https://github.com/NousResearch/hermes-agent/pull/95091)): permission grants переживают обновления благодаря стабильному подписанному signing-identity — через `hermes desktop --setup-tcc-identity`.

Отдельно в «reverted — не в этом релизе»: **Model Council mode (`/council`)** и **DCP context engine** зашли и откатились; WS-only gateway server (merged #94245, reverted #96118) — FastAPI остаётся на desktop boot path, но seq-stamped event replay (#94219) **вышел**. Electron откачен на 40.10.2.

## Кому что смотреть первым

- **Multi-agent/команда ботов** — Bot Mode в desktop, `hermes peer dm`, `deliver: bot-chat`.
- **Scheduled-задачи** — `continuity=true`, notepad, monitor-mode, включённая `memory` у cron.
- **Параллельная работа** — `delegate_task` c `action=list/steer/stop` и `output_schema`.
- **MCP-оперирование** — командный центр, `hermes://` deep links, health checks.
- **Повседневный CLI** — `Ctrl+P`, `/model`, `/status`, `hermes approvals test`.
- **Security** — protected instruction files, TCC identity (`hermes desktop --setup-tcc-identity`).

Полный список contributors и сотен fix- и feature-PR — в [release body](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.31).

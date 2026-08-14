---
author: Артём Нецветаев
pubDatetime: 2026-08-14T12:30:00.000Z
title: "oh-my-pi 17.0.0: xd:// virtual devices, единый hub tool и конец BM25 discovery"
slug: oh-my-pi-v17-0-0
featured: false
draft: false
tags:
  - release
  - oh-my-pi
  - coding-agent
  - cli
  - mcp
  - hashline
description: "Разбор oh-my-pi v17.0.0: breaking-изменение всего tool surface — irc/job/launch слиты в hub tool, resolve заменён на xd://resolve|reject|propose, BM25 discovery удалён, все MCP-инструменты монтируются через xd://, hashline seen-line guard стал opt-in (edit.enforceSeenLines), prewalk для сабагентов."
---

[oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`) — форк терминального coding-агента [Pi](https://github.com/badlogic/pi-mono) Марио Цехнера: «coding agent with the IDE wired in», 60+ провайдеров, 31 встроенный инструмент, LSP/DAP, ~80k строк Rust-ядра. 15 июля 2026 вышел мажорный релиз [`v17.0.0`](https://github.com/can1357/oh-my-pi/releases/tag/v17.0.0), который перестраивает то, как модель видит и вызывает инструменты: появляется протокол виртуальных устройств `xd://`, три coordination-инструмента сливаются в один `hub`, а BM25-дискавери инструментов удалён целиком.

Источники: [GitHub Release v17.0.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.0.0), compare [`v16.5.2...v17.0.0`](https://github.com/can1357/oh-my-pi/compare/v16.5.2...v17.0.0), PR [#5489](https://github.com/can1357/oh-my-pi/pull/5489), [#5536](https://github.com/can1357/oh-my-pi/pull/5536), [#5540](https://github.com/can1357/oh-my-pi/pull/5540), [#5544](https://github.com/can1357/oh-my-pi/pull/5544), [#5553](https://github.com/can1357/oh-my-pi/pull/5553), [#5564](https://github.com/can1357/oh-my-pi/pull/5564), [#5569](https://github.com/can1357/oh-my-pi/pull/5569), [#5570](https://github.com/can1357/oh-my-pi/pull/5570), [#5571](https://github.com/can1357/oh-my-pi/pull/5571), [#5577](https://github.com/can1357/oh-my-pi/pull/5577), [#5583](https://github.com/can1357/oh-my-pi/pull/5583), [#5594](https://github.com/can1357/oh-my-pi/pull/5594), [#5595](https://github.com/can1357/oh-my-pi/pull/5595).

## xd:// — инструменты как виртуальные устройства

Главная новинка релиза — протокол `xd://` (настройка `tools.xdev`, по умолчанию включён). Смонтированные инструменты становятся URL-устройствами, с которыми модель работает обычными `read`/`write`:

- `read xd://` — список смонтированных инструментов;
- `read xd://<tool>` — документация по конкретному устройству;
- `write xd://<tool>` — выполнение (JSON-аргументы пишутся в path устройства).

Custom-, extension-, MCP-, RPC-host-, image-generation- и TTS-инструменты теперь по умолчанию `discoverable` и монтируются под `xd://`, а не шипят свои схемы на верхнем уровне: `generate_image`, `tts` и MCP-инструменты в дефолтных сессиях открываются именно как устройства. Единообразие презентации задаёт `loadMode` (`essential` | `discoverable`), он заменил старый opt-out `xdev?: boolean` у custom-инструментов.

Чтобы большие MCP-каталоги не раздували системный промпт, встроенная документация устройств ограничена бюджетом 48k символов (10k на устройство); что не влезло — перечисляется по имени и summary и дочитывается по требованию. Важно и то, чего **не** происходит: mid-session изменения монтирования (MCP connect/disconnect) больше не переписывают системный промпт — дельта анонсируется модели steered system-нотисом («these tools became available» / «no longer mounted»), поэтому provider prompt cache остаётся нетронутым, а доки попадут в промпт при следующем несвязанном rebuild.

## hub вместо irc + job + launch, resolve → xd://propose

Три инструмента координации — `irc` (peer messaging), `job` (background jobs), `launch` (supervised процессы) — объединены в один `hub` с `loadMode: "essential"`. Из SDK удалены `IrcTool`, `JobTool`, `LaunchTool`, `IrcDetails`, `JobToolDetails`; взамен — `HubTool`, `CoordinationDetails`, `LaunchToolDetails` и `hubToolRenderer` из `tools/hub`.

Скрытый `resolve` tool тоже удалён: staged actions теперь финализируются записью в три plain-text resolution device — `xd://resolve` (применить preview), `xd://reject` (отбросить) и `xd://propose` (отправить plan slug/title на approval). Инструмент `write` авто-включается, когда присутствует deferrable tool или включён plan mode. Заодно убран legacy `report_finding`: reviewer-агенты записывают находки инкрементальными `yield`-секциями.

## Конец BM25 discovery и ssh-агента

Система tool discovery на BM25 удалена полностью: инструмент `search_tool_bm25`, настройки `tools.discoveryMode`, `mcp.discoveryMode`, `mcp.discoveryDefaultServers`, per-tool MCP selection и сам модуль `tool-discovery`. Все подключённые MCP-инструменты теперь просто включены и смонтированы через `xd://`. Мёртвые ключи настроек вычищаются из конфигов при загрузке, а `tools.xdev` сохраняет дефолт `true`.

Удалён и `ssh` agent tool (удалённое выполнение команд); при этом `ssh://` read/write/search протокол, CLI `omp ssh` и host discovery сохраняются.

## hashline: seen-line guard стал opt-in

В `@oh-my-pi/hashline` появилась опция `enforceSeenLines` в `PatcherOptions`, а в агенте — настройка `edit.enforceSeenLines` (по умолчанию **выключена**). Когда включена, edit'ы, заякоренные на строках, которые ни один предыдущий `read`/`grep` не показывал целиком, отклоняются. Одновременно column-clipped строки (>512 символов) перестали исключаться из seen-сета снапшота — однострочные правки на длинных строках теперь проходят без full-width перечитывания.

## Prewalk для сабагентов

Добавлен per-agent prewalk: поле `prewalk` во frontmatter агента, override `task.agentPrewalk` (переключается из `/agents` dashboard) и boolean `task.prewalk` (по умолчанию выключен), который вооружает bundled generic `task`-агента.

## Исправления, на которые стоит посмотреть

- **Nested config collision**: значение вроде `dev.autoqa.consent` некорректно удовлетворяло lookup родительского ключа `dev.autoqa`, из-за чего Auto QA включался и спрашивал consent по умолчанию. Ключи переименованы в `dev.autoqaConsent` и `todo.remindersMax`, чтобы убрать коллизии префиксов в стандартном JSON/YAML.
- **Ollama streaming**: NDJSON-байты ответа теперь парсятся напрямую, без декодирования сетевых чанков в текст ([#5544](https://github.com/can1357/oh-my-pi/pull/5544)).
- **Cursor TLS**: connection resets больше не убивают процесс фатальным uncaught exception — активный ход падает или ретраится мягко ([#5594](https://github.com/can1357/oh-my-pi/pull/5594)).
- **Compiled appserver** больше не дедлочится до создания сокета при наличии user extensions ([#5571](https://github.com/can1357/oh-my-pi/pull/5571)).
- **Plan-mode re-entry**: новый plan-запрос при существующем старом артефакте больше не теряется — re-entry якорится на новом запросе ([#5577](https://github.com/can1357/oh-my-pi/pull/5577)).
- **TUI**: SIXEL-картинки с высотой, не кратной 6, больше не затираются снизу ([#5595](https://github.com/can1357/oh-my-pi/pull/5595)); probe Kitty OSC 99 не утекает сырым текстом в панель tmux/screen ([#5583](https://github.com/can1357/oh-my-pi/pull/5583)); LaTeX-рендеринг `\underbrace`/`\overbrace`/`\overset` стал рисованным, с центрированными подписями.

## Кому стоит обновиться и на что смотреть

Всем пользователям 16.x — но с чтением breaking changes: если ваши конфиги или расширения ссылаются на `irc`/`job`/`launch`/`resolve`/`search_tool_bm25`, `tools.discoveryMode`, `mcp.discoveryMode` или `SshTool`/`ResolveTool` из SDK, их нужно переписать на `hub` и `xd://` устройства. `--tools` теперь отвергает неизвестные имена usage-ошибкой вместо молчаливого сужения набора.

## Как обновиться

```sh
curl -fsSL https://omp.sh/install | sh
```

или через npm: `npm i -g @oh-my-pi/pi-coding-agent`. Установщики и детали — на [странице релиза](https://github.com/can1357/oh-my-pi/releases/tag/v17.0.0) и [omp.sh](https://omp.sh).

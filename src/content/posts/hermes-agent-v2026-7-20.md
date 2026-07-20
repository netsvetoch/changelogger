---
author: Артём Нецветаев
pubDatetime: 2026-07-20T19:33:21.000Z
title: "Hermes Agent 0.19.0: Quicksilver — быстрый первый токен, SecretSource и надёжная доставка"
slug: hermes-agent-v2026-7-20
featured: false
draft: false
tags:
  - release
  - hermes-agent
  - ai-agents
  - cli
  - desktop
  - automation
description: "Технический разбор Hermes Agent 0.19.0: сокращение TTFT до ~0,9 с, live reasoning, Bitwarden и 1Password через SecretSource, smart approvals и deny-правила, live-транскрипты subagents, ledger доставки, экспорт сессий и маршрутизация профилей."
---

[`Hermes Agent`](https://github.com/NousResearch/hermes-agent) выпустил минорный релиз [`v2026.7.20`](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.7.20), соответствующий версии `0.19.0` и названный **The Quicksilver Release**. По данным GitHub Release, в окно после `v0.18.0` вошли примерно 2 245 коммитов, 1 065 смёрженных PR, 2 465 затронутых файлов и около 3 300 закрытых issues. Релиз также включает инфраструктурные исправления из `v0.18.1` и `v0.18.2`.

Источники: [GitHub Release](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.7.20), [compare `v2026.7.1...v2026.7.20`](https://github.com/NousResearch/hermes-agent/compare/v2026.7.1...v2026.7.20) и связанные PR: [#59332](https://github.com/NousResearch/hermes-agent/pull/59332), [#59389](https://github.com/NousResearch/hermes-agent/pull/59389), [#59498](https://github.com/NousResearch/hermes-agent/pull/59498), [#62661](https://github.com/NousResearch/hermes-agent/pull/62661), [#59164](https://github.com/NousResearch/hermes-agent/pull/59164), [#67479](https://github.com/NousResearch/hermes-agent/pull/67479), [#67181](https://github.com/NousResearch/hermes-agent/pull/67181), [#64835](https://github.com/NousResearch/hermes-agent/pull/64835), [#60186](https://github.com/NousResearch/hermes-agent/pull/60186), [#62650](https://github.com/NousResearch/hermes-agent/pull/62650) и [#64458](https://github.com/NousResearch/hermes-agent/pull/64458).

## Первый запрос: cold path сокращён примерно до 0,9 секунды

Самое измеримое изменение релиза — не просто «ускорение стриминга», а сокращение пути от отправки первого prompt до первого API-запроса. В [#59332](https://github.com/NousResearch/hermes-agent/pull/59332) замеры холодного процесса с OpenRouter и заданным `DISCORD_BOT_TOKEN` дали примерно **4,3 с → 0,9 с** для CLI submit→request dispatch. Ускорение относится не только к CLI: перенос работы с критического пути действует для gateway, TUI, desktop и cron.

PR устраняет четыре конкретные блокировки:

- Discord capability detection больше не делает блокирующий HTTPS-запрос при построении tool schemas. Вместо него используются memory cache, 24-часовой disk cache `cache/discord_capabilities.json`, а затем permissive fallback с фоновым refresh. Схема фиксируется для процесса, поэтому не меняется посреди диалога и не ломает prompt cache.
- Пробник Ollama `/api/show` не запускается для известных не-Ollama `base_url`; раньше, например, лишний POST к OpenRouter заканчивался 404 и отнимал время у каждого fresh process.
- Проверка Python toolchain прогревается в отдельном потоке во время инициализации, а не синхронно в первом построении system prompt.
- MCP refresh не импортирует весь пакет `mcp`, если модуль ещё не был импортирован: проверка `sys.modules` достаточна для случая, где MCP-инструменты никогда не регистрировались.

CLI дополнительно заранее импортирует `run_agent` и `openai` в период, пока показывается idle banner и пользователь набирает запрос. Ранний submit безопасен: import lock заставит основной поток дождаться уже начатого импорта. Для Termux этот prewarm отключается через `HERMES_DEFER_AGENT_STARTUP=1`.

В [#59389](https://github.com/NousResearch/hermes-agent/pull/59389) поправили уже воспринимаемую задержку. `display.show_reasoning` по умолчанию включён для CLI и TUI: reasoning-текст показывается во время долгой фазы рассуждений, а не заменяется одним spinner. Gateway platform defaults намеренно оставлены выключенными, чтобы не заливать thinking-текстом обычные чаты. Команда `/reasoning hide` по-прежнему выключает этот показ и сохраняет настройку.

Также response box теперь force-flush-ит длинную незавершённую строку на ширине терминала. Раньше `_emit_stream_text` часто ждал `\n`, поэтому первый длинный абзац мог визуально не появляться несколько секунд. Таблицы обрабатываются отдельно, а неразбиваемые длинные последовательности получают hard wrap.

## Secrets из Bitwarden и 1Password: общий контракт, а не два особых случая

[#59498](https://github.com/NousResearch/hermes-agent/pull/59498) заменяет привязанный к Bitwarden путь в `env_loader` на общий API `SecretSource`. Это важно не только как поддержка 1Password: теперь vault providers подключаются к одному orchestrator-у с одинаковыми правилами приоритета, timeout и provenance.

Базовый контракт находится в `agent/secret_sources/base.py`. `SecretSource` — fetch-only источник: он не должен интерактивно спрашивать пользователя и не должен выбрасывать исключения наружу. Запуск внешнего CLI выполняется через `run_secret_cli()` с allowlisted child environment, argv-only вызовом, `stdin=devnull` и очисткой ANSI-последовательностей. Registry в `agent/secret_sources/registry.py` проверяет имя, scheme, версию API и форму source, а затем применяет все источники.

Есть два вида источников:

- **mapped** — явное связывание `VAR → ref`;
- **bulk** — массовая выгрузка значений из vault.

Явный mapped source выигрывает у bulk source; внутри одной формы порядок задаёт `secrets.sources`; конфликт между разными источниками логируется как warning. `override_existing` может перекрыть `.env`, но не значение, уже заявленное другим источником. Для каждого значения сохраняется источник происхождения.

1Password использует `op://`-ссылки и вызывает `op read` для каждой ссылки. Ключ кэша учитывает authentication fingerprint, но токен на диск не записывается; cache directory имеет режим `0700`, а записи — `0600`. У Hermes появились команды управления:

```text
hermes secrets onepassword setup
hermes secrets onepassword status
hermes secrets onepassword set
hermes secrets onepassword remove
hermes secrets onepassword sync
hermes secrets onepassword disable
```

В PR также упомянута загрузка `.op.env` для bootstrap и приоритет resolved value над raw `op://` reference в credential pool. Это позволяет хранить ссылку на секрет в конфигурации, не перенося сам ключ в plaintext `.env`.

## Smart approvals стали дефолтом, а запреты пользователя сильнее yolo

В [#62661](https://github.com/NousResearch/hermes-agent/pull/62661) `approvals.mode` для новых и default-конфигураций меняется с `manual` на `smart`. Режимы `manual` и `off` не удалены. Главное изменение контракта smart approval — положительный verdict относится только к **текущей команде**, а не выдаёт session-wide разрешение целому detector pattern. Две похожие flagged-команды получают две независимые LLM-проверки.

Отдельный слой контроля добавляет [#59164](https://github.com/NousResearch/hermes-agent/pull/59164): `approvals.deny` — case-insensitive glob patterns в `config.yaml`, проверяемые до `--yolo`, `/yolo`, `approvals.mode: off` и allowlist. Это не эвристика риска: совпавшая команда блокируется безусловно.

```yaml
approvals:
  deny:
    - "git push --force*"
    - "*curl*|*sh*"
```

Проверка работает по нормализованным и deobfuscated вариантам команды. Поэтому deny rule применяется и к вариантам, которые были изменены так, чтобы обойти простое строковое сравнение. Hardline blocklist остаётся более ранней защитой, а пустой `deny: []` не меняет существующее поведение.

## Subagents стали наблюдаемыми, а отправка финальных ответов — восстанавливаемой

[#67479](https://github.com/NousResearch/hermes-agent/pull/67479) добавляет live-транскрипт для каждого запуска `delegate_task`. Файл создаётся уже при dispatch в каталоге:

```text
<hermes_home>/cache/delegation/live/<delegation_id>/task-<n>.log
```

Поэтому за subagent можно наблюдать сразу, не дожидаясь итоговой сводки:

```bash
tail -f <hermes_home>/cache/delegation/live/<delegation_id>/task-1.log
```

`LiveTranscriptWriter` пишет append-only log, открывая и flush-ая файл на каждом событии. Он подключается к уже существующему `tool_progress_callback`, поэтому не требует менять agent loop или добавлять параметры `AIAgent`: лог получает thinking, tool start/complete с результатами, streamed reply deltas и lifecycle events. Ошибка самого логгера self-disable-ится и не влияет на child run. В ответах sync/background dispatch появляются `live_transcripts`, а у каждого task — `live_transcript`; retention составляет семь дней.

Пример формата из PR:

```text
04:43:27 think    | I will start by reading the failing test
04:43:27 tool     | -> terminal(pytest tests/tools/test_foo.py -x -q)
04:43:27 result   | terminal ERROR 3.4s: FAILED ... assert 5 == 4
04:43:27 final    | status=completed duration=42.7s
```

[#67181](https://github.com/NousResearch/hermes-agent/pull/67181) закрывает другой неприятный случай: агент уже сгенерировал final response, но gateway упал между попыткой платформенной отправки и подтверждением доставки. В `state.db` появилась таблица `delivery_obligations`; запись создаётся **до** первой попытки send. Состояния: `pending → attempting → delivered | failed`, а безнадёжные записи становятся `abandoned` после трёх попыток или 24 часов.

На следующем старте gateway выполняет `_redeliver_pending_obligations()` до восстановления pending sessions. Если ответ удалось восстановить, `resume_pending` очищается: агент не запускает повторно уже выполненный и оплаченный turn. Семантика честно at-least-once: при неясном падении сообщение может быть доставлено повторно и получает префикс `♻️ Recovered reply — may be a duplicate`. Ledger включён по умолчанию и отключается только через `gateway.delivery_ledger`.

## Один bot token, несколько профилей

В [#64835](https://github.com/NousResearch/hermes-agent/pull/64835) multiplexed gateway получил profile-based routing для входящих сообщений. Один bot token теперь может направлять разные Discord guild/channel/thread в изолированные профили со своими config, skills, memory, secrets и session namespace.

```yaml
gateway:
  multiplex_profiles: true
  profile_routes:
    - name: acme-server
      platform: discord
      guild_id: "1234567890"
      profile: acme
```

`profile_routes` сопоставляются most-specific-first: thread выше channel, channel выше guild; заданные условия соединяются через AND. Channel rule также применима к thread/forum post с этим `parent_chat_id`. Важно включить именно `multiplex_profiles: true`: без него routing намеренно игнорируется, чтобы не разделять session/batch keys при запуске агента в основном профиле. Невалидные profile names, в частности `../evil`, отбрасываются при разборе конфигурации.

## Reasoning как настройка конкретной модели

[#62650](https://github.com/NousResearch/hermes-agent/pull/62650) добавляет общие уровни reasoning effort `max` и `ultra` на CLI, gateway, dashboard, desktop, delegation, batch и OpenAI-совместимых маршрутах. Для GPT-5.6 API-level значение — `max`; Codex product tier `ultra` нормализуется в `max` на wire. Providers с меньшей шкалой получают совместимое ограничение верхнего уровня.

[#64458](https://github.com/NousResearch/hermes-agent/pull/64458) добавляет `agent.reasoning_overrides` для per-model policy. Разрешение централизовано в `resolve_reasoning_config(cfg, model)`, поэтому работает одинаково в CLI, gateway, TUI, cron, model switch и fallback path.

```yaml
agent:
  reasoning_effort: medium
  reasoning_overrides:
    "openrouter/anthropic/claude-opus-4.5": xhigh
    "openai/gpt-5": low
    "gemini-flash": none
```

Приоритет: session-scoped `/reasoning --session`, затем override конкретной модели, затем глобальный `agent.reasoning_effort`, затем provider default. Matcher допускает варианты точек и дефисов, а provider/aggregator prefix может отсутствовать; при этом он не должен ошибочно сопоставлять `gemini-2.0-flash` с `gemini-flash`. YAML `false` сохраняет смысл выключенного thinking, а не превращается в строку.

## Экспорт сессий стал архивным интерфейсом

В [#60186](https://github.com/NousResearch/hermes-agent/pull/60186) прежний `hermes sessions export` получил форматы `jsonl`, `md` и `qmd`, общий набор фильтров с prune/archive и opt-in `--redact`. Markdown и Quarto-экспорт генерируют YAML frontmatter, заголовки сообщений, JSON-блоки tool calls, SHA-256 footer и JSONL manifest. Compacted sessions сшиваются в один логический export, а branch children исключаются.

```bash
hermes sessions export \
  --format md \
  --session-id <session-id> \
  --redact \
  --output ./session.md
```

`--redact` прогоняет messages и segments через force-mode `agent.redact`. Форматы `md`/`qmd` не пишутся в stdout и не разрешают неотфильтрованный bulk export. Опасное удаление после архива защищено одновременно `--delete-after-verified`, `--yes`, единственным `--session-id` и проверкой hash/count после записи.

## Кому обновляться в первую очередь

Для интерактивного CLI/TUI обновление заметнее всего по первому ответу: reasoning появляется сразу, а длинный первый абзац больше не ждёт перевода строки. Владельцам секретов стоит мигрировать к `SecretSource` и `op://` вместо размножения ключей в `.env`. Операторам gateway важны две настройки: включить multiplex только там, где profile routes действительно нужны, и не отключать delivery ledger без ясной причины.

Для команд, которые запускают много delegation, новыми рабочими примитивами становятся live transcript для наблюдения и session export с фильтрами/redaction для передачи или архивирования результата. Наконец, `approvals.deny` даёт более жёсткую границу, чем yolo: запреты на необратимые команды теперь остаются запретами независимо от выбранного режима approvals.

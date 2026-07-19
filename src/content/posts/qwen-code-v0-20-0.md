---
author: Артём Нецветаев
pubDatetime: 2026-07-19T08:16:05.000Z
title: "qwen-code v0.20.0: ротация логов daemon, read-only WebShell и совместимые MCP-инструменты"
slug: qwen-code-v0-20-0
featured: false
draft: false
tags:
  - release
  - qwen-code
  - ai-agents
  - cli
  - mcp
description: "Разбор qwen-code v0.20.0: стабильный daemon.log с ротацией, воспроизведение ChatRecord в read-only WebShell, флаг --round для review, нормализация MCP-имён и ускорение ACP-запуска."
---

[`qwen-code`](https://github.com/QwenLM/qwen-code) выпустил минорную версию [`v0.20.0`](https://github.com/QwenLM/qwen-code/releases/tag/v0.20.0). В ней нет заявленных breaking changes, зато есть несколько изменений, важных для эксплуатации агентного CLI и интеграций: bounded-ротация логов `qwen serve`, независимое от активной сессии чтение истории в WebShell, более строгие границы в инструментах code review и совместимость MCP с провайдерами, которые ограничивают имена функций.

Источники: [GitHub Release](https://github.com/QwenLM/qwen-code/releases/tag/v0.20.0), [compare `v0.19.12...v0.20.0`](https://github.com/QwenLM/qwen-code/compare/v0.19.12...v0.20.0) и связанные PR [#6969](https://github.com/QwenLM/qwen-code/pull/6969), [#6999](https://github.com/QwenLM/qwen-code/pull/6999), [#7171](https://github.com/QwenLM/qwen-code/pull/7171), [#6976](https://github.com/QwenLM/qwen-code/pull/6976), [#7177](https://github.com/QwenLM/qwen-code/pull/7177), [#7175](https://github.com/QwenLM/qwen-code/pull/7175) и [#7182](https://github.com/QwenLM/qwen-code/pull/7182).

## `qwen serve`: единый `daemon.log` вместо файлов на каждый PID

PR [#6969](https://github.com/QwenLM/qwen-code/pull/6969) меняет файловую диагностику daemon-а. При обычных последовательных запусках `qwen serve` лог теперь сохраняет стабильное имя `debug/daemon/daemon.log`, а не создаёт разрозненный файл с PID на каждый старт. В каждой записи остаются отдельные неизменяемые `runId` и PID, поэтому перезапуски можно отличить внутри общего файла.

Новый предел для одного семейства логов — активный файл до 10 MiB и не более четырёх архивов. При двух daemon-процессах в одном runtime namespace один получает стабильный лог, а второй не перезаписывает его: он уходит в изолированное семейство `runs/run-<runId>/daemon.log`. Запись в файл деградирует безопасно при проблемах с файловой системой, не выключая сам сервис и stderr-логи.

Для отключения именно файловых логов по-прежнему можно задать переменную окружения:

```bash
QWEN_DAEMON_LOG_FILE=0 qwen serve
```

Важное изменение поведения: `0`, `false`, `off` и `no` запрещают доступ к файловой системе для daemon-логов, но больше не подавляют структурированные сообщения `info`, `warn` и `error` в stderr; отключённым остаётся только file-only `raw`. Внешний `logrotate` не должен менять активный `daemon.log`: ротацией теперь управляет сам процесс.

## История ChatRecord без живой сессии: read-only WebShell

PR [#6999](https://github.com/QwenLM/qwen-code/pull/6999) добавляет общий pipeline воспроизведения сохранённой истории. Он берёт активную parent-chain из `ChatRecord`, склеивает streamed-фрагменты, связывает tool call с result, финализирует незавершённые tool calls и возвращает диагностические сведения о пропусках, обрезании или неподдерживаемом содержимом.

Эта логика используется и при загрузке истории daemon-ом, и в opt-in TypeScript SDK для offline-потребителей. Поверх спроецированных transcript blocks появился публичный read-only renderer WebShell. Он показывает Markdown, thinking, tools, plans, status и timeline, но не требует daemon/session providers и не даёт composer, approval, retry, branch или callback-ов, меняющих сессию. Это подходит, например, для просмотра сохранённого JSONL в отдельном интерфейсе, не подключаясь к живому агенту.

Граница ответственности здесь намеренно разделена: host сам читает и парсит JSONL, SDK проецирует массив `ChatRecord` в transcript blocks, а WebShell только отображает полученный результат. Пагинация, выбор файла, хранение и live streaming в новую API не перенесены.

## Review CLI: раунды становятся частью вызова, а не ручной подписью

В [#7171](https://github.com/QwenLM/qwen-code/pull/7171) у `qwen review agent-prompt` появился `--round <k>` для findings-ролей `verify` и `reverse-audit`. Он встраивает номер раунда и в identity line prompt-а, и в ключ созданной записи. Например:

```bash
qwen review agent-prompt \
  --plan review-plan.json \
  --role reverse-audit \
  --findings findings.json \
  --round 2
```

Такой запуск печатает роль с меткой `(round 2)` и создаёт ключ формы `reverse-audit--round-2--<digest>`; при `--all-chunks` ключ содержит также `--chunk-<n>--round-2--`. Поэтому два раунда с одним и тем же набором findings больше не конфликтуют в одном record и не выглядят как вручную переписанный prompt.

Флаг нельзя тихо проигнорировать: допустимо только целое число от 1, и CLI откажется применять его с `--roster`, `--whole-diff`, одиночным `--chunk`, вызовом без роли или ролью, запускаемой один раз. В соседнем исправлении [#7173](https://github.com/QwenLM/qwen-code/pull/7173) `compose-review` теперь требует `--comments <file>` и считает `**[Critical]**`/`**[Suggestion]**` из реально подготовленных inline-комментариев, а не из вручную введённых чисел в state JSON. Это не даёт report-only review вывести `Approve`, когда критическое замечание уже находится в черновике inline comment.

## MCP и модели: меньше отказов у строгих провайдеров

[#6976](https://github.com/QwenLM/qwen-code/pull/6976) нормализует provider-visible имена MCP-инструментов. Имена с неподдерживаемыми символами — типичный случай: `literature.search_pubmed` принимается Gemini, но может быть отвергнуто OpenAI- или Anthropic-compatible endpoint-ом. Теперь конечное имя соответствует шаблону `^[A-Za-z][A-Za-z0-9_-]*$`, ограничено 63 символами, а при коллизии получает детерминированный короткий суффикс. Уже допустимые имена не меняются.

Нормализованное имя применяется в schema, вызове, reconnect, output и восстановленной истории. При этом старые точные правила permissions и disabled tools продолжают сопоставляться через legacy alias; wildcard-правила намеренно не расширяются. То есть интеграции с недопустимыми или слишком длинными именами должны пережить обновление, но тем, кто жёстко прописал сгенерированное имя функции, стоит обновить его.

Для локальных Gemma 4 исправление [#7177](https://github.com/QwenLM/qwen-code/pull/7177) выбирает native few-shot формат tool calling с токенами `<|tool_call>`, а не общий текстовый пример `[tool_call: ...]`. Автовыбор срабатывает на model id по `/gemma[-_]?4/i`; при необходимости его можно явно включить:

```bash
QWEN_CODE_TOOL_CALL_STYLE=gemma4 qwen
```

Это адресует ситуацию, когда Gemma 4 выводила tool call как текст и inference server не мог превратить его в JSON. Для прочих моделей общий стиль остаётся прежним.

## Быстрее ACP и channel memory

Два performance-изменения не добавляют пользовательских команд, но убирают повторную работу. [#7182](https://github.com/QwenLM/qwen-code/pull/7182) выносит Ink, React, React Reconciler и Yoga из статической import-цепочки ACP agent-а: TUI-зависимости подгружаются только при интерактивных действиях. В замере авторов на 2 vCPU/4 GiB ACP import P50 снизился с 115,06 до 52,00 мс, а process-to-first-Session — с 2046,88 до 1980,03 мс. Протокол ACP, порядок инициализации и поведение `Session` не меняются.

[#7175](https://github.com/QwenLM/qwen-code/pull/7175) кэширует подготовленный lexical recall index для channel memory, если не изменился точный target channel/chat/thread. Кэш ограничен 128 target-ами, сбрасывается после локальных `add`, `update`, `remove` и `clear`, а при изменении revision во время чтения один раз перезагружается; при нестабильном внешнем хранилище recall безопасно пропускается, а не использует непроверенный снимок. Плагины без optional revision callback продолжают работать по прежнему uncached пути.

## Другие исправления, которые стоит заметить

- В confirmation выхода из plan mode клавиша `o` открывает полный Markdown-план во временном файле через настроенный editor; просмотр не подтверждает и не отменяет действие ([#7060](https://github.com/QwenLM/qwen-code/pull/7060)).
- `qwen3.8-max-preview` добавлена во встроенные списки Token Plan в core и VS Code companion; upstream указывает контекст 1M, thinking mode и image/video input ([#7199](https://github.com/QwenLM/qwen-code/pull/7199)).
- Java SDK теперь сохраняет исходную причину в `AgentInitializeException`, а `TIMEOUT_30_MINUTES` действительно выставлен в 30, а не 60 минут ([#7189](https://github.com/QwenLM/qwen-code/pull/7189), [#7188](https://github.com/QwenLM/qwen-code/pull/7188)).
- Ошибки подключения к OpenAI-compatible API проходят всю цепочку `.cause` — до восьми уровней и с обработкой `AggregateError` — поэтому в сообщении и debug log появляется, например, `ECONNREFUSED`, а не только `fetch failed` ([#7010](https://github.com/QwenLM/qwen-code/pull/7010)).

v0.20.0 прежде всего стоит обновить тем, кто держит `qwen serve` как долгоживущий процесс, использует MCP за строгими OpenAI-/Anthropic-compatible шлюзами или строит просмотр сохранённых agent-сессий. Для обычного интерактивного CLI обновление также приносит более безопасную механику review и возможность дочитать длинный план перед подтверждением.

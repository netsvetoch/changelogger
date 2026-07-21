---
author: Артём Нецветаев
pubDatetime: 2026-07-21T19:23:05.000Z
title: "OpenAI Codex rust-v0.145.0: пагинированная история, импорт Cursor и Bedrock"
slug: openai-codex-rust-v0-145-0
featured: false
draft: false
tags:
  - release
  - codex
  - openai
  - cli
  - mcp
  - bedrock
description: "Разбор OpenAI Codex rust-v0.145.0: экспериментальная пагинированная история тредов, миграция Cursor и Claude Code через /import, управляемый Amazon Bedrock login, стабильный multi-agent V2, аудио и безопасные terminal-ссылки на визуализации."
---

OpenAI выпустила [`rust-v0.145.0`](https://github.com/openai/codex/releases/tag/rust-v0.145.0) — minor-релиз Codex с крупной переработкой хранения истории, переноса настроек внешних coding-агентов и app-server API. В релиз вошли также стабильный multi-agent V2, экспериментальная аутентификация Amazon Bedrock и терминальный путь для открытия сгенерированных визуализаций.

Ниже — разбор GitHub Release, диапазона [`rust-v0.144.0...rust-v0.145.0`](https://github.com/openai/codex/compare/rust-v0.144.0...rust-v0.145.0) и связанных PR: [`#33364`](https://github.com/openai/codex/pull/33364), [`#33426`](https://github.com/openai/codex/pull/33426), [`#31327`](https://github.com/openai/codex/pull/31327), [`#33550`](https://github.com/openai/codex/pull/33550) и [`#33925`](https://github.com/openai/codex/pull/33925).

## Экспериментальная история тредов с курсорами

PR [`#33364`](https://github.com/openai/codex/pull/33364) добавляет в app-server `historyMode: "paginated"`. В этом режиме durable-история хранится в projection-backed thread store, а клиент не обязан получать весь тред при возобновлении. Это важно для очень длинных сессий: `thread/resume` с `excludeTurns: true` возвращает метаданные и два курсора — `turnsBackwardsCursor` и `itemsBackwardsCursor`; прошлые данные затем подгружаются страницами через `thread/turns/list` и `thread/items/list`, а новые продолжают приходить как live notifications.

```json
{
  "method": "thread/start",
  "id": 1,
  "params": { "historyMode": "paginated" }
}
```

При resume нужно явно отказаться от полного массива ходов:

```json
{
  "method": "thread/resume",
  "id": 2,
  "params": { "threadId": "thr_123", "excludeTurns": true }
}
```

Курсор передают соответствующему list-методу с `sortDirection: "desc"`; первая страница включает его head row. По документации app-server, поиск `thread/searchOccurrences` теперь ищет literal, case-insensitive совпадения среди видимых пользовательских сообщений и итоговых сообщений ассистента именно в пагинированном треде — без replay rollout.

У режима есть сознательные ограничения, а не просто иной формат ответа: `thread/read` с `includeTurns: true`, `thread/rollback`, `initialTurnsPage` и detached review для пагинированного треда не поддерживаются. PR также добавляет сохранение имён тредов, историю для sub-agent и memory eligibility. Поэтому интеграциям следует включать режим только там, где UI уже умеет гидрировать историю через курсоры, а не рассчитывает на целиком заполненный `thread.turns`.

## `/import`: Cursor и Claude Code в одном потоке миграции

Codex расширяет `/import` для Cursor и Claude Code. PR [`#33426`](https://github.com/openai/codex/pull/33426) подтверждает, что для Cursor импортируются поддерживаемые settings, sandbox permissions, MCP-серверы, project instructions, hooks, agents, commands, plugins и recent chat sessions. Релиз также включает перенос project-scoped memories и миграцию plugin-команд в skills.

Для клиентов app-server различаются два поля. `source` остаётся атрибуцией продукта, который инициировал импорт, а новый `migrationSource` выбирает адаптер. Одно и то же значение необходимо передавать и в detect, и в import:

```json
{
  "method": "externalAgentConfig/detect",
  "id": 10,
  "params": {
    "includeHome": true,
    "migrationSource": "cursor"
  }
}
```

```json
{
  "method": "externalAgentConfig/import",
  "id": 11,
  "params": {
    "migrationSource": "cursor",
    "migrationItems": []
  }
}
```

`migrationItems` в реальном запросе должны быть ровно теми элементами, которые вернул detect, включая `cwd` и `details`. Import отвечает `importId` после синхронной фазы; ожидаемые ошибки миграции приходят как per-item failures в последующем `externalAgentConfig/import/completed`, а не как JSON-RPC error. Если одновременно найдены данные Claude Code и Cursor, TUI предлагает выбрать источник.

## Amazon Bedrock: управляемый login и custom transport

В app-server появился экспериментальный вариант `amazonBedrock` у `account/login/start` (PR [`#31327`](https://github.com/openai/codex/pull/31327)). Он требует initialization capability `experimentalApi`, принимает API key и AWS region, заменяет текущую primary-аутентификацию и записывает `model_provider = "amazon-bedrock"` в пользовательский config.

```json
{
  "method": "account/login/start",
  "id": 3,
  "params": {
    "type": "amazonBedrock",
    "apiKey": "…",
    "region": "us-west-2"
  }
}
```

В релиз вошли реализация login/logout, поддержка custom endpoint и authentication transport, а также смена default Bedrock model на GPT-5.6 Sol. Это именно API для host-приложений: API key сохраняется в обычном lifecycle Codex auth, а не в отдельном provider-scoped хранилище. Поэтому интеграции должны явно пометить путь как experimental и учитывать, что успешный login заменяет действующий основной способ входа.

## Multi-agent V2 стал стабильным; настройки — в `[agents]`

Релиз помечает opt-in multi-agent V2 как stable. PR [`#33550`](https://github.com/openai/codex/pull/33550) объединяет общие настройки spawned agents в секции `[agents]`: `agents.enabled`, `agents.default_subagent_model`, `agents.default_subagent_reasoning_effort` и `agents.max_concurrent_threads_per_session`.

```toml
[agents]
enabled = true
default_subagent_model = "gpt-5.6"
default_subagent_reasoning_effort = "high"
max_concurrent_threads_per_session = 4
```

`agents.max_threads` сохранён как alias, но каноническое имя — `max_concurrent_threads_per_session`; выбранный лимит применяется к обоим multi-agent backends. Важно и правило приоритета: включённый `features.multi_agent_v2` остаётся authoritative и имеет приоритет над пользовательским `agents.enabled`. Разрешённые значения из `[agents]` сохраняются в config locks и показываются в TUI debug-config; при загрузке V2 также восстанавливаются agent roles, а parent-owned sub-agent threads отображаются read-only.

## Аудио, realtime V3 и ссылки на визуализации в TUI

Codex теперь передаёт audio input в Responses API и сохраняет аудио в history и tool outputs; dynamic tools и code mode получили audio output. Для realtime V3 добавлены streaming handoff output и initial text items. Это изменения внутренних протоколов и TUI, а не новый пользовательский CLI-флаг, поэтому в релизе нет подтверждённой команды включения: доступность зависит от поддерживаемой модели и подключённого клиента.

В terminal UI появились кликабельные ссылки для inline visualizations (PR [`#33925`](https://github.com/openai/codex/pull/33925)). Ассистентская Markdown-директива имеет вид:

```md
::codex-inline-vis{file="chart.html"}
```

Codex заменяет её ссылкой для открытия в браузере при streaming, финальном рендеринге history и локальном transcript preview. Механизм не открывает произвольные `file:` URL: принимаются только HTML-файлы внутри visualization directory текущего треда, фрагмент ограничен 2 MiB, а viewer materialize-ится в sandboxed document с Content Security Policy. Некорректный или отсутствующий файл показывает явное unavailable-сообщение; незавершённая директива при streaming скрывается, а текст внутри code block и user Markdown не переписывается.

## Что ещё стало надёжнее

- При редактировании раннего prompt или повторе safety-buffered turn Codex создаёт contextual branch: исходный разговор, attachments и mention bindings остаются на месте.
- TUI сокращает redraws во время streaming, рендерит Markdown инкрементально, кеширует финальную history-разметку и ограничивает streamed command output — изменения направлены на отзывчивость длинных разговоров.
- MCP startup получил timeout, OAuth discovery больше не блокирует старт треда, refreshes сериализованы, а tool catalogs безопасно переиспользуются между сессиями; сервер может opt out из catalog caching.
- В Windows exec-server получил native sandboxing, для network proxy требуется elevated Windows sandbox, helper console windows скрыты, а hook commands корректно quoting-обрабатываются.
- Пакетный ripgrep обновлён до 15.2.0; discovery skills/plugins и remote compaction получили оптимизации startup и large-context пути.

## Итоги для обновления

Для разработчиков app-server самое значимое изменение — разделение живой сессии и durable history в `historyMode: "paginated"`: используйте `excludeTurns` и cursor APIs, но не рассчитывайте на rollback, detached review или `thread/read(includeTurns: true)`. Если вы строите миграцию IDE-агентов, передавайте одинаковый `migrationSource` в detect/import и обрабатывайте результаты по элементам после `importId`.

Пользователям multi-agent конфигураций стоит перенести лимит и defaults в `[agents]`, оставив `agents.max_threads` только как совместимый alias. Для Bedrock-интеграций новый login пока experimental и меняет primary auth; его следует подключать через app-server capability, а не воспринимать как неявную настройку обычного CLI.

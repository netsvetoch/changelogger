---
author: Артём Нецветаев
pubDatetime: 2026-06-29T08:33:46.000Z
title: "Codex 0.142.0: /usage с reset credits, indexed web search и бюджет rollout"
slug: codex-rust-v0-142-0
featured: false
draft: false
tags:
  - release
  - codex
  - openai
  - ai-agents
description: "Обзор минорного релиза OpenAI Codex rust-v0.142.0: погашение rate-limit reset credits в /usage, новые секции и рекомендации /plugins, rollout token budgets, режим indexed web search, current-time reminders и более надежные remote exec/MCP-сессии."
---

`codex` выпустил минорную версию [`rust-v0.142.0`](https://github.com/openai/codex/releases/tag/rust-v0.142.0). Это релиз про управляемость агентских сессий: лимиты и бюджеты теперь виднее пользователю, web search получил промежуточный режим между cached и live, app-server клиенты могут точнее управлять multi-agent делегированием, а remote exec и MCP-сессии стали устойчивее к коротким разрывам соединения.

Источник для обзора — GitHub Release [`openai/codex@rust-v0.142.0`](https://github.com/openai/codex/releases/tag/rust-v0.142.0) и diff [`rust-v0.141.0...rust-v0.142.0`](https://github.com/openai/codex/compare/rust-v0.141.0...rust-v0.142.0). Детали ниже проверены по связанным PR: [#28154](https://github.com/openai/codex/pull/28154), [#28793](https://github.com/openai/codex/pull/28793), [#26703](https://github.com/openai/codex/pull/26703), [#27704](https://github.com/openai/codex/pull/27704), [#28746](https://github.com/openai/codex/pull/28746), [#28494](https://github.com/openai/codex/pull/28494), [#28707](https://github.com/openai/codex/pull/28707), [#29423](https://github.com/openai/codex/pull/29423), [#28489](https://github.com/openai/codex/pull/28489), [#28822](https://github.com/openai/codex/pull/28822), [#28824](https://github.com/openai/codex/pull/28824), [#28835](https://github.com/openai/codex/pull/28835), [#29011](https://github.com/openai/codex/pull/29011), [#29324](https://github.com/openai/codex/pull/29324), [#28342](https://github.com/openai/codex/pull/28342), [#28512](https://github.com/openai/codex/pull/28512), [#28374](https://github.com/openai/codex/pull/28374), [#28546](https://github.com/openai/codex/pull/28546), [#28895](https://github.com/openai/codex/pull/28895), [#28789](https://github.com/openai/codex/pull/28789) и [#28808](https://github.com/openai/codex/pull/28808).

## `/usage` стал точкой входа для earned rate-limit resets

Команда `/usage` больше не ограничивается просмотром token activity. В [#28154](https://github.com/openai/codex/pull/28154) её превратили в меню: bare `/usage` открывает выбор между статистикой токенов и earned rate-limit resets, а старые прямые команды `/usage daily`, `/usage weekly` и `/usage cumulative` сохранены.

Для reset credits в TUI добавлены отдельные состояния:

- startup-проверка может показать подсказку вида `You have 2 rate-limit resets available. Run /usage to use one.`;
- погашение идёт через app-server API `ConsumeAccountRateLimitResetCreditParams` / `ConsumeAccountRateLimitResetCreditResponse`;
- операции reset имеют таймаут 15 секунд;
- picker можно сделать non-cancelable на шаге подтверждения, чтобы пользователь явно выбрал действие.

Практический пользовательский сценарий теперь выглядит так:

```text
/usage
# выбрать Earned rate-limit resets
# подтвердить погашение доступного reset credit
```

[#28793](https://github.com/openai/codex/pull/28793) довёл copy и состояния доступности: после успешного погашения Codex обновляет состояние доступных credits, а при временной ошибке оставляет пользователю понятный retry-путь вместо «зависшего» результата.

## `/plugins`: секции каталога и endpoint-backed рекомендации

В `/plugins` remote plugins теперь показываются не как внутренние marketplace-записи, а как продуктовые секции. [#26703](https://github.com/openai/codex/pull/26703) добавил в TUI категории `OpenAI Curated`, `Workspace` и `Shared with me`, а карточки plugin detail стали показывать source/auth metadata вместо старого ярлыка `ChatGPT Marketplace`.

Вторая часть — рекомендации плагинов прямо во время turn. Стек [#28399](https://github.com/openai/codex/pull/28399), [#28400](https://github.com/openai/codex/pull/28400), [#27704](https://github.com/openai/codex/pull/27704) и [#28403](https://github.com/openai/codex/pull/28403) добавил endpoint-backed candidates и model-visible фрагмент `<recommended_plugins>`. Перед authenticated turn Codex snapshot-ит подходящие, ещё не установленные и не отключённые плагины, ограничивает список 50 кандидатами и даёт модели инструмент `request_plugin_install` только для точного install validation из этого списка.

Фрагмент в контексте выглядит концептуально так:

```text
<recommended_plugins>
- Google Drive (google-drive@openai-curated-remote)
</recommended_plugins>
```

После установки remote-плагина [#28951](https://github.com/openai/codex/pull/28951) принудительно обновляет installed remote-plugin snapshot и `tools/list`, а `completed: true` выставляется только когда ожидаемые `app_connector_id` появились после uncached refresh. Это закрывает баг, где модель возобновляла turn с прежним catalog of tools и не видела только что установленный plugin tool.

Для авторов плагинов в релизе важны и loader-фиксы:

- [#28771](https://github.com/openai/codex/pull/28771) разрешил локальные marketplace entries с `source.path: "."` и `"./"` для repo-root layouts, оставив пустой путь и traversal-пути запрещёнными;
- [#28789](https://github.com/openai/codex/pull/28789) позволил использовать metadata-rich `marketplace.json` entry как fallback manifest, если в source directory нет `plugin.json`; fallback сохраняет поля вроде `version`, `description`, `skills`, `mcpServers`, `apps`, `hooks`, `agents`, `commands`, `strict`, `author`;
- [#28790](https://github.com/openai/codex/pull/28790) добавил поддержку массива путей в поле `skills` внутри `plugin.json`.

```json
{
  "skills": ["./skills/abc", "./skills/edk"]
}
```

## Rollout token budgets: общий бюджет для root thread и sub-agents

Новая настройка `features.rollout_budget` вводит общий weighted-token ledger для root thread и его sub-agents. Конфигурационный контракт появился в [#28746](https://github.com/openai/codex/pull/28746), учёт и reminders — в [#28494](https://github.com/openai/codex/pull/28494), остановка exhausted turns — в [#28707](https://github.com/openai/codex/pull/28707), а [#29423](https://github.com/openai/codex/pull/29423) заменил interval-настройку на явные пороги оставшегося бюджета.

Итоговая форма конфигурации:

```toml
[features.rollout_budget]
enabled = true
limit_tokens = 100000
sampling_token_weight = 1.0
prefill_token_weight = 0.1
reminder_at_remaining_tokens = [65536, 32768, 16384, 8192, 4096, 2048, 1024, 512]
```

Учёт происходит после `response.completed()`: Codex берёт usage из Responses API, применяет веса sampling/prefill tokens и списывает результат из общего ledger. Когда остаток пересекает один из настроенных порогов, перед следующим запросом в thread добавляется developer-фрагмент:

```text
<rollout_budget>
You have 32768 weighted tokens left in the shared session token budget.
</rollout_budget>
```

Если бюджет исчерпан, Codex использует существующий путь `CodexErr::TurnAborted`: текущий response может закончиться, но на ближайшей границе usage accounting этот turn и последующие turns будут abort, включая compaction и sub-agent usage. Важно, что это не жёсткий cross-thread interrupt fanout, а мягкая граница на accounting boundary.

## Multi-agent mode стал явным API

App-server клиенты теперь могут управлять делегированием не только feature flags. Сначала [#28685](https://github.com/openai/codex/pull/28685) добавил `turn/start.multiAgentMode`, затем [#28792](https://github.com/openai/codex/pull/28792) вынес выбор на уровень `thread/start`, `thread/resume`, `thread/fork` и `thread/settings/update`, а [#29324](https://github.com/openai/codex/pull/29324) упростил модель до одного live control.

Актуальный тип в TypeScript schema теперь такой:

```ts
export type MultiAgentMode = "none" | "explicitRequestOnly" | "proactive";
```

Семантика режимов:

- `none` — multi-agent tools доступны, но Codex не добавляет model-visible инструкции делегирования;
- `explicitRequestOnly` — агент должен запускать sub-agents только после явной просьбы пользователя;
- `proactive` — агент может делегировать сам, когда параллельная работа заметно улучшает скорость или качество.

Новые threads по умолчанию получают `explicitRequestOnly`; omitted mode на последующих turns сохраняет текущее значение. Ответы `thread/start`, `thread/resume`, `thread/fork` и settings responses теперь возвращают конкретный текущий `multiAgentMode`, а не `null`.

## `web_search = "indexed"`: live queries без произвольного page access

[#28489](https://github.com/openai/codex/pull/28489) добавил четвёртый режим web search рядом с `disabled`, `cached` и `live`:

```toml
web_search = "indexed"

[features]
standalone_web_search = true
```

`indexed` — это промежуточный режим: поисковые запросы остаются live, но прямой доступ к страницам ограничивается URL, которые разрешил сервер. Для hosted search Codex выставляет `external_web_access: true` вместе с `index_gated_web_access: true`. Для standalone search старые wire values сохранены (`cached` → `false`, `live` → `true`), а только новый режим отправляет строку `"indexed"`.

Тип в protocol/config schemas расширен до:

```ts
export type WebSearchMode = "disabled" | "cached" | "indexed" | "live";
```

Это полезно для окружений, где агенту нужны свежие результаты поиска, но не нужен неограниченный fetch любых страниц из модели.

## Current-time reminders и `clock.curr_time`

Релиз добавляет систематический способ сообщать Codex текущее UTC-время. [#28822](https://github.com/openai/codex/pull/28822) ввёл конфигурацию:

```toml
[features.current_time_reminder]
enabled = true
reminder_interval_model_requests = 1
clock_source = "system"
```

`clock_source` может быть `system` или `external`. В [#28824](https://github.com/openai/codex/pull/28824) появился host-injectable `TimeProvider`: системная реализация берёт UTC-время локально, а external provider позволяет app-server клиенту поставлять собственные часы. Reminder записывается в history непосредственно перед due model request и форматируется как `YYYY-MM-DD HH:MM:SS UTC`.

[#28835](https://github.com/openai/codex/pull/28835) добавил app-server request `currentTime/read`: когда включён `clock_source = "external"`, сервер может запросить у подписанного клиента время для конкретного `threadId`, ожидая ответ вида `{ "currentTimeAt": 1781717655 }` с Unix timestamp в секундах. Ошибка, отмена, timeout или malformed response останавливают turn до model request.

Наконец, [#29011](https://github.com/openai/codex/pull/29011) выставил tool `clock.curr_time`, когда включены current-time reminders. В обычном режиме tool возвращает тот же текст reminder, а в Code Mode — структурированный JSON:

```js
const result = await tools.clock__curr_time({});
// { current_time: "2026-06-29 08:33:46 UTC" }
```

## Remote exec и MCP переживают короткие разрывы соединения

Большой набор fixes делает remote environments менее хрупкими. [#28512](https://github.com/openai/codex/pull/28512) перевёл exec-server client на логическую сессию, которая может сменить underlying RPC connection generation: process handles остаются валидными, пропущенный output дочитывается через `exec/read`, а серверные процессы продолжают работать.

Для защищённых remote endpoints [#28374](https://github.com/openai/codex/pull/28374) добавил provider свежих signed WebSocket URLs: URL обновляется после disconnect, а `401 Unauthorized` на handshake получает один retry. [#28546](https://github.com/openai/codex/pull/28546) добавил отдельный backoff для Noise recovery, чтобы во время outage клиенты не били environment registry каждые 100 ms; retry schedule растёт от 500 ms до 5 s с deterministic jitter.

Отдельно [#28895](https://github.com/openai/codex/pull/28895) сделал `process/write` retry-safe для stdio MCP servers. В протокол добавлен обязательный `writeId`; клиент повторяет `Session::write` с тем же id после reconnect, а process хранит bounded cache уже принятых write ids и возвращает `Accepted` без повторной записи тех же bytes в child stdin.

```json
{
  "method": "process/write",
  "params": {
    "processId": "proc_123",
    "chunk": "...base64...",
    "writeId": "write-default-stdin"
  }
}
```

Итог для пользователя: если WebSocket рвётся в момент MCP tool call, процесс вроде `node_repl` не должен превращаться в постоянный `Transport closed` только из-за неудачной записи stdin.

## TUI после `Ctrl+Z` / `fg` и ошибки subagent больше не теряются

Linux TUI получил конкретный job-control fix в [#28342](https://github.com/openai/codex/pull/28342). До релиза suspend через `Ctrl+Z` и возврат через `fg` могли оставить composer смещённым или вставить terminal response bytes в prompt. Теперь Codex:

- сохраняет и восстанавливает keyboard reporting;
- приостанавливает terminal event polling на время suspend;
- сбрасывает buffered input перед продолжением;
- заново синхронизирует crossterm raw-mode state;
- после `fg` запрашивает реальную cursor position через tolerant parser и выравнивает inline viewport перед redraw.

Для multi-agent сценариев важен [#28375](https://github.com/openai/codex/pull/28375). Раньше terminal subagent, который исчерпал retries и выдал `Error`, мог затем получить generic `TurnComplete(None)`, из-за чего parent видел пустое успешное завершение. Теперь parent получает terminal error, ограниченный 1 000 токенами, плюс recovery hint, а failed child больше не выглядит как «завершился без ответа».

Ещё один persistence fix — [#28808](https://github.com/openai/codex/pull/28808): goal-first live threads снова попадают в `thread/list` и `thread/search`. Когда `/goal` обновляет SQLite goal state до первого user-turn rollout item, app-server теперь добавляет canonical `ThreadGoalUpdated` rollout item через `CodexThread::append_rollout_items()`, чтобы derived listing metadata оставались синхронизированы.

## Что обновлять в первую очередь

Если вы запускаете Codex как локальный TUI, самые заметные изменения — `/usage` с reset credits, более стабильный suspend/resume и исправления plugin install. Если вы интегрируете app-server, проверьте новые поля `multiAgentMode`, `currentTime/read`, `web_search = "indexed"` и `features.rollout_budget`: это уже не просто внутренние flags, а контракты, которые влияют на поведение turns, tools и model-visible context.

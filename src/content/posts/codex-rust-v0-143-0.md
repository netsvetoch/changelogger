---
author: Артём Нецветаев
pubDatetime: 2026-07-08T02:40:46.000Z
title: "Codex 0.143.0: remote plugins по умолчанию, системные proxy и новые app-server API"
slug: codex-rust-v0-143-0
featured: false
draft: false
tags:
  - release
  - codex
  - openai
  - ai-agents
description: "Обзор минорного релиза OpenAI Codex rust-v0.143.0: remote plugins стали stable и включены по умолчанию, появились npm plugin sources и версии remote-плагинов, системные proxy для Windows/macOS и Responses API, команда remote-control pair, Bedrock GPT-5.6 и новые app-server методы environment/info, ancestorThreadId и lastTurnId для fork."
---

`codex` выпустил минорную версию [`rust-v0.143.0`](https://github.com/openai/codex/releases/tag/rust-v0.143.0). Это релиз про доведение remote plugins до стандартного пути, работу в корпоративных сетях через системные proxy, новые API для внешних app-server клиентов и несколько точечных исправлений Windows, realtime и remote-control сценариев.

Источник для обзора — GitHub Release [`openai/codex@rust-v0.143.0`](https://github.com/openai/codex/releases/tag/rust-v0.143.0) и diff [`rust-v0.142.0...rust-v0.143.0`](https://github.com/openai/codex/compare/rust-v0.142.0...rust-v0.143.0). Детали ниже проверены по связанным PR: [#30297](https://github.com/openai/codex/pull/30297), [#26705](https://github.com/openai/codex/pull/26705), [#29375](https://github.com/openai/codex/pull/29375), [#30981](https://github.com/openai/codex/pull/30981), [#26708](https://github.com/openai/codex/pull/26708), [#26709](https://github.com/openai/codex/pull/26709), [#31335](https://github.com/openai/codex/pull/31335), [#29913](https://github.com/openai/codex/pull/29913), [#30285](https://github.com/openai/codex/pull/30285), [#30467](https://github.com/openai/codex/pull/30467), [#29486](https://github.com/openai/codex/pull/29486), [#29733](https://github.com/openai/codex/pull/29733), [#30291](https://github.com/openai/codex/pull/30291), [#29591](https://github.com/openai/codex/pull/29591), [#30277](https://github.com/openai/codex/pull/30277), [#29734](https://github.com/openai/codex/pull/29734), [#29624](https://github.com/openai/codex/pull/29624), [#29637](https://github.com/openai/codex/pull/29637), [#30490](https://github.com/openai/codex/pull/30490), [#31189](https://github.com/openai/codex/pull/31189), [#30098](https://github.com/openai/codex/pull/30098), [#30201](https://github.com/openai/codex/pull/30201), [#29918](https://github.com/openai/codex/pull/29918), [#30144](https://github.com/openai/codex/pull/30144), [#30770](https://github.com/openai/codex/pull/30770) и [#31056](https://github.com/openai/codex/pull/31056).

## Remote plugins теперь stable и включены по умолчанию

Главное изменение для пользователей `/plugins`: remote plugin catalog больше не выглядит как эксперимент, который надо отдельно включать. В [#30297](https://github.com/openai/codex/pull/30297) feature `remote_plugin` перевели из `Stage::UnderDevelopment` в `Stage::Stable`, а `default_enabled` поменяли с `false` на `true`. Старый override остаётся рабочим: remote plugins можно явно выключить в `config.toml`.

```toml
[features]
plugins = true
remote_plugin = false # теперь нужен только для явного отключения
```

TUI-полировка из [#26705](https://github.com/openai/codex/pull/26705) делает каталог менее похожим на список внутренних записей:

- admin-disabled plugins показываются с заблокированным префиксом `[!]`, статусом `Disabled` и без toggle-подсказки;
- admin-installed/default-installed plugins считаются установленными в счётчиках, сортировке и detail popup;
- поиск по plugin catalog теперь матчится не только по базовым row metadata, но и по descriptions/keywords;
- пустая, но успешно загруженная секция `Shared with me` скрывается, чтобы не засорять tabs.

Для авторов marketplace релиз важен ещё двумя API-деталями. [#29375](https://github.com/openai/codex/pull/29375) добавил `npm` как тип источника плагина: в schema появился `NpmPluginSource` с обязательными `type: "npm"` и `package`, а также опциональными `version`/version range и HTTPS `registry`. Codex материализует опубликованный package archive без запуска package scripts и без установки лишнего dependency tree.

```json
{
  "source": {
    "type": "npm",
    "package": "@acme/codex-plugin",
    "version": "^1.2.0",
    "registry": "https://registry.npmjs.org/"
  }
}
```

[#30981](https://github.com/openai/codex/pull/30981) расширил `PluginSummary`: теперь app-server ответы `plugin/list`, `plugin/read`, `plugin/installed` и share-list варианты могут возвращать `version` — версию, которую объявил remote marketplace backend, отдельно от `localVersion`, то есть версии локально материализованного пакета.

```ts
export type PluginSummary = {
  id: string;
  remotePluginId: string | null;
  version: string | null;
  localVersion: string | null;
};
```

## Системные proxy дошли до Windows, macOS и Responses API

В `rust-v0.142.0` у Codex уже был общий флаг `features.respect_system_proxy`; в этом релизе его довели до реальных продуктовых путей.

[#26708](https://github.com/openai/codex/pull/26708) добавил Windows resolver в `codex-client/src/outbound_proxy/windows.rs`. Он читает WinHTTP/IE proxy config через `WinHttpGetIEProxyConfigForCurrentUser`, учитывает static proxies, explicit PAC, WPAD auto-detection и bypass rules. [#26709](https://github.com/openai/codex/pull/26709) добавил macOS resolver через `SystemConfiguration` и `CFNetworkCopyProxiesForURL`; PAC URL и inline PAC JavaScript выполняются через bounded run loop с таймаутом 5 секунд.

[#31335](https://github.com/openai/codex/pull/31335) перенёс через тот же route-aware transport два HTTP endpoints Responses API. До этого флаг помогал authentication traffic, но обычные inference-запросы могли всё равно обходить системный proxy. Теперь `Config::http_client_factory()` выбирает `OutboundProxyPolicy::RespectSystemProxy`, когда `respect_system_proxy = true`.

```toml
[features]
respect_system_proxy = true
```

Ограничение важно: PR явно оставляет WebSockets, model discovery, memories, realtime и file uploads для последующих миграций. То есть в этой версии через системный proxy проходят auth-клиенты и HTTP Responses endpoints, но не весь сетевой трафик Codex.

## `codex remote-control pair`: pairing code без JSON-RPC руками

Если Codex remote control запущен как daemon, раньше не было отдельной CLI-команды, чтобы выпустить короткоживущий manual pairing code: приходилось говорить с app-server JSON-RPC напрямую. [#29913](https://github.com/openai/codex/pull/29913) добавил команду:

```bash
codex remote-control pair
# Pairing code: 123456

codex remote-control pair --json
```

Команда подключается к уже работающему daemon control socket и вызывает `remoteControl/pairing/start` с `manualCode: true`. Она намеренно не меняет lifecycle daemon: не стартует, не включает и не перезапускает remote-control сервис.

## Amazon Bedrock получил GPT-5.6 Sol/Terra/Luna и typed `max` effort

[#30285](https://github.com/openai/codex/pull/30285) расширил статический каталог Amazon Bedrock тремя моделями:

- `openai.gpt-5.6-sol`;
- `openai.gpt-5.6-terra`;
- `openai.gpt-5.6-luna`.

Все три записи наследуют metadata от bundled GPT-5.5, получают Bedrock-only reasoning effort `max` и идут в каталоге после текущих `openai.gpt-5.5` и `openai.gpt-5.4`, поэтому GPT-5.5 остаётся default.

[#30467](https://github.com/openai/codex/pull/30467) сделал `max` полноценным значением `ReasoningEffort`, а не произвольной custom-строкой. Wire value и сохранённое значение остаются `"max"`, но TUI теперь показывает `Max`, а код работает с typed enum.

```rust
pub enum ReasoningEffort {
    Low,
    Medium,
    High,
    XHigh,
    Max,
    Ultra,
    Custom(String),
}
```

Для конфигурации это означает, что `max` можно использовать как обычный advertised effort для модели, а неизвестные будущие значения всё ещё остаются в `Custom("future")`-ветке.

## MCP tools всегда уходят через tool search, где это поддержано

[#29486](https://github.com/openai/codex/pull/29486) убрал старое правило «прятать MCP tools за `tool_search` только по feature flag или когда инструментов 100+». Теперь, если model/provider поддерживают search tool и namespaced tools, Codex defers все effective MCP tools в searched-tool flow. Если search недоступен, direct exposure остаётся fallback для совместимости.

Практический эффект: маленький MCP server с двумя tool-ами больше не будет вести себя иначе, чем большой server со 100+ tool-ами. Старый конфиг-ключ `tool_search_always_defer_mcp_tools` помечен как removed compatibility flag и игнорируется.

Для ChatGPT-hosted MCP servers [#29733](https://github.com/openai/codex/pull/29733) добавил явный флаг `use_chatgpt_auth` в HTTP MCP server config. Codex применяет его только если URL сервера имеет тот же HTTP(S) origin, что и `chatgpt_base_url`; иначе capability снимается перед startup, чтобы произвольный MCP config не мог увести ChatGPT credentials на другой origin.

```toml
[mcp_servers.docs]
url = "https://chatgpt.com/mcp/docs"
use_chatgpt_auth = true
```

Если в config уже есть bearer token или authorization header, они разрешаются раньше и не заменяются session auth.

## App-server API: environment info, descendant threads и fork до конкретного turn

Релиз добавляет несколько полезных контрактов для внешних клиентов app-server.

[#30291](https://github.com/openai/codex/pull/30291) добавил experimental RPC `environment/info`. Клиент передаёт `environmentId`, а ответ получает shell metadata и default cwd как canonical `file:` URI в нотации целевой среды, а не host-local path app-server.

```ts
type EnvironmentInfoParams = {
  environmentId: string;
};

type EnvironmentInfoResponse = {
  shell: {
    name: string; // например, "zsh", "bash", "powershell", "cmd"
    path: string;
  };
  cwd: string | null; // PathUri, например file:///workspace/project
};
```

Внутри exec-server вызов `environment/info` получил отдельный таймаут 30 секунд, чтобы сервер, который инициализировался, но не отвечает на probe, не держал очередь сериализации окружения бесконечно.

[#29591](https://github.com/openai/codex/pull/29591) расширил `thread/list`: кроме `parentThreadId` для прямых детей появился `ancestorThreadId` для всех strict descendants на любой глубине. Фильтры взаимоисключающие, ancestor thread не включается в результат, а `parentThreadId` у каждого результата сохраняется, чтобы клиент мог восстановить дерево.

```json
{
  "method": "thread/list",
  "params": {
    "ancestorThreadId": "0190f2f0-..."
  }
}
```

[#30277](https://github.com/openai/codex/pull/30277) добавил `lastTurnId` в `thread/fork`. Если поле задано, fork копирует persisted history только до указанного terminal turn включительно и отбрасывает более поздние turns; `null` или отсутствие поля сохраняют старое поведение полного fork.

```json
{
  "method": "thread/fork",
  "params": {
    "threadId": "thr_123",
    "lastTurnId": "turn_456"
  }
}
```

Это заменяет часть сценариев вокруг deprecated `thread/rollback`: UI может создать новую ветку истории на стабильной границе turn, не мутируя исходный thread.

## Windows fixes: ConPTY input и sandbox credential retry

[#29734](https://github.com/openai/codex/pull/29734) вынес Windows TTY input normalization в общий `WindowsTtyInputNormalizer`, который используется local, legacy restricted и elevated runner paths. Нормализатор делает три конкретные вещи:

- `LF` превращает в один Windows Enter (`CR`), а split `CRLF` не превращает в двойной submit;
- backspace `\x08` кодирует как `DEL` (`\x7f`), который ConPTY транслирует в `VK_BACK`;
- UTF-8 и control bytes вроде Ctrl-C проходят без изменений.

```rust
let mut normalizer = WindowsTtyInputNormalizer::default();
assert_eq!(normalizer.normalize(b"first\n"), b"first\r");
assert_eq!(normalizer.normalize(b"\x08\x03"), b"\x7f\x03");
```

[#29624](https://github.com/openai/codex/pull/29624) исправил retry stale Windows sandbox credentials: теперь error 1312 распознаётся и на стадии runner logon, и на стадии child startup, а повторная попытка сохраняет исходную команду, permissions, file rules, desktop mode и managed-network identity. [#29637](https://github.com/openai/codex/pull/29637) добавил исключение для WindowsApps/AppX launch failures: если command target лежит под `WindowsApps`, Codex больше не вращает sandbox credentials зря, потому что refresh пароля не исправит AppX activation failure с тем же `ERROR_NO_SUCH_LOGON_SESSION`.

## Несколько устойчивостных исправлений для TUI, realtime, remote exec и installers

В TUI [#30490](https://github.com/openai/codex/pull/30490) закрывает stale safety-buffering prompt: модалка `Additional safety checks` остаётся видимой, пока turn активен, но `finish()` теперь вызывает `clear_safety_buffering()`, и retry-действие не может случайно поменять модель/effort для будущего turn после завершения buffered request. [#31189](https://github.com/openai/codex/pull/31189) перестал форвардить `McpStartupUpdate` и `McpStartupComplete` из delegate session в parent TUI; отменённый inline `/review` больше не оставляет parent в состоянии «Starting MCP servers», из-за которого следующий `/review` отклонялся как параллельная задача.

Remote exec recovery [#30098](https://github.com/openai/codex/pull/30098) теперь считает `409` с кодом `environment_offline` retryable внутри уже существующего 25-секундного recovery window. Остальные registry conflicts остаются terminal, а backoff/retry deadline не меняются. Remote-control [#30201](https://github.com/openai/codex/pull/30201) разделил proactive token refresh и required refresh: если ещё валидный server token есть, а `/server/refresh` вернул `429`, `5xx` или timeout, websocket/pairing операции продолжают с текущим токеном, а повторные refresh попытки throttled через общий `next_refresh_at` с `Retry-After` или jittered 24–36 секунд.

Realtime shutdown получил opt-in поле [#29918](https://github.com/openai/codex/pull/29918): `thread/realtime/start.flushTranscriptTailOnSessionEnd`. При `true` Codex забирает transcript entries после последнего handoff через `take_transcript_tail()` и маршрутизирует tail через обычный Codex handoff перед закрытием session.

```json
{
  "method": "thread/realtime/start",
  "params": {
    "threadId": "thr_123",
    "flushTranscriptTailOnSessionEnd": true
  }
}
```

[#30144](https://github.com/openai/codex/pull/30144) добавил явный `flush_rollout()` после terminal events `TurnComplete` и `TurnAborted`, чтобы thread stores с буферизацией не теряли финальный rollout event на shutdown. [#30770](https://github.com/openai/codex/pull/30770) улучшил reuse incremental WebSocket requests: при сравнении предыдущего request/response и нового request metadata теперь игнорируется, а сравнение держится на content и остальных неизменных request fields.

Наконец, standalone installers стали менее чувствительны к GitHub API rate limits. [#31056](https://github.com/openai/codex/pull/31056) убрал несколько отдельных unauthenticated REST lookups за release metadata: installer теперь один раз резолвит selected version и release metadata, а затем переиспользует этот JSON для package asset, checksum manifest и digest. Ошибка fetch metadata больше не маскируется как «asset не найден».

## Что обновлять в первую очередь

Если вы используете Codex как обычный CLI/TUI, самые заметные изменения — remote plugins без ручного `features.remote_plugin = true`, команда `codex remote-control pair`, нормализация Windows ConPTY input и более чистые TUI состояния после safety checks или отменённого review. Если вы интегрируете Codex через app-server, проверьте новые поля и методы `environment/info`, `thread/list.ancestorThreadId`, `thread/fork.lastTurnId`, `PluginSummary.version`, `McpServerConfig.use_chatgpt_auth` и `thread/realtime/start.flushTranscriptTailOnSessionEnd`: это реальные контрактные изменения, а не только внутренний рефакторинг.

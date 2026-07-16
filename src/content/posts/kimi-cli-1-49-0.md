---
author: Артём Нецветаев
pubDatetime: 2026-07-16T10:56:50.000Z
title: "kimi-cli 1.49.0: динамический бюджет контекста, точный preserved thinking и telemetry со trace_id"
slug: kimi-cli-1-49-0
featured: false
draft: false
tags:
  - release
  - kimi-cli
  - ai-agents
  - cli
description: "Разбор kimi-cli 1.49.0 и kosong 0.55.0: Kimi получает динамический max_completion_tokens, пустой reasoning_content сохраняется как ThinkPart, reasoning_effort больше не отправляется неявно, а telemetry выровнена со схемой TypeScript и дополняется trace_id."
---

[`kimi-cli`](https://github.com/MoonshotAI/kimi-cli) выпустил минорную версию [`1.49.0`](https://github.com/MoonshotAI/kimi-cli/releases/tag/1.49.0), одновременно обновив библиотеку `kosong` до `0.55.0`. Релиз состоит из пяти коммитов: три исправляют поведение Kimi и reasoning, один меняет telemetry-контракт, ещё один синхронизирует версии пакетов.

Источник разбора — GitHub Release [`MoonshotAI/kimi-cli@1.49.0`](https://github.com/MoonshotAI/kimi-cli/releases/tag/1.49.0), compare [`1.48.0...1.49.0`](https://github.com/MoonshotAI/kimi-cli/compare/1.48.0...1.49.0) и PR [#2494](https://github.com/MoonshotAI/kimi-cli/pull/2494), [#2498](https://github.com/MoonshotAI/kimi-cli/pull/2498), [#2499](https://github.com/MoonshotAI/kimi-cli/pull/2499), [#2500](https://github.com/MoonshotAI/kimi-cli/pull/2500) и [#2503](https://github.com/MoonshotAI/kimi-cli/pull/2503).

## Completion budget Kimi теперь рассчитывается от оставшегося контекста

До 1.49.0 Kimi-провайдер по умолчанию получал фиксированный лимит `max_tokens=32000`. Это не учитывало размер текущего system prompt, схем инструментов и истории: длинный запрос мог съесть значительную часть context window, оставив модели слишком большой или неподходящий бюджет завершения.

PR [#2494](https://github.com/MoonshotAI/kimi-cli/pull/2494) переносит расчёт на уровень конкретного запроса. `kimi-cli` оценивает system prompt, описания и JSON-схемы tools, роли и содержимое сообщений, tool calls и media; затем ограничивает completion-бюджет оставшимся окном контекста. В расчёт также закладывается safety margin `1024` токена, а фактическое использование контекста служит нижней границей оценки. Лимит пересчитывается перед каждым раундом, включая `/btw`, после роста истории и перед compaction.

Запрос получает request-scoped override, поэтому временный лимит не мутирует долгоживущий provider. Это важно для повторов и OAuth refresh: retry продолжает использовать тот же транспортный объект, а не случайно изменённую копию. Логика применяется только к Kimi, в том числе к Kimi, обёрнутому `ChaosChatProvider`; обычные `ChatProvider` и не-Kimi-провайдеры сохраняют прежнее поведение.

Для ручного жёсткого ограничения используется новая переменная:

```sh
export KIMI_MODEL_MAX_COMPLETION_TOKENS=4096
```

`KIMI_MODEL_MAX_TOKENS` остаётся совместимым alias, но при наличии обеих переменных приоритет у `KIMI_MODEL_MAX_COMPLETION_TOKENS`. Значение `0` или отрицательное число отключает clamping. Если переменная не задана, Kimi использует доступное после входных токенов окно, а не фиксированные 32 тысячи.

Внутри `kosong` каноническим ключом запроса стал `max_completion_tokens`; переданный старый `max_tokens` нормализуется в него. Для разработчиков, которым нужен лимит на конкретный вызов без изменения provider-level параметров, появился request-scoped интерфейс:

```py
stream = await provider.generate(
    system_prompt,
    tools,
    history,
    generation_overrides={"max_completion_tokens": 4096},
)
```

В самом developer-примере `kosong` консервативный лимит теперь задаётся явно через `.with_generation_kwargs(max_completion_tokens=8192)`, поскольку встроенный provider больше не отправляет неограниченный фиксированный cap.

## Пустой reasoning остаётся частью сообщения

PR [#2498](https://github.com/MoonshotAI/kimi-cli/pull/2498) исправляет различие между отсутствующим `reasoning_content` и его пустым значением. Раньше stream- и non-stream-конвертеры использовали truthy-проверку. Поэтому ответ с `reasoning_content: ""` не создавал `ThinkPart`, и при следующем запросе поле исчезало из истории.

Теперь проверяется наличие поля (`is not None`): пустая строка преобразуется в `ThinkPart(think="")`, а действительно отсутствующее поле по-прежнему не создаёт искусственный reasoning-part. При обратной сериализации это позволяет отправить сохранённый пустой блок:

```py
ThinkPart(think="")
# превращается в assistant message с reasoning_content: ""
```

Исправление важно для preserved-thinking бэкендов, которые требуют `reasoning_content` у каждого предыдущего assistant message. Ранее после хода без текста рассуждений такой backend мог отклонить следующий запрос с HTTP 400. Регрессии добавлены отдельно для streaming, non-streaming и отсутствующего поля.

## `thinking.type` больше не порождает неявный `reasoning_effort`

В PR [#2499](https://github.com/MoonshotAI/kimi-cli/pull/2499) `Kimi.with_thinking(...)` теперь сериализует только `extra_body.thinking.type`: `enabled` для включённого thinking и `disabled` для `off`. Переданный уровень усилия хранится как состояние provider, но автоматически не преобразуется в legacy-параметр `reasoning_effort` и не отправляется на сервер.

Это breaking change для старых Kimi-compatible endpoints, которым нужен именно legacy-параметр. Для них его следует передавать явно:

```py
provider = (
    Kimi(model="kimi-k2-turbo-preview", api_key=api_key)
    .with_thinking("high")
    .with_generation_kwargs(reasoning_effort="high")
)
```

Такой контракт не смешивает современную настройку `thinking.type` с обратной совместимостью конкретного endpoint. При этом явный `reasoning_effort` сохраняется и проходит в запрос без неявного clamping или обратного преобразования.

## Telemetry выровнена со схемой TypeScript

PR [#2500](https://github.com/MoonshotAI/kimi-cli/pull/2500) синхронизирует Python telemetry с реестром событий TS-версии `agent-core-v2`.

### `trace_id` приходит из ответа провайдера

`kosong` извлекает заголовок `x-trace-id` из streaming и non-streaming Kimi-ответов. `trace_id` проходит через `StreamedMessage`, `GenerateResult` и `StepResult`, а callback `on_trace_id` срабатывает сразу после получения response headers — до начала streaming. В `kimi-cli` значение хранится в `ContextVar` текущего turn и в root-зеркале для UI, поэтому события середины стрима видят trace текущего запроса.

`trace_id` теперь добавляется к `api_error`, событиям compaction, `turn_interrupted`, `turn_ended`, `cancel`, tool-call и permission-событиям. Ошибки API также получили конкретные поля `retryable`, `provider_type`, `protocol` и `overloaded`; HTTP 529 классифицируется как overloaded и retryable, а к retryable-статусам добавлены 408 и 409.

### Имена и поля событий получили TS-совместимую форму

Для compaction поля переименованы и дополнены:

```text
compaction_finished/failed:
source, tokens_before, tokens_after, input_tokens, output_tokens,
round, thinking_effort, compacted_count
```

`api_error` теперь использует типы провайдера и протокола, а внутренний Python-тип `api` сводится к `other`, если он не представлен в TS-схеме.

У `tool_call` появились `tool_call_id`, `cancelled` как outcome и `trace_id`. `error_type` теперь принимает TS-значения `error` или `cancelled`, а имя класса исключения вынесено в отдельное поле `error_class`. Событие `tool_call_dedup_detected` возвращено для same-step и cross-step обнаружения дублей; оно содержит `args_hash` и идентификатор вызова.

Добавлены и уточнены lifecycle-события:

- `turn_ended` отправляется безусловно в конце turn и сообщает причину `completed`, `cancelled` или `failed`;
- `permission_approval_result` фиксирует все решения approval, включая ручное подтверждение, отклонение, auto-approve и попадание в session cache;
- `turn_interrupted` получает `interrupt_reason`;
- `cancel` получает источник `streaming` или `compacting`;
- `question_answered` и `question_dismissed` получают текущий trace-контекст, а `question_answered` — поле `answered`.

`turn_id` в этот релиз намеренно не добавлялся: в Python используются uuid-hex идентификаторы, тогда как TS-версия использует монотонный числовой ID сессии.

## Версии пакетов и обновление

Релизный PR [#2503](https://github.com/MoonshotAI/kimi-cli/pull/2503) поднимает версии `kimi-cli` и wrapper `kimi-code` до `1.49.0`, а `kosong` — до `0.55.0`. В корневой зависимости закреплён `kosong[contrib]==0.55.0`, обновлены `pyproject.toml` и `uv.lock`, а release notes перемещены под версии `1.49.0` и `0.55.0`.

Обновляться стоит особенно тем, кто использует длинные контексты, preserved thinking или downstream-телеметрию. При интеграции с legacy Kimi endpoint проверьте поддержку `thinking.type`; если сервер всё ещё требует `reasoning_effort`, добавьте его явно через `with_generation_kwargs`. Потребителям telemetry следует учитывать новые имена полей compaction, enum `tool_call.error_type` и дополнительные события approval/turn lifecycle.

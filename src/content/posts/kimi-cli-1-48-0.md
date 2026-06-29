---
author: Артём Нецветаев
pubDatetime: 2026-06-29T10:56:05.000Z
title: "kimi-cli 1.48.0: защита от зацикленных tool calls и пустой reasoning_content"
slug: kimi-cli-1-48-0
featured: false
draft: false
tags:
  - release
  - kimi-cli
  - ai-agents
  - cli
description: "Разбор минорного релиза kimi-cli 1.48.0: эскалация напоминаний при повторяющихся tool calls, принудительная остановка dead-end turn на 12-м повторе, новая telemetry-схема tool_call_repeat и корректный round-trip пустого reasoning_content в kosong 0.54.0."
---

[`kimi-cli`](https://github.com/MoonshotAI/kimi-cli) выпустил минорный релиз [`1.48.0`](https://github.com/MoonshotAI/kimi-cli/releases/tag/1.48.0). В release notes всего три пункта, но два из них меняют важные runtime-контракты агентного CLI: `kimi-cli` теперь агрессивнее выводит модель из повторяющихся вызовов одного и того же инструмента, а библиотека `kosong` больше не теряет пустой `reasoning_content` при конвертации истории сообщений.

Источник для разбора — GitHub Release [`MoonshotAI/kimi-cli@1.48.0`](https://github.com/MoonshotAI/kimi-cli/releases/tag/1.48.0), compare [`1.47.0...1.48.0`](https://github.com/MoonshotAI/kimi-cli/compare/1.47.0...1.48.0) и связанные PR: [#2446](https://github.com/MoonshotAI/kimi-cli/pull/2446), [#2466](https://github.com/MoonshotAI/kimi-cli/pull/2466) и [#2467](https://github.com/MoonshotAI/kimi-cli/pull/2467).

## Повторяющиеся tool calls теперь получают напоминание на каждом проблемном шаге

Главная пользовательская часть релиза пришла из PR [#2466](https://github.com/MoonshotAI/kimi-cli/pull/2466). До этого dedup-логика `KimiToolset` добавляла подсказку модели только на отдельных значениях streak: ровно на 3, 5 и 8 повторе. Между ними — например, на 4, 6, 7, 9, 10 и 11 повторе — модель могла продолжать тот же dead-end без нового системного сигнала.

В `src/kimi_cli/soul/toolset.py` добавлена функция `_build_repeat_reminder(streak, tool_name, canonical_args)`, которая возвращает действие и текст напоминания. Пороговые значения теперь зафиксированы явно:

```py
_REPEAT_REMINDER_1_START = 3
_REPEAT_REMINDER_2_START = 5
_REPEAT_REMINDER_3_START = 8
_REPEAT_FORCE_STOP_STREAK = 12

type RepeatAction = Literal["none", "r1", "r2", "r3", "stop"]
```

Новая шкала такая:

- streak 1–2: `action="none"`, напоминание не добавляется;
- streak 3–4: `action="r1"`, базовый `<system-reminder>` о повторении того же tool call;
- streak 5–7: `action="r2"`, более подробное напоминание с `tool`, `repeated_times` и нормализованными `arguments`;
- streak 8–11: `action="r3"`, dead-end reminder с требованием прекратить вызовы инструментов в следующем ответе;
- streak 12 и дальше: `action="stop"`, тот же dead-end reminder плюс флаг принудительной остановки текущего turn.

Практический эффект: если агент застрял на одном и том же вызове с теми же аргументами, между «первым предупреждением» и hard stop больше нет тихих шагов. Модель получает системный сигнал на каждом повторе начиная с третьего.

## На 12-м одинаковом вызове turn останавливается с `tool_call_repeat`

В том же PR `KimiToolset` получил новое свойство `force_stop_turn`. Оно сбрасывается в `begin_step(previous_calls)` и выставляется, когда `_build_repeat_reminder()` возвращает `action="stop"` — то есть при streak `>= 12`.

Дальше `src/kimi_cli/soul/kimisoul.py` проверяет этот флаг после выполнения шага. В тип `StepStopReason` добавлен новый вариант:

```py
type StepStopReason = Literal[
    "no_tool_calls",
    "tool_rejected",
    "tool_call_repeat",
]
```

А при force stop `KimiSoul` отправляет telemetry-событие и завершает turn:

```py
track("turn_force_stopped", reason="tool_call_repeat", step_no=self._current_step_no)
return StepOutcome(stop_reason="tool_call_repeat", assistant_message=result.message)
```

Это не просто cosmetic stop reason. До релиза stuck-модель могла крутиться до общего лимита `max_steps_per_turn`. В 1.48.0 конкретный dead-end — один и тот же tool call с теми же аргументами — получает свой ранний предохранитель на 12-м повторе. Для CLI-пользователя это означает меньше бесполезных итераций и более понятную причину остановки: агент упёрся в повтор инструмента, а не просто «исчерпал шаги».

Новый сценарий покрыт тестом `tests/core/test_kimisoul_repeat.py`: fake chat provider каждый раз возвращает `ToolCall(name="ToolA", arguments='{"value":"x"}')`, после чего проверяется, что `soul._turn(...)` завершается с `outcome.stop_reason == "tool_call_repeat"` и `outcome.step_count == 12`.

## Telemetry для повторов стала ближе к kimi-code

PR [#2466](https://github.com/MoonshotAI/kimi-cli/pull/2466) также меняет формат событий. Из same-step dedup path убран старый `tool_call_dedup_detected` с `session_id`, `turn_id`, `step_no`, `dup_type` и hash аргументов. Для cross-step повторов теперь отправляется событие:

```py
track(
    "tool_call_repeat",
    tool_name=tool_name,
    repeat_count=repeat_count,
    action=action,
)
```

Тест `test_tool_call_repeat_telemetry_matches_kimi_code` фиксирует ожидаемую последовательность для пяти одинаковых вызовов: `repeat_count` равен `[2, 3, 4, 5]`, а `action` — `["none", "r1", "r1", "r2"]`. Важная деталь: telemetry начинается уже со второго подряд одинакового вызова, даже если user-facing reminder появится только на третьем.

Для команд, которые анализируют поведение агента по telemetry, это даёт более прямой сигнал: теперь можно строить метрики не вокруг абстрактного dedup, а вокруг конкретного repeat streak и действия, которое runtime применил к модели.

## `kosong` сохраняет даже пустой `reasoning_content`

В PR [#2446](https://github.com/MoonshotAI/kimi-cli/pull/2446) исправлен edge case в слое `kosong`, который конвертирует внутренние сообщения в запросы к chat providers. Раньше код собирал `reasoning_content` из `ThinkPart`, но добавлял поле в outgoing message только если строка была truthy:

```py
if reasoning_content:
    dumped_message["reasoning_content"] = reasoning_content
```

Это ломало round-trip для валидного, но пустого reasoning: если в сообщении был `ThinkPart(think="")`, наличие reasoning-part терялось, потому что пустая строка в Python ложная.

В 1.48.0 конвертеры для Kimi и OpenAI legacy путей перешли на отдельный флаг `has_reasoning`:

```py
has_reasoning = False
for part in message.content:
    if isinstance(part, ThinkPart):
        has_reasoning = True
        reasoning_content += part.think

if has_reasoning:
    dumped_message["reasoning_content"] = reasoning_content
```

Изменение затронуло два файла:

- `packages/kosong/src/kosong/chat_provider/kimi.py`;
- `packages/kosong/src/kosong/contrib/chat_provider/openai_legacy.py`.

Теперь сообщение с `ThinkPart(think="")` и обычным `TextPart` уходит наружу как assistant message с явным `"reasoning_content": ""`, а сообщение без reasoning-part по-прежнему не получает лишнее поле. Регрессионные тесты добавлены в `packages/kosong/tests/api_snapshot_tests/test_kimi.py` и `packages/kosong/tests/api_snapshot_tests/test_openai_legacy.py`.

Для пользователей reasoning-моделей это важно в длинных агентных сессиях: пустой reasoning block может быть семантически отличим от полного отсутствия reasoning metadata. Релиз сохраняет эту разницу при повторной отправке истории в Kimi-compatible и OpenAI legacy-compatible провайдеры.

## Версии пакетов: `kimi-cli` 1.48.0, `kimi-code` 1.48.0 и `kosong` 0.54.0

Релизный PR [#2467](https://github.com/MoonshotAI/kimi-cli/pull/2467) синхронизирует версии в нескольких пакетах:

- корневой `pyproject.toml`: `kimi-cli` поднят с `1.47.0` до `1.48.0`;
- зависимость `kosong[contrib]` в корневом `pyproject.toml`: `0.53.0` → `0.54.0`;
- `packages/kimi-code/pyproject.toml`: wrapper `kimi-code` поднят до `1.48.0` и зависит от `kimi-cli==1.48.0`;
- `packages/kosong/pyproject.toml`: пакет `kosong` поднят до `0.54.0`;
- `uv.lock` синхронизирован под эти три версии.

В теле PR отдельно указана валидация релиза: проверки version tag для root, `packages/kimi-code` и `packages/kosong`, проверка согласованности dependency versions и `make check`. Поэтому для пользователя `pip`/`uv`-установки ключевой migration note простой: вместе с `kimi-cli==1.48.0` подтягивается `kosong[contrib]==0.54.0`, где и находится fix для пустого `reasoning_content`.

## Что учитывать при обновлении

Если вы используете `kimi-cli` как интерактивный агент, релиз стоит поставить в первую очередь ради поведения в dead-end циклах: повтор одного и того же tool call теперь быстрее превращается в явный текстовый stop, а не в долгий расход шагов. Если у вас есть собственная обработка stop reasons, добавьте вариант `tool_call_repeat` рядом с существующими `no_tool_calls` и `tool_rejected`.

Если вы интегрируетесь ниже уровня CLI через `kosong`, проверьте код, который различает пустой `reasoning_content` и отсутствие поля. После 0.54.0 пустой `ThinkPart` намеренно сериализуется как `"reasoning_content": ""`; это исправление, а не случайный шум в payload.

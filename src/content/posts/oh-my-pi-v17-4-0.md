---
author: Артём Нецветаев
pubDatetime: 2026-08-22T21:07:32.000Z
title: "oh-my-pi 17.4.0: model-scoped Tokenizer вместо глобальных countTokens, /cleanse и extended context"
slug: oh-my-pi-v17-4-0
featured: false
draft: false
tags:
  - release
  - oh-my-pi
  - coding-agent
  - tokenizer
  - context-management
description: "Разбор oh-my-pi v17.4.0: breaking-рефакторинг подсчёта токенов (глобальные countTokens/setTokenizerModel/estimateTokens заменены на immutable-экземпляр Tokenizer у агента), нативные offline-токенизаторы для Claude/Qwen/DeepSeek/Kimi/GLM, новые команды /cleanse и omp ps, extended context для премиум long-context моделей и speculative compaction."
---

[oh-my-pi](https://github.com/can1357/oh-my-pi) выпустил минорный релиз [`v17.4.0`](https://github.com/can1357/oh-my-pi/releases/tag/v17.4.0) (20 августа 2026). Центральная тема — **модель-скоупнутый подсчёт токенов**: вместо глобальных функций теперь immutable-экземпляр `Tokenizer`, который знает родную кодировку активной модели. Вокруг этого собрана серия фич управления контекстом и новая диагностика вроде `/cleanse`.

Источники: [GitHub Release v17.4.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.4.0), compare [`v17.3.8...v17.4.0`](https://github.com/can1357/oh-my-pi/compare/v17.3.8...v17.4.0), issue [#1207](https://github.com/can1357/oh-my-pi/issues/1207), [#8957](https://github.com/can1357/oh-my-pi/issues/8957).

## Breaking: Tokenizer вместо глобальных countTokens

Глобальные функции подсчёта токенов — `countTokens`, `countTokensConservatively`, `setTokenizerModel` и `estimateTokens` — **удалены**. Вместо них у агента появилось объединяющее свойство `agent.tokenizer` — модельно-скоупнутый, immutable экземпляр `Tokenizer`, который строится из разрешённой каталогом модели.

Замена вызовов:

```ts
// было (глобально, ~один токенизатор на процесс)
countTokens(text);
setTokenizerModel("claude-3-7-sonnet");
estimateTokens(message);

// стало — методы на экземпляре агента
agent.tokenizer.countTokens(text, mode?);
agent.tokenizer.countMessage(message);
agent.tokenizer.countMessages(messages);
```

Это breaking-изменение затрагивает и функции управления контекстом: `findCutPoint`, `prepareBranchEntries`, `collectShakeRegions`, `pruneToolOutputs`, `pruneSupersededToolResults` и `trimRemoteCompactionInputToContextWindow` теперь требуют явный экземпляр `Tokenizer`.

## Новое в Tokenizer

- **`Tokenizer.checkTokenBudget(text, budget)`** — быстрая проверка, помещается ли текст в лимит токенов: сначала дешёвые байтовые границы, и только при сомнении — полная токенизация.
- **Provider-anchored оценка токенов транскрипта** — `findTranscriptUsageAnchor`, `isTranscriptUsageAnchor`, `estimateTranscriptTokens`: количество токенов считается инкрементально от последнего reported usage последнего хода ассистента, а не сквозным пересчётом.
- **`remotePreserveReusable()`** — проверяет, остаётся ли предыдущий payload remote-компакции переиспользуемым с активной моделью.
- **`createCompactionSummaryMessage`** теперь принимает объект опций после `(summary, tokensBefore, timestamp)`, а `CompactionSummaryMessage` получил опциональные метаданные `method` и `tokensAfter` для отображения.

## Нативные offline-токенизаторы

Поддержка точного embedded-подсчёта токенов расширена на много моделей: **Claude, Qwen 3.5+, DeepSeek V3/V4/R1, Kimi K2/K3 и GLM-5+**. В `@oh-my-pi/pi-natives` добавлен оффлайн `countTokens` для семейств `ClaudeV3`, `ClaudeV47`, `ClaudeV5` через высокопроизводительный native-порт `ctok`, плюс точный оффлайн-подсчёт для Qwen (3.5+, 3.6+, 3.8), DeepSeek (V3, V4, R1), Kimi (K2, K3) и GLM-5 с оптимизированной передачей строк без аллокаций.

В `@oh-my-pi/pi-catalog` модели получили опциональное поле семейства `tokenizer` (Claude, Qwen, DeepSeek, Kimi, GLM) — для bundled, discovered и custom моделей, с поддержкой явных override в конфиге модели. У агента появились свойство `tokenizer` на custom-моделях и `modelOverrides` для фиксации семейства токенизатора у proxy-моделей. Для строгих локальных серверов добавлен `qwenTemplateReasoningEffort` в `compat` (`models.yml`) — отключает reasoning-effort template-параметр Qwen 3.8+.

## Контекст и компакция

- **Extended context**: настройка `extendedContext` и команда `/extended-context` позволяют выбирать, использовать ли премиум long-context цену (тиры 272K/1M на Codex-класс моделях) или компактнее раньше и оставаться на стандартном прайсинге.
- **Speculative compaction**: с `compaction.asyncEnabled` все режимы компакции работают параллельно, пока сессия продолжается, а результат вплетается мгновенно.
- **`/handoff`** (и автоматический handoff-compaction) компактится **на месте** — заменяет контекст сессии, а не форкает новую.
- **Приоритеты методов**: `compaction.methodOrder` — упорядоченный список предпочтений (например `[remote, snap]`: remote там, где провайдер поддерживает, — OpenAI, и snap везде), заменяет `compaction.strategy`/`compaction.remoteEnabled`.
- **Divider компакции** теперь называет сработавший метод (`remote-compacted`, `soft-compacted`, `handed-off`, `snap-compacted`) и показывает размер «до → после» (например `256K→20K`).
- В `omp-stats` окна токенов учитывают broker-reported fleet token burn при настроенном auth-брокере, а окна подписки группируются по provider limit ID (раньше distinct лимиты с одинаковой меткой могла сливаться, завышая window-equivalents).

## Новые команды

- **`/cleanse`** (и `omp cleanse`) — запускает checker/repair loop прямо в сессии с живой доской состояния: какие чекеры и repair-субагенты бегут, какие токены/стоимость потрачены.
- **`omp ps`** — интерактивный монитор фоновых процессов под надзором демона.

## Интерфейс и TUI

- **Composer layouts**: `composer.shape` выбирает рамку редактора (rounded box, Claude Code rules, upstream-pi rules, borderless) с live-preview во `/settings` и в setup-wizard; в TUI добавлены стили `box`/`claude`/`pi`/`borderless` через `ComposerStyle`/`getComposerStyle`.
- **Context line**: `statusLine.contextLine` — gauge (`percentage`, `annotated`, `embedded`) с использованием контекста и границами компакции.
- Ввод в любом месте `/models` UI теперь сразу фокусирует список моделей (поиск и стрелки); revamped todo HUD — прогресс вдоль spine-коннектора дерева; unified инлайновые overlays/selectors в один rounded-box стиль; риск-бейджи на строках `/settings` (начиная с External Thinking); click-to-toggle и drag-to-reorder для editors списков, токены тем `icon.subscription`/`icon.advisor` (Nerd Font, Unicode, ASCII).

## Исправления

- **DeepSeek на Fireworks терял reasoning при предложении tools** ([#1207](https://github.com/can1357/oh-my-pi/issues/1207)): избыточный `tool_choice: "auto"` теперь опускается, чтобы провайдер держал thinking; forced и `"none"` селекторы по-прежнему приоритетны.
- **Tool-argument repair** больше не применяет потерь (stringify объектов, вырезание нераспознанных ключей) при валидации union-схем (`anyOf`/`oneOf`) — это ломало tool call и payload'ы субагентов (включая structured результаты `yield` субагентов).
- **400 на локальных OpenAI-совместимых серверах**: fallback и совместимость `chat_template_kwargs.reasoning_effort` — серверы, отклоняющие этот параметр, больше не дают ошибку.
- **Хэндлинг `opencode-go/muse-spark-1.2`** ([#8957](https://github.com/can1357/oh-my-pi/issues/8957)): API-транспортные пины применяются и к live-discovery, с авто-определением response-маршрутов для gateway-first OpenCode-моделей.
- **Hashline**: fallback для вставок, анкорящихся на opening-линию конструкции, кладёт shallower sibling после enclosing-блока, а не разрывает opener с телом; одно-строчные замены с атрибутами/декораторами (`#[napi]`, `@Injectable()`) больше не дублируются; ёмкость snapshot-store увеличена с 30 до 256 записей, чтобы старые теги не выпадали в широких сессиях.
- **`/models`** держит `auto`-thinking на не-дефолтных ролях вроде `task`, а не меняет активную модель и не показывает роль как `max`; `top` принимает однотире-флаги macOS (`-pid`, `-stats`); GNU/BSD compat-свип по встроенным shell-утилитам; shell-вывод минимизатор больше не теряет детали падений non-TTY `bun test`.
- Метаданные моделей (`context_length`, `max_output_tokens`, `input_modalities` и др.) теперь попадают в ответы листинга моделей auth-шлюза.

## Кому стоит обновиться

Всем, кто использует токенизацию через глобальные функции (нужна миграция на `agent.tokenizer`), пользователям DeepSeek с субагентами, и тем, кто хочет управлять long-context тарификацией на Codex-класс моделях через `extendedContext`/`compaction.methodOrder`.

## Как обновиться

```sh
curl -fsSL https://omp.sh/install | sh
```

или `npm i -g @oh-my-pi/pi-coding-agent`. Полный changelog — в [GitHub Release v17.4.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.4.0).

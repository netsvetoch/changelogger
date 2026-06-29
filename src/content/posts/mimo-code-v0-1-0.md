---
author: Артём Нецветаев
pubDatetime: 2026-06-29T11:28:39.000Z
title: "MiMo Code v0.1.0: open-source AI coding agent с памятью между сессиями"
slug: mimo-code-v0-1-0
featured: false
draft: false
tags:
  - release
  - mimo-code
  - ai-agents
  - cli
description: "Разбор первого open-source релиза MiMo Code v0.1.0: пакет @mimo-ai/cli и бинарь mimo, MiMo Auto и OAuth-провайдер Xiaomi, режимы build/plan/compose, SQLite FTS5 память, checkpoint-реконструкция контекста, /goal, /dream, /distill и голосовой ввод."
---

[`mimo-code`](https://github.com/XiaomiMiMo/MiMo-Code) выпустил первый open-source релиз [`v0.1.0`](https://github.com/XiaomiMiMo/MiMo-Code/releases/tag/v0.1.0). GitHub Release короткий — «Initial open-source release of MiMo Code», поэтому основной источник деталей здесь — код и README тега `v0.1.0`: `README.md`, `packages/opencode/package.json`, установочный скрипт `install`, конфигурационная схема, memory/checkpoint-модули и TUI-компоненты.

Это не библиотечный минор с диффом относительно предыдущей версии: публичная история начинается с `v0.1.0`. Поэтому ниже — не «что изменилось с прошлого релиза», а что именно Xiaomi открыла в первом теге и какие пользовательские контракты уже зафиксированы в репозитории.

## Установка: пакет `@mimo-ai/cli`, бинарь `mimo` и one-line installer

README фиксирует два поддержанных способа установки:

```bash
curl -fsSL https://mimo.xiaomi.com/install | bash
npm install -g @mimo-ai/cli
```

В `packages/opencode/package.json` опубликованный CLI-пакет называется `@mimo-ai/cli`, имеет версию `0.1.0`, а executable прописан как:

```json
{
  "name": "@mimo-ai/cli",
  "version": "0.1.0",
  "bin": {
    "mimo": "./bin/mimo"
  }
}
```

Установочный скрипт `install` кладёт бинарь в `~/.mimocode/bin` и принимает параметры, которые полезны для воспроизводимых установок и CI-образов:

```bash
curl -fsSL https://mimo.xiaomi.com/install | bash -s -- --version 0.1.0
./install --binary /path/to/mimo
./install --no-modify-path
```

По платформам скрипт явно допускает `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64` и `windows-x64`; для Linux архив выбирается как `.tar.gz`, для остальных поддержанных платформ — `.zip`.

## Старт без ключей: MiMo Auto, OAuth Xiaomi и импорт из Claude Code

В README главный onboarding-сценарий описан так: MiMo Auto встроен как «free for a limited time» канал, поэтому первый запуск может работать без ручной настройки API-ключей. Тот же блок перечисляет четыре варианта конфигурации:

- **MiMo Auto** — анонимный канал без конфигурации;
- **Xiaomi MiMo Platform** — вход через OAuth;
- **Import from Claude Code** — перенос существующей Anthropic-настройки;
- **Custom Provider** — OpenAI-compatible API через TUI.

Код TUI подтверждает эти ветки. В `dialog-mimo-login.tsx` пункт `mimo-free` ищет провайдера `mimo` и модель `mimo-auto`, после чего делает её текущей:

```ts
const mimo = sync.data.provider.find(p => p.id === "mimo");
if (!mimo || !("mimo-auto" in mimo.models)) return;
local.model.set({ providerID: "mimo", modelID: "mimo-auto" }, { recent: true });
```

Для Xiaomi OAuth отдельный plugin `packages/opencode/src/plugin/mimo.ts` добавляет провайдера `xiaomi` с API по умолчанию `https://api.xiaomimimo.com/v1`. Авторизация строит локальный callback server, генерирует X25519 key pair и открывает URL вида `https://platform.xiaomimimo.com/authorize?...`; после callback расшифрованные данные сохраняются как API-auth для провайдера `xiaomi`.

Импорт из Claude Code тоже не декларативный пункт README, а реализованный path в TUI: код читает `~/.claude/settings.json`, `settings.local.json` или `settings_local.json`, ищет `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_DEFAULT_OPUS_MODEL` / `ANTHROPIC_DEFAULT_SONNET_MODEL`, затем настраивает провайдера `anthropic` и пытается выбрать найденную модель.

## Три основных агента: `build`, `plan`, `compose`

В README MiMo Code описан как terminal-native coding assistant, который умеет читать и писать код, запускать команды, управлять Git и пользоваться persistent memory. Пользовательский интерфейс стартует с трёх основных агентов:

| Агент     | Что делает                                                   |
| --------- | ------------------------------------------------------------ |
| `build`   | основной режим разработки с полными tool permissions         |
| `plan`    | read-only анализ кода и проектирование решения               |
| `compose` | orchestration mode для specs-driven и skill-driven workflows |

Переключение между primary agents вынесено в UI: README говорит про `Tab`, а TUI-подсказки в `i18n/en.ts` уточняют `Tab` / `Shift+Tab` для цикла между Build, Plan и Compose.

Конфигурационная схема в `packages/opencode/src/config/config.ts` показывает, что это не только UI-лейблы. В `agent` предусмотрены primary-агенты `plan` и `build`, subagent-слоты `general` и `explore`, а также специализированные `title`, `summary`, `compaction`. Есть и `default_agent`: если он не задан или указывает на невалидный primary agent, fallback — `build`.

Для кастомных агентов схема `ConfigAgent` поддерживает отдельную модель, `temperature`, `top_p`, `steps`, `tool_allowlist`, `permission`, `mode: "subagent" | "primary" | "all"` и `hidden` для скрытия subagent из autocomplete. То есть первый релиз уже открывает не просто один CLI-режим, а конфигурируемую агентную систему.

Минимальный смысл такой конфигурации:

```json
{
  "default_agent": "build",
  "agent": {
    "plan": {
      "mode": "primary",
      "permission": { "edit": "deny", "bash": "ask" }
    },
    "build": {
      "mode": "primary",
      "steps": 50
    }
  }
}
```

## Память между сессиями: `MEMORY.md`, checkpoints и SQLite FTS5

Главная добавка MiMo Code поверх обычного «одноразового» coding CLI — cross-session memory. README перечисляет четыре файловых слоя:

- `MEMORY.md` — долговременные знания проекта, правила и архитектурные решения;
- `checkpoint.md` — структурированный snapshot состояния сессии;
- `notes.md` — временные заметки агента;
- `tasks/<id>/progress.md` — журнал прогресса по задаче.

В коде это связано с SQLite FTS5. В репозитории есть миграции `20260515010000_memory_fts`, `20260521010000_memory_fts_v6` и `20260521020000_memory_fts_triggers`, а сервис `packages/opencode/src/memory/service.ts` ищет по `memory_fts_idx` через `MATCH`, `snippet(...)` и `bm25(...)`.

Публичный tool-контракт памяти задан в `packages/opencode/src/tool/memory.ts`:

```ts
operation: "search"
query: string
scope?: "global" | "projects" | "sessions" | "cc"
scope_id?: string
type?: string
limit?: number
```

Это важно для пользователей, которые будут отлаживать, почему агент «помнит» или не помнит факт. Поиск не просто читает один markdown-файл: перед search сервис по умолчанию делает reconcile, строит token-level FTS-запрос и ранжирует результаты BM25. Порог отсечения шума настраивается через `checkpoint.memory_search_score_floor`, а lazy reconcile — через `checkpoint.memory_reconcile_on_search`.

## Checkpoint-реконструкция: контекст не просто сжимается, а собирается из нескольких источников

Модуль `packages/opencode/src/session/checkpoint.ts` показывает, что checkpointing в первом релизе устроен как отдельный writer workflow. В конфигурации есть `checkpoint.thresholds` с описанным default `["40%", "60%", "80%"]`, `checkpoint.reserved` с default `20000`, `checkpoint.max_writer_failures`, `checkpoint.fork` и `checkpoint.push_caps`.

`push_caps` задаёт бюджет на конкретные секции реконструируемого контекста: tasks ledger, focus task, actor ledger, global memory, session checkpoint, project memory, notes, design decisions и open notes. README называет это «budgeted injection» — в коде это действительно выражено как отдельные лимиты, а не как один общий truncation.

Практический эффект для длинных задач: при приближении к лимиту контекста агент может восстановить рабочее состояние из последнего `checkpoint.md`, project memory, task progress и свежего хвоста сообщений. Это снижает риск, что автономная работа после compaction забудет текущий task или важное решение пользователя.

## `/goal`: независимый judge против преждевременной остановки

Первый релиз включает отдельную stop-condition механику. README описывает команду `/goal`: пользователь задаёт условие завершения, а когда агент пытается остановиться, независимая judge-модель оценивает transcript и решает, выполнено ли условие.

Код `packages/opencode/src/session/goal.ts` подтверждает форму verdict:

```ts
{
  ok: boolean,
  impossible?: boolean,
  reason: string
}
```

Judge prompt требует отвечать только по evidence из transcript и использовать `impossible: true` только для действительно недостижимого условия. Это полезная защита именно для автономных coding loops: «я закончил» больше не равно «условие пользователя выполнено», пока отдельная проверка не нашла подтверждение в истории.

## `/dream` и `/distill`: память и reusable workflows как first-class операции

В README есть две команды самоулучшения:

- `/dream` — просматривает недавние traces, переносит устойчивые знания в project memory и удаляет устаревшее;
- `/distill` — ищет повторяющиеся ручные workflow и упаковывает уверенные кандидаты в skills, subagents или commands.

Это не просто marketing wording. В `auto-dream.ts` заданы автоматические интервалы: `DEFAULT_DREAM_INTERVAL_DAYS = 7` и `DEFAULT_DISTILL_INTERVAL_DAYS = 30`, а prompt-файлы `agent/prompt/dream.txt` и `agent/prompt/distill.txt` прямо указывают источники: memory tree и raw trajectory database `<DATA>/mimocode.db`.

Для `/dream` правила запрещают изменять SQLite-базу и требуют писать durable knowledge в project memory. Для `/distill` правила требуют сначала инвентаризировать существующие skills, custom agents, commands и plugins, чтобы расширять уже существующее, а не плодить дубликаты.

## Голосовой ввод: `/voice`, VAD и зависимости от локального recorder

README заявляет real-time streaming voice input через TenVAD и MiMo ASR, включаемый командой `/voice`. В TUI это видно по отдельным состояниям voice input: `listening`, `speaking`, `processing`, `finishing`, `idle`, а также по подсказкам «Voice input on (Chinese/English)» и режиму voice send — после паузы можно явно сказать `send it`, чтобы отправить prompt.

Низкоуровневый код `packages/opencode/src/cli/cmd/tui/util/voice.ts` показывает реальные требования к окружению:

- macOS: `sox` или `rec`;
- Linux: сначала `arecord`, затем fallback на `sox`;
- Windows: `sox`.

Audio stream приводится к raw PCM `16000 Hz`, mono, 16-bit, затем сегментируется `RealtimeVAD`. Поэтому если `/voice` не работает на Linux, первое, что стоит проверить, — наличие `arecord` или `sox`, а не модельный конфиг.

## Compose mode: встроенный workflow-оркестратор

Compose mode в README описан как structured workflow для specs-driven development. В `packages/opencode/src/session/prompt/compose.txt` он представлен отдельным системным prompt: Compose Agent координирует skills, выбирает brainstorming/debug/TDD/review/verify/merge workflow и должен маршрутизировать решения через `compose:ask`, если нужен вопрос пользователю.

В репозитории эти skills реально лежат в `packages/opencode/src/skill/compose/.bundle/`: `plan`, `execute`, `review`, `tdd`, `debug`, `verify`, `merge`, `subagent`, `worktree` и другие. Для командной работы это означает, что MiMo Code открывает не только «чат в терминале», но и opinionated lifecycle вокруг задачи: планирование, реализация, проверка и merge могут быть представлены как повторяемые skills.

## Что учитывать при пробе `v0.1.0`

`v0.1.0` — первый публичный тег, поэтому ожидать аккуратного migration guide с предыдущей open-source версии неоткуда. Зато уже можно проверить несколько конкретных контрактов:

```bash
# установка зафиксированной версии
curl -fsSL https://mimo.xiaomi.com/install | bash -s -- --version 0.1.0

# или npm-путь из README
npm install -g @mimo-ai/cli

# локальная разработка репозитория
bun install
bun run dev
bun turbo typecheck
```

Если смотреть на релиз как на платформу для агентного CLI, самые важные открытые части — не только бинарь `mimo`, а durable memory, checkpoint rebuild, `build`/`plan`/`compose` режимы, MiMo Auto onboarding, OAuth-плагин Xiaomi, `/goal` judge и self-improvement команды `/dream` / `/distill`. Именно эти контракты теперь можно инспектировать, форкать и проверять в исходниках, а не воспринимать как закрытое поведение hosted-инструмента.

---
author: Артём Нецветаев
pubDatetime: 2026-09-01T02:57:39.000Z
title: "OpenAI Codex rust-v0.152.0: Vim-поиск в композере, rate-limit-баннеры, package-style имена MCP и per-tool лимиты вывода"
slug: openai-codex-rust-v0-152-0
featured: false
draft: false
tags:
  - release
  - codex
  - openai
  - cli
  - vim
  - mcp
  - tui
description: "Разбор OpenAI Codex rust-v0.152.0: Vim-поиск / и ? в композере с подсветкой и повторной навигацией n/N (tui.keymap.vim_search), действие rate-limit-баннеров с переходами на usage/credits/plans и fallback-модель, индикация прогресса обновления credentials в TUI и codex exec, package-style имена MCP-серверов (npm:), per-tool лимит output_token_limit, настраиваемые таймауты thread/shellCommand, opt-in инструмент update_plan (tools.update_plan.enabled), плюс закрытие проблем cloud-credentials и Guardian-лимиты транскрипта."
---

OpenAI выпустила [`rust-v0.152.0`](https://github.com/openai/codex/releases/tag/rust-v0.152.0) — ещё один minor-релиз Codex, в котором композер добирается до полноценного Vim-редактирования, MCP и rate-limit-сценарии становятся управляемыми, а инструмент планирования переводится в opt-in режим.

Ниже — разбор GitHub Release и связанных PR: [`#41586`](https://github.com/openai/codex/pull/41586), [`#41921`](https://github.com/openai/codex/pull/41921), [`#41742`](https://github.com/openai/codex/pull/41742), [`#41700`](https://github.com/openai/codex/pull/41700), [`#41421`](https://github.com/openai/codex/pull/41421), [`#41384`](https://github.com/openai/codex/pull/41384), [`#41744`](https://github.com/openai/codex/pull/41744), [`#41239`](https://github.com/openai/codex/pull/41239), [`#41403`](https://github.com/openai/codex/pull/41403).

## Vim-поиск в композере и старт черновиков в Insert mode

Главная фича для тех, кто пишет в Vim-режиме. PR [`#41586`](https://github.com/openai/codex/pull/41586) добавляет локальный текстовый поиск внутри черновика:

- `/` — поиск вперёд, `?` — назад;
- повторная навигация с обходом через границы — `n` и `N`;
- поиск работает и как motion после `delete`, `change` и `yank` операторов (например, `d/foo` для удаления до совпадения);
- совпадения подсвечиваются, запрос редактируется и рендерится в футере композера отдельно от текста черновика;
- пропускаются атомарные элементы и частичные grapheme-совпадения (корректная работа с Unicode);
- биндинги конфигурируются через `tui.keymap.vim_search` и доступны в пикере keymap:

```toml
[tui.keymap.vim_search]
# примеры переназначения применяются через палитру keymap
```

Поисковые запросы не смешиваются с текстом черновика и не оседают в нём.

С ним связан фикс [`#41921`](https://github.com/openai/codex/pull/41921): при включённом Vim композер теперь **стартует в Insert mode** — и при создании нового черновика, и после отправки сообщения или dispatch слэш-команды. Свежая Insert-сессия записывается как Vim-правка, поэтому введённый в новом черновике текст можно повторить клавишей `.`, а `Backspace` отменяет пустой поисковый запрос или отложенный оператор, не трогая содержимое черновика.

## Действующие rate-limit-баннеры в TUI

PR [`#41742`](https://github.com/openai/codex/pull/41742) превращает сухие предупреждения о лимитах в рабочие элементы управления. Через `account/rateLimits/read` теперь передаются backend-owned баннеры и identity-данные аккаунта, которые фильтруются по аутентифицированному пользователю. Над композером рендерятся поддерживаемые уведомления с действиями:

- переход на страницу использования (usage);
- управление кредитами;
- сброс лимитов;
- уведомления владельца аккаунта;
- управление тарифным планом (plan management).

После ошибок лимита usage перечитывается, устаревшие ответы отбрасываются, а очередь ввода остаётся на паузе до завершения восстановления. Когда баннер это подсказывает, TUI переключается на первую доступную fallback-модель, не трогая остальные настройки треда. Для окружений без таких баннеров сохраняется прежний fallback-UI.

## Прогресс обновления credentials в TUI и `codex exec`

PR [`#41239`](https://github.com/openai/codex/pull/41239) поверхностно отображает то, что раньше происходило незаметно: при обновлении просроченных credentials провайдера модели эмитятся turn-scoped события восстановления. Появляются стабильные app-server-уведомления:

```text
modelProvider/authRecoveryStarted
modelProvider/authRecoveryCompleted
```

Они несут тред, turn, провайдера и человекочитаемое сообщение. Прогресс показывается и в TUI, и в `codex exec` — в том числе повторная аутентификация Amazon Bedrock.

## Package-style имена MCP-серверов

PR [`#41700`](https://github.com/openai/codex/pull/41700) снимает ограничение на символы в именах MCP-серверов. Имя может содержать `:`, `@`, `/` и `.`, то есть можно использовать npm-style имена целиком:

```toml
[mcp.servers]
"npm:@modelcontextprotocol/server-sequential.thinking" = { command = "npx", args = ["-y", "@modelcontextprotocol/server-sequential.thinking"] }
```

Такие имена сохраняются во всех операциях — `mcp add`, `get`, `list`, `remove`, в runtime tool-namespace'ах и в OAuth credential lookup. В генерируемых recovery-подсказках `config.toml` не-bare имена заключаются в кавычки, а экранированные OAuth-имена credentials изолируются от коллизий.

## Per-tool лимит вывода MCP

PR [`#41421`](https://github.com/openai/codex/pull/41421) добавляет на каждый инструмент под сервером MCP положительный параметр `output_token_limit`:

```toml
[mcp.servers.notes.tools]
search = { output_token_limit = 4000 }
```

При пересечении политик плагина и пользователя применяется самый строгий лимит, при этом политика approval остаётся независимой. Эффективный MCP output-бюджет переносится в историю диалога, поэтому результат инструмента, ответ post-tool хука и возобновлённая сессия сокращаются одним и тем же порогом.

## Настраиваемые таймауты `thread/shellCommand`

PR [`#41384`](https://github.com/openai/codex/pull/41384) позволяет app-server клиентам управлять временем выполнения shell-команд треда через опциональный параметр `timeoutMs`:

```json
{
  "method": "thread/shellCommand",
  "params": { "threadId": "...", "command": "...", "timeoutMs": 7200000 }
}
```

- Если параметр опущен или `null` — сохраняется одночасовой дефолт.
- Можно задать и более длинные таймауты (дольше часа).
- `0` означает мгновенный таймаут; отрицательные или невалидные значения отклоняются до запуска.
- Таймаут вспомогательной shell-команды не убивает активный turn.

## Инструмент `update_plan` становится opt-in

PR [`#41744`](https://github.com/openai/codex/pull/41744) меняет поведение по умолчанию: инструмент планирования `update_plan` больше не включён из коробки. Значение `tools.update_plan.enabled` по умолчанию — `false`; чтобы вернуть его:

```toml
tools.update_plan.enabled = true
```

При выключенном инструменте соответствующая guidance убирается из model-, collaboration-mode, multi-agent, compaction, prewarm и goal-continuation промптов. Кастомные base-instructions, catalog-инструкции модели, collaboration-политики и текст пользовательских целей сохраняются, даже если упоминают planning или `update_plan`.

## Исправления и безопасность

- **Guardian-транскрипт** ([`#41931`](https://github.com/openai/codex/pull/41931)) — бюджет сообщений Guardian поднят с 10 000 до 20 000 токенов, лимит одного сообщения — с 2 000 до 5 000. Автоматические approval-reviews могут держать более длинные сообщения и больший транскрипт.
- **Сохранение контекста approvals** ([`#41660`](https://github.com/openai/codex/pull/41660), [`#41846`](https://github.com/openai/codex/pull/41846), [`#41852`](https://github.com/openai/codex/pull/41852)) — при компакции истории approval-reviews сохраняют инструкции пользователя, ответы и валидные авторизации.
- **Восстановление состояния треда** ([`#41567`](https://github.com/openai/codex/pull/41567), [`#41464`](https://github.com/openai/codex/pull/41464)) — возобновлённые треды восстанавливают сохранённую рабочую директорию, когда не подана своя; обновления client-метаданных сохраняют права на файловую систему.
- **Модель-пикер** ([`#41467`](https://github.com/openai/codex/pull/41467)) — при открытии пикер асинхронно запрашивает актуальный список моделей, отображая кешированные варианты сразу; открытый пикер обновляется на месте, сохраняя подсвеченную модель и submenu reasoning. Устаревшие, упавшие, пустые или инвалидные ответы игнорируются.
- **MCP и cache-refresh** ([`#41336`](https://github.com/openai/codex/pull/41336), [`#41344`](https://github.com/openai/codex/pull/41344), [`#41396`](https://github.com/openai/codex/pull/41396), [`#41400`](https://github.com/openai/codex/pull/41400)) — MCP-инструменты остаются доступными после cache-refresh и изменений remote-плагинов; retry аутентификации используют обновлённые helper-provided заголовки.
- **Windows и терминалы** ([`#41227`](https://github.com/openai/codex/pull/41227), [`#41436`](https://github.com/openai/codex/pull/41436), [`#41673`](https://github.com/openai/codex/pull/41673)) — sandbox работает с PowerShell из Microsoft Store, устранены зависания субпроцессов на terminal-запросах и искажения рендера курсора в старых JediTerm-терминалах.
- **Cloud-credentials** ([`#41403`](https://github.com/openai/codex/pull/41403)) — `CODEX_CLOUD_TASKS_BASE_URL` валидируется против доверенных HTTPS-origin'ов на порту 443 и отклоняет URL с user info, query или fragment; redirects у cloud-task клиентов отключены, чтобы credentials не утекли на destination redirect'а.

## Служебное

- [`#41375`](https://github.com/openai/codex/pull/41375) — плагинные рекомендации начинают загружаться при старте сессии, параллельно MCP и plugin setup, сокращая задержку до первого turn.

## Итоги для обновления

1. **Vim.** Используйте `/` и `?` для поиска по черновику, `n`/`N` для повторов с обходом, `d/...`/`c/...`/`y/...` как motions; биндинги настраиваются в `tui.keymap.vim_search`. Черновики стартуют в Insert mode, а `.` повторяет введённый текст.
2. **Rate-limits.** В TUI под композером появляются действующие баннеры с переходами на usage/credits/resets/plans и переключением на fallback-модель.
3. **MCP.** Имена серверов теперь принимают `npm:`-стиль (`npm:@modelcontextprotocol/server-sequential.thinking`), а для отдельных инструментов задаётся `output_token_limit` под `tools`.
4. **Shell-команды.** `thread/shellCommand` принимает `timeoutMs` (дефолт — 1 час, `0` — мгновенный таймаут, более длинные значения допустимы).
5. **Планирование.** Чтобы включить `update_plan`, задайте `tools.update_plan.enabled = true` — по умолчанию инструмент отключен.

Релиз `0.152.0` делает Vim-композер зрелым инструментом редактирования, добавляет прозрачности в rate-limit и auth-сценарии, а MCP-конфигурация становится точнее — от имён package-style до лимитов вывода на отдельный инструмент.

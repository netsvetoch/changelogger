---
author: Артём Нецветаев
pubDatetime: 2026-08-22T19:49:18.000Z
title: "OpenAI Codex rust-v0.148.0: /export в Markdown, codex exec fork, Bedrock Runtime и MCP-хуки"
slug: openai-codex-rust-v0-148-0
featured: false
draft: false
tags:
  - release
  - codex
  - openai
  - cli
  - tui
  - app-server
  - mcp
  - aws
description: "Разбор OpenAI Codex rust-v0.148.0: экспорт тредов в Markdown через /export, codex exec fork и архивирование сессий, черновики промптов во время старта TUI, оценка кредитов в /status, встроенный провайдер Amazon Bedrock Runtime и асинхронные / MCP-хуки."
---

OpenAI выпустила [`rust-v0.148.0`](https://github.com/openai/codex/releases/tag/rust-v0.148.0) — minor-релиз Codex, сосредоточенный на работе с сессиями в TUI и CLI, удобстве длинных разговоров и новом способе подключать хуки. Отдельно появился встроенный провайдер Amazon Bedrock Runtime.

Ниже — разбор GitHub Release, диапазона [`rust-v0.147.0...rust-v0.148.0`](https://github.com/openai/codex/compare/rust-v0.147.0...rust-v0.148.0) и связанных PR: [`#37358`](https://github.com/openai/codex/pull/37358), [`#37367`](https://github.com/openai/codex/pull/37367), [`#37369`](https://github.com/openai/codex/pull/37369), [`#37371`](https://github.com/openai/codex/pull/37371), [`#38642`](https://github.com/openai/codex/pull/38642), [`#38788`](https://github.com/openai/codex/pull/38788), [`#38281`](https://github.com/openai/codex/pull/38281), [`#38282`](https://github.com/openai/codex/pull/38282), [`#38470`](https://github.com/openai/codex/pull/38470), [`#37533`](https://github.com/openai/codex/pull/37533), [`#38705`](https://github.com/openai/codex/pull/38705), [`#37260`](https://github.com/openai/codex/pull/37260), [`#38785`](https://github.com/openai/codex/pull/38785), [`#37485`](https://github.com/openai/codex/pull/37485), [`#38704`](https://github.com/openai/codex/pull/38704), [`#38026`](https://github.com/openai/codex/pull/38026), [`#37198`](https://github.com/openai/codex/pull/37198), [`#37368`](https://github.com/openai/codex/pull/37368).

## `/export`: разговор целиком в Markdown

PR [`#37358`](https://github.com/openai/codex/pull/37358) добавляет в TUI команду `/export`, которая выгружает полную историю конверсии как структурированный Markdown. Есть два направления:

- в буфер обмена (clipboard);
- в новый файл — с запросом имени по умолчанию либо с явным путём аргументом.

Экспорт сохраняет user/assistant-сообщения, планы (plans), reasoning, активность, подписи изображений, изменения файлов и детали MCP-инструментов, при этом учитывает настройку видимости reasoning. Если пагинация истории недоступна, Codex падает на legacy history loading; для эфемерных сессий используется видимый транскрипт. Относительные и home-относительные пути разрешаются, а существующий файл не перезаписывается.

```text
/export                      # клипборд или файл с именем по умолчанию
/export ~/codex-notes.md     # конкретный путь (существующий файл не перезаписывается)
```

## Fork и архивирование сессий

PR [`#37367`](https://github.com/openai/codex/pull/37367) добавляет fork для CLI:

```bash
# новая ветка треда из существующей сессии, без немедленного запуска turn
codex exec fork <SESSION_ID>

# либо сразу продолжить промптом (и опциональными изображениями)
codex exec fork <SESSION_ID> "продолжи расследование"
```

Fork можно создать либо без запуска turn, либо сразу продолжить его промптом. Исходная сессия не меняется, а `threadId` первоисточника сохраняется в конфигурации новой сессии.

В resume picker появилось архивирование. PR [`#37369`](https://github.com/openai/codex/pull/37369) вводит действие `Ctrl+A` для архивации выбранной сессии (с footer-подсказкой и защитой от повторных действий, пока запрос в обработке), а [`#37371`](https://github.com/openai/codex/pull/37371) — переключатель Active/Archived: заархивированную сессию можно отфильтровать, затем восстановить перед возобновлением, с inline-обработкой ошибок и сохранением фильтра по директории, когда просматриваются архивные сессии.

## Черновик промпта и статус при старте TUI

Раньше, пока TUI инициализировался (конфигурация, app-server), нельзя было начать печатать. PR [`#38642`](https://github.com/openai/codex/pull/38642) показывает provisional composer уже во время старта: текст, позиция курсора, paste-состояние и вложения переносятся в инициализированный чат. Редактирование ограничено безопасными действиями и отменой; ввод во время сессионных picker, approvals и других интерактивных экранов «карантинится».

PR [`#38788`](https://github.com/openai/codex/pull/38788) дополняет это статусной строкой над композером:

```text
Forking session…
> ваш черновик промпта уже можно печатать
```

`Resuming session…` / `Forking session…` показывается в приглушённом виде в зависимости от запрошенного действия и исчезает после резолва выбора сессии, сохраняя высоту композера и черновик текста.

## Оценка кредитов треда в status-line и `/status`

PR [`#38281`](https://github.com/openai/codex/pull/38281) расширяет RPC `account/usage/read` опциональным полем `threadId` и обратно-совместимым ответом `threadUsage` с оценкой кредитов, опциональной USD-стоимостью и разбивкой по модели, reasoning, скорости и токенам. Для eligible Business/Enterprise планов `/status` подтягивает оценку асинхронно и обновляет карточку, сохраняя terminal scrollback.

PR [`#38282`](https://github.com/openai/codex/pull/38282) добавляет конфигурируемые элементы статусной строки и заголовка терминала для Enterprise-воркспейсов:

```toml
# status line
status_line = "thread-credits | estimated-thread-cost"
```

Оценка берётся только когда выбран хотя бы один из этих элементов, обновляется после завершения turn и сохраняет последний ненулевой результат, пока usage «устаканивается».

## Встроенный провайдер Amazon Bedrock Runtime

PR [`#38470`](https://github.com/openai/codex/pull/38470) добавляет новый built-in провайдер `amazon-bedrock-runtime` для региональных OpenAI-совместимых endpoints Bedrock Runtime (`https://bedrock-runtime.{region}.amazonaws.com/openai/v1`). Это отдельная запись от существующего `amazon-bedrock` (Mantle) — с собственным SigV4-сервисом (`bedrock`) и поддержкой per-provider AWS profile и region override, но с сохранением bearer token auth.

```toml
[model_providers.amazon-bedrock-runtime]
# наследует региональный endpoint из AWS-конфигурации

[model_providers.amazon-bedrock-runtime.aws]
profile = "runtime-profile"
region = "us-west-2"
```

Каталог моделей включает GPT-5.6 в global и US cross-region вариантах: `global.openai.gpt-5.6-sol/terra/luna` и `us.openai.gpt-5.6-sol/terra/luna`. Для fallback и фоновых задач Codex предпочитает global routing, а web search для Runtime-эндпоинта выключен (в отличие от Mantle). Remote compaction для Bedrock остаётся v1.

## Хуки: асинхронные команды и вызов MCP-инструментов

Два PR закрывают большой пробел в hook-движке.

[`#37533`](https://github.com/openai/codex/pull/37533) позволяет command-хуки выполняться асинхронно в фоне, с per-session лимитом конкурентности, при этом `SessionEnd` остаётся синхронным. Асинхронный хук не может блокировать, останавливать или переписывать операцию, которая его запустила: результат впрыскивается в активный turn после sampling либо буферизуется к следующему user prompt, когда сессия простаивает. In-flight хуки сохраняются при перезагрузке конфигурации, вывод скоупится в тред, а при shutdown есть прерывание незавершённой работы.

[`#38705`](https://github.com/openai/codex/pull/38705) добавляет поддержку MCP-хуков через новый handlerType `mcp_tool`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "security",
            "tool": "scan",
            "input": { "command": "${tool_input.command}" },
            "timeout": 20,
            "statusMessage": "checking security policy"
          }
        ]
      }
    ]
  }
}
```

Плейсхолдеры `${...}` раскрываются из hook-event input с сохранением JSON-типов (вложенные объекты и массивы тоже поддерживаются), а вывод уходит в обычный hook output contract того же формата, что у command-хуков. `hooks/list` теперь отдаёт handler-специфичные поля (`mcpTool` server/tool), и они же показываются в TUI hooks browser. `SessionEnd` MCP-хуки не поддерживаются — они либо пропускаются, либо вызывают startup warning, если движок хуков не сконфигурирован на MCP-инвокацию.

## Устойчивость и настройки во время активного turn

PR [`#37260`](https://github.com/openai/codex/pull/37260) чинит переключение модели на первом turn и его rollback: отслеживается модель, поставившая базовые инструкции сессии, а developer content от переключения на первом turn удаляется при rollback, чтобы retry и cold resume не дублировали устаревшие инструкции. [`#38785`](https://github.com/openai/codex/pull/38785) снапшотит модель, reasoning-настройки, service tier, approval и model-attributed telemetry в `StepContext` — изменения настроек тредов, сделанные в середине активного turn, применяются к следующему turn, а текущий продолжает использовать исходные запросы.

## Сеть, resume и песочница

- [`#37485`](https://github.com/openai/codex/pull/37485): sampling-запросы классифицируют HTTP connection failures отдельно и ретраят с экспоненциальной задержкой 5–60 секунд, показывая `Reconnecting... waiting for network`; обычный bounded retry budget сохраняется.
- [`#37198`](https://github.com/openai/codex/pull/37198) / [`#37368`](https://github.com/openai/codex/pull/37368): при `thread/resume` восстанавливаются персистентный `cwd` и последняя approval policy из настроек треда (вместо текущего дефолта), с корректным приоритетом явного override.
- [`#38704`](https://github.com/openai/codex/pull/38704): вставка в TUI нормализует CRLF как один line feed, а не два (пары `\r\n` больше не превращаются в двойные переводы строк).
- [`#38026`](https://github.com/openai/codex/pull/38026): небезопасные Linux globs без не-root префикса (например `/**/*.env`) теперь fail-closed: сборка Bubblewrap-песочницы заканчивается фатальной ошибкой, а не молча пропускается, что гарантирует выполнение deny-read правила.
- [`#37337`](https://github.com/openai/codex/pull/37337): MCP-серверы восстанавливаются после OAuth reauthentication без перезапуска Codex.

## Итоги для обновления

1. **TUI/CLI-сессии.** Экспортируйте разговор через `/export`; fork в CLI через `codex exec fork <SESSION_ID> [PROMPT]`; архивируйте/восстанавливайте сессии в resume picker через `Ctrl+A` и переключатель Active/Archived.
2. **Скорость старта.** Промпт теперь можно набирать, пока TUI инициализируется; статус `Resuming…`/`Forking…` появится над композером.
3. **Биллинг.** Для Business/Enterprise в `status_line` доступны `thread-credits` и `estimated-thread-cost`, а `/status` показывает оценку usage по треду.
4. **AWS.** Для региональных Bedrock Runtime endpoints используйте встроенный провайдер `amazon-bedrock-runtime` с `[model_providers.amazon-bedrock-runtime.aws] profile/region`. Web search на этом эндпоинте недоступен.
5. **Хуки.** Пометьте command-хуки `async`, чтобы они работали в фоне, или используйте `mcp_tool`-хуки для вызова MCP-инструментов с `${...}`-плейсхолдерами. `SessionEnd` для MCP-хуков не поддерживается.

Минорный релиз `0.148.0` — это в первую очередь про продуктивность в длинных сессиях: выгрузка истории, fork/архивация, ранний ввод промпта и прозрачный расход кредитов, плюс первый шаг к асинхронным и MCP-овым хукам.

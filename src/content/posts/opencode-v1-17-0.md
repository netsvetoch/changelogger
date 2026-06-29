---
author: Артём Нецветаев
pubDatetime: 2026-06-29T08:49:40.000Z
title: "opencode 1.17.0: fff-поиск, sticky routing и более надежные MCP-сессии"
slug: opencode-v1-17-0
featured: false
draft: false
tags:
  - release
  - opencode
  - ai-agents
description: "Обзор минорного релиза opencode 1.17.0: быстрый fff-backed поиск по файлам и содержимому, X-Session-Id для прокси, reasoning field для vLLM, non-interactive mcp add, пагинация MCP-каталогов, abort-сигналы для tool calls и bounded v2 tool output."
---

[`opencode`](https://github.com/anomalyco/opencode) выпустил минорный релиз [`v1.17.0`](https://github.com/anomalyco/opencode/releases/tag/v1.17.0). Это практический релиз для больших рабочих деревьев и production-подключений: файловый поиск переехал на `fff`, прокси могут держать LLM-сессию на одном upstream через `X-Session-Id`, MCP-команды стали пригоднее для автоматизации, а v2 runner получил защиту от слишком больших tool outputs и одноразовое восстановление после context overflow.

Источник для обзора — GitHub Release [`anomalyco/opencode@v1.17.0`](https://github.com/anomalyco/opencode/releases/tag/v1.17.0), compare [`v1.16.2...v1.17.0`](https://github.com/anomalyco/opencode/compare/v1.16.2...v1.17.0) и связанные PR/коммиты: [#27802](https://github.com/anomalyco/opencode/pull/27802), [#31511](https://github.com/anomalyco/opencode/pull/31511), [#30477](https://github.com/anomalyco/opencode/pull/30477), [#31054](https://github.com/anomalyco/opencode/pull/31054), [#31442](https://github.com/anomalyco/opencode/pull/31442), [#31455](https://github.com/anomalyco/opencode/pull/31455), [#31005](https://github.com/anomalyco/opencode/pull/31005), [#30999](https://github.com/anomalyco/opencode/pull/30999), [#30332](https://github.com/anomalyco/opencode/pull/30332), [#28761](https://github.com/anomalyco/opencode/pull/28761), [#30804](https://github.com/anomalyco/opencode/pull/30804) и [#30529](https://github.com/anomalyco/opencode/pull/30529).

## File search теперь использует `fff`, но сохраняет fallback на ripgrep

Главное изменение Core — новый слой `packages/core/src/filesystem/search.ts` из [#27802](https://github.com/anomalyco/opencode/pull/27802). В зависимости добавлен `@ff-labs/fff-bun`, а в `packages/core/package.json` появился conditional import `#fff`: в Bun он указывает на `packages/core/src/filesystem/fff.bun.ts`, в Node — на `fff.node.ts`, где `available()` возвращает `false` и создание picker'а явно завершается ошибкой `fff unavailable on node runtime`.

Новый `Search`-сервис покрывает несколько сценариев:

- `search.search({ cwd, pattern, glob, limit })` — поиск по содержимому;
- `search.file({ cwd, query, kind })` — fuzzy-поиск файлов, директорий или mixed-результатов;
- `search.glob({ cwd, pattern, limit })` — glob-поиск;
- `search.open({ cwd, file })` — записывает связь query → file в историю `fff`, чтобы frecency мог поднимать недавно выбранные файлы;
- `search.warm(cwd)` и `search.release(cwd)` — прогрев и освобождение picker'а, включая native watcher thread.

`fff` используется как быстрый путь, но релиз не удаляет `ripgrep`: сервис всё ещё экспортирует `files`/`tree` из `Ripgrep`, а content search может вернуться к ripgrep при недоступности `fff` или при ошибках. В тестах для нового слоя проверены UTF-8 byte ranges для submatches, include-фильтры `glob: ["*.ts"]`, paging без явного лимита и смешанный поиск, где пустой query возвращает и файлы, и директории.

Пример подтверждённого API из тестов релиза:

```ts
const result = await search.search({
  cwd: dir,
  pattern: "needle",
  glob: ["*.ts"],
  limit: 10,
});

// Для успешного fff-пути result.engine === "fff".
```

Для пользователей эффект простой: в больших проектах интерактивный выбор файлов, glob и grep должны быстрее отдавать первые результаты, а поведение при ошибке native-пикера остаётся безопасным — есть fallback, а не hard failure всего сеанса.

## `X-Session-Id` для sticky routing через LLM-прокси

[#31511](https://github.com/anomalyco/opencode/pull/31511) добавил заголовок `X-Session-Id` в подготовку LLM-запросов для не-opencode провайдеров. В `packages/opencode/src/session/llm/request.ts` он ставится рядом с уже существующим `x-session-affinity`:

```ts
{
  "x-session-affinity": input.sessionID,
  "X-Session-Id": input.sessionID,
  ...(input.parentSessionID ? { "x-parent-session-id": input.parentSessionID } : {}),
  "User-Agent": USER_AGENT,
}
```

Зачем это нужно: Anthropic-compatible enterprise gateways и похожие прокси часто используют session id для routing affinity. Без такого ключа load balancer может разнести multi-turn диалог по разным upstream-аккаунтам, из-за чего prompt/KV cache хуже переиспользуется. Теперь opencode передаёт тот же идентификатор сессии в заголовке, который ожидают такие прокси.

## vLLM и OpenRouter: больше reasoning-вариантов без ручных обходов

В [#30477](https://github.com/anomalyco/opencode/pull/30477) расширен контракт `interleaved.field`: раньше schema принимала только `"reasoning_content"` и `"reasoning_details"`, теперь разрешён ещё и `"reasoning"`. Это изменение прошло через `packages/core/src/models-dev.ts`, `packages/core/src/v1/config/provider.ts`, `packages/opencode/src/provider/provider.ts`, сгенерированные SDK-типы и `packages/sdk/openapi.json`.

Практический config для vLLM-провайдера теперь может выглядеть так:

```json
{
  "models": {
    "minimax-m2.7": {
      "options": {
        "interleaved": {
          "field": "reasoning"
        }
      }
    }
  }
}
```

Это не косметика: в PR указано, что vLLM в новых версиях читает `message.reasoning` и может silently drop старое `reasoning_content`.

Для OpenRouter [#30332](https://github.com/anomalyco/opencode/pull/30332) убрал слишком узкий фильтр в `ProviderTransform.variants`. До фикса reasoning variants генерировались только для id, содержащих `gpt`, `gemini-3` или `claude`; reasoning-capable модели вроде `deepseek/deepseek-v4-pro` могли остаться без вариантов в `Ctrl+T`. Теперь для остальных reasoning-моделей OpenRouter создаются widely supported efforts `low`, `medium`, `high`, а OpenAI-совместимые модели сохраняют свой список `none`/`minimal`/`low`/`medium`/`high`/`xhigh` там, где он поддержан.

## `opencode mcp add` стал пригоден для CI и dotfile-скриптов

Раньше `opencode mcp add` был интерактивным. В [#31054](https://github.com/anomalyco/opencode/pull/31054) команда стала `opencode mcp add [name]` и получила параметры:

- `--url` для remote MCP server;
- повторяемый `--header KEY=VALUE` для remote headers;
- повторяемый `--env KEY=VALUE` для local server;
- команду после `--` для local MCP.

Примеры из PR теперь валидны для non-interactive setup:

```bash
opencode mcp add postgres \
  --env PGUSER=orb \
  -- npx -y @modelcontextprotocol/server-postgres postgresql://localhost/mydb

opencode mcp add github \
  --url https://api.githubcopilot.com/mcp \
  --header "Authorization=Bearer {env:GITHUB_TOKEN}"
```

Валидация тоже конкретная: если указаны `--url`, `--env`, `--header` или argv после `--`, но нет имени сервера, команда падает с ошибкой `A server name is required for non-interactive MCP configuration`; для remote-сервера нельзя одновременно передавать command argv, а `--env` разрешён только local-серверам.

## MCP-каталоги больше не обрезаются на первой странице

[#31442](https://github.com/anomalyco/opencode/pull/31442) добавил общую функцию пагинации для MCP catalog listing. Раньше `listTools`, `listPrompts` и `listResources` фактически зависели от первой страницы ответа. Теперь opencode передаёт cursor, собирает все страницы и останавливается в двух защитных случаях:

- повторный cursor вызывает ошибку `MCP list returned duplicate cursor: ...`;
- traversal ограничен `MAX_LIST_PAGES = 1_000`.

При этом сохранён tolerant parsing для `tools/list`: если стандартная schema не принимает output schema конкретного MCP-сервера, opencode повторяет запрос через `client.request({ method: "tools/list", params }, TolerantListToolsResultSchema, ...)`, но уже с тем же cursor. Для пользователей это закрывает неприятный класс багов, где большой MCP-сервер был подключён, но часть tools/prompts/resources просто не попадала в каталог.

Соседний MCP-фикс из [#31455](https://github.com/anomalyco/opencode/pull/31455) прокидывает `options.abortSignal` из AI SDK tool execution в `client.callTool(..., { signal: options.abortSignal, timeout, resetTimeoutOnProgress: true })`. Теперь отмена активного turn может дойти до MCP SDK как cancellation, а не оставлять долгий tool call жить после пользовательской отмены.

## V2 runner: bounded tool output и одно восстановление после context overflow

SDK/Core-часть релиза важна для длинных агентских задач. [#30999](https://github.com/anomalyco/opencode/pull/30999) централизовал лимит model-visible output для Core-executed v2 tools. Семантика из PR:

- используется существующий лимит `tool_output`: по умолчанию 2 000 строк или 50 KiB UTF-8;
- полный текст сверх лимита сохраняется в managed `tool_*` files в общей tool-output директории;
- durable tool success events и projected session messages получили `outputPaths?: string[]`;
- `read`, `grep` и `bash` могут затем читать эти retained output paths без отдельного resource protocol;
- structured-only результаты, если они слишком большие, превращаются в bounded textual JSON для replay модели, но validated structured value не мутируется.

Это меняет поведение больших выводов с «засорить историю огромным tool result» на «дать модели preview и абсолютный путь к полному выводу». Для downstream SDK это заметно по новому полю в состоянии tool completion:

```ts
type ToolStateCompleted = {
  content: ToolOutput.Content[];
  outputPaths?: string[];
  structured: ToolOutput.Structured;
  result?: unknown;
};
```

[#31005](https://github.com/anomalyco/opencode/pull/31005) добавляет recovery path для provider context overflow. LLM package теперь классифицирует ошибку как provider-neutral `classification?: "context-overflow"` для HTTP invalid requests, OpenAI Responses stream failures, Anthropic Messages stream failures и Bedrock Converse validation exceptions. Если overflow приходит до durable assistant output, runner выполняет forced compaction, перезагружает историю из completed checkpoint и повторяет provider request ровно один раз.

Важные границы поведения:

- `compaction.auto: false` не блокирует этот emergency path, потому что provider уже доказал, что локальная оценка размера ошиблась;
- если compaction не может завершиться, исходный overflow публикуется как обычная terminal failure;
- второй overflow не запускает новый цикл, чтобы не получить бесконечные повторы;
- если assistant уже начал писать текст, reasoning или tool activity, recovery отключается, чтобы не дублировать durable content и side effects.

## Меньше мелких ловушек в сессиях, LSP и Desktop

Релиз также закрывает несколько точечных сценариев, которые хорошо видны по PR:

- [#30804](https://github.com/anomalyco/opencode/pull/30804) исправляет `Session.list({ directory })` при experimental workspaces: условие фильтра по directory теперь применяется всегда, когда `scope !== "project"`, а не только когда workspaces выключены. Это чинит sidebar/web UI, где сессии из sibling directory могли отфильтроваться уже на клиенте и визуально пропасть.
- [#30529](https://github.com/anomalyco/opencode/pull/30529) меняет `SessionPrompt.prompt`: per-call tool rules больше не заменяют весь `session.permission`, а мержатся через `Permission.merge`. Поэтому subtask child сохраняет inherited `external_directory` allow от родительской сессии и одновременно получает deny для `task`/`todowrite`.
- [#28761](https://github.com/anomalyco/opencode/pull/28761) делает JDTLS root detection Maven-aware: для multi-module Java projects opencode поднимается по цепочке `pom.xml` и проверяет, объявляет ли parent `pom` дочерний каталог в `<modules>`, чтобы не запускать отдельный JDTLS на каждый submodule.
- [#31053](https://github.com/anomalyco/opencode/pull/31053) превращает `providers logout` в `providers logout [provider]`: можно передать provider id/name напрямую, а интерактивный режим теперь использует autocomplete с `maxItems: 8`.
- Desktop-часть получила WSL-backed support и несколько WSL-фиксов: например, [#31095](https://github.com/anomalyco/opencode/pull/31095) переносит удаление `wsl:` servers в общий `handleRemove`, защищает WSL initialization условием `process.platform === "win32"` и чинит stale version cache.

## Стоит ли обновляться

Да, если вы используете opencode на больших репозиториях, за MCP-прокси или в desktop/workspace-сценариях. Самые заметные изменения — быстрый `fff`-поиск, non-interactive MCP registration и устойчивость v2 runner'а к двум частым production-проблемам: слишком большим tool outputs и provider-side context overflow. Для провайдеров и конфигов стоит отдельно проверить `interleaved.field: "reasoning"` на vLLM и новые reasoning variants на OpenRouter-моделях.

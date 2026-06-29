---
author: Артём Нецветаев
pubDatetime: 2026-06-29T11:44:11.000Z
title: "zai-cli 1.1.0: кэш MCP tools, --no-vision и новые флаги для repo/read"
slug: zai-cli-v1-1-0
featured: false
draft: false
tags:
  - release
  - zai-cli
  - ai-agents
  - cli
description: "Разбор zai-cli 1.1.0: язык поиска по репозиториям, path/depth для repo tree, флаги web reader, 24-часовой кэш MCP tool discovery, retry/backoff для MCP, --no-vision и редактирование секретов в схемах tools."
---

[`zai-cli`](https://github.com/numman-ali/zai-cli) выпустил минорный релиз [`v1.1.0`](https://github.com/numman-ali/zai-cli/releases/tag/v1.1.0). Это практический релиз про скорость и управляемость MCP-команд: tool discovery теперь кэшируется, vision MCP можно не поднимать для не-vision сценариев, transient MCP-сбои получили retry/backoff, а команды `repo` и `read` прокинули новые параметры в Z.AI MCP tools.

Источник: GitHub Release [`numman-ali/zai-cli@v1.1.0`](https://github.com/numman-ali/zai-cli/releases/tag/v1.1.0) и compare [`v1.0.0...v1.1.0`](https://github.com/numman-ali/zai-cli/compare/v1.0.0...v1.1.0). В compare есть промежуточные патч-коммиты `v1.0.1` и `v1.0.2`, но пользовательские изменения релиза `1.1.0` сосредоточены в коммите `release: zai-cli 1.1.0`: обновлены `CHANGELOG.md`, README, CLI-команды, MCP-клиент, тесты и skill-документация.

## `repo search` получил язык ответа, а `repo tree` — `--path` и `--depth`

Команда поиска по репозиториям теперь принимает язык результата. В `packages/zai-cli/src/commands/repo.ts` появился тип `RepoSearchOptions` с `language?: 'en' | 'zh'`, валидация запрещает всё кроме `en` и `zh`, а дефолт выставлен в `en` перед вызовом MCP tool:

```ts
const language = options.language || "en";
const results = await client.searchDoc(repo, query, language);
```

На уровне CLI это прокинуто через `handleRepo()` в `packages/zai-cli/src/index.ts`, поэтому команда выглядит так:

```bash
zai-cli repo search facebook/react "server components" --language en
```

Для дерева репозитория изменение крупнее. `repo tree` теперь принимает `--path <path>` и `--depth <n>`. `--path` нормализуется как относительный путь внутри репозитория: пустая строка, `/` и `.` превращаются в корень, а ведущие/замыкающие слэши удаляются. `--depth` должен быть положительным числом; при `depth === 1` CLI делает прежний одиночный вызов `getRepoStructure(repo, dirPath)`.

Если указать глубину больше 1, CLI собирает несколько снимков дерева: `collectTreeSnapshots()` начинает с базового пути, вытаскивает непосредственные подпапки из `<structure>...</structure>`, кладёт их в очередь и обходит поддеревья до заданного уровня. На выходе это уже не одна строка структуры, а объект:

```json
{
  "repo": "vercel/next.js",
  "depth": 2,
  "basePath": "packages",
  "snapshots": [{ "path": "packages", "structure": "..." }]
}
```

Практический сценарий из help теперь такой:

```bash
zai-cli repo tree vercel/next.js --path packages --depth 2
```

Это полезно для больших монорепозиториев: можно не просить MCP раскрывать весь корень, а начать с нужной директории и явно ограничить глубину обхода.

## `read` прокидывает новые настройки web reader

В `ReadOptions` добавлены три флага:

```ts
noGfm?: boolean;
keepImgDataUrl?: boolean;
withImagesSummary?: boolean;
```

Они передаются в `client.webRead()` как MCP-аргументы `no_gfm`, `keep_img_data_url` и `with_images_summary`. То есть CLI теперь даёт пользователю контроль над тем, как web reader формирует markdown и что делает с изображениями:

```bash
zai-cli read https://blog.example.com/post --with-images-summary
zai-cli read https://github.com/owner/repo --no-gfm
zai-cli read https://docs.example.com/page --keep-img-data-url
```

Старые опции `--format`, `--no-images`, `--no-cache`, `--with-links` и `--timeout` остались на месте. Важная деталь реализации: URL валидируется до подавления логов, а затем команда вызывает `silenceConsole()` перед созданием `ZaiMcpClient({ enableVision: false })`, чтобы служебные сообщения UTCP/MCP не загрязняли нормальный stdout результата.

## MCP tool discovery теперь кэшируется на 24 часа

Самое заметное инфраструктурное изменение находится в `packages/zai-cli/src/lib/mcp-client.ts`. Для списка MCP-инструментов появился best-effort кэш:

```ts
const DEFAULT_TOOL_CACHE_TTL_MS = parseInt(
  process.env.ZAI_MCP_TOOL_CACHE_TTL_MS || "86400000",
  10
);
const TOOL_CACHE_ENABLED = !["0", "false"].includes(
  (process.env.ZAI_MCP_TOOL_CACHE || "1").toLowerCase()
);
```

По умолчанию кэш включён и живёт 86 400 000 мс, то есть 24 часа. Директория выбирается так: сначала `ZAI_MCP_CACHE_DIR` или `ZAI_CACHE_DIR`, затем `$XDG_CACHE_HOME/zai-cli`, на macOS `~/Library/Caches/zai-cli`, в остальных случаях `~/.cache/zai-cli`.

Ключ кэша зависит не только от версии файла, но и от конфигурации MCP: `mode`, `baseUrl`, списка endpoints и признака `enableVision`. Это важно: список tools для запуска с vision и без vision не смешивается. `listTools(refresh = false)` сначала пробует прочитать валидный JSON с `{version, timestamp, tools}`, проверяет TTL, а при промахе инициализирует UTCP client, получает `client.getTools()` и записывает кэш.

В релиз также добавлен скрипт `packages/zai-cli/scripts/bench-tools.mjs`. Он запускает `node bin/zai-cli.js tools --no-vision`, сравнивает серии с `ZAI_MCP_TOOL_CACHE=0` и `ZAI_MCP_TOOL_CACHE=1`, а число прогонов берёт из `ZAI_BENCH_RUNS` с дефолтом `5`. Скрипт явно требует `Z_AI_API_KEY` или `ZAI_API_KEY`, потому что benchmark реально ходит в MCP.

## Retry/backoff для transient MCP-сбоев

Вызов MCP tool теперь обёрнут в цикл повторов. `callTool()` вычисляет `maxRetries`, вызывает `this.init()`, пробует `this.client.callTool(toolName, args)`, а при retriable ошибке закрывает клиент, ждёт exponential backoff с jitter и пробует снова:

```ts
const backoff = Math.min(
  DEFAULT_RETRY_MAX_MS,
  DEFAULT_RETRY_BASE_MS * Math.pow(2, attempt - 1)
);
const jitter = Math.floor(Math.random() * DEFAULT_RETRY_JITTER_MS);
await sleep(backoff + jitter);
```

Дефолтные env-настройки такие:

```bash
export ZAI_MCP_RETRY_BASE_MS=500
export ZAI_MCP_RETRY_MAX_MS=8000
export ZAI_MCP_RETRY_JITTER_MS=250
```

Глобально число повторов задаётся через `ZAI_MCP_RETRY_COUNT` и по умолчанию равно `0`. Для vision tools логика отдельная: если имя tool содержит `.vision.`, CLI сначала смотрит `ZAI_MCP_VISION_RETRY_COUNT` или старый `Z_AI_RETRY_COUNT`, а если они не заданы — использует `2` повтора.

Повторяются только transient-классы: timeout, `ETIMEDOUT`, `ECONNREFUSED`, `ECONNRESET`, network/fetch-сбои, `Unexpected system error`, HTTP `500/502/503/504`, rate limit, `429` и `-500`. Авторизационные ошибки (`401`, `403`, `auth`) и `ValidationError` не ретраятся — это правильное поведение, потому что повтор без изменения токена или аргументов не исправит такие случаи.

## `--no-vision` ускоряет не-vision команды

В `tools`, `tool`, `call` и `doctor` добавлен флаг `--no-vision`. В CLI он реализован через общий паттерн `enableVision: flags.vision !== false`: парсер флагов превращает `--no-vision` в `vision === false`, после чего команды создают `ZaiMcpClient({ enableVision: options.enableVision })`.

Примеры из обновлённой advanced-документации:

```bash
zai-cli tools --no-vision
zai-cli doctor --no-vision
zai-cli tool zai.zread.search_doc --no-vision
zai-cli call zai.search.webSearchPrime --json '{"search_query":"LLM tools"}' --no-vision
```

Для пользователей это означает более быстрый старт команд, которым не нужен vision MCP server. В связке с новым кэшем особенно важен первый запуск: `--no-vision` меняет набор endpoints в cache key, поэтому лёгкий список tools без vision не ждёт регистрации vision-инструментов и не смешивается с полной конфигурацией.

## Схемы tools больше не светят секреты

Релиз добавил `packages/zai-cli/src/lib/redact.ts`. Новый `redactSecrets()` рекурсивно проходит строки, массивы и объекты, заменяет чувствительные ключи на `[REDACTED]`, а строки вида `Bearer <token>` приводит к `Bearer [REDACTED]`. В список чувствительных ключей входят `authorization`, `Authorization`, `api_key`, `apiKey`, `access_token`, `token`, `Z_AI_API_KEY` и `ZAI_API_KEY`.

Это подключено в двух местах. Во-первых, `tools --full` и `tool <name>` теперь выводят `redactTool(tool)`, а не исходный объект tool. Во-вторых, tool discovery cache тоже пишет `tools: tools.map((tool) => redactTool(tool))`, поэтому секреты не должны попадать ни в stdout, ни в JSON-файлы кэша.

## Меньше шума от UTCP/MCP в stdout

Новый модуль `packages/zai-cli/src/lib/silence.ts` временно подменяет `console.log` и `console.error`. Он не глушит весь вывод подряд: фильтруются только строки, похожие на служебные сообщения MCP/UTCP, например `[McpCommunicationProtocol]`, `UTCP Client`, `Successfully registered manual`, `Calling tool`, `via protocol`.

Команды `repo`, `read`, `tools`, `tool`, `call`, `doctor`, `code` и `vision` в compare используют `silenceConsole()` / `restoreConsole()` вокруг MCP-вызовов. Для CLI это существенная правка: stdout снова можно безопасно парсить как результат команды, а не смесь результата и debug-логов транспортного слоя.

## Версия CLI больше не хардкодится

До релиза `packages/zai-cli/src/index.ts` содержал строку `const VERSION = '1.0.0'`. В `1.1.0` её заменили на чтение `packages/zai-cli/package.json` через `createRequire(import.meta.url)`:

```ts
const require = createRequire(import.meta.url);
const { version: VERSION } = require("../package.json") as { version: string };
```

Это небольшое изменение, но оно убирает классическую ошибку CLI-релизов: пакет уже опубликован с новой версией, а `zai-cli --version` или help продолжает показывать старую строку. Теперь bump `package.json` до `1.1.0` автоматически отражается в главном help и `--version`.

## Что проверить после обновления

Если вы используете `zai-cli` в скриптах, после перехода на `1.1.0` стоит проверить три вещи:

1. Команды, которые парсят stdout `tools`, `repo` или `read`, должны стать стабильнее из-за подавления UTCP/MCP логов, но `repo tree --depth > 1` теперь намеренно возвращает структурированный объект со `snapshots`, а не одну строку.
2. Если вы не хотите сохранять список tools на диск, отключите кэш:

   ```bash
   export ZAI_MCP_TOOL_CACHE=0
   ```

3. Если у вас нестабильные vision-вызовы, дефолт уже стал безопаснее: vision tools получают 2 retry. Для остальных tools повтор нужно включить явно:

   ```bash
   export ZAI_MCP_RETRY_COUNT=1
   ```

---
author: Артём Нецветаев
pubDatetime: 2026-06-28T20:43:42.000Z
title: "Deno 2.9.0: deno desktop, кэшируемые task и новый test runner"
slug: deno-v2-9-0
featured: false
draft: false
tags:
  - release
  - deno
  - javascript
description: "Обзор минорного релиза Deno 2.9.0: экспериментальный deno desktop, deno link/list/watch, кэширование deno task, пороги coverage, новые возможности deno test, Web Locks, Happy Eyeballs и совместимость с Node 26."
---

Deno выпустил минорный релиз [`v2.9.0`](https://github.com/denoland/deno/releases/tag/v2.9.0). Это большой выпуск вокруг двух тем: Deno становится удобнее как инструмент для приложений, а не только runtime, и подтягивает совместимость с Node/Web-платформой.

Источники для обзора — GitHub Release [`denoland/deno@v2.9.0`](https://github.com/denoland/deno/releases/tag/v2.9.0), официальный пост [Deno 2.9](https://deno.com/blog/v2.9) и связанные PR: [#33441](https://github.com/denoland/deno/pull/33441), [#35442](https://github.com/denoland/deno/pull/35442), [#35470](https://github.com/denoland/deno/pull/35470), [#34359](https://github.com/denoland/deno/pull/34359), [#34972](https://github.com/denoland/deno/pull/34972), [#35301](https://github.com/denoland/deno/pull/35301), [#34509](https://github.com/denoland/deno/pull/34509), [#35056](https://github.com/denoland/deno/pull/35056), [#35139](https://github.com/denoland/deno/pull/35139), [#34938](https://github.com/denoland/deno/pull/34938), [#35053](https://github.com/denoland/deno/pull/35053), [#35199](https://github.com/denoland/deno/pull/35199), [#35057](https://github.com/denoland/deno/pull/35057), [#33838](https://github.com/denoland/deno/pull/33838), [#35253](https://github.com/denoland/deno/pull/35253), [#35486](https://github.com/denoland/deno/pull/35486), [#31166](https://github.com/denoland/deno/pull/31166), [#31726](https://github.com/denoland/deno/pull/31726), [#35329](https://github.com/denoland/deno/pull/35329), [#33946](https://github.com/denoland/deno/pull/33946), [#35223](https://github.com/denoland/deno/pull/35223), [#31582](https://github.com/denoland/deno/pull/31582) и [#34743](https://github.com/denoland/deno/pull/34743).

## `deno desktop`: экспериментальная сборка desktop-приложений

Самое заметное новое направление — команда [`deno desktop`](https://github.com/denoland/deno/pull/33441). Она компилирует Deno-проект в самодостаточное desktop-приложение: UI открывается в webview/CEF backend, логика остаётся в Deno, а `Deno.serve()` в entrypoint автоматически привязывается к порту, на который смотрит webview.

Минимальный entrypoint выглядит как обычный Deno HTTP handler:

```ts
Deno.serve(
  () =>
    new Response("<!doctype html><h1>Hello from Deno desktop</h1>", {
      headers: { "content-type": "text/html" },
    })
);
```

Запуск:

```bash
deno desktop main.ts
```

PR [#33441](https://github.com/denoland/deno/pull/33441) добавил отдельный `DesktopFlags` и CLI-подкоманду с флагами `--output`, `--target`, `--icon`, `--include`, `--exclude`, `--hmr`, `--backend`, `--all-targets` и `--inspect-renderer`. Для директорий работает autodetect фреймворков: Next.js, Astro, Fresh, Remix, Nuxt, SvelteKit, SolidStart, TanStack Start и Vite.

В релизной ветке сразу несколько desktop-PR довели упаковку до практического состояния:

- [#35442](https://github.com/denoland/deno/pull/35442) поменял default UI backend с `cef` на `webview`; явный Chromium-backend остаётся доступен как `--backend cef`.
- [#35470](https://github.com/denoland/deno/pull/35470) научил autodetect распознавать обычные Vite SPA/MPA по `vite.config.*` или зависимости `vite` в `package.json`. Если нет `server.{js,ts,mjs}`, сгенерированный entrypoint обслуживает `dist/` через `@std/http` `serveDir` и отдаёт `index.html` как fallback для client-side routing.
- [#35296](https://github.com/denoland/deno/pull/35296) добавил Linux installer formats `.deb` и `.rpm`.
- [#35378](https://github.com/denoland/deno/pull/35378) добавил Windows `.msi`; MSI собирается через Rust-крейты `msi` и `cab`, поэтому упаковка не требует Windows-only toolchain на стороне автора.
- [#35420](https://github.com/denoland/deno/pull/35420) добавил `--compress [xz|zstd]` для self-extracting bundle: по примеру из PR webview hello-world уменьшился с 66M до 19M при `--compress`.

Практический пример для Vite-приложения:

```bash
# production desktop bundle, webview backend по умолчанию
deno desktop --output MyApp.AppImage .

# разработка с HMR
deno desktop --hmr .

# явный Chromium/CEF backend, если нужна одинаковая web-платформа на всех ОС
deno desktop --backend cef --output MyApp.msi .
```

Фича всё ещё экспериментальная, но API уже достаточно конкретный: backend выбирается флагом, формат — расширением `--output`, а фреймворк можно не указывать, если проект распознаётся автоматически.

## Новые CLI-команды: `link`, `list`, `watch`

Deno 2.9 добавляет три небольшие, но ежедневные команды.

[`deno link` и `deno unlink`](https://github.com/denoland/deno/pull/34359) стали CLI-обёрткой над полем `links` в `deno.json`. До этого локальную JSR-подмену нужно было прописывать руками. Теперь команда валидирует, что путь указывает на директорию с `deno.json` и JSR-style `name`, добавляет относительный путь в `links`, сохраняет форматирование через CST-механику и запускает install.

```bash
# в приложении: использовать локальную копию JSR-пакета
deno link ../packages/my-lib

# убрать ссылку из deno.json и переустановить зависимости
deno unlink ../packages/my-lib
```

Само поле [`links` стабилизировано](https://github.com/denoland/deno/pull/34996): из JSON schema убран префикс `UNSTABLE`, потому что локальные JSR package links уже работали без unstable-флага.

[`deno list`](https://github.com/denoland/deno/pull/34972) отвечает на другой вопрос, чем `deno info`: не «какие файлы попали в module graph от entrypoint», а «какие зависимости объявлены в проекте». Команда читает `deno.json` imports и `package.json` dependencies/devDependencies, резолвит текущие версии и печатает прямые зависимости; `--depth N` показывает дерево зависимостей.

```bash
deno list
# или дерево на два уровня
deno list --depth 2
```

[`deno watch`](https://github.com/denoland/deno/pull/35301) — короткий alias для `deno run --watch-hmr <file>`. Он переиспользует argument set `deno run`, поэтому флаги вроде `--watch-hmr=<path>`, `--watch-exclude` и `--no-clear-screen` остаются доступны.

```bash
deno watch main.ts
# эквивалентно deno run --watch-hmr main.ts
```

## `deno task`: кэш по входам, optional tasks и контроль параллелизма

У `deno task` появился input-based cache из [#34509](https://github.com/denoland/deno/pull/34509). Задача opt-in: кэш включается только если в task definition есть `files`. Deno считает fingerprint по command string, CLI-аргументам, перечисленным env vars, содержимому input-файлов и fingerprint'ам прямых task dependencies. Если ничего не изменилось, task пропускается.

Новые поля в `deno.json` schema:

```json
{
  "tasks": {
    "build": {
      "command": "deno run -A scripts/build.ts",
      "files": ["src/**/*.ts", "deno.json"],
      "output": ["dist/**"],
      "env": ["NODE_ENV"]
    }
  }
}
```

`output` не просто документирует артефакты: successful run сохраняет их в кэш, а cache hit восстанавливает outputs. Если `dist/` удалили, повторный `deno task build` может вернуть его из кэша вместо пустого no-op. Перед реальным rerun stale outputs очищаются, чтобы не смешать старые и новые артефакты.

Два дополнительных флага закрывают CI-сценарии:

```bash
# не падать, если task отсутствует
deno task --if-present lint

# ограничить число workspace tasks в topological schedule
deno task -j 2 build
# alias
deno task --concurrency 2 build
```

`--if-present` из [#35315](https://github.com/denoland/deno/pull/35315) подавляет только случай «явно названная task не найдена»; ошибки существующей task и отсутствующие зависимости не маскируются. `--jobs` / `--concurrency` из [#35318](https://github.com/denoland/deno/pull/35318) задаёт лимит параллелизма per invocation, вместо необходимости выставлять `DENO_JOBS`.

## Coverage теперь может валить CI по порогам

До 2.9 `deno coverage` и `deno test --coverage` печатали числа, но сами по себе не проваливали команду, если покрытие упало. [#35056](https://github.com/denoland/deno/pull/35056) добавил два уровня настройки:

```bash
# один процент для line/branch/function coverage
deno coverage --threshold=90 cov

deno test --coverage=cov --coverage-threshold=90
```

Для разных метрик можно использовать `deno.json`:

```json
{
  "coverage": {
    "thresholds": {
      "lines": 90,
      "branches": 80,
      "functions": 85
    }
  }
}
```

CLI-флаг имеет приоритет над config thresholds. Проверка считается по aggregate coverage across all files и использует те же hit/miss counters, что summary reporter. Если порог не выполнен, команда завершается с ошибкой вида `Coverage threshold not met` и перечисляет проваленные метрики.

## Test runner: snapshots, table tests, retry/repeats, shards и affected tests

Встроенный `deno test` получил сразу несколько возможностей, которые раньше чаще приносили из Vitest/Jest.

[#35139](https://github.com/denoland/deno/pull/35139) добавил snapshot testing как метод `t.assertSnapshot(actual, options?)` на `Deno.TestContext` и флаг `--update-snapshots` / `-u`. Формат совместим с `@std/testing/snapshot`: файлы лежат в `__snapshots__/<test file>.snap`. Для default-location snapshot-файлов не нужны отдельные read/write permissions, потому что ими управляет runner.

```ts
Deno.test("renders payload", async (t) => {
  await t.assertSnapshot({ ok: true, items: ["a", "b"] });
});

// обновить snapshots
deno test -u
```

[#34938](https://github.com/denoland/deno/pull/34938) добавил `Deno.test.each`. В отличие от ручного цикла, это регистрирует отдельный тест на каждый case, поэтому фильтрация и editor integration видят кейсы независимо. Поддержаны array cases, object/primitive cases, `printf`-style placeholders (`%s`, `%d`, `%j`, `%#`) и `$key` / `$key.nested` interpolation.

```ts
Deno.test.each([
  [1, 2, 3],
  [2, 3, 5],
])("%# add(%d, %d) = %d", (a, b, expected) => {
  if (a + b !== expected) throw new Error("bad sum");
});
```

[#35053](https://github.com/denoland/deno/pull/35053) добавил `retry` и `repeats` как per-test options плюс global flags `--retry` и `--repeats`. `retry` повторяет упавший тест и засчитывает успех, если одна попытка прошла; `repeats` запускает тест несколько раз и требует, чтобы прошли все повторы.

```ts
Deno.test({ name: "flaky integration", retry: 2 }, async () => {
  // тест может упасть в первых попытках, но должен пройти хотя бы раз
});

Deno.test({ name: "race detector", repeats: 20 }, () => {
  // должен пройти 20 раз подряд
});
```

Для больших CI появились два способа запускать меньше тестов:

```bash
# только тесты, затронутые изменениями относительно working tree или ref
deno test --changed
deno test --changed=main

# тесты, связанные с конкретными файлами
deno test --related src/auth.ts src/db.ts

# разделить suite на 4 машины; индекс 1-based
deno test --shard=2/4
```

`--changed` / `--related` из [#35199](https://github.com/denoland/deno/pull/35199) — one-shot dependency-aware selection, не watch mode. `--shard` из [#35057](https://github.com/denoland/deno/pull/35057) сортирует найденные test files в стабильном порядке и делит их на сбалансированные группы; selection происходит до `--shuffle`, поэтому один shard получает один и тот же набор файлов на разных машинах.

## `deno bundle --declaration`: rolled-up `.d.ts`

[#33838](https://github.com/denoland/deno/pull/33838) добавил `--declaration` к `deno bundle`. Флаг генерирует `.d.ts` рядом с JS bundle и пытается сделать declaration-файл self-contained: PR строит `ModuleGraph`, вызывает type checker declaration emit, а затем разворачивает относительные `export ... from "./..."` re-exports в один rolled-up declaration.

```bash
# с явным файлом вывода
deno bundle --declaration mod.ts --output dist/mod.js
# создаст dist/mod.js и dist/mod.d.ts

# с output directory
deno bundle --declaration src/mod.ts --outdir dist
# создаст dist/mod.js и dist/mod.d.ts
```

Это особенно полезно для библиотек, которые хотят отдавать один bundled JS entry и один declaration entry без отдельной сборочной цепочки.

## HTTP: automatic compression теперь opt-in

В Deno 2.9 изменилось поведение `Deno.serve` с response compression. Сначала [#35253](https://github.com/denoland/deno/pull/35253) добавил опцию `automaticCompression` и env var `DENO_SERVE_AUTOMATIC_COMPRESSION`, чтобы можно было отключить автоматическое сжатие. Затем [#35486](https://github.com/denoland/deno/pull/35486) перевёл default на `false`.

Теперь если приложению нужна автоматическая компрессия ответов, её лучше включать явно:

```ts
Deno.serve({ automaticCompression: true }, () => new Response("large payload"));
```

Process-wide default тоже доступен:

```bash
DENO_SERVE_AUTOMATIC_COMPRESSION=1 deno run -A server.ts
```

Миграционный смысл: код, который рассчитывал, что `Deno.serve` сам сжимает body по `Accept-Encoding`, должен либо включить `automaticCompression: true`, либо отдавать сжатые ответы на своём уровне.

## Web и runtime APIs: Web Locks, Happy Eyeballs, CSS imports, `watchFs.ignore`

Deno 2.9 расширяет совместимость с Web Platform API.

[#31166](https://github.com/denoland/deno/pull/31166) добавил Web Locks API: в `ext/web` появились `LockManager`, `Lock`, lazy-loaded `locks.js` и операции `op_lock_manager_request`, `await_lock`, `cancel`, `release`, `query`. Поддержаны `mode: "shared" | "exclusive"`, `ifAvailable`, `steal`, `signal` и `navigator.locks.query()`.

```ts
await navigator.locks.request("cache-migration", async lock => {
  console.log(lock.name, lock.mode); // cache-migration exclusive
  // критическая секция
});

const state = await navigator.locks.query();
console.log(state.held, state.pending);
```

[#31726](https://github.com/denoland/deno/pull/31726) внедрил Happy Eyeballs v2 для `Deno.connect` и `Deno.connectTls`: при нескольких DNS-адресах Deno может параллельно пробовать IPv6/IPv4 с задержкой между попытками. В типах появились опции:

```ts
await Deno.connect({
  hostname: "example.com",
  port: 443,
  autoSelectFamily: true,
  autoSelectFamilyAttemptDelay: 250,
});
```

Default для `autoSelectFamily` — `true`; `autoSelectFamilyAttemptDelay` по умолчанию 250 мс.

[#35093](https://github.com/denoland/deno/pull/35093) добавил экспериментальные CSS module imports за `--unstable-raw-imports`. Импорт с атрибутом `with { type: "css" }` возвращает `CSSStyleSheet`; реализация поддерживает `replace()`, `replaceSync()` и базовый `cssRules` split для SSR/тестов web components.

```ts
import sheet from "./button.css" with { type: "css" };

document.adoptedStyleSheets = [sheet];
```

[#31582](https://github.com/denoland/deno/pull/31582) добавил `ignore` в `Deno.watchFs`. Опция принимает строку или массив путей, relative paths резолвятся относительно cwd, а ignored paths всё равно требуют `allow-read`, как и watched paths.

```ts
using watcher = Deno.watchFs(".", {
  recursive: true,
  ignore: [".git", "dist"],
});
```

[#34743](https://github.com/denoland/deno/pull/34743) добавил `navigator.userAgentData` в window и worker scopes. Реализованы low-entropy `brands`, `mobile`, `platform`, `toJSON()` и `getHighEntropyValues()` с hints вроде `architecture`, `bitness`, `fullVersionList`, `uaFullVersion` и `wow64`.

```ts
console.log(navigator.userAgentData.platform);

const data = await navigator.userAgentData.getHighEntropyValues([
  "architecture",
  "uaFullVersion",
]);
console.log(data.architecture, data.uaFullVersion);
```

## Node compatibility: `node:test` mocks, Node 26 и shim для отсутствующего Node.js

Deno 2.9 продолжает догонять Node 26. В release notes отдельно указано, что reported `process.version` поднят до `v26.3.0` ([#34747](https://github.com/denoland/deno/pull/34747)). Это важно для пакетов, которые gate'ят поведение по версии Node.

В `node:test` добавлены две большие недостающие части:

- [#35329](https://github.com/denoland/deno/pull/35329) реализовал `mock.module(specifier, options)`. Он подменяет resolved module синтетическим модулем с `defaultExport` и `namedExports`, работает для ESM `import()` и CJS `require()`, возвращает `MockModuleContext` с `.restore()` и участвует в `mock.reset()` / `mock.restoreAll()`.
- [#33946](https://github.com/denoland/deno/pull/33946) заменил `notImplemented` stubs для `mock.timers.enable/reset/tick/runAll` на рабочий virtual clock. Поддержаны `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`, `setImmediate`, `clearImmediate`, `Date`; `now` принимает число или `Date`, а mocked timers работают не только через globals, но и через `node:timers` / `node:timers/promises`.

```ts
import test, { mock } from "node:test";
import assert from "node:assert/strict";

test("virtual timer", () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });

  let fired = false;
  setTimeout(() => {
    fired = true;
  }, 100);

  mock.timers.tick(100);
  assert.equal(fired, true);
  assert.equal(Date.now(), 100);

  mock.timers.reset();
});
```

Ещё один практический compatibility fix — [#34969](https://github.com/denoland/deno/pull/34969). Если в системе нет настоящего `node`, Deno теперь best-effort создаёт executable `node` в `DENO_DIR/node_compat_bin`, указывающий обратно на текущий `deno`, и добавляет эту директорию в `PATH` для команд, которые могут запускать пользовательский код (`run`, `task`, `test`, `bench`, `eval`, `repl`, `serve`). Это закрывает сценарии вроде Next.js 16/Turbopack, где native addon делает raw OS PATH lookup и спавнит `node`, обходя JS-level interception. Opt-out: `DENO_DISABLE_NODE_SHIM=1`.

## Установка npm-проектов стала ближе к npm/pnpm/yarn/bun

Для миграции package-manager проектов релиз добавляет несколько concrete improvements.

[#34970](https://github.com/denoland/deno/pull/34970) меняет workspace install: Deno теперь создаёт `node_modules` не только в workspace root, но и внутри каждого workspace member, symlink'ая прямые зависимости участника. Это важно для инструментов вроде `svelte-check`, `astro` или ESLint-плагинов, которые запускаются из директории пакета и ожидают локальный `node_modules`.

Первый `deno install` теперь может импортировать существующий lockfile в `deno.lock`, если `deno.lock` ещё нет:

- [#35330](https://github.com/denoland/deno/pull/35330): `package-lock.json`;
- [#35346](https://github.com/denoland/deno/pull/35346): `pnpm-lock.yaml`;
- [#35350](https://github.com/denoland/deno/pull/35350): Yarn Classic `yarn.lock`;
- [#35394](https://github.com/denoland/deno/pull/35394): текстовый `bun.lock` из Bun 1.1.39+.

Порядок при нескольких lockfiles: `package-lock.json`, затем `pnpm-lock.yaml`, затем `yarn.lock`, затем `bun.lock`. Binary `bun.lockb` не поддерживается, потому что у него нет текстовой формы без самого Bun.

## WebCrypto: современные алгоритмы

[#35223](https://github.com/denoland/deno/pull/35223) закрыл оставшуюся часть WICG WebCrypto modern algorithms coverage в `ext/crypto`. В релиз вошли:

- KMAC128/KMAC256: generate/import/export key, sign, verify;
- Argon2i/Argon2d/Argon2id: raw-secret import и `deriveBits`;
- KT128/KangarooTwelve и KT256 digest;
- все 12 SLH-DSA parameter sets: `generateKey`, `sign`, `verify`, `importKey`, `exportKey`, `getPublicKey`.

Для приложений это означает меньше runtime-specific crypto fallback'ов при переносе кода, ориентированного на современные WebCrypto proposals.

## Что проверить при обновлении

1. Если сервер полагался на auto compression в `Deno.serve`, включите `automaticCompression: true` явно или проверьте свой middleware.
2. Если CI уже считает coverage, можно заменить внешнюю проверку на `deno coverage --threshold=...` или `deno test --coverage --coverage-threshold=...`.
3. Если используете workspace tasks, попробуйте описать `files` / `output` / `env` для дорогих build/codegen задач — кэш в 2.9 opt-in и не меняет поведение tasks без `files`.
4. Если есть локальная разработка JSR-пакетов, замените ручное редактирование `deno.json.links` на `deno link` / `deno unlink`.
5. Если собираете desktop-приложение, проверьте default `webview` backend; для Chromium-совместимости теперь нужно явно указывать `--backend cef`.

Deno 2.9.0 — минорный релиз по semver, но по объёму больше похож на platform release: desktop packaging, test tooling, task cache, coverage gates, Web APIs и Node compatibility развиваются одновременно, причём большая часть изменений уже выражена в конкретных CLI-флагах и типах, а не только в общих обещаниях совместимости.

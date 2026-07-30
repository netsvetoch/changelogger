---
author: Артём Нецветаев
pubDatetime: 2026-07-30T12:56:10.000Z
title: "Vite 8.2.0: top-level input, client-side HMR в bundledDev и PostcssUserConfig"
slug: vite-v8-2-0
featured: false
draft: false
tags:
  - release
  - vite
  - frontend
description: "Minor Vite 8.2.0: единый top-level input, server.fs.allow для entry, client-side HMR/worker updates в experimental.bundledDev, PostcssUserConfig, подписи network URL, lockfile aube/nub и unwrap WebAssembly.Global."
---

Vite выпустил минор [`v8.2.0`](https://github.com/vitejs/vite/releases/tag/v8.2.0) (30 июля 2026). GitHub Release body короткий и отправляет в [`packages/vite/CHANGELOG.md`](https://github.com/vitejs/vite/blob/v8.2.0/packages/vite/CHANGELOG.md); отдельного `announcing-vite8-2` в `docs/blog/` нет. Ниже — обзор по changelog секций `8.2.0` + `8.2.0-beta.0`, PR и diff относительно линейки 8.1.x. В `packages/vite/package.json` на теге стоит `8.2.0`, зависимость `rolldown` — `~1.2.0`.

Главная user-facing тема минора — **один top-level `input`**, который закрывает entry для build, lib, SSR, dep-scan и dev `server.fs.allow`, плюс заметное развитие **experimental bundled dev** (client-side HMR, workers, один reload после rebuild).

## Top-level `input`: entry один раз для dev и build

PR [#22642](https://github.com/vitejs/vite/pull/22642) / [`9beae37`](https://github.com/vitejs/vite/commit/9beae37d7221b25463a011feb40b0303ca328d87) добавляет shared-опцию `input` в `SharedEnvironmentOptions` (`packages/vite/src/node/config.ts`):

```ts
// тип — InputOption из rolldown
input?: string | string[] | { [entryAlias: string]: string };
```

Пути резолвятся относительно project root в `resolveInput()`. Опция становится default-значением для:

- `build.rolldownOptions.input`
- `build.lib.entry` (само `entry` теперь optional; если нет ни `build.lib.entry`, ни top-level `input` — явная ошибка)
- `build.ssr` при `ssr: true`
- `optimizeDeps.entries` / dep scanner (`computeEntries` берёт `config.input ?? build.rolldownOptions.input`)

Раньше multi-page или non-HTML entry приходилось дублировать в `build.rolldownOptions.input` (и отдельно думать про dep pre-bundle). Теперь:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  // multi-page: один раз
  input: {
    main: resolve(import.meta.dirname, "index.html"),
    nested: resolve(import.meta.dirname, "nested/index.html"),
  },
});
```

Backend integration без HTML-entry:

```ts
export default defineConfig({
  input: "/path/to/main.js",
  build: { manifest: true },
  // вместо build.rolldownOptions.input
});
```

Библиотека может опереться на top-level entry:

```ts
export default defineConfig({
  input: "src/index.ts",
  build: {
    lib: {
      // entry опционален — подтянется из input
      name: "MyLib",
      formats: ["es", "cjs"],
    },
  },
});
```

Приоритет: `build.rolldownOptions.input` **перекрывает** top-level `input` только для build; строковый `build.ssr` по-прежнему важнее. Fallback без `input` — `index.html`, как раньше.

`mergeConfig` для top-level `input` специальный (`mergeInput` в `utils.ts`): string+string → массив, object+object → shallow merge с override ключей, mixed string/array ↔ object нормализуется в record по basename. Nested `build.input` **не** merge'ится этой логикой.

Ограничение: glob-символы в `input` запрещены (зарезервированы на будущее). Нужен литерал пути; `*`/`?`/`[]`/… без экранирования `\\` бросают:

```text
`input` cannot contain glob characters. They are reserved...
```

## `input` попадает в `server.fs.allow`

PR [#23035](https://github.com/vitejs/vite/pull/23035) / [`95a3cda`](https://github.com/vitejs/vite/commit/95a3cdab83e1125b03d2e8dd942fb6b64209e5fa): entry — часть module graph, поэтому `resolveServerOptions` добавляет пути `input` в `server.fs.allow` через `getInputPaths()`. Если `input` не задан, в allow уходит default `index.html` относительно root.

```ts
// resolveConfig → resolveServerOptions(root, server, input, logger)
// allowDirs.push(...getInputPaths(root, input))
```

Кого касается: monorepo и backend-integration, где entry лежит вне прежних allow-dir — меньше сюрпризов «file is outside of Vite serving allow list».

## Bundled dev: client-side HMR, один reload, worker updates

В 8.2 bundled dev (`experimental.bundledDev` / `--experimental-bundle`) заметно переработан.

### Client-side HMR boundaries ([#22961](https://github.com/vitejs/vite/pull/22961))

Вместо server-driven `js-update` с precomputed boundaries клиент получает payload:

```ts
interface BundledDevUpdatePayload {
  type: "bundled-dev-update";
  changedIds: string[];
  url: string; // per-client HMR patch chunk
  seq: number;
}
```

Границы acceptance считаются в браузере по runtime-состоянию. Документация в `ExperimentalOptions` фиксирует два отличия от middleware-dev:

1. `import.meta.hot.accept()` учитывается только если **выполнился** — accept в dead branch не гасит update и падает в full reload.
2. `hot.invalidate()` обрабатывается **полностью на клиенте**.

Внутренний custom event сменился: `vite:module-loaded` → `vite:client-connected` (только `clientId`). Клиентский entry для bundled mode вынесен в `dist/client/bundledDevClient.mjs` (`BUNDLED_DEV_CLIENT_ENTRY`).

### Один reload после rebuild ([#23106](https://github.com/vitejs/vite/pull/23106))

Раньше client мог сам дернуть `pageReload` и попасть на bundling-fallback HTML, а потом ещё раз — на готовый bundle. Теперь:

1. клиент шлёт `vite:bundled-dev:reload-needed` с `reason`;
2. сервер дожидается rebuilt output и только потом шлёт `full-reload`;
3. initial build completion шлёт `full-reload` с `ifFallback: true` — обычные страницы игнорируют, реагирует только fallback page (`globalThis.__vite_is_fallback_page__`).

Тест playground: document load ровно один, без `__vite_is_fallback_page__` в финальной навигации.

### Worker file update при HMR accept ([#23068](https://github.com/vitejs/vite/pull/23068))

Баг: правка worker source при importer-e с `import.meta.hot.accept()` (типичный React Fast Refresh) оставляла старый worker; запрос нового файла отдавал SPA HTML (`text/html`), browser worker падал с пустым `error`.

Фикс: worker bundle эмитится уже на `load`/`transform` (HMR patch не проходит через `generateBundle`). Покрыты `new Worker(new URL(...))`, `?worker` и nested worker.

Дополнительно в beta/stable bundled-dev:

- build errors при failed HMR печатаются в terminal ([#23024](https://github.com/vitejs/vite/pull/23024));
- `import.meta.hot.data` сохраняется across updates (playground `data.js`).

## `PostcssUserConfig`: type-safe `postcss.config.*`

PR [#22792](https://github.com/vitejs/vite/pull/22792) / [`302c755`](https://github.com/vitejs/vite/commit/302c755a8125b9a26214e3b413922b5513e41981) реэкспортирует shape PostCSS config из той же `postcss-load-config`, которой Vite реально грузит конфиг:

```ts
// packages/vite/src/node/plugins/css.ts
export type { Config as PostcssUserConfig } from "postcss-load-config";
```

```ts
// postcss.config.ts
import type { PostcssUserConfig } from "vite";

const config: PostcssUserConfig = {
  map: false,
  plugins: {
    "postcss-preset-env": {},
  },
};

export default config;
```

Dtslint проверяет `Equal<PostcssUserConfig, PostcssLoadConfig>`. Закрывает [#19109](https://github.com/vitejs/vite/issues/19109).

## Network URL с именем интерфейса

PR [#22830](https://github.com/vitejs/vite/pull/22830) + follow-up [#22965](https://github.com/vitejs/vite/pull/22965): при `vite --host` список Network больше не «голые» IP.

```text
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://172.18.0.1:5173/     eth0
  ➜  Network: http://10.0.0.2:5173/       wlan0
  ➜  Network: http://192.168.1.5:5173/    vEthernet (WSL (Hyp…
```

Реализация: `resolveServerUrls` собирает parallel-массив `networkInterfaceNames` из ключей `os.networkInterfaces()`; `printServerUrls` выравнивает колонку и режет имена длиннее 20 символов с `…`. Для явного `--host 192.168.1.10` имя интерфейса резолвится reverse-lookup по IP ([#22965](https://github.com/vitejs/vite/pull/22965)); если IP не совпал ни с одним iface — annotation опускается.

## Optimizer: lockfile `aube` и `nub`

В `lockfileFormats` (`packages/vite/src/node/optimizer/index.ts`):

| lockfile         | manager | patches dir                                                     |
| ---------------- | ------- | --------------------------------------------------------------- |
| `aube-lock.yaml` | aube    | нет ([#22813](https://github.com/vitejs/vite/pull/22813))       |
| `nub.lock`       | nub     | `patches` ([#22891](https://github.com/vitejs/vite/pull/22891)) |

Без этого смена зависимостей через [Aube](https://aube.jdx.dev/) / [nub](https://github.com/nubjs/nub) не инвалидировала FS-cache pre-bundle (`node_modules/.vite`). Docs `dep-pre-bundling.md` обновлены. Perf [#22909](https://github.com/vitejs/vite/pull/22909): популярные lockfile проверяются первыми, меньше stat-вызовов.

## WASM: unwrap `WebAssembly.Global` и JS string builtins

PR [#22674](https://github.com/vitejs/vite/pull/22674) развивает прямой `.wasm` import из 8.1:

1. **Two-layer module split** — instance-слой отдаёт exports as-is (`WebAssembly.Global` объекты для wasm↔wasm global imports); user-facing `.wasm` module unwrap'ает `.value` для JS. `v128` globals, у которых нет JS value, остаются `undefined` (try/catch вокруг `.value`).
2. **Compile/instantiate options**: `builtins: ['js-string']` + imported string constants — в духе spec/Node.

Прямой импорт по-прежнему async (top-level await). `?init` не убирали.

## Подготовка к `configLoader: 'native'`

PR [#22850](https://github.com/vitejs/vite/pull/22850) при `configLoader: 'bundle'` (default) сканирует конфиг на фичи, которые **сломаются**, когда native loader станет default:

- `__dirname` / `__filename` → `import.meta.dirname` / `import.meta.filename`
- extensionless import (`./helper` вместо `./helper.js`)
- directory index import (`./plugins` → `./plugins/index.js`)
- JSON import без `with { type: 'json' }`
- ESM syntax inside CJS config package

Пример warning:

```text
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - `__dirname` (vite.config.js:3:29). Use `import.meta.dirname` instead
  - import "./helper" without a file extension (vite.config.js:1:1). Add the file extension
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

[#23064](https://github.com/vitejs/vite/pull/23064) добавляет **column** в location (`file:line:column`, 1-based) — терминалы линкуют точнее. [#23000](https://github.com/vitejs/vite/pull/23000): при `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` compat-check пропускается целиком (perf). Virtual modules из native check исключены ([#22979](https://github.com/vitejs/vite/pull/22979)).

## Заметные bug fixes

Не полный список — то, что меняет runtime-поведение:

| Fix                                                                        | Что было / что стало                                                                                                                                  |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#22947](https://github.com/vitejs/vite/pull/22947) `chunkImportMap` + CSS | CSS deps в import map получали hashed URL → CSS-only change портил preload parent chunk; теперь stable CSS specifier в import map                     |
| [#22992](https://github.com/vitejs/vite/pull/22992) HMR × server restart   | race: in-flight HMR держал snapshot environments, а после await ходил в уже новые `server.environments`                                               |
| [#23029](https://github.com/vitejs/vite/pull/23029) importAnalysis         | плагины вроде `@rollup/plugin-inject`, инжектящие imports в optimized dep files, ломали named export interop (`Buffer` и т.п.) — vitest browser hangs |
| [#22832](https://github.com/vitejs/vite/pull/22832)                        | `root` резолвится в real path (symlink-safe)                                                                                                          |
| [#22983](https://github.com/vitejs/vite/pull/22983) CSS                    | rewrite urls в content, inject'нутый PostCSS `OnceExit`                                                                                               |
| [#23002](https://github.com/vitejs/vite/pull/23002) HMR                    | `hot` data снимается после prune                                                                                                                      |
| [#23073](https://github.com/vitejs/vite/pull/23073) module-runner          | stack trace interception живёт при frozen `Object.prototype`                                                                                          |
| [#22932](https://github.com/vitejs/vite/pull/22932) server                 | strip `base` в indexHtml module graph lookup                                                                                                          |
| [#23101](https://github.com/vitejs/vite/pull/23101)                        | top-level `input` резолвится через plugin `resolveId` (virtual entries)                                                                               |
| [#22893](https://github.com/vitejs/vite/pull/22893) SSR                    | declarations в `switch` scoping'атся к switch, не к function                                                                                          |

Также в 8.2.x линии (через patch-релизы 8.1.1–8.1.5, вошедшие в историю до stable 8.2.0): preload CSS для nested dynamic imports, oxc как preferred minifier в plugin-legacy, invert `esbuild.jsxSideEffects` → `oxc.jsx.pure`, и т.д. — см. changelog, если обновляетесь с раннего 8.1.0.

## Docs / misc

- `@experimental` снят с `resolve.tsconfigPaths` JSDoc ([#23006](https://github.com/vitejs/vite/pull/23006)).
- Уточнено default fallback описание `cacheDir` ([#23060](https://github.com/vitejs/vite/pull/23060)).

## Кому обновляться

- **Multi-page / backend / lib / non-HTML entry** — переезжайте на top-level `input`, уберите дубли в `build.rolldownOptions.input` / `optimizeDeps.entries`.
- **`experimental.bundledDev`** — 8.2 чинит workers + reload UX; имеет смысл перепроверить HMR (особенно dead-branch accept и `hot.invalidate`).
- **PostCSS в TS** — `PostcssUserConfig` из `vite`.
- **Aube / nub** — optimizer cache наконец слушает их lockfile.
- **Прямые `.wasm` imports с globals / js-string** — поведение ближе к platform.
- **Все с vite.config** — прочитайте native-loader warnings заранее, пока default ещё bundle.

Breaking changes в semver-смысле minor не анонсировал: `build.lib.entry` стал optional (additive), warnings — soft signal.

## Как обновиться

```bash
pnpm add -D vite@8.2.0
# или
npm install -D vite@8.2.0
```

После обновления:

1. если entry задан только в `build.rolldownOptions.input` — перенесите в top-level `input` (dev+optimizer получат тот же entry);
2. прогоните `vite` и посмотрите native-compat warning по конфигу;
3. при `experimental.bundledDev` — smoke-test HMR, workers и full reload;
4. production build с `build.chunkImportMap`, если пользуетесь — проверьте CSS preload.

## Ссылки

- [Release v8.2.0](https://github.com/vitejs/vite/releases/tag/v8.2.0)
- [CHANGELOG.md @ v8.2.0](https://github.com/vitejs/vite/blob/v8.2.0/packages/vite/CHANGELOG.md)
- [Compare v8.1.0...v8.2.0](https://github.com/vitejs/vite/compare/v8.1.0...v8.2.0)
- [feat: add `input` option #22642](https://github.com/vitejs/vite/pull/22642)
- [feat: client-side HMR in bundled-dev #22961](https://github.com/vitejs/vite/pull/22961)
- [feat(css): export PostcssUserConfig #22792](https://github.com/vitejs/vite/pull/22792)

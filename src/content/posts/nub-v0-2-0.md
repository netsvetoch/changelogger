---
author: Артём Нецветаев
pubDatetime: 2026-06-28T19:53:02.000Z
title: "Nub 0.2.0: Web Worker для Node, WPT-harness и более совместимый package manager"
slug: nub-v0-2-0
featured: false
draft: false
tags:
  - release
  - nub
  - nodejs
  - tooling
description: "Обзор минорного релиза Nub v0.2.0: браузерный Worker поверх stock Node, inline data/blob workers, WPT-проверки, исправления pnpm/yarn/bun-совместимости, Docker-образы и Homebrew tap."
---

Nub выпустил минорный релиз [`v0.2.0`](https://github.com/nubjs/nub/releases/tag/v0.2.0). В отличие от предыдущего `v0.1.0`, GitHub Release здесь достаточно подробный, но ключевые места я всё равно сверил с PR: worker-поверхность — с [#99](https://github.com/nubjs/nub/pull/99) и [#119](https://github.com/nubjs/nub/pull/119), package manager — с [#104](https://github.com/nubjs/nub/pull/104), [#115](https://github.com/nubjs/nub/pull/115), [#116](https://github.com/nubjs/nub/pull/116), [#130](https://github.com/nubjs/nub/pull/130) и [#131](https://github.com/nubjs/nub/pull/131).

Главная идея релиза: Nub добавляет web-standard `Worker` в обычный установленный Node без отдельного runtime API. Это именно браузерная форма `new Worker(...)`, `postMessage`, `onmessage`, `MessageEvent` и `ErrorEvent`, реализованная как полифилл поверх `node:worker_threads` и загружаемая только когда в Node ещё нет своего глобального `Worker`.

## `new Worker(...)` теперь выглядит как в браузере

PR [#99](https://github.com/nubjs/nub/pull/99) расширяет `runtime/worker-polyfill.mjs` и типы `@nubjs/types`: у main-side объекта появляется `readonly name`, `terminate()` возвращает `undefined`, а не Node-подобный `Promise`, и убран не-web event `exit`. Сообщения приходят как настоящие `MessageEvent`; ошибки worker-а поднимаются как `ErrorEvent` с заполненными `filename`, `lineno` и `colno`, а не с пустой локацией.

Минимальный сценарий теперь совпадает с web-кодом:

```ts
const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
  name: "pricer",
});

console.log(worker.name); // "pricer"
worker.postMessage({ n: 41 });
worker.onmessage = event => console.log(event.data); // 42
```

```ts
// worker.ts — запускается напрямую, без отдельной сборки
console.log(self.name); // "pricer"
self.onmessage = event => self.postMessage(event.data.n + 1);
```

Важная практическая деталь для TypeScript/JSX: worker entry проходит через обычную Nub-транспиляцию. То есть `new Worker(new URL("./worker.ts", import.meta.url))` не требует предварительного `tsc`/bundler step.

## Inline workers: `data:` и `blob:` URL

До этого у Node был `node:worker_threads`, но не браузерный конструктор с inline-источниками. В `v0.2.0` Nub поддерживает оба web-механизма:

```ts
const worker = new Worker(
  "data:text/javascript," + encodeURIComponent("self.postMessage('ok')")
);

worker.onmessage = event => console.log(event.data); // "ok"
```

Для `blob:` PR [#99](https://github.com/nubjs/nub/pull/99) добавляет отдельный `runtime/worker-blob-url.cjs`. Он ставится eager в preload, потому что исходник Blob нужно синхронно захватить в момент `URL.createObjectURL(blob)`, ещё до `new Worker(blobUrl)`. Сам тяжёлый `worker_threads` при этом остаётся lazy-loaded на первом worker-е, чтобы не ухудшать cold start обычных программ.

## Classic workers и `importScripts(...)`

Nub сохраняет свой documented default `type: "module"`, но теперь явно поддерживает `type: "classic"`. В classic worker доступен синхронный `importScripts(...)`; в module worker тот же вызов должен бросать ошибку, и это закреплено тестами из PR [#99](https://github.com/nubjs/nub/pull/99).

```ts
const worker = new Worker(new URL("./classic-worker.cjs", import.meta.url), {
  type: "classic",
});
```

```js
// classic-worker.cjs
importScripts("./classic-dep.cjs");
self.postMessage(globalThis.NUB_DEP);
```

В релиз не входят `SharedWorker` и `ServiceWorker`, а Node/Bun-расширения вроде `ref()` / `unref()` специально не добавлены: PR позиционирует поверхность как WHATWG/Cloudflare-compatible, а не как Bun parity.

## WPT-harness вместо ручных smoke-тестов Worker

PR [#119](https://github.com/nubjs/nub/pull/119) добавляет production harness в `tests/worker-wpt/harness/` и отдельный workflow `.github/workflows/wpt-worker.yml`. Он запускает vendored slice web-platform-tests через настоящий Nub runtime: polyfilled `Worker`, `MessageChannel`, `MessagePort`, `MessageEvent` и `structuredClone` являются именно теми глобалами, которые проверяются.

Зафиксированный срез WPT — 24 `.any.js` файла на коммите `80b7ba49`: webmessaging, structured-clone через `MessageChannel` и worker-scope event tests. Результат, указанный в PR: 165 subtests pass, 21 expected-fail, 0 unexpected-fail, 3 skipped files. Matrix покрывает compat-tier Node 18.19/20 и fast-tier 22.15+/24; в описании PR также сверяли fast-tier 26.

Harness поймал не косметический баг: cloned `Blob` не проходил `instanceof Blob`, а `new Response(clonedBlob).arrayBuffer()` отдавал строку `"[object Blob]"`. Исправление — заменить subclass-обёртку `Blob` на `Proxy` над native Blob, сохранив identity/prototype для `instanceof` и brand-check в undici, но оставив construct trap для сборки `blob:` worker source.

## Package manager: меньше несовместимости с pnpm, yarn и bun

В package-manager части релиз закрывает несколько конкретных crash/compat сценариев.

- [#130](https://github.com/nubjs/nub/pull/130): Yarn Berry catalogs теперь читаются из `.yarnrc.yml`. `catalog:` и `catalog:<name>` больше не падают как unsupported specifier в yarn-berry проекте; Yarn classic v1 по-прежнему отказывается, потому что catalogs там нет. Nub не запускает yarn binary для version detection и не пишет `yarn.lock` — resolution остаётся read-only.
- [#131](https://github.com/nubjs/nub/pull/131): Yarn-поля `npmMinimalAgeGate` и `npmPreapprovedPackages` мапятся в engine-настройки `minimumReleaseAge` и `minimumReleaseAgeExclude`. Число `1440` остаётся минутами, `7d` превращается в `10080`, а `30s` округляется вверх до `1`, чтобы ненулевой security gate не стал нулём. В том же PR убрали выдуманный future-gate про bun 10: `trustedDependencies` теперь учитывается для bun без искусственного major-фильтра.
- [#115](https://github.com/nubjs/nub/pull/115): для versionless workspace members в `pnpm-lock.yaml` Nub пишет `version: link:../../packages/foo`, а не `0.0.0`. До исправления stock pnpm мог отклонить такой lockfile на frozen install с `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY`.
- [#104](https://github.com/nubjs/nub/pull/104): audit pnpm v11.9.0 привёл к двум исправлениям. Во-первых, registry HTTP errors больше не печатают credentials из URL (`user:pass@`, `?token=`, `_auth`); redaction стоит и в aube-registry, и в выходном choke point Nub. Во-вторых, `minimumReleaseAgeExclude` теперь понимает version-pinned entries вроде `axios@0.21.1` и union `name@v1 || v2`, а не только bare package name.
- [#116](https://github.com/nubjs/nub/pull/116): `packageManager: "pnpm@https://github.com/pnpm/pnpm"` больше не отправляет URL в semver parser с ошибкой `unexpected character 'h'`; URL/git form трактуется как name-only, как у Corepack/pnpm. Там же store open перестал требовать `HOME`, если задан `storeDir`, и начал уважать configured `cacheDir` для packument/index cache.

Отдельно runtime fix [#98](https://github.com/nubjs/nub/pull/98) чинит fast-tier конфликт с async loader-ами: Next 16 + Tailwind v4 + Turbopack падали на `resolveSync() method is not implemented`, когда Tailwind регистрировал async ESM loader. Nub теперь ловит именно `ERR_METHOD_NOT_IMPLEMENTED` при активном user async loader и short-circuit-ит через parent CommonJS resolver; compat-tier этот путь не затрагивает.

## Docker и Homebrew становятся частью distribution story

PR [#108](https://github.com/nubjs/nub/pull/108) добавляет официальные Dockerfiles: `docker/Dockerfile.slim` на `node:26-slim` и `docker/Dockerfile.alpine` на `node:26-alpine`. Внутри Nub ставится через `npm install -g @nubjs/nub`, потому что Nub не заменяет Node, а дополняет установленный Node. Alpine-вариант добавляет `libgcc` и `libstdc++` для native N-API addon; оба образа запускаются от non-root `node` user, используют `tini` как PID 1 и проходят smoke: `nub --version`, запуск TS-файла и package-manager install с `require()`.

Для Homebrew два PR закрывают разные стороны. [#121](https://github.com/nubjs/nub/pull/121) добавляет генератор `.github/scripts/gen-homebrew-formula.sh`, job `bump-homebrew-tap` в release workflow и документацию для:

```bash
brew install nubjs/tap/nub
```

Генератор берёт sha256 из sidecar assets релиза для четырёх Homebrew-платформ (`darwin-arm64`, `darwin-x64`, `linux-arm64`, `linux-x64`), а не пересчитывает их локально. [#125](https://github.com/nubjs/nub/pull/125) затем делает `brew test` Node-free: вместо запуска `nub hello.ts` test проверяет, что в formula установлен runtime tree (`runtime/preload.mjs` и `runtime/addons/nub-native.node`). Это важно, потому что Nub не бандлит Node, а чистое окружение `brew test` может не иметь `node` в `PATH`.

## Сборка: меньше лишнего в CLI binary

Два build PR в релизе уменьшают и упрощают CLI binary без изменения пользовательского API.

[#112](https://github.com/nubjs/nub/pull/112) выносит `crates/nub-native` в отдельный Cargo workspace. Причина не организационная, а профильная: N-API addon должен оставаться `panic = "unwind"`, чтобы panic не убивал host Node process, а CLI binary может собираться с `panic = "abort"`. На macOS/arm64 release binary `nub` в измерениях PR уменьшился с 43,523,424 до 38,079,200 байт — минус 5.19 MiB, в основном за счёт unwind metadata и landing-pad codegen.

[#110](https://github.com/nubjs/nub/pull/110) отключает default features у embedded `aube` dependency: `config-tui` и aube-side `mimalloc` не используются Nub CLI. В результате из dependency graph уходят `ratatui`, `crossterm` и связанные пакеты, а measured release binary на darwin-arm64 стал меньше примерно на 296 KiB.

## Документация Node tier-ов

Коммиты [`7a67d39`](https://github.com/nubjs/nub/commit/7a67d39e09837bfdbacf6d262037a581d9faaa38) и [`5edbf338`](https://github.com/nubjs/nub/commit/5edbf3383a73249bb63b4567d21b14d9f3f6ab53) обновляют `/docs/runtime`: теперь там есть таблица по major-линейкам Node 18/20/22/23/24/25/26, hard floor `18.19`, fast-tier boundary `22.15` / `23.5`, и рекомендация показывать latest Node major в примерах. Отдельный callout фиксирует цену compatibility tier: примерно `1.4×` slower cold start, около `80 ms` fixed cost плюс `90 µs` на module, без runtime cost после старта.

## Что это значит для пользователей Nub

Если вы пробуете Nub как drop-in `node`/package-manager CLI, `v0.2.0` делает две вещи. Во-первых, можно писать web-shaped worker code без отдельной обвязки вокруг `node:worker_threads`, включая TS worker entries, inline `data:`/`blob:` workers, `MessageChannel`, `BroadcastChannel` и classic `importScripts`. Во-вторых, меньше шансов упереться в несовместимость на реальных lockfile/config случаях: Yarn catalogs и min-age gates, pnpm workspace members без version, redaction credential errors, `packageManager` URL form и no-`HOME` containers.

Для обновления npm-пакета:

```bash
npm install -g --ignore-scripts=false @nubjs/nub@0.2.0
nub --version
```

А для контейнера теперь есть документированный путь поверх Node 26:

```dockerfile
FROM node:26-slim
RUN npm install -g @nubjs/nub@0.2.0
```

Релиз минорный (`0.2.0`), поэтому пост не помечен как featured.

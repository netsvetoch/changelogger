---
author: Артём Нецветаев
pubDatetime: 2026-08-03T21:21:32.000Z
title: "Next.js 16.3.0: Partial Prefetching, стабильные instant/prefetch/io/catchError и Node streams по умолчанию"
slug: next-v16-3-0
featured: false
draft: false
tags:
  - release
  - nextjs
  - react
  - turbopack
  - cache-components
  - frontend
description: "Минор Next.js 16.3.0: partialPrefetching и App Shells, стабилизация instant/prefetch/io/catchError/retry, Node streams always-on, experimental.useOffline, Turbopack import.meta.glob и FS cache, deprecation Edge Runtime."
---

Вышел минор [`v16.3.0`](https://github.com/vercel/next.js/releases/tag/v16.3.0) (3 августа 2026) фреймворка [Next.js](https://nextjs.org/). В `packages/next/package.json` на теге — `16.3.0`. GitHub Release — полный changelog (Core / Documentation / Examples / Misc), без отдельного announcement-поста: ниже разбор по release body, docs на теге и связанным PR.

Объём огромный (сотни core-пунктов, много Turbopack internals). Статья собирает **user-facing** контракт: Cache Components / Partial Prefetching / App Shells, стабилизацию API, defaults, config/CLI, Turbopack-фичи, deprecation'ы и security. Compare: [`v16.2.0...v16.3.0`](https://github.com/vercel/next.js/compare/v16.2.0...v16.3.0).

## Главное за 30 секунд

- **Partial Prefetching** — top-level `partialPrefetching: true` (+ route segment `export const prefetch`) и **App Shell** как единица prefetch вместо полного dynamic payload на каждый `<Link>`.
- Стабилизированы **`export const instant`**, **`export const prefetch`**, **`io()`** из `next/cache`, **`catchError` / `retry`** из `next/error` (без `unstable_` alias).
- При `cacheComponents` по умолчанию включаются связанные experimental-флаги: `cachedNavigations`, `optimisticRouting`, `varyParams`, `appShells` (часть стека «Sparkle»).
- **Node.js streams** для App Router на Node — always-on; флаг `experimental.useNodeStreams` убран.
- **Experimental offline**: `experimental.useOffline` + `useOffline()` из `next/offline`.
- Turbopack: **`import.meta.glob`**, **`import.meta.env`**, filesystem cache for build **по умолчанию**, server HMR для route handlers/metadata, путь HMR `/_next/hmr`.
- Deprecation: **Edge Runtime** и `preferredRegion`; middleware → proxy с codemod в warning; `experimental.useCache` / `dynamicIO` → `cacheComponents`.
- Security: vendored lodash **4.17.23** (CVE-2025-13465).

## Partial Prefetching и App Shells

### Глобальный флаг `partialPrefetching`

PR [#94448](https://github.com/vercel/next.js/pull/94448), docs `partialPrefetching.mdx` (version history: **16.3.0**). Top-level опция, требует `cacheComponents`:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
```

Без `cacheComponents` `next dev` / `next build` падают на валидации конфига.

**Было (упрощённо):** prefetch масштабировался с числом видимых ссылок — N ссылок ≈ N route-prefetch'ей; `<Link prefetch={true}>` тянул и dynamic data.

**Стало:** один переиспользуемый **App Shell** на filesystem-route (output минус per-link runtime data: `params` / `searchParams` / full URL). Shell кэшируется на клиенте; конкретные params дозаполняются после navigation или при runtime prefetch. Серверная часть shell-prefetch — [#93998](https://github.com/vercel/next.js/pull/93998), клиентский scheduler (фаза `Shell` между `RouteTree` и speculative segments) — [#93999](https://github.com/vercel/next.js/pull/93999). При `cacheComponents` **`experimental.appShells` включается по умолчанию** ([#94516](https://github.com/vercel/next.js/pull/94516)); позже флаг unified с Partial Prefetching ([#95415](https://github.com/vercel/next.js/pull/95415)).

`<Link prefetch={true}>` при включённом Partial Prefetching дополнительно резолвит per-link runtime data. Если `prefetch={true}` ведёт на route **без** Partial Prefetching, в dev — console error + Insight ([#94672](https://github.com/vercel/next.js/pull/94672), message `instant-link-prefetch-partial`): включите global flag или per-route `prefetch = 'partial'`.

### Route segment config `export const prefetch` (stable)

PR [#92754](https://github.com/vercel/next.js/pull/92754) (отвязка runtime prefetch от `instant`), [#92859](https://github.com/vercel/next.js/pull/92859), стабилизация [#94571](https://github.com/vercel/next.js/pull/94571). Docs на теге:

```ts
type Prefetch = "auto" | "partial" | "force-disabled";

// page.tsx / layout.tsx — только Server Component + cacheComponents
export const prefetch: Prefetch = "partial";
```

| Значение           | Смысл                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'partial'`        | Opt-in Partial Prefetching **на сегмент** без global flag (инкрементальная миграция). Default links → App Shell; `prefetch={true}` → + runtime data. |
| `'force-disabled'` | Не prefetch'ить segment data (auth-only / редкие страницы). Metadata route всё ещё может подтягиваться.                                              |
| `'auto'`           | Дефолт фреймворка; **не пишите явно** — эквивалент отсутствию export.                                                                                |

На canary временно жили `force-static` / `force-runtime` → rename в `allow-runtime` ([#94568](https://github.com/vercel/next.js/pull/94568)); **финальный public surface на теге** — таблица выше из docs.

`prefetch = 'partial'` ставьте на **destination** segment, не на link. Когда все нужные routes мигрированы — включайте global `partialPrefetching` и снимайте per-route exports (есть codemod `remove-partial-prefetch` в `@next/codemod`).

## `export const instant` (stable)

Стабилизация [#94578](https://github.com/vercel/next.js/pull/94578). Docs `instant.mdx`:

```tsx
// layout.tsx | page.tsx
export const instant = true;
// или
export const instant = { level: "warning" };
// opt-out blocking ancestor:
export const instant = false;
```

- Работает только с `cacheComponents`, не в Client Components.
- `true` / object — validation, что navigation в сегмент даёт instant UI (нет uncached IO выше Suspense / без `"use cache"`).
- `level: 'warning'` — dev-only overlay; build не ломается. Future build-level — experimental.
- Global default validation: `experimental.instantInsights.validationLevel` — `'warning'` (все Page/Default) или `'manual-warning'` (только explicit `instant`).
- Navigation validation **включена по умолчанию** ([#94312](https://github.com/vercel/next.js/pull/94312)); draft mode отключает ([#93472](https://github.com/vercel/next.js/pull/93472)).
- Dev validation может уезжать на worker thread: `experimental.devValidationWorker` ([#96150](https://github.com/vercel/next.js/pull/96150), [#96153](https://github.com/vercel/next.js/pull/96153)) — меньше starvation event loop при быстрых nav.

Тестовый helper `instant()` (Navigation Inspector / testing lock) в dev рендерит **только shell**, если на Link нет `prefetch` prop ([#95150](https://github.com/vercel/next.js/pull/95150)) — чтобы assertions не ловили production-недоступные dynamic bytes.

## `io()` из `next/cache` (stable)

Путь: experimental `unstable_io` + flag ([#92521](https://github.com/vercel/next.js/pull/92521)) → снятие gate ([#92923](https://github.com/vercel/next.js/pull/92923)) → rename без `unstable_` ([#93621](https://github.com/vercel/next.js/pull/93621)). Export в `packages/next/cache.d.ts`: `export { io }`.

```tsx
import { Suspense } from "react";
import { io } from "next/cache";

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <CurrentTime />
    </Suspense>
  );
}

async function CurrentTime() {
  await io(); // hanging promise на prerender → вне static shell
  return <p>{new Date().toISOString()}</p>;
}
```

Client Component (SSR prerender):

```tsx
"use client";
import { use } from "react";
import { io } from "next/cache";

export function CurrentTime() {
  use(io());
  return <div>{Date.now()}</div>;
}
```

Смысл: явно отделить sync IO (`Date`, `Math.random`, `crypto.randomUUID`, sync DB) от static shell. В request path / без Cache Components / внутри `"use cache"` — no-op / immediate.

## `catchError` и `retry` (stable)

PR [#94610](https://github.com/vercel/next.js/pull/94610) / re-land [#94623](https://github.com/vercel/next.js/pull/94623). **Breaking rename** относительно 16.2 canary surface: `unstable_catchError` → `catchError`, prop `unstable_retry` → `retry`. **Обратного alias нет.**

```tsx
"use client";
import { catchError, type ErrorInfo } from "next/error";

function ErrorFallback(props: { title: string }, { error, retry }: ErrorInfo) {
  return (
    <div>
      <h2>{props.title}</h2>
      <p>{error.message}</p>
      <button onClick={() => retry()}>Try again</button>
    </div>
  );
}

export default catchError(ErrorFallback);
```

`catchError` — programmatic error boundary (альтернатива `error.js`): framework-aware к `redirect()` / `notFound()`, `retry()` внутри Transition, clear state на client navigation. Только Client Components.

## Defaults вокруг Cache Components

| Опция / поведение                  | Изменение                                                                                                                                                                                                                                                         | PR                                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `experimental.varyParams`          | default **on**                                                                                                                                                                                                                                                    | [#94010](https://github.com/vercel/next.js/pull/94010)                                                         |
| `experimental.optimisticRouting`   | default **on**                                                                                                                                                                                                                                                    | [#94011](https://github.com/vercel/next.js/pull/94011)                                                         |
| `experimental.cachedNavigations`   | default **on** при `cacheComponents`                                                                                                                                                                                                                              | [#94012](https://github.com/vercel/next.js/pull/94012)                                                         |
| `experimental.appShells`           | default **on** при `cacheComponents`                                                                                                                                                                                                                              | [#94516](https://github.com/vercel/next.js/pull/94516)                                                         |
| `partialFallbacks`                 | сначала default on ([#92627](https://github.com/vercel/next.js/pull/92627)), затем **флаг удалён** ([#93859](https://github.com/vercel/next.js/pull/93859)); behavior later gated с `partialPrefetching` ([#96074](https://github.com/vercel/next.js/pull/96074)) |
| `prefetchInlining`                 | **enabled by default** ([#92863](https://github.com/vercel/next.js/pull/92863))                                                                                                                                                                                   |
| `rootParams`                       | **enabled by default**, flag removed ([#93863](https://github.com/vercel/next.js/pull/93863)); types `.next/types/root-params.d.ts` ([#91019](https://github.com/vercel/next.js/pull/91019))                                                                      |
| Node streams                       | default on ([#94311](https://github.com/vercel/next.js/pull/94311)), затем **flag removed** ([#93938](https://github.com/vercel/next.js/pull/93938))                                                                                                              |
| `turbopackFileSystemCacheForBuild` | **default on** (opt-out `false`; в non-Vercel CI поведение см. PR)                                                                                                                                                                                                | [#96395](https://github.com/vercel/next.js/pull/96395), [#96493](https://github.com/vercel/next.js/pull/96493) |
| TypeScript CLI checker в build     | **default on** (`experimental.useTypeScriptCli: false` — opt-out)                                                                                                                                                                                                 | [#96497](https://github.com/vercel/next.js/pull/96497)                                                         |
| New scroll handler                 | default on; opt-out `experimental.appNewScrollhandler` на preview                                                                                                                                                                                                 | [#95378](https://github.com/vercel/next.js/pull/95378)                                                         |
| `validateRSCRequestHeaders`        | default on                                                                                                                                                                                                                                                        | [#93367](https://github.com/vercel/next.js/pull/93367)                                                         |

**Partial fallbacks (поведение):** для routes с частичным `generateStaticParams` первый hit неизвестных params получает лучший доступный shell, затем background revalidation с конкретными params — последующие запросы получают более specific cache (full static или upgraded shell + stream).

## Node.js streams always-on

После [#94311](https://github.com/vercel/next.js/pull/94311) + [#93938](https://github.com/vercel/next.js/pull/93938) rendering App Router на **Node** идёт через Node streams; `__NEXT_USE_NODE_STREAMS` зашит true для node bundles, false для edge. Public `experimental.useNodeStreams` больше нет — web-streams path для Node CC вычищен. Edge по-прежнему web streams.

Практический смысл: меньше расхождений dev/prod streaming, server-inserted HTML и forkpoints resume/error recovery завязаны на node stream pipeline (серия PR «Node.js streams: …» в changelog).

## Experimental offline: `useOffline`

Config + hook ([#92011](https://github.com/vercel/next.js/pull/92011), [#92012](https://github.com/vercel/next.js/pull/92012)), docs `useOffline.mdx` / guide `offline-support.mdx`:

```js
// next.config.js
module.exports = {
  cacheComponents: true,
  partialPrefetching: true, // recommended: shell offline-ready
  experimental: {
    useOffline: true,
  },
};
```

```tsx
"use client";
import { useOffline } from "next/offline";

export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;
  return <div role="status">You are offline…</div>;
}
```

Без флага hook всегда `false`. С флагом:

- browser `offline`/`online` + failed navigation/prefetch/Server Action fetch → offline state;
- HEAD poll к current URL с RSC header (timeout 200 ms), backoff 0.5→1→2→3 s;
- framework requests ждут connectivity и **один** retry;
- userland `fetch` / React Query / SWR — свои политики.

Хорошо сочетается с App Shell prefetch: shell уже на клиенте → soft nav offline показывает shell + loading, а не hard fail.

## `router.bfcacheId` — opt-out state preservation

PR [#93633](https://github.com/vercel/next.js/pull/93633). При Cache Components inactive routes живут в React `<Activity>` — ephemeral UI state (forms, expand/collapse) сохраняется между nav. Чтобы **сбрасывать** state на fresh push/replace, но сохранять на back/forward / `refresh` / searchParams-only:

```tsx
"use client";
import { useRouter } from "next/navigation";

export default function Page() {
  const { bfcacheId } = useRouter();
  return <form key={bfcacheId}>{/* ... */}</form>;
}
```

Id scoped к текущему segment (layout vs page).

## Turbopack: user-facing

### `import.meta.glob` (Vite-compat)

PR [#92640](https://github.com/vercel/next.js/pull/92640). Compile-time glob → map path → lazy `() => import(...)` или eager require:

```ts
// lazy (default)
const modules = import.meta.glob("./posts/**/*.md");

// options include eager, caseSensitive (#96226), negative patterns with !
const eager = import.meta.glob("./components/**/*.tsx", { eager: true });
```

Также [#96225](https://github.com/vercel/next.js/pull/96225): **`import.meta.env`**. По умолчанию включён **`import with { type: 'text' }`** ([#95606](https://github.com/vercel/next.js/pull/95606)).

### Filesystem cache, HMR, CLI

- **Build FS cache default on** — warm `next build` быстрее; opt-out `experimental.turbopackFileSystemCacheForBuild: false`.
- **Server HMR** для app route handlers ([#91466](https://github.com/vercel/next.js/pull/91466)), metadata routes ([#93110](https://github.com/vercel/next.js/pull/93110)); WebSocket path **`/_next/webpack-hmr` → `/_next/hmr`** ([#91415](https://github.com/vercel/next.js/pull/91415)) — важно для reverse-proxy allowlists.
- HMR reconnect after sleep/wake ([#91416](https://github.com/vercel/next.js/pull/91416)); CSS HMR Safari fix ([#92123](https://github.com/vercel/next.js/pull/92123)).
- `next internal post-build` — отдельная compaction Turbopack DB ([#91336](https://github.com/vercel/next.js/pull/91336)):

```sh
NEXT_USE_POST_BUILD=1 next build
next internal post-build
```

- `turbopack-cli --persistent-caching` ([#91657](https://github.com/vercel/next.js/pull/91657)); `NEXT_TURBOPACK_TRACING_PATH` ([#93084](https://github.com/vercel/next.js/pull/93084)); `--internal-trace` ([#92190](https://github.com/vercel/next.js/pull/92190)).
- `experimental.turbopackWorkerAssetPrefix` — Workers same-origin при CDN `assetPrefix` ([#93271](https://github.com/vercel/next.js/pull/93271)).
- `experimental.cssChunking: "graph"` ([#93606](https://github.com/vercel/next.js/pull/93606)); `chunkLoadingGlobal` ([#93488](https://github.com/vercel/next.js/pull/93488)).
- Webpack loaders: `this.importModule()` ([#89630](https://github.com/vercel/next.js/pull/89630)).
- `createRequire(new URL("...", import.meta.url))` ([#92153](https://github.com/vercel/next.js/pull/92153)).
- Service workers discovery/compile/serve ([#94922](https://github.com/vercel/next.js/pull/94922)).
- Rosetta 2 warning на Apple Silicon ([#92220](https://github.com/vercel/next.js/pull/92220)).

### MCP tools для agents

- `get_compilation_issues` ([#92062](https://github.com/vercel/next.js/pull/92062)) — все compilation issues одним вызовом.
- `compile_route` ([#93337](https://github.com/vercel/next.js/pull/93337)) — on-demand compile route без HTTP.
- turbopack-trace-server: query CLI + MCP API ([#92030](https://github.com/vercel/next.js/pull/92030)).

## Config и env

### `experimental.swcEnvOptions`

PR [#92272](https://github.com/vercel/next.js/pull/92272) — SWC preset-env beyond targets (polyfill injection):

```js
// next.config.js
module.exports = {
  experimental: {
    swcEnvOptions: {
      mode: "usage",
      coreJs: "3.38",
      // mode, coreJs, include, exclude, skip, shippedProposals,
      // forceAllTransforms, debug, loose — mirror SWC docs
    },
  },
};
```

Только client compilation; server остаётся node target. Возвращает то, что потеряли при уходе с Babel `useBuiltIns`.

### `experimental.serverFastRefresh`

PR [#91968](https://github.com/vercel/next.js/pull/91968) — opt-out server Fast Refresh из config (для плагинов), не только CLI `--no-server-fast-refresh`:

```js
module.exports = {
  experimental: {
    serverFastRefresh: false,
  },
};
```

CLI побеждает config; при конфликте — warning.

### Hash salt для content-addressed filenames

PR [#91871](https://github.com/vercel/next.js/pull/91871); **`outputHashSalt` вынесен из experimental** ([#95840](https://github.com/vercel/next.js/pull/95840)). Соль мешается во все content hashes chunk/static filenames (Webpack + Turbopack). Env `NEXT_HASH_SALT` + config concat: `outputHashSalt + NEXT_HASH_SALT`. Сценарий: ротация hash space после CDN cache poison без правки source.

Иммутабельные static assets config тоже **out of experimental** ([#95351](https://github.com/vercel/next.js/pull/95351)); `supportsImmutableAssets` off при `config.output` ([#95521](https://github.com/vercel/next.js/pull/95521)).

### Прочее config

- `experimental.useCacheTimeout` (seconds) — fill timeout для `"use cache"` ([#93070](https://github.com/vercel/next.js/pull/93070)); default ≈ 0.9 × `staticPageGenerationTimeout`.
- `nextConfig.instrumentationClientInject` ([#93785](https://github.com/vercel/next.js/pull/93785)).
- `experimental.imgOptOperationCache` ([#94246](https://github.com/vercel/next.js/pull/94246)).
- `experimental.serverComponentsHmrCancellation` ([#95462](https://github.com/vercel/next.js/pull/95462)).
- `experimental.blockingSSR` (rename from `useExperimentalReact`) ([#94861](https://github.com/vercel/next.js/pull/94861), [#94869](https://github.com/vercel/next.js/pull/94869)).
- Boolean/number primitives в next.config `define` ([#92731](https://github.com/vercel/next.js/pull/92731)).
- `images.maximumResponseBody` применяется и к **local** images ([#92920](https://github.com/vercel/next.js/pull/92920)); `onError` у `next/image` — один раз ([#93209](https://github.com/vercel/next.js/pull/93209)); лучше message для private IP / SSRF rejects ([#91686](https://github.com/vercel/next.js/pull/91686)).
- `serverActions.bodySizeLimit` enforced на **Edge** Server Actions ([#96012](https://github.com/vercel/next.js/pull/96012) / GHSA-4c39-4ccg-62r3).
- TS paths **без** `baseUrl` ([#92277](https://github.com/vercel/next.js/pull/92277)); TS6 baseUrl deprecation handling ([#91855](https://github.com/vercel/next.js/pull/91855)).
- Sourcemaps **by default** during prerender in `next build` ([#93280](https://github.com/vercel/next.js/pull/93280)).
- Multi-level `.localhost` subdomains в dev origin check ([#92262](https://github.com/vercel/next.js/pull/92262)).
- Restart `next dev` если удалили `.next` ([#92135](https://github.com/vercel/next.js/pull/92135)).
- `typegen` default Turbopack ([#94952](https://github.com/vercel/next.js/pull/94952)); non-zero exit + clear message on failure ([#94241](https://github.com/vercel/next.js/pull/94241)).
- Standalone/adapters + `"type": "module"`: `.next/package.json` CJS boundary в `required-server-files` ([#93612](https://github.com/vercel/next.js/pull/93612)).

## Deprecations и migration

### Edge Runtime

PR [#93369](https://github.com/vercel/next.js/pull/93369): `runtime = 'edge'` и `preferredRegion` — **deprecated** (build/dev `warnOnce`, TS `@deprecated`, error docs `edge-runtime-deprecated` / `preferred-region-deprecated`). Направление миграции — Node.js runtime (default). Runtime behaviour пока сохраняется.

### Middleware → proxy

Warning дополнен one-liner codemod ([#92532](https://github.com/vercel/next.js/pull/92532)):

```text
The "middleware" file convention is deprecated. Please use "proxy" instead.

  To migrate automatically, run:
  npx @next/codemod@canary middleware-to-proxy .

  Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
```

### `experimental.useCache` / `dynamicIO` → `cacheComponents`

- JSDoc `@deprecated` на `useCache` ([#92316](https://github.com/vercel/next.js/pull/92316)) + **runtime warning** ([#96448](https://github.com/vercel/next.js/pull/96448)); `useCache: false` при уже включённом `cacheComponents` — hard reject.
- `experimental.dynamicIO` — fatal-friendly message → `cacheComponents` + docs link ([#92081](https://github.com/vercel/next.js/pull/92081)).

### Custom server methods

Undocumented methods `setAssetPrefix()`, logging helpers, `revalidate()`, legacy `render*` — TS deprecation + one-time runtime warn ([#94348](https://github.com/vercel/next.js/pull/94348)); поведение пока на месте. Миграция: `getRequestHandler()`, config, app-level APIs.

### Agent/CI-friendly tooling

- `create-next-app`: при переданных CLI flags **не** спрашивает остальные interactive prompts ([#91840](https://github.com/vercel/next.js/pull/91840)).
- `@next/codemod upgrade`: `-y` / auto non-interactive when `!stdin.isTTY` ([#95312](https://github.com/vercel/next.js/pull/95312)).
- Codemod `cache-components-instant-false` + adoption skill ([#94941](https://github.com/vercel/next.js/pull/94941)).
- Auto-generate/refresh `AGENTS.md` / `CLAUDE.md` agent-rules block on `next dev` ([#92910](https://github.com/vercel/next.js/pull/92910), [#95467](https://github.com/vercel/next.js/pull/95467), [#95470](https://github.com/vercel/next.js/pull/95470)).

## DevTools

- Redesign overlay + instant fix-cards ([#93755](https://github.com/vercel/next.js/pull/93755)); Errors/Insights tabs ([#94073](https://github.com/vercel/next.js/pull/94073)).
- Instant navs panel draggable ([#91914](https://github.com/vercel/next.js/pull/91914)); Instant Navs DevTools revamp ([#94027](https://github.com/vercel/next.js/pull/94027)).
- `AggregateError.errors` в overlay ([#91835](https://github.com/vercel/next.js/pull/91835)); full code frames ([#92621](https://github.com/vercel/next.js/pull/92621)).
- Request Insights / DevTools request panel ([#93976](https://github.com/vercel/next.js/pull/93976)–[#93978](https://github.com/vercel/next.js/pull/93978)).
- Cold cache indicator ([#94611](https://github.com/vercel/next.js/pull/94611)).

## Security и hardening

- Vendored lodash **4.17.23** — CVE-2025-13465 prototype pollution in `_.unset` / `_.omit` ([#91558](https://github.com/vercel/next.js/pull/91558)).
- Edge Server Actions body size limit ([#96012](https://github.com/vercel/next.js/pull/96012)).
- Pages Router: restore `Content-Length` и `ETag` для `/_next/data/` JSON ([#90304](https://github.com/vercel/next.js/pull/90304)).
- Strengthen `_rsc` cache-busting param ([#92755](https://github.com/vercel/next.js/pull/92755)).

## Прочие заметные фиксы (коротко)

- Server Actions + standalone + `cacheComponents` ([#91711](https://github.com/vercel/next.js/pull/91711)); forwarding loop с middleware rewrites ([#93792](https://github.com/vercel/next.js/pull/93792)).
- `file://` из `import.meta.resolve` в cache handler path ([#90370](https://github.com/vercel/next.js/pull/90370) / #73796).
- styled-jsx race при concurrent rendering ([#92459](https://github.com/vercel/next.js/pull/92459)).
- Dev hydration failure когда page из HTTP cache ([#92892](https://github.com/vercel/next.js/pull/92892)).
- Narrow `opengraph-image` return type ([#91893](https://github.com/vercel/next.js/pull/91893)).
- SWC plugin WASM: wasmer → **wasmtime** ([#91533](https://github.com/vercel/next.js/pull/91533)); wasm plugins on Windows ARM ([#92544](https://github.com/vercel/next.js/pull/92544)).
- replace was deprecated `moduleResolution: "node"` / `baseUrl` / `downlevelIteration` в scaffolded configs ([#92652](https://github.com/vercel/next.js/pull/92652)–[#92654](https://github.com/vercel/next.js/pull/92654)).
- Biome 2.4 + Tailwind в create-next-app ([#86065](https://github.com/vercel/next.js/pull/86065)).
- React canary bumps на протяжении окна 16.3 (серия upgrade PR в Misc).

## Кого это касается

| Аудитория                                       | Зачем смотреть 16.3                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Apps на `cacheComponents`                       | Defaults (cached navs, app shells, partial fallbacks behavior), Partial Prefetching adoption, `instant`/`prefetch`/`io` |
| Миграция с PPR / dynamicIO / useCache           | Messages + top-level `cacheComponents`                                                                                  |
| Высокая cardinality links (`/chat/[id]`, feeds) | App Shell prefetch cost model                                                                                           |
| Edge Runtime users                              | Deprecation clock; plan Node migration                                                                                  |
| middleware.ts                                   | Codemod `middleware-to-proxy`                                                                                           |
| CDN/ops                                         | `outputHashSalt` / `NEXT_HASH_SALT`, immutable assets                                                                   |
| Polyfill-heavy browsers                         | `experimental.swcEnvOptions`                                                                                            |
| AI agents / CI scaffolding                      | cna non-interactive, codemod `-y`, MCP compile tools                                                                    |
| Security scanners                               | lodash CVE bump, Edge action body limit                                                                                 |

## Upgrade

```bash
npm install next@16.3.0
# or
pnpm add next@16.3.0
```

Для Cache Components + modern prefetch:

```ts
const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};
```

Если на canary использовали `unstable_*` names (`unstable_io`, `unstable_instant`, `unstable_prefetch`, `unstable_catchError`, `unstable_retry`) — переименуйте на stable **без** dual-export period.

## Ссылки

- [GitHub Release v16.3.0](https://github.com/vercel/next.js/releases/tag/v16.3.0)
- [Compare v16.2.0…v16.3.0](https://github.com/vercel/next.js/compare/v16.2.0...v16.3.0)
- Docs на теге: [partialPrefetching](https://github.com/vercel/next.js/blob/v16.3.0/docs/01-app/03-api-reference/05-config/01-next-config-js/partialPrefetching.mdx), [prefetch](https://github.com/vercel/next.js/blob/v16.3.0/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/prefetch.mdx), [instant](https://github.com/vercel/next.js/blob/v16.3.0/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.mdx), [io](https://github.com/vercel/next.js/blob/v16.3.0/docs/01-app/03-api-reference/04-functions/io.mdx), [catchError](https://github.com/vercel/next.js/blob/v16.3.0/docs/01-app/03-api-reference/04-functions/catchError.mdx), [useOffline](https://github.com/vercel/next.js/blob/v16.3.0/docs/01-app/03-api-reference/04-functions/use-offline.mdx), [offline guide](https://github.com/vercel/next.js/blob/v16.3.0/docs/01-app/02-guides/offline-support.mdx), [adopting partial prefetching](https://github.com/vercel/next.js/blob/v16.3.0/docs/01-app/02-guides/adopting-partial-prefetching.mdx)

---
author: Артём Нецветаев
pubDatetime: 2026-08-06T11:10:18.000Z
title: "Astro 7.2.0: incremental static builds, preview --background и session: false"
slug: astro-v7-2-0
featured: false
draft: false
tags:
  - release
  - astro
  - frontend
  - ssr
  - cli
  - performance
description: "Разбор Astro 7.2.0: experimental.incrementalBuild и cacheKey/digest, astro preview --background, относительный logger.entrypoint, session: false с tree-shaking unstorage и PrerenderResult для out-of-process prerender."
---

Astro выпустил минорный релиз [`astro@7.2.0`](https://github.com/withastro/astro/releases/tag/astro%407.2.0). Главные изменения — экспериментальные инкрементальные статические сборки, фоновый режим `astro preview` (как у `astro dev`), явный opt-out от sessions с tree-shaking `unstorage`, относительные пути в `logger.entrypoint` и расширенный контракт `AstroPrerenderer.render()` для out-of-process prerender.

Ниже — разбор по release body и связанным PR: [#17084](https://github.com/withastro/astro/pull/17084), [#17174](https://github.com/withastro/astro/pull/17174), [#16871](https://github.com/withastro/astro/pull/16871), [#17532](https://github.com/withastro/astro/pull/17532). Патч-фиксы в статью не включены. Compare `astro@7.1.0…astro@7.2.0` — 85 коммитов.

## `experimental.incrementalBuild`: пропускать неизменённые static pages

Флаг из PR [#17084](https://github.com/withastro/astro/pull/17084) (RFC [roadmap#1404](https://github.com/withastro/roadmap/pull/1404)). Когда он включён, Astro может не перерендеривать static page из `getStaticPaths()`, если совпали и module dependency graph страницы, и пользовательский `cacheKey`.

```js
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
  experimental: {
    incrementalBuild: true,
  },
});
```

`cacheKey` возвращается вместе с `params`/`props`:

```astro
---
export async function getStaticPaths() {
  const posts = await fetchPosts();

  return posts.map(post => ({
    params: { slug: post.slug },
    props: { post },
    cacheKey: post.digest,
  }));
}
---
```

Важные контракты из release notes и [docs incremental-build](https://docs.astro.build/en/reference/experimental-flags/incremental-build/):

- без `cacheKey` страница из `getStaticPaths()` всегда пересобирается; static pages без `getStaticPaths()` — тоже всегда;
- invalidation кода идёт через хэш module graph (layouts, components, imports); смена конфига или зависимостей инвалидирует весь кэш;
- удалённые из `getStaticPaths()` страницы чистятся из output автоматически;
- `dist/` на каждой сборке очищается; пропущенные страницы восстанавливаются из cache directory (`cacheDir`, по умолчанию `node_modules/.astro/`). В CI достаточно кэшировать этот каталог перед `astro build`;
- полный rebuild: `astro build --force` — кэш всё равно перезапишется для следующей сборки.

Ограничения experimental-режима (из docs):

- при `build.concurrency > 1` incremental cache отключается с warning, все страницы пересобираются;
- pages с server islands по умолчанию перерендериваются каждый раз (ключ шифрования props регенерируется); для кэширования нужен стабильный `ASTRO_KEY`;
- изменения middleware **не** инвалидируют cached pages — после правок middleware, влияющих на HTML prerendered pages, нужен `astro build --force`.

## `digest` у content collection entries

Тот же PR добавляет optional `digest` в `CollectionEntry` из `getCollection()` / `getEntry()`. Loader может отдавать opaque digest, который меняется вместе с записью — без повторного хэширования большого body на стороне страницы.

```astro
---
import { getCollection } from "astro:content";

const posts = await getCollection("blog");

for (const post of posts) {
  console.log(post.digest);
}
---
```

Типичный паттерн с incremental builds — `cacheKey: String(entry.digest)`. Поле optional: не каждый loader его заполняет.

## `AstroPrerenderer.render()` → `Response | PrerenderResult`

Для prerenderers, которые рендерят вне процесса сборки (например, в runtime адаптера вроде workerd), одного `Response` мало: incremental build должен знать content entries и optimized-image transforms, которые страница реально затронула. `render()` теперь может вернуть `PrerenderResult`:

```ts
import type { AstroPrerenderer, PrerenderResult } from "astro";

const prerenderer: AstroPrerenderer = {
  name: "my-adapter:prerenderer",
  getStaticPaths,
  async render(request, { routeData }): Promise<PrerenderResult> {
    const { response, metadata } = await renderInRuntime(request, routeData);
    return { response, metadata };
  },
};
```

Это non-breaking widening: bare `Response` по-прежнему валиден. In-process prerenderers могут продолжать возвращать `Response` — build и так собирает их metadata напрямую.

## `astro preview --background` и lifecycle-команды

PR [#17174](https://github.com/withastro/astro/pull/17174) переносит background-server utilities с `astro dev` на preview. Команда поднимает preview server, дожидается ready и **возвращает управление** — удобно для скриптов и AI coding agents, которым раньше приходилось держать terminal attached к long-running process.

```sh
astro preview --background
```

Пока сервер в background, доступны subcommands:

```sh
astro preview status
astro preview logs
astro preview logs --follow
astro preview stop
```

Если Astro детектит AI coding agent, background mode для preview включается автоматически (как у `astro dev`). В stdout по-прежнему приходят server URL и process ID. Opt-out:

```sh
ASTRO_PREVIEW_BACKGROUND=0 astro preview
```

## `logger.entrypoint`: пути относительно project root

До 7.2.0 кастомный log handler из своего проекта требовал absolute `URL`. PR [#17532](https://github.com/withastro/astro/pull/17532) принимает строковый path:

```js
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
  logger: {
    // было: entrypoint: new URL('./src/logger.js', import.meta.url),
    entrypoint: "./src/logger.js",
  },
});
```

Пути с `./` или `../` резолвятся от project root. Package specifiers (`@org/astro-logger`), absolute paths и `URL` работают как раньше. Entrypoint по-прежнему должен быть JavaScript: TypeScript entrypoints в этом PR не покрыты.

## `session: false` и tree-shaking session runtime

PR [#16871](https://github.com/withastro/astro/pull/16871) закрывает дыру: session runtime (`AstroSession` + `unstorage`) раньше мог попадать в SSR bundle даже когда driver не сконфигурирован и `Astro.session` всегда `undefined`.

```js
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
  session: false,
});
```

Поведение:

- `session: false` — явный opt-out; адаптеры (`@astrojs/cloudflare`, `@astrojs/netlify`, `@astrojs/node`) не auto-wire default session driver;
- tree-shaking runtime срабатывает шире: при `session: false`, при полном отсутствии `session` config и при `session` object без driver;
- `Astro.session` / `context.session` остаётся `undefined` (тип уже был `AstroSession | undefined`) — существующие `if (Astro.session)` checks не ломаются. Ранняя версия PR бросала `SessionDisabledError`; после review оставили «недоступно = undefined»;
- проекты с настроенным driver (user или adapter default) поведения не меняют.

В integration fixture PR bundle без driver терял `createStorage` / `class AstroSession` и `unstorage`; с `session: { driver: 'fs' }` runtime оставался. Для serverless/edge это убирает cold-start parse cost лишнего session code path.

## Что обновлять

```sh
npm install astro@7.2.0
# или
pnpm add astro@7.2.0
```

Если уже на 7.x:

1. крупные static-сайты с `getStaticPaths` — попробовать `experimental.incrementalBuild` + `cacheKey`/`entry.digest`, в CI кэшировать `node_modules/.astro/`;
2. agent/script workflows — `astro preview --background` / `status` / `logs` / `stop`;
3. SSR без sessions — `session: false` или просто не задавать driver (tree-shake и так сработает);
4. custom logger в репозитории — упростить `entrypoint` до relative string;
5. авторы адаптеров с out-of-process prerender — смотреть `PrerenderResult` metadata для incremental builds.

Источники: [GitHub Release astro@7.2.0](https://github.com/withastro/astro/releases/tag/astro%407.2.0), [compare 7.1.0…7.2.0](https://github.com/withastro/astro/compare/astro%407.1.0...astro%407.2.0), [docs: incremental static builds](https://docs.astro.build/en/reference/experimental-flags/incremental-build/), PR [#17084](https://github.com/withastro/astro/pull/17084), [#17174](https://github.com/withastro/astro/pull/17174), [#16871](https://github.com/withastro/astro/pull/16871), [#17532](https://github.com/withastro/astro/pull/17532).

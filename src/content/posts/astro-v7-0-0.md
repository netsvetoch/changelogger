---
author: Артём Нецветаев
pubDatetime: 2026-06-28T20:24:33.000Z
title: "Astro 7.0.0: Vite 8, Rust-компилятор и новый dev server для агентов"
slug: astro-v7-0-0
featured: true
draft: false
tags:
  - release
  - astro
  - frontend
description: "Обзор major-релиза Astro 7.0.0: переход на Vite 8 и Rolldown-типы, compressHTML: 'jsx' по умолчанию, background dev server для AI-агентов, удаление Astro DB, Rust-компилятор, Sätteri Markdown, advanced routing, logger и route caching."
---

Astro выпустил major-релиз [`astro@7.0.0`](https://github.com/withastro/astro/releases/tag/astro%407.0.0). Это не один большой API, а чистка нескольких экспериментальных веток Astro 6: Vite обновлён до v8, Rust-компилятор стал единственным компилятором, Sätteri стал Markdown-процессором по умолчанию, advanced routing и route caching вышли из `experimental`, а `@astrojs/db` удалён из проекта.

Источник для обзора — GitHub Release [`astro@7.0.0`](https://github.com/withastro/astro/releases/tag/astro%407.0.0) и связанные PR в `withastro/astro`: [#15819](https://github.com/withastro/astro/pull/15819), [#16965](https://github.com/withastro/astro/pull/16965), [#16610](https://github.com/withastro/astro/pull/16610), [#17010](https://github.com/withastro/astro/pull/17010), [#16462](https://github.com/withastro/astro/pull/16462), [#16966](https://github.com/withastro/astro/pull/16966), [#16877](https://github.com/withastro/astro/pull/16877), [#16725](https://github.com/withastro/astro/pull/16725), [#16998](https://github.com/withastro/astro/pull/16998), [#16745](https://github.com/withastro/astro/pull/16745), [#16981](https://github.com/withastro/astro/pull/16981) и [#17116](https://github.com/withastro/astro/pull/17116).

## Vite 8 теперь базовая версия Astro

Главное инфраструктурное изменение — PR [#15819](https://github.com/withastro/astro/pull/15819) переводит Astro и официальные интеграции на Vite 8. В diff это видно не только по changeset: Astro начал использовать Vite/Rolldown-типы, например `Rolldown.PluginContext` вместо `rollup.PluginContext`, а adapter config теперь пишет SSR input в `vite.build.rolldownOptions.input` вместо `vite.build.rollupOptions.input`.

Практический смысл: если у вас есть интеграция или adapter, который залезал в Vite build config на уровне Rollup-опций, проверьте совместимость с Vite 8/Rolldown-путём. Для adapter'ов особенно важна смена имени поля:

```diff
export default {
  name: "custom-adapter",
  hooks: {
    "astro:config:setup"({ updateConfig }) {
      updateConfig({
        vite: {
          build: {
-           rollupOptions: { input: { index: "./server.js" } },
+           rolldownOptions: { input: { index: "./server.js" } },
          },
        },
      });
    },
  },
};
```

В этом же PR есть отдельный bugfix: после Vite-triggered restart, например при изменении `.env`, `astro dev --port ...` больше не должен терять заданный порт.

## `compressHTML: 'jsx'` стал default

Astro 6.2 уже умел включать JSX-правила whitespace через `compressHTML: "jsx"`. В Astro 7 это значение стало default: PR [#16965](https://github.com/withastro/astro/pull/16965) меняет `ASTRO_CONFIG_DEFAULTS.compressHTML` с `true` на `'jsx'`, а публичный тип/документация теперь описывают `boolean | "jsx"` с default `'jsx'`.

Новый default удаляет пробелы и переносы вокруг элементов по правилам JSX, но сохраняет значимый пробел внутри одной строки. Это может изменить HTML там, где пробел между inline-элементами раньше был результатом переноса строки в `.astro` файле.

```astro
<!-- Astro 7 default: compressHTML: 'jsx' -->
<span>hello</span>
<em>world</em>
<!-- станет: <span>hello</span><em>world</em> -->

<span>hello</span>
<em>world</em>
<!-- пробел в одной строке сохраняется -->
```

Если вам нужен прежний HTML-aware compression, явно верните его:

```js
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
  compressHTML: true,
});
```

А если проект чувствителен к любому whitespace — например, генерирует HTML для писем или snapshot'ы — можно отключить compression полностью:

```js
export default defineConfig({
  compressHTML: false,
});
```

## `astro dev` получил background mode для AI-агентов

PR [#16610](https://github.com/withastro/astro/pull/16610) добавляет режим, специально рассчитанный на AI coding agents. Если Astro определяет, что `astro dev` запущен агентом, dev server автоматически стартует detached background process, чтобы не заблокировать терминал агента. Детект делается через пакет `am-i-vibing`, который добавлен в зависимости `astro`.

Новые команды и флаги:

```bash
astro dev --background
astro dev stop
astro dev status
astro dev logs
astro dev logs --follow
```

При старте background server Astro пишет lock-файл `.astro/dev.json` с URL, port и PID. Он нужен сразу для двух вещей: не поднимать дубликат сервера для того же проекта и дать subcommand'ам найти уже запущенный процесс. В PR также добавлен `/_astro/status` health endpoint для programmatic readiness checks.

Если сервер зависает при остановке, `astro dev stop` и `astro dev --background --force` сначала отправляют `SIGTERM`, а через 5 секунд эскалируют до `SIGKILL`. Для opt-out из автоматического режима достаточно выставить переменную окружения:

```bash
ASTRO_DEV_BACKGROUND=0 astro dev
```

Для обычного разработчика без AI-агента `astro dev` должен вести себя как раньше.

## `@astrojs/db` и CLI-команды Astro DB удалены

Astro DB был deprecated в `v6.4.5`, а в Astro 7 пакет [`@astrojs/db`](https://github.com/withastro/astro/pull/17010) удалён. Вместе с ним удалены CLI-команды:

```bash
astro db
astro login
astro logout
astro link
astro init
```

Если проект всё ещё зависит от `@astrojs/db`, релиз прямо предлагает удалить пакет из dependencies и перейти на другой слой хранения. Для локального SQLite при Node adapter теперь можно рассмотреть встроенный `node:sqlite` из Node.js 22.5+, для Drizzle-подобного schema/query API — использовать Drizzle напрямую, а для hosted database — Turso, PlanetScale, Neon или другой выбранный драйвер.

Минимальная миграция на уровне зависимостей выглядит так:

```diff
{
  "dependencies": {
-   "@astrojs/db": "...",
+   "drizzle-orm": "..."
  }
}
```

## Rust-компилятор стал единственным компилятором

PR [#16462](https://github.com/withastro/astro/pull/16462) делает `@astrojs/compiler-rs` default compiler и удаляет прежний Go-based compiler вместе с флагом `experimental.rustCompiler`. В PR [#16965](https://github.com/withastro/astro/pull/16965) dependency на `@astrojs/compiler-rs` также обновлена до `^0.2.2`.

Что это меняет для пользователей:

- `experimental.rustCompiler` больше не нужен и должен быть удалён из `astro.config.mjs`;
- compiler стал строже к некорректному синтаксису: например, незакрытые HTML-теги теперь приводят к ошибке вместо молчаливого игнорирования;
- compiler больше не пытается исправлять семантически невалидный HTML, а оставляет его browser'у примерно так же, как это делают другие инструменты или `document.write()`.

```diff
// astro.config.mjs
export default defineConfig({
-  experimental: {
-    rustCompiler: true,
-  },
});
```

## Sätteri стал Markdown-процессором по умолчанию

Astro 7 переключает `.md` rendering на `satteri()` из `@astrojs/markdown-satteri`. PR [#16966](https://github.com/withastro/astro/pull/16966) означает, что `@astrojs/markdown-remark` больше не ставится по умолчанию для нового Markdown pipeline.

Если ваш проект зависит от remark/rehype pipeline, нужно явно поставить `@astrojs/markdown-remark` и выбрать `unified()` как processor:

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";

export default defineConfig({
  markdown: {
    processor: unified(),
  },
});
```

Старые опции `markdown.remarkPlugins`, `markdown.rehypePlugins` и `markdown.remarkRehype` продолжают работать, но теперь требуют, чтобы remark-процессор был установлен и выбран явно.

## Advanced routing включён по умолчанию

Advanced routing из Astro 6.3 больше не experimental. PR [#16877](https://github.com/withastro/astro/pull/16877) включает его по умолчанию и меняет default entrypoint с `src/app.ts` на `src/fetch.ts`.

Если вы уже использовали флаг без кастомного entrypoint, есть два варианта миграции: переименовать `src/app.ts` в `src/fetch.ts` или задать top-level `fetchFile`.

```diff
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
-  experimental: {
-    advancedRouting: true,
-  },
+  fetchFile: "app.ts",
});
```

Если entrypoint уже был кастомным, настройка переезжает из `experimental.advancedRouting.fetchFile` в top-level `fetchFile`:

```diff
export default defineConfig({
-  experimental: {
-    advancedRouting: {
-      fetchFile: "my-custom-entrypoint.ts",
-    },
-  },
+  fetchFile: "my-custom-entrypoint.ts",
});
```

Можно также поставить `fetchFile: null`, если `src/fetch.ts` используется для другой цели или advanced routing entrypoint в проекте не нужен.

## Удалены deprecated API из `astro:transitions`

PR [#16725](https://github.com/withastro/astro/pull/16725) удаляет helpers, которые были deprecated в Astro 6. В Astro 7 больше нельзя импортировать:

- `TRANSITION_BEFORE_PREPARATION`
- `TRANSITION_AFTER_PREPARATION`
- `TRANSITION_BEFORE_SWAP`
- `TRANSITION_AFTER_SWAP`
- `TRANSITION_PAGE_LOAD`
- `isTransitionBeforePreparationEvent()`
- `isTransitionBeforeSwapEvent()`
- `createAnimationScope()`

Миграция для event constants — использовать строковые event names напрямую:

```diff
-import {
-  TRANSITION_AFTER_SWAP,
-  isTransitionBeforePreparationEvent,
-} from "astro:transitions/client";
-
-console.log(isTransitionBeforePreparationEvent(event));
-console.log(TRANSITION_AFTER_SWAP);
+console.log(event.type === "astro:before-preparation");
+console.log("astro:after-swap");
```

`createAnimationScope()` нужно удалить из импортов и кода: replacement в release notes не указан.

## `astro/hono` получил публичный `getFetchState()`

Для advanced routing/Hono-сценариев PR [#16998](https://github.com/withastro/astro/pull/16998) экспортирует `getFetchState()` из `astro/hono`. Эта функция достаёт или лениво создаёт `FetchState` из Hono context, чтобы middleware сторонних пакетов могло работать с per-request state Astro.

```ts
import { Hono } from "hono";
import { getFetchState, pages } from "astro/hono";

const app = new Hono();

app.use(async (context, next) => {
  const state = getFetchState(context);
  state.locals.message = "Hello from custom middleware";
  await next();
});

app.use(pages());

export default app;
```

Это делает `astro/hono` ближе к `astro/fetch`: middleware может заполнять `locals`, а страницы и handlers потом читают это состояние в рамках того же запроса.

## Logger и route caching вышли из `experimental`

Custom logger, добавленный за флагом в Astro 6.2, теперь обычная настройка. PR [#16745](https://github.com/withastro/astro/pull/16745) переносит `experimental.logger` в top-level `logger`, оставляет built-in handlers `json`, `node` и `console`, а `context.logger` в API routes и middleware теперь всегда определён.

```diff
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
-  experimental: {
-    logger: { entrypoint: "@org/custom-logger" },
-  },
+  logger: { entrypoint: "@org/custom-logger" },
});
```

Для JSON-логов есть built-in handler:

```js
import { defineConfig, logHandlers } from "astro/config";

export default defineConfig({
  logger: logHandlers.json({
    pretty: true,
    level: "warn",
  }),
});
```

Route caching тоже стал стабильным. PR [#17116](https://github.com/withastro/astro/pull/17116) переносит `experimental.cache` и `experimental.routeRules` в top-level `cache` и `routeRules`. Caching не включается сам по себе: нужен cache provider.

```diff
// astro.config.mjs
import { defineConfig, memoryCache } from "astro/config";

export default defineConfig({
-  experimental: {
-    cache: { provider: memoryCache() },
-    routeRules: {
-      "/blog/[...path]": { maxAge: 300, swr: 60 },
-    },
-  },
+  cache: { provider: memoryCache() },
+  routeRules: {
+    "/blog/[...path]": { maxAge: 300, swr: 60 },
+  },
});
```

В diff route matcher'а есть важная деталь: `routeRules` использует синтаксис file-based routing (`[param]`, `[...rest]`), а `*` трактуется как литеральный символ, не как glob. Для группы маршрутов используйте `[...rest]`.

## Rendering engine стабилизирован, `experimental.queuedRendering` удалён

PR [#16981](https://github.com/withastro/astro/pull/16981) удаляет настройку `experimental.queuedRendering`: новый rendering engine стал стабильным и заменил старый путь. При этом старый двухшаговый queue engine не просто включён по умолчанию — он заменён streaming-подходом, где компоненты render'ятся и flush'атся по мере обхода дерева.

Из кода удалены `NodePool`, `HTMLStringCache`, queue builder/renderer и связанная конфигурация в SSR manifest. Новый runtime экспортирует `renderStreaming` и `chunkToString`, а MDX renderer теперь прогоняет vnode tree через тот же streaming engine и собирает chunks в строку для `renderComponent`.

Если в конфиге оставался экспериментальный флаг, его нужно убрать:

```diff
export default defineConfig({
  experimental: {
-    queuedRendering: {},
  },
});
```

## `fontData` теперь различает subsets

Небольшое, но полезное изменение для font pipeline: PR [#16996](https://github.com/withastro/astro/pull/16996) добавляет поле `subset` в тип `FontData`, который доступен через `fontData` из `astro:assets`. Если один font family загружается в нескольких subsets, например `latin` и `korean`, записи с одинаковыми `weight` и `style` теперь можно различить по subset.

Практический сценарий — генерация preload/link-тегов или собственная аналитика font assets:

```ts
import { fontData } from "astro:assets";

for (const font of fontData) {
  console.log(font.family, font.weight, font.style, font.subset);
}
```

## Кому стоит обновляться осторожно

Astro 7 — major-релиз, и самые рискованные места здесь конкретные:

- проекты с чувствительным whitespace должны проверить rendered HTML после нового default `compressHTML: 'jsx'`;
- пользователи `@astrojs/db` должны удалить пакет и заменить `astro db/login/logout/link/init` workflow;
- интеграции и adapter'ы, работающие напрямую с Vite/Rollup internals, должны проверить Vite 8 и `rolldownOptions`;
- проекты на remark/rehype должны явно поставить и выбрать `@astrojs/markdown-remark`;
- advanced routing проекты должны проверить `src/fetch.ts`, top-level `fetchFile` и публичный `getFetchState()`;
- конфиги с `experimental.logger`, `experimental.cache`, `experimental.routeRules` или `experimental.queuedRendering` нужно мигрировать на новые top-level настройки или удалить флаг.

Если у вас обычный статический Astro-сайт без Astro DB, кастомного Markdown pipeline и экспериментальных flags, апдейт в основном даст Vite 8, Rust compiler path и более строгие ошибки компилятора. Но для SSR/adapters/integrations Astro 7 лучше воспринимать как релиз миграции конфигурации, а не как простой bump версии.

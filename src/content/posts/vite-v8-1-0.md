---
author: Артём Нецветаев
pubDatetime: 2026-06-28T17:45:20.000Z
title: "Vite 8.1.0: bundled dev mode, chunk import maps и новые asset API"
slug: vite-v8-1-0
featured: false
draft: false
tags:
  - release
  - vite
  - frontend
description: "Обзор минорного релиза Vite 8.1.0: экспериментальный bundled dev mode, build.chunkImportMap, прямой импорт WebAssembly, html.additionalAssetSources, caseSensitive для import.meta.glob и изменения server.ws/server.fs.deny."
---

Vite выпустил минорную версию [`v8.1.0`](https://github.com/vitejs/vite/releases/tag/v8.1.0). Сам GitHub Release короткий и отправляет в [`packages/vite/CHANGELOG.md`](https://github.com/vitejs/vite/blob/v8.1.0/packages/vite/CHANGELOG.md), поэтому для этого обзора я сверил changelog, официальный пост [`Announcing Vite 8.1`](https://github.com/vitejs/vite/blob/v8.1.0/docs/blog/announcing-vite8-1.md) и diff [`v8.0.0...v8.1.0`](https://github.com/vitejs/vite/compare/v8.0.0...v8.1.0).

Главная тема релиза — Vite 8 продолжает переход на Rolldown: часть изменений экспериментальная, но уже даёт новые режимы сборки, лучшее кэширование чанков и более явные настройки dev server'а.

## Экспериментальный bundled dev mode

В Vite 8.1 появился экспериментальный bundled dev mode — режим, который бандлит клиентскую часть не только для production build, но и во время разработки. В официальном посте команда описывает его как переименование/развитие прежнего Full Bundle Mode: цель — ускорить большие приложения, где unbundled dev server начинает упираться в количество отдельных модулей и сетевых запросов.

Включается режим либо CLI-флагом, либо настройкой `experimental.bundledDev`:

```bash
vite --experimental-bundle
```

```ts
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  experimental: {
    bundledDev: true,
  },
});
```

По данным команды Vite из release-поста, на тестовом приложении с 10 000 React-компонентов режим дал примерно 15x более быстрый startup и 10x более быстрый full page reload по сравнению с обычным unbundled dev server. На реальном приложении Linear команда увидела до 3x более быстрый cold start rendering, около 40% ускорения full reload и примерно в 10 раз меньше network requests.

Важно: это не «просто включите везде». В посте прямо сказано, что режим сейчас фокусируется на browser-side, базовых плагинах и основных возможностях. Сторонние плагины и второстепенные возможности могут не работать. Внутри релиза есть и конкретное улучшение этого режима: PR [#21406](https://github.com/vitejs/vite/pull/21406) добавил lazy bundling. В коде появился middleware `triggerLazyBundlingMiddleware`, который обрабатывает запросы вида `/@vite/lazy?id=...&clientId=...`, а клиент теперь отправляет `vite:module-loaded` вместе с `clientId`. Это позволяет догружать динамические импорты по требованию; тестовый playground проверяет сценарий `import("./dynamic.js")` после клика по кнопке.

## `build.chunkImportMap`: меньше каскадной инвалидиации чанков

Vite 8.1 добавляет экспериментальную опцию [`build.chunkImportMap`](https://github.com/vitejs/vite/pull/21580). Проблема, которую она решает: если chunk `A` импортирует chunk `C` по URL с hash, то изменение `C` меняет URL внутри `A`; из-за этого меняется hash `A`, а затем и hash всех чанков выше по цепочке. В результате один реальный change может сбросить кэш у большого числа файлов.

Новая опция использует import map: чанки ссылаются на стабильный id, а соответствие id → hashed URL выносится в import map. Включается так:

```ts
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    chunkImportMap: true,
  },
});
```

Из документации в `docs/config/build-options.md` важны три ограничения:

- тип опции — `boolean`, default — `false`;
- фича экспериментальная;
- требуется поддержка `import.meta.resolve`; для старых браузеров команда отправляет к `@vitejs/plugin-legacy`.

Для backend integration сценариев появился отдельный нюанс: если HTML генерируется не Vite, нужно самому вставить `importmap.json` в HTML через `<script type="importmap">` до любых `<script type="module">` и `<link rel="modulepreload">`. Ещё одно ограничение из `docs/guide/features.md`: оптимизация сейчас не применяется к CSS и assets, но при изменении asset'а инвалидиация не должна каскадировать дальше на чанки, импортирующие уже изменённый chunk.

## Прямой импорт `.wasm` как ES module

PR [#21779](https://github.com/vitejs/vite/pull/21779) добавил поддержку WebAssembly ESM Integration. Раньше привычный путь в Vite — импортировать `.wasm` с `?init`, получить initialization function и вызвать её вручную. Теперь `.wasm` можно импортировать напрямую, если нужны экспортируемые функции модуля:

```ts
import { add } from "./add.wasm";

console.log(add(1, 2)); // 3
```

По документации Vite теперь читает imports/exports из wasm binary, инстанцирует модуль и переэкспортирует wasm exports как named ES exports. Если WebAssembly-модуль сам объявляет imports, Vite трактует имя импортируемого модуля как import specifier относительно `.wasm` файла и автоматически подключает нужные members.

Это async module: документация отдельно отмечает, что прямой `.wasm` импорт требует поддержки top-level `await`. Старый режим остаётся для случаев, где нужен ручной контроль инстанцирования:

```ts
import init from "./example.wasm?init";

const instance = await init();
instance.exports.test();
```

В типах тоже появилась подсказка: в `packages/vite/client.d.ts` добавлен `declare module "*.wasm" {}` рядом с уже существующим `*.wasm?init`.

## `html.additionalAssetSources`: свои HTML-теги и атрибуты как источники assets

Если проект использует custom elements или нестандартные `data-*` атрибуты для ссылок на изображения/HTML/assets, Vite раньше не обязан был видеть эти ссылки как assets: встроенный список покрывал стандартные элементы и атрибуты. PR [#21412](https://github.com/vitejs/vite/pull/21412) добавил настройку `html.additionalAssetSources`.

Тип экспортируется как `HtmlAssetSource`, а в документации описаны три поля:

```ts
interface HtmlAssetSource {
  srcAttributes?: string[];
  srcsetAttributes?: string[];
  filter?: (data: {
    key: string;
    value: string;
    attributes: Record<string, string>;
  }) => boolean;
}
```

Пример из нового API:

```ts
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  html: {
    additionalAssetSources: {
      "html-import": { srcAttributes: ["src"] },
      img: { srcAttributes: ["data-src-dark", "data-src-light"] },
      "my-picture": { srcsetAttributes: ["data-srcset"] },
      "my-component": {
        srcAttributes: ["asset"],
        filter: ({ attributes }) => attributes.type === "image",
      },
    },
  },
});
```

В реализации это подключено и в build HTML plugin, и в dev `indexHtml` middleware: оба пути теперь вызывают `getNodeAssetAttributes(node, config.html?.additionalAssetSources)`. То есть поведение должно совпадать в dev и production build.

## `import.meta.glob` получил `caseSensitive`

У [`import.meta.glob`](https://github.com/vitejs/vite/pull/21707) появилась опция `caseSensitive`. По умолчанию поведение осталось прежним: matching case-sensitive. Если выставить `caseSensitive: false`, glob начинает матчить файлы без учёта регистра.

```ts
const modules = import.meta.glob("./dir/module*.js", {
  caseSensitive: false,
});
```

Документационный пример говорит, что такой glob сможет подобрать `Module.js`, `module.js` и `MODULE.js` по шаблону `module*.js`. В типах это отражено в `packages/vite/types/importGlob.d.ts`:

```ts
caseSensitive?: boolean; // default true
```

Из реализации видно, что это не только initial enumeration: HMR matcher тоже учитывает опцию. В `importMetaGlob.ts` matcher создаётся с `nocase: !(i.options.caseSensitive ?? true)`, поэтому добавление/удаление файла с другим регистром должно корректно задевать модули, где glob был объявлен case-insensitive. Финальный changelog `v8.1.0` отдельно фиксирует баг [#22711](https://github.com/vitejs/vite/issues/22711): HMR matcher теперь уважает `caseSensitive`.

## Lightning CSS ближе к default-пути

Vite 8.1 продолжает подготавливать переход к Lightning CSS по умолчанию в следующем major. В официальном посте команда выделяет две закрытые дырки относительно PostCSS-пути:

- внешние CSS imports теперь поддерживаются в Lightning CSS path ([#18389](https://github.com/vitejs/vite/pull/18389));
- Lightning CSS plugins могут регистрировать file/glob dependencies ([#21748](https://github.com/vitejs/vite/pull/21748)).

Первое изменение добавило обработку absolute/protocol-relative URL вроде `https://...` внутри CSS `@import`: в `compileLightningCSS` такие imports помечаются как external, а тестовый fixture проверяет `@import 'https://api.iconify.design/mdi-light.css?icons=help-circle';`.

Второе изменение обрабатывает dependencies, которые возвращает Lightning CSS: `file` добавляется в deps напрямую, а `glob` раскрывается через `globSync`. Это важно для HMR и watch mode: если Lightning CSS plugin генерирует CSS на основе набора файлов, Vite теперь может знать, за какими файлами следить.

Попробовать Lightning CSS можно через уже существующую настройку:

```ts
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  css: {
    transformer: "lightningcss",
  },
});
```

## Dev server: `server.ws`, расширенный `server.fs.deny` и предупреждение про `envFile`

В релизе есть несколько изменений, которые важны владельцам dev-инфраструктуры и monorepo-конфигов.

Во-первых, WebSocket-настройки переезжают из `server.hmr` в новый `server.ws` ([#21357](https://github.com/vitejs/vite/pull/21357)). Старые поля `server.hmr.protocol`, `host`, `port`, `path`, `clientPort`, `timeout`, `server` помечены deprecated, но автоматически синхронизируются, поэтому существующие конфиги должны продолжать работать. `server.hmr` теперь отвечает за HMR-поведение, например overlay:

```ts
export default defineConfig({
  server: {
    hmr: { overlay: false },
    ws: {
      protocol: "wss",
      host: "localhost",
      port: 3001,
      clientPort: 443,
    },
  },
});
```

Во-вторых, default deny-list для `server.fs.deny` стал шире ([#22707](https://github.com/vitejs/vite/pull/22707)). Было:

```ts
[".env", ".env.*", "*.{crt,pem}", "**/.git/**"];
```

Стало:

```ts
[
  ".env",
  ".env.*",
  "*.{crt,pem,key,p12,pfx,cer,der}",
  ".npmrc",
  ".yarnrc.yml",
  "**/.git/**",
];
```

То есть dev server теперь по умолчанию блокирует больше распространённых credential/config файлов: private keys/cert formats, npm/yarn config и `.git`.

В-третьих, для программного API добавлено runtime-предупреждение по deprecated `envFile: false` ([#22555](https://github.com/vitejs/vite/pull/22555)). Поведение совместимости осталось: `envFile: false` всё ещё мапится на `envDir: false`, но теперь Vite явно пишет warning: используйте `envDir: false` вместо `envFile`.

## Кому стоит обновиться

`v8.1.0` — минорный релиз, но он затрагивает сразу несколько групп пользователей:

- большим frontend-приложениям стоит попробовать `experimental.bundledDev`, если обычный dev server уже страдает от тысяч модулей и сетевых запросов;
- командам с долгоживущим browser cache полезно изучить `build.chunkImportMap`, особенно если deploy часто инвалидирует цепочки JS chunks;
- проектам с WebAssembly можно убрать `?init` там, где достаточно named exports из `.wasm`;
- дизайн-системам и сайтам с custom elements пригодится `html.additionalAssetSources`;
- monorepo и инфраструктурным командам стоит проверить новые `server.ws`, `server.fs.deny` defaults и deprecated `envFile`.

## Как обновиться

```bash
pnpm add -D vite@8.1.0
```

Или через npm:

```bash
npm install -D vite@8.1.0
```

После обновления стоит отдельно прогнать dev server и production build. Если у вас есть кастомные Vite plugins, WebSocket/HMR proxy-настройки, Lightning CSS или нестандартная HTML-обработка assets, эти места лучше проверить вручную: часть новых возможностей экспериментальная, а часть меняет рекомендуемые конфиги без немедленного удаления старого поведения.

## Ссылки

- [Release v8.1.0](https://github.com/vitejs/vite/releases/tag/v8.1.0)
- [CHANGELOG.md for v8.1.0](https://github.com/vitejs/vite/blob/v8.1.0/packages/vite/CHANGELOG.md)
- [Announcing Vite 8.1](https://github.com/vitejs/vite/blob/v8.1.0/docs/blog/announcing-vite8-1.md)
- [Compare v8.0.0...v8.1.0](https://github.com/vitejs/vite/compare/v8.0.0...v8.1.0)

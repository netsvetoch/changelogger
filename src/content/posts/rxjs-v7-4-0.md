---
author: Артём Нецветаев
pubDatetime: 2026-08-15T00:01:52.000Z
title: "RxJS 7.4.0: условие exports.es2015 для Angular CLI"
slug: rxjs-v7-4-0
featured: false
draft: false
tags:
  - release
  - rxjs
  - javascript
  - typescript
  - angular
description: "Minor RxJS 7.4.0: в package.json exports добавлен condition es2015 → dist/esm/* (нативный ES2015) для Angular CLI; default по-прежнему esm5. Плюс label operator в docs_app."
---

RxJS [`7.4.0`](https://github.com/ReactiveX/rxjs/compare/7.3.1...7.4.0) (тег `7.4.0`, 6 октября 2021) — minor после 7.3.x. Отдельного GitHub Release body у тега нет: контракт в [`CHANGELOG.md`](https://github.com/ReactiveX/rxjs/blob/7.4.0/CHANGELOG.md) (секция `# [7.4.0]`) и compare [`7.3.1...7.4.0`](https://github.com/ReactiveX/rxjs/compare/7.3.1...7.4.0) (5 коммитов). Единственный user-facing feature — **condition `es2015` в `package.json` `exports`**, чтобы Angular CLI брал нативный ESM-бандл вместо downlevel `esm5`.

## `exports.es2015`: Angular получает `dist/esm`, не `esm5`

До 7.4.0 у пакета уже были поля верхнего уровня:

```json
{
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm5/index.js",
  "es2015": "./dist/esm/index.js"
}
```

Но современный резолв через **`exports`** (Node / bundler / Angular CLI) **не смотрит** на top-level `es2015`, если задан map `exports`. В map для каждого entry-point были только `node` и `default`:

```json
".": {
  "node": "./dist/cjs/index.js",
  "default": "./dist/esm5/index.js"
}
```

`default` указывал на **`dist/esm5`** — ES5-downlevel сборку. Angular CLI при `module`/`target` ES2015+ запрашивает condition **`es2015`** (и аналоги), чтобы взять код без лишнего transpile. Без ключа в `exports` CLI падал на `default` → esm5, хотя top-level `"es2015": "./dist/esm/index.js"` уже существовал.

В [`#6614`](https://github.com/ReactiveX/rxjs/pull/6614) / [`268777b`](https://github.com/ReactiveX/rxjs/commit/268777bc3a4fd0cf76882683b51809771741ddc3) (автор [@crisbeto](https://github.com/crisbeto), по follow-up к обсуждению [Igor Minar в #6613](https://github.com/ReactiveX/rxjs/pull/6613#discussion_r716958551)) во **все** entry-point'ы `exports` добавили condition `es2015` → `./dist/esm/...`:

```json
{
  "exports": {
    ".": {
      "node": "./dist/cjs/index.js",
      "es2015": "./dist/esm/index.js",
      "default": "./dist/esm5/index.js"
    },
    "./ajax": {
      "node": "./dist/cjs/ajax/index.js",
      "es2015": "./dist/esm/ajax/index.js",
      "default": "./dist/esm5/ajax/index.js"
    },
    "./fetch": {
      "node": "./dist/cjs/fetch/index.js",
      "es2015": "./dist/esm/fetch/index.js",
      "default": "./dist/esm5/fetch/index.js"
    },
    "./operators": {
      "node": "./dist/cjs/operators/index.js",
      "es2015": "./dist/esm/operators/index.js",
      "default": "./dist/esm5/operators/index.js"
    },
    "./testing": {
      "node": "./dist/cjs/testing/index.js",
      "es2015": "./dist/esm/testing/index.js",
      "default": "./dist/esm5/testing/index.js"
    },
    "./webSocket": {
      "node": "./dist/cjs/webSocket/index.js",
      "es2015": "./dist/esm/webSocket/index.js",
      "default": "./dist/esm5/webSocket/index.js"
    },
    "./internal/*": {
      "node": "./dist/cjs/internal/*.js",
      "es2015": "./dist/esm/internal/*.js",
      "default": "./dist/esm5/internal/*.js"
    },
    "./package.json": "./package.json"
  }
}
```

Порядок conditions важен для резолверов, которые идут сверху вниз: `node` → CJS, `es2015` → нативный ESM (`dist/esm`), всё остальное → `default`/`esm5`.

### Что это даёт на практике

| Потребитель                         | До 7.4.0 (через `exports`) | После 7.4.0                         |
| ----------------------------------- | -------------------------- | ----------------------------------- |
| Node (`require` / `node` condition) | `dist/cjs`                 | без изменений — `dist/cjs`          |
| Angular CLI (condition `es2015`)    | падал на `default` → esm5  | `dist/esm` (ES2015 modules)         |
| Bundler без `es2015`                | `dist/esm5`                | по-прежнему `default` → `dist/esm5` |

Кого касается:

- **Angular-приложения** на RxJS 7.x: после `npm i rxjs@7.4.0` CLI может резолвить secondary entry-points (`rxjs`, `rxjs/operators`, `rxjs/ajax`, …) в ES2015-сборку — меньше downlevel, лучше tree-shaking/оптимизации под modern target.
- **Не Angular / plain Node / старые bundler'ы** без condition `es2015`: поведение то же, что в 7.3.x (`node` или `default`).
- Runtime API операторов/классов **не менялся** — это только packaging/resolution.

Миграция: bump `rxjs` до `^7.4.0` (или lock на `7.4.0+`). Менять импорты не нужно:

```ts
import { of, map } from "rxjs";
// secondary entry-points тоже покрыты:
import { ajax } from "rxjs/ajax";
import { webSocket } from "rxjs/webSocket";
```

Если кастомный bundler явно мапит package exports, имеет смысл добавить `es2015` (или `import`/`module` conditions, если вы их эмулируете) в resolve conditions — иначе по-прежнему получите esm5 через `default`.

## Docs: label `operator` в API reference

Вторым коммитом compare (не в Features changelog, а docs) — [`#6563`](https://github.com/ReactiveX/rxjs/pull/6563) / [`861aa92`](https://github.com/ReactiveX/rxjs/commit/861aa92420a9086424e64a0602e2e5c16fc21881): processor `checkOperator` помечает docs, у которых `originalModule` начинается с `internal/operators`, флагом `isOperator`, и шаблон API рисует label **operator** (красный status label, как impure-pipe). На runtime/library surface не влияет — только docs_app.

## Что ещё в compare

В [`7.3.1...7.4.0`](https://github.com/ReactiveX/rxjs/compare/7.3.1...7.4.0) пять коммитов: skip flaky tests ([#6603](https://github.com/ReactiveX/rxjs/pull/6603)), docs operator label, feature `exports.es2015`, `chore(publish): 7.4.0`. User-facing surface релиза — packaging fix для Angular.

## Ссылки

- Changelog: [7.4.0](https://github.com/ReactiveX/rxjs/blob/7.4.0/CHANGELOG.md)
- Compare: [7.3.1...7.4.0](https://github.com/ReactiveX/rxjs/compare/7.3.1...7.4.0)
- exports es2015: [#6614](https://github.com/ReactiveX/rxjs/pull/6614) / [268777b](https://github.com/ReactiveX/rxjs/commit/268777bc3a4fd0cf76882683b51809771741ddc3)
- обсуждение Angular: [Igor Minar @ #6613](https://github.com/ReactiveX/rxjs/pull/6613#discussion_r716958551)
- docs operator label: [#6563](https://github.com/ReactiveX/rxjs/pull/6563)

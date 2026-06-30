---
author: Артём Нецветаев
pubDatetime: 2026-06-30T12:48:30.000Z
title: "Gravity UI Icons 2.20.0: ESM для прямых импортов и обновление сборочного стека"
slug: gravity-ui-icons-v2-20-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - icons
description: "Обзор минорного релиза @gravity-ui/icons v2.20.0: package exports для ESM subpath-импортов, исправление Vite/esbuild interop и переход инфраструктуры пакета на Node.js 24, Storybook 10 и React 19."
---

`@gravity-ui/icons` выпустил минорную версию [`v2.20.0`](https://github.com/gravity-ui/icons/releases/tag/v2.20.0). В отличие от предыдущего [`v2.19.0`](https://github.com/gravity-ui/icons/releases/tag/v2.19.0), это не релиз с новыми SVG: compare [`v2.19.0...v2.20.0`](https://github.com/gravity-ui/icons/compare/v2.19.0...v2.20.0) меняет `package.json`, Storybook-конфигурацию, CI и lockfile. Главная пользовательская правка — [PR #98](https://github.com/gravity-ui/icons/pull/98), который добавил `exports` map и сделал прямые импорты иконок ESM-aware.

Источники для статьи — GitHub Release [`v2.20.0`](https://github.com/gravity-ui/icons/releases/tag/v2.20.0), issue [#92](https://github.com/gravity-ui/icons/issues/92), PR [#98](https://github.com/gravity-ui/icons/pull/98), PR [#95](https://github.com/gravity-ui/icons/pull/95) и diff коммитов [`0c74bb9`](https://github.com/gravity-ui/icons/commit/0c74bb9c285550adef31535750d8c08fce619fac) / [`79f8684`](https://github.com/gravity-ui/icons/commit/79f86846278c0333a9c3290e3c3b6c7761e23fd4).

## Прямые импорты теперь указывают на ESM-сборку

До `v2.20.0` пакет уже публиковал ESM-файлы в директории `esm/` и объявлял:

```json
{
  "module": "esm/index.js"
}
```

Этого хватало для корневого импорта:

```tsx
import { ChevronLeft } from "@gravity-ui/icons";
```

Но для subpath-импортов вроде `@gravity-ui/icons/ChevronLeft` у пакета не было `exports` map. Как описано в issue [#92](https://github.com/gravity-ui/icons/issues/92), современные bundler'ы и Node резолвили такой путь в CJS-файл в корне пакета — `ChevronLeft.js`, а не в `esm/ChevronLeft.js`.

В `v2.20.0` в `package.json` появился явный `exports`:

```json
{
  "module": "esm/index.js",
  "exports": {
    ".": {
      "types": "./index.d.ts",
      "import": "./esm/index.js",
      "require": "./index.js"
    },
    "./*": {
      "types": "./*.d.ts",
      "import": "./esm/*.js",
      "require": "./*.js"
    },
    "./svgs/*": "./svgs/*",
    "./metadata.json": "./metadata.json",
    "./package.json": "./package.json"
  }
}
```

Практический эффект: один и тот же прямой импорт остаётся рабочим для CommonJS-потребителей через `require`, но ESM/bundler-сценарии теперь получают файл из `esm/`:

```tsx
import ChevronLeft from "@gravity-ui/icons/ChevronLeft";

export function BackButton() {
  return <ChevronLeft aria-hidden />;
}
```

Именно такие subpath-импорты часто используют библиотеки и дизайн-системы ради tree-shaking: они берут конкретную иконку, а не весь barrel `@gravity-ui/icons`.

## Исправлен interop-баг с double-wrapped default export

Issue [#92](https://github.com/gravity-ui/icons/issues/92) важен тем, что объясняет не только изменение `package.json`, но и реальный симптом. В проектах на Vite/esbuild импорт из прямого пути мог возвращать объект вместо React-компонента:

```ts
import ChevronLeft from "@gravity-ui/icons/ChevronLeft";

console.log(typeof ChevronLeft); // до v2.20.0: "object"
console.log(typeof ChevronLeft.default); // фактическая функция иконки
```

Причина — CJS-to-ESM interop вокруг TypeScript-style CJS output с `__esModule: true` и `exports.default = ...`: `default` оказывался вложенным внутрь внешней обёртки. Для React это заканчивается ошибкой вида «Element type is invalid: expected a string ... but got: object», потому что вместо компонента в JSX попадает объект.

После добавления `exports["./*"].import = "./esm/*.js"` тот же импорт должен резолвиться в ESM-версию и возвращать сам компонент:

```ts
import ChevronLeft from "@gravity-ui/icons/ChevronLeft";

console.log(typeof ChevronLeft); // после v2.20.0: "function"
```

В issue отдельно упоминались downstream-компоненты, которые используют прямые импорты для tree-shaking: `Carousel`, `FileTree`, `NumberStepper`, `CellSelect`, `InlineSelect` и `DropZone` из `@heroui-pro/react`. Для таких потребителей обновление `@gravity-ui/icons` снимает необходимость локально патчить `node_modules/@gravity-ui/icons/package.json` через `pnpm patch` или `patch-package`.

## Экспортированы не только компоненты, но и служебные пути

PR [#98](https://github.com/gravity-ui/icons/pull/98) добавил не только wildcard для иконок. В `exports` явно оставлены служебные публичные входы:

- `./svgs/*` — прямой доступ к опубликованным SVG-файлам;
- `./metadata.json` — каталог метаданных иконок;
- `./package.json` — чтение package metadata.

Это важная деталь для совместимости. После появления `exports` Node начинает считать неописанные subpath'и закрытыми, поэтому публичные пути нужно перечислять явно. В `v2.20.0` сценарии вроде чтения метаданных и SVG не должны ломаться:

```ts
import metadata from "@gravity-ui/icons/metadata.json";
import chevronLeftSvgUrl from "@gravity-ui/icons/svgs/chevron-left.svg";
```

При этом TypeScript-путь для прямых иконок остался прежним: `"types": "./*.d.ts"`. То есть `@gravity-ui/icons/ChevronLeft` продолжает получать декларацию из корневого `ChevronLeft.d.ts`, а runtime-ветка выбирается отдельно через `import` или `require`.

## Обновили инфраструктуру разработки: Node 24, Storybook 10, React 19

Второй feature-пункт релиза — [PR #95](https://github.com/gravity-ui/icons/pull/95), «update deps». Для runtime-пользователей пакета это не выглядит как миграция: `dependencies` по-прежнему содержит только `tslib: ^2.8.1`, `peerDependencies.react` остаётся `"*"`, а `sideEffects` — `false`.

Зато инфраструктура репозитория заметно обновилась:

- `.nvmrc` поднят с `20` до `24`;
- GitHub Actions (`ci.yml`, preview, release и sync workflows) теперь используют `node-version: 24` вместо Node 18/20;
- `@gravity-ui/uikit` в devDependencies обновлён с `^7.16.2` до `^7.43.0`;
- Storybook-пакеты перешли с ветки `9.0.15` на `10.4.6`;
- dev-React и типы подняты с React 18 до React 19 (`react`/`react-dom: ^19.2.7`, `@types/react: ^19.2.17`);
- `eslint` обновлён с `^9.30.1` до `^9.39.4`.

Storybook-конфигурация тоже изменилась не только из-за версий. Из addon'ов убран `@storybook/addon-styling-webpack`, а CSS/SCSS-правило теперь добавляется через `webpackFinal`. Там же явно выключена `optimization.sideEffects`: комментарий в diff говорит, что webpack 5.108+ с «lazy barrel» может отложить `import './Component.css'` в sideEffects-free пакетах вроде `@gravity-ui/uikit`, из-за чего CSS компонента не загружается.

## Как обновиться

Для приложений, которые импортируют иконки только из корня пакета, обновление выглядит как обычный minor-релиз:

```bash
pnpm add @gravity-ui/icons@2.20.0
```

Главный повод обновиться быстрее — если в проекте или в зависимостях есть прямые импорты иконок:

```tsx
import ChevronLeft from "@gravity-ui/icons/ChevronLeft";
```

В `v2.20.0` такие импорты получили явную ESM-ветку через `exports`, поэтому Vite/esbuild-сценарии больше не должны упираться в CJS double-wrapping и React-ошибку про объект вместо компонента. Новых иконок и breaking changes для публичных React-компонентов в compare этого релиза не видно.

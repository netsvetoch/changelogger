---
author: Артём Нецветаев
pubDatetime: 2026-06-29T00:24:34.000Z
title: "@gravity-ui/date-utils 2.7.0: сборка под ES2022 и без lodash"
slug: gravity-ui-date-utils-v2-7-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - date-utils
description: "Разбор минорного релиза @gravity-ui/date-utils v2.7.0: TypeScript target поднят с ES5 до ES2022, module/moduleResolution переведены на node16, cloneDeep заменён на structuredClone, а lodash и @types/lodash удалены из зависимостей."
---

`@gravity-ui/date-utils` выпустил минорный релиз [`v2.7.0`](https://github.com/gravity-ui/date-utils/releases/tag/v2.7.0). В changelog он описан одной строкой — «modernize build target to ES2022», но diff показывает несколько конкретных последствий для пользователей пакета и для окружений, в которых он собирается.

Источник для обзора — GitHub Release [`gravity-ui/date-utils@v2.7.0`](https://github.com/gravity-ui/date-utils/releases/tag/v2.7.0), compare [`v2.6.1...v2.7.0`](https://github.com/gravity-ui/date-utils/compare/v2.6.1...v2.7.0), PR [`#94`](https://github.com/gravity-ui/date-utils/pull/94) и merge commit [`c2d3af8`](https://github.com/gravity-ui/date-utils/commit/c2d3af8cf6e9c8ae846ea6b4d1f07eb405411d90).

## TypeScript теперь проверяет пакет как ES2022 + Node16 modules

Главное изменение находится в `tsconfig.json`. До релиза `2.7.0` проект проверялся с `target: "es5"`, `module: "ESNext"`, `moduleResolution: "Node10"` и `verbatimModuleSyntax: true`. Теперь конфигурация выглядит так:

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "node16",
    "moduleResolution": "node16"
  }
}
```

Это не добавляет новый публичный метод в `date-utils`, но меняет контракт сборки: исходники больше не типизируются как старый ES5-код, а TypeScript использует модель модулей Node16. Для приложений на современных bundler’ах это обычно незаметно, но если downstream-проект сам транспилирует зависимости из `node_modules` под старые браузеры или старый runtime, `@gravity-ui/date-utils@2.7.0` стоит явно прогонять через свой transpile-пайплайн.

## В publish-конфиге убрали переопределения module/moduleResolution

В `tsconfig.publish.json` тоже стало меньше ручных override’ов. Раньше publish-сборка отдельно выставляла `module: "NodeNext"`, `moduleResolution: "NodeNext"` и `verbatimModuleSyntax: false`; в `2.7.0` остались только `noEmit: false`, `declaration: true` и `outDir: "build"`.

Практический эффект: сборка деклараций и JS теперь наследует общую modernized-конфигурацию из основного `tsconfig`, а не живёт с отдельной NodeNext-настройкой. Скрипт публикации при этом не изменился: пакет по-прежнему собирается командой `tsc -p tsconfig.publish.json`, а опубликованные артефакты лежат в `build`.

## `settings.getLocaleData()` больше не тянет lodash

Единственное изменение в runtime-коде — замена `lodash/cloneDeep` на нативный `structuredClone` в `src/settings/settings.ts`. До релиза метод `settings.getLocaleData()` клонировал объект локали через lodash:

```ts
return cloneDeep(localeObject) as Locale;
```

В `2.7.0` та же защита от мутации внутреннего объекта локали реализована через стандартный API платформы:

```ts
return structuredClone(localeObject) as Locale;
```

Для пользователей это важно в двух местах:

- сам публичный API `settings.getLocaleData()` не переименован и по-прежнему возвращает копию данных локали;
- runtime, где выполняется пакет, должен иметь `structuredClone` или получать его через транспиляцию/полифилл окружения.

Минимальная проверка поведения на стороне приложения остаётся такой же: объект, полученный из `getLocaleData()`, можно читать и модифицировать локально, не полагаясь на то, что это ссылка на внутреннее состояние `dayjs`.

```ts
import { settings } from "@gravity-ui/date-utils";

const localeData = settings.getLocaleData();
localeData.weekStart = 0;

// Для реального изменения настроек пакета по-прежнему нужен явный вызов:
settings.updateLocale({ weekStart: 0 });
```

## `lodash` удалён из production dependencies

После перехода на `structuredClone` из `package.json` исчезли две зависимости:

```diff
-"@types/lodash": "^4.17.7"
-"lodash": "^4.17.0"
```

В `dependencies` теперь остался только `dayjs@1.11.10`. Это уменьшает граф зависимостей пакета: установка `@gravity-ui/date-utils` больше не должна подтягивать `lodash` только ради deep clone в настройках локали.

Для обновления достаточно поставить новую версию пакета:

```bash
npm install @gravity-ui/date-utils@2.7.0
```

Если ваше приложение импортировало `lodash` напрямую, это изменение его не заменяет и не удаляет из вашего проекта. Речь только о зависимости самого `@gravity-ui/date-utils`.

## Intl-типы теперь покрываются новой целью сборки

Ещё две маленькие правки в diff показывают, зачем понадобилась модернизация target’а. В `src/timeZone/timeZone.ts` удалён `@ts-expect-error` перед `Intl.supportedValuesOf?.('timeZone')`, а в `src/utils/locale.ts` удалены `@ts-expect-error` вокруг `Intl.ListFormat` и `Intl.ListFormatOptions`.

То есть код не меняет публичные функции `getTimeZonesList()` или внутренний cache для `Intl.ListFormat`, но TypeScript-конфигурация теперь достаточно современная, чтобы эти Intl API типизировались без подавления ошибок.

## Кому обратить внимание при обновлении

Релиз полезен тем, кто хочет более лёгкий dependency graph и современную сборку Gravity UI date helpers. Основной риск — старые runtime’ы: `structuredClone`, `Intl.supportedValuesOf` и `Intl.ListFormat` относятся к современным Web/Node API, а сам пакет теперь проверяется с `target: "es2022"`.

Если приложение собирается только под актуальные браузеры или современный Node, обновление выглядит безопасным: публичные функции `dateTime`, `dateTimeParse`, `settings`, `getTimeZonesList()` и остальные API из diff не переименовывались. Если же вы поддерживаете legacy-браузеры, проверьте, что ваш bundler транспилирует `@gravity-ui/date-utils` и что для `structuredClone` есть поддержка или полифилл.

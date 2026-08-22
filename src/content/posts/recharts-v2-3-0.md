---
author: Артём Нецветаев
pubDatetime: 2026-08-22T13:25:00.000Z
title: "Recharts 2.3.0: закрытие уязвимости d3 через victory-vendor и миграция тестов на Jest"
slug: recharts-v2-3-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
  - security
description: "Разбор Recharts 2.3.0: устранение уязвимости d3 заменой esm-зависимостей на CJS-версию из victory-vendor, типобезопасный refactor ReactUtils и крупная миграция тестов с karma на Jest."
---

Главная причина релиза Recharts 2.3.0 — не новые фичи, а безопасность. Более ранние `d3`-зависимости пакета содержали известную уязвимость, которую нельзя было закрыть точечным патчем в ветке 2.x: новые версии `d3` поставляются только как ESM, тогда как потребители Recharts используют Jest, Next.js и другие cjs-окружения. Решение — заменить прямые `d3`-зависимости на `victory-vendor`, который предоставляет cjs-совместимые пропатченные версии `d3`.

Источник — [GitHub Release `recharts/recharts@v2.3.0`](https://github.com/recharts/recharts/releases/tag/v2.3.0) и [сравнение с v2.2.0](https://github.com/recharts/recharts/compare/v2.2.0...v2.3.0). Детали ниже проверены по связанным PR: [#3167](https://github.com/recharts/recharts/pull/3167), [#3152](https://github.com/recharts/recharts/pull/3152) и остальным из release notes.

## Исправление уязвимости: d3 заменён на victory-vendor

PR [#3167](https://github.com/recharts/recharts/pull/3167) (закрывает issue [#3012](https://github.com/recharts/recharts/issues/3012)) убирает прямые зависимости `d3-interpolate`, `d3-scale` и `d3-shape` из `dependencies` пакета и добавляет единственную зависимость `victory-vendor` (`^36.6.8`) — пакет, который вендорит собранные UMD/CJS-версии `d3`. Это позволило:

- использовать **пропатченные** (без уязвимости) версии `d3` в ветке v2.x, не ломая cjs-потребителей;
- сохранить безопасность, пока релиз 3.0 не сделает breaking change и не вернётся к esm-only `d3`.

Внутренние импорты переписаны с `d3-*` на пространство `victory-vendor/d3-*`:

```ts
import {
  curveStep,
  curveStepAfter,
  curveStepBefore,
} from "victory-vendor/d3-shape";
// вместо: from 'd3-shape'
import { scalePoint, ScalePoint } from "victory-vendor/d3-scale";
// вместо: from 'd3-scale'
```

Также из поля `files` в `package.json` убраны каталоги `demo` и `src` — они добавляли лишний объём в публикуемый в npm пакет. Собранный пакет теперь содержит только `es6`, `lib`, `umd` и `types`. В dev-зависимостях `@types/d3-*` подняты до версий 3.x, а `d3-scale-chromatic` — с `^2.0.0` до `^3.0.0`.

## TypeScript-рефакторринг поиска компонентов по типу

PR [#3152](https://github.com/recharts/recharts/pull/3152) делает внутренние функции `findAllByType` и `findChildByType` из `src/util/ReactUtils.ts` дженерик-функциями: они теперь принимают `React.ComponentType` вместо произвольной `string`, что позволяет корректно выводить тип `Props` в возвращаемом значении и уменьшает количество `any` в кодовой базе. Внутренний API Recharts не менялся для конечных пользователей, но это важный шаг к более строгой типизации.

Попутно в `appendOffsetOfLegend` исправлено сравнение `verticalAlign`: значение `"center"` не входит в допустимый набор `VerticalAlignmentType` (`'top' | 'bottom' | 'middle'`), поэтому заменено на `"middle"`.

## Миграция тестов с karma на Jest

В этой версии продолжается большая миграция тестового окружения с karma на Jest — мигрированы тесты `Area`, `FunnelChart`, `ResponsiveContainer`, `LineChart`, а также утилит `DataUtils`, `ChartUtils` и компонентов `Cell`, `Label`, `LabelList`. Добавлена поддержка coverage в Jest (PR [#3164](https://github.com/recharts/recharts/pull/3164)), чтобы окружения jest и karma не конфликтовали при запуске.

## Что стоит отметить

Из этого релиза намеренно **исключён** мемоизирующий рефакторинг функций `ResponsiveContainer`. Он присутствовал в черновике, но в финальном 2.3.0 **отменён**: запись в release notes зачёркнута и помечена как reverted в 2.3.1. Искать его в этой версии не нужно.

## Итоги

- Версия: **2.3.0** (minor)
- Ключевое изменение: закрыта уязвимость `d3` за счёт перехода на `victory-vendor` cjs-версии — без breaking change для конечных пользователей.
- Refactor: дженерик-типизация внутренних `findAllByType`/`findChildByType`.
- Инфраструктура: продолжена миграция тестов на Jest, в `files` пакета убраны `demo` и `src`.
- Заложено направление на breaking change 3.0: возврат к esm-only `d3`.

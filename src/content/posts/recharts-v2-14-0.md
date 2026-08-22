---
author: Артём Нецветаев
pubDatetime: 2026-08-22T15:51:28.000Z
title: "Recharts 2.14.0: top-level onDoubleClick и onContextMenu у всех категориальных графиков и уточнение типов LabelList/Pie"
slug: recharts-v2-14-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 2.14.0 (minor): новый top-level проп onDoubleClick и onContextMenu у всех категориальных графиков (Area, Line, Bar, Scatter, Pie, Radar, RadialBar, Funnel), уточнение типов — dataKey у LabelList принимает любой объект, а PieSectorDataItem.payload стал объектом, а не массивом."
---

Recharts 2.14.0 (minor) — небольшой релиз, который добавляет два недостающих «события уровня графика» (`onDoubleClick` и `onContextMenu`) и закрывает пару точечных проблем с TypeScript-типами. Автор релиза отмечает, что основная работа идёт над `3.x`, а на ветке `2.x` изменения сознательно минимальные.

Источник — [GitHub Release `recharts/recharts@v2.14.0`](https://github.com/recharts/recharts/releases/tag/v2.14.0) и [сравнение с v2.13.3](https://github.com/recharts/recharts/compare/v2.13.3...v2.14.0). Детали проверены по PR: [#5255](https://github.com/recharts/recharts/pull/5255) (события), [#5252](https://github.com/recharts/recharts/pull/5252) (тип `dataKey` у `LabelList`), [#5263](https://github.com/recharts/recharts/pull/5263) (тип `payload` у `PieSectorDataItem`) и их diff-ам. Обычный changelog-релиз, не ссылка на отдельный официальный анонс.

## Новое в API

### Top-level события `onDoubleClick` и `onContextMenu`

**feat** ([PR #5255](https://github.com/recharts/recharts/pull/5255), issue [#5254](https://github.com/recharts/recharts/issues/5254)) — раньше эти обработчики можно было навешивать только на конкретные графические элементы; на обёртку категориального графика их передать нельзя было. Теперь все категориальные графики (`AreaChart`, `LineChart`, `BarChart`, `ScatterChart`, `PieChart`, `RadarChart`, `RadialBarChart`, `FunnelChart`) поддерживают два новых пропа уровня графика:

- `onDoubleClick?: CategoricalChartFunc`
- `onContextMenu?: CategoricalChartFunc`

Оба живут в `CategoricalChartProps` в `src/chart/generateCategoricalChart.tsx` рядом с уже существующими `onClick`/`onMouseDown`/`onMouseUp`, а внутренние обработчики (`handleDoubleClick`, `handleContextMenu`) используют `this.getMouseInfo(e)` — то есть получают состояние графика (`CategoricalChartState`), как и остальные обработчики мыши, а не только «сырое» DOM-событие:

```tsx
<AreaChart
  data={data}
  onContextMenu={(state, e) => {
    e.preventDefault(); /* ПКМ по графику */
  }}
  onDoubleClick={(state, e) => {
    e.preventDefault(); /* двойной клик */
  }}
>
  {/* ... Area, Tooltip и т.п. ... */}
</AreaChart>
```

Чтобы события доходили до компонента-обёртки, в мапу браузерных событий добавлены `contextmenu: 'onContextMenu'` и `dblclick: 'onDoubleClick'` (`src/util/ReactUtils.ts`). Типичная задача из issue — «сделать действие по двойному клику или по правой кнопке мыши на обёртке линий/областей». Поведение покрыто новым тестовым сьютом `test/chart/CategoricalChart.spec.tsx` (все восемь видов графиков) и storybook-примером `StackedAreaChartWithMouseEvents`.

## Исправления типов

### `LabelList`: `dataKey` принимает любой объект

**fix** ([PR #5252](https://github.com/recharts/recharts/pull/5252), issue [#5245](https://github.com/recharts/recharts/issues/5245)) — тип `dataKey` у `LabelList` был слишком узким: `DataKey<T>`. В реальных данных, где за `dataKey` кроется произвольный объект, TypeScript ошибался. Тип расширен до `DataKey<Record<string, any>>` (`src/component/LabelList.tsx`) — теперь `dataKey` в `LabelList` принимает любой объект-источник, а не только элемент массива данных на основе обобщения.

### `Pie`: `PieSectorDataItem.payload` — объект, а не массив

**fix** ([PR #5263](https://github.com/recharts/recharts/pull/5263), issue [#5261](https://github.com/recharts/recharts/issues/5261)) — тип `payload` у сектора диаграммы был помечен как `any[]`, хотя на деле это исходная точка данных (объект). Тип исправлен на `any` (`src/polar/Pie.tsx`):

```ts
export type PieSectorDataItem = SectorProps & {
  value?: number;
  paddingAngle?: number;
  dataKey?: string;
  payload?: any; // было: any[]
};
```

Изменение приходит из ветки `3.x` (бэкпорт уже исправленной там типизации) и формально сужает возможность «массива-как-payload», при этом код, который во время рендера реально сохранял объект данных, становится типизирован корректно.

## Итоги

- Версия: **2.14.0** (minor), без намеренных breaking change в публичном API.
- **Новые события уровня графика**: `onDoubleClick` и `onContextMenu` для всех категориальных графиков (Area, Line, Bar, Scatter, Pie, Radar, RadialBar, Funnel) — PR [#5255](https://github.com/recharts/recharts/pull/5255).
- **Fix типов**: `dataKey` у `LabelList` теперь принимает любой объект ([#5252](https://github.com/recharts/recharts/pull/5252)); `PieSectorDataItem.payload` — объект вместо массива ([#5263](https://github.com/recharts/recharts/pull/5263)).
- Релиз «на поддержание» ветки `2.x`; новых пропсов кроме двух событий нет, активная разработка идёт на `3.x`.

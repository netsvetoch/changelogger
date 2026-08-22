---
author: Артём Нецветаев
pubDatetime: 2026-08-22T17:43:44.000Z
title: "Recharts 3.5: проп shape у Pie вместо active/inactiveShape, reverseStackOrder для стековых графиков"
slug: recharts-v3-5-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 3.5.0 (minor): единый проп `shape` у Pie, вытесняющий `activeShape`/`inactiveShape` (состояние через `isActive`), реализация `reverseStackOrder` в Redux-архитектуре v3, экспорт типов `ActiveDotProps`/`DotItemDotProps` из корня пакета, серия оптимизаций производительности и фиксы Legend, ErrorBar, Line и Area."
---

Recharts 3.5.0 — минорный релиз. Главное изменение API — у `Pie` появился единый проп `shape`, который приходит на замену `activeShape`/`inactiveShape` и приводит нарезку секторов к тому же паттерну, что у `Bar`/`Area`/`Line`. Кроме того, в Redux-архитектуре v3 наконец заработал проп `reverseStackOrder` для стековых графиков (регрессия против v2.15.4), из корня пакета теперь экспортируются типы `ActiveDotProps` и `DotItemDotProps`, и в релизе собрана заметная порция оптимизаций производительности.

Источник: GitHub Release [`recharts/recharts@v3.5.0`](https://github.com/recharts/recharts/releases/tag/v3.5.0). Небольшое уточнение по источнику: в теле этого релиза базовая метка указана как `v3.4.2` (в т.ч. в ссылке Full Changelog), однако тег `v3.4.2` указывает на тот же коммит, что и `v3.5.0`, — реальный diff релиза это [compare v3.4.1...v3.5.0](https://github.com/recharts/recharts/compare/v3.4.1...v3.5.0) на 49 коммитов. Описанные ниже изменения проверены по этому диапазону, телам связанных PR и исходникам на теге `v3.5.0`.

## `Pie.shape`: один проп вместо `activeShape`/`inactiveShape`

[#6482](https://github.com/recharts/recharts/pull/6482) добавляет `Pie` проп `shape` (тип `PieShape` в `src/polar/Pie.tsx`):

```ts
type PieShape =
  ReactNode | ((props: PieSectorShapeProps) => React.ReactElement);
type PieSectorShapeProps = PieSectorDataItem & { isActive: boolean };
```

Проп `activeShape` и `inactiveShape` в этой версии помечены `@deprecated` (обратная совместимость сохранена). Разница в том, как теперь выражается «активное» состояние сектора: раньше в зависимости от индекса активного сектора подставлялся то `activeShape`, то `inactiveShape`, а теперь состояние приходит в колбэк как булев `isActive`. То есть обработка «активной» и «неактивной» формы вынесена в сам кастомный компонент сектора:

```tsx
import { Pie, type PieSectorDataItem } from "recharts";

function Sector(props: PieSectorDataItem & { isActive: boolean }) {
  const { isActive, ...rest } = props;
  return <path {...rest} fill={isActive ? "#8884d8" : "#dddddd"} />;
}

<Pie data={data} dataKey="value" shape={props => <Sector {...props} />} />;
```

Внутри `Shape` рендерится через `<Shape option={shape ?? sectorOptions} shapeType="sector" isActive={isActive} {...sectorProps} />`, поэтому колбэк и `ReactNode` получают ту же `isActive`. Известное ограничение v3.5.0: в `props` колбэка пока не передаётся индекс текущего сектора (авторы отметили это в релизе, индекс обещают добавить в 3.5.1).

## `reverseStackOrder` снова работает в v3

[#6644](https://github.com/recharts/recharts/pull/6644) чинит регрессию: проп `reverseStackOrder` был объявлен в типах, но не был реализован в Redux-архитектуре v3 и потому не влиял на отрисовку (в v2.15.4 он работал). Теперь он проведён через всю архитектуру:

- `reverseStackOrder` добавлен в `UpdatableChartOptions` в `rootPropsSlice.ts`;
- `CartesianChart` и `PolarChart` передают его в `ReportChartProps`;
- `combineStackGroups` в `axisSelectors.ts` разворачивает порядок стековых групп при `reverseStackOrder={true}`;
- параметр также проброшен в `tooltipSelectors.ts` и `radialBarSelectors.ts`.

Влияет на порядок отрисовки (SVG-layering) стековых серий — применимо к стековым `Bar` и `RadialBar`:

```tsx
<BarChart data={data}>
  <XAxis dataKey="name" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Bar stackId="a" dataKey="pv" fill="#8884d8" />
  <Bar stackId="a" dataKey="uv" fill="#82ca9d" reverseStackOrder />
</BarChart>
```

Значение по умолчанию — `false`, то есть текущее поведение не меняется; включение опции меняет только порядок слоёв.

## Экспорт типов `ActiveDotProps` и `DotItemDotProps` из корня пакета

[#6657](https://github.com/recharts/recharts/pull/6657) — DX-правка: типы `ActiveDotProps` и `DotItemDotProps` теперь экспортируются из основного входа `src/index.ts`:

```ts
export type { ActiveDotProps } from "./util/types";
export type { DotItemDotProps } from "./util/types";
```

Раньше их приходилось импортировать «глубоким» путём `recharts/types/util/types`, который не считается стабильным публичным API. Теперь можно:

```ts
import type { ActiveDotProps, DotItemDotProps } from "recharts";
```

## Производительность и новый гайд

Три PR с оптимизациями от @PavelVanecek:

- [#6616](https://github.com/recharts/recharts/pull/6616) — оптимизирован `SetTooltipEntrySettings`, что разрывает бесконечный цикл повторного рендера;
- [#6634](https://github.com/recharts/recharts/pull/6634) — «разные» улучшения производительности (включая правки в пути рендера);
- [#6654](https://github.com/recharts/recharts/pull/6654) — ещё порция оптимизаций.

Вместе с этим в релизе добавлен официальный гайд по производительности — [https://recharts.github.io/en-US/guide/performance/](https://recharts.github.io/en-US/guide/performance/) ([#6659](https://github.com/recharts/recharts/pull/6659)).

## Исправления

- **`Line`** ([#6641](https://github.com/recharts/recharts/pull/6641)) — исправлена анимация, когда она прерывается изменениями, не связанными с данными.
- **`Line`/`Area`** ([#6612](https://github.com/recharts/recharts/pull/6612)) — активная точка (`activeDot`) больше не рисуется за пределами графика.
- **`Legend`** ([#6609](https://github.com/recharts/recharts/pull/6609)) — `Legend` с внешним `portal` больше не корректирует margin графика (раньше оставалось пустое место).
- **`ErrorBar`** ([#6660](https://github.com/recharts/recharts/pull/6660)) — убрано предупреждение о дублирующемся key, когда диапазон ошибки имеет одинаковые значения.
- **`PolarAngleAxis`** ([#6611](https://github.com/recharts/recharts/pull/6611)) — тики `0` и `360` больше не накладываются друг на друга.
- **`Typescript/Area`** ([#6621](https://github.com/recharts/recharts/pull/6621)) — проп `Area.label` получил конкретный тип вместо `any`.
- **`General`** ([#6619](https://github.com/recharts/recharts/pull/6619)) — иммьютабельная проверка отключена в production, что убирает лишние консольные предупреждения.
- Вспомогательные правки в диапазоне: прекращено распространение `key` и внутренних атрибутов на SVG-элементы ([#6614](https://github.com/recharts/recharts/pull/6614), [#6620](https://github.com/recharts/recharts/pull/6620)) и включён строгий TypeScript ([#6646](https://github.com/recharts/recharts/pull/6646)).

## Итоги

- **Версия:** 3.5.0 (minor). Breaking-изменений нет: `activeShape`/`inactiveShape` пока работают, но помечены `@deprecated` — их стоит начать переносить на `shape`.
- **`Pie.shape`:** единый проп для кастомной формы секторов с `isActive` в колбэке ([#6482](https://github.com/recharts/recharts/pull/6482)); индекса сектора в колбэке пока нет (добавят в 3.5.1).
- **`reverseStackOrder`:** реализован в Redux-архитектуре v3, работает для стековых `Bar`/`RadialBar` ([#6644](https://github.com/recharts/recharts/pull/6644)).
- **Типы:** `ActiveDotProps` и `DotItemDotProps` экспортируются из `recharts` ([#6657](https://github.com/recharts/recharts/pull/6657)).
- **Производительность:** оптимизации `SetTooltipEntrySettings` и др. + официальный гайд [performance](https://recharts.github.io/en-US/guide/performance/) ([#6616](https://github.com/recharts/recharts/pull/6616), [#6634](https://github.com/recharts/recharts/pull/6634), [#6654](https://github.com/recharts/recharts/pull/6654), [#6659](https://github.com/recharts/recharts/pull/6659)).
- Полный список изменений: [compare v3.4.1...v3.5.0](https://github.com/recharts/recharts/compare/v3.4.1...v3.5.0).

**Стоит ли обновляться.** Да. Главное — заработал давно обещанный `Pie.shape` (позволяет делать активные/неактивные сектора тем же способом, что кастомные формы у других компонентов), а `reverseStackOrder` восстанавливает поведение v2 для стековых графиков. Плюс заметное снижение нагрузки при рендере тултипов. Установка:

```bash
npm install recharts@3.5.0
```

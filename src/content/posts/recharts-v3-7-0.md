---
author: Артём Нецветаев
pubDatetime: 2026-08-22T18:15:00.000Z
title: "Recharts 3.7: Cell устарел, новые инструментальные хуки Tooltip, тип оси «auto» и типизация Bar.shape"
slug: recharts-v3-7-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 3.7.0 (minor): компонент `Cell` объявлен устаревшим в пользу пропа `shape`, заведены хуки `useIsTooltipActive` и `useActiveTooltipCoordinate`, для `XAxis`/`YAxis` появился тип оси `'auto'` (а для полярных осей он стал дефолтом), `Tooltip.offset` принимает объект-координату, а `Bar.shape` наконец корректно типизирован через новый `BarShapeProps`. Плюс серия фиксов `stackOffset=sign` и строгий tsconfig."
---

Recharts 3.7.0 — минорный релиз, но с важным сигналом на будущее: компонент `Cell` официально объявлен устаревшим и будет удалён в следующем major-релизе. Вместе с этим добавлены хуки для чтения состояния тултипа, новое значение `type="auto"` для осей (для полярных осей оно стало дефолтом и чинит их «из коробки»), а у `Bar.shape` наконец появилась корректная типовая сигнатура.

Источник: GitHub Release [`recharts/recharts@v3.7.0`](https://github.com/recharts/recharts/releases/tag/v3.7.0). Все изменения проверены по телам связанных PR и исходникам на теге `v3.7.0`.

## ⚠️ `Cell` устарел — переходим на `shape`

Главное изменение релиза ([#6904](https://github.com/recharts/recharts/pull/6904)): компонент `Cell` помечен `@deprecated` и будет удалён в v4.0. Через `Cell` в речартсе исторически задавалась кастомизация отдельных элементов — например, свой цвет каждому сектору `Pie` или каждому бару `Bar`. Теперь вместо этого нужно использовать проп `shape` соответствующего элемента, а содержимое `Cell` переезжает в рендер-функцию формы.

До (со старым `Cell`):

```tsx
<PieChart>
  <Pie data={data} dataKey="value">
    <Cell fill="#0088FE" />
    <Cell fill="#00C49F" />
    <Cell fill="#FFBB28" />
  </Pie>
</PieChart>
```

После (проп `shape`):

```tsx
const COLORS = ["#0088FE", "#00C49F", "#FFBB28"];

<PieChart>
  <Pie
    data={data}
    dataKey="value"
    shape={props => (
      <Sector {...props} fill={COLORS[props.payload.name % COLORS.length]} />
    )}
  />
</PieChart>;
```

В рамках миграции все примеры на сайте, использовавшие `Cell`, переведены на `shape`, а в документацию добавлен отдельный гайд [Cell deprecation notice](https://recharts.github.io/en-US/guide/cellDeprecation/). Попутно в `Scatter.shape` добавлен параметр `index`, которого раньше не хватало, и экспортирован новый тип `ScatterShapeProps` (по аналогии с `PieSectorShapeProps` из 3.6.0), а также `ScatterPointNode` и `SymbolType`.

Само устаревание пока некритично — `Cell` продолжает работать до v4.0, но новые проекты стоит сразу писать через `shape`.

## Хуки тултипа: `useIsTooltipActive` и `useActiveTooltipCoordinate`

В 3.6.0 появились `useActiveTooltipLabel` и другие инструментальные хуки; в 3.7.0 ([#6880](https://github.com/recharts/recharts/pull/6880), закрывает #6299) этот набор дополнен ещё двумя полезными для кастомных тултипов и внешней синхронизации:

```ts
// boolean — активен ли сейчас тултип (есть ли активное наведение)
useIsTooltipActive(): boolean;

// Coordinate | undefined — { x, y } активного тултипа или undefined, если взаимодействия нет
useActiveTooltipCoordinate(): Coordinate | undefined;
```

Оба — селекторы над redux-состоянием графика, поэтому их нужно вызывать внутри контекста графика. `useIsTooltipActive` возвращает `false` вне активного взаимодействия; `useActiveTooltipCoordinate` — `undefined`, если пользователь не навёл курсор (или хук вызван вне графика). Оба помечены `@since 3.7` и хорошо сочетаются с уже существовавшими `useActiveTooltipLabel`/`useActiveTooltipDataPoints` для построения полностью кастомного тултипа:

```tsx
import {
  Tooltip,
  useIsTooltipActive,
  useActiveTooltipCoordinate,
} from "recharts";

function CustomTooltip() {
  const active = useIsTooltipActive();
  const coords = useActiveTooltipCoordinate();
  if (!active || coords == null) return null;
  return (
    <g pointerEvents="none">
      <circle cx={coords.x} cy={coords.y} r={4} fill="tomato" />
    </g>
  );
}
```

Речартс допускает только один `Tooltip` на график, поэтому хуки не принимают параметров.

## Оси: новый тип `type="auto"` (и дефолт для полярных)

[#6823](https://github.com/recharts/recharts/pull/6823) добавляет для `XAxis`/`YAxis` новое значение пропа `type` — строку `"auto"`. Она автоматически выбирает тип оси: `"category"` для категориальных осей и `"number"` для числовых. Для `XAxis`/`YAxis` это значение доступно, но дефолтным оно **не** становится (изменение дефолта здесь посчитали breaking-изменением и отложили до v4.0):

```tsx
<XAxis dataKey="name" type="auto" />
<YAxis type="auto" />
```

А вот для полярных осей `PolarAngleAxis` и `PolarRadiusAxis` значение `"auto"` теперь установлено по умолчанию — и это, по словам автора, починка давно сломанного поведения: раньше «умные» дефолты этих осей работали не полностью, из-за чего неявные оси (когда `PolarAngleAxis` не указан в JSX) и явные `<PolarAngleAxis />` могли давать разные графики. Теперь они совпадают.

## `Bar.shape`: корректная типизация через `BarShapeProps`

В 3.6.0 мы писали кастомные формы для `Pie` через `PieSectorShapeProps`. Аналогичную проблему долго имел `Bar`: проп `shape` типизировался как `ActiveShape<BarProps, ...>`, однако в рендер-функцию на самом деле передавались совсем другие поля (`x`, `y`, `width`, `height`, `value` из `BarRectangleItem`), из-за чего приходилось использовать `@ts-expect-error`. В 3.7.0 ([#6900](https://github.com/recharts/recharts/pull/6900), закрывает #6645/#6889) добавлен отдельный тип:

```ts
type BarShapeProps = BarRectangleItem & {
  isActive: boolean;
  index: number;
  option?: ActiveShape<BarShapeProps, SVGPathElement> | undefined;
};
```

Теперь `shape`, `activeBar` и `background` у `Bar` типизированы как `ActiveShape<BarShapeProps, ...>`, а в сигнатуру добавлен `index`, которого раньше не хватало. Пример из официальных гайдов — кастомная «треугольная» форма бара:

```tsx
import { Bar, BarChart, BarShapeProps, XAxis, YAxis } from "recharts";

function TriangleBar({ fill, x, y, width, height }: BarShapeProps) {
  if (x == null || y == null || width == null || height == null) return null;
  return (
    <path
      d={`M${x},${y + height} C${x + width / 2},${y + height / 3} ... Z`}
      fill={fill}
    />
  );
}

<BarChart data={data}>
  <XAxis dataKey="name" />
  <YAxis />
  <Bar dataKey="uv" fill="#8884d8" shape={<TriangleBar />} />
</BarChart>;
```

Заодно поправлен сам тип `ActiveShape`: компонентная фабрика теперь возвращает `ReactElement | null | undefined` вместо строгого `JSX.Element`, поэтому функциям формы больше не нужно возвращать пустой фрагмент `<></>` ради типов.

## `Tooltip.offset` принимает объект-координату

[#6868](https://github.com/recharts/recharts/pull/6868) расширяет тип пропа `offset` у `Tooltip` с одного числа до `number | Coordinate`, где `Coordinate = { x: number; y: number }`. Раньше сдвиг тултипа задавался одним числом и применялся одинаково по обеим осям; теперь можно задать независимые горизонтальное и вертикальное смещения:

```tsx
// одинаково по x и y
<Tooltip offset={10} />

// разные смещения по осям
<Tooltip offset={{ x: 20, y: 0 }} />
```

Работает и с отрицательными значениями.

## Исправления

- **`stackOffset="sign"`** ([#6807](https://github.com/recharts/recharts/pull/6807), закрывает #6803) — починена отрисовка стопок баров с тремя и более положительными значениями в одной серии. Баг был следствием неудачного TypeScript-рефакторинга расчёта смещения.
- **`BarStack` и circular dependency под vite** ([#6777](https://github.com/recharts/recharts/pull/6777)) — устранена циклическая зависимость, из-за которой падала сборка с Vite.
- **`BarStack` + `stackOffset="sign"`** ([#6806](https://github.com/recharts/recharts/pull/6806)) — исправлен `clipPath` стопки баров в режиме знакового смещения.
- **Скругление активных баров стопки** ([#6906](https://github.com/recharts/recharts/pull/6906), закрывает #6890) — `BarStackClipLayer` снова применялся после того, как портал «стирал» clip, поэтому радиус (см. `BarStack.radius` из 3.6.0) теперь корректно виден и у активного бара.

## Служебное и инструментарий

- **TypeScript `strict` включён** ([#6842](https://github.com/recharts/recharts/pull/6842)) — часть планомерного ужесточения типизации; в цикле 3.6.0→3.7.0 добавлено много проверок на `undefined`.
- **Большой пласт экспортов публичных типов** ([#6852](https://github.com/recharts/recharts/pull/6852), закрывает #6291/#3619/#2899) — правило «всё, что достижимо из публичного API, должно быть экспортировано из корня пакета» доведено до автоматической проверки (AI-тест находит недостающие типы). Среди новых экспортов: `TooltipPayloadEntry`, `LabelListPropsWithPosition`, `PieShape`, `TreemapContentType`, полный набор типов Sankey (`SankeyProps`, `SankeyNodeProps`, `SankeyLinkProps`, `SankeyData`, `SankeyNodeOptions`), `SunburstData`, `SunburstChartProps`, а также утилитные `Coordinate`, `PolarCoordinate`, `NumberDomain`, `Margin`, `AxisDomainItem`, `Padding`, `CartesianViewBox`, `ActiveLabel`, `AxisId`, `AxisRange`.
- **Документация и devtools** — `XAxis`/`YAxis`/`ZAxis` теперь типизируют `tick` вместо `any` ([#6911](https://github.com/recharts/recharts/pull/6911)); продолжается автогенерация документации «omnidoc»; на сайт добавлены тёмная тема ([#6828](https://github.com/recharts/recharts/pull/6828)) и devtools на всех примерах для отладки ([#6804](https://github.com/recharts/recharts/pull/6804)).

## Итоги

- **Версия:** 3.7.0 (minor). Breaking-изменений нет. Главная новость для миграции — **депрекация `Cell`** ([#6904](https://github.com/recharts/recharts/pull/6904)): до v4.0 продолжайте использовать `Cell`, но новые селекторы `Pie`, `Bar`, `Scatter` лучше сразу писать через `shape`.
- **Хуки:** `useIsTooltipActive(): boolean` и `useActiveTooltipCoordinate(): Coordinate | undefined` ([#6880](https://github.com/recharts/recharts/pull/6880)).
- **Оси:** новый `type="auto"` для `XAxis`/`YAxis`; стал дефолтом для `PolarAngleAxis`/`PolarRadiusAxis` (чинит их поведение по умолчанию) ([#6823](https://github.com/recharts/recharts/pull/6823)).
- **`Bar`:** тип `BarShapeProps` (с `index`) вместо некорректных `BarProps` в `shape`/`activeBar`/`background` ([#6900](https://github.com/recharts/recharts/pull/6900)).
- **`Tooltip`:** `offset` теперь `number | { x, y }` ([#6868](https://github.com/recharts/recharts/pull/6868)).
- **Фиксы:** `stackOffset="sign"` для стопок ([#6807](https://github.com/recharts/recharts/pull/6807)), circular dependency `BarStack` под vite ([#6777](https://github.com/recharts/recharts/pull/6777)), `BarStack` `clipPath` ([#6806](https://github.com/recharts/recharts/pull/6806)), радиус на активных барах ([#6906](https://github.com/recharts/recharts/pull/6906)).
- **Типы:** массовый экспорт публичных типов из корня пакета ([#6852](https://github.com/recharts/recharts/pull/6852)), `strict` tsconfig ([#6842](https://github.com/recharts/recharts/pull/6842)).
- Полный список изменений: [compare v3.6.0...v3.7.0](https://github.com/recharts/recharts/compare/v3.6.0...v3.7.0).

**Стоит ли обновляться.** Да. Корректная типизация `Bar.shape` (без `@ts-expect-error`) и новые хуки тултипа заметно улучшают апи, а депрекация `Cell` — повод заранее спланировать миграцию на `shape` до выхода v4.0. Для пользователей полярных графиков дефолт `type="auto"` чинит поведение осей «из коробки». Установка:

```bash
npm install recharts@3.7.0
```

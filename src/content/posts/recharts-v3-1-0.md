---
author: Артём Нецветаев
pubDatetime: 2026-08-22T16:38:54.000Z
title: "Recharts 3.1: публичные хуки useOffset, usePlotArea и useActiveTooltipDataPoints"
slug: recharts-v3-1-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Разбор Recharts 3.1.0: новые публичные хуки useOffset (ChartOffset), usePlotArea (PlotArea) и useActiveTooltipDataPoints, исправления Legend, Bar, ResponsiveContainer, X/YAxis tickCount и Tooltip для нескольких графических элементов."
---

Recharts 3.1.0 — первый минорный релиз после крупного переписывания в 3.0. Он небольшой по масштабу: несколько новых хуков и точечные исправления багов (включая те, что появились в 3.x). Главная тема — ещё больше публичного доступа к внутреннему состоянию графика через хуки, начатого в 3.0.

Источник: GitHub Release [`recharts/recharts@v3.1.0`](https://github.com/recharts/recharts/releases/tag/v3.1.0). Для конкретики я проверил связанные PR и исходники на теге: все четыре новых хука экспортируются из корневого index (`src/index.ts`), а сигнатуры подтверждены в `src/hooks.ts` и `src/types.ts`.

## Новые публичные хуки

В 3.0 Recharts начал выносить чтение внутреннего Redux-состояния в хуки. В 3.1 этот набор расширился ещё тремя хуками — все они возвращают `undefined`, если используются вне контекста графика или пока нет активного взаимодействия.

### `useOffset()`

[#6057](https://github.com/recharts/recharts/pull/6057) добавил `useOffset`, который возвращает отступ (`ChartOffset`) — пустое пространство между краем графика и областью построения. Это то место, которое занимают оси, легенды и brush, плюс применённые к графику отступы.

```ts
import { useOffset } from "recharts";

function Space() {
  const off = useOffset();
  if (!off) return null;
  return <span>{off.left}px слева</span>;
}
```

Тип `ChartOffset` (из `src/types.ts`) — четыре readonly-числа:

```ts
type ChartOffset = {
  readonly top: number; // расстояние от верхнего края графика до plot area
  readonly bottom: number; // расстояние от нижнего края (это расстояние, не координата)
  readonly left: number; // от левого края графика до plot area
  readonly right: number; // от правого края (расстояние, может быть 0)
};
```

### `usePlotArea()`

Тот же PR экспортировал `usePlotArea`, возвращающий область построения данных — именно там рисуются бары, линии, точки scatter и т.д. Она вычисляется из размеров графика и отступа: `width` равно `chartWidth - offset.left - offset.right`, `height` — `chartHeight - offset.top - offset.bottom`, а `x`/`y` задают левый верхний угол области.

```ts
import { usePlotArea } from "recharts";

function PlotBounds() {
  const area = usePlotArea();
  if (!area) return null;
  return (
    <span>
      {area.x}, {area.y} · {area.width}×{area.height}
    </span>
  );
}
```

Оба хука пригодятся для рисования кастомных оверлеев, координатной сетки или любых элементов, которым нужны реальные границы рисования данных, а не всего контейнера.

### `useActiveTooltipDataPoints()`

[#6067](https://github.com/recharts/recharts/pull/6067) добавил `useActiveTooltipDataPoints`, который возвращает точки данных, показанные в данный момент в тултипе. Это типизированный вариант: `ReadonlyArray<T> | undefined`, где `T` — тип элемента ваших данных.

```ts
import { useActiveTooltipDataPoints } from "recharts";

type Row = { name: string; uv: number };

function Active() {
  const points = useActiveTooltipDataPoints<Row>();
  if (!points) return null;
  return <span>Активных точек: {points.length}</span>;
}
```

Хук следует пропсам `<Tooltip />`: если тултип присутствует в графике, он использует его настройки, иначе — настройки тултипа по умолчанию. Возвращается именно массив, потому что при `shared={true}` в одном графике может быть несколько графических элементов (например, несколько линий), и тултип показывает их одновременно.

## Исправления

### Legend: порядок элементов сохраняется после скрытия

[#6026](https://github.com/recharts/recharts/pull/6026) чинит `Legend`: раньше после скрытия и повторного показа элементов их порядок нарушался. Теперь элементы легенды остаются в исходном порядке, как до скрытия. Это заметно при часто используемых кликах по легенде, чтобы прятать серии.

### Bar: `payload` на `BarRectangleItem`

[#6029](https://github.com/recharts/recharts/pull/6029) возвращает `payload` как валидное свойство на типе `BarRectangleItem`. Это баг именно 3.x: `payload` присутствовал в данных событий бар-элементов, но пропал из типов. Теперь внутри обработчиков событий или кастомных shape у вас снова корректно типизирован доступ к исходному элементу данных.

```tsx
onClick={(entry) => console.log(entry.payload /* теперь валидно в типах */)}
```

### Accessibility: убран `role="application"`

[#6060](https://github.com/recharts/recharts/pull/6060) удаляет `role="application"` с wrapper-а Recharts. Это значение уже убирали во 2.x по соображениям доступности, но оно «вернулось» в 3.x. Семантически `role="application"` говорил скринридерам, что всё внутри — нестандартный интерфейс с собственными arrow-событиями, что ухудшало навигацию по странице.

### ResponsiveContainer: график теперь может уменьшаться

[#6068](https://github.com/recharts/recharts/pull/6068) исправляет давний баг: chart полностью заполнял ResponsiveContainer и не позволял контейнеру стать меньше. Подход скопирован из react-virtualized — добавляется обёртка нулевого размера с `overflow: visible`, чтобы внешний размер контейнера определялся не внутренним графиком, а родителем.

### X/YAxis: `tickCount` и `allowDecimals` при фиксированном domain

[#6070](https://github.com/recharts/recharts/pull/6070) чинит вычисление тиков в `getTickValuesFixedDomainFn`, когда domain оси не содержит ключевое слово `'auto'`. Раньше количество тиков могло заметно расходиться с запрошенным через `tickCount`, а `allowDecimals` игнорировался. После релиза число тиков ближе к тому, что запрошено пропсами (небольшое визуальное отличие от прошлого поведения).

### Tooltip: активные точки при нескольких графических элементах

[#6074](https://github.com/recharts/recharts/pull/6074) чинит активный тултип и точки (dots), когда в графике несколько графических элементов с собственными данными. Вместо повторного поиска по массиву по индексу теперь переиспользуется селектор `selectActiveTooltipDataPoints`, а поиск по данным идёт через `findEntryInArray`, который корректно находит записи по `dataKey`-лейблу — поиск по индексу массива не работал при нескольких графических элементах.

## Документация и мелочи

- [#6043](https://github.com/recharts/recharts/pull/6043): storybook-истории теперь можно открывать прямо в StackBlitz.
- [#6059](https://github.com/recharts/recharts/pull/6059): добавлена документация Hook Inspector — инспектора хуков, который показывает, что возвращают хуки в конкретный момент.
- [#6054](https://github.com/recharts/recharts/pull/6054): убран дублирующий `'square'` из summary `legendType` компонента `Pie`. Это первый PR нового контрибьютора @davinahi.

## Стоит ли обновляться

Да — релиз не заявляет breaking changes и, скорее всего, будет чисто полезным. Самое заметное изменение для тех, кто пишет кастомные компоненты поверх Recharts, — новые точки доступа `useOffset`, `usePlotArea` и `useActiveTooltipDataPoints` к геометрии и активному состоянию графика через публичный API. Всем остальным важно обновление для `ResponsiveContainer` (если график не уменьшался в узких лейаутах), исправление `tickCount`/`allowDecimals` и порядок легенды.

Главный вывод: Recharts продолжает курс из 3.0 — делать внутреннее состояние доступным через хуки и постепенно чинить регрессии переписывания без смены стабильного API.

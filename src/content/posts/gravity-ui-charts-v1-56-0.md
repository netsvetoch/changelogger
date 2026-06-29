---
author: Артём Нецветаев
pubDatetime: 2026-06-29T00:40:35.000Z
title: "@gravity-ui/charts 1.56.0: прозрачность для отдельных сегментов Funnel"
slug: gravity-ui-charts-v1-56-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - charts
description: "Разбор минорного релиза @gravity-ui/charts v1.56.0: у элементов FunnelSeriesData появился opacity, значение проходит через prepareFunnelSeries/prepareFunnelData и становится SVG opacity у polygon каждого сегмента."
---

Gravity UI выпустила минорный релиз [`@gravity-ui/charts v1.56.0`](https://github.com/gravity-ui/charts/releases/tag/v1.56.0). В changelog у него один feature-пункт — поддержка opacity для отдельных сегментов funnel chart. По diff это не общий стиль всей воронки, а новое поле на уровне элемента данных `FunnelSeriesData`.

Источник для обзора — GitHub Release [`gravity-ui/charts@v1.56.0`](https://github.com/gravity-ui/charts/releases/tag/v1.56.0), compare [`v1.55.2...v1.56.0`](https://github.com/gravity-ui/charts/compare/v1.55.2...v1.56.0), PR [`#637`](https://github.com/gravity-ui/charts/pull/637) и merge commit [`a3abdc7`](https://github.com/gravity-ui/charts/commit/a3abdc72ce54ce0baa5187f67dea978a7717c2fe). В релевантный diff попали `src/core/types/chart/funnel.ts`, `src/plugins/funnel/prepare-funnel-series.ts`, `src/core/series/types.ts`, `src/core/shapes/funnel/prepare-data.ts`, `src/core/shapes/funnel/types.ts` и `src/core/shapes/funnel/renderer.ts`.

## `FunnelSeriesData` получил `opacity?: number`

Публичное изменение находится в [`src/core/types/chart/funnel.ts`](https://github.com/gravity-ui/charts/blob/a3abdc72ce54ce0baa5187f67dea978a7717c2fe/src/core/types/chart/funnel.ts). В интерфейс элемента данных funnel-серии добавлено поле:

```ts
export interface FunnelSeriesData<T = MeaningfulAny> extends BaseSeriesData<T> {
  name: string;
  /** Initial data label of the funnel segment. If not specified, the value is used. */
  label?: string;
  /** Individual opacity for the funnel segment. */
  opacity?: number;
  // ...
}
```

Это означает, что прозрачность задаётся не для всей серии и не через глобальные plot options, а непосредственно у конкретного сегмента в `series.data`. Минимальная форма использования выглядит так:

```ts
const chartData = {
  series: [
    {
      type: "funnel",
      data: [
        { name: "Visits", value: 12000, opacity: 1 },
        { name: "Signups", value: 3200, opacity: 0.72 },
        { name: "Paid", value: 860, opacity: 0.45 },
      ],
    },
  ],
};
```

Если `opacity` не указан, новая ветка подготовки данных сохраняет `null`, то есть существующие funnel-графики продолжают рендериться без принудительного изменения прозрачности.

## Значение проходит через pipeline подготовки funnel-серии

PR [`#637`](https://github.com/gravity-ui/charts/pull/637) добавляет поле не только в публичный тип. В [`src/plugins/funnel/prepare-funnel-series.ts`](https://github.com/gravity-ui/charts/blob/a3abdc72ce54ce0baa5187f67dea978a7717c2fe/src/plugins/funnel/prepare-funnel-series.ts) `opacity` копируется из исходного элемента данных в подготовленную серию:

```ts
opacity: dataItem.opacity ?? null,
```

Соответствующий тип `PreparedFunnelSeries` в [`src/core/series/types.ts`](https://github.com/gravity-ui/charts/blob/a3abdc72ce54ce0baa5187f67dea978a7717c2fe/src/core/series/types.ts) теперь содержит `opacity: number | null`. Затем [`src/core/shapes/funnel/prepare-data.ts`](https://github.com/gravity-ui/charts/blob/a3abdc72ce54ce0baa5187f67dea978a7717c2fe/src/core/shapes/funnel/prepare-data.ts) переносит это значение в объект сегмента:

```ts
const item = {
  // координаты, цвет, border и cursor
  opacity: s.opacity,
};
```

Тип данных для рендера [`FunnelItemData`](https://github.com/gravity-ui/charts/blob/a3abdc72ce54ce0baa5187f67dea978a7717c2fe/src/core/shapes/funnel/types.ts) также расширен `opacity: number | null`. Поэтому поле не теряется между пользовательским конфигом, подготовкой series и подготовкой shape data.

## Renderer ставит SVG `opacity` на polygon сегмента

Финальное поведение закреплено в [`src/core/shapes/funnel/renderer.ts`](https://github.com/gravity-ui/charts/blob/a3abdc72ce54ce0baa5187f67dea978a7717c2fe/src/core/shapes/funnel/renderer.ts). При join по `polygon` рендерер теперь добавляет атрибут opacity рядом с `points`, `fill`, `stroke` и `stroke-width`:

```ts
selection
  .selectAll("polygon")
  .data(items)
  .join("polygon")
  .attr("points", d => d.points.map(p => p.join(",")).join(" "))
  .attr("fill", d => d.color)
  .attr("opacity", d => d.opacity)
  .attr("stroke", d => d.borderColor)
  .attr("stroke-width", d => d.borderWidth);
```

Практический эффект: можно приглушить отдельные этапы воронки, не меняя их цвет и не заводя отдельную серию. Например, продуктовая воронка может оставить верхний сегмент полностью непрозрачным, а менее важные или прогнозные стадии показать полупрозрачными.

## Что проверить при обновлении

- Если у вас уже есть funnel chart, обновление не требует миграции: без `opacity` сегменты проходят как `null`, а старый набор полей `name`, `label`, `legend`, `cursor`, `tooltip` и другие остаётся без изменений.
- Если вы генерируете `FunnelSeriesData` через собственные TypeScript-типы, синхронизируйте их с новым `opacity?: number`, чтобы не терять поле до передачи в `@gravity-ui/charts`.
- Если snapshot- или e2e-тесты сравнивают SVG воронки, добавьте ожидание на новый атрибут `opacity` у `polygon` только для сегментов, где поле задано в данных.

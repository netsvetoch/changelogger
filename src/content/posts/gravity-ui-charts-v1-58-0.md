---
author: Артём Нецветаев
pubDatetime: 2026-08-28T09:02:57.000Z
title: "@gravity-ui/charts 1.58.0: линейные градиенты, сглаживание линий и JSON Schema конфига"
slug: gravity-ui-charts-v1-58-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - charts
description: "Разбор минорного релиза @gravity-ui/charts v1.58.0: тип LinearGradient для color/fillColor линий и областей, опция interpolation у LineSeries (linear/monotone/cardinal), а также публикация chart-config.d.ts и chart-config.schema.json для Monaco и JSON-валидации."
---

Gravity UI выпустила минорный релиз [`@gravity-ui/charts v1.58.0`](https://github.com/gravity-ui/charts/releases/tag/v1.58.0). В этом выпуске три feature и один docs-fix. Главное по diff:

- поле `interpolation` у line-серий со сглаживанием через кривые d3-shape;
- тип `LinearGradient` для задания градиентных линий и заливок областей (включая независимую `fillColor`);
- публикация автономных артефактов конфигурации — `chart-config.d.ts` и `chart-config.schema.json`.

Источник для обзора — GitHub Release [`gravity-ui/charts@v1.58.0`](https://github.com/gravity-ui/charts/releases/tag/v1.58.0), compare [`v1.57.3...v1.58.0`](https://github.com/gravity-ui/charts/compare/v1.57.3...v1.58.0), PR [`#668`](https://github.com/gravity-ui/charts/pull/668) (interpolation), [`#669`](https://github.com/gravity-ui/charts/pull/669) (градиенты) и [`#667`](https://github.com/gravity-ui/charts/pull/667) (chart config tooling).

## `LineSeries.interpolation`: smooth-кривые вместо отрезков

По умолчанию line-серия соединяет точки прямыми отрезками. PR [`#668`](https://github.com/gravity-ui/charts/pull/668) добавляет в `LineSeries` необязательное поле `interpolation`, которое переключает рендер на кривые из `d3-shape` ([`src/core/types/chart/line.ts`](https://github.com/gravity-ui/charts/blob/e57fc553b29f564b42d6cc2b6084411210f41b76/src/core/types/chart/line.ts)):

```ts
export type LineSeriesInterpolation =
  | { type: "linear" }
  | { type: "monotone" }
  | {
      type: "cardinal";
      /** 0..1, default 0 */
      tension?: number;
    };
```

Три режима:

- `linear` — прямые отрезки (поведение по умолчанию; задаётся явно либо опускается опция вовсе).
- `monotone` — кубический сплайн, монотонный по x. Проходит через каждую точку, не создавая искусственных экстремумов между соседними точками. Требует данные, упорядоченные по x. Хороший выбор «по умолчанию» для гладких линейных графиков.
- `cardinal` — кардинальный сплайн. Параметр `tension` (0–1, по умолчанию `0`) управляет тем, насколько кривая следует за контрольными точками: `0` даёт «свободную» кривую, `1` схлопывает её в прямые отрезки.

Пример из документации выпуска ([`line-interpolation/cardinal.tsx`](https://github.com/gravity-ui/charts/blob/e57fc553b29f564b42d6cc2b6084411210f41b76/docs/examples/src/charts/line-interpolation/cardinal.tsx)):

```tsx
const data: ChartData = {
  series: {
    data: [
      {
        type: "line",
        name: "Cardinal (tension 0.5)",
        data: DATA,
        lineWidth: 2,
        marker: { enabled: true },
        interpolation: { type: "cardinal", tension: 0.5 },
      },
    ],
  },
  xAxis: { type: "linear" },
};
```

Выбор кривой зашит в [`src/plugins/line/interpolation.ts`](https://github.com/gravity-ui/charts/blob/e57fc553b29f564b42d6cc2b6084411210f41b76/src/plugins/line/interpolation.ts): `curveLinear`, `curveMonotoneX` либо `curveCardinal.tension(interpolation.tension ?? 0)`.

Важные поведенческие детали из PR:

- маркеры, tooltip и взаимодействия остаются привязанными к исходным точкам данных независимо от интерполяции;
- `nullMode` (gaps/zero-fills) применяется до интерполяции, поведение сохранено;
- при `cardinal` с `tension < 1` кривая может выходить за экстремумы данных между точками — такие участки могут обрезаться по границе plot; для сохранения экстремумов используйте `monotone`.

## Линейные градиенты для line и area серий

PR [`#669`](https://github.com/gravity-ui/charts/pull/669) добавляет тип `LinearGradient` и позволяет задавать его в качестве цвета линии (`color`) и заливки области (`fillColor`). Определение в [`src/core/types/chart/gradient.ts`](https://github.com/gravity-ui/charts/blob/e0a583016fe087158a463467b960db80cf5d84a5/src/core/types/chart/gradient.ts):

```ts
export interface GradientStop {
  color: string; // hex, rgb/rgba, hsl/hsla, named colors
  offset: number; // 0..1
}

export interface LinearGradient {
  type: "linear-gradient";
  angle?: number; // CSS: 0=to top, 90=to right, 180=to bottom (default), 270=to left
  stops: GradientStop[]; // минимум 2, offsets по неубыванию
}

export type SeriesColor = string | LinearGradient;
```

`color` теперь принимает либо сплошной CSS-цвет, либо градиент; степень `angle` по умолчанию `180` (сверху вниз). Для area-серий появилась независимая `fillColor`, тоже принимающая сплошной цвет или градиент, что позволяет сочетать сплошную линию с градиентной заливкой:

```tsx
const data: ChartData = {
  series: {
    data: [
      {
        type: "line",
        name: "Revenue",
        color: {
          type: "linear-gradient",
          angle: 90,
          stops: [
            { offset: 0, color: "#30b2a4" },
            { offset: 0.5, color: "#5b8def" },
            { offset: 1, color: "#9b51e0" },
          ],
        },
        lineWidth: 3,
        data: [
          { x: 0, y: 42 },
          { x: 1, y: 58 },
        ],
      },
    ],
  },
};
```

Как градиент ведёт себя в отрисовке (новая утилита [`src/core/utils/gradient.ts`](https://github.com/gravity-ui/charts/blob/e0a583016fe087158a463467b960db80cf5d84a5/src/core/utils/gradient.ts)):

- градиент линии использует bounding box точек, участвующих в отрисованном пути; зум пересчитывает box по отображаемым точкам, а range slider резолвит градиент независимо, поэтому цвета могут различаться;
- для точек без явного `color` вычисляется цвет градиента в позиции точки (`setGradientPointFills`), приоритет маркера остаётся `data[].marker.color` → `data[].color` → цвет градиента в точке → цвет серии;
- легенда представляет градиент его цветом при `t = 0.5` (не рисует градиентный символ); tooltip-символ у области использует цвет маркера hovered-точки;
- добавлена валидация `validateSeriesColor` для `color`/`fillColor` у line и area серий — градиент должен иметь тип `linear-gradient`, ≥2 стопов с offsets 0..1 по неубыванию, конечный `angle`, иначе `validateData` бросит `CHART_ERROR_CODE.INVALID_DATA`.

## Chart config артефакты: `chart-config.d.ts` и `chart-config.schema.json`

PR [`#667`](https://github.com/gravity-ui/charts/pull/667) добавляет в пакет автономные артефакты конфигурации (`scripts/build-chart-config.js`, `src/chart-config.ts`):

- `@gravity-ui/charts/chart-config.d.ts` — отдельная декларация для TypeScript language service в Monaco;
- `@gravity-ui/charts/chart-config.schema.json` — JSON Schema для валидации и автодополнения JSON-only конфигов;
- callback-only опции (обработчики событий, кастомные форматтеры/рендереры) из JSON Schema исключены — они доступны только через `ChartData` при работе с React-компонентом напрямую;
- генерация артефактов валидируется во время CI.

Основной тип (`src/chart-config.ts`) — JSON-сериализуемый срез `ChartData`:

```ts
export type JsonValue =
  boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface ChartConfig extends ChartData<JsonValue> {}
```

Подключение декларации в Monaco (из официальной документации [`chart-config.md`](https://github.com/gravity-ui/charts/blob/799c9b476e7dca361f7ae37fa9bf2438f8d54db3/docs/diplodoc/pages/integrations/chart-config.md)):

```js
import declaration from "@gravity-ui/charts/chart-config.d.ts?raw";

monaco.languages.typescript.typescriptDefaults.addExtraLib(
  declaration,
  "file:///node_modules/@gravity-ui/charts/chart-config.d.ts"
);
```

Для JSON-автодополнения схема регистрируется в JSON language service с `fileMatch: ['chart-config.json']`. Это позволяет редактировать chart-конфиг как обычный JSON-файл с валидацией и подсказками, либо интегрировать декларацию/схему в собственные build-инструменты через `require.resolve('@gravity-ui/charts/chart-config.d.ts')`.

## Что ещё

Четвёртый пункт changelog — это docs-fix ([`#664`](https://github.com/gravity-ui/charts/pull/664)): в CI добавлена проверка, не позволяющая публиковать сборку документации с отсутствующими локальными CSS/JS-ассетами (`@diplodoc/cli` закреплён на 4.59.13). К публичному API графиков отношения не имеет.

## Что проверить при обновлении

- Миграции не требуется: `interpolation` и градиентные `color`/`fillColor` — новые необязательные поля; без них серии рендерятся как раньше (`linear` и сплошной цвет).
- Если вы генерируете конфиг как чистый JSON, теперь можно валидировать его через публикуемую `chart-config.schema.json`, а для Monaco — использовать `chart-config.d.ts`.
- Если валидация у вас уже подключена отдельно, учтите, что невалидный градиент (`<2` стопов, выходящие за 0..1 offsets, нечисловой `angle`) теперь выбрасывает `INVALID_DATA`.

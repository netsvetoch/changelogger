---
author: Артём Нецветаев
pubDatetime: 2026-08-22T18:31:00.000Z
title: "Recharts 3.8: строгая типизация data/dataKey, хуки для конвертации координат, niceTicks и троттлинг событий"
slug: recharts-v3-8-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 3.8.0 (minor): props `data` и `dataKey` получили дженерики — теперь диаграммы можно валидировать по типам данных, а через `createHorizontalChart`/`createVerticalChart`/`createCentricChart`/`createRadialChart` — собрать полностью типизированный граф. Добавлены хуки `useXAxisScale`/`useYAxisScale`, обратные `useXAxisInverseScale` и т.д. для конвертации «данные ↔ пиксели», экспортирован `getRelativeCoordinate`, у осей появился новый `niceTicks`, а у всех чартов — `throttleDelay`/`throttledEvents`."
---

Recharts 3.8.0 — минорный релиз, который по сути делает библиотеку «по-настоящему типизированной»: `data` и `dataKey` теперь дженерик-пропсы, и TypeScript может проверять ваши данные и `dataKey` на типовые ошибки. Второй крупный блок — набор хуков и `getRelativeCoordinate` для точной конвертации координат между данными и пикселями, что наконец позволяет уверенно строить собственные аннотации поверх графика.

Источник: GitHub Release [`recharts/recharts@v3.8.0`](https://github.com/recharts/recharts/releases/tag/v3.8.0). Все сигнатуры проверены по исходникам на теге `v3.8.0` и телам связанных PR.

## Дженерики для `data`/`dataKey` и «типизированные» чарты

До 3.8 большинство компонентов Recharts по умолчанию «проваливались» в `any`, и опечатка в `dataKey` находилась только в рантайме. Теперь `data` и `dataKey` принимают дженерики: можно передать тип элемента данных, и TypeScript будет сверять `dataKey` и использование полей.

Вручную — через дженерик самого компонента:

```tsx
type MyData = { page: string; visits: number };

<Line<MyData>
  dataKey="visits" // ✔ корректный ключ
  // dataKey="visist"           // ✘ ошибка типа — такого поля нет в MyData
/>;
```

Но перечислять дженерик на каждом элементе утомительно. Для этого в 3.8 ([#7071](https://github.com/recharts/recharts/pull/7071), закрывает #7046) добавлены четыре фабрики, которые «запирают» типы данных и осей и возвращают весь набор компонентов, уже согласованных между собой:

```tsx
import {
  createHorizontalChart,
  createVerticalChart,
  createCentricChart,
  createRadialChart,
} from "recharts";

// Data = MyData, X (категория) = string, Y (число) = number
const TypedCharts = createHorizontalChart<MyData, string, number>()({
  AreaChart,
  Area,
  XAxis,
  YAxis,
});

// TypedCharts.AreaChart теперь всегда горизонтальная (layout="horizontal"
// зашит статически), а Area строго типизирован под MyData.
<TypedCharts.AreaChart data={data}>
  <TypedCharts.Area dataKey="visits" />
</TypedCharts.AreaChart>;
```

Все четыре фабрики имеют одинаковую сигнатуру `createHorizontalChart<TData, TCategorical = string, TNumerical = number>()` и различаются только набором привязанных компонентов:

- `createHorizontalChart` / `createVerticalChart` — декартовые графики (`AreaChart`, `BarChart`, `LineChart`, `ComposedChart`, `ScatterChart`; у вертикального появляется ещё `FunnelChart`).
- `createCentricChart` — полярные «центрические» (`RadarChart`); на этапе компиляции отклоняет радиальные элементы (`RadialBar`, `Pie`).
- `createRadialChart` — `RadialBarChart` и `PieChart`; отклоняет `Radar`/`RadarChart`.

Вызов «каррируется»: сначала указываются дженерики, потом передаются компоненты. Проп `layout` в обёртках убран из конфигурации, чтобы его нельзя было случайно переопределить. Плюс такие диаграммы лучше трясутся при tree-shaking ([#7071](https://github.com/recharts/recharts/pull/7071)).

## Новые hooks: конвертация «данные ↔ пиксели»

Долго ожидаемая возможность ([#6960](https://github.com/recharts/recharts/pull/6960), закрывает #6021/#1678) — получение функций масштабирования осей для позиционирования собственных аннотаций и элементов. Все новые хуки читают состояние осей через redux-селекторы, поэтому их нужно вызывать внутри контекста графика (внутри `LineChart`, `BarChart` и т.д.). По умолчанию аргумент `xAxisId`/`yAxisId` равен `0`.

Направление «данные → пиксели»:

```ts
// ScaleFunction = (value: unknown, options?: { position?: BandPosition })
//   => number | undefined
useXAxisScale(xAxisId = 0): ScaleFunction | undefined;
useYAxisScale(yAxisId = 0): ScaleFunction | undefined;

// useCartesianScale — удобная обвязка сразу над двумя осями
useCartesianScale(
  dataPoint: CartesianDataPoint, // { x, y } в координатах данных
  xAxisId = 0,
  yAxisId = 0,
): Coordinate | undefined;       // { x, y } в пикселях
```

`useCartesianScale` — самый простой способ поставить маркер на точку данных:

```tsx
function Marker() {
  const pixelCoords = useCartesianScale({ x: "Page C", y: 2500 });
  if (pixelCoords == null) return null;
  return <circle cx={pixelCoords.x} cy={pixelCoords.y} r={5} fill="red" />;
}
```

Обратное направление «пиксели → данные» — три варианта на каждую ось:

```ts
// InverseScaleFunction = (pixelValue: number) => unknown
useXAxisInverseScale(xAxisId = 0): InverseScaleFunction | undefined;        // до ближайшего значения данных
useXAxisInverseDataSnapScale(xAxisId = 0): InverseScaleFunction | undefined; // до ближайшей точки данных
useXAxisInverseTickSnapScale(xAxisId = 0): InverseScaleFunction | undefined; // до ближайшего тика оси

// То же для Y:
useYAxisInverseScale(xAxisId = 0): InverseScaleFunction | undefined;
useYAxisInverseDataSnapScale(xAxisId = 0): InverseScaleFunction | undefined;
useYAxisInverseTickSnapScale(xAxisId = 0): InverseScaleFunction | undefined;
```

Различие между `...InverseScale` и `...TickSnapScale`: первый отдаёт значение на континууме шкалы (ближайшее по числовой позиции), а вариант c `TickSnap` «прищёлкивает» к ближайшему рассчитанному тику оси.

Доступ к самим рассчитанным тикам:

```ts
useXAxisTicks(xAxisId = 0): ReadonlyArray<TickItem> | undefined;
useYAxisTicks(xAxisId = 0): ReadonlyArray<TickItem> | undefined;
// TickItem = { value; coordinate; index; ... }
```

Это пригодится для построения кастомных шкал, сеток или подписей поверх осей.

## `getRelativeCoordinate`: координаты мыши/тача относительно элемента

Ранее внутренняя функция `getChartPointer` переименована и публично экспортирована ([#6942](https://github.com/recharts/recharts/pull/6942)) как `getRelativeCoordinate`. Она возвращает координаты события относительно верхнего левого угла `currentTarget` (у `(0, 0)` — верхний левый угол), корректно учитывая CSS-масштаб (zoom не меняет значения).

```ts
// Для mouse-события — один объект { relativeX, relativeY }
// Для touch — массив, по одному элементу на каждую точку касания
getRelativeCoordinate(event: MousePointer): RelativePointer;
getRelativeCoordinate(event: TouchPointer): Array<RelativePointer>;
```

Работает как с HTML-, так и с SVG-элементами, а `currentTarget` кэшируется через прокси (браузеры хранят его только в основном цикле событий, и при асинхронной обработке он терялся):

```tsx
<Area
  onMouseMove={(_, e) => {
    const { relativeX, relativeY } = getRelativeCoordinate(e);
    // тут можно скомбинировать с usePlotArea()/useCartesianScale(),
    // чтобы получить именно точки данных под курсором
    console.log(`(${relativeX}, ${relativeY})`);
  }}
/>
```

Попутно в PR починен ре-рендер `Legend`, который сбрасывал собственный размер и прерывал жесты тача — добавлен `React.memo`.

## Оси: новый `niceTicks`

У `XAxis`/`YAxis` появился проп `niceTicks` ([#7009](https://github.com/recharts/recharts/pull/7009), закрывает #7008) со значениями `'none' | 'auto' | 'equidistant' | 'nice'`.

По умолчанию — `'none'` (поведение прежнее). При `'nice'` шаг тиков «прищёлкивается» к «человеко-приятным» числам кратных `{1, 2, 2.5, 5}` на каждом порядке величины вместо прежнего округления с шагом 0.05/0.1, которое давало тики вроде 3.5, 0.35 или 0.7. Примеры из PR для области `[0, 14]` и 5 тиков: было `[0, 4, 8, 12, 16]`, стало `[0, 5, 10, 15, 20]`; для `[39.9, 42.5]`: было `[39.9, 40.6, 41.3, 42, 42.7]`, стало `[39, 40, 41, 42, 43]`.

```tsx
<XAxis dataKey="value" niceTicks="nice" />
<YAxis niceTicks="auto" />
```

## `Legend`: проп `labelStyle`

В `Legend` добавлен `labelStyle` ([#7012](https://github.com/recharts/recharts/pull/7012)) — стиль текста каждого элемента легенды (по аналогии с `DefaultTooltipContent`). Позволяет задать, например, единый цвет вместо цвета серии, а также шрифт/высоту строки:

```tsx
<Legend labelStyle={{ color: "#666", fontSize: 12, fontWeight: 600 }} />
```

Неактивные (скрытые) элементы легенды при этом отражают настроенный цвет «inactive». Дефолтные пропы `Legend` теперь публичны и попадают в сгенерированную документацию API.

## Троттлинг событий: `throttleDelay` / `throttledEvents`

События мыши при интенсивном взаимодействии могли дёргать график. В 3.8 ([#6924](https://github.com/recharts/recharts/pull/6924), закрывает #6883) существовавший `throttleDelay` расширен, а добавлен новый `throttledEvents` для управления тем, какие события трoттлить:

```ts
throttleDelay?: number | 'raf';                         // по умолчанию — 'raf'
throttledEvents?: ReadonlyArray<keyof GlobalEventHandlersEventMap> | 'all'; // список событий ИЛИ все
```

Троттлятся только события, перечисленные в `throttledEvents`; остальные выполняются сразу. `'raf'` означает привязку к `requestAnimationFrame`. Это можно указать на любом chart-компоненте.

## Исправления

- **Tooltip-синхронизация на `PieChart`** ([#6989](https://github.com/recharts/recharts/pull/6989)) — включена, тултип можно синхронизировать между круговыми диаграммами.
- **Синхронизация цвета тултипа/легенды `Pie`** ([#6977](https://github.com/recharts/recharts/pull/6977)) — цвет тултипа и легенды теперь совпадает с заполнением конкретного сектора.
- **`Bar` `activeBar` при missing/null данных** ([#7001](https://github.com/recharts/recharts/pull/7001)) — подсветка активного бара больше не ломается, если часть данных отсутствует или `null`.
- **`Bar` CSS-переходы** ([#6920](https://github.com/recharts/recharts/pull/6920)) — поддержаны CSS transitions.
- **`textAnchor` на `XAxis`/`YAxis`** ([#7028](https://github.com/recharts/recharts/pull/7028)) — теперь уважается пользовательский проп `textAnchor`.
- **`Tooltip` закрывается по `blur`** ([#6958](https://github.com/recharts/recharts/pull/6958)).
- **`onMouseEnter`/`onMouseLeave={undefined}`** ([#6969](https://github.com/recharts/recharts/pull/6969)) — исправлена ошибка, когда обработчик был явно `undefined` (проверка `inputProps[key]` перед вызовом).
- **Анимации и системные предпочтения** ([#6956](https://github.com/recharts/recharts/pull/6956)) — примитивные анимации автоматически отключаются, если в системе выключены анимации (`prefers-reduced-motion`).
- **Мерцание линии `Line`** ([#7022](https://github.com/recharts/recharts/pull/7022)) — устранён фликер анимированной линии при `strokeLinecap` `round`/`square`.
- **Производительность** ([#6800](https://github.com/recharts/recharts/pull/6800)) — прямоугольники нулевого размера отфильтровываются раньше (ранние return уже в фазе макета).
- **`@reduxjs/toolkit` минимум 1.9.0** ([#6934](https://github.com/recharts/recharts/pull/6934), закрывает #6933) — Recharts 3.7 уже вызывал `prepareAutoBatched()`, но диапазон зависимостей допускал RTK 1.8.x, из-за чего приложение могло падать в рантайме. Диапазон заменён на `^1.9.0 || 2.x.x`.

## Типы

Целая волна типизации (автор — PavelVanecek): дженерики для `Bar` ([#7015](https://github.com/recharts/recharts/pull/7015)), `Area` ([#6993](https://github.com/recharts/recharts/pull/6993)) и опциональные явные дженерики для графических элементов и самих чартов ([#7035](https://github.com/recharts/recharts/pull/7035)); уточнены типы ивент-хендлеров [`Pie`](https://github.com/recharts/recharts/pull/6944), `Pie`/`RadialBar` ([#6965](https://github.com/recharts/recharts/pull/6965)), `PolarAngleAxis` ([#7000](https://github.com/recharts/recharts/pull/7000)), `XAxis`/`YAxis` с добавленными type-тестами ([#7004](https://github.com/recharts/recharts/pull/7004)); исправлен тип mouse event ([#6939](https://github.com/recharts/recharts/pull/6939)), payload `Tooltip` избавлен от `any` ([#6925](https://github.com/recharts/recharts/pull/6925)), для `RadialBar` стабилизированы типы формы и селекторы ([#6917](https://github.com/recharts/recharts/pull/6917)).

## Итоги

- **Версия:** 3.8.0 (minor), breaking-изменений нет. Единственный «незаметный» нюанс — поднята минимальная версия `@reduxjs/toolkit` до `^1.9.0` ([#6934](https://github.com/recharts/recharts/pull/6934)).
- **Типизация:** дженерики для `data`/`dataKey` + фабрики `createHorizontalChart`/`createVerticalChart`/`createCentricChart`/`createRadialChart` ([#7071](https://github.com/recharts/recharts/pull/7071)) — теперь опечатка в `dataKey` ловится на этапе компиляции.
- **Координаты:** `getRelativeCoordinate` ([#6942](https://github.com/recharts/recharts/pull/6942)) и 11 хуков `useXAxisScale`/`useYAxisScale`/`useCartesianScale`/`useXAxisInverseScale`/…/`useXAxisTicks`/`useYAxisTicks` ([#6960](https://github.com/recharts/recharts/pull/6960)) — готовый набор для кастомных аннотаций и преобразований «данные ↔ пиксели».
- **Оси:** новый `niceTicks={'none'|'auto'|'equidistant'|'nice'}`([#7009](https://github.com/recharts/recharts/pull/7009)).
- **Легенда:** проп `labelStyle` ([#7012](https://github.com/recharts/recharts/pull/7012)).
- **Производительность:** `throttleDelay`/`throttledEvents` на всех чартах ([#6924](https://github.com/recharts/recharts/pull/6924)), ранний скип нулевых прямоугольников ([#6800](https://github.com/recharts/recharts/pull/6800)).
- Полный список изменений: [compare v3.7.0...v3.8.0](https://github.com/recharts/recharts/compare/v3.7.0...v3.8.0).

**Стоит ли обновляться.** Да. Особенно если вы строили собственные аннотации — набор scale/inverse-хуков и `getRelativeCoordinate` закрывает эту задачу «из коробки». А дженерики `data`/`dataKey` и типизированные фабрики заметно повысят надёжность типизации в больших дашбордах. Установка:

```bash
npm install recharts@3.8.0
```

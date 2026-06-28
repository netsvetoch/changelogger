---
author: Артём Нецветаев
pubDatetime: 2026-06-28T23:05:16.000Z
title: "Recharts 3.9: управляемые анимации, публичные layout-хуки и точечные исправления графиков"
slug: recharts-v3-9-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Разбор Recharts 3.9.0: новые props для анимаций Line, Area и Bar, AnimationControllerProvider, interpolate, layout-хуки, ResponsiveContainer с HTML-атрибутами, Treemap nodeInset/nodeGap и исправления рендеринга."
---

Recharts 3.9.0 — минорный релиз, но по объёму API он больше похож на отдельную веху для тех, кто делает интерактивные графики на React. Главная тема — анимации: команда вынесла общую логику в отдельные animation-модули, добавила публичные точки расширения и задокументировала сценарии, где ход анимации управляется не только временем, но и, например, скроллом страницы.

Источник: GitHub Release [`recharts/recharts@v3.9.0`](https://github.com/recharts/recharts/releases/tag/v3.9.0). Для конкретики я проверил связанные PR: [#7215](https://github.com/recharts/recharts/pull/7215), [#7293](https://github.com/recharts/recharts/pull/7293), [#7265](https://github.com/recharts/recharts/pull/7265), [#7168](https://github.com/recharts/recharts/pull/7168), [#7044](https://github.com/recharts/recharts/pull/7044), [#7137](https://github.com/recharts/recharts/pull/7137), [#7201](https://github.com/recharts/recharts/pull/7201) и [#7405](https://github.com/recharts/recharts/pull/7405).

## Настраиваемые анимации для Line, Area и Bar

Самое заметное изменение из [#7215](https://github.com/recharts/recharts/pull/7215) — у `Line`, `Area` и `Bar` появились два новых prop-а для управления тем, как старые точки данных сопоставляются с новыми и как именно вычисляется промежуточное состояние:

- `animationMatchBy` — стратегия сопоставления элементов анимации. В публичный entrypoint теперь экспортируются `matchByIndex`, `matchByDataKey` и `matchAppend`.
- `animationInterpolateFn` — функция интерполяции. Для `Line` и `Area` она работает с точками (`LinePointItem`, `AreaPointItem`), для `Bar` — с прямоугольниками (`BarRectangleItem`).

В исходниках Recharts 3.9 видно, что дефолты отличаются по компонентам: `Line` и `Area` используют `matchByIndex`, а `Bar` — `matchAppend`. Это важная деталь: при добавлении новых столбцов `Bar` по умолчанию ведёт себя как append-анимация, а не просто сопоставляет элементы по индексу.

Упрощённый пример кастомной интерполяции для линии:

```tsx
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  matchByDataKey,
  type AnimationInterpolateFn,
  type LinePointItem,
  type CartesianLayout,
} from "recharts";

const snapYThenMoveX: AnimationInterpolateFn<LinePointItem, CartesianLayout> = (
  items,
  progress
) =>
  items.flatMap(({ prev, next }) => {
    if (!next) return [];

    return [
      {
        ...next,
        x: prev ? prev.x + (next.x - prev.x) * progress : next.x,
        y: next.y,
      },
    ];
  });

export function Chart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  return (
    <LineChart width={600} height={300} data={data}>
      <XAxis dataKey="name" />
      <YAxis />
      <Line
        dataKey="value"
        animationMatchBy={matchByDataKey("name")}
        animationInterpolateFn={snapYThenMoveX}
      />
    </LineChart>
  );
}
```

В релиз также вошли новые публичные типы и утилиты вокруг анимаций: `AnimationInterpolateFn`, `AnimationItem`, `AnimationMatchBy`, `AnimationMatchByProp`, `AnimationHandle`, `AnimationController`, `OnAnimationStateUpdate`, `TimeoutController`, `CancelableTimeout`, а также классы `JavascriptAnimation` и `CSSTransitionAnimation`. Для кастомных shape-анимаций экспортированы `AreaRevealShape` и `LineDrawShape`.

## Анимацию можно вести от скролла, тестового таймера или своих контролов

[#7484](https://github.com/recharts/recharts/pull/7484) и [#7487](https://github.com/recharts/recharts/pull/7487) добавили на сайт пример `ScrollAnimateBarChart`. Его смысл не в новом типе графика, а в новом уровне контроля: `AnimationControllerProvider` позволяет заменить стандартный `requestAnimationFrame`-контроллер своей функцией.

В проверенном примере контроллер слушает `window.scroll`, вычисляет долю прокрутки страницы, вызывает `animationHandle.tick(currentTime)` и передаёт наружу `listener(animationHandle.getInterpolated())`. Такой же механизм пригодится для unit-тестов, ручных ползунков, синхронизации с видео или анимаций от WebSocket-событий.

Схема из примера Recharts выглядит так:

```tsx
import {
  AnimationControllerProvider,
  type AnimationController,
} from "recharts";

const scrollAnimationController: AnimationController = (
  _timeoutController,
  animationHandle,
  listener
) => {
  const handleScroll = () => {
    const scrollFraction = Math.min(
      Math.max(window.scrollY / (document.documentElement.scrollHeight / 2), 0),
      1
    );

    animationHandle.tick(
      scrollFraction * animationHandle.getAnimationDuration()
    );
    listener(animationHandle.getInterpolated());
  };

  animationHandle.tick(0);
  window.addEventListener("scroll", handleScroll);

  return () => window.removeEventListener("scroll", handleScroll);
};

<AnimationControllerProvider value={scrollAnimationController}>
  {/* ваши LineChart, BarChart, AreaChart и т.д. */}
</AnimationControllerProvider>;
```

Отдельно в [#7293](https://github.com/recharts/recharts/pull/7293) Recharts экспортировал `interpolate` из `recharts`. Это та же базовая числовая утилита, которую использует сам пакет: если `start` и `end` — числа, она возвращает округлённое промежуточное значение; если `end` равен `null` или `undefined`, результатом будет это значение. Это полезно, когда вы пишете свой `animationInterpolateFn`, но не хотите заново реализовывать обычную линейную интерполяцию.

```tsx
import { interpolate } from "recharts";

const width = interpolate(previousWidth, nextWidth, progress);
```

## Публичные layout-хуки для компонентов внутри графика

[#7265](https://github.com/recharts/recharts/pull/7265) вывел в публичный API хуки, которые раньше были внутренней деталью:

- `useChartLayout()`
- `useCartesianChartLayout()`
- `usePolarChartLayout()`

Вместе с ними экспортированы типы `LayoutType`, `CartesianLayout` и `PolarLayout`. По описанию PR и тестам, хуки возвращают `undefined` вне контекста графика и позволяют компонентам внутри Recharts-графика понять, в каком layout-е они находятся. Это полезно для кастомных shape-компонентов, overlay-слоёв и элементов, которые должны по-разному вести себя в горизонтальном, вертикальном или полярном графике.

```tsx
import { useCartesianChartLayout } from "recharts";

function MyOverlay() {
  const layout = useCartesianChartLayout();

  if (!layout) return null;

  return (
    <text x={8} y={16}>
      layout: {layout}
    </text>
  );
}
```

## ResponsiveContainer теперь принимает HTML-атрибуты

До [#7168](https://github.com/recharts/recharts/pull/7168) `ResponsiveContainer` не принимал стандартные атрибуты `div` вроде `data-testid`, `aria-label` или `role`. Для тестов и accessibility приходилось оборачивать контейнер ещё одним элементом.

В 3.9 интерфейс `Props` расширен через `React.HTMLAttributes<HTMLDivElement>` с исключением внутренних prop-ов `id`, `className`, `style` и `onResize`; оставшиеся props прокидываются на корневой `div`. Тип `style` при этом упрощён до обычного `CSSProperties`, потому что прежний `Omit<CSSProperties, keyof Props>` отрезал валидные CSS-свойства, если их имена совпадали с prop-ами компонента.

```tsx
<ResponsiveContainer
  data-testid="revenue-chart"
  aria-label="Revenue by month"
  role="img"
  style={{ width: "100%", height: 320 }}
>
  <BarChart data={data}>{/* ... */}</BarChart>
</ResponsiveContainer>
```

## Treemap: отступы внутри узлов и gap между детьми

[#7044](https://github.com/recharts/recharts/pull/7044) добавил в `Treemap` два layout-prop-а:

- `nodeInset?: number` — внутренний отступ прямоугольника узла;
- `nodeGap?: number` — промежуток между дочерними прямоугольниками.

В реализации оба значения по умолчанию равны `0`. `nodeInset` ограничивается размерами прямоугольника, а `nodeGap` применяется как половина gap-а к соседним детям, чтобы визуально раздвигать сегменты treemap без ручной постобработки координат.

```tsx
<Treemap
  width={700}
  height={360}
  data={data}
  dataKey="size"
  nameKey="name"
  nodeInset={4}
  nodeGap={2}
/>
```

## Legend, Tooltip, PieChart и нулевые значения: что исправили

В разделе bugfixes много точечных, но практичных исправлений.

- [#7175](https://github.com/recharts/recharts/pull/7175) сохраняет валидные falsy-имена в tooltip: `0` и пустая строка больше не должны теряться только потому, что они falsy.
- [#7199](https://github.com/recharts/recharts/pull/7199) чинит stacked bars, когда все значения равны `0`: график больше не пропускает такой набор как «ничего не нужно рисовать».
- [#7185](https://github.com/recharts/recharts/pull/7185) и [#7184](https://github.com/recharts/recharts/pull/7184) убирают `NaN`-координаты в `Sankey` и `Funnel`, когда суммы значений равны нулю.
- [#7232](https://github.com/recharts/recharts/pull/7232) учитывает padding осей в clipping mask при сочетании `allowDataOverflow={true}` и ограниченного domain-а.
- [#7273](https://github.com/recharts/recharts/pull/7273) использует `originalDataIndex` при tooltip-dispatch в `Bar`, что важно после внутренних преобразований данных.
- [#7297](https://github.com/recharts/recharts/pull/7297) заменяет bitwise truncation на `Math.round` при позиционировании bar-элементов, чтобы не получать побочные эффекты 32-битных bitwise-операций.
- [#7201](https://github.com/recharts/recharts/pull/7201) исправляет overlap легенды с графиком при resize контейнера: `useElementOffset` теперь использует `ResizeObserver`, а dispatch настроек/размера легенды переведён на `useLayoutEffect`, чтобы offset успевал обновиться до paint-а. В том же PR начальный `verticalAlign` в `legendSlice` приведён к дефолту `Legend` — `'bottom'` вместо `'middle'`.

Для `PieChart` в [#7137](https://github.com/recharts/recharts/pull/7137) payload легенды получил `dataKey`. Это мелкое изменение, но оно снимает неоднозначность, когда легенду нужно связать с конкретной серией данных, а не только с отображаемым названием.

Ещё один полезный пример — [#7489](https://github.com/recharts/recharts/pull/7489): вместо устаревающего `Cell` сайт Recharts показывает, как менять `fillOpacity` активного сектора Pie через `useActiveTooltipDataPoints()` и `useIsTooltipActive()`. В примере неактивные сектора получают `fillOpacity = 0.5`, активный остаётся с `1`, а плавность задаётся через `style={{ transition: "fill-opacity 0.3s ease" }}`.

## Исправлена анимация dashed Line с одним значением strokeDasharray

[#7405](https://github.com/recharts/recharts/pull/7405) чинит отдельный случай для `Line`: в SVG `strokeDasharray="5"` означает повторяющийся паттерн `5 5`, то есть dash и gap одинаковой длины. Во время animated reveal Recharts раньше нормализовал нечётное число значений добавлением `0`, превращая `5` в `5 0`; на время анимации gap исчезал, и линия выглядела сплошной.

Теперь нечётный dash-паттерн повторяется целиком. Для `strokeDasharray="5"` промежуточный animated dasharray сохраняет gap, что подтверждено новым тестом в `Line.animation.spec.tsx`.

```tsx
<Line dataKey="uv" strokeDasharray="5" animationEasing="linear" />
```

Если у вас были кастомные dashed-линии, которые «слипались» только во время появления графика, это обновление должно убрать визуальный скачок.

## Tree-shaking: меньше лишних shape-зависимостей

В релизе отдельно отмечены PR [#7348](https://github.com/recharts/recharts/pull/7348), [#7349](https://github.com/recharts/recharts/pull/7349) и [#7351](https://github.com/recharts/recharts/pull/7351). Они добавляют focused tree-shaking tests и переписывают часть shape-defaults так, чтобы финальный bundle легче показывал, какие компоненты попали внутрь и почему. В diff видно рефакторинг `Shape`: вместо старого `renderDefaultShape` используется явный `DefaultShape` и отдельный объект `shapeProps`, а shape-option ветки разведены для React element, function, plain object и boolean/undefined.

Это не новый пользовательский API, но практический результат важен для приложений, где Recharts импортируется частично: меньше скрытых зависимостей от shape-утилит и лучше контролируемые bundle snapshots.

## Стоит ли обновляться

Да, если вы используете Recharts 3.x и особенно если у вас есть интерактивные графики с кастомной анимацией, responsive-контейнеры в тестах/accessibility-сценариях или treemap-визуализации. Релиз не заявляет breaking changes, но добавляет много новых публичных точек расширения. После обновления я бы отдельно проверил:

1. графики с `Line`, `Area` и `Bar`, где меняются данные во время анимации;
2. `ResponsiveContainer` в местах, где раньше был wrapper-div только ради `data-*` или ARIA;
3. легенды в узких контейнерах — исправление resize может изменить момент пересчёта offset-а;
4. dashed `Line` с одиночным `strokeDasharray`;
5. кастомные `Treemap` layouts, где теперь можно заменить ручные отступы на `nodeInset` и `nodeGap`.

Главный вывод: Recharts 3.9 делает анимации не просто включаемой опцией, а расширяемой подсистемой. Теперь можно выбирать стратегию сопоставления данных, писать свою интерполяцию, подменять animation controller и при этом оставаться в публичном API пакета.

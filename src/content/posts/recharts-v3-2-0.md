---
author: Артём Нецветаев
pubDatetime: 2026-08-22T17:10:00.000Z
title: "Recharts 3.2: хуки useXAxisDomain, useYAxisDomain и useMargin, строки в outerRadius и fill для PolarGrid"
slug: recharts-v3-2-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Разбор Recharts 3.2.0: новые публичные хуки useXAxisDomain, useYAxisDomain и useMargin, поддержка string-значений в callback-е outerRadius у Pie, цвет заливки fill для PolarGrid, а также исправления Label как вложенных children, ширины YAxis width=auto и производительности Bar."
---

Recharts 3.2.0 — минорный релиз, который продолжает курс 3.x на расширение публичного доступа к внутреннему состоянию графика через хуки. В этот раз добавлено три новых хука, плюс точечные улучшения в polar-графиках (`Pie`, `PolarGrid`) и ряд исправлений багов 3.x, включая возврат оптимизации производительности `Bar`.

Источник: GitHub Release [`recharts/recharts@v3.2.0`](https://github.com/recharts/recharts/releases/tag/v3.2.0). Для конкретики я проверил связанные PR и исходники на теге: все три новых хука экспортируются из корневого `src/index.ts`, сигнатуры подтверждены в `src/hooks.ts` и `src/state/hooks.ts`.

## Новые публичные хуки

В 3.1 Recharts добавил `useOffset`, `usePlotArea` и `useActiveTooltipDataPoints` для чтения геометрии графика. В 3.2 его набор расширился ещё тремя хуками.

### `useXAxisDomain()` и `useYAxisDomain()`

[#6201](https://github.com/recharts/recharts/pull/6201) добавляет `useXAxisDomain` и `useYAxisDomain`, которые возвращают вычисленный домен оси — то есть диапазон значений, который ось реально показывает. Тип домена зависит от пропа `type` оси: числовой домен — это `[min, max]`, категориальный — `['a', 'b', 'c']`.

```ts
import { useXAxisDomain, useYAxisDomain } from "recharts";

function Domain() {
  const x = useXAxisDomain(); // NumberDomain | CategoricalDomain | undefined
  const y = useYAxisDomain();
  if (!x || !y) return null;
  return (
    <span>
      X: {x[0]}…{x[1]} · Y: {y[0]}…{y[1]}
    </span>
  );
}
```

Оба хука принимают опциональный `xAxisId` / `yAxisId` (по умолчанию `0`) — удобно, когда в графике несколько осей. Нюанс для `useXAxisDomain`: если у графика есть `Brush`, вне контекста brush возвращается домен, суженный до выбранных индексов, а внутри контекста brush — полный домен. `useYAxisDomain`, как и сами Y-оси, с brush не взаимодействует и всегда возвращает полный домен.

### `useMargin()`

[#6224](https://github.com/recharts/recharts/pull/6224) экспортирует `useMargin`, который возвращает отступы графика. Мотивация автора: отступы — это не совсем внутреннее состояние, они задаются снаружи, поэтому хук полезен для разделяемых компонентов и других библиотек поверх Recharts.

```ts
import { useMargin } from "recharts";

function MarginInfo() {
  const m = useMargin();
  if (!m) return null;
  return <span>Отступы: {m.top}/{m.right}/{m.bottom}/{m.left}</span>;
}
```

Хук возвращает `Margin | undefined` (из `src/context/chartLayoutContext`) и, как и другие хуки состояния, вернёт `undefined`, если вызван вне контекста графика.

## Изменения в polar-графиках

### `Pie`: строки в callback-е `outerRadius`

[#6191](https://github.com/recharts/recharts/pull/6191) закрывает issue [#5998](https://github.com/recharts/recharts/issues/5998). Раньше `outerRadius` у `Pie` поддерживал число, процент как строку и callback, возвращающий **только число**. Callback, возвращавший строку-процент, корректно не обрабатывался. Теперь типы расширены: function может возвращать `number | string`, а возвращаемое значение прогоняется через утилиту `getPercentValue`, как и для статичных значений.

```tsx
const outerRadius = (entry: any) => {
  if (entry.name === "A") return "60%";
  if (entry.name === "B") return "80%";
  return "100%";
};

<PieChart width={500} height={500}>
  <Pie
    data={data}
    dataKey="value"
    outerRadius={outerRadius}
    isAnimationActive={false}
  />
</PieChart>;
```

Тип `outerRadius` в `PieDef`, `PieSettings` и в storybook-документации обновлён на `number | string | ((dataPoint: any) => number | string)`.

### `PolarGrid`: цвет заливки `fill`

[#6287](https://github.com/recharts/recharts/pull/6287) закрывает долгоиграющий issue [#2856](https://github.com/recharts/recharts/issues/2856) и добавляет поддержку цвета заливки для промежуточного («радарного») кольца `PolarGrid`:

```tsx
<PolarGrid radialLines fill="rgba(255, 0, 0, 0.1)" fillOpacity={0.5} />
```

Раньше `PolarGrid` рисовал только линии и сам не давал закрасить область между центральным и внешним периметром — для «подложки» приходилось рисовать отдельный элемент. Теперь область можно залить цветом через проп `fill` с регулируемой прозрачностью.

## Исправления

### `Label` как вложенные children в X/YAxis и Reference-элементах

[#6219](https://github.com/recharts/recharts/pull/6219) разрешает рендерить `Label` вложенным элементом прямо внутри `XAxis`, `YAxis`, `ReferenceArea`, `ReferenceLine`, `ReferenceDot`. Раньше для подписи внутри этих элементов приходилось использовать `label`-проп; теперь можно обычный JSX-порядок:

```tsx
<YAxis>
  <Label position="insideLeft" value="тыс. руб." />
</YAxis>
```

### `YAxis width="auto"`: починена вёрстка при длинных тиках

[#6262](https://github.com/recharts/recharts/pull/6262) исправляет «моргание» осей при смене props и доводит до ума `width="auto"` из 3.0: раньше при длинных тиках (или тиках в виде объектов) авто-ширина считалась неточно и текст мог обрезаться или приводить к прыжку лейаута. В diff добавлены VR-скриншот-тесты для `YAxis` с `width="auto"` и длинными тиками.

### `Bar`: снова быстрее без `activeBar`

[#6290](https://github.com/recharts/recharts/pull/6290) возвращает оптимизацию рендера `Bar`, когда `activeBar` не задан (falsy) — в таких случаях не нужны лишние сравнения и перерисовки состояний наведения. Это заметный прирост при большом числе баров.

### Stacked Bar/Area: дубликаты категорий

[#6194](https://github.com/recharts/recharts/pull/6194) чинит stacked-графики (`Stacked Bar`/`Area`), в данных которых одна и та же категория встречается несколько раз. Раньше такие дубликаты приводили к неверному накоплению значений в стеке.

### `Scatter`: нестроковый `type`

[#6248](https://github.com/recharts/recharts/pull/6248) устраняет exception, когда у данных `Scatter` свойство `type` имело нестроковый тип (например, встретилось совпадение с внутренним именем поля).

### `Text`: пустые children при `scaleToFit`

[#6282](https://github.com/recharts/recharts/pull/6282) чинит исключение, когда у `Text` пустые дети и включён `scaleToFit={true}`. Вместе с этим PR добавлены тесты и storybook-документация для `Text` ([#6278](https://github.com/recharts/recharts/pull/6278)).

### Polar-оси: позиции тиков

[#6276](https://github.com/recharts/recharts/pull/6276) исправляет позиции текста тиков в `PolarAngleAxis`/`Radar`.

### Tooltip в синхронизированных графиках

[#6263](https://github.com/recharts/recharts/pull/6263) ограничивает координаты тултипа границами контейнера в синхронизированных через `syncId` графиках — раньше тултип мог выезжать за пределы.

### Brush: управление клавишами после мыши

[#6285](https://github.com/recharts/recharts/pull/6285) позволяет управлять «бегунками» (travellers) `Brush` с клавиатуры даже после взаимодействия мышью.

### `useActiveTooltipDataPoints`: бесконечный рендер

[#6247](https://github.com/recharts/recharts/pull/6247) устраняет бесконечный цикл рендера, который мог возникать при использовании хука `useActiveTooltipDataPoints` (добавленного в 3.1).

## Перемещения LabelList

[#6246](https://github.com/recharts/recharts/pull/6246) переписывает `LabelList` так, что он читает состояние через React-контекст вместо прямого обращения к DOM — параллельно исправлен баг, из-за которого `LabelList` не рендерился в `Pie`-графиках.

## Служебные изменения

- **ESLint 9** ([#6284](https://github.com/recharts/recharts/pull/6284)): обновление линтера в монорепе.
- **Redux devTools — opt-in** ([#6264](https://github.com/recharts/recharts/pull/6264), fixes [#6250](https://github.com/recharts/recharts/issues/6250)): регистрация расширения Redux DevTools больше не включается по умолчанию, а становится опциональной, что убирает накладные расходы и возможные проблемы в production.
- **Строгая проверка на null** ([#6249](https://github.com/recharts/recharts/pull/6249), [#6260](https://github.com/recharts/recharts/pull/6260)): продолжение подключения `strictNullChecks` к типам библиотеки.

## Стоит ли обновляться

Да — релиз без заявленных breaking changes. Самое ценное: `useMargin` в связке с уже существовавшими `useOffset`/`usePlotArea` даёт почти полный доступ к геометрии графика для кастомных компонентов, а `useXAxisDomain`/`useYAxisDomain` — к актуальным доменам осей (включая учёт `Brush`). Для всех остальных полезны `fill` у `PolarGrid`, строки в `outerRadius` у `Pie` и возврат ускоренного рендера `Bar`.

Recharts продолжает последовательно расширять публичный хук-API для чтения внутреннего состояния и чинить регрессии 3.x без изменения стабильного интерфейса.

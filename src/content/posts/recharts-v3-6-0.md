---
author: Артём Нецветаев
pubDatetime: 2026-08-22T18:10:00.000Z
title: "Recharts 3.6: новый компонент BarStack, ranged stacked bars и равноотстоящие тики осей"
slug: recharts-v3-6-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 3.6.0 (minor): новый компонент `BarStack` для настройки всей стопки баров (скругление через `radius`), поддержка ranged (интервальных) значений в стековых барах, опция интервала тиков `'equidistantPreserveEnd'` для осей, экспорт типов из корня пакета и серия фиксов Tooltip, Scatter, Label/LabelList."
---

Recharts 3.6.0 — минорный релиз. Главное — новый компонент `BarStack`, позволяющий конфигурировать всю стопку баров целиком (например, задать `radius` один раз для всей группы), и поддержка ranged-значений в стековых барах, когда значение каждого бара — интервал `[min, max]`. Плюс у осей появилась новая опция интервала тиков `'equidistantPreserveEnd'`, а из корня пакета экспортированы ещё несколько публичных типов.

Источник: GitHub Release [`recharts/recharts@v3.6.0`](https://github.com/recharts/recharts/releases/tag/v3.6.0). Все изменения проверены по телам связанных PR и исходникам на теге `v3.6.0`.

## `BarStack`: новое подмножество стопки баров

[#6746](https://github.com/recharts/recharts/pull/6746) добавляет компонент `BarStack` (путь `src/cartesian/BarStack.tsx`), который группирует несколько `Bar` и задаёт настройки для всей стопки сразу. Это отвечает на давние запросы (#6698, #4477, #3887) — раньше `Bar.radius` применялся к каждому бару по отдельности, а общее скругление границ стопки не настраивалось.

Пропы `BarStack`:

```ts
type BarStackProps = {
  stackId?: StackId;
  radius?: RectRadius; // default: 0
  children?: ReactNode;
};
```

Ключевая особенность `radius`: он применяется один раз ко всей стопке «как к одному большому бару». Если скруглить стек из трёх баров радиусом `10`, закруглёнными будут только внешние углы всей группы, а средние бары получат квадратные углы. `RectRadius` (тип из `src/shape/Rectangle.tsx`) принимает либо одно число (все четыре угла), либо массив из четырёх чисел — верхний-левый, верхний-правый, нижний-правый, нижний-левый.

При этом `Bar.radius` по-прежнему работает и может комбинироваться: он скругляет углы индивидуальных баров, а `BarStack.radius` — внешние углы всей стопки. Если `stackId` задан и у `BarStack`, и у вложенных `Bar`, приоритет у `BarStack` (`useStackId` в `src/cartesian/BarStack.tsx` переопределяет контекст). Реализация основана на `BarStackContext` и `clipPath`: для каждого прямоугольника стопки рендерится `clipPath`, на который ссылаются отдельные бары, чтобы получить скругление всей группы.

```tsx
import { BarChart, XAxis, YAxis, Bar, BarStack } from "recharts";

<BarChart data={data}>
  <XAxis dataKey="name" />
  <YAxis />
  <BarStack radius={25}>
    <Bar dataKey="value1" fill="#8884d8" />
    <Bar dataKey="value2" fill="#82ca9d" />
    <Bar dataKey="value3" fill="#ffc658" />
  </BarStack>
</BarChart>;
```

## Ranged stacked bars: интервальные значения в стеках

[#6722](https://github.com/recharts/recharts/pull/6722) включает поддержку ranged-значений в стековых барах (закрывает #1510). Каждое значение бара может представлять собой интервал `[min, max]`, и стопка больше не «схлопывает» диапазоны при суммировании — интервальные значения сохраняются как есть и отображаются как горизонтальные отрезки-бары внутри стека:

```tsx
const data = [
  { name: "A", value1: [100, 200], value2: [200, 250], value3: [250, 300] },
  { name: "B", value1: [120, 180], value2: [130, 230], value3: [170, 270] },
];

<BarChart data={data}>
  <XAxis dataKey="name" />
  <YAxis />
  <Tooltip />
  <BarStack radius={25}>
    <Bar dataKey="value1" fill="#8884d8" maxBarSize={50} />
    <Bar dataKey="value2" fill="#82ca9d" maxBarSize={50} />
    <Bar dataKey="value3" fill="#ffc658" maxBarSize={50} />
  </BarStack>
</BarChart>;
```

Пример из официального сайта — [RangedStackedBarChart](https://recharts.github.io/en-US/examples/RangedStackedBarChart/), там же обновлён guide [Rounded Bars](https://recharts.github.io/en-US/guide/roundedBars/) для `BarStack.radius`.

## `'equidistantPreserveEnd'`: равноотстоящие тики без потери последнего

[#6661](https://github.com/recharts/recharts/pull/6661) добавляет новый строковый литерал для пропа `interval` у `XAxis`/`YAxis` (закрывает #6642). В `src/util/types.ts` тип `AxisInterval` расширен значением `'equidistantPreserveEnd'`, а в `src/cartesian/getTicks.ts` добавлена функция `getEquidistantPreserveEndTicks`, которая модифицирует логику обнаружения наложений: при расстановке равноотстоящих тиков последний тик (`index === ticks.length - 1`) всегда сохраняется видимым, даже если при обычном равноотстоящем интервале он был бы пропущен.

```tsx
<XAxis dataKey="name" interval="equidistantPreserveEnd" />
```

Опция полезна на длинных осях, где важно не только равномерное расстояние между тиками, но и гарантия, что конец диапазона подписан.

## Тултипы: `graphicalItemId` и починка дублирования в Scatter

- [#6765](https://github.com/recharts/recharts/pull/6765) — в объект payload тултипа добавлено поле `graphicalItemId`, позволяющее однозначно связывать записи тултипа с конкретным графическим элементом (Area, Bar, Line, Scatter и др.). Это инфраструктурное изменение: само по себе поведение почти не меняется, но теперь у пользователей и у внутреннего кода есть стабильный идентификатор для фильтрации.
- [#6773](https://github.com/recharts/recharts/pull/6773) — фикс бага, когда при нескольких `Scatter` в одном `ScatterChart` payload тултипа дублировался или содержал посторонние элементы. Сопоставление тултипов теперь ведётся только по ID графического элемента (закрывает #6075).

## Экспорт типов из корня пакета

Из основного входа `recharts` теперь экспортируются новые публичные типы:

- [#6706](https://github.com/recharts/recharts/pull/6706) — `PieSectorShapeProps` (ранее его приходилось вручную собирать как `PieSectorDataItem & { isActive: boolean }`). К слову, это продолжение перехода на единый проп `shape` из 3.5.0: теперь тип для кастомной функции формы сектора можно импортировать напрямую.

```ts
import { PieSectorShapeProps } from "recharts";

function Sector(props: PieSectorShapeProps) {
  const { isActive, ...rest } = props;
  return <path {...rest} fill={isActive ? "#8884d8" : "#ddd"} />;
}
```

- [#6676](https://github.com/recharts/recharts/pull/6676) — из корня пакета экспортированы `TooltipIndex`, `BarRectangleItem`, `TreemapNode`, `DataKey`, `AxisInterval`. Раньше `TooltipIndex` приходилось импортировать «глубоким» внутренним путём `recharts/types/state/tooltipSlice`, который не является стабильным публичным API. В релизе также добавлено ESLint-правило, запрещающее импорты из внутренних путей (`recharts/types/state/*` и т.п.), чтобы такие регрессии не возвращались.

## Исправления

- **`Label`/`LabelList`** ([#6732](https://github.com/recharts/recharts/pull/6732)) — исправлен краш, когда `Label` передавался как `content` в `LabelList`.
- **`General`** ([#6707](https://github.com/recharts/recharts/pull/6707)) — числа округляются до 4 знаков после запятой перед попаданием в DOM-пути. Причина: между Node 22 и Node 24 изменились вычисления чисел с плавающей точкой, из-за чего координаты начали различаться где-то на 10-м знаке после запятой — для пикселей это несущественно, поэтому их стали округлять (приведение к 0 знаков давало слишком большой визуальный дифф).
- **`General`** ([#6753](https://github.com/recharts/recharts/pull/6753)) — `ZIndexPortal` теперь хранит ссылки на узлы вместо строковых ID, потому что `document.getElementById` недоступен внутри shadow DOM. Это разблокирует рендер графиков в контейнере shadow DOM (закрывает discussion #6752).

## Служебное и депрекации

- **`CartesianAxis` объявлен устаревшим** ([#6774](https://github.com/recharts/recharts/pull/6774)). Компонент помечен `@deprecated`; пользователям рекомендуется использовать `XAxis`/`YAxis`. Выяснилось, что `CartesianAxis` на самом деле не читал проп `scale` — он игнорировался ещё с v3.0, поэтому этот проп тоже депрецирован, и внутренний объект scale не перестанет быть частью публичного API (закрывает #6645, discussion #6734). С v4.0 `CartesianAxis` станет внутренним компонентом.
- **Node.js 24** — сборка пакета переведена на Node 24.
- **TypeScript `strict`** — добавлена большая порция проверок на `undefined` в рамках движения к TS `strict` mode.
- **Docs** — документация (комментарии в коде, storybook, сайт) теперь генерируется автоматическим генератором документации @PavelVanecek («omnidoc»), поэтому она держится в синхронизации с кодом.

## Итоги

- **Версия:** 3.6.0 (minor). Breaking-изменений нет; единственная депрекация — `CartesianAxis` (использовать `XAxis`/`YAxis`, до удаления в v4.0 он продолжает работать).
- **`BarStack`:** новый компонент с `radius` для скругления всей стопки баров и общим `stackId` ([#6746](https://github.com/recharts/recharts/pull/6746)).
- **Ranged stacked bars:** интервальные значения `[min, max]` теперь корректно сохраняются в стеках ([#6722](https://github.com/recharts/recharts/pull/6722)).
- **Оси:** новая опция интервала `'equidistantPreserveEnd'` для `XAxis`/`YAxis` ([#6661](https://github.com/recharts/recharts/pull/6661)).
- **Типы:** из `recharts` теперь экспортируются `PieSectorShapeProps`, `TooltipIndex`, `BarRectangleItem`, `TreemapNode`, `DataKey`, `AxisInterval` ([#6706](https://github.com/recharts/recharts/pull/6706), [#6676](https://github.com/recharts/recharts/pull/6676)).
- **Фиксы:** тултип для нескольких `Scatter` ([#6773](https://github.com/recharts/recharts/pull/6773)), краш `Label` в `LabelList` ([#6732](https://github.com/recharts/recharts/pull/6732)), округление чисел перед DOM ([#6707](https://github.com/recharts/recharts/pull/6707)), поддержка shadow DOM ([#6753](https://github.com/recharts/recharts/pull/6753)).
- Полный список изменений: [compare v3.5.1...v3.6.0](https://github.com/recharts/recharts/compare/v3.5.1...v3.6.0).

**Стоит ли обновляться.** Да. Главное — `BarStack` упрощает скругление стопок баров (то, что потребовало бы отдельных `Bar.radius` и ручного позиционирования раньше) и наконец появилась поддержка ranged-значений в стеках. Совокупность фиксов тултипов и shadow DOM тоже заметно улучшает стабильность встраивания графиков. Установка:

```bash
npm install recharts@3.6.0
```

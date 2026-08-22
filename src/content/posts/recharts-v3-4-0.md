---
author: Артём Нецветаев
pubDatetime: 2026-08-22T17:27:00.000Z
title: "Recharts 3.4: z-index для порядка слоёв, кастомная форма у Line, выравнивание узлов Sankey"
slug: recharts-v3-4-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 3.4.0 (minor): глобальная система z-index для порядка слоёв SVG-графиков, проп shape у Line, выравнивание узлов Sankey через align/verticalAlign, переопределение textAnchor у Label, включение strictNulls в TSConfig и серия фиксов Funnel, Area и Stacked Bar + Brush."
---

Recharts 3.4.0 — минорный релиз, центральная фича которого — полноценный **z-index**: теперь почти всем элементам графика можно задать числовой `zIndex`, управляя порядком отрисовки так же, как CSS z-index. Раньше порядок слоёв был жёстко зашит в SVG-структуру и переопределить его было нельзя. В релизе также появился проп `shape` у `Line`, выравнивание узлов `Sankey`, переопределение `textAnchor` у `Label`, включён `strictNulls` в TSConfig и исправлена серия багов.

Источник: GitHub Release [`recharts/recharts@v3.4.0`](https://github.com/recharts/recharts/releases/tag/v3.4.0). Подробности проверены по связанным PR и исходникам на теге: сигнатуры `zIndex` и дефолтные значения — в `src/zIndex/DefaultZIndexes.tsx` и `src/zIndex/ZIndexLayer.tsx`, проп `shape` у `Line` — в `src/cartesian/Line.tsx`, а `align`/`verticalAlign` у `Sankey` — в `src/chart/Sankey.tsx`.

## Система z-index: порядок слоёв без правок порядка рендера

[#6479](https://github.com/recharts/recharts/pull/6479) (закрывает [#6449](https://github.com/recharts/recharts/issues/6449), [#4721](https://github.com/recharts/recharts/issues/4721) и ещё несколько issue) добавляет на большинство элементов графиков проп `zIndex` — `number` с дефолтом `0`. Принцип: **SVG не поддерживает CSS z-index**, поэтому порядок рендера в `<SVG>` задаётся порядком DOM-узлов. Recharts решает это через React-порталы и `<g>`-элементы: для каждой числовой z-index-«зоны» создаётся отдельный DOM-узел, и контент рендерится в соответствующий узел через `createPortal`. Чем больше `zIndex` — тем ближе "к верху".

```tsx
<BarChart data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="name" />
  <YAxis />
  <Bar
    zIndex={1}
    dataKey="uv"
    fill="green"
    barSize={50}
    label={{ position: "insideTop", zIndex: 3, fill: "black" }}
  />
</BarChart>
```

Обратите внимание: `zIndex` принимают не только сами графики, но и вложенные сущности (например, `label` у `Bar`). Проп доступен на большом числе компонентов — bars, lines, areas, grids, axes, labels, dots, pies, radars и т.д. Работают и **отрицательные** значения: дефолты из `src/zIndex/DefaultZIndexes.tsx` используют отрицательные числа для фона, чтобы он гарантированно лежал под всем.

Дефолтная шкала (значения по умолчанию, если `zIndex` не задан):

| Элемент                                          | Значение |
| ------------------------------------------------ | -------- |
| `CartesianGrid` / `PolarGrid`                    | `-100`   |
| фон `Bar` / `RadialBar` (`background`)           | `-50`    |
| остальные элементы без явного `zIndex`           | `0`      |
| `Area`, `Pie`, `Radar`, `ReferenceArea`          | `100`    |
| `cursorRectangle` (кусор Tooltip)                | `200`    |
| `Bar`, `RadialBar`                               | `300`    |
| `Line`, `ReferenceLine`, `ErrorBar`              | `400`    |
| тики/линии `XAxis`/`YAxis`/полярных осей         | `500`    |
| `Scatter`, `ReferenceDot`, точки Line/Area/Radar | `600`    |
| `activeBar` (подсветка при hover)                | `1000`   |
| `cursorLine`                                     | `1100`   |
| `activeDot`                                      | `1200`   |
| `LabelList`, `Label`, оси-лейблы                 | `2000`   |

Внутренность, которая реализует слои — `ZIndexLayer` из `src/zIndex/ZIndexLayer.tsx` (рендерит детей в портал под нужный `zIndex`). Публичный API — это проп `zIndex` на компонентах; дефолтные «активные» состояния (activeBar, activeDot) по умолчанию отрисовываются поверх данных, благодаря чему не прячутся под соседними элементами.

Для кастомных элементов, не входящих в стандартные компоненты, можно воспользоваться тем же принципом слоёв через порталы zIndex (подробности в новом гайде [guide/zIndex](https://recharts.github.io/en-US/guide/zIndex/)).

## `Line`: проп `shape` для кастомной формы

[#6512](https://github.com/recharts/recharts/pull/6512) (issue [#6511](https://github.com/recharts/recharts/issues/6511)) добавляет `Line` то, что уже было у `Bar`, `Area` и других, — проп `shape` для собственной реализации линии. Тип пропа (в `src/cartesian/Line.tsx`):

```ts
shape?: ActiveShape<CurveProps, SVGPathElement>;
```

По умолчанию линия рисуется формой `curve`; подставив `shape`, вы полностью заменяете способ отрисовки сегмента — можете вернуть произвольный React-элемент (в `.svg`-узел `SVGPathElement`) или функцию, которой передаются `CurveProps`. В PR приведён пример story, где вдоль сегментов линии рисуются повёрнутые «тики»:

```tsx
<Line
  shape={props => {
    // props: points, pathRef и остальные CurveProps
    return <CustomRotatedTicks {...props} />;
  }}
  dataKey="value"
/>
```

Это закрывает давний кейс «как кастомизировать именно линию, а не только её точки/маркеры».

## `Sankey`: выравнивание узлов по горизонтали и вертикали

Два PR добавляют `Sankey` контроль над позиционированием узлов, полезный для диаграмм «пользовательского пути» (user journey), где важно логическое чтение сверху вниз.

- [#6568](https://github.com/recharts/recharts/pull/6568) (issue [#6567](https://github.com/recharts/recharts/issues/6567)) — проп `align: 'left' | 'justify'`. В режиме `left` все узлы с одинаковой логической глубиной прижимаются к левому краю; `justify` (дефолт) оставляет текущее поведение — стартовые узлы слева, конечные справа.
- [#6576](https://github.com/recharts/recharts/pull/6576) (issue [#6575](https://github.com/recharts/recharts/issues/6575)) — проп `verticalAlign` (тип `SankeyVerticalAlign`), значение `'top'` прижимает узлы к верхнему краю, `'justify'` (дефолт) — распределяет равномерно.

```tsx
{
  /* узлы одного уровня слева, прижаты к верху */
}
<Sankey
  data={data}
  node={{ x: 0, dx: 20 }}
  link={{ stroke: "#77c878" }}
  align="left"
  verticalAlign="top"
/>;
```

Оба пропа подтверждены в `src/chart/Sankey.tsx` на теге `v3.4.0`:

```ts
align: 'left' | 'justify',
verticalAlign: SankeyVerticalAlign,
```

## `Label`: переопределение `textAnchor`

[#6547](https://github.com/recharts/recharts/pull/6547) (закрывает [#6545](https://github.com/recharts/recharts/issues/6545) и [#6345](https://github.com/recharts/recharts/issues/6345)) — раньше `textAnchor` у `Label` вычислялся внутри на основе пропа `position`, и переопределить его было нельзя. Теперь компонент позволяет явно задать собственный `textAnchor` (а заодно получил и `zIndex`, доступный в новой системе). Это удобно, когда стандартная позиция лейбла не совпадает с желаемым горизонтальным выравниванием текста:

```tsx
<Label value="apples" position="insideBottom" textAnchor="start" fill="#333" />
```

## Исправления

- **`Stacked Bar / Brush`** ([#6481](https://github.com/recharts/recharts/pull/6481)) — исправлен сдвиг индексов в стековых bar-чартах с `Brush`; из-за него brush удалял элементы не с той стороны графика.
- **`Area`** ([#6507](https://github.com/recharts/recharts/pull/6507)) — возвращены обработчики событий `Area`, регрессия в которых была внесена ранее (события переставали срабатывать).
- **`Funnel`** ([#6453](https://github.com/recharts/recharts/pull/6453)) — исправлен расчёт отступов (margin) у `Funnel`.
- **`Funnel`** ([#6473](https://github.com/recharts/recharts/pull/6473)) — исправлены проблемы с позиционированием лейблов, внесённые предыдущим релизом.
- **`Label`/`Text`** ([#6467](https://github.com/recharts/recharts/pull/6467)) — типы `Label` и `Text` сужены до того, что они реально умеют рендерить (вместо избыточно широких сигнатур).
- **`Misc`** ([#6543](https://github.com/recharts/recharts/pull/6543)) — инлайнинг нескольких функций `es-toolkit`, вызывавших ошибки сборки.
- **`Misc`** ([#6581](https://github.com/recharts/recharts/pull/6581)) — убран циклический импорт, потенциально способный вызвать ошибки в рантайме.

## Chore: `strictNulls` включён в TSConfig

[#6497](https://github.com/recharts/recharts/pull/6497) завершает переход на строгую проверку null-значений: в TSConfig включён `strictNulls` (strict null checks), благодаря чему типы Recharts становятся строже и отсекают класс ошибок на уровне компиляции. Это внутреннее качество библиотеки — для пользователей проявляется как более точные типы в IDE.

## Документация

Помимо нового гайда по z-index, сайт `recharts.github.io` получил ряд обновлений: редактор кода в примерах переведён с изолированной слабости на codemirror ([#6531](https://github.com/recharts/recharts/pull/6531)), поправлены отсутствующие/устаревшие свойства в storybook и на сайте, и внесены небольшие правки вёрстки.

## Итоги

- **Версия:** 3.4.0 (minor), без breaking changes для кода — новая система слоёв дефолтно сохраняет прежний порядок рендера (все дефолтные `zIndex` зафиксированы так, чтобы поведение не изменилось), поэтому обновление безопасно.
- **z-index:** глобальный проп `zIndex` на большинстве элементов + дефолтная шкала слоёв ([#6479](https://github.com/recharts/recharts/pull/6479)); гайд — https://recharts.github.io/en-US/guide/zIndex/.
- **`Line.shape`:** кастомная форма линии через `ActiveShape<CurveProps, SVGPathElement>` ([#6512](https://github.com/recharts/recharts/pull/6512)).
- **`Sankey`:** `align="left"` и `verticalAlign="top"` для выравнивания узлов ([#6568](https://github.com/recharts/recharts/pull/6568), [#6576](https://github.com/recharts/recharts/pull/6576)).
- **`Label`:** переопределение `textAnchor` ([#6547](https://github.com/recharts/recharts/pull/6547)).
- **Качество типов:** `strictNulls` в TSConfig ([#6497](https://github.com/recharts/recharts/pull/6497)).
- Новые контрибьюторы релиза: @37108, @tarik02, @dbnl-renaud, @dbnl-kat и бот @coderabbitai[bot].
- Полный список изменений: [compare v3.3.0...v3.4.0](https://github.com/recharts/recharts/compare/v3.3.0...v3.4.0).

**Стоит ли обновляться.** Да — `zIndex` закрывает давнюю боль с порядком слоёв (например, чтобы точки/лейблы не прятались под «соседним» графиком), `shape` у `Line` упрощает кастомизацию линий, а `align`/`verticalAlign` для `Sankey` прижаты к актуальному кейсу user-journey-диаграмм. Всё это — аддитивные пропы без breaking changes; точечные фиксы `Funnel`, `Area` и стеков с `Brush` — приятный бонус для тех, кто на них натыкался. Установка:

```bash
npm install recharts@3.4.0
```

---
author: Артём Нецветаев
pubDatetime: 2026-08-22T15:07:00.000Z
title: "Recharts 2.9.0: activeBar у Bar, кастомные линии CartesianGrid, onDragEnd у Brush и сокращение бандла на ~9 кБ"
slug: recharts-v2-9-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 2.9.0 (minor): новый проп activeBar у Bar (как activeDot у Line), пропы syncWithTicks/horizontalValues/verticalValues у CartesianGrid, улучшенный интервал equidistantPreserveStart у CartesianAxis, событие onDragEnd у Brush, фиксы activeShape с Tooltip для Funnel/Scatter/Pie/RadialBar, передача style у ResponsiveContainer и сокращение размера бандла примерно на 85 кБ / 9 кБ (gzip)."
---

Recharts 2.9.0 (minor) — крупный выпуск, нацеленный на внутреннюю поддержку кода, давние баги и нужные улучшения. Главные точки: новый проп `activeBar` у `Bar` (по аналогии с `activeDot` у `Line`), новые пропсы кастомизации сетки у `CartesianGrid` (`syncWithTicks`, `horizontalValues`, `verticalValues`), переработанный интервал тиков `equidistantPreserveStart` у `CartesianAxis`, событие `onDragEnd` у `Brush`, а также заметное сокращение размера бандла — примерно на 85 кБ (~9 кБ gzip). **Версия не ломает публичный API.**

Источник — [GitHub Release `recharts/recharts@v2.9.0`](https://github.com/recharts/recharts/releases/tag/v2.9.0) и [сравнение с v2.8.0](https://github.com/recharts/recharts/compare/v2.8.0...v2.9.0). Детали проверены по связанным PR и исходному коду на теге `v2.9.0`.

## Новое в API

### `Bar.activeBar` — кастомный активный бар при наведении

**feat** ([PR #3756](https://github.com/recharts/recharts/pull/3756), issue [#3723](https://github.com/recharts/recharts/issues/3723)) — у `Line` уже был проп `activeDot`, который рендерит кастомную точку на активной позиции при работе с `Tooltip`. До этого релиза у `Bar` такого механизма не было — активный бар нельзя было изменять.

Теперь `Bar` принимает проп `activeBar: ActiveShape<BarProps, SVGPathElement>`. Он работает через внутренний `activeIndex`: когда `Tooltip` наводится на конкретный бар, для активного индекса используется `activeBar` вместо обычного `shape`, остальные бары рендерятся штатно (в исходнике: `const option = isActive ? activeBar : shape`). Значение по умолчанию — `true` (то есть прежнее поведение, активный бар рендерится обычной формой), так что изменение не breaking:

```tsx
<Bar
  dataKey="value"
  activeBar={<Rectangle className="bar-active" />}
  // или функция для условной отрисовки
/>
```

### `CartesianGrid`: `syncWithTicks`, `horizontalValues`, `verticalValues`

**feat** ([PR #3746](https://github.com/recharts/recharts/pull/3746), issue [#2153](https://github.com/recharts/recharts/issues/2153)) — `CartesianGrid` автоматически рисовал линии сетки на min/max значениях осей, плюс дополнительную линию на нуле. Управлять этим было нельзя, поэтому сетка часто не совпадала с тиками осей.

Добавлено три новых пропа (проверено по исходнику на `v2.9.0`; обратите внимание, что в тексте релиза название `horizontalValues` опечатано как «horizonalValues»):

- `syncWithTicks?: boolean` — если `false`, рисуются дополнительные линии на min/max (прежнее поведение по умолчанию); если `true` — линии только на значениях тиков осей.
- `horizontalValues?: number[] | string[]` — собственный массив значений для горизонтальных линий сетки.
- `verticalValues?: number[] | string[]` — собственный массив значений для вертикальных линий сетки.

`horizontalValues`/`verticalValues` имеют приоритет над `syncWithTicks`, а явные `horizontalPoints`/`verticalPoints` — над ними. Пример:

```tsx
<CartesianGrid
  syncWithTicks
  strokeDasharray="3 3"
  horizontalValues={[0, 50, 100]}
/>
```

### `CartesianAxis` — переработка интервала `equidistantPreserveStart`

**feat** ([PR #3768](https://github.com/recharts/recharts/pull/3768), issue [#3305](https://github.com/recharts/recharts/issues/3305)) — опция интервала тиков `equidistantPreserveStart` переработана. Теперь она всегда показывает первый тик, а начиная с него находит наименьший шаг `N`, при котором все тики с шагом `N` помещаются без пересечения. Столкновение определяет с учётом кастомного форматирования тиков, единиц измерения, размера шрифта, угла поворота и т.п. — тики считаются пересекающимися, если конец предыдущего накладывается на начало следующего.

Минусы метода: если первый тик очень длинный, остальных показано будет мало, а производительность ниже прочих вариантов (алгоритм итерирует тики до `M` раз, где `M` — общее число тиков, для 1000 точек — 1000 проходов). Использование через значение `interval`:

```tsx
<CartesianAxis interval="equidistantPreserveStart" />
```

### `Brush.onDragEnd` — событие окончания перетаскивания

**feat** ([PR #3774](https://github.com/recharts/recharts/pull/3774), issues [#2534](https://github.com/recharts/recharts/issues/2534), [#859](https://github.com/recharts/recharts/issues/859)) — раньше данные о положении `Brush` можно было получить только через `onChange`, который срабатывает при каждом движении — это приводило к избыточным вызовам (например, подгрузку данных с API приходилось разменивать через debounce).

Добавлено событие `onDragEnd`, которое срабатывает один раз после завершения перетаскивания и через свойство `startIndex`/`endIndex` отдаёт конечные индексы активного диапазона:

```tsx
<Brush
  dataKey="name"
  onDragEnd={(startIndex, endIndex) => {
    loadData(data.slice(startIndex, endIndex));
  }}
/>
```

## Исправления

### `activeShape` теперь работает с `Tooltip` в четырёх компонентах

**fix** — серия PR от `@andrewangelle`: у `Funnel` ([#3772](https://github.com/recharts/recharts/pull/3772)), `Scatter` ([#3839](https://github.com/recharts/recharts/pull/3839)), `Pie` ([#3818](https://github.com/recharts/recharts/pull/3818)) и `RadialBar` ([#3803](https://github.com/recharts/recharts/pull/3803)) кастомный `activeShape`, заданный на чувствительных к наведению компонентах, корректно применялся и в связке с `Tooltip`. Раньше активная форма могла не отображаться или рендериться некорректно при наведении.

### `CartesianGrid`: убран атрибут `offset` у линий

**fix** ([PR #3854](https://github.com/recharts/recharts/pull/3854), issue [#3810](https://github.com/recharts/recharts/issues/3810)) — из линий сетки `CartesianGrid` удалён атрибут `offset`. Раньше статичный отрезок, добавленный для позиционирования, конфликтовал с трансформацией (`transform`) сетки, из-за чего линии «уезжали» при трансформации графика.

### `ResponsiveContainer`: `style` прокидывается корректно

**fix** ([PR #3726](https://github.com/recharts/recharts/pull/3726)) — ранее `style`, заданный на `ResponsiveContainer`, не передавался на корневой элемент в ряде сценариев и не применялся. Теперь проп `style` доходит до нижележащего контейнера напрямую.

### `Legend`: ошибка «Functions are not valid as a React child»

**fix** ([PR #3750](https://github.com/recharts/recharts/pull/3750), issue [#3749](https://github.com/recharts/recharts/issues/3749)) — когда в проп `payload` компонента `<Legend/>` передавалась функция, React выбрасывал ошибку «Functions are not valid as a React child». Обработка такого payload исправлена, ошибка больше не возникает.

### `Tooltip`: позиция при `transform: scale` на контейнере

**fix** ([PR #3748](https://github.com/recharts/recharts/pull/3748)) — если контейнер графика был увеличен через CSS `transform: scale(...)` (например, внутри зума), позиция `Tooltip` вычислялась неправильно и тултип смещался. Позиционирование исправлено для таких случаев.

### `Tooltip`: данные из всех графиков при отдельных датасетах

**fix** ([PR #3733](https://github.com/recharts/recharts/pull/3733), issue [#3669](https://github.com/recharts/recharts/issues/3669)) — если общий датасет передавался в проп `data` графика, а `Line`/`Area` и т.п. получали собственный `data`, то `Tooltip` не показывал данные со всех серий. Сбор payload для тултипа исправлен, чтобы включались данные из всех графиков.

## Рефакторинг и размер бандла

Благодаря `@PavelVanecek` (33 PR за месяц) и другим в этом релизе сделан большой пласт внутренней работы:

- улучшение типов (type safety) без breaking change;
- сокращение размера исходников и итогового бандла — суммарно примерно на 85 кБ, что в gzip даёт сокращение около 9 кБ;
- улучшение unit-тестов, снижающее риск регрессий.

**Chore**: `react-smooth` обновлён до `2.0.5` (потенциально закрывал issue [#1135](https://github.com/recharts/recharts/issues/1135), который, по пометке в релизе, уже был решён ранее); добавлен инструмент замера производительности ([PR #3829](https://github.com/recharts/recharts/pull/3829)); удалён неиспользуемый `reduceCSSCalc` ([PR #3820](https://github.com/recharts/recharts/pull/3820)).

**Storybook**: добавлен `storybook-addon-performance` ([PR #3826](https://github.com/recharts/recharts/pull/3826)) и множество улучшений/фиксов сторибука.

## Итоги

- Версия: **2.9.0** (minor), без breaking change.
- Ключевые feature: `Bar.activeBar` (PR #3756), `CartesianGrid.syncWithTicks`/`horizontalValues`/`verticalValues` (PR #3746), переработка `CartesianAxis` interval `equidistantPreserveStart` (PR #3768), `Brush.onDragEnd` (PR #3774).
- Фиксы: `activeShape` с `Tooltip` для Funnel/Scatter/Pie/RadialBar, убран `offset` у линий `CartesianGrid`, корректная передача `style` у `ResponsiveContainer`, исправлена ошибка `Legend` и позиционирование/агрегация данных у `Tooltip`.
- Прочее: сокращение бандла примерно на 85 кБ / 9 кБ (gzip), обновление `react-smooth` до `2.0.5`, внутренний рефакторинг по типам и тестам.

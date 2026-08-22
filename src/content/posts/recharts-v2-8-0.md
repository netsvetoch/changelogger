---
author: Артём Нецветаев
pubDatetime: 2026-08-22T14:47:34.000Z
title: "Recharts 2.8.0: rootTabIndex у Pie, sort у Sankey, клавиатурный доступ в Brush и чистка defaultProps"
slug: recharts-v2-8-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 2.8.0: новые пропсы rootTabIndex у Pie и sort у Sankey, базовый клавиатурный доступ к Brush, className у Cell в RadialBarChart, исправление SSR-предупреждения в Rectangle, тип value в legend Formatter и масштабная чистка defaultProps (функциональные компоненты на default params, Tooltip возвращён в класс)."
---

Recharts 2.8.0 (minor) — выпуск «мелких изменений», сфокусированный на устранении консольных ошибок про `defaultProps` и на первых кусочках доступности. Главные точки: новый проп `rootTabIndex` у `Pie`, новый булев проп `sort` у `Sankey`, базовый клавиатурный доступ к travellers компонента `Brush`, поддержка `className` у `Cell` внутри `RadialBarChart`, а также генеральная замена `defaultProps` на default params в функциональных компонентах и возврат `Tooltip` к классовому виду. **Версия не ломает публичный API.**

Источник — [GitHub Release `recharts/recharts@v2.8.0`](https://github.com/recharts/recharts/releases/tag/v2.8.0) и [сравнение с v2.7.2](https://github.com/recharts/recharts/compare/v2.7.2...v2.8.0). Детали проверены по связанным PR и диффам.

> ⚠️ Предупреждение из v2.7.0 про «Support for defaultProps will be removed from function components» ([#3615](https://github.com/recharts/recharts/issues/3615)) в этом релизе наконец закрыто — см. раздел про рефакторинг ниже.

## Новое в API

### `Pie.rootTabIndex` — контроль фокуса корневого слоя

**feat** ([PR #3700](https://github.com/recharts/recharts/pull/3700)) — раньше корневой `Layer` компонента `Pie` всегда был focus-able (неявный `tabIndex = 0`), и поведение фокуса нельзя было изменить. Теперь `Pie` принимает проп `rootTabIndex`, который применяется к корневому слою в рендере. По умолчанию — `0` (прежнее значение), так что изменение не breaking:

```tsx
<Pie data={data} dataKey="value" rootTabIndex={-1} />
```

Передав `-1`, можно полностью убрать компонент из tab-навигации, либо задать любое другое значение порядка фокуса.

### `Sankey.sort` — отключение сортировки узлов

**feat** ([PR #3690](https://github.com/recharts/recharts/pull/3690), issue [#3683](https://github.com/recharts/recharts/issues/3683)) — `Sankey` автоматически сортировал узлы по значению `y`, и управлять этим поведением было нельзя. Для таких кейсов как cashflow-диаграммы это мешало: связи перекрещивались, несмотря на желаемую группировку веток по категориям.

Добавлен булев проп `sort` (по умолчанию `true` — старое поведение). При `false` сортировка по `ascendingY` в `resolveCollisions` отключается, и узлы/связи раскладываются без автоматического переупорядочивания:

```tsx
<Sankey data={data} nodePadding={20} link={{ stroke: "#777" }} sort={false}>
```

### `RadialBarChart`: `className` у `Cell`

**feat** ([PR #3654](https://github.com/recharts/recharts/pull/3654), issue [#3653](https://github.com/recharts/recharts/issues/3653)) — `RadialBarChart` поддерживает вложенные `<Cell>`, но не прокидывал у них кастомные CSS-классы. Теперь `className`, заданный на `Cell`, применяется к соответствующему бару:

```tsx
<RadialBarChart data={data}>
  <RadialBar dataKey="value">
    <Cell className="bar-highlight" />
  </RadialBar>
</RadialBarChart>
```

## Доступность

### Базовый клавиатурный доступ к `Brush`

**feat (a11y)** ([PR #3633](https://github.com/recharts/recharts/pull/3633), issue [#3549](https://github.com/recharts/recharts/issues/3549)) — добавлена поддержка клавиатурного взаимодействия с travellers компонента `Brush`:

- travellers можно сфокусировать с клавиатуры;
- стрелки влево/вправо перемещают выбранный traveller между tick-индексами.

Добавлены автоматизированные тесты для взаимодействий с клавиатуры и обновлена документация по доступности. Это первый (базовый) шаг — полноценная поддержка доступности компонентов продолжит развиваться.

## Исправления

### SSR-предупреждение в `Rectangle` (`useLayoutEffect` → `useEffect`)

**fix** ([PR #3657](https://github.com/recharts/recharts/pull/3657), issue [#3656](https://github.com/recharts/recharts/issues/3656)) — при server-side-рендере (`ReactDOMServer.renderToString`) `Rectangle` выдавал предупреждение React:

> Warning: useLayoutEffect does nothing on the server, because its effect cannot be encoded into the server renderer's output format.

Импорт и вызов `useLayoutEffect` в `Rectangle` заменены на `useEffect`. График с прямоугольными формами (bars и т.п.) теперь SSR-рендерится чисто, без предупреждения, и корректно гидрацируется.

### TS: тип `value` у legend `Formatter`

**fix** ([PR #3668](https://github.com/recharts/recharts/pull/3668), issue [#3666](https://github.com/recharts/recharts/issues/3666)) — у типа `Formatter` компонента `DefaultLegendContent` появилось свойство `value?: any`. Раньше при передаче formatter-функции в легенду пир-чарта TypeScript не видел в `entry.payload` само значение payload, что мешало безопасной типизации. Теперь обращение к значению в formatter валидно:

```tsx
<Legend formatter={(value, entry) => `${value} — ${entry.payload?.value}`} />
```

## Рефакторинг: закрытие ошибок `defaultProps` (#3615)

Это главная «идейная» часть релиза. Проблема из [issue #3615](https://github.com/recharts/recharts/issues/3615): на функциональных компонентах React предупреждает, что `defaultProps` будет удалён в будущих major-версиях. Решение — двухтактное:

- функциональные компоненты (`Cross`, `Curve`, `Rectangle`, `Sector`, `Symbols`, `Trapezoid`) переведены на **default parameters** вместо `defaultProps`;
- `Tooltip` **возвращён к классовой реализации** (`class Tooltip ... extends PureComponent` со `static defaultProps`), где `defaultProps` остаётся легальным.

Все изменения внутренние. Поведение и внешний API не меняются — цель именно исчезновение консольных ошибок про `defaultProps`.

## Docs / Storybook

Обновлены storybook-примеры, включая иллюстрацию нового пропа `sort` у `Sankey` (сравнение «with sorting» / «without sorting»), и добавлены тесты для новых возможностей.

## Итоги

- Версия: **2.8.0** (minor), без breaking change.
- Ключевые feature: `Pie.rootTabIndex` (PR #3700), `Sankey.sort` (PR #3690), `className` у `Cell` в `RadialBarChart` (PR #3654).
- Доступность: базовый клавиатурный доступ к `Brush` — фокус на travellers и стрелки влево/вправо (PR #3633).
- Фиксы: SSR-предупреждение в `Rectangle` через `useLayoutEffect`→`useEffect` (PR #3657), тип `value` у legend `Formatter` (PR #3668).
- Рефакторинг: функциональные компоненты переведены на default params, `Tooltip` возвращён в класс — закрыта серия ошибок про `defaultProps` (#3615).

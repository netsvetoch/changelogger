---
author: Артём Нецветаев
pubDatetime: 2026-08-22T13:27:25.000Z
title: "Recharts 2.4.0: завершение миграции тестов на Jest и RTL, ускорение построения осей и серия исправлений для null-данных"
slug: recharts-v2-4-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 2.4.0 завершает миграцию тестов на Jest и React Testing Library, ускоряет построение axis map при заданном domain, чинит распространение функций на SVG-элементы и NaN в Bar при null-данных."
---

Recharts 2.4.0 (minor) отмечает окончание крупного внутреннего milestones — перевода тестового стека с karma на Jest и React Testing Library (RTL). Вместе с этим в релиз вошли оптимизация построения осей при явно заданном `domain`, несколько точечных фиксов поведений и ряд уточнений типов. Эта версия **не ломает** публичный API — breaking change намечен на грядущую 3.x.

Источник — [GitHub Release `recharts/recharts@v2.4.0`](https://github.com/recharts/recharts/releases/tag/v2.4.0) и [сравнение с v2.3.2](https://github.com/recharts/recharts/compare/v2.3.2...v2.4.0). Детали ниже проверены по связанным PR.

## Оптимизация: short-circuit построения axis map при заданном domain

**feat** ([PR #3293](https://github.com/recharts/recharts/pull/3293), fix [#2762](https://github.com/recharts/recharts/issues/2762)) ускоряет построение `axis map` — самой дорогой части `updateStateOfAxisMapsOffsetAndStackGroups` в `generateCategoricalChart.tsx`.

Раньше Recharts всегда вычислял `domain` на основе данных, даже когда домен полностью задан через пропсы, и лишь затем перезаписывал его заданным значением. Теперь доступен короткий путь: если соблюдены оба условия —

- `allowDataOverflow={true}` у оси, и
- заданы **оба** начала и конца `domain` (два значения),

— создание `domain` по данным полностью пропускается, и берётся явно заданный диапазон. Логика начиная от ветки `if (dataKey)` не трогалась, поведение остаётся прежним:

```tsx
<XAxis
  type="number"
  domain={[0, 100]}
  allowDataOverflow // теперь при таком наборе данных оси считаются без лишнего прохода по data
/>
```

Это заметно ускоряет рендер больших дата-сетов, где домен осей фиксирован.

## Исправление: `domain` больше не в default props осей

**fix** ([PR #3328](https://github.com/recharts/recharts/pull/3328), fix [#2593](https://github.com/recharts/recharts/issues/2593)) — из default props всех axis-компонентов убран проп `domain`. Проблема была в том, что дефолтное значение не учитывало тип оси и в ряде случаев подставляло неподходящий домен. Теперь fallback-домен вычисляется динамически в момент создания `axis map`, когда тип оси уже известен, и выбирается корректный дефолт (например, для `number`-осей против категориальных).

Это первый шаг к тому, чтобы default `domain` не конфликтовал с оптимизацией из PR #3293: теперь дефолт считается осознанно, а не «грубой» подстановкой из props.

## Исправление: функции больше не «растекаются» по SVG-элементам

**fix** ([PR #3327](https://github.com/recharts/recharts/pull/3327), fix [#3310](https://github.com/recharts/recharts/issues/3310)). Recharts использует `filterProps`, чтобы отсеивать из переданных props всё, что не является валидным SVG-атрибутом. Проп `type` — валидный SVG-атрибут (например, для `<script>`/`<style>`), и раньше он попадал в результат, из-за чего на `<path>` проставлялся атрибут `type`.

Строки и числа DOM игнорирует молча, поэтому до поры ошибок не было. Но когда пользователи передавали `Line`/`Area` `type` как кастомную `CurveFactory` из d3 — функцию вида:

```js
const stepAround = curveCardinal.tension(0.5);
```

— браузер бросал ошибку `Invalid value for prop type on <path> tag`, потому что на SVG-элементы нельзя класть функции. Исправление тройное:

- `type` удалён из списка валидных `SVGElementAttributes` (Recharts нигде не использует теги, которым он нужен);
- в `filterProps` добавлена проверка `isFunction` для атрибутов из `SVGElementAttributes` — они никогда не должны быть функциями;
- добавлен поясняющий комментарий внутри `filterProps` и пример с `CurveFactory` в демо AreaChart.

Теперь передача кастомной кривой через `type` больше не роняет DOM при рендере.

## ResponsiveContainer: мемоизация и debounce

Два PR наводят порядок в `ResponsiveContainer`.

[PR #3169](https://github.com/recharts/recharts/pull/3169) (мемоизация) чинит проблему анимации: `cloneElement` был вынесен из вычисления размеров, что ломало анимации при ресайзе. Теперь `cloneElement` возвращён внутрь расчёта размеров.

[PR #3175](https://github.com/recharts/recharts/pull/3175) (fix [#3029](https://github.com/recharts/recharts/issues/3029)) — раньше `debounce` применялся только к внутреннему `handleResize`, но не к колбэку `ReactResizeDetector`, который хранит высоту/ширину локально и передаёт их в child. При каждом вызове размеры всё равно обновлялись, а чередование событий `ResizeObserver` порождало частую ошибку `ResizeObserver loop limit exceeded` на `window`. Теперь debounce распространяется и на внутренний колбэк детектора.

```tsx
<ResponsiveContainer debounce={200} width="100%" height="100%">
  <AreaChart data={data}>...</AreaChart>
</ResponsiveContainer>
```

## Прочие исправления

- **Treemap** ([PR #3228](https://github.com/recharts/recharts/pull/3228), fix [#2952](https://github.com/recharts/recharts/issues/2952)) — убран невалидный атрибут `z`, из-за которого рендер бросал ошибку «non boolean attribute z» (атрибут `z` трактовался как не-булевый SVG-атрибут).
- **ErrorBar** ([PR #3300](https://github.com/recharts/recharts/pull/3300), fix [#2978](https://github.com/recharts/recharts/issues/2978)) — при `allowDataOverflow` у оси `ErrorBar` и его элементы больше не вылезают за пределы области графика: их корректно клипают по области chart.
- **Bar** ([PR #3346](https://github.com/recharts/recharts/pull/3346), fix [#3344](https://github.com/recharts/recharts/issues/3344)) — если у точки данных `null`, у бара прежде подсчёт `y` и `height` возвращал `NaN`. Теперь для такого кейса подставляются корректные значения по умолчанию.

## Уточнение типов

Несколько PR сужают типы и убирают конфликты с общими SVG-атрибутами:

- **Area** ([PR #3182](https://github.com/recharts/recharts/pull/3182)) — из `SVGProps` компонента Area удалён `points`, который конфликтовал с типами; теперь проп `points` типизирован корректно.
- **Radar** ([PR #3265](https://github.com/recharts/recharts/pull/3265)) — аналогично убран `points` из `SVGProps` для правильной типизации Radar.
- **Label & LabelList** ([PR #3270](https://github.com/recharts/recharts/pull/3270)) — уточнены типы компонентов; параллельно отключён `react/no-array-index-key`, чтобы не сыпались предупреждения линтера.

## Рефакторинг

- **ReferenceArea / ReferenceLine** ([PR #3283](https://github.com/recharts/recharts/pull/3283)) — добавлены значения по умолчанию в параметрах вместо использования deprecated `defaultProps`.
- **Bar** ([PR #3349](https://github.com/recharts/recharts/pull/3349)) — выравнивание стиля кода через деструктуризацию пропсов `XAxis`.
- **Исправления опечаток** ([PR #3309](https://github.com/recharts/recharts/pull/3309)) по кодовой базе.

## Итоги

- Версия: **2.4.0** (minor), без breaking change.
- Завершена миграция тестового стека на **Jest + React Testing Library** — ключевой milestone проекта.
- Оптимизация: быстрый путь построения осей при `allowDataOverflow` + явном `domain` (PR #3293).
- Более корректный fallback-`domain`, вычисляемый по типу оси (PR #3328).
- Ключевые фиксы: функции не попадают на SVG (PR #3327), NaN в Bar при `null` (PR #3346), debounce/memo в ResponsiveContainer, клипинг ErrorBar, невалидный `z` в Treemap.

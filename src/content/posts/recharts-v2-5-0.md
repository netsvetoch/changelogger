---
author: Артём Нецветаев
pubDatetime: 2026-08-22T13:43:32.000Z
title: "Recharts 2.5.0: onResize у ResponsiveContainer, includeHidden для осей и новый интервал equidistantPreserveStart"
slug: recharts-v2-5-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 2.5.0 добавляет колбэк onResize в ResponsiveContainer, проп includeHidden для XAxis/YAxis и интервал equidistantPreserveStart, а также чинит NaN при interval={0} и возвращает работу ifOverflow."
---

Recharts 2.5.0 (minor) целиком посвящён удобству работы с осями и адаптивными контейнерами: появляются три заметные feature, несколько исправлений поведений, добавленных ранее, а также откат одного изменения из 2.4.x, которое ломало `ifOverflow`. Версия **не ломает** публичный API.

Источник — [GitHub Release `recharts/recharts@v2.5.0`](https://github.com/recharts/recharts/releases/tag/v2.5.0) и [сравнение с v2.4.3](https://github.com/recharts/recharts/compare/v2.4.3...v2.5.0). Детали ниже проверены по связанным PR.

## ResponsiveContainer: колбэк `onResize`

**feat** ([PR #3361](https://github.com/recharts/recharts/pull/3361), fix [#3326](https://github.com/recharts/recharts/issues/3326)) — `ResponsiveContainer` теперь принимает необязательный колбэк `onResize`, который вызывается при изменении размеров контейнера и уведомляет вызывающую сторону о текущих ширине и высоте.

```tsx
<ResponsiveContainer
  width="100%"
  height="100%"
  onResize={({ width, height }) => {
    console.log(`контейнер: ${width}×${height}`);
  }}
>
  <AreaChart data={data}>...</AreaChart>
</ResponsiveContainer>
```

Колбэк срабатывает только при реальном обновлении размеров и **после** debounce-задержки, то есть не «стреляет» на каждый tick `ResizeObserver`. Это API-дополнение без breaking change: раньше узнать точные размеры контейнера внутри паттерна «данные вне графика» можно было только собственными средствами.

## Оси: проп `includeHidden`

**feat** ([PR #3103](https://github.com/recharts/recharts/pull/3103), closes [#3099](https://github.com/recharts/recharts/issues/3099)) — `XAxis`/`YAxis` получили проп `includeHidden`. При `includeHidden={true}` **все** точки данных графика участвуют в расчёте домена оси, даже те, что скрыты (например, выключены переключателем серии).

```tsx
<XAxis dataKey="month" includeHidden />
```

Раньше, когда пользователь отключал одну из серий на диаграмме с переключаемыми линиями, домен осей пересчитывался только по видимым данным — оставшиеся серии «съёживались» или переставали быть сопоставимыми. Теперь можно зафиксировать домен по всему набору и сохранить визуальный масштаб при переключении данных.

## Оси: новая опция интервала `equidistantPreserveStart`

**feat** ([PR #3392](https://github.com/recharts/recharts/pull/3392), fix [#2562](https://github.com/recharts/recharts/issues/2562)) — в проп `interval` осей добавлено новое строковое значение `equidistantPreserveStart`. Оно позиционирует тики равноудалённо, начиная с **первого** тика: показывается каждый N-й тик, где N — минимальное целое, при котором видимые тики не перекрываются. Все существующие правила (минимальное расстояние между тиками и т.п.) соблюдаются.

```tsx
<XAxis dataKey="category" interval="equidistantPreserveStart" />
```

Это API-расширение без изменения существующего поведения: старые значения (`"preserveStart"`, `"preserveEnd"`, `"preserveStartEnd"`, `"equidistantPreserveEnd"`, числа и т.д.) работают как прежде.

## Исправления

### ResponsiveContainer: дефолтный `min-width: 0`

**fix** ([PR #3391](https://github.com/recharts/recharts/pull/3391), fix [#172](https://github.com/recharts/recharts/issues/172)) — дефолтное значение `minWidth` у `ResponsiveContainer` заменено с `auto` на `0`. Раньше при использовании контейнера как flex-элемента он не сжимался из-за дефолтного `min-width: auto` (известное поведение flexbox). Теперь контейнер корректно ведёт себя внутри flex-раскладок; на обычные (не-flex) раскладки изменение не влияет.

### Brush/XAxis: NaN-регрессия при `interval={0}`

**fix** ([PR #3454](https://github.com/recharts/recharts/pull/3454), fix [#3447](https://github.com/recharts/recharts/issues/3447)) — `getTicks` теперь фильтрует тики, у которых координата равна `NaN`. Ранее при `interval={0}` (показывать все тики) в позиции некоторых тиков мог попадать `NaN`, из-за чего оси рисовались с некорректными координатами. Теперь в расчёт идут только валидные тики, попадающие в текущий домен.

### ReferenceArea / ReferenceLine: возврат работы `ifOverflow`

**fix** ([PR #3455](https://github.com/recharts/recharts/pull/3455), fix [#3438](https://github.com/recharts/recharts/issues/3438)) — откат регрессии из 2.4.x. В [PR #3283](https://github.com/recharts/recharts/pull/3283) для `ReferenceArea`/`ReferenceLine` значения по умолчанию перенесли из `defaultProps` в параметры функций. Это сломало проп `ifOverflow`: компоненты обращались к значениям из `defaultProps` ещё до собственной инициализации, и проп переставал соблюдаться. Изменение откачено до устранения root cause.

### Area: недостающий тип признака `data`

**fix** ([PR #3443](https://github.com/recharts/recharts/pull/3443), fix [#2487](https://github.com/recharts/recharts/issues/2487)) — в типы компонента `Area` добавлен отсутствующий атрибут `data`. Он есть в `Line` (диаграммы с несколькими сериями), но для `Area` TypeScript раньше жаловался на его передачу через `data`-атрибут. Теперь типизация `Area` совпадает с поведением `Line`.

## Рефакторинг осей и зависимости

- **Рефакторинг** ([PR #3393](https://github.com/recharts/recharts/pull/3393)) — `getTicks` адаптирован для повышения переиспользуемости кода.
- **Рефакторинг** ([PR #3386](https://github.com/recharts/recharts/pull/3386)) — общая логика тиков вынесена из `CartesianAxis` в отдельный модуль `TicksUtils`, покрыта unit-тестами.
- **Зависимости** — обновлены `react-smooth` (minor, [PR #3397](https://github.com/recharts/recharts/pull/3397)) и `react-resize-detector` до 8.x ([PR #3418](https://github.com/recharts/recharts/pull/3418)).

## Итоги

- Версия: **2.5.0** (minor), без breaking change.
- Ключевые feature: `onResize` у `ResponsiveContainer` (PR #3361), `includeHidden` для осей (PR #3103), интервал `equidistantPreserveStart` (PR #3392).
- Ключевые фиксы: дефолтный `min-width` контейнера (PR #3391), NaN при `interval={0}` (PR #3454), возврат работы `ifOverflow` (PR #3455).
- Откачено изменение 2.4.x про `defaultProps` в `ReferenceArea`/`ReferenceLine` (регрессия `ifOverflow`).

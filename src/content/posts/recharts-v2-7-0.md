---
author: Артём Нецветаев
pubDatetime: 2026-08-22T14:15:00.000Z
title: "Recharts 2.7.0: initial-размеры ResponsiveContainer, curve-типы bumpX/bumpY и clipDot"
slug: recharts-v2-7-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 2.7.0: новый проп initialDimension для SSR-рендера ResponsiveContainer, curve-типы bump/bumpX/bumpY, проп dot clipDot, фиксы для error bars в stacked-bar и тиков XAxis под углом, а также экспорт дефолтных Tooltip/Legend и ренейм остатков классовых компонентов в функции."
---

Recharts 2.7.0 (minor) — «небольшие фичи и багфиксы» поверх прошлого выпуска. Главные точки: новый проп `initialDimension` у `ResponsiveContainer` (позволяет отрисовать график прямо при server-side-рендере, до гидрации), новые `curve`-типы `bump`/`bumpX`/`bumpY`, проп `clipDot` для клиппинга точек и генеральная зачистка остатков классовых компонентов в functional components. **Версия не ломает публичный API.**

Источник — [GitHub Release `recharts/recharts@v2.7.0`](https://github.com/recharts/recharts/releases/tag/v2.7.0) и [сравнение с v2.6.2](https://github.com/recharts/recharts/compare/v2.6.2...v2.7.0). Детали ниже проверены по связанным PR и диффам.

> ⚠️ В release приложена приписка: возможен рост числа сообщений про [предупреждение `defaultProps`](https://github.com/recharts/recharts/issues/3615) — авторство известно, решение ищут.

## Новое в API

### `ResponsiveContainer.initialDimension` — размеры до клиентского рендера

**feat** ([PR #3596](https://github.com/recharts/recharts/pull/3596), fix [#3595](https://github.com/recharts/recharts/issues/3595)) — раньше `ResponsiveContainer` стартовал с внутренними размерами `{ width: -1, height: -1 }` и не рендерил детей, пока браузер не измерит контейнер. Это мешало SSR/статической отрисовке графиков: на сервере (или при отключённом JS до гидрации) `ResponsiveContainer` отдавал `null`.

Добавлен проп `initialDimension` — объект с `width` и `height`, который задаёт стартовые размеры до измерения контейнера:

```tsx
<ResponsiveContainer initialDimension={{ width: 600, height: 300 }}>
  <LineChart data={data}>{/* ... */}</LineChart>
</ResponsiveContainer>
```

По умолчанию значение `{ width: -1, height: -1 }` (старое поведение), поэтому изменение не breaking: код без пропа работает как раньше. Обновлённая логика инициализирует `containerWidth`/`containerHeight` из `initialDimension`, а после гидрации браузер пересчитывает реальные размеры. Оба поля следует передавать вместе — если хотя бы одно останется отрицательным, контейнер будет рендерить `null` до клиентского измерения.

### Curve-типы `bump`, `bumpX`, `bumpY`

**feat** ([PR #3617](https://github.com/recharts/recharts/pull/3617), fix [#3616](https://github.com/recharts/recharts/issues/3616)) — в тип `CurveType` добавлены значения `bump`, `bumpX`, `bumpY`, которые мапятся на фабрики `curveBumpX`/`curveBumpY` из d3-shape. Ранее в **stacked area chart** утверждённые кривые перекрывались; `bump`-типы дают аккуратную «ступенчатую» интерполяцию по одной из осей:

```tsx
<AreaChart data={data}>
  <Area type="bumpX" dataKey="value" fill="#8884d8" />
</AreaChart>
```

По аналогии с `monotone`, `bump` без суффикса применяет ось в зависимости от `layout`, а явные `bumpX`/`bumpY` фиксируют направление.

### Проп `clipDot` у точек

**feat** ([PR #3602](https://github.com/recharts/recharts/pull/3602), issue [#2304](https://github.com/recharts/recharts/issues/2304)) — расширена настройка clip path: в конфигурацию точки добавлен булев проп `clipDot`, контролирующий, обрезаются ли точки по границам графика. Полезно при `allowDataOverflow: true` на осях, когда точки на краях «выезжают» за отведённую область:

```tsx
<LineChart data={data}>
  <Line type="monotone" dataKey="value" dot={{ clipDot: false, r: 4 }} />
</LineChart>
```

Проп добавлен в `DotProps` и применяется в `Line` (рендер точек по пути `url(#clipPath-${clipDot ? '' : 'dots-'}...)`), а также в логику `Area` и через демо/Storybook-примеры — в `Scatter` и `Bar`.

## Исправления

### Тики XAxis под углом больше не скрываются преждевременно

**fix** ([PR #3576](https://github.com/recharts/recharts/pull/3576), issue [#3468](https://github.com/recharts/recharts/issues/3468)) — `XAxis` принимает проп `angle`, но при расчёте видимости тиков он не учитывался: тики прятались слишком консервативно, хотя перекрытия не было. Теперь расчёт видимости учитывает угол наклона тиков, поэтому при `minTickGap` удаётся показать больше подписей без наложений.

### `className` прокидывается в `CartesianAxis`

**fix** ([PR #3592](https://github.com/recharts/recharts/pull/3592), issue [#3591](https://github.com/recharts/recharts/issues/3591)) — раньше `className`, переданный в `<XAxis>`/`<YAxis>`, не приклеивался к корневому узлу внутреннего `CartesianAxis` (className терялся в `renderAxis`). Теперь className осей дописывается к `CartesianAxis`, что позволяет дочерние элементы оси стилизовать CSS-классами (например, глобальная темингизация через Tailwind).

### Тип `PieLabel`: добавлены SVG-пропсы

**fix** ([PR #3594](https://github.com/recharts/recharts/pull/3594), issue [#3593](https://github.com/recharts/recharts/issues/3593)) — runtime уже позволял передавать произвольные SVG-пропсы в `label` пирога (они мержатся в SVG `<text>`), но TypeScript отказывался компилировать такой код: у `LabelLine` SVG-пропсы были, у `Label` — нет. В тип `PieLabel` добавлены `SVGProps`:

```tsx
<Pie data={data} dataKey="value" label={{ fill: "green" }} />
```

Теперь это валидно с точки зрения типов.

### Экспорт дефолтных Tooltip и Legend content

**feat** ([PR #3604](https://github.com/recharts/recharts/pull/3604), issue [#3288](https://github.com/recharts/recharts/issues/3288)) — из `src/index.ts` экспортируются `DefaultTooltipContent` / `DefaultLegendContent` (и их типы `DefaultTooltipContentProps` / `DefaultLegendContentProps`). Раньше, чтобы обернуть дефолтный контент тултипа или легенды в свой компонент (добавить сверху разметку), логику приходилось переписывать вручную. Теперь можно переиспользовать базовую реализацию:

```tsx
import { DefaultLegendContent } from "recharts";

const WrappedLegend = props => (
  <div>
    <DefaultLegendContent {...props} />
    <p>Дополнительная подпись</p>
  </div>
);
```

### Error bars снова работают в stacked bar

**fix** ([PR #3612](https://github.com/recharts/recharts/pull/3612), issue [#2585](https://github.com/recharts/recharts/issues/2585)) — в stacked bar chart error bars не отрисовывались из-за того, что `dataPointFormatter` неверно трактовал стек: при `stackId` значение равнялось `[number, number]`, но форматтер этого не учитывал. Типы `dataPointFormatter` уточнены под реальные сценарии, баг покрыт падающим тестом (отсутствие `x` в линиях `ErrorBar` до фикса).

### Убран `role="img"` у bar

**fix** ([PR #3614](https://github.com/recharts/recharts/pull/3614), issue [#3449](https://github.com/recharts/recharts/issues/3449)) — `role="img"` снят с bar chart: атрибут использовался с неправильной ролью без подобающего `aria-label`, что приводило к accessibility-проблемам. Роль убрана до полноценного решения доступности компонентов.

## Рефакторинг: добивка классовых компонентов

В рамках перевода библиотеки на function components отрефакторены последние классовые компоненты:

- `Dot` ([PR #3478](https://github.com/recharts/recharts/pull/3478));
- `Polygon` ([PR #3479](https://github.com/recharts/recharts/pull/3479));
- `Rectangle` ([PR #3480](https://github.com/recharts/recharts/pull/3480));
- `Sector` ([PR #3481](https://github.com/recharts/recharts/pull/3481));
- `Trapezoid` ([PR #3482](https://github.com/recharts/recharts/pull/3482));
- `Symbols` ([PR #3485](https://github.com/recharts/recharts/pull/3485));
- `DefaultTooltipContent` ([PR #3618](https://github.com/recharts/recharts/pull/3618)).

Все изменения внутренние, внешний API не меняется.

## Storybook

Обширные обновления документации в Storybook (доступно по [chromatic-ссылке](https://release--63da8268a0da9970db6992aa.chromatic.com/)): новые примеры для `clipDot`, curve-типов и прочих пропсов этого релиза.

## Итоги

- Версия: **2.7.0** (minor), без breaking change.
- Ключевые feature: `initialDimension` у `ResponsiveContainer` (SSR-рендер, PR #3596), curve `bump`/`bumpX`/`bumpY` (PR #3617), `clipDot` (PR #3602), экспорт `DefaultTooltipContent`/`DefaultLegendContent` (PR #3604).
- Ключевые фиксы: типы `PieLabel` + SVG (PR #3594), visibility тиков XAxis с `angle` (PR #3576), `className` в `CartesianAxis` (PR #3592), error bars в stacked bar (PR #3612), убран `role="img"` (PR #3614).
- Рефакторинг: `Dot`, `Polygon`, `Rectangle`, `Sector`, `Trapezoid`, `Symbols`, `DefaultTooltipContent` переведены в function components.
- Возможный рост сообщений про предупреждение `defaultProps` (#3615) — известно, решение в работе.

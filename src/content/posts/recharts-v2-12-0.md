---
author: Артём Нецветаев
pubDatetime: 2026-08-22T15:19:39.000Z
title: "Recharts 2.12.0: minPointSize как функция у Bar, screen-reader поддержка тултипа и дефолт activeBar"
slug: recharts-v2-12-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
  - accessibility
description: "Recharts 2.12.0 (minor): minPointSize у Bar теперь может быть callback-функцией, default Tooltip превращается в live region при accessibilityLayer, default activeBar снова false (откат регрессии 2.9.0), устранены ошибки не-уникальных ключей у Scatter/Pie, Throttled Tooltip больше не залипает, react-smooth обновлён до 4.x и анимации лишились браузерных префиксов, prop-types убран из peerDependencies."
---

Recharts 2.12.0 (minor) — «чистый лист» перед движением к v3. В выпуске собраны багфиксы и несколько небольших фич: `minPointSize` у `Bar` теперь можно задавать callback-функцией, а включённый `accessibilityLayer` вместе со стандартным тултипом даёт полноценную поддержку скринридеров. Отдельно команда откатила регрессию из 2.9.0 — `activeBar` снова не активен по умолчанию — и провела обновление зависимостей (включая `react-smooth` до 4.x, из-за чего у анимаций пропали браузерные префиксы).

Источник — [GitHub Release `recharts/recharts@v2.12.0`](https://github.com/recharts/recharts/releases/tag/v2.12.0) и [сравнение с v2.11](https://github.com/recharts/recharts/compare/v2.11...v2.12.0). Детали API и поведения проверены по связанным PR ([#4099](https://github.com/recharts/recharts/pull/4099), [#4077](https://github.com/recharts/recharts/pull/4077), [#4139](https://github.com/recharts/recharts/pull/4139), [#4087](https://github.com/recharts/recharts/pull/4087), [#4106](https://github.com/recharts/recharts/pull/4106), [#4100](https://github.com/recharts/recharts/pull/4100)) и их diff-ам. Релиз не ломает публичный API.

## Новое в API

### `Bar.minPointSize` — теперь можно как функцию

**feat** ([PR #4099](https://github.com/recharts/recharts/pull/4099), issue [#2819](https://github.com/recharts/recharts/issues/2819)) — раньше `minPointSize` был только числом и задавал фиксированный минимальный размер бара для всех точек. Это помогало показывать очень маленькие значения рядом с крупными, но решения «какому бару какой минимум» принять было нельзя.

Теперь тип пропа расширен до

```ts
type MinPointSize = number | ((value: number, index: number) => number);
```

Callback вызывается для каждой числовой точки (в исходнике — `minPointSizeCallback(minPointSizeProp, ...)(value[1], index)`), поэтому минимальный размер можно определять по данным:

```tsx
<Bar dataKey="value" minPointSize={value => (value === 0 ? 0 : 5)} />
```

В примере из PR нулевые значения получают `minPointSize = 0` (бар просто не показывается), а любые ненулевые — минимум `5`. Колбэк работает и со стеком, и без него. Ограничение реализации: в функцию передаются только числовые значения — если приходит не число, код бросает `invariant` с сообщением о текущем типе (`tiny-invariant`), чтобы рано выявить неверные типы.

### `accessibilityLayer` + стандартный Tooltip = live region

**feat** ([PR #4077](https://github.com/recharts/recharts/pull/4077), issue [#3555](https://github.com/recharts/recharts/issues/3555)) — `accessibilityLayer` существовал и раньше (включает управление с клавиатуры через `Tab`/стрелки и `onKeyDown`), но навигация скринридером была неполной: доступность давала только навигацию, без озвучивания меняющихся данных.

Что меняется с этим релизом:

- когда задан `accessibilityLayer`, у графика дефолтный `role` меняется с `img` на `application` (если `role` передан явно — он имеет приоритет);
- стандартный тултип (`DefaultTooltipContent`) при включённом `accessibilityLayer` получает `role="status"` и `aria-live="assertive"`, то есть становится live region. Скринридер автоматически зачитывает содержимое тултипа по мере его обновления при навигации стрелками.

Проп переносится на содержимое тултипа из родительского графика (`renderTooltip` передаёт `accessibilityLayer` в `DefaultTooltipContent`). То есть включить поддержку можно одной строкой на графике:

```tsx
<LineChart accessibilityLayer ...>
  ...
  <Tooltip /> {/* default content становится live region */}
</LineChart>
```

Следует учитывать, что `aria-live="assertive"` заставляет скринридер прерывать текущее чтение, поэтому такое поведение разумно включать точечно, где это оправдано.

## Исправления

### `Bar.activeBar` снова не активен по умолчанию

**fix** ([PR #4139](https://github.com/recharts/recharts/pull/4139), fixing issues [#4103](https://github.com/recharts/recharts/issues/4103), [#4101](https://github.com/recharts/recharts/issues/4101)) — исправляет breaking-регрессию, внесённую в 2.9.0 вместе с `activeBar` ([PR #3756](https://github.com/recharts/recharts/pull/3756)). Тогда default `activeBar` стал `true`, и если у `Bar` задан кастомный `shape` (не дефолтный `Rectangle`), при наведении (когда `Tooltip` помечает бар активным) компонент подменялся на обычный `Rectangle`. Внешний вид «прыгал» на hover.

В 2.12.0 default снова `false`:

```ts
// src/cartesian/Bar.tsx
activeBar: false, // было: true
```

Теперь активный бар отрисовывается обычной формой (тем же `shape`), а не заменяется на `Rectangle`. Для явной кастомизации активного состояния по-прежнему можно задать `activeBar` вручную, как в 2.9.0.

### `Scatter` и `Pie`: ошибки не-уникальных ключей

**fix** ([PR #4087](https://github.com/recharts/recharts/pull/4087) для `Scatter`, fixes [#4151](https://github.com/recharts/recharts/issues/4151), [#4060](https://github.com/recharts/recharts/issues/4060); [PR #4106](https://github.com/recharts/recharts/pull/4106) для `Pie`) — когда у нескольких точек/секторов совпадали значения, из которых строился React-ключ, в консоль падала ошибка «Encountered two children with the same key». В `Scatter` ключ строился как `symbol-${cx}-${cy}-${size}`, у `Pie` — как `sector-${startAngle}-${endAngle}-${midAngle}`; одинаковые данные давали дубликаты.

В обоих случаях в ключ добавлен индекс элемента:

```tsx
// Scatter
key={`symbol-${entry?.cx}-${entry?.cy}-${entry?.size}-${i}`}
// Pie
key={`sector-${entry?.startAngle}-${entry?.endAngle}-${entry.midAngle}-${i}`}
```

Ошибка из консоли уходит, а сами чипы рендерятся корректно.

### Throttled Tooltip перестаёт «залипать»

**fix** ([PR #4100](https://github.com/recharts/recharts/pull/4100), fixing [#4093](https://github.com/recharts/recharts/issues/4093)) — движение мыши обрабатывается через throttled `mousemove`: событие выполняется с задержкой. Если мышь быстро покидала график до срабатывания throttle, отложенный `mousemove` всё равно срабатывал и реактивировал тултип уже после того, как курсор ушёл. В `handleMouseLeave` теперь явно отменяется отложенный обработчик:

```ts
handleMouseLeave = (e: any) => {
  this.throttleTriggeredAfterMouseMove.cancel();
  const nextState: CategoricalChartState = { isTooltipActive: false };
  this.setState(nextState);
};
```

Тултип корректно скрывается сразу при уходе курсора, а не возвращается спустя мгновение.

## Зависимости и глубокие изменения

- **`react-smooth` `^2.0.5` → `^4.0.0`** ([diff](https://github.com/recharts/recharts/compare/v2.11...v2.12.0#diff-7ae45ad102eab3b6d7e7896acd08c427a9b25b346470d7aa650b1b4614a5b6a8)). Удалён `translateStyle`, и по **NOTE** из релиза **анимации больше не получают браузерные префиксы** (`-webkit-*`, `-moz-*`). Поддержка обычных CSS-трансформаций в современных браузерах уже повсеместная ([caniuse](https://caniuse.com/?search=transforms)), поэтому на поведении это сказываться не должно — но если вы вручную настраиваете анимации или поддерживаете старые браузеры, учтите это.
- **`prop-types` убран из `peerDependencies`**. Раньше `prop-types` требовался пользователями recharts как peer-зависимость; теперь пакет перестал требовать его явно (использование `prop-types` внутри recharts переведено на `tiny-invariant`, см. код `minPointSizeCallback`). Разработчикам не нужно держать `prop-types` ради recharts.
- **TypeScript `4.4.4` → `4.9.5`** — только devDependency, без изменений в определениях типов пакета.
- Обновлены dev-зависимости Storybook (`^7.6.3` → `^7.6.13`) и прочее; продолжилась чистка, тесты и рефакторинг от `@PavelVanecek`.

## Storybook

**Chore** — добавлен новый `Cell` story ([PR #4088](https://github.com/recharts/recharts/pull/4088), по issue [#3736](https://github.com/recharts/recharts/issues/3736)) с props из `GeneralStyle`/`EventHandlers` — первый контрибьют `@TRFielder`. Обновлена документация и прочие истории.

## Итоги

- Версия: **2.12.0** (minor), без breaking change в публичном API.
- Ключевые feature: `Bar.minPointSize` как callback (PR #4099), screen-reader поддержка через `accessibilityLayer` + default Tooltip как live region (PR #4077).
- Fix: default `activeBar: false` (откат регрессии 2.9.0, PR #4139); устранены ошибки не-уникальных ключей у `Scatter` и `Pie` (PR #4087, #4106); throttled Tooltip больше не реактивируется после ухода курсора (PR #4100).
- Зависимости: `react-smooth` до 4.x (анимации без браузерных префиксов), `prop-types` убран из `peerDependencies`, TypeScript до 4.9.5.
- Для тех, кто мигрирует на v3: по словам авторов, 2.12.0 — это «чистый лист»: v3 не будет большой или сложной в переходе мажорной версией, паритет возможностей сохранится.

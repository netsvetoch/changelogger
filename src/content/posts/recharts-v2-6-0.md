---
author: Артём Нецветаев
pubDatetime: 2026-08-22T14:05:00.000Z
title: "Recharts 2.6.0: первый a11y-слой — клавиатурная навигация для категориальных графиков"
slug: recharts-v2-6-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
  - accessibility
description: "Recharts 2.6.0 добавляет первый accessibility-слой: проп accessibilityLayer включает клавиатурную навигацию по категориальным графикам со стрелками ←/→, а также исправляет тип equidistantPreserveStart и перестаёт красть фокус у тултипа."
---

Recharts 2.6.0 (minor) — значимый релиз по двум причинам: в библиотеку впервые приходит accessibility. Добавляется проп `accessibilityLayer`, который включает полноценную клавиатурную навигацию по категориальным графикам (стрелки ←/→, тултипы и активные точки). Параллельно исправлены тип для интервала `equidistantPreserveStart`, поведение фокуса тултипа и его дефолтные `viewBox`-пропсы. Версия **не ломает** публичный API.

Источник — [GitHub Release `recharts/recharts@v2.6.0`](https://github.com/recharts/recharts/releases/tag/v2.6.0) и [сравнение с v2.5.0](https://github.com/recharts/recharts/compare/v2.5.0...v2.6.0). Детали ниже проверены по связанным PR и диффам.

## Клавиатурная навигация: проп `accessibilityLayer`

**feat** ([PR #3546](https://github.com/recharts/recharts/pull/3546)) — первый a11y-вариант использования recharts. В графики категориального типа (общая фабрика `generateCategoricalChart`) добавлены три новых пропа:

- `accessibilityLayer: boolean` — включает поддержку клавиатуры (по умолчанию `false`);
- `role: string` — ARIA-роль, по умолчанию `"img"`, при необходимости переопределяется;
- `tabIndex: number` — позиция в tab-порядке, по умолчанию `0`.

Когда слой активен, график попадает в порядок табуляции, а на SVG добавляются обработчики `focus` и `keydown`. Фокус на графике открывает тултип на первой точке; нажатия `ArrowLeft`/`ArrowRight` перемещают активную точку, а тултип «едет» по данным:

```jsx
<ResponsiveContainer width="100%" height={400}>
  <LineChart
    data={pageData}
    title="Line chart showing UV values for pages"
    accessibilityLayer
  >
    <Line type="monotone" dataKey="uv" stroke="#82ca9d" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
  </LineChart>
</ResponsiveContainer>
```

Реализация — новый класс `AccessibilityManager` (`src/chart/AccessibilityManager.ts`): он хранит активный индекс и массив координат тиков (`coordinateList`), а на нажатия стрелок вызывает `spoofMouse()` — синтезирует координаты `pageX`/`pageY` и передаёт их в существующий обработчик движения мыши (`handleMouseMove`). То есть клавиатурная навигация технически «притворяется» движениями мыши: если у графика задан и `onMouseMove`, этот колбэк тоже сработает при нажатии стрелок.

**Ограничения слоя** (проверено по коду и Storybook-документации PR):

1. Только категориальные графики — `AreaChart`, `BarChart`, `ComposedChart`, `LineChart`.
2. На графике должен присутствовать `<Tooltip />`.
3. Только горизонтальный `layout` — для `layout="vertical"` обе стрелки игнорируются (в `AccessibilityManager.keyboardEvent` нет веток под вертикальную раскладку, есть и юнит-тест «Vertical chart ignores arrow keys»).
4. Логика сбрасывает активный индекс, если данных стало меньше, и корректно переживает ре-рендер без перерисовки.

## Исправления

### Тип `AxisInterval`: `equidistantPreserveStart`

**fix** ([PR #3511](https://github.com/recharts/recharts/pull/3511)) — в 2.5.0 появился строковый интервал осей `equidistantPreserveStart` (PR #3392), но определение типа `AxisInterval` не было обновлено, и TypeScript ругался на валидное значение. Теперь тип синхронизирован.

```tsx
<XAxis dataKey="category" interval="equidistantPreserveStart" />
```

### Тултип больше не крадёт фокус

**fix** ([PR #3515](https://github.com/recharts/recharts/pull/3515), fix [#3063](https://github.com/recharts/recharts/issues/3063)) — раньше, чтобы закрывать тултип по `Escape`, компонент `Tooltip` вызывал `focus()` на своём DOM-узле при каждом показе (`this.wrapperNode.focus({ preventScroll: true })` в `updateBBox`). Это крало фокус с активного элемента страницы: показывая тултип, нельзя было продолжать редактировать ранее сфокусированное поле ввода, а модальные окна, закрывающиеся по blur, могли закрыться сами.

Теперь фокус на узле тултипа убран: при показе на `document` вешается слушатель события `keydown` (`handleKeyDown`), а при скрытии/размонтировании вызывается `document.removeEventListener`. Тултип больше не перехватывает фокус, но закрытие по `Escape` сохранено. У переключателя `<div tabIndex={-1} ...>` удалён обработчик `onKeyDown`.

### Дефолтные `viewBox`-пропсы тултипа

**fix** ([PR #3554](https://github.com/recharts/recharts/pull/3554), fix [#3548](https://github.com/recharts/recharts/issues/3548)) — в `defaultProps` тултипа попадали несуществующие ключи `x1`, `x2`, `y1`, `y2`. Тип `viewBox` на самом деле использует `x`, `y`, `width`, `height` (и `brushBottom`, `top`, `bottom`, `left`, `right`). Значения исправлены на корректные поля заданных размеров.

## Рефакторинг: перевод компонентов в function components

В рамках подготовки к будущему переводу библиотеки на хуки несколько классовых компонентов преобразованы в функциональные:

- `Curve` ([PR #3477](https://github.com/recharts/recharts/pull/3477));
- `PolarGrid` ([PR #3471](https://github.com/recharts/recharts/pull/3471));
- `Cross` ([PR #3475](https://github.com/recharts/recharts/pull/3475));
- `Tooltip` ([PR #3336](https://github.com/recharts/recharts/pull/3336));
- `Text` ([PR #3463](https://github.com/recharts/recharts/pull/3463)).

Все изменения внутренние, публичный API не меняется.

## Storybook-документация

В релизе обширные обновления Storybook (в `storybook/`):

- переход на **Storybook 7 stable**;
- добавлен accessibility-аддон и отдельная страница «Keyboard Accessibility» (`storybook/stories/API/Accessibility.mdx`) с техподробностями пользования `accessibilityLayer`;
- добавлена полноценная API-страница для `Area` с переиспользованием типов/описаний пропсов от `Line` ([PR #3465](https://github.com/recharts/recharts/pull/3465) и др.);
- роадмап — достижение уровня документации recharts.org.

## Итоги

- Версия: **2.6.0** (minor), без breaking change.
- Ключевая feature: `accessibilityLayer` + `role` + `tabIndex` для категориальных графиков — первая клавиатурная навигация в recharts (PR #3546).
- Ключевые фиксы: тип `equidistantPreserveStart` (PR #3511), отказ тултипа от кражи фокуса (PR #3515), корректные `viewBox`-пропсы (PR #3554).
- Рефакторинг: `Curve`, `PolarGrid`, `Cross`, `Tooltip`, `Text` переведены в function components; Storybook обновлён до 7.
- Стартовый вклад новых контрибьюторов: @akamfoad, @nicholasgcoles, @linhuiw, @frontier159, @ArkaFred, @julianna-langston.

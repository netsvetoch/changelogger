---
author: Артём Нецветаев
pubDatetime: 2026-08-22T15:35:36.000Z
title: "Recharts 2.13.0: совместимость с React 19, новый проп ry у CartesianGrid и чистка defaultProps"
slug: recharts-v2-13-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 2.13.0 (minor): официальная работа с React 19 на ветке 2.x (defaultProps-компоненты мигрированы в классы, react-is нужно подогнать к версии react через overrides), новый проп ry для скругления фона CartesianGrid, устранены warning-и defaultProps, починены clipDot, тултип с data на графике, defaultIndex, дубли ключей у Pie/Text и типы событий X/YAxis, в .d.ts сохраняются JSDoc-комментарии."
---

Recharts 2.13.0 (minor) сосредоточен вокруг долгожданной совместимости с React 19 на стабильной ветке `2.x`. Команда явно подчёркивает, что `peerDependencies` до релиза 3.0 обновить нельзя, поэтому для работы с React 19 беты/RC нужно через `overrides`/`resolutions` подогнать `react-is` под версию `react` и `react-dom`. Вместе с этим добавлен проп `ry` у `CartesianGrid` (скругление фона сетки) и проведена большая чистка: убраны warning-и `defaultProps` на всех затрагиваемых компонентах и исправлен ряд точечных багов.

Источник — [GitHub Release `recharts/recharts@v2.13.0`](https://github.com/recharts/recharts/releases/tag/v2.13.0) и [сравнение с v2.12.7](https://github.com/recharts/recharts/compare/v2.12.7...v2.13.0) (17 коммитов). Детали проверены по связанным PR ([#4542](https://github.com/recharts/recharts/pull/4542), [#4573](https://github.com/recharts/recharts/pull/4573), [#5103](https://github.com/recharts/recharts/pull/5103), [#4674](https://github.com/recharts/recharts/pull/4674), [#4718](https://github.com/recharts/recharts/pull/4718), [#4967](https://github.com/recharts/recharts/pull/4967), [#5054](https://github.com/recharts/recharts/pull/5054), [#4958](https://github.com/recharts/recharts/pull/4958), [#5088](https://github.com/recharts/recharts/pull/5088)) и их diff-ами. Релиз не вносит намеренных breaking change в публичный API; единственно, два фикса типов (см. ниже) формально ломают ранние (неверные) типы.

## Новое в API

### Совместимость с React 19

**feat** ([PR #4542](https://github.com/recharts/recharts/pull/4542), [PR #4573](https://github.com/recharts/recharts/pull/4573), issue [#4558](https://github.com/recharts/recharts/issues/4558)) — основная причина, почему `defaultProps` массово «починили». В React 19 `defaultProps` больше не поддерживаются на компонентах-функциях, поэтому компоненты Recharts, которые полагались на исходное поведение `defaultProps`, были переписаны с function-компонентов на класс-компоненты. Полная поддержка React 19 потребовала бы breaking-изменения (PR #4541), поэтому на `2.x` она доступна с ограничениями.

Ключевое условие из релиза: **`react-is` по версии обязан совпадать с вашими `react` и `react-dom`**, иначе элементы recharts просто не будут рендериться. Поскольку `peerDependencies` до 3.0 не поднять, соответствие настраивается через механизм `override`/`resolutions` вашего пакетного менеджера:

```jsonc
// npm
{
  "overrides": {
    "react-is": "19.0.0-rc.1", // должно совпадать с вашей версией react/react-dom
  },
}
```

```jsonc
// yarn
{
  "resolutions": {
    "react-is": "19.0.0-rc.1",
  },
}
```

Обоснование из PR #4542: варианты React 19 бета/RC с Recharts работают — команда проверяла на внутренних поверхностях Vercel (`ResponsiveContainer`, `LineChart`, `CartesianGrid`, `XAxis`/`YAxis`, `Tooltip`, `Legend`, `Line`, `PieChart`, `Pie`, `Sector`, `Cell`). До полной поддержки (без манипуляций с `react-is`) нужно дождаться Recharts 3.0.

### `CartesianGrid`: новый проп `ry`

**feat** ([PR #5103](https://github.com/recharts/recharts/pull/5103), прогресс по issue [#3062](https://github.com/recharts/recharts/issues/3062)) — фон сетки теперь можно скруглять. Раньше у `CartesianGrid` был только плоский прямоугольный `rect`; `ry` просто не пробрасывался в SVG-элемент фона. Теперь проп `ry` передаётся в `<rect>` вместе с `x`, `y`, `width`, `height`:

```tsx
<CartesianGrid
  stroke="#eee"
  strokeDasharray="3 3"
  fill="#f5f5f5"
  ry={8} // радиус скругления углов фона
/>
```

По сути это стандартный SVG-атрибут `<rect rx>`/`ry`, поэтому значение можно задавать числом (px) или строкой с единицами. Заодно в том же PR поправлен тип `AcceptedSvgProps`: он был `Omit<SVGProps<SVGElement>, 'offset'>`, а стал `Omit<SVGProps<SVGRectElement>, 'offset'>` — пропсы фона теперь типизируются точнее под `<rect>`, а не под обобщённый SVG-элемент.

### TypeScript: JSDoc-комментарии сохраняются в .d.ts

**feat** ([PR #5071](https://github.com/recharts/recharts/pull/5071)) — раньше при сборке типов JSDoc-комментарии вырезались, и разработчикам приходилось лезть в онлайн-доки за описанием пропсов. Начиная с 2.13.0 JSDoc сохраняется в определениях TypeScript, поэтому описания (например, тиков, domain-шкалы) подхватываются IDE прямо в автокомплите; эти же JSDoc-комментарии автоматически подхватывает Storybook для генерации документации.

## Исправления

### `defaultProps` на function-компонентах больше не шумит

**fix** ([PR #4542](https://github.com/recharts/recharts/pull/4542), [#4573](https://github.com/recharts/recharts/pull/4573), issue [#3615](https://github.com/recharts/recharts/issues/3615)) — в React 19 использование `defaultProps` на function-компонентах даёт предупреждение. Компоненты, полагавшиеся на исходное поведение `defaultProps`, мигрированы в класс-компоненты, что убирает warning-и со всех затрагиваемых компонентов. PR #4573 закрыл неполноту #4542: гарантировал «зелёный» тестовый прогон под React 19 и убрал все новые предупреждения.

### `ReferenceLine`: возвращена аннотация типа Props

**fix** ([PR #4610](https://github.com/recharts/recharts/pull/4610), закрывает issue [#4608](https://github.com/recharts/recharts/issues/4608)) — из-за случайно удалённой аннотации `Props` в `ReferenceLine.tsx` TypeScript отклонял документированные пропсы (например, `ifOverflow`, `label`, `stroke` из SVG-списка). Аннотация восстановлена, типы снова проходят.

### `Line`/`Area`: `clipDot` как единственный проп в `dotProps`

**fix** ([PR #4674](https://github.com/recharts/recharts/pull/4674), закрывает issue [#4671](https://github.com/recharts/recharts/issues/4671)) — когда `clipDot` был единственным свойством в объекте точки, он не применялся. То есть `dot={{ clipDot: false }}` тихо игнорировалось, и точка клипилась. Поведение починено — шаблон `dot={{ clipDot: false }}` теперь работает как ожидается.

### `Tooltip`: `data`, заданный на графическом элементе, больше не «съедает» тултип

**fix** ([PR #4718](https://github.com/recharts/recharts/pull/4718), закрывает issue [#4717](https://github.com/recharts/recharts/issues/4717)) — если `data` был установлен на графическом item, в некоторых случаях тултип не показывался. Причина — срез (`slice`) данных при индексе активной точки вне диапазона; теперь объём данных не режется, когда активный индекс выходит за пределы `dataIndex`.

### `X/YAxis`: исправлены типы событий

**fix** ([PR #4967](https://github.com/recharts/recharts/pull/4967), закрывает issue [#4959](https://github.com/recharts/recharts/issues/4959)) — обработчики событий осей теперь используют корректные «адаптированные» типы вместо заранее неверных. Формально это breaking-изменение (тип меняется), но автор позиционирует его как починку давно неправильного типа — для тех, кто подписывался на старые, ошибки типов могли не даваться до обновления.

### `Tooltip`: ошибка `defaultIndex` вне диапазона

**fix** ([PR #5054](https://github.com/recharts/recharts/pull/5054)) — когда `defaultIndex` указывал на позицию за пределами диапазона данных «на единицу», происходила ошибка; теперь index корректно проверяется.

### `Pie` и `Text`: ошибки дублирующихся ключей

**fix** ([PR #4958](https://github.com/recharts/recharts/pull/4958) для `Pie`, [PR #5088](https://github.com/recharts/recharts/pull/5088) для `Text`) — React-предупреждение «Encountered two children with the same key» при совпадающих значениях. У `Text` в ключ снова возвращён индекс элемента (`key` строился по тексту слова, который мог повторяться). У `Pie` дубликат ключей устранён аналогично — ключи секторов стали уникальными.

## Итоги

- Версия: **2.13.0** (minor), без намеренных breaking change в публичном API (два фикса типов — #4610, #4967 — формально меняют типы, но исправляют давние ошибки).
- Ключевое feature: **совместимость с React 19 на ветке 2.x** (переход на класс-компоненты из-за отсутствия `defaultProps` на функциях; обязательное соответствие `react-is` ⇔ `react`/`react-dom` через `overrides`/`resolutions` до полноценной поддержки в 3.0).
- Новый проп: **`ry` у `CartesianGrid`** для скругления фона сетки (PR #5103).
- TypeScript: JSDoc-комментарии сохраняются в `.d.ts` (лучше автокомплит в IDE и интеграция со Storybook).
- Fix: убраны warning-и `defaultProps`; починены `clipDot` (только проп в дине), тултип с `data` на графике, `defaultIndex` вне диапазона, дубли ключей у `Pie`/`Text`, типы событий `X`/`YAxis`.

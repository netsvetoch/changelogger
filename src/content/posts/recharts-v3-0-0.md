---
author: Артём Нецветаев
pubDatetime: 2026-08-22T16:23:00.000Z
title: "Recharts 3.0.0: переписанный state management, custom components, tooltip-порталы и доступность по умолчанию"
slug: recharts-v3-0-0
featured: true
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 3.0.0 (major): внутренний state управляется через Redux, удалён CategoricalChartState, Customized больше не получает внутренние props, добавлены custom components, порталы для Tooltip/Legend, accessibilityLayer по умолчанию, несколько осей в polar-графиках, Tooltip axisId и YAxis width=auto."
---

Recharts 3.0.0 — первый major за долгое время и полноценное переписывание библиотеки. Внутренний state management переписан «с нуля» (теперь это Redux-стор с селекторами), добавлено ~3500 юнит-тестов, а самые заметные внешние изменения — поддержка произвольных React-компонентов в дереве графика, порталы для `Tooltip`/`Legend`, включённая по умолчанию доступность и ряд breaking changes на стыке с закрытием внутреннего state.

Источники — [GitHub Release `recharts/recharts@v3.0.0`](https://github.com/recharts/recharts/releases/tag/v3.0.0), [официальный «3.0 migration guide»](https://github.com/recharts/recharts/wiki/3.0-migration-guide) и исходники на теге `v3.0.0` (в частности `src/hooks.ts` и `src/state/`). Это самостоятельный разбор релиза; гайд по ссылке — для полного списка breaking changes.

## Что внутри: новый минимум версий и зависимости

Требования к окружению выросли — библиотека теперь рассчитывает на современный движок:

- **React 16.8+** (то есть Haskell-хуки), ранее поддерживались и более старые;
- **TypeScript 5.x+**;
- **Node.js v18+**;
- нужно обновить TS `target` до **es6** — это убирает es5-полифиллы и фактически отбрасывает поддержку браузеров без es6-modules;
- из зависимостей удалены `recharts-scale` и `react-smooth`: работа со шкалами и анимации теперь поддерживаются внутри самого recharts.

Если вы использовали `getNiceTickValues` из пакета `recharts-scale` — в 3.0 эта утилита экспортируется напрямую из основного пакета `recharts`.

## Breaking changes

### Больше нет `CategoricalChartState`

`CategoricalChartState` — это был доступ к внутреннему state recharts, который протаскивался в обработчики событий и в `Customized`. В 3.0 такого state больше нет, потому что он разбит на отдельные «слайсы» в Redux-сторе.

Вместо него для чтения внутреннего состояния появляются хуки. На текущий момент подтверждённо в исходниках (`src/hooks.ts`) доступен `useActiveTooltipLabel()`, возвращающий активную подпись тултипа как `string | undefined` (или `undefined`, если нет активного взаимодействия):

```ts
import { useActiveTooltipLabel } from 'recharts';

function MyComponent() {
  const label = useActiveTooltipLabel();
  return <span>Active: {label}</span>;
}
```

В гайде авторы просят сообщать, какие ещё части state нужны, — по одной заявке добавляют новые хуки.

### `<Customized />` больше не получает внутренние props

Раньше всё, что рендерилось внутри `<Customized component={...} />`, получало два дополнительных пропса с полным внутренним state. Теперь компонент рендерит children как есть, без инъекции state. Хотя `<Customized />` остался в экспортах как полностью опциональная обёртка, его роль фактически поглощается новой фичей custom components (ниже).

### Удалены «пропсы, которые всегда были внутренними»

В 2.x recharts прокидывал внутренний state через спец-пропсы, которые формально числились публичными, но на деле ничего не делали. В 3.0 они удалены. Примеры: `points` у `Scatter` и `Area`, `payload` у `Legend`, а также `activeIndex`.

`activeIndex` ранее использовался для программного управления активным элементом. Авторы советуют достигать того же через `Tooltip`; примеры собраны в гайде [«activeIndex»](https://recharts.github.io/en-US/guide/activeIndex).

### Аккуратные мелочи при миграции

По тексту [гайда](https://github.com/recharts/recharts/wiki/3.0-migration-guide) полезно проверить следующие изменения:

- удалён `ref.current.current` у `ResponsiveContainer`;
- у Reference-компонентов удалён deprecated-проп `alwaysShow`, а у reference-элементов — `isFront` (не работал ещё с до-2.x);
- `ErrorBar`: при nullish значениях Y-domain теперь считается корректно (issue [#4192](https://github.com/recharts/recharts/issues/4192));
- порядок элементов `Legend` больше не гарантируется;
- z-order элементов (`Tooltip`, `Legend`, серий) теперь определяется порядком рендера, раз в SVG нет понятия z-index: если что-то перекрывается — перенесите приоритетный элемент ниже в JSX (например, `Tooltip` всегда ниже `Legend`). Раньше recharts «взламывал» порядок рендера, из-за чего, среди прочего, невозможно было вставлять свои элементы;
- линии осей `XAxis`/`YAxis` теперь рисуются даже без тиков;
- `Area` с `connectNulls` теперь трактует `null`-датапоинты как `0`;
- у `Pie` удалён `blendStroke` — используйте `stroke="none"`;
- удалены неиспользуемые пропсы `animateNewValues` у `Area` и `Funnel`;
- типы стали строже: `Sankey` и `Funnel` (последний — в части типов);
- `Tooltip`'s `content`: тип пропса переименован из `TooltipProps` в `TooltipContentProps`, а `label` в нём теперь `undefined | string | number`.
- `accessibilityLayer` больше не вызывает `onMouseMove` после клавиатурного ввода.

### `CartesianGrid` и несколько осей Y

`CartesianGrid` получил новые пропсы `xAxisId`/`yAxisId`, соответствующие `xAxisId`/`yAxisId` на `XAxis`/`YAxis`. Если у вас несколько осей и ID не дефолтные, линии сетки привязаны к конкретной оси — иначе раньше сетка «выбирала первую попавшуюся». Это делает рендер детерминированным (issue [#6149](https://github.com/recharts/recharts/issues/6149)).

Плюс поведение нескольких `YAxis`: порядок их отображения теперь не соответствует порядку рендера в JSX, а сортируется по алфавиту `yAxisId`.

## Новые фичи

### Custom components (ранее только через `Customized`)

Главная фича 3.0 — можно рендерить произвольные React-компоненты прямо в дереве recharts (главное — чтобы они были отрисуемы внутри SVG). То, что в 2.x не работало, начинает работать:

```tsx
const MyCustomAxes = () => (
  <>
    <XAxis dataKey="name" />
    <YAxis tickCount={7} />
  </>
);

<BarChart width={1100} height={250} data={data}>
  <Bar dataKey="uv" />
  <MyCustomAxes />
</BarChart>;
```

Следствие — `<Customized />` больше не обязателен, обёртка осталась «на всякий случай»: вариант с `<Customized component={MyCustomComponent} />` и вариант просто `<MyCustomComponent />` теперь идентичны.

Нюанс: `Label` можно заворачивать в custom component, только если у компонента выставлен `displayName = 'Label'`, иначе обнаружить его внутри обёртки recharts не сможет.

### Tooltip-порталы (и Legend)

`Tooltip` получил проп `portal`, позволяющий рендерить содержимое тултипа в любом месте страницы — в том числе полностью за пределами графика (issue [#2458](https://github.com/recharts/recharts/issues/2458)). Например:

```tsx
const TooltipWithPortal = () => {
  const [portalRef, setPortalRef] = useState<HTMLElement | null>(null);

  return (
    <>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={pageData}>
          <Line dataKey="uv" fill="green" />
          <Line dataKey="pv" fill="red" />
          {portalRef && (
            <Tooltip
              portal={portalRef}
              wrapperStyle={{ width: "25%", marginLeft: 10 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {/* Здесь будет отрендерен Tooltip */}
      <div
        ref={node => {
          if (portalRef == null && node != null) setPortalRef(node);
        }}
      />
    </>
  );
};
```

Вы полностью контролируете контейнер, в который попадает тултип, а размеры и отступы настраиваются через `wrapperStyle`. По той же схеме — порталы для `Legend`.

### Доступность по умолчанию

Одно из самых «заметных» изменений: проп `accessibilityLayer`, который включает a11y-атрибуты и управление с клавиатуры, в 2.x был выключен по умолчанию, а в 3.0 включён **на всех polar- и cartesian-графиках**. Табуляция внутрь графика + стрелки — навигация. Выключить обратно можно явно: `accessibilityLayer={false}`. Клавиатурные события при этом не пробрасываются в `onMouseMove`.

### Несколько осей в polar-графиках

Раньше несколько осей поддерживали только cartesian-графики. Теперь то же доступно и в polar-графиках (issue [#2605](https://github.com/recharts/recharts/issues/2605)).

### `Tooltip.axisId` и несколько осей

В графе с несколькими осями тултип всегда следовал за «первой» осью, причём выбор был довольно произвольным. Появился новый проп `axisId` для явного выбора оси, за которой следует тултип:

```tsx
<Tooltip axisId="uv-axis" />
```

Для единственной `XAxis` + `YAxis` поведение не меняется.

### `YAxis width="auto"`

Автоматическая ширина Y-оси: `<YAxis width="auto" />` сам вычисляет ширину — вместо ручного увеличения `margin` и собственных расчётов.

### Шкала `symlog`

Для `XAxis`/`YAxis` добавлен тип шкалы d3 `symlog` — симметрично-логарифмическая, полезная для данных, пересекающих ноль с широким диапазоном значений:

```tsx
<YAxis scale="symlog" />
```

## Прочее

В релизе также: улучшения анимаций, типов и доступности; `Pie` больше не рисует границу вокруг секторов по клику; `CartesianGrid` — фон теперь рендерится под линиями сетки, а не над ними; тултип в scatter-графике по умолчанию добавляет цвета. Много примеров обновлено в [storybook 3.0](https://63da8268a0da9970db6992aa-zwbccjhbxb.chromatic.com/).

## Итоги

- Версия: **3.0.0** (major), релиз от 23.06.2025.
- State management переписан на **Redux**-стор + селекторы; добавлено ~3500 тестов.
- Breaking changes: удалён `CategoricalChartState`; `Customized` без инъекции внутренних props; убраны «внутренние» пропсы (`Scatter/Area.points`, `Legend.payload`, `activeIndex`); новый минимум React 16.8+/TS 5+/Node 18+/es6-target; `TooltipProps` → `TooltipContentProps`; `CartesianGrid.xAxisId/yAxisId`; сортировка Y-осей по `yAxisId`.
- Новое: custom components; `Tooltip/ Legend`-порталы (`portal`); `accessibilityLayer` по умолчанию; несколько осей в polar-графиках; `Tooltip.axisId`; `YAxis width="auto"`; шкала `symlog`; hook `useActiveTooltipLabel`.
- Установка:

```bash
npm install recharts@3.0.0
```

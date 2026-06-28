---
author: Артём Нецветаев
pubDatetime: 2026-06-28T18:30:00.000Z
title: "HeroUI React 3.2.0: Calendar, Virtualizer для Autocomplete и новая композиция toggles"
slug: heroui-react-v3-2-0
featured: false
draft: false
tags:
  - release
  - heroui
  - react
description: "Разбор минорного релиза @heroui/react v3.2.0: React Aria 1.18.0, новые режимы Calendar, Table.SortableColumnHeader, Virtualizer в Autocomplete, CSS-переменные Tooltip и breaking change в Radio/Checkbox/Switch."
---

HeroUI выпустил минорный релиз [`@heroui/react` v3.2.0](https://github.com/heroui-inc/heroui/releases/tag/v3.2.0). Версия опубликована 16 июня 2026 года и выглядит как крупное обновление для приложений на React Aria: библиотека подтянула `react-aria-components` до `1.18.0`, расширила Calendar, добавила готовый заголовок для сортируемых колонок Table и официально задокументировала виртуализацию в Autocomplete.

Но обновление не полностью «просто минорное»: для `Radio`, `Checkbox` и `Switch` есть breaking change в разметке. Если в проекте есть кастомные формы на этих компонентах, миграцию лучше запланировать отдельно.

Источник для обзора — GitHub Release [`heroui-inc/heroui@v3.2.0`](https://github.com/heroui-inc/heroui/releases/tag/v3.2.0), PR'ы из release body и финальный релизный PR [`#6616`](https://github.com/heroui-inc/heroui/pull/6616).

## Что изменилось в Calendar

Самая заметная функциональная часть релиза — Calendar. В [`#6611`](https://github.com/heroui-inc/heroui/pull/6611) документация и демо показывают сразу несколько новых режимов:

- `visibleDuration={{ weeks: n }}` — недельный вид на одну или несколько недель;
- `visibleDuration={{ days: n }}` — дневной вид на несколько последовательных дней;
- `selectionMode="multiple"` — выбор нескольких дат, где `value`, `defaultValue` и `onChange` работают с массивом дат;
- `weeksInMonth={6}` — фиксированная высота календарной сетки, чтобы месяцы не «прыгали» при навигации;
- `Calendar.Heading offset={{ months: 1 }}` — корректный заголовок для второго и следующих месяцев в multi-month layout.

Пример multi-select теперь выглядит так:

```tsx
import type { DateValue } from "@internationalized/date";

import { Calendar, Description } from "@heroui/react";
import { useState } from "react";

export function EventDates() {
  const [value, setValue] = useState<readonly DateValue[]>([]);

  return (
    <Calendar
      aria-label="Event dates"
      selectionMode="multiple"
      value={value}
      onChange={setValue}
    >
      <Calendar.Header>
        <Calendar.Heading />
        <Calendar.NavButton slot="previous" />
        <Calendar.NavButton slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>
          {day => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
        </Calendar.GridHeader>
        <Calendar.GridBody>
          {date => <Calendar.Cell date={date} />}
        </Calendar.GridBody>
      </Calendar.Grid>
      <Description>{value.length} date(s) selected</Description>
    </Calendar>
  );
}
```

Для недельного или дневного окна используется тот же компонент, но меняется `visibleDuration`:

```tsx
<Calendar aria-label="Week view" visibleDuration={{weeks: 2}} pageBehavior="single">
  {/* Header + Grid */}
</Calendar>

<Calendar aria-label="Day view" visibleDuration={{days: 5}} pageBehavior="single">
  {/* Header + Grid */}
</Calendar>
```

Практический эффект: Calendar теперь покрывает не только классический date picker, но и сценарии вроде расписаний, бронирования, выбора нескольких дат события и интерфейсов с фиксированной высотой календаря.

## Table получил `Table.SortableColumnHeader`

В [`#6588`](https://github.com/heroui-inc/heroui/pull/6588) внутренний пример сортируемого заголовка вынесли в публичный API. Новый компонент экспортируется как `Table.SortableColumnHeader`, а вместе с ним появились типы `Table.SortableColumnHeaderProps` и `TableSortDirection`.

Подтверждённые props из diff'а:

- `sortDirection?: "ascending" | "descending"` — значение нужно брать из render-prop callback у `Table.Column`;
- `showIndicator?: boolean` — по умолчанию `true`, управляет показом индикатора;
- `indicator?: ReactNode` — кастомная иконка вместо стандартного chevron;
- `children`, `className` и остальные props для `span`.

Минимальный пример:

```tsx
import { Table } from "@heroui/react";

<Table.Column allowsSorting id="name">
  {({ sortDirection }) => (
    <Table.SortableColumnHeader sortDirection={sortDirection}>
      Name
    </Table.SortableColumnHeader>
  )}
</Table.Column>;
```

В стилях добавлены слоты `.table__sortable-column-header` и `.table__sortable-column-indicator`; дефолтный индикатор получает `data-direction`, а для `descending` поворачивается на `180deg`. То есть больше не нужно копировать локальный `SortableColumnHeader` из demo-кода в каждую таблицу.

## Autocomplete официально поддерживает Virtualizer

В релизе есть пункт «Autocomplete → Virtualizer». Конкретика находится в [`#6642`](https://github.com/heroui-inc/heroui/pull/6642): в документацию добавлен раздел `Virtualization`, а демо рендерит список из 1000 пользователей через `Virtualizer`, `ListLayout` и `ListBox`.

Скелет подтверждённого примера:

```tsx
import {
  Autocomplete,
  EmptyState,
  Label,
  ListBox,
  ListLayout,
  SearchField,
  Virtualizer,
  useFilter,
} from "@heroui/react";

<Autocomplete allowsEmptyCollection selectionMode="single">
  <Label>User</Label>
  <Autocomplete.Trigger>
    <Autocomplete.Value />
    <Autocomplete.ClearButton />
    <Autocomplete.Indicator />
  </Autocomplete.Trigger>
  <Autocomplete.Popover>
    <Autocomplete.Filter
      inputValue={searchQuery}
      onInputChange={setSearchQuery}
    >
      <SearchField autoFocus name="search" variant="secondary">
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Search users..." />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <Virtualizer layout={ListLayout} layoutOptions={{ rowHeight: 50 }}>
        <ListBox
          items={filteredUsers}
          renderEmptyState={() => <EmptyState>No results found</EmptyState>}
        >
          {user => <ListBox.Item id={user.id}>{user.name}</ListBox.Item>}
        </ListBox>
      </Virtualizer>
    </Autocomplete.Filter>
  </Autocomplete.Popover>
</Autocomplete>;
```

В том же PR поправлены стили overlay: `.autocomplete__popover` теперь фиксируется по ширине trigger'а (`w-(--trigger-width)` и `max-w-(--trigger-width)`) и получает `overflow-hidden`, а прокрутка переносится на `[data-slot="list-box"]` с `max-h-[320px]`. Это важно именно для виртуализации: большой `ListBox` больше не раздувает popover, а скролл остаётся внутри списка.

## Tooltip: задержки можно задавать через тему

В [`#6617`](https://github.com/heroui-inc/heroui/pull/6617) Tooltip получил глобальные CSS-переменные для задержек:

```css
:root {
  --tooltip-delay: 1500ms;
  --tooltip-close-delay: 500ms;
}

.dark,
[data-theme="dark"] {
  --tooltip-close-delay: 300ms;
}
```

В коде `TooltipRoot` читает `--tooltip-delay` и `--tooltip-close-delay` через `useCSSVariable`, парсит значения функцией `parseCSSTime()` и передаёт результат в `TooltipTriggerPrimitive` как `delay` и `closeDelay`. `parseCSSTime()` поддерживает как `ms`, так и `s`: например, `0.5s` превращается в `500`.

Локальные props всё ещё имеют приоритет:

```tsx
<Tooltip delay={300} closeDelay={100}>
  {/* trigger + content */}
</Tooltip>
```

То есть дизайн-система может задать дефолтные задержки на уровне темы, а отдельные подсказки — переопределять их точечно.

## Breaking change: `Radio`, `Checkbox` и `Switch` перешли на явную композицию поля

Главная миграция релиза — [`#6614`](https://github.com/heroui-inc/heroui/pull/6614). `Radio`, `Checkbox` и `Switch` переведены с legacy single primitives React Aria на композицию `*Field` + `*Button`. В пользовательском JSX это проявляется так:

- `*.Control` теперь должен находиться внутри `*.Content`;
- текст label пишется обычным текстом внутри `*.Content`, без вложенного `<Label>`;
- `Description` и `FieldError` становятся sibling-элементами рядом с `*.Content`;
- root render prop теперь field-level: например, для Switch это `SwitchFieldRenderProps`;
- button-level состояния вроде hover/press/focus-visible относятся к `*.Content`/`*.Control`, а не к корню.

До:

```tsx
import { Label, Switch } from "@heroui/react";

<Switch>
  <Switch.Control>
    <Switch.Thumb />
  </Switch.Control>
  <Label>Enable notifications</Label>
</Switch>;
```

После:

```tsx
import { Description, FieldError, Switch } from "@heroui/react";

<Switch isRequired name="notifications">
  <Switch.Content>
    <Switch.Control>
      <Switch.Thumb />
    </Switch.Control>
    Enable notifications
  </Switch.Content>
  <Description>Used for product updates.</Description>
  <FieldError />
</Switch>;
```

Для `Switch` в документации также появились field-level props `isInvalid`, `isReadOnly`, `isRequired`, `validate` и `validationBehavior`. В `index.ts` оставлен deprecated alias `SwitchRenderProps` на `SwitchFieldRenderProps`, но новый код лучше сразу писать на новых именах.

## React Aria 1.18.0 и связанные зависимости

В [`#6586`](https://github.com/heroui-inc/heroui/pull/6586) пакет `packages/react/package.json` обновлён на React Aria 1.18.0 и соседние версии:

- `react-aria-components`: `1.17.0` → `1.18.0`;
- `@react-aria/ssr`: `3.10.0` → `3.10.1`;
- `@react-aria/i18n`: `3.13.0` → `3.13.1`;
- `@react-aria/utils`: `3.34.0` → `3.34.1`;
- `@react-types/shared`: `3.34.0` → `3.35.0`;
- `@react-stately/utils`: `3.12.0` → `3.12.1`;
- dev dependency `@internationalized/date`: `3.12.1` → `3.12.2`.

Это объясняет часть API-движения вокруг Calendar и field/button composition: HeroUI подтягивает новые primitives и постепенно делает свои компоненты ближе к текущей модели React Aria.

## Полезные исправления

Помимо крупных изменений, в `v3.2.0` вошло несколько точечных фиксов, которые стоит проверить после обновления:

- [`#6596`](https://github.com/heroui-inc/heroui/pull/6596): `Fieldset disabled` теперь прокидывает `isDisabled` через React Aria contexts для `Button`, `CheckboxGroup`, `Link`, `RadioGroup`, `Slider`, `ToggleButton` и `ToggleButtonGroup`. Это закрывает случай, когда browser-level `fieldset disabled` уже блокирует элемент, но render prop `{isDisabled}` всё ещё возвращал `false`.
- [`#6511`](https://github.com/heroui-inc/heroui/pull/6511): `toast.promise()` больше не запускает success/error toast в конфликте с предыдущим View Transition. В `ToastQueue` добавлена цепочка `transitionChain`, которая сериализует `document.startViewTransition()` и гасит skipped rejection.
- [`#6582`](https://github.com/heroui-inc/heroui/pull/6582): `Select` и `Autocomplete` сохраняют variant background при `isInvalid`; CSS теперь возвращает `background-color: var(--select-trigger-bg-focus)` и `var(--autocomplete-trigger-bg-focus)` для invalid state.
- [`#6627`](https://github.com/heroui-inc/heroui/pull/6627): содержимое `Autocomplete.Popover` обёрнуто в React Aria `Dialog`, чтобы поправить focus management.
- [`#6628`](https://github.com/heroui-inc/heroui/pull/6628): `Tooltip.Trigger` перешёл с wrapper-компонента `<Focusable>` на `useFocusable()`, чтобы не получать ложный warning, когда tooltip монтируется внутри inert subtree, например за открытым Drawer или Modal.
- [`#6606`](https://github.com/heroui-inc/heroui/pull/6606): в Table для RTL заменены физические позиционные классы на логические (`end-0`), чтобы separator и resizer оказывались с правильной стороны колонки.
- [`#6624`](https://github.com/heroui-inc/heroui/pull/6624): исправлены secondary header borders в virtualized Table, где React Aria рендерит table-элементы как `div`.
- [`#6644`](https://github.com/heroui-inc/heroui/pull/6644): `Spinner` снова анимируется в обычных block-контейнерах, не только внутри flex-layout.

## Как обновиться

```bash
pnpm add @heroui/react@3.2.0
```

Или через npm:

```bash
npm install @heroui/react@3.2.0
```

После установки стоит отдельно проверить:

1. Все места с `Radio`, `Checkbox`, `Switch`, `RadioGroup`, `CheckboxGroup` и `SwitchGroup` — там может понадобиться новая структура `*.Content`.
2. Формы с `Description` и `FieldError`: теперь они должны быть соседями `*.Content`, а не вложенными элементами label-контента.
3. Сортируемые таблицы: локальные реализации sort indicator можно заменить на `Table.SortableColumnHeader`.
4. Autocomplete с большими списками: если раньше были проблемы с высотой popover или производительностью, теперь есть подтверждённый путь через `Virtualizer`.
5. Tooltip: если в продукте есть единые UX-требования к задержкам, перенесите дефолты в `--tooltip-delay` и `--tooltip-close-delay`.

## Ссылки

- [Release v3.2.0](https://github.com/heroui-inc/heroui/releases/tag/v3.2.0)
- [Full release note](https://heroui.com/docs/react/releases/v3-2-0)
- [Compare v3.1.0...v3.2.0](https://github.com/heroui-inc/heroui/compare/v3.1.0...v3.2.0)
- [React Aria upgrade PR #6586](https://github.com/heroui-inc/heroui/pull/6586)
- [Calendar PR #6611](https://github.com/heroui-inc/heroui/pull/6611)
- [Toggles migration PR #6614](https://github.com/heroui-inc/heroui/pull/6614)

---
author: Артём Нецветаев
pubDatetime: 2026-06-28T20:09:30.000Z
title: "@skbkontur/react-ui 5.0.0: полиморфные Button/Link, новый MaskedInput и чистка deprecated API"
slug: skbkontur-react-ui-5-0-0
featured: true
draft: false
tags:
  - release
  - react-ui
  - skbkontur
description: "Разбор major-релиза @skbkontur/react-ui 5.0.0: component prop в Button и Link, вторая ревизия MaskedInput, миграция Popup, удаление deprecated API, новые имена тем и breaking change в Calendar.scrollToMonth()."
---

`@skbkontur/react-ui` выпустил major-релиз [`5.0.0`](https://github.com/skbkontur/retail-ui/releases/tag/%40skbkontur/react-ui%405.0.0). Это не косметическое обновление: релиз одновременно добавляет новые сценарии для базовых компонентов, переписывает `MaskedInput`, убирает часть устаревших API и меняет правила работы с темами.

Источник для обзора — GitHub Release [`@skbkontur/react-ui@5.0.0`](https://github.com/skbkontur/retail-ui/releases/tag/%40skbkontur/react-ui%405.0.0), compare [`@skbkontur/react-ui@4.27.0...@skbkontur/react-ui@5.0.0`](https://github.com/skbkontur/retail-ui/compare/@skbkontur/react-ui@4.27.0...@skbkontur/react-ui@5.0.0) и PR'ы из changelog.

## Коротко о главном

В `5.0.0` стоит проверить четыре зоны миграции:

- `Calendar.scrollToMonth(month, year)` теперь принимает человекочитаемый номер месяца: январь — `1`, а не `0`.
- `Button` и `Link` получили полиморфный prop `component`, но у `Link` изменилось поведение клика по пустому `href`: из обработчика убрали `preventDefault`.
- Удалены deprecated API: `Picker`, `ScrollContainer.hideScrollBar`, `Toggle.color`, `Paging.shouldBeVisibleWithLessThanTwoPages`, старые size-типы и часть старых theme tokens.
- Темы переименованы: актуальные светлая и тёмная темы теперь экспортируются как `LIGHT_THEME` и `DARK_THEME`, а слепки без будущих визуальных обновлений — как `LIGHT_THEME_2022_0` и `DARK_THEME_2022_0`.

## Button и Link стали полиморфными

Самое прикладное API-изменение — PR [`#3521`](https://github.com/skbkontur/retail-ui/pull/3521). В `Button` и `Link` добавлен prop `component`, который принимает `'a'`, `'button'` или `React.ElementType`.

Зачем это нужно:

- `Button` теперь можно отрендерить как ссылку и передать нативные `href`, `rel`, `target`;
- `Button` и `Link` можно связать с роутером, например с `NavLink` из `react-router-dom`;
- `Link` можно отрендерить как нативную кнопку, если визуально нужна ссылка, а семантически — action.

Подтверждённые примеры из PR:

```tsx
import { NavLink } from "react-router-dom";
import { Button, Link } from "@skbkontur/react-ui";

<Button component="a" href="https://kontur.ru" target="_blank" rel="noreferrer">
  Открыть сайт
</Button>;

<Button component={NavLink} to="/settings">
  Настройки
</Button>;

<Link component="button" type="submit">
  Сохранить
</Link>;

<Link component={NavLink} to="/danger-zone" use="danger">
  Опасная зона
</Link>;
```

У изменения есть миграционный нюанс: в PR отдельно указано, что у `Link` убран `preventDefault` при клике по ссылке с пустым `href`. Раньше это компенсировало старую реализацию ссылочного компонента, теперь стили работают и для неактивной ссылки, и для кастомного компонента. Если в проекте были места, где пустой `href` использовался как «не переходить никуда», их лучше заменить на явный `component="button"` или собственный обработчик.

## MaskedInput: вторая ревизия вместо наложенных span'ов

PR [`#3390`](https://github.com/skbkontur/retail-ui/pull/3390) переписывает `MaskedInput`. В первой реализации символы маски визуально рисовались отдельными span-элементами поверх нативного input. Во второй ревизии принцип другой: если символы маски видны, они физически находятся в `value` input'а; если не видны — их там нет. Введённая пользователем часть дополнительно доступна через атрибут `data-typed-value`.

Внутри реализация разделена на три слоя:

- `MaskedInput` — публичная точка входа, совместимая по поведению с обычным `Input`;
- `FixedIMaskInput` — адаптер вокруг `imask`/`react-imask`, который исправляет проблемные сценарии работы с кареткой и вводом;
- `ColorableInputElement` — слой, который красит введённую и ещё не введённую части маски через CSS `background-clip: text`, `-webkit-text-fill-color` и измерение заполненной части в shadow DOM.

Пример использования остался привычным:

```tsx
import { MaskedInput } from "@skbkontur/react-ui";

const [phone, setPhone] = React.useState("");

<MaskedInput
  mask="+7 (999) 999-99-99"
  placeholder="Номер телефона"
  value={phone}
  onValueChange={setPhone}
/>;
```

Для символа маски подтверждены два важных случая: `maskChar` по умолчанию остаётся `_`, а `maskChar={null}` превращается в пустую строку через helper `getMaskChar()`.

```tsx
<MaskedInput mask="9999 9999 9999 9999" maskChar="X" />
<MaskedInput mask="9999 9999 9999 9999" maskChar={null} />
```

В PR также зафиксированы ограничения новой реализации. Например, при очень длинном значении и горизонтальном скролле подсветка маски может ломаться из-за поведения `background-clip: text`, а сценарий uncontrolled `defaultValue` с фиксированной частью маски остаётся проблемным при динамическом показе маски по фокусу.

## Popup вместо DropdownContainer

Большой внутренний рефакторинг пришёл через [`#3451`](https://github.com/skbkontur/retail-ui/pull/3451): `Autocomplete`, `DatePicker`, `Select` и `CustomComboBox` переведены с устаревшего `DropdownContainer` на `Popup`, а сам `DropdownContainer` удалён из внутренних модулей.

В том же изменении `DateSelect` отрефакторен и переведён на `Select`, а в код добавлен helper `getMenuPositions` с тестами. Для пользователей это важно не как новая ручка API, а как изменение поведения всплывающих списков: теперь несколько компонентов используют единый popup-слой и более согласованные тени/позиционирование.

Если у вас были визуальные regression-тесты на `Select`, `DatePicker`, `ComboBox` или `Autocomplete`, после перехода на `5.0.0` их стоит прогнать отдельно: PR прямо отмечает, что внешний вид выпадающего списка `DateSelect` изменился.

## Deprecated API действительно удалили

В major-релиз вошла ожидаемая чистка deprecated сущностей из [`#3522`](https://github.com/skbkontur/retail-ui/pull/3522) и [`#3523`](https://github.com/skbkontur/retail-ui/pull/3523).

Удалён компонент `Picker` из `DatePicker/Picker.tsx`. Вместо него авторы ещё в коде deprecated warning рекомендовали использовать публичный `Calendar`. Одновременно в стилях `DatePicker` переменная `pickerBg` заменена на `calendarBg`, а `pickerBorderRadius` — на новый `calendarBorderRadius`.

```diff
- background: ${t.pickerBg};
- border-radius: ${t.pickerBorderRadius};
+ background: ${t.calendarBg};
+ border-radius: ${t.calendarBorderRadius};
```

Из публичных props и типов удалены:

- `ScrollContainer.hideScrollBar` — теперь нужно пользоваться `showScrollBar`; логика показа при скролле завязана на `showScrollBar === "scroll"`;
- `Toggle.color` — цвет нужно задавать через theme token `toggleBgChecked`;
- `Paging.shouldBeVisibleWithLessThanTwoPages` — `Paging` теперь не рендерится при `pagesCount < 2` без отдельного флага;
- старые alias-типы размеров вроде `ButtonSize`, `InputSize`, `CheckboxSize`, `RadioSize`, `ToggleSize`, `TextareaSize`, `MenuItemSize`, `TabSize` — вместо них используется общий `SizeProp`.

Для `Paging` миграция особенно заметна:

```tsx
// Было: можно было оставить компонент видимым даже при одной странице.
<Paging
  pagesCount={1}
  activePage={1}
  onPageChange={setPage}
  shouldBeVisibleWithLessThanTwoPages
/>;

// Стало: при pagesCount < 2 компонент возвращает null.
<Paging pagesCount={1} activePage={1} onPageChange={setPage} />;
```

Если в интерфейсе нужно показывать контейнер пагинации даже для одной страницы, теперь это придётся делать на уровне собственного layout'а, а не через prop `Paging`.

## Feature flags: меньше переключателей, но один вернулся для ComboBox

PR [`#3434`](https://github.com/skbkontur/retail-ui/pull/3434) удаляет feature flags и делает поведение из флагов поведением по умолчанию. Исключение из описания PR — `validationsRemoveExtraSpans`: решение под этим флагом признали проблемным и не сделали дефолтом.

Позже в релиз вошёл fix [`#3529`](https://github.com/skbkontur/retail-ui/pull/3529), который возвращает `comboBoxAllowValueChangeInEditingState`. Причина практичная: после удаления флага появились баги в `ComboBox` и ФИАС-сценариях, поэтому поведение снова спрятали за opt-in.

Флаг описан в `ReactUIFeatureFlagsContext`:

```tsx
import {
  Button,
  ComboBox,
  ReactUIFeatureFlagsContext,
} from "@skbkontur/react-ui";

<ReactUIFeatureFlagsContext.Provider
  value={{ comboBoxAllowValueChangeInEditingState: true }}
>
  <ComboBox
    value={value}
    searchOnFocus={false}
    getItems={getItems}
    onValueChange={setValue}
    onInputValueChange={label => setValue({ value: label, label })}
  />
</ReactUIFeatureFlagsContext.Provider>;
```

Подтверждённое поведение из тестов: при включённом флаге `ComboBox` может принять изменение `value` во время редактирования; если меню открыто, данные в нём обновляются без принудительного закрытия.

## Темы: LIGHT_THEME, DARK_THEME и строгий ThemeFactory

В теме сразу несколько breaking/migration-изменений.

Во-первых, [`#3519`](https://github.com/skbkontur/retail-ui/pull/3519) переименовал exports:

- `Theme2022` / `Theme2022Dark` → `LIGHT_THEME` / `DARK_THEME`;
- прежние `DefaultTheme` / `DarkTheme` как слепки состояния на момент 5.0 → `LIGHT_THEME_2022_0` / `DARK_THEME_2022_0`;
- `MobileTheme` → `LIGHT_THEME_MOBILE`.

Документация `ThemeContext.md` теперь формулирует это так: `LIGHT_THEME` и `DARK_THEME` — актуальные темы, которые будут получать визуальные обновления, а варианты `_2022_0` нужны тем, кто не хочет автоматически получать будущие визуальные изменения дизайн-системы.

```tsx
import { ThemeContext, LIGHT_THEME, DARK_THEME } from "@skbkontur/react-ui";

<ThemeContext.Provider value={LIGHT_THEME}>{app}</ThemeContext.Provider>;
```

Во-вторых, [`#3516`](https://github.com/skbkontur/retail-ui/pull/3516) ужесточил типизацию `ThemeFactory.create`. Раньше generic позволял передать почти произвольный объект. Теперь аргумент ограничен доступными токенами темы через `ThemeIn & NoInfer<T>`, а для дополнительных переменных аддонов или бокового меню нужно явно указывать соответствующий generic-тип.

```tsx
import { ThemeFactory, LIGHT_THEME } from "@skbkontur/react-ui";

// Обычные токены темы типизируются напрямую.
const theme = ThemeFactory.create(
  {
    btnBorderRadius: "8px",
  },
  LIGHT_THEME
);
```

Если проект расширял тему собственными токенами без явного типа, после обновления TypeScript начнёт подсвечивать такие места — это ожидаемая часть миграции.

Отдельно в [`#3515`](https://github.com/skbkontur/retail-ui/pull/3515) и [`#3517`](https://github.com/skbkontur/retail-ui/pull/3517) удалены legacy-переменные темы. Среди подтверждённых замен: `menuLegacyPaddingY` заменяется на `menuScrollContainerContentWrapperPaddingY`, `pickerBg` — на `calendarBg`, `pickerBorderRadius` — на `calendarBorderRadius`, а token-переменные вида `tokenDefaultIdleBg` переименованы в более короткие `tokenBg`, `tokenColor`, `tokenBorderColor` и их `Hover`/`Active` варианты.

## BREAKING: Calendar.scrollToMonth() перешёл на человекочитаемые месяцы

В release body явно указан breaking change для `Calendar` и `DatePicker`: метод `scrollToMonth(month, year)` теперь принимает месяц в human format. Это значит, что январь — `1`, февраль — `2`, декабрь — `12`.

```ts
// Было в 4.x: январь — 0.
calendar.scrollToMonth(0, 2024);

// Стало в 5.0.0: январь — 1.
calendar.scrollToMonth(1, 2024);
```

Это изменение пришло в коммите [`2e55167`](https://github.com/skbkontur/retail-ui/commit/2e55167956582acf7d76863ba4f97f0a3ca39837). Его нужно искать не только в прямых вызовах `Calendar`, но и в обёртках вокруг `DatePicker`, если они управляют календарём через ref.

## Link, Toast, Button и визуальные фиксы

Помимо крупных API-изменений, в релиз попали исправления, которые стоит знать при визуальном тестировании:

- [`#3462`](https://github.com/skbkontur/retail-ui/pull/3462) заменил подчёркивание `Link` с `border-bottom` на `text-decoration`. Это лучше работает с многострочными ссылками и иконками, но может изменить скриншоты.
- [`#3528`](https://github.com/skbkontur/retail-ui/pull/3528) упростил разметку `Link`: отдельный outline-элемент убран, а `warning`/`error` стили применяются на root через background и box-shadow.
- [`#3520`](https://github.com/skbkontur/retail-ui/issues/3520) и [`#3527`](https://github.com/skbkontur/retail-ui/issues/3527) связаны с `data-tid` у `Button` и `Toast`; если E2E-тесты цепляются за старые root tid, их нужно перепроверить.
- [`#3493`](https://github.com/skbkontur/retail-ui/issues/3493) исправил цвета error outline и disabled text в темизации.

## Как обновляться

```bash
pnpm add @skbkontur/react-ui@5.0.0
```

Или через npm:

```bash
npm install @skbkontur/react-ui@5.0.0
```

После установки я бы проверял миграцию в таком порядке:

1. Поискать `scrollToMonth(` и заменить zero-based месяцы на human format.
2. Поискать удалённые API: `Picker`, `hideScrollBar`, `Toggle color=`, `shouldBeVisibleWithLessThanTwoPages`, старые `*Size` типы.
3. Обновить импорты тем на `LIGHT_THEME`, `DARK_THEME`, `LIGHT_THEME_MOBILE` или `_2022_0`-варианты.
4. Прогнать TypeScript: `ThemeFactory.create` теперь должен ловить лишние theme tokens.
5. Прогнать визуальные тесты вокруг `Link`, `Button`, `Select`, `DatePicker`, `ComboBox`, `MaskedInput`, `Popup`/`Tooltip` и `Toast`.

## Ссылки

- [Release @skbkontur/react-ui@5.0.0](https://github.com/skbkontur/retail-ui/releases/tag/%40skbkontur/react-ui%405.0.0)
- [Compare @skbkontur/react-ui@4.27.0...@skbkontur/react-ui@5.0.0](https://github.com/skbkontur/retail-ui/compare/@skbkontur/react-ui@4.27.0...@skbkontur/react-ui@5.0.0)
- [PR #3521: Button/Link component prop](https://github.com/skbkontur/retail-ui/pull/3521)
- [PR #3390: MaskedInput rev. 2](https://github.com/skbkontur/retail-ui/pull/3390)
- [PR #3451: Popup вместо DropdownContainer](https://github.com/skbkontur/retail-ui/pull/3451)
- [PR #3523: удаление deprecated entities](https://github.com/skbkontur/retail-ui/pull/3523)
- [PR #3519: новые имена тем](https://github.com/skbkontur/retail-ui/pull/3519)

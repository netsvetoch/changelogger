---
author: Артём Нецветаев
pubDatetime: 2026-07-06T14:29:49.000Z
title: "Gravity UI UIKit 7.44.0: responsive Dialog, цветовые stop'ы Progress и исправления Popup"
slug: gravity-ui-uikit-v7-44-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - uikit
description: "Разбор минорного релиза Gravity UI UIKit v7.44.0: новые props maxWidth/fullWidth у Dialog, экспериментальные мобильные модалки, color в Progress colorStops и исправления Alert, CopyToClipboard, Label, NumberInput и Popup."
---

Gravity UI UIKit выпустил минорную версию [`v7.44.0`](https://github.com/gravity-ui/uikit/releases/tag/v7.44.0). В релиз вошли две пользовательские возможности и несколько точечных исправлений: `Dialog` получил новый API для ширины и мобильного поведения, `Progress` научился задавать кастомный цвет для `colorStops`, а `Popup` больше не должен мигать в левом верхнем углу до расчёта позиции.

Источник для обзора — GitHub Release [`gravity-ui/uikit@v7.44.0`](https://github.com/gravity-ui/uikit/releases/tag/v7.44.0), compare [`v7.43.0...v7.44.0`](https://github.com/gravity-ui/uikit/compare/v7.43.0...v7.44.0) и связанные PR/коммиты.

## Что нового

### Dialog: `maxWidth`, `fullWidth` и экспериментальные mobile modal'ы

Главное изменение релиза — [#2721](https://github.com/gravity-ui/uikit/pull/2721). У `DialogProps` появились два новых prop'а для управления шириной:

- `maxWidth?: "s" | "m" | "l"` — задаёт максимальную ширину содержимого диалога;
- `fullWidth?: boolean` — растягивает содержимое до доступной ширины в рамках `maxWidth`.

Старый `size?: "s" | "m" | "l"` оставлен в API, но помечен как deprecated: документация теперь прямо советует использовать связку `maxWidth` + `fullWidth`. В CSS для `Dialog` эти размеры мапятся на переменные `Modal`: `s` — `480px`, `m` — `720px`, `l` — `900px`, а `fullWidth` выставляет `--g-modal-width: 100%`.

Пример нового API:

```tsx
import { Dialog } from "@gravity-ui/uikit";

export function DeleteProjectDialog({ open, onClose }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="m"
      fullWidth
      aria-labelledby="delete-project-title"
    >
      <Dialog.Header caption="Удалить проект" id="delete-project-title" />
      <Dialog.Body>
        Длинный текст подтверждения останется в диалоге шириной до 720px, а не
        будет зависеть от устаревшего prop `size`.
      </Dialog.Body>
      <Dialog.Footer textButtonApply="Удалить" textButtonCancel="Отмена" />
    </Dialog>
  );
}
```

В этом же PR появилась экспериментальная поддержка полноэкранных мобильных modal'ов. Она включается не самим `Dialog`, а через `MobileProvider`: в `MobileContextProps` и `MobileProviderProps` добавлено поле `__experimentalMobileModals?: boolean`. Когда контекст находится в mobile-режиме и флаг включён, `Dialog` передаёт в `Modal` режим `mobile`, принудительно использует `contentOverflow="auto"`, включает `full-width`, отключает height-transition и адаптирует внутренние части:

- close-кнопка получает размер `xl` вместо `l` и другие отступы;
- `Dialog.Header` переключает текст с `subheader-3` на `header-1`;
- `Dialog.Footer` становится колонкой, а кнопки — `xl`;
- `Modal` выставляет `--g-modal-width: 100vw`, `--g-modal-height: 100vh`, `--g-modal-margin: 0px`, `--g-modal-border-radius: 0px` и анимирует контент снизу через `translateY`.

Минимальная схема включения выглядит так:

```tsx
import { Dialog, MobileProvider } from "@gravity-ui/uikit";

export function MobileShell() {
  return (
    <MobileProvider mobile platform="mobile" __experimentalMobileModals>
      <Dialog open onClose={() => {}} aria-label="Настройки">
        <Dialog.Header caption="Настройки" />
        <Dialog.Body>На mobile это будет полноэкранный modal.</Dialog.Body>
      </Dialog>
    </MobileProvider>
  );
}
```

Отдельно у `Modal` расширился CSS API: в README добавлены переменные `--g-modal-max-width` и `--g-modal-max-height`, а `--g-modal-width` и `--g-modal-height` теперь работают вместе с max-ограничениями на самом content-элементе.

### Progress: кастомный цвет внутри `colorStops`

В [#2713](https://github.com/gravity-ui/uikit/pull/2713) тип `ProgressColorStops` расширили полем `color?: string`:

```ts
export interface ProgressColorStops {
  theme: ProgressTheme;
  stop: number;
  color?: string;
}
```

Раньше `colorStops` выбирал только тему (`default`, `success`, `warning`, `danger`, `info`, `misc`) по диапазону значения. Теперь элемент stop'а может вернуть не только `theme`, но и конкретный CSS-цвет. Если `color` задан, `ProgressWithValue` прокидывает его в inline style как `backgroundColor`, а theme-модификатор не добавляет. Если `color` не задан, поведение остаётся прежним: используется theme-модификатор.

```tsx
import { Progress } from "@gravity-ui/uikit";

const colorStops = [
  { theme: "danger", stop: 20, color: "#ff0051" },
  { theme: "warning", stop: 50, color: "#ffdd00" },
  { theme: "success", stop: 100, color: "#00ff8c" },
];

export function UploadProgress({ value }: { value: number }) {
  return <Progress value={value} text={`${value}%`} colorStops={colorStops} />;
}
```

Это полезно, когда семантика `theme` нужна для структуры stop'ов, но конкретный цвет должен совпадать с продуктовой палитрой или состояниями графика.

## Исправления

### Alert больше не рендерит пустой блок message

В [#2729](https://github.com/gravity-ui/uikit/pull/2729) `Alert` перестал создавать `<div className="...message">`, когда `message` не передан или falsy. До исправления title-only Alert всё равно получал пустой контейнер сообщения, что влияло на DOM и могло добавлять лишние отступы. Теперь message-блок рендерится только при наличии `message`, а в Storybook и visual tests добавлен сценарий `TitleOnly`.

### CopyToClipboard корректно доходит до fallback

[#2432](https://github.com/gravity-ui/uikit/pull/2432) меняет `copyText` на `async`-функцию и явно `await`-ит `navigator.clipboard.writeText(text)`. Практический эффект: если современный Clipboard API существует, но отклоняет запись, например из-за permissions или контекста страницы, код попадает в `catch` и может перейти на `copyTextFallback(text)` при доступном `document`. Раньше функция возвращала promise напрямую из `try`, поэтому fallback не срабатывал на асинхронный reject.

### Label: copy теперь совместим с `onClick`

В [#2725](https://github.com/gravity-ui/uikit/pull/2725) поправили условие вокруг `CopyToClipboard` в `Label`. Было: копирование включалось только когда есть `copyText` и нет `onClick`. Стало: если `hasCopy && copyText`, `Label` оборачивается в `CopyToClipboard` независимо от наличия пользовательского `onClick`.

Это важно для интерактивных label'ов, где клик одновременно открывает действие в приложении и должен сохранить текст в буфер:

```tsx
import { Label } from "@gravity-ui/uikit";

<Label copyText="INV-2048" onClick={() => openInvoice("INV-2048")}>
  INV-2048
</Label>;
```

### NumberInput: правильный тип для NumericArrows

[#2728](https://github.com/gravity-ui/uikit/pull/2728) — TypeScript-исправление во внутреннем `NumericArrows`. Интерфейс props теперь расширяет `React.HTMLAttributes<HTMLDivElement>`, а не `React.HTMLAttributes<"div">`; остаточные props при передаче в `Flex` приводятся к `FlexProps`. Для пользователей это снижает риск странных type error'ов вокруг HTML-атрибутов NumericArrows/NumberInput без изменения runtime-поведения.

### Popup: статус остаётся `initial`, пока позиция не рассчитана

Самое заметное runtime-исправление — [#2714](https://github.com/gravity-ui/uikit/pull/2714). В PR описан timing-баг: при открытии `Popup` Floating UI может зарегистрировать reference и применить transform на один render позже, чем `useFloatingTransition` переводит `data-floating-ui-status` в `open`. В тяжёлых поддеревьях, например в больших виртуализированных таблицах, popup на мгновение становился видимым в нерассчитанной позиции `top: 0; left: 0`, а потом прыгал к anchor.

Теперь `Popup` пишет в DOM `data-floating-ui-status="initial"`, пока `status === "open" && !isPositioned`. CSS-состояние `initial` оставляет popup невидимым до тех пор, пока Floating UI не рассчитает позицию; только после этого элемент получает `open` и плавно появляется уже рядом с anchor.

В этом же изменении `BreadcrumbsDropdownMenu` начал явно передавать `open={open}` в `Popup`, чтобы состояние меню и popup были синхронизированы.

## Кому стоит обновиться

`v7.44.0` выглядит как безопасное минорное обновление для проектов на `@gravity-ui/uikit` 7.x: в release notes нет breaking changes, а deprecated-статус старого `Dialog.size` сопровождается новым API, не удалением.

Обновление особенно интересно, если вы:

- используете `Dialog` и хотите управлять шириной через `maxWidth`/`fullWidth`, а не через старый `size`;
- адаптируете modal-сценарии под мобильные интерфейсы и готовы попробовать экспериментальный `__experimentalMobileModals`;
- строите прогресс-бары с цветовыми порогами и хотите задавать точные brand/product colors;
- сталкивались с миганием `Popup` в левом верхнем углу при открытии в тяжёлых интерфейсах;
- используете title-only `Alert`, copy-сценарии в `Label` или fallback копирования в старых/ограниченных браузерных контекстах.

## Как обновиться

```bash
pnpm add @gravity-ui/uikit@7.44.0
```

Или через npm:

```bash
npm install @gravity-ui/uikit@7.44.0
```

После обновления стоит прогнать типизацию и визуальные тесты/Storybook. Отдельно проверьте сценарии с `Dialog.size`: prop пока остаётся, но для новых мест лучше перейти на `maxWidth` и `fullWidth`.

## Ссылки

- [Release v7.44.0](https://github.com/gravity-ui/uikit/releases/tag/v7.44.0)
- [Compare v7.43.0...v7.44.0](https://github.com/gravity-ui/uikit/compare/v7.43.0...v7.44.0)
- [PR #2721: Dialog responsive size props](https://github.com/gravity-ui/uikit/pull/2721)
- [PR #2713: Progress custom color in colorStops](https://github.com/gravity-ui/uikit/pull/2713)
- [PR #2714: Popup initial status until positioned](https://github.com/gravity-ui/uikit/pull/2714)
- [Репозиторий gravity-ui/uikit](https://github.com/gravity-ui/uikit)

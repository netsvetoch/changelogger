---
author: Артём Нецветаев
pubDatetime: 2026-07-29T11:58:51.000Z
title: "@gravity-ui/navigation 6.4.0: подсказки и доступные кнопки закрепления в AllPagesPanel"
slug: gravity-ui-navigation-v6-4-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - navigation
  - accessibility
description: "Разбор @gravity-ui/navigation v6.4.0: кнопки закрепления и открепления в AllPagesPanel получили локализованные Tooltip и aria-label; текст действия зависит от текущего состояния элемента."
---

`@gravity-ui/navigation` выпустил минорную версию [`v6.4.0`](https://github.com/gravity-ui/navigation/releases/tag/v6.4.0). В ней один пользовательский change: в режиме настройки `AllPagesPanel` у иконки закрепления появилась подсказка. Но реализация не ограничивается визуальным `Tooltip`: та же локализованная строка стала доступным именем кнопки.

Основания для разбора: GitHub Release [`v6.4.0`](https://github.com/gravity-ui/navigation/releases/tag/v6.4.0), PR [#658](https://github.com/gravity-ui/navigation/pull/658), merge commit [`893d9b2`](https://github.com/gravity-ui/navigation/commit/893d9b2551a1aac2d2bc539cb27ab505502c081f) и сравнение [`v6.3.1...v6.4.0`](https://github.com/gravity-ui/navigation/compare/v6.3.1...v6.4.0). Помимо релизного commit, compare содержит только служебный commit, который обновляет версию пакета и `CHANGELOG.md`.

## Tooltip показывает именно следующее действие

Изменение находится в `AllPagesListItem` — строке списка внутри `AsideHeader` → `AllPagesPanel`. Оно применяется лишь тогда, когда пользователь редактирует панель (`editMode`) и элемент разрешено менять (`!item.preventUserRemoving`).

Раньше иконка была просто кнопкой с `Pin` или `PinFill`. В `6.4.0` эта кнопка обёрнута в `Tooltip`; его `content` выбирается по `item.hidden`:

```tsx
<Tooltip
  content={i18n(item.hidden ? "all-panel.item.pin" : "all-panel.item.unpin")}
>
  <Button
    aria-label={i18n(
      item.hidden ? "all-panel.item.pin" : "all-panel.item.unpin"
    )}
    onClick={onPinButtonClick}
    view={item.hidden ? "flat-secondary" : "flat-action"}
  >
    <Button.Icon>{item.hidden ? <Pin /> : <PinFill />}</Button.Icon>
  </Button>
</Tooltip>
```

То есть для скрытого элемента интерфейс предлагает «Закрепить» (`Pin`), а для уже закреплённого — «Открепить» (`PinFill`). Подсказка описывает действие клика, а не только название текущего состояния. Обработчик `onPinButtonClick` и условия, при которых доступна кнопка, релиз не меняет.

## Одинаковый текст для mouse-подсказки и accessibility

Вместе с `Tooltip` добавлен `aria-label` с тем же вызовом `i18n`. Поэтому кнопка больше не остаётся только с иконкой для скринридера: её доступное имя синхронизировано с текстом подсказки и текущим состоянием элемента.

В английском словаре появились ключи:

```json
{
  "all-panel.item.pin": "Pin",
  "all-panel.item.unpin": "Unpin"
}
```

Русская локализация пакета содержит соответствующие значения `«Закрепить»` и `«Открепить»`. Это важно для приложений, которые используют русскую локаль `@gravity-ui/navigation`: текст не подставляется из английского fallback и не требует добавлять свои строки для этой конкретной кнопки.

## Что делать при обновлении

Нового public prop, callback или migration step в `6.4.0` нет. Достаточно обновить зависимость:

```bash
npm install @gravity-ui/navigation@6.4.0
```

После обновления пользователь увидит локализованное объяснение кнопки при наведении в редактируемой `AllPagesPanel`, а ассистивные технологии получат то же имя через `aria-label`. Если элемент защищён `preventUserRemoving` или панель не находится в `editMode`, кнопка, как и прежде, не рендерится — следовательно, подсказка в этих режимах тоже не появляется.

## Итог

`@gravity-ui/navigation 6.4.0` — небольшой, но конкретный accessibility и UX-релиз для `AllPagesPanel`: у действия закрепления появилась локализованная подсказка, а иконка получила доступное имя. Изменение не расширяет внешний API, зато делает существующее действие понятнее и мышью, и со скринридером.

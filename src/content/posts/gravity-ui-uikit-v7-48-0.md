---
author: Артём Нецветаев
pubDatetime: 2026-08-15T01:51:44.000Z
title: "@gravity-ui/uikit 7.48.0: disableModal у Drawer и сигнатура onOpenChange у ColorPicker"
slug: gravity-ui-uikit-v7-48-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
  - typescript
  - ui
  - accessibility
description: "Разбор @gravity-ui/uikit v7.48.0: Drawer.disableModal для non-modal focus management, ColorPicker.onOpenChange в сигнатуре Popup, правка display у текста SegmentedRadioGroup."
---

Вышел минорный релиз [`@gravity-ui/uikit v7.48.0`](https://github.com/gravity-ui/uikit/releases/tag/v7.48.0). Между `v7.47.2` и `v7.48.0` три пользовательских коммита: у lab-`ColorPicker` выровняли тип `onOpenChange` с `Popup`, у `Drawer` появился `disableModal` для non-modal focus management, а в `SegmentedRadioGroup` поправили CSS текста опции, из‑за которого «плыли» иконки при `width="auto"` / `width="max"`.

Источники: [GitHub Release](https://github.com/gravity-ui/uikit/releases/tag/v7.48.0), [compare `v7.47.2...v7.48.0`](https://github.com/gravity-ui/uikit/compare/v7.47.2...v7.48.0), PR [#2772](https://github.com/gravity-ui/uikit/pull/2772), [#2775](https://github.com/gravity-ui/uikit/pull/2775), [#2765](https://github.com/gravity-ui/uikit/pull/2765). Версия `7.48.0` — minor-граница semver; `featured: false`.

## `Drawer`: non-modal режим через `disableModal`

Раньше `FloatingFocusManager` внутри `Drawer` всегда получал `modal={isMounted}`: пока панель смонтирована и открыта, фокус удерживался в drawer, а остальная страница вела себя как modal-слой. Для docked-панели рядом с контентом это мешало — issue [#2774](https://github.com/gravity-ui/uikit/issues/2774) прямо просило non-modal focus management.

В [#2775](https://github.com/gravity-ui/uikit/pull/2775) / коммит [`6963bc7`](https://github.com/gravity-ui/uikit/commit/6963bc7085d8f5721eb13056b714d6f5cb2c4e40) добавили prop:

```ts
/** Disables modal focus management. @default false */
disableModal?: boolean;
```

Прокидывание в floating-ui:

```tsx
<FloatingFocusManager
  context={context}
  disabled={!isMounted}
  modal={isMounted && !disableModal}
  initialFocus={refs.floating}
  returnFocus={returnFocus}
  visuallyHiddenDismiss={/* ... */}
/>
```

Поведение:

- default `disableModal={false}` — как раньше: modal focus trap при открытом drawer;
- `disableModal={true}` — `modal={false}`: focus management не блокирует взаимодействие с остальной страницей.

Проп задокументирован в английском и русском README `Drawer` («Disables modal focus management» / «Отключает модальное управление фокусом»).

```tsx
import { Drawer, DrawerItem } from "@gravity-ui/uikit";

<Drawer
  open={open}
  onClose={() => setOpen(false)}
  disableModal
  disableOutsideClick
>
  <DrawerItem id="filters" visible>
    {/* фильтры рядом с таблицей, страница остаётся кликабельной */}
  </DrawerItem>
</Drawer>;
```

Имеет смысл включать `disableModal` для боковых панелей, которые живут рядом с основным UI, а не перекрывают его как диалог. Закрытие по `Esc`/outside click по-прежнему настраивается отдельными `disableEscapeKeyDown` и `disableOutsideClick`.

## `ColorPicker`: `onOpenChange` как у `Popup`

Changelog формулирует изменение как «replaced open state with shared useOpenState», но по diff [#2772](https://github.com/gravity-ui/uikit/pull/2772) / [`a788085`](https://github.com/gravity-ui/uikit/commit/a788085e4d8feb7cfa2bfc129405f8efa3083f91) и issue [#2771](https://github.com/gravity-ui/uikit/issues/2771) («use shared onOpenChange signature») в публичном API lab-компонента поменялся именно тип колбэка.

Было:

```ts
onOpenChange?: (open: boolean) => void;
```

Стало:

```ts
onOpenChange?: PopupProps["onOpenChange"];
// то есть:
// (open: boolean, event?: Event, reason?: OpenChangeReason) => void
```

Внутри компонент по-прежнему держит open-state через `useControlledState(open, defaultOpen, onOpenChange)` и передаёт `onOpenChange={setIsOpen}` в `Popup`. Смысл для потребителя: колбэк совместим с floating-ui/`Popup` и при dismiss получает не только флаг, но и `event` + `reason` (в unit-тесте закрытие кликом снаружи ожидает `onOpenChange(false, event, 'outside-press')`).

```tsx
import { unstable_ColorPicker as ColorPicker } from "@gravity-ui/uikit";

<ColorPicker
  compact
  defaultOpen
  onOpenChange={(open, _event, reason) => {
    if (!open && reason === "outside-press") {
      // закрыли кликом мимо popup
    }
  }}
/>;
```

Если свой код типизировал `onOpenChange` строго как `(open: boolean) => void`, TypeScript после обновления может потребовать расширить сигнатуру (лишние параметры в реализации по-прежнему допустимы). Семантика controlled `open` / `defaultOpen` не менялась.

## `SegmentedRadioGroup`: иконки больше не съезжают при `width`

Баг [#2133](https://github.com/gravity-ui/uikit/issues/2133): при `width="auto"` или `width="max"` горизонтальное выравнивание опций с иконками ломалось (воспроизводилось в story `components-inputs-segmentedradiogroup--icons`). Причина — у внутреннего `*-option-text` стояло `display: block`.

В [#2765](https://github.com/gravity-ui/uikit/pull/2765) / [`a6bb0f4`](https://github.com/gravity-ui/uikit/commit/a6bb0f429db390d507c7744840a3901b4b8903b6) в `SegmentedRadioGroup.scss`:

```scss
&-text {
  display: inline-flex; // было: block
  overflow: hidden;
  text-overflow: ellipsis;
}
```

Публичных props не добавили: правка чисто layout. Добавлены visual-регрессии с опциями «иконка + текст» / «только иконка» на `width` из существующих `widthCases`. После обновления иконки в сегментированной группе должны оставаться на месте при auto/max ширине.

```tsx
import { Icon, SegmentedRadioGroup } from "@gravity-ui/uikit";
import { TriangleExclamationFill } from "@gravity-ui/icons";

<SegmentedRadioGroup width="auto" defaultValue="warn" size="s">
  <SegmentedRadioGroup.Option value="warn" title="Warning">
    <Icon data={TriangleExclamationFill} />
    <span>Warning</span>
  </SegmentedRadioGroup.Option>
  <SegmentedRadioGroup.Option value="ok" content="OK" />
</SegmentedRadioGroup>;
```

## Обновление

```bash
pnpm add @gravity-ui/uikit@7.48.0
```

Что проверить после апдейта:

1. `Drawer`, который должен оставаться «рядом» с контентом, а не модалкой — `disableModal` (+ при необходимости `disableOutsideClick`).
2. Подписчики `ColorPicker.onOpenChange` — типы и использование `reason`/`event`.
3. `SegmentedRadioGroup` с иконками и `width="auto"` / `"max"` — визуально иконки не должны смещаться.

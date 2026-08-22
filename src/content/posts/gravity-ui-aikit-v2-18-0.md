---
author: Артём Нецветаев
pubDatetime: 2026-08-22T20:21:00.000Z
title: "@gravity-ui/aikit 2.18.0: bottom-sheet для History/Header в мобильном режиме и локализация дат"
slug: gravity-ui-aikit-v2-18-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
  - chat
  - aikit
description: "Разбор минорного релиза @gravity-ui/aikit v2.18.0: история чатов и меню «...» рендерятся в bottom-шеете в мобильном режиме (PR #229), сброс tooltip у ActionButton после клика, локализованные заголовки дат и новый prop actionIcons у Header (PR #228)."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.18.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.18.0). Главное — доведение мобильного режима начатого в `v2.17.0`: история чатов и меню «...» в шапке в мобильном режиме теперь рендерятся внизу экрана в компоненте `Sheet` вместо `Popup`/`DropdownMenu` ([PR #229](https://github.com/gravity-ui/aikit/pull/229)). Отдельно в [PR #228](https://github.com/gravity-ui/aikit/pull/228) — точечные исправления и расширение API: tooltip у `ActionButton` сбрасывается после клика, у заголовков дат появилась локализация/кастомный формат, а у `Header` — новый prop `actionIcons`.

Источники: GitHub Release [`gravity-ui/aikit@v2.18.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.18.0), compare [`v2.17.0...v2.18.0`](https://github.com/gravity-ui/aikit/compare/v2.17.0...v2.18.0), [PR #229](https://github.com/gravity-ui/aikit/pull/229), [PR #228](https://github.com/gravity-ui/aikit/pull/228). Это обычный changelog-релиз, а не указатель на отдельный официальный анонс.

## Bottom-sheet в мобильном режиме (PR #229)

PR #229 не добавляет новых публичных props — мобильное поведение включается через uikit `MobileProvider`/`useMobile()`, то есть автоматически для приложений, уже обёрнутых в `MobileProvider`. Десктоп не меняется.

### `History`: `Popup` → `Sheet`

Раньше `History` оборачивал `HistoryList` в `Popup` (`placement="bottom-end"`). Теперь при `useMobile() === true` список рендерится внутри `Sheet`, всё также с контролом через `open`/`onOpenChange`:

```tsx
// src/components/templates/History/History.tsx (v2.18.0)
if (isMobile) {
  return (
    <Sheet
      id={sheetId}
      title={i18n("sheet-title")}
      visible={open}
      onClose={() => onOpenChange?.(false)}
      contentClassName={b("sheet-content")}
      qa="history-sheet"
      allowHideOnContentScroll
    >
      <HistoryList {...listProps} onChatClick={handleChatClick} />
    </Sheet>
  );
}
```

Заголовок шеета берётся из i18n (`"История чатов"` в `ru.json`). В mobile-ветке `Sheet` получает `allowHideOnContentScroll`, а `History.scss` для `.g-aikit-history__sheet-content` расширяет контейнер на всю ширину и убирает `max-height`/`overflow` у списка. Выбор чата, как и раньше, закрывает окно через `handleChatClick`.

### `ChatItem`: кнопка удаления всегда видна

На мобильном нет hover, поэтому у `ChatItem` кнопка удаления показывается постоянно, а не по наведению, и имеет размер `m` вместо `s`:

```tsx
// src/components/templates/History/ChatItem.tsx (v2.18.0)
const isMobile = useMobile();
const deleteButtonSize = isMobile ? "m" : "s";

// ...
<ActionButton
  view="flat"
  size={deleteButtonSize}
  color="secondary"
  loading={isDeleteProccesing}
  className={b("delete-button")}
  // ...
/>;
```

В `History.scss` модификатор `_mobile` добавлен в селектор «показывать кнопку удаления» рядом с `_active`/`_is-delete-processing`.

### `Header`: меню «...» в шеете

Те же `menuItems` в мобильном режиме рендерятся внутри `Sheet` (содержимое — `Menu size="xl"`) вместо `DropdownMenu`. Клик по пункту закрывает шеет и вызывает `item.onClick()`. Раньше `qa`-атрибуты пунктов строились внутри `dropdownMenuItems`; теперь общие пункты нормализованы в `getNormalizedMenuItem`/`normalizedMenuItems` (`header-menu-item-${item.id}` по умолчанию) и переиспользуются в обеих ветках — десктоп и мобилка рендерят одинаковый набор пунктов:

```tsx
// Header.tsx (v2.18.0) — мобильная ветка
<Sheet
  id={menuSheetId}
  title={i18n("menu-sheet-title")}
  visible={isMenuSheetVisible}
  onClose={() => setIsMenuSheetVisible(false)}
  contentClassName={b("menu-sheet-content")}
  qa="header-menu-sheet-container"
>
  <Menu size="xl" qa="header-menu-sheet">
    {normalizedMenuItems.map(item => (
      <Menu.Item
        key={item.id}
        disabled={item.disabled}
        iconStart={item.icon}
        qa={item.qa}
        onClick={() => {
          setIsMenuSheetVisible(false);
          item.onClick();
        }}
      >
        {item.label}
      </Menu.Item>
    ))}
  </Menu>
</Sheet>
```

Заголовок шеета — новый ключ i18n `menu-sheet-title` (`"Дополнительные действия"`). Визуальные тесты `Header` и `History` гоняются на viewport 375×700, добавлены сторис `MobileMenuItems`, `MobileSheet`, `MobileSheetEmptyState`.

## Tooltip у `ActionButton` сбрасывается после клика (PR #228)

Внутренний компонент `ActionButton` получил собственное состояние `tooltipDismissed`: после клика tooltip скрывается, чтобы не перекрывать открытое меню `Header`, историю или действия чата. Сбрасывается по `mouseleave` и `blur`:

```tsx
// ActionButton.tsx (PR #228)
const [tooltipDismissed, setTooltipDismissed] = React.useState(false);
// onClick → setTooltipDismissed(true)
// onMouseLeave / onBlur → setTooltipDismissed(false)
// ...
<ActionTooltip
  title={tooltipTitle}
  placement={tooltipPlacement}
  disabled={tooltipDisabled || tooltipDismissed}
  openDelay={tooltipOpenDelay}
  closeDelay={tooltipCloseDelay}
  // ...
/>;
```

## Локализованные заголовки дат (PR #228)

`ChatDate` и, через `HistoryList`, компонент `History` получили поддержку локали и кастомного dayjs-формата для неотносительных (абсолютных) заголовков дат. Новые props на `History`/`HistoryList`:

```ts
export interface HistoryListProps extends QAProps, DOMProps {
  // ...
  groupBy?: "date" | "none";
  /** Формат заголовков дат (dayjs-формат) */
  dateFormat?: string;
  /** Локаль для неотносительных заголовков дат */
  dateLocale?: string;
  /** Dayjs locale configuration для указанной локали */
  dateLocaleConfig?: DateLocaleConfig;
}
```

`DateLocaleConfig = Exclude<Parameters<Dayjs['locale']>[0], string>` — это dayjs-объект локали, например `import ru from 'dayjs/locale/ru'`. В `useDateFormatter` приоритет отдаётся `localeConfig` (если передан), иначе язык берётся из `locale` по первой части до `-`/`_`. Сам `ChatDate` тоже расширен props `locale` и `localeConfig`:

```tsx
import { ChatDate } from "@gravity-ui/aikit";
import ruLocale from "dayjs/locale/ru.js";

<ChatDate date="2024-01-15T10:30:00Z" locale="ru-RU" localeConfig={ruLocale} />;
```

## `Header`: переопределение иконок и `actionIcons` (PR #228)

У `Header` появился prop `actionIcons`, позволяющий переопределить иконки встроенных действий:

```ts
type HeaderProps = {
  // ...
  /** Overrides icons for individual built-in actions; unspecified actions keep their defaults */
  actionIcons?: Partial<Record<HeaderAction, IconData>>;
};
```

Важное сопутствующее поведение: если для `HeaderAction.Folding` задан кастомный icon через `actionIcons`, он сохраняется в обоих состояниях свёрнут/развёрнут (`FOLDING_ICONS[state]` теперь используется только когда кастомной иконки нет). Раньше кастомизировать folding-иконку было нельзя вовсе.

## Мелочи макета и CSS-переменные (PR #228)

PR #228 тянет за собой «переиспользуемое» поведение макета (автор PR описывает это как ожидаемое shared-изменение):

- скролл empty-state перенесён со списка подсказок на весь контент `EmptyContainer` — hero и подсказки скроллятся вместе;
- `PromptInputFooter` центрирован по вертикали (`align-items: center`);
- отступ между кружком и значением у `ContextIndicator` уменьшен до `var(--g-spacing-1)` (4px);
- опубликована новая тема-переменная `--g-aikit-empty-container-content-overflow-y` (default `auto`), чтобы потребители не зависели от внутренних классов AI Kit.

## Совместимость

- вся мобильная логика включается только при `useMobile()` (uikit `MobileProvider`); без него десктопное поведение `Popup`/`DropdownMenu` сохраняется;
- новые props (`dateFormat`, `dateLocale`, `dateLocaleConfig`, `actionIcons`) опциональны и обратно совместимы;
- tooltip-сброс у `ActionButton` — изменение поведения по умолчанию, но только на «меньше оверлеев» после клика.

Установка:

```bash
npm install @gravity-ui/aikit@2.18.0
```

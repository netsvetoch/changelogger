---
author: Артём Нецветаев
pubDatetime: 2026-08-26T15:41:00.000Z
title: "@gravity-ui/aikit 2.20.0: мобильные адаптивные метрики и плавающий заголовок"
slug: gravity-ui-aikit-v2-20-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
  - chat
  - aikit
description: "Разбор минорного релиза @gravity-ui/aikit v2.20.0: мобильная адаптация чат-компонентов перенесена из кастомных оверрайдов Cloud Console внутрь библиотеки. Новые props floatingHeader, showSheetTitle и ChatItem.size, десятки CSS-переменных для chat-сейтов и мобильные правки метрик (PR #240)."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.20.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.20.0). В нём ровно одна фича — [PR #240](https://github.com/gravity-ui/aikit/pull/240) «feat: mobile adaptive metrics and floating header mode» (коммит [`daa920b`](https://github.com/gravity-ui/aikit/commit/daa920b9a7b6078016480a10316bc8aff1d7a353)).

Источники: GitHub Release [`gravity-ui/aikit@v2.20.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.20.0), compare [`v2.19.2...v2.20.0`](https://github.com/gravity-ui/aikit/compare/v2.19.2...v2.20.0), [PR #240](https://github.com/gravity-ui/aikit/pull/240) и его [diff](https://github.com/gravity-ui/aikit/pull/240.diff). Это обычный changelog-релиз, а не указатель на отдельный официальный анонс.

## Что происходит под капотом

Cloud Console давно подгонял мобильный вид чата через внутренние оверрайды CSS-классов — отдельно от библиотеки. Релиз переносит эту адаптацию внутрь `@gravity-ui/aikit`: каждая метрика стала CSS-переменной, а два режима раскладки, которые нужны были консьюмерам, превратились в props. Все новые переменные по умолчанию сохраняют те значения, которые компоненты использовали раньше, поэтому для существующих потребителей ничего не меняется, пока они явно не задействуют новые токены.

## Новые props

Подтверждённые по diff ([types.ts](https://github.com/gravity-ui/aikit/blob/v2.20.0/src/components/pages/ChatContainer/types.ts), [Header/types.ts](https://github.com/gravity-ui/aikit/blob/v2.20.0/src/components/organisms/Header/types.ts)):

| Prop                           | По умолчанию                  | Что делает                                                                                      |
| ------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `ChatContainer.floatingHeader` | `false`                       | Вынимает заголовок из потока — контент и список сообщений скроллятся под ним                    |
| `Header.showSheetTitle`        | `true`                        | Скрывает заголовок мобильной «меню»-панели (sheet) визуально; заголовок остаётся в `aria-label` |
| `History.showSheetTitle`       | `true`                        | То же самое для мобильной history-панели                                                        |
| `ChatItem.size`                | `s` (desktop) / `xl` (mobile) | Размер действий строки, пробрасывается из `HistoryList`                                         |

### `floatingHeader`

Проп только вынимает заголовок из потока и наружу отдаёт его высоту через `--g-aikit-chat-container-header-height` — сам он контент не сдвигает (смещение зависит от раскладки). В diff добавлен docblock с рекомендованным сниппетом из README:

```tsx
<ChatContainer
  messages={messages}
  onSubmit={handleSend}
  isMobile
  floatingHeader
/>
```

```css
.my-chat {
  --g-aikit-chat-container-header-height: 60px;
  --g-aikit-chat-container-header-background: transparent;
}
.my-chat .g-aikit-chat-container__content {
  padding-top: var(--g-aikit-chat-container-header-height);
}
```

Нюансы: `--g-aikit-chat-container-header-height` по умолчанию равен `auto`, а в мобильном режиме `--g-aikit-chat-container-mobile-header-height` — `60px` ([variables.css](https://github.com/gravity-ui/aikit/blob/v2.20.0/src/themes/variables.css)). Заголовок выносится из потока, и на корневой элемент контейнера вешается модификатор `floating-header` ([ChatContainer.tsx](https://github.com/gravity-ui/aikit/blob/v2.20.0/src/components/pages/ChatContainer/ChatContainer.tsx)).

### `showSheetTitle` на Header и History

Когда выставлен `false`, заголовок мобильной панели скрывается визуально, а у `useHeader` появляется возвращаемое поле `showSheetTitle`. Заголовок при этом остаётся доступным: например, в `History` на мобильную `Sheet` вешается модификатор `without-title`, но текст сохраняется как доступное имя.

### `ChatItem.size` и размеры на мобильном

В `ChatItem` размер кнопки удаления раньше выбирался грубо: `isMobile ? 'm' : 's'`. Теперь это `resolveMobileControlSize({size, desktopDefault: 's', mobileDefault: 'xl', isMobile})`, а размер иконки считается через `getControlIconSize`. В `HistoryList` появился хук `useMobileControlSize(sizeProp, 'm', 'xl')` — размер прокидывается вниз в `ChatItem`. Итог на мобильном: кнопка удаления — `xl` (44px) с иконкой 20px.

## Новые CSS-переменные

Крупный пласт релиза — токены в `src/themes/common.css` / `src/themes/variables.css`. Группы:

**Меню-панель заголовка:** `--g-aikit-header-menu-sheet-inline-padding`, `--g-aikit-header-menu-sheet-bottom-padding`, `--g-aikit-header-menu-item-min-height` (`44px`), `--g-aikit-header-menu-item-inline-padding`, `--g-aikit-header-menu-item-icon-gap`, `--g-aikit-header-menu-item-font-size` (`16px`). Компонент сам добавляет `env(safe-area-inset-*)`.

**History-панель:** `--g-aikit-history-sheet-inline-padding`, `--g-aikit-history-sheet-bottom-padding`, `--g-aikit-history-sheet-list-padding`, `--g-aikit-history-sheet-filter-inline-padding`, `--g-aikit-history-sheet-filter-border-bottom`, `--g-aikit-history-sheet-item-inline-end-padding`, `--g-aikit-history-mobile-item-font-size` (`16px`), `--g-aikit-history-mobile-item-line-height` (`24px`).

**ChatContainer:** `--g-aikit-chat-container-header-height` (`auto`), `--g-aikit-chat-container-mobile-header-height` (`60px`), `--g-aikit-chat-container-mobile-header-padding`, `--g-aikit-chat-container-mobile-footer-padding`, `--g-aikit-chat-container-mobile-footer-empty-padding` — плюс мобильные `--g-aikit-chat-container-mobile-body-2-font-size` (`16px`) / `-line-height` (`20px`), `--g-aikit-chat-container-mobile-message-list-inline-padding`, `--g-aikit-chat-container-mobile-suggestions-max-height` (`40vh`), `--g-aikit-chat-container-mobile-suggestions-title-min-height` (`48px`).

**Прочие:** `--g-aikit-chat-content-message-list-inline-padding`, `--g-aikit-button-group-gap`, `--g-aikit-prompt-input-simple-padding`, `--g-aikit-prompt-input-full-padding`.

## Поведенческие изменения (только мобильные)

- History-панель теперь «вплотную» к краям: без отступов у списка, без внутренних padding и без нижней границы у фильтра.
- Мобильный элемент `.g-aikit-chat-container_mobile` мапит свой `font-size` в `--g-text-body-2-*`, а сама меню-панель задаёт собственный `font-size`, потому что портируется в `body` через portal.
- Блок предложений над полем ввода ограничен `--g-aikit-chat-container-mobile-suggestions-max-height` (`40vh`) и скроллится внутри себя. Когда экранная клавиатура сжимает контейнер, блок отдаёт место полю ввода, а не выталкивает его.

Вместе с лимитом высоты пришло два точечных фикса, scoped-только на capped-мобильный блок: у кнопок `height: auto` и у списка `flex-wrap: nowrap` (ранее кнопки растягивались друг по другу при definite height и переносе по колонкам). У заголовка предложений появился «пол»: слот заголовка держит высоту не меньше `--g-aikit-chat-container-mobile-suggestions-title-min-height` (`48px`), чтобы длинный заголовок скроллился внутри себя и не перекрашивал кнопки.

## Тесты

Две новые стори с визуальными тестами — `MobileFloatingHeader` и `MobileSuggestionsOverflow` ([ChatContainer.stories.tsx](https://github.com/gravity-ui/aikit/blob/v2.20.0/src/components/pages/ChatContainer/__stories__/ChatContainer.stories.tsx)). Все восемь обновлённых снапшотов — мобильные (`ChatContainer` mobile-состояния, меню-панель `Header`, history-панель), десктопная отрисовка не тронута. Визуально проверено в Cloud Console на реальном мобильном вьюпорте, включая окно с отрытой экранной клавиатурой.

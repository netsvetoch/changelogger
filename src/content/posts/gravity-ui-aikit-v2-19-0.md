---
author: Артём Нецветаев
pubDatetime: 2026-08-22T20:35:00.000Z
title: "@gravity-ui/aikit 2.19.0: чат подстраивается под экранную клавиатуру на мобильных"
slug: gravity-ui-aikit-v2-19-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
  - chat
  - aikit
description: "Разбор минорного релиза @gravity-ui/aikit v2.19.0: ChatContainer отслеживает window.visualViewport и сжимает себя до видимой области, пока на мобильном открыта экранная клавиатура (PR #230). Новый prop adjustToKeyboard (по умолчанию true), hook useKeyboardViewportFit и CSS-переменная --g-aikit-chat-container-mobile-keyboard-empty-container-padding."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.19.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.19.0). В нём ровно одна фича — [PR #230](https://github.com/gravity-ui/aikit/pull/230): `ChatContainer` на мобильных теперь подстраивается под открытую экранную клавиатуру, чтобы поле ввода промпта и disclaimer не уходили под неё.

Источники: GitHub Release [`gravity-ui/aikit@v2.19.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.19.0), compare [`v2.18.0...v2.19.0`](https://github.com/gravity-ui/aikit/compare/v2.18.0...v2.19.0), [PR #230](https://github.com/gravity-ui/aikit/pull/230), коммит [`048bc81`](https://github.com/gravity-ui/aikit/commit/048bc8120ff4b9bd4808f59e6c92160ee1598d95). Это обычный changelog-релиз, а не указатель на отдельный официальный анонс.

## Проблема: нижняя часть чата скрыта за клавиатурой

Мобильные браузеры держат layout-вьюпорт на полной высоте, пока открыта экранная клавиатура. iOS Safari — всегда, Chrome и Firefox — с тех пор, как `interactive-widget=resizes-visual` стал поведением по умолчанию (Chrome 108, Firefox 132). Поэтому `100vh`, `100dvh` и `height: 100%` дают исходную высоту, и нижняя часть чата — поле ввода и disclaimer — остаётся скрытой за клавиатурой. Видимую область корректно отдаёт только `window.visualViewport`.

## Что изменилось

`ChatContainer` теперь отслеживает `window.visualViewport` и в мобильном режиме ограничивает собственную высоту (`max-height`) до видимой области. Благодаря этому поле ввода «прилипает» ровно над клавиатурой, а список сообщений и welcome-экран прокручиваются внутри оставшегося места.

Ключевые изменения по коду ([дифф](https://github.com/gravity-ui/aikit/commit/048bc8120ff4b9bd4808f59e6c92160ee1598d95)):

- **Новый prop `adjustToKeyboard`** у `ChatContainer`, по умолчанию `true` ([types.ts](https://github.com/gravity-ui/aikit/blob/v2.19.0/src/components/pages/ChatContainer/types.ts)). Опт-аут нужен хостам, которые сами обрабатывают клавиатуру — например через `interactive-widget=resizes-content` в viewport meta: тогда layout-вьюпорт сжимается сам, и контейнер трогать не нужно.
- **Новый hook `useKeyboardViewportFit`** — экспортируется из `@gravity-ui/aikit` через `src/hooks/index.ts`, возвращает `{isKeyboardOpen, maxHeight}`. Чистая функция `resolveKeyboardViewportFit` покрыта 12 unit-тестами ([тесты](https://github.com/gravity-ui/aikit/blob/v2.19.0/src/hooks/__tests__/useKeyboardViewportFit.unit.test.ts)).
- **Модификатор `_keyboard-open`** на корневом элементе и `max-height` в мобильном режиме.
- **Welcome-экран** при открытой клавиатуре меняет крупный верхний отступ на остаточное пространство через новый токен.

Пример использования нового prop:

```tsx
// по умолчанию adjustToKeyboard = true — контейнер сам подгоняется под клавиатуру
<ChatContainer
  messages={messages}
  onSubmit={handleSend}
  isMobile
/>

// если хост уже сжимает layout-вьюпорт (interactive-widget=resizes-content),
// подгонку можно отключить:
<ChatContainer
  messages={messages}
  onSubmit={handleSend}
  isMobile
  adjustToKeyboard={false}
/>
```

## Детали механики

Реализация различает «настоящую» клавиатуру и другие причины уменьшения visual viewport:

- **Минимальный «вырез»**. Разница между layout и visual вьюпортом меньше `KEYBOARD_MIN_INSET = 80` px (браузерный URL-бар, тулбары) не считается открытой клавиатурой.
- **Pinch-zoom**. Жест масштабирования тоже уменьшает `visualViewport.height`, поэтому высота сначала пересчитывается обратно в layout-пиксели через `visualViewport.scale` — и только не достигаемая панорамированием часть считается клавиатурой.
- **Скролл iOS Safari**. Прокрутка страницы под клавиатурой двигает `offsetTop`, но не возвращает место — клавиатура при этом остаётся «открытой».
- **Анимация**. Промежуточные размеры вьюпорта во время анимации клавиатуры схлопываются в один кадр через `requestAnimationFrame`.

## Авто-скролл переживает открытие/закрытие клавиатуры

Браузер сохраняет позицию `scrollTop` при изменении размеров скролл-вьюпорта, поэтому при открытии клавиатуры низ списка «сползал» бы из поля зрения. Чтобы этого избежать, `useSmartScroll` и `useVirtualStickToBottom` теперь через `ResizeObserver` повторно прикрепляют список к последнему сообщению при ресайзе контейнера.

## Новый CSS-токен

В `src/themes/common.css` и `src/themes/variables.css` добавлены переменные. Пока клавиатура открыта, welcome-экран вместо большого отступа сверху (`80px 0 0`) использует токен клавиатуры:

```css
--g-aikit-chat-container-mobile-empty-container-padding: 80px 0 0;
--g-aikit-chat-container-mobile-keyboard-empty-container-padding: var(
    --g-spacing-4
  )
  0 0;
```

Токен на контейнере `--g-aikit-empty-container-mobile-padding` переопределяется на `--g-aikit-chat-container-mobile-keyboard-empty-container-padding` по умолчанию `var(--g-spacing-4) 0 0`.

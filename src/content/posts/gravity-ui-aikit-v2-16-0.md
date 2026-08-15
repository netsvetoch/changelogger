---
author: Артём Нецветаев
pubDatetime: 2026-08-15T01:35:29.000Z
title: "@gravity-ui/aikit 2.16.0: lifecycle маскота в ChatContainer и публичная кастомизация Console-дизайна"
slug: gravity-ui-aikit-v2-16-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
  - chat
  - aikit
description: "Разбор минорного релиза @gravity-ui/aikit v2.16.0: ChatContainer.mascotConfig со state machine, MessageList.footerContent, кастомизация footer у PromptInput, layout-переменные EmptyContainer и actionsOrder/actionSize у Header."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.16.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.16.0). В changelog одна feature-строка — mascot lifecycle для `ChatContainer` — но merge [PR #221](https://github.com/gravity-ui/aikit/pull/221) / commit [`dc1e7fd`](https://github.com/gravity-ui/aikit/commit/dc1e7fd465ddea41bf82a4132be5da0d5c0e0eb2) приносит целый набор публичных API для Console-дизайна: готовые React-ноды маскота по surface/state, `footerContent` у `MessageList`, расширенный footer у `PromptInput`, CSS-переменные раскладки `EmptyContainer` и декларативный порядок/размер действий в `Header`.

Источники: GitHub Release [`gravity-ui/aikit@v2.16.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.16.0), compare [`v2.15.0...v2.16.0`](https://github.com/gravity-ui/aikit/compare/v2.15.0...v2.16.0), [PR #221](https://github.com/gravity-ui/aikit/pull/221). Это обычный changelog-релиз, а не указатель на отдельный официальный анонс.

## ChatContainer: `mascotConfig` и state machine

Новый prop `mascotConfig?: MascotConfig` включает lifecycle. AIKit сам выводит состояние из статуса чата, активности prompt и cancel; потребитель отдаёт уже готовые React-ноды (Lottie, SVG, img) — размеры контролирует consumer, placement — AIKit.

Публичные типы (`src/types/mascot.ts`, `ChatContainer/types.ts`):

```ts
export type MascotState =
  | "reveal"
  | "thinking"
  | "done"
  | "idle"
  | "reading"
  | "error"
  | "stopped"
  | "sleeping"
  | "listening"
  | "speaking";

export type MascotView = "hero" | "chat";
export type MascotAnimationType = "loop" | "once";

export type MascotCollection = {
  hero?: Partial<Record<"idle" | "reading", React.ReactNode>>;
  chat?: Partial<Record<MascotState, React.ReactNode>>;
};

export interface MascotConfig<TAsset = string> {
  stateOverride?: MascotState;
  assets?: MascotAssets<TAsset>;
  defaultAssets?: MascotAssets<TAsset>;
  mascots?: MascotCollection;
  defaultMascots?: MascotCollection;
  /** Advanced renderer; takes precedence over `mascots`. */
  renderMascot?: (context: MascotRenderContext<TAsset>) => React.ReactNode;
  showOnWelcome?: boolean;
  showInChat?: boolean;
  sleepDelayMs?: number | null;
  onceDurations?: Partial<
    Record<"reveal" | "done" | "error" | "stopped", number>
  >;
  onStateChange?: (state: MascotState) => void;
}
```

Как выводятся состояния (hook `useMascotState` + `useChatContainerMascot`):

| Состояние                | Когда                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `reading`                | prompt не пустой (`isTyping`), статус `ready` — на hero и в chat                                     |
| `thinking`               | `status` ∈ `submitted` / `streaming` / `streaming_loading`                                           |
| `reveal`                 | one-shot при входе в chat-view (default 480 ms)                                                      |
| `done`                   | переход из pending-статуса в `ready` (default 600 ms); держится, пока дописывается assistant message |
| `error`                  | edge в `status === 'error'` (default 820 ms)                                                         |
| `stopped`                | cancel через `stopSignal` после `onCancel` (default 320 ms)                                          |
| `sleeping`               | idle в chat при `ready` после `sleepDelayMs` (default 60_000; `null`/≤0 отключает)                   |
| `listening` / `speaking` | только через `stateOverride` — AIKit их сам не выводит                                               |

Typing детектится через новый `PromptInput.onValueChange`: debounce 1500 ms после последнего ввода. Activity (смена `status`, числа сообщений, active chat, remount prompt) сбрасывает typing и будит маскота из `sleeping`.

Минимальный пример из README компонента:

```tsx
import { ChatContainer } from "@gravity-ui/aikit";

<ChatContainer
  messages={messages}
  status={status}
  onSendMessage={handleSend}
  mascotConfig={{
    mascots: {
      hero: {
        idle: <img src="/mascot/hero-idle.svg" alt="" />,
        reading: <img src="/mascot/hero-reading.svg" alt="" />,
      },
      chat: {
        reveal: <img src="/mascot/chat-reveal.svg" alt="" />,
        thinking: <img src="/mascot/chat-thinking.svg" alt="" />,
        done: <img src="/mascot/chat-done.svg" alt="" />,
        idle: <img src="/mascot/chat-idle.svg" alt="" />,
        error: <img src="/mascot/chat-error.svg" alt="" />,
        stopped: <img src="/mascot/chat-stopped.svg" alt="" />,
        sleeping: <img src="/mascot/chat-sleeping.svg" alt="" />,
        listening: <img src="/mascot/chat-listening.svg" alt="" />,
        speaking: <img src="/mascot/chat-speaking.svg" alt="" />,
      },
    },
  }}
/>;
```

Placement:

- **hero** — welcome/`EmptyContainer`: centered hero slot; при наличии `heroContent` он заменяет `image`.
- **chat** — один раз как **последняя scrollable-строка** `MessageList` (`footerContent`), выравнивание влево как у assistant-колонки.

Отсутствующее состояние на surface падает в `idle` той же surface (`getMascotNode`). `defaultMascots` — product-wide база, `mascots` — per-container override. `renderMascot(context)` перекрывает collection, если нужен asset-driven render (`view`, `state`, `animationType`, merged `assets`).

`stateOverride` отменяет активный one-shot; снятие override пересчитывает state из текущих входов. Декоративным нодам стоит ставить `aria-hidden`; статусным — доступный label.

Экспорты: `useMascotState`, `getMascotAnimationType`, `resolveMascotAssets`, `resolveMascotCollection`, `getMascotNode`, типы из `@gravity-ui/aikit`.

## MessageList: `footerContent`

Чтобы chat-маскот жил внизу списка без хака в DOM, у `MessageList` появился prop:

```tsx
export type MessageListProps = {
  // ...
  /** Last scrollable row rendered after all messages. */
  footerContent?: React.ReactNode;
};
```

Работает и в plain, и в virtualized режиме: virtualized добавляет trailing row (`footerOffset`), а `useVirtualStickToBottom` получил `trailingContentSignal`, чтобы pin-to-bottom учитывал появление/исчезновение footer. README прямо предупреждает: outer box маскота лучше держать стабильным по размеру при смене animated state — иначе scroll anchoring прыгает.

`ChatContainer` при `mascotConfig` сам кладёт chat-mascot в `messageListConfig.footerContent` / welcome `heroContent`.

## PromptInput: footer customization и `onValueChange`

Для Console-стилизации footer без внутренних BEM-классов расширен `PromptInputFooterConfig`:

```ts
export type PromptInputFooterConfig = {
  qa?: string;
  className?: string;
  contentClassName?: string;
  buttonSize?: ButtonButtonProps["size"]; // full default 'm', simple default 'l'
  /** state / onClick / size по-прежнему владеет PromptInput */
  submitButtonProps?: Omit<SubmitButtonProps, "state" | "onClick" | "size">;
  bottomContent?: ReactNode;
  // legacy shortcut props сохранены:
  submitButtonTooltipSend?: string;
  submitButtonTooltipCancel?: string;
  submitButtonCancelableText?: string;
  submitButtonQa?: string;
  // ...
};
```

`PromptInputFull` / `PromptInputSimple` прокидывают `className`, `contentClassName`, `buttonSize` и `submitButtonProps` в `PromptInputFooter`. Legacy tooltip/qa поля остаются; при конфликте выигрывает `submitButtonProps.*`.

У `SubmitButton` появился стабильный атрибут `data-state={state}` (`enabled` / `disabled` / `loading` / `cancelable`) — удобно для state-specific CSS, в том числе градиентов. У custom footer content добавлен `min-width: 0`.

Отдельно на корне `PromptInput`:

```ts
/** Called whenever PromptInput changes its internal value. */
onValueChange?: (value: string) => void;
```

Вызывается на принятых изменениях ввода, встроенных suggestions, вставке newline и очистке после submit. Именно его `ChatContainer` использует для mascot `reading` / activity.

```tsx
import { ChatContainer } from "@gravity-ui/aikit";

<ChatContainer
  messages={messages}
  onSendMessage={handleSend}
  promptInputProps={{
    view: "full",
    footerProps: {
      className: "console-prompt-footer",
      contentClassName: "console-prompt-footer__content",
      buttonSize: "l",
      submitButtonProps: {
        className: "console-submit",
        tooltipSend: "Отправить",
        qa: "console-send",
      },
    },
  }}
/>;
```

## EmptyContainer: публичные layout CSS variables и `heroContent`

В theme (`src/themes/common.css` / `variables.css`) и SCSS компонента:

```css
.g-root {
  --g-aikit-empty-container-content-justify-content: center; /* default: flex-start */
  --g-aikit-empty-container-suggestions-max-width: 640px; /* default: none */
  --g-aikit-empty-container-suggestions-flex: 0 1 auto; /* default: 1 1 auto */
  --g-aikit-empty-container-suggestions-align-self: center; /* default: stretch */
}
```

DOM-структура и прежние defaults сохранены — меняется только то, что раньше требовало лезть во внутренние классы.

Плюс публичный prop `heroContent?: React.ReactNode`: если задан, рендерится вместо `image` в `hero-container`. `alignment.hero` управляет выравниванием и fallback'ится на `alignment.image`. Через `ChatContainer.mascotConfig` hero-маскот попадает именно сюда.

## Header: `actionsOrder` и `actionSize`

```ts
export enum HeaderActionGroup {
  Menu = "menu",
  Additional = "additional",
}

export type HeaderActionsOrder = Partial<
  Record<"left" | "right", readonly (HeaderAction | HeaderActionGroup)[]>
>;

export type HeaderProps = {
  // ...
  actionsPlacement?: HeaderActionsPlacement; // side per action/group
  actionsOrder?: HeaderActionsOrder;
  actionSize?: ButtonButtonProps["size"]; // default 'm'
};
```

Поведение из README/PR:

- `actionsPlacement` выбирает сторону для action/group; `actionsOrder` меняет порядок **доступных** групп на этой стороне;
- пропущенные entries дописываются в backward-compatible порядке: additional → menu → built-in;
- дубликаты и недоступные entries игнорируются;
- `actionSize` — default size для built-in, menu и configured additional buttons; явный `size` на отдельном additional action сохраняется; custom React nodes в `additionalActions` не трогаются.

```tsx
import { Header, HeaderAction, HeaderActionGroup } from "@gravity-ui/aikit";

<Header
  baseActions={[HeaderAction.NewChat, HeaderAction.History]}
  menuItems={menuItems}
  additionalActions={additionalActions}
  actionsOrder={{
    right: [
      HeaderAction.History,
      HeaderActionGroup.Menu,
      HeaderActionGroup.Additional,
      HeaderAction.NewChat,
    ],
  }}
  actionSize="l"
/>;
```

Через `ChatContainer` то же самое уходит в `headerProps.actionsOrder` / `headerProps.actionSize`.

## Совместимость

По PR #221 существующие API и default rendering не ломаются:

- без `mascotConfig` маскот не появляется;
- legacy submit-button shortcut props (`submitButtonTooltipSend` и т.д.) работают;
- defaults `EmptyContainer` / `Header` / footer sizes сохранены;
- цель релиза — убрать необходимость таргетить внутренние `.g-aikit-*` для Console-дизайна.

Установка:

```bash
npm install @gravity-ui/aikit@2.16.0
```

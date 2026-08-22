---
author: Артём Нецветаев
pubDatetime: 2026-08-22T19:01:00.000Z
title: "@gravity-ui/aikit 2.17.0: мобильный режим ChatContainer и nonce для CSP в MDX"
slug: gravity-ui-aikit-v2-17-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
  - chat
  - aikit
description: "Разбор минорного релиза @gravity-ui/aikit v2.17.0: механизм isMobile в ChatContainer (PR #224), мобильная адаптивность компонентов чата через useMobileControlSize и CSS-переменные (PR #226), nonce для CSP в MarkdownRenderer/MDX и shimmer у Loader (PR #227)."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.17.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.17.0). Основная тема — полноценный мобильный режим `ChatContainer`: сначала проп-механизм `isMobile` ([PR #224](https://github.com/gravity-ui/aikit/pull/224)), затем конкретная адаптивность списка подсказок, prompt-инпута и шапки ([PR #226](https://github.com/gravity-ui/aikit/pull/226)). Отдельно для серверов со strict CSP в `MarkdownRenderer` появилась поддержка `nonce`, а заодно у `Loader`/`MessageList` — shimmer у сообщения загрузки ([PR #227](https://github.com/gravity-ui/aikit/pull/227)).

Источники: GitHub Release [`gravity-ui/aikit@v2.17.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.17.0), compare [`v2.16.0...v2.17.0`](https://github.com/gravity-ui/aikit/compare/v2.16.0...v2.17.0), [PR #224](https://github.com/gravity-ui/aikit/pull/224), [PR #226](https://github.com/gravity-ui/aikit/pull/226), [PR #227](https://github.com/gravity-ui/aikit/pull/227). Это обычный changelog-релиз, а не указатель на отдельный официальный анонс.

## ChatContainer: механизм `isMobile` (PR #224)

Это механизм-подложка без визуальных изменений: он вводит сам канал, по которому внутренние компоненты узнают о мобильном режиме.

Новый prop на `ChatContainer`:

```ts
type ChatContainerProps = {
  // ...
  /**
   * Enables mobile mode for the chat and all inner components.
   * When omitted, falls back to the `useMobile()` value from the
   * `@gravity-ui/uikit` `MobileProvider` context.
   */
  isMobile?: boolean;
};
```

Поведение из diff/README:

- разрешённое значение прокидывается всем внутренним компонентам (`Header`, `ChatContent`/`MessageList`, `PromptInput`, `History`) через uikit `MobileProvider`, чтобы они читали его через `useMobile()` — то есть доступно и через «родной» контекст uikit;
- на корневом элементе появляется модификатор `_mobile` — хук для будущих мобильных стилей (типографика и XL-контролы, обработка экранной клавиатуры пришли в следующем PR #226);
- если `isMobile` не задан, значение берётся из `useMobile()` той же библиотеки.

Практический вывод: приложение, уже обёрнутое в `MobileProvider`, автоматически подхватит мобильную отрисовку при обновлении на минорную версию — без каких-либо правок.

## Мобильная адаптивность компонентов чата (PR #226)

PR #226 включает мобильные дефолты, но только во время активного мобильного режима; десктопная отрисовка не меняется.

### `Suggestions`

В мобильном режиме включены по умолчанию: размер `XL`, view `normal`, перенос текста и правая стрелка-«шеврон». Опция `icon: 'none'` отключает иконку. `layout` без явного значения на мобильном резолвится в `list`.

### Размеры контролов через `useMobileControlSize`

`PromptInput` (обе view) и кнопки `PromptInputFooter`/`AttachmentPicker` (включая submit) резолвят размер через новый общий хук `useMobileControlSize`: на мобильном — `xl`, на десктопе — прежние дефолты. Размер иконок следует за резолвшенным размером кнопки (`16`/`20`). Тот же принцип у `Header`: действия в мобильном режиме `m` → `xl`, размер иконки следует за `actionSize`. `Disclaimer` на мобильном по умолчанию рендерится во `body-2`.

### Типографика и CSS-переменные

Внутри чата типографика идёт через выделенные переменные `--g-aikit-chat-container-font-size` / `--g-aikit-chat-container-line-height` (16px/24px только внутри самого чата; uikit-tokens не трогаются). Модификатор `ChatContainer` `_mobile` даёт отступы под мобильный дизайн: базовый padding 16px, заголовок 8/12px, мобильные padding/gap для welcome-экрана.

Новые публичные CSS-переменные, объявленные в темах:

```css
.g-root {
  --g-aikit-chat-container-mobile-font-size: var(--g-spacing-6);
  --g-aikit-chat-container-mobile-line-height: var(--g-spacing-6);
  --g-aikit-chat-container-mobile-padding: 16px;
  --g-aikit-chat-container-mobile-empty-container-padding: ...;
  --g-aikit-empty-container-mobile-padding: ...;
  --g-aikit-empty-container-mobile-content-gap: ...;
  --g-aikit-empty-container-mobile-welcome-gap: ...;
  /* --g-aikit-chat-container-mobile-font-size/line-height по умолчанию равны --g-spacing-6 */
}
```

Важная правка поведения: `layout`/`wrapText` из `emptyContainerProps` больше не затираются undefined-значениями `welcomeConfig` — раньше неуказанные значения могли перезаписывать явно заданные.

### Как это ложится на потребителя

- приложение уже в `MobileProvider` — мобильный рендер включается автоматически;
- отключить или перенастроить можно per-prop: `layout`, `wrapText`, `icon: 'none'`, явные размеры;
- standalone-импорты отдельных компонентов получают мобильные размеры контролов, но отступы/типографика уровня чата применяются только внутри мобильного режима самого `ChatContainer`;
- overlay-порталы (History-popup, dropdown'ы) сохраняют корневую типографику.

Пример с явным включением мобильного режима:

```tsx
import { ChatContainer } from "@gravity-ui/aikit";

<ChatContainer
  messages={messages}
  status={status}
  onSendMessage={handleSend}
  isMobile={isMobileViewport} // либо полагаться на MobileProvider
/>;
```

## MarkdownRenderer: nonce для CSP (PR #227)

Раньше скомпилированные MDX-артефакты исполнялись через `eval`/`new Function` — это несовместимо с CSP, где управляется `script-src` по nonce. Теперь у `MarkdownRendererMdxOptions` появился prop:

```ts
export interface MarkdownRendererMdxOptions {
  components: MDXComponents;
  /** Optional list of tag names to limit which components are processed as MDX. */
  tagNames?: string[];
  /** CSP nonce applied to scripts that execute compiled MDX artifacts. */
  nonce?: string;
}
```

Как это работает (diff `MarkdownRenderer.tsx`, `MdxPortals.tsx`, новый `asyncExecuteCode.ts`):

- если задан `nonce`, MDX-артефакты исполняются через инлайн-`<script>` с атрибутом `nonce` вместо `eval`/`new Function` — новый `asyncExecuteCode` кладёт временный скрипт в `document.head` (если браузер заблокировал скрипт из-за CSP, генерируется ошибка `Failed to execute MDX script...`);
- `nonce` пробрасывается в `MdxPortals`, который через loader передаёт его в `useMdx`;
- если `nonce` опущен, сохраняется обратная совместимость — прежний путь исполнения через `new Function`.

```tsx
import { MarkdownRenderer } from "@gravity-ui/aikit";

<MarkdownRenderer
  content={content}
  mdxOptions={{
    components: { Callout },
    tagNames: ["Callout"],
    nonce: cspNonce, // обязательно, если сервер форсирует nonce-based script-src CSP
  }}
/>;
```

Тот же PR добавляет shimmer-анимацию у загрузки: `Loader` получил `withMessageShimmer?: boolean`, а `MessageList`/`MessageListFooter` — `withLoaderShimmer?: boolean` (default `false`), которое прокидывается в `Loader` при показе `loaderMessage`.

## Совместимость

Ни одно из существующих API не ломается:

- всё мобильное поведение включается только в мобильном режиме; без `MobileProvider`/`isMobile` десктопная отрисовка не меняется;
- `isMobile` опционален и fallback'ится на контекст;
- `nonce` в MDX опционален — патч сохраняет legacy `new Function` путь;
- новые CSS-переменные мобильного режима — дефолты, не затрагивающие прежние значения.

Установка:

```bash
npm install @gravity-ui/aikit@2.17.0
```

---
author: Артём Нецветаев
pubDatetime: 2026-08-03T14:03:54.000Z
title: "@gravity-ui/aikit 2.15.0: MDX-компоненты в MarkdownRenderer и exclusive-типы header у PromptInput"
slug: gravity-ui-aikit-v2-15-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
  - markdown
  - mdx
description: "Разбор минорного релиза @gravity-ui/aikit v2.15.0: MarkdownRenderer получил mdxOptions/mdxContext/extraProps и прокидку через ChatContainer.mdxProps, а PromptInputHeaderConfig стал взаимоисключающим для topContent и context-props."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.15.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.15.0). Главная feature — встроенный MDX/JSX в `MarkdownRenderer` через `@diplodoc/mdx-extension`, плюс `extraProps` на корневой контейнер и сгруппированный `mdxProps` на `MessageList` / `ChatContainer`. Отдельный bugfix приводит типы header у `PromptInput` к exclusive-union: `topContent` больше нельзя смешивать с `contextItems`.

Источники: GitHub Release [`gravity-ui/aikit@v2.15.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.15.0), compare [`v2.14.0...v2.15.0`](https://github.com/gravity-ui/aikit/compare/v2.14.0...v2.15.0), [PR #219](https://github.com/gravity-ui/aikit/pull/219) / commit [`9a96b5e`](https://github.com/gravity-ui/aikit/commit/9a96b5ea8ca99b61a7599cd73736c30e305d947c) и [PR #218](https://github.com/gravity-ui/aikit/pull/218) / commit [`71c301d`](https://github.com/gravity-ui/aikit/commit/71c301dc1d1c8651adc9890277b59cf2b6ffb8fc). Это обычный changelog-релиз, а не указатель на отдельный официальный анонс.

## MarkdownRenderer: MDX-плагин, context и extraProps

В `package.json` появилась зависимость [`@diplodoc/mdx-extension`](https://www.npmjs.com/package/@diplodoc/mdx-extension) `^1.10.1`. Сам рендер markdown по-прежнему идёт через `@diplodoc/transform`, но при передаче `mdxOptions` в пайплайн добавляется `mdxPlugin`, а React-компоненты гидрируются порталами поверх `dangerouslySetInnerHTML`.

Новые поля `MarkdownRendererProps`:

```tsx
export interface MarkdownRendererMdxOptions {
  /** Map of components rendered from embedded MDX/JSX in the markdown content. */
  components: MDXComponents;
  /** Optional list of tag names to limit which components are processed as MDX. */
  tagNames?: string[];
}

export interface MarkdownRendererProps {
  content: string;
  // ...
  mdxOptions?: MarkdownRendererMdxOptions;
  mdxContext?: Record<string, unknown>;
  /** Extra props forwarded to the root container `div` element. */
  extraProps?: HTMLAttributes<HTMLDivElement>;
}
```

Передача `mdxOptions` включает MDX-режим. Пример из README компонента:

```tsx
import { MarkdownRenderer } from "@gravity-ui/aikit";

const Callout = ({
  title,
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}) => (
  <div className="callout">
    <b>{title}</b>
    <div>{children}</div>
  </div>
);

const content = `# Notes

<Callout title="Heads up">
This block is rendered by a **React component**.
</Callout>`;

<MarkdownRenderer
  content={content}
  mdxOptions={{
    components: { Callout },
    tagNames: ["Callout"],
  }}
/>;
```

Внутри `MarkdownRenderer` при `enableMdx` в `transformOptions.plugins` пушится `mdxPlugin({ tagNames })` (или без опций, если `tagNames` не задан). HTML по-прежнему кладётся в корневой `div`, а рядом рендерится `MdxPortals`: он вызывает `useMdx` из `@diplodoc/mdx-extension`, подставляет `components` и оборачивает порталы в `MdxDataContext.Provider` со значением `mdxContext`.

### `useMdxContext` — данные конкретного сообщения

Карта `mdxOptions.components` общая, поэтому один и тот же React-компонент переиспользуется между сообщениями. Чтобы передать id, metadata или callback именно текущего сообщения, есть `mdxContext` и hook `useMdxContext<T>()` (экспортируется из пакета вместе с `MarkdownRenderer`):

```tsx
import { MarkdownRenderer, useMdxContext } from "@gravity-ui/aikit";

type MessageMdxContext = {
  messageId: string;
  onAction: (id: string) => void;
};

const ActionButton = ({ label }: { label?: string }) => {
  const ctx = useMdxContext<MessageMdxContext>();
  return (
    <button type="button" onClick={() => ctx?.onAction(ctx.messageId)}>
      {label}
    </button>
  );
};

<MarkdownRenderer
  content={'<ActionButton label="Run" />'}
  mdxOptions={{ components: { ActionButton } }}
  mdxContext={{ messageId: message.id, onAction } satisfies MessageMdxContext}
/>;
```

Каждый инстанс `MarkdownRenderer` даёт свой provider, поэтому context естественно scoped per message.

### Streaming и `useMarkdownTransform`

`useMarkdownTransform` больше не возвращает голую строку HTML. Контракт:

```ts
export interface MarkdownTransformResult {
  html: string;
  mdxArtifacts?: MdxArtifacts;
}

export function useMarkdownTransform(
  content: string,
  options?: OptionsType,
  enableMdx = false
): MarkdownTransformResult;
```

При `enableMdx === true` блок-кэш стриминга отключается: MDX-компонент может пересекать несколько markdown-блоков, а артефакты нужно собрать из всего документа. Трансформ идёт одним full-content pass; при ошибке hook отдаёт последний успешный результат или `{ html: '' }`.

`memo` у `MarkdownRenderer` сравнивает ещё `mdxOptions.components`, `mdxOptions.tagNames`, `mdxContext` и `extraProps` по ссылке.

### Прокидка через MessageList и ChatContainer

На уровне чата API сгруппировано в `mdxProps`:

```tsx
export type MdxProps<TContent extends TMessageContent = never> = {
  mdxOptions?: MarkdownRendererMdxOptions;
  getMarkdownExtraProps?: (
    message: TChatMessage<TContent, TMessageMetadata>
  ) => HTMLAttributes<HTMLDivElement> | undefined;
  getMdxContext?: (
    message: TChatMessage<TContent, TMessageMetadata>
  ) => Record<string, unknown> | undefined;
};
```

`MessageList` и `ChatContainer` принимают `mdxProps?: MdxProps`. `MessageItem` резолвит `getMdxContext(message)` / `getMarkdownExtraProps(message)` и передаёт вниз в `AssistantMessage`, `UserMessage` и `ThinkingMessage` как `mdxOptions`, `mdxContext`, `markdownExtraProps`. Дефолтный message registry кладёт их в `MarkdownRenderer` как `mdxOptions`, `mdxContext`, `extraProps`.

Типичный вход через контейнер:

```tsx
import { ChatContainer, useMdxContext } from "@gravity-ui/aikit";

type MessageMdxContext = {
  messageId: string;
  onAction: (id: string) => void;
};

const ActionButton = ({ label }: { label?: string }) => {
  const ctx = useMdxContext<MessageMdxContext>();
  return (
    <button type="button" onClick={() => ctx?.onAction(ctx.messageId)}>
      {label}
    </button>
  );
};

const onAction = (id: string) => {
  /* ... */
};

<ChatContainer
  messages={messages}
  mdxProps={{
    mdxOptions: { components: { ActionButton }, tagNames: ["ActionButton"] },
    getMdxContext: message => ({ messageId: message.id, onAction }),
    getMarkdownExtraProps: message => ({
      "data-message-id": message.id,
      role: "button",
      onClick: () => console.log("clicked", message.id),
    }),
  }}
/>;
```

`extraProps` на самом `MarkdownRenderer` — это обычные `HTMLAttributes<HTMLDivElement>`: `onClick`, `data-*`, `role`, `title` и т.п. на корневом контейнере с YFM-HTML. Через `getMarkdownExtraProps` тот же контракт доступен per message.

В том же PR #219 у `Loader` появился опциональный `withMessageShimmer?: boolean`: при наличии `message` текст оборачивается в `Shimmer`. На changelog-уровне это не выделено отдельной feature-строкой, но публичный prop компонента изменился.

## PromptInput: exclusive-типы header (fix types)

PR #218 чинит типы «right suggest logic» у header: custom-контент и default layout больше нельзя описать одновременно так, будто оба режима валидны.

`PromptInputHeaderProps` стал discriminated union:

```ts
type PromptInputHeaderDefaultProps = {
  contextItems?: ContextItemConfig[];
  showContextIndicator?: boolean;
  contextIndicatorProps?: ContextIndicatorProps;
  children?: never;
};

type PromptInputHeaderCustomProps = {
  children?: ReactNode;
  contextItems?: never;
  showContextIndicator?: never;
  contextIndicatorProps?: never;
};

export type PromptInputHeaderProps = {
  className?: string;
  qa?: string;
} & (PromptInputHeaderDefaultProps | PromptInputHeaderCustomProps);
```

Аналогично `PromptInputHeaderConfig` у `PromptInput`: либо `topContent` (полностью заменяет default header), либо `contextItems` / `showContextIndicator` / `contextIndicatorProps` — но не оба набора сразу. Поля противоположной ветки типизированы как `never`.

Рантайм приведён к тем же правилам:

- `PromptInputFull` рендерит либо `<PromptInputHeader qa={...}>{topContent}</PromptInputHeader>`, либо default-header с context-props — без одновременной передачи `children` и `contextItems`.
- `ChatContainer.buildFinalPromptInputHeaderProps`: если есть `headerProps.topContent`, наружу уходит только `{ topContent, qa }`; иначе собираются `contextItems`, `showContextIndicator`, `contextIndicatorProps` и `qa`.
- `AIStudioChat` при наличии `topContent` больше не подмешивает studio-`contextItems` в тот же объект.

Для TypeScript-потребителей это breaking на уровне типов, если раньше одновременно передавали `topContent` и `contextItems`: такой код перестанет компилироваться. Рантайм-поведение с одним режимом header не меняется — меняется запрет смешения.

Установка версии:

```bash
npm install @gravity-ui/aikit@2.15.0
```

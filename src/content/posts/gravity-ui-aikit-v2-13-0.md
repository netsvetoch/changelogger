---
author: Артём Нецветаев
pubDatetime: 2026-07-24T15:35:51.000Z
title: "@gravity-ui/aikit 2.13.0: аргументы function call и контекст подсказок"
slug: gravity-ui-aikit-v2-13-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
  - openai
description: "Разбор минорного релиза @gravity-ui/aikit v2.13.0: OpenAI Responses-адаптер передаёт JSON-аргументы function_call в mcpRequest, а SuggestionsItem, Suggestions, PromptInput и ChatContainer сохраняют id и data выбранной подсказки."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.13.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.13.0). В нём две связанные с интеграцией возможности: адаптер OpenAI Responses показывает аргументы вызова функции, а UI-подсказки передают контекст выбранного варианта по всей цепочке клика.

Источники: GitHub Release [`gravity-ui/aikit@v2.13.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.13.0), compare [`v2.12.0...v2.13.0`](https://github.com/gravity-ui/aikit/compare/v2.12.0...v2.13.0), [PR #210](https://github.com/gravity-ui/aikit/pull/210) / commit [`d7a8bf0`](https://github.com/gravity-ui/aikit/commit/d7a8bf09614361e2d8951b75493a45b2d41edfeb) и [PR #212](https://github.com/gravity-ui/aikit/pull/212) / commit [`e263a87`](https://github.com/gravity-ui/aikit/commit/e263a87fc64f33d5961868e9ae7af30a4c011c6f). Это обычный changelog-релиз, а не ссылка на отдельный официальный анонс.

## У завершённого `function_call` появились аргументы

В `src/adapters/openai/helpers/getStreamEventContentUpdate.ts` обработчик `response.output_item.done` для элемента `function_call` по-прежнему формирует `tool_update` с `item_id`, статусом, именем функции, `output`/`result` и `error`. В версии 2.13.0 он дополнительно читает строковое поле `arguments`, пропускает его через `prettyPrintJson` и, если результат есть, записывает в `mcpRequest`:

```ts
const mcpRequest = prettyPrintJson(
  typeof fn.arguments === "string" ? fn.arguments : undefined
);

return {
  kind: "tool_update",
  item_id: fnCallId,
  status: fnStatus,
  toolName: typeof fn.name === "string" ? fn.name : undefined,
  output,
  ...(mcpRequest ? { mcpRequest } : {}),
};
```

Это поле уже входит в тип `ToolMessageContentData` как `mcpRequest?: string`. Поэтому потребитель, который рендерит tool-карточки из обновлений потока, может вывести форматированный JSON входных данных рядом с результатом вызова. Ранее у такого обновления были только имя, состояние, вывод и ошибка: для отображения параметров нужно было отдельно хранить исходный event.

Изменение касается именно `function_call` в OpenAI Responses stream. Оно не меняет формат `output`: если сервер присылает `output`, берётся он; если нет — строковый `result`; иначе поле отсутствует.

## `SuggestionsItem.data` проходит через обработчики

Тип `SuggestionsItem` получил необязательное поле контекста, а сигнатура обработчика клика стала трёхаргументной:

```ts
export type SuggestionsItem = {
  id?: string;
  title: string;
  data?: Record<string, unknown>;
  onClick?: SuggestionClickHandler;
};

export type SuggestionClickHandler = (
  content: string,
  id?: string,
  data?: Record<string, unknown>
) => void | Promise<void>;
```

Компонент `Suggestions` вызывает сначала item-level callback, затем общий callback — в обоих случаях с `title`, `id` и тем же объектом `data`:

```ts
const handleClick = async (item: SuggestionsItem) => {
  await item.onClick?.(item.title, item.id, item.data);
  await onClick(item.title, item.id, item.data);
};
```

Таким образом, приложение может дать нескольким кнопкам один текст, но различить намерение пользователя стабильным `id` или payload. Асинхронный порядок сохраняется: общий обработчик начнётся только после завершения обработчика конкретного пункта.

Например, в `PromptInput` собственный `onSuggestionClick` теперь получает контекст выбранной подсказки, а не только её текст:

```tsx
<PromptInput
  onSend={sendMessage}
  suggestionsProps={{
    suggestions: [
      {
        id: "summarize-release",
        title: "Сделай краткое резюме",
        data: { source: "starter", template: "short" },
      },
    ],
    onSuggestionClick: (content, id, data) => {
      track("prompt_suggestion_click", { content, id, data });
    },
  }}
/>
```

Если `onSuggestionClick` в `PromptInput` не задан, прежнее поведение остаётся: компонент просто подставляет `content` в поле ввода. Если callback задан, он сам определяет дальнейшее действие; `PromptInput` передаёт ему все три значения.

## `ChatContainer` добавляет контекст в отправку welcome-подсказки

Для подсказок на welcome-экране `ChatContainer` теперь переносит данные в `TSubmitData.suggestion`:

```ts
export type TSubmitData = {
  content: string;
  attachments?: File[];
  metadata?: Record<string, unknown>;
  suggestion?: {
    id?: string;
    data?: Record<string, unknown>;
  };
};
```

При клике `ChatContainer` создаёт `suggestion` только если есть хотя бы `id` или `data`, после чего вызывает `onSendMessage`:

```ts
await onSendMessage({
  content,
  ...(suggestion && { suggestion }),
});
```

Поэтому обработчик отправки может привязать сообщение к стартовому сценарию без разбора текста кнопки:

```tsx
<ChatContainer
  messages={[]}
  welcomeConfig={{
    suggestions: [
      {
        id: "billing-help",
        title: "Помоги с оплатой",
        data: { category: "billing", entrypoint: "welcome" },
      },
    ],
  }}
  onSendMessage={({ content, suggestion }) => {
    return sendMessage(content, { suggestion });
  }}
/>
```

У существующих подсказок миграции нет: `id` и `data` оба опциональны. Если их не добавить, `TSubmitData` выглядит как раньше и поле `suggestion` не передаётся.

Установка версии:

```bash
npm install @gravity-ui/aikit@2.13.0
```

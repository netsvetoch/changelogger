---
author: Артём Нецветаев
pubDatetime: 2026-07-21T09:05:24.000Z
title: "@gravity-ui/aikit 2.12.0: обработчик клика у отдельной подсказки"
slug: gravity-ui-aikit-v2-12-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
description: "Разбор минорного релиза @gravity-ui/aikit v2.12.0: SuggestionsItem получил необязательный async-совместимый onClick, который вызывается до общего обработчика Suggestions и отправки текста подсказки в ChatContainer."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.12.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.12.0). В нём одна feature: у каждой отдельной подсказки типа `SuggestionsItem` появился собственный обработчик `onClick`.

Источники — GitHub Release [`gravity-ui/aikit@v2.12.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.12.0), compare [`v2.11.0...v2.12.0`](https://github.com/gravity-ui/aikit/compare/v2.11.0...v2.12.0), [PR #208](https://github.com/gravity-ui/aikit/pull/208) и merge commit [`d8173b5`](https://github.com/gravity-ui/aikit/commit/d8173b52891a17dc912ff0e9721b1a612c3fa0fd). Это обычный changelog-релиз, а не указатель на отдельный официальный анонс.

## `SuggestionsItem.onClick` выполняется до общего обработчика

В `SuggestionsItem` добавлен необязательный prop:

```ts
onClick?: (content: string, id?: string) => void | Promise<void>;
```

Раньше при клике `Suggestions` сразу вызывал свой общий `onClick(item.title, item.id)`. Теперь обработчик компонента стал асинхронным и выполняет два шага в строгом порядке:

```ts
await item.onClick?.(item.title, item.id);
await onClick(item.title, item.id);
```

То есть callback конкретной подсказки получает её `title` как `content` и необязательный `id`; если он возвращает `Promise`, общий обработчик дождётся его завершения. Без нового поля последовательность и аргументы старого общего `onClick` не меняются.

## Зачем это нужно в `ChatContainer`

`ChatContainer` использует `SuggestionsItem` в `welcomeConfig.suggestions`: раньше нажатие на кнопку отправляло её `title` как текст сообщения через компонентный обработчик. Теперь до этой отправки можно выполнить действие, относящееся только к выбранному варианту — например, записать метрику с идентификатором подсказки:

```tsx
import { ChatContainer } from "@gravity-ui/aikit";

<ChatContainer
  messages={[]}
  welcomeConfig={{
    suggestions: [
      {
        id: "explain-cloud",
        title: "Объясни Yandex Cloud",
        onClick: (content, id) => {
          sendMetric("welcome_suggestion_click", { content, id });
        },
      },
    ],
  }}
  onSendMessage={sendMessage}
/>;
```

После вызова `sendMetric` стандартная логика всё равно передаст `"Объясни Yandex Cloud"` в `onSendMessage`. Это подтверждает добавленная в релизе story и визуальный тест: после клика тест одновременно проверяет результат item-level callback (`Suggestion content:suggestion-1`) и отправленный текст (`Suggestion content`).

## Что учитывать при обновлении

Новый prop не обязателен, поэтому существующие массивы `suggestions` не требуют миграции. Он полезен, когда общий `onClick` отвечает за одинаковое действие для всего списка (в частности, за отправку сообщения), а приложению нужно дополнительное действие только для некоторых подсказок.

Поскольку компонент ждёт `item.onClick`, в callback допустима асинхронная работа: например, сохранить событие или подготовить состояние перед отправкой. В таком случае отправка текста начнётся только после успешного завершения callback; если он завершится с ошибкой, следующий общий обработчик не будет вызван.

Установка версии:

```bash
npm install @gravity-ui/aikit@2.12.0
```

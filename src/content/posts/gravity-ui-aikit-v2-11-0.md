---
author: Артём Нецветаев
pubDatetime: 2026-07-13T09:28:57.000Z
title: "@gravity-ui/aikit 2.11.0: markdown-ссылки можно открывать в новой вкладке"
slug: gravity-ui-aikit-v2-11-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
description: "Разбор минорного релиза @gravity-ui/aikit v2.11.0: MarkdownRenderer получил openLinksInNewTab, а ChatContainer, AssistantMessage и UserMessage — openMarkdownLinksInNewTab с исключением для якорей текущего документа."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.11.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.11.0). Единственная feature в нём — управляемое открытие markdown-ссылок в новой вкладке.

Источник — GitHub Release [`gravity-ui/aikit@v2.11.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.11.0), compare [`v2.10.0...v2.11.0`](https://github.com/gravity-ui/aikit/compare/v2.10.0...v2.11.0), [PR #200](https://github.com/gravity-ui/aikit/pull/200) и merge commit [`ae2068c`](https://github.com/gravity-ui/aikit/commit/ae2068c7c82b5e16f93e42ac50afdbe6d0abfabe). Это обычный changelog-релиз без ссылки на официальный announcement или блог-пост.

## Новый prop у `MarkdownRenderer`

Компонент `MarkdownRenderer` получил опциональный `openLinksInNewTab?: boolean`. По умолчанию он равен `false`, поэтому существующее поведение не меняется. При включении prop компонент добавляет к подходящим ссылкам атрибуты `target="_blank"` и `rel="noopener noreferrer"`:

```tsx
import { MarkdownRenderer } from "@gravity-ui/aikit";

<MarkdownRenderer
  content={"Документация: [gravity-ui.com](https://gravity-ui.com)"}
  openLinksInNewTab
/>;
```

Реализация добавляет в `transformOptions.plugins` собственный markdown-it-плагин. Он перехватывает правило `link_open`, поэтому настройка работает именно на этапе генерации HTML и не требует вручную постобрабатывать результат рендера.

## Якоря текущего документа остаются обычными ссылками

Опция не превращает в ссылки для новой вкладки якоря, которые должны прокручивать текущую страницу. Изменение явно исключает:

- hash-only URL вроде `#local-section`;
- относительные URL с hash, если origin, pathname и query совпадают с текущим документом.

Такой URL считается якорем текущего документа и не получает ни `target`, ни `rel`:

```md
[К разделу ниже](#local-section)

[К тому же разделу](/guide?lang=ru#local-section)
```

Если путь или query отличаются, ссылка уже считается переходом и открывается в новой вкладке. То же касается внешних `http`/`https`-ссылок, `mailto:` и `tel:` — для них при включённой опции выставляются оба атрибута. Тесты релиза отдельно проверяют внешний URL, локальный hash, тот же документ с другим query и ссылки электронной почты/телефона.

## Настройка на уровне сообщений и чата

Чтобы не передавать prop каждому `MarkdownRenderer`, релиз прокинул ту же настройку через компоненты сообщений:

- `AssistantMessage` получил `openMarkdownLinksInNewTab?: boolean`;
- `UserMessage` получил `openMarkdownLinksInNewTab?: boolean` и передаёт его в markdown-рендерер при `format="markdown"`;
- `ChatContainer` получил `openMarkdownLinksInNewTab?: boolean` и передаёт его в стандартные message renderers;
- `MessageListConfig` исключает этот prop из переопределяемых настроек, потому что параметр задаётся на уровне `ChatContainer`.

Пример для готового чата:

```tsx
import { ChatContainer } from "@gravity-ui/aikit";

<ChatContainer
  messages={messages}
  onSendMessage={sendMessage}
  openMarkdownLinksInNewTab
/>;
```

Для `AssistantMessage` настройка действует на markdown, который обрабатывают стандартные renderers:

```tsx
import { AssistantMessage } from "@gravity-ui/aikit";

<AssistantMessage
  content="Ответ с [ссылкой на документацию](https://gravity-ui.com)"
  openMarkdownLinksInNewTab
/>;
```

В `ChatContainer` добавлена также story `WithMarkdownLinksInNewTab` и визуальные проверки: внешняя ссылка получает `target="_blank"` и `rel="noopener noreferrer"`, а `[local section](#local-section)` сохраняет стандартное поведение. При выключенной опции тесты подтверждают, что даже внешние markdown-ссылки не получают новых атрибутов.

## Обратная совместимость

Релиз не добавляет обязательных props: без `openLinksInNewTab` и `openMarkdownLinksInNewTab` рендеринг остаётся прежним. Обновление полезно приложениям, где ответы ассистента содержат ссылки на документацию или внешний ресурс и их не следует уводить из текущего чата. Для внутренних ссылок с hash-навигацией включение опции не ломает переходы по секциям.

Установка версии остаётся обычной:

```bash
npm install @gravity-ui/aikit@2.11.0
```

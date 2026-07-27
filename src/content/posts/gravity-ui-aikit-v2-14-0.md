---
author: Артём Нецветаев
pubDatetime: 2026-07-27T11:52:17.000Z
title: "@gravity-ui/aikit 2.14.0: tooltip для обрезанных названий чатов и перенос кода в markdown-таблицах"
slug: gravity-ui-aikit-v2-14-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
  - markdown
description: "Разбор минорного релиза @gravity-ui/aikit v2.14.0: History показывает Tooltip только для обрезанной подписи чата, а MarkdownRenderer переносит длинные токены и inline code внутри ячеек таблиц."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.14.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.14.0). В нём две видимые правки интерфейса: список истории раскрывает в tooltip только действительно обрезанный заголовок чата, а markdown-таблицы больше не разъезжаются из-за длинных слов и идентификаторов в обратных кавычках.

Источники: GitHub Release [`gravity-ui/aikit@v2.14.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.14.0), compare [`v2.13.0...v2.14.0`](https://github.com/gravity-ui/aikit/compare/v2.13.0...v2.14.0), [PR #215](https://github.com/gravity-ui/aikit/pull/215) / commit [`3ee7dfb`](https://github.com/gravity-ui/aikit/commit/3ee7dfb2e54f947524c8ce99c990e25c03d8b7f0) и [PR #216](https://github.com/gravity-ui/aikit/pull/216) / commit [`7f65982`](https://github.com/gravity-ui/aikit/commit/7f6598255d60a38fc91f93d1e88aaf050d83769e). Это обычный changelog-релиз, а не ссылка на отдельный официальный анонс.

## History: полный текст — только у обрезанного пункта

В `History` компонент `ChatItem` по-прежнему выводит подпись из `chat.lastMessage || chat.name`, но теперь сохраняет ссылку на текстовый элемент и после изменения этой строки сравнивает его фактическую ширину с доступной:

```tsx
const label = labelRef.current;
setHasOverflow(Boolean(label && label.scrollWidth > label.clientWidth));
```

Если `scrollWidth` больше `clientWidth`, подпись оборачивается в `Tooltip` из `@gravity-ui/uikit` с тем же текстом и `openDelay={300}`. Если строка помещается, `Tooltip` вообще не создаётся. Таким образом, короткие имена чатов не получают лишний hover-слой, а у строки с ellipsis пользователь может прочитать целиком именно `lastMessage` — или `name`, когда последнего сообщения нет.

```tsx
{
  hasOverflow ? (
    <Tooltip content={chatLabel} openDelay={300}>
      {label}
    </Tooltip>
  ) : (
    label
  );
}
```

Публичные props `History` и формат объекта чата в этом изменении не менялись. Визуальные тесты PR отдельно проверяют оба случая: tooltip появляется при переполнении и отсутствует у подписи нормальной длины.

## MarkdownRenderer переносит длинные токены и inline code в таблицах

До 2.14.0 ячейка markdown-таблицы могла расширяться из-за длинного неразрывного токена. Отдельная проблема была с inline code: CSS `@diplodoc/transform` задаёт для `.yfm table code` значение `white-space: nowrap`, поэтому длинный идентификатор в обратных кавычках мог выйти в соседнюю колонку.

В `MarkdownRenderer.scss` для заголовков и ячеек таблицы добавлены `min-width: 0`, `word-break: break-word` и `overflow-wrap: anywhere`. Для `code` внутри `td` и `th` библиотека переопределяет запрет переноса:

```scss
table td code,
table th code {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
```

`overflow-wrap: anywhere` разрешает разрывать длинный токен при нехватке ширины и уменьшает минимальную ширину содержимого. При этом у `td` сохраняется ограничение `max-width: var(--g-aikit-markdown-renderer-table-cell-max-width)`: длинный текст, URL, строка JSON и inline code должны переноситься в пределах ячейки, а не заставлять таблицу стать шире сообщения.

Например, теперь в таблице может переноситься и обычный длинный токен, и значение в обратных кавычках:

```md
| Field      | Value                                                      |
| ---------- | ---------------------------------------------------------- |
| Token      | super-long-unbroken-token-without-any-spaces-in-the-middle |
| Member ref | `anna-morgan-member-reference-verification-east-01`        |
```

Горизонтальная прокрутка не удалена: обёртка `__table-wrap` из `@diplodoc/transform` по-прежнему использует `overflow-x: auto`, когда сама таблица шире сообщения. Изменение устраняет переполнение тех значений, которые можно корректно перенести внутри ячейки; тест обновлён с ожидания горизонтальной прокрутки длинной ячейки на ожидание переноса.

Установка версии:

```bash
npm install @gravity-ui/aikit@2.14.0
```

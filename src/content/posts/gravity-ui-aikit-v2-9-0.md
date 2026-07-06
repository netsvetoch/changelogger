---
author: Артём Нецветаев
pubDatetime: 2026-07-06T09:13:19.000Z
title: "@gravity-ui/aikit 2.9.0: прокрутка длинного списка suggestions в EmptyContainer"
slug: gravity-ui-aikit-v2-9-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
description: "Разбор минорного релиза @gravity-ui/aikit v2.9.0: EmptyContainer получил отдельную scrollable-зону для списка suggestions, а welcome-блок, заголовок списка и show more остаются на месте."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.9.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.9.0). В нём один пользовательский change для шаблона `EmptyContainer`: когда подсказок больше, чем помещается в доступную высоту, прокручивается только список `suggestions`, а не весь пустой экран.

Источник для обзора — GitHub Release [`gravity-ui/aikit@v2.9.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.9.0), compare [`v2.8.0...v2.9.0`](https://github.com/gravity-ui/aikit/compare/v2.8.0...v2.9.0), PR [`#198`](https://github.com/gravity-ui/aikit/pull/198) и merge commit [`7b335b7`](https://github.com/gravity-ui/aikit/commit/7b335b71e8503e5a11b7ec8c6d979f42485c67ab). Release body не является указателем на официальный блог-пост: это обычный changelog с одной feature-записью.

## Что изменилось в разметке

В `src/components/templates/EmptyContainer/EmptyContainer.tsx` список подсказок больше не рендерится внутри безымянного `div`. Контейнер получил BEM-класс `suggestions-list`:

```tsx
<div className={b("suggestions-list")}>
  <Suggestions items={suggestions} onClick={onSuggestionClick} />
</div>
```

Публичные props `EmptyContainer` при этом не менялись: в diff нет новых полей в типах компонента. Обновление меняет поведение уже существующих `suggestions`, `suggestionTitle`, `onSuggestionClick` и блока `show more` за счёт CSS-структуры.

## Прокручивается только список подсказок

Основная логика находится в `EmptyContainer.scss`. Корневой контейнер теперь получает `min-height: 0` и `overflow: hidden`, а внутренние flex-области — явные правила, которые не дают им растягивать весь layout:

```scss
.g-aikit-empty-container {
  min-height: 0;
  overflow: hidden;

  &__content {
    min-height: 0;
  }

  &__welcome-section {
    flex-shrink: 0;
  }

  &__suggestions-section {
    flex: 1 1 auto;
    min-height: 0;
  }

  &__suggestions-title {
    flex-shrink: 0;
  }

  &__suggestions-list {
    flex: 1 1 auto;
    min-height: 70px;
    overflow-y: auto;
  }

  &__show-more {
    flex-shrink: 0;
  }
}
```

Комментарий в самом diff формулирует ожидаемое поведение прямо: scroll происходит внутри `suggestions-list`, а welcome section, заголовок suggestions и кнопка `show more` остаются зафиксированными на своих местах.

## Когда это заметно

До `2.9.0` длинный список подсказок мог съедать доступную высоту `EmptyContainer`: вместе с ним уезжали приветственный блок, заголовок списка или область с `show more`. Теперь шаблон лучше подходит для компактных chat-shell, drawer и side-panel сценариев, где empty state живёт в ограниченном по высоте контейнере.

Минимальный пример не требует новых props — достаточно передать больше подсказок, чем помещается в блок:

```tsx
import { EmptyContainer } from "@gravity-ui/aikit";

const suggestions = [
  { id: "1", title: "What can the AI assistant help with?" },
  { id: "2", title: "Analyze the page and give recommendations" },
  { id: "3", title: "Help configure permissions in IAM" },
  { id: "4", title: "Analyze my expenses for the month" },
  { id: "5", title: "Create a virtual machine" },
  { id: "6", title: "Analyze the infrastructure in the current folder" },
  { id: "7", title: "Check the security of my infrastructure" },
];

export function AssistantEmptyState() {
  return (
    <div style={{ width: 420, height: 440 }}>
      <EmptyContainer
        title="AI assistant"
        description="Helps with your everyday tasks in the cloud"
        suggestionTitle="Don't know where to start from? Try this:"
        suggestions={suggestions}
        onSuggestionClick={(content, id) => {
          console.log("Suggestion clicked:", content, id);
        }}
      />
    </div>
  );
}
```

В PR этот сценарий закрепили отдельной Storybook-историей `ScrollableSuggestions`: она использует контейнер `ContentWrapper` размером `420px × 440px` и массив из десяти suggestions. В визуальных тестах добавлен кейс `should render scrollable suggestions`, плюс обновлены snapshots для существующих вариантов `EmptyContainer`.

## Что проверить при обновлении

Релиз выглядит обратно совместимым: новых обязательных props нет, обработчик `onSuggestionClick` и формат элементов `suggestions` не менялись. При переходе на `@gravity-ui/aikit@2.9.0` стоит проверить только визуальные места, где `EmptyContainer` используется внутри контейнеров с фиксированной или ограниченной высотой:

- список подсказок должен прокручиваться внутри empty state, а не растягивать родительский layout;
- welcome-блок с картинкой, `title` и `description` должен оставаться видимым;
- `suggestionTitle` и кнопка `show more`, если она используется, не должны уезжать вместе со списком.

Установка версии остаётся обычной:

```bash
npm install @gravity-ui/aikit@2.9.0
```

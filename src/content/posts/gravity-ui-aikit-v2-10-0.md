---
author: Артём Нецветаев
pubDatetime: 2026-07-13T09:25:00.000Z
title: "@gravity-ui/aikit 2.10.0: длинные подсказки PromptInput теперь переносятся"
slug: gravity-ui-aikit-v2-10-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
description: "Разбор минорного релиза @gravity-ui/aikit v2.10.0: PromptInputWithSuggestions теперь передаёт wrapText в Suggestions, поэтому длинные тексты подсказок переносятся вместо обрезки, а всплывающие tooltip отключаются."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.10.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.10.0). В нём одна пользовательская feature: `PromptInputWithSuggestions` теперь включает перенос текста для отображаемых suggestions.

Источник — GitHub Release [`gravity-ui/aikit@v2.10.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.10.0), compare [`v2.9.3...v2.10.0`](https://github.com/gravity-ui/aikit/compare/v2.9.3...v2.10.0), PR [#205](https://github.com/gravity-ui/aikit/pull/205) и merge commit [`ae785cd`](https://github.com/gravity-ui/aikit/commit/ae785cd6c6ccd8f2337de3a04525e661c4d89264). Release body — обычный changelog без ссылки на официальный announcement или блог-пост.

## `PromptInputWithSuggestions` включает `wrapText`

Изменение находится в `src/components/organisms/PromptInput/PromptInputWithSuggestions.tsx`. Когда `PromptInputWithSuggestions` показывает suggestions, он теперь передаёт в дочерний компонент `Suggestions` фиксированный prop `wrapText`:

```tsx
<Suggestions
  items={suggestions}
  onClick={onSuggestionClick || (() => {})}
  title={suggestTitle}
  layout={suggestionsLayout}
  textAlign={suggestionsTextAlign}
  wrapText
/>
```

Ранее этот prop не передавался, поэтому `Suggestions` использовал значение по умолчанию `wrapText = false`. Сам `Suggestions` по-прежнему принимает `wrapText?: boolean`; релиз меняет дефолтное поведение только в сценарии `PromptInputWithSuggestions`, а не во всех отдельных использованиях `Suggestions`.

## Что увидит пользователь

В реализации `Suggestions` prop `wrapText` выбирает класс `button-text-wrap` вместо обычного `button-text`, так что заголовок suggestion может занимать несколько строк, а не обрезается многоточием. Одновременно `tooltipTitle` получает значение `undefined`, поэтому tooltip с полным текстом элемента не показывается: текст теперь должен быть виден непосредственно на кнопке.

Это важно для prompt-подсказок, которые часто являются полноценными фразами, а не короткими ярлыками. Например, компонент можно использовать без новых props у обёртки:

```tsx
import { PromptInputWithSuggestions } from "@gravity-ui/aikit";

<PromptInputWithSuggestions
  suggestionsProps={{
    showSuggestions: true,
    suggestions: [
      {
        id: "analyze",
        title: "Analyze the current dashboard and explain the unusual metrics",
      },
      {
        id: "summarize",
        title: "Summarize the latest incidents and suggest the next steps",
      },
    ],
    suggestTitle: "Try asking:",
    onSuggestionClick: (content, id) => {
      console.log("Selected suggestion:", id, content);
    },
  }}
>
  <PromptInput />
</PromptInputWithSuggestions>;
```

Длинные `title` из массива `suggestions` теперь переносятся внутри кнопок автоматически. Обработчик клика и формат элементов не менялись: callback всё так же получает `content` и необязательный `id`.

## Изменения для прямого использования `Suggestions`

Публичный API `Suggestions` уже содержит `wrapText?: boolean` со значением по умолчанию `false`. Если компонент используется напрямую и нужно такое же поведение, prop можно включить явно:

```tsx
<Suggestions
  items={[
    {
      id: "1",
      title:
        "This is a long suggestion that should remain readable on a narrow screen",
    },
  ]}
  wrapText
  onClick={(content, id) => {
    console.log(content, id);
  }}
/>
```

В таком режиме tooltip для элемента отключён. Для коротких suggestions ничего менять не нужно: прямые вызовы `Suggestions` без `wrapText` сохраняют прежнюю обрезку текста и tooltip при наведении.

## Обратная совместимость

Релиз не добавляет обязательных props и не меняет сигнатуру `onSuggestionClick`. При обновлении стоит проверить интерфейс мест, где `PromptInputWithSuggestions` используется в узком контейнере: кнопки с длинными фразами могут стать выше из-за переноса текста, а подсказка при наведении больше не будет дублировать полный текст.

Установка версии остаётся обычной:

```bash
npm install @gravity-ui/aikit@2.10.0
```

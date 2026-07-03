---
author: Артём Нецветаев
pubDatetime: 2026-07-03T08:55:32.000Z
title: "@gravity-ui/aikit 2.8.0: ref к textarea в PromptInput без DOM-селекторов"
slug: gravity-ui-aikit-v2-8-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
description: "Разбор минорного релиза @gravity-ui/aikit v2.8.0: PromptInputBodyConfig получил inputRef, а PromptInput full/simple начали передавать его в ref внутреннего PromptInputBody."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.8.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.8.0). В релизе один пользовательский change: `PromptInput` теперь даёт типизированный доступ к textarea через `bodyProps.inputRef`.

Источник для обзора — GitHub Release [`gravity-ui/aikit@v2.8.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.8.0), compare [`v2.7.0...v2.8.0`](https://github.com/gravity-ui/aikit/compare/v2.7.0...v2.8.0), PR [`#195`](https://github.com/gravity-ui/aikit/pull/195) и merge commit [`940b83e`](https://github.com/gravity-ui/aikit/commit/940b83ecc56990ede78484f16e44d17f6e86f9b0). Release body не является указателем на официальный блог-пост: это обычный changelog с одной feature-записью.

## Новый prop: `bodyProps.inputRef`

Публичное изменение находится в `src/components/organisms/PromptInput/types.ts`. Тип `PromptInputBodyConfig` теперь импортирует `type Ref` из React и содержит новое поле:

```ts
import { ReactNode, type Ref } from "react";

export type PromptInputBodyConfig = {
  /** QA/test identifier for body wrapper */
  qa?: string;
  /** Ref to the textarea input */
  inputRef?: Ref<HTMLTextAreaElement>;
  /** Placeholder text for textarea */
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  autoFocus?: boolean;
  autoFocusOnNewChat?: boolean;
  autoFocusOnChatSelect?: boolean;
};
```

В changelog формулировка звучит как «expose textarea control ref», а в финальном diff prop называется именно `inputRef`. Это важно для миграций: искать `controlRef` в опубликованном API `2.8.0` не нужно — в README и типах релиза закреплён `inputRef?: Ref<HTMLTextAreaElement>`.

## Ref прокинут в обе версии PromptInput

До `2.8.0` `PromptInputBody` уже умел принимать React `ref`, но высокоуровневый `PromptInput` не давал передать этот ref через `bodyProps`. В PR это исправили для двух view-компонентов:

- `PromptInputFull.tsx` достаёт `inputRef` из `bodyProps` и передаёт его как `ref={inputRef}` в `PromptInputBody`;
- `PromptInputSimple.tsx` делает то же самое для простого варианта `view="simple"`;
- `PromptInput/README.md` добавляет строку `inputRef | Ref<HTMLTextAreaElement> | - | - | Ref to the textarea input` в таблицу `PromptInputBodyConfig`.

Фрагмент из `PromptInputFull` после изменения выглядит так:

```tsx
const {
  placeholder = "Plan, code, build and test anything",
  minRows = 1,
  maxRows = 15,
  autoFocus = false,
  inputRef,
  qa: bodyQa,
} = bodyProps;

<PromptInputBody
  value={value}
  placeholder={placeholder}
  minRows={minRows}
  maxRows={maxRows}
  autoFocus={autoFocus}
  ref={inputRef}
  onChange={handleChange}
  onKeyDown={handleKeyDown}
  inputClassName={b("textarea")}
  qa={bodyQa}
/>;
```

`PromptInputSimple` получил такой же `ref={inputRef}`, только без `inputClassName={b("textarea")}` — остальная логика ввода, `onChange`, `onKeyDown`, `autoFocus`, `minRows` и `maxRows` остаётся прежней.

## Практический сценарий: фокус после открытия внешней панели

Мотивация PR — приложения, где чат открывается внутри внешнего focus-managed shell: drawer, modal или похожей панели. Раньше у потребителей оставались `autoFocus`, `autoFocusOnNewChat` и `autoFocusOnChatSelect`, но они не покрывали жизненный цикл «drawer закончил transition, теперь можно сфокусировать prompt». В таких случаях приходилось искать textarea через QA/DOM-селекторы.

Теперь ref можно хранить в приложении и фокусировать поле ввода в нужный момент:

```tsx
import { useEffect, useRef } from "react";
import { PromptInput } from "@gravity-ui/aikit";

export function AssistantPrompt({ drawerOpen }: { drawerOpen: boolean }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (drawerOpen) {
      textareaRef.current?.focus();
    }
  }, [drawerOpen]);

  return (
    <PromptInput
      view="full"
      onSend={async ({ content }) => {
        await sendMessage(content);
      }}
      bodyProps={{
        inputRef: textareaRef,
        placeholder: "Напишите запрос ассистенту",
      }}
    />
  );
}
```

Это не отменяет `autoFocus`: если достаточно сфокусировать textarea сразу при mount, старый prop остаётся рабочим. `inputRef` нужен именно там, где момент фокуса определяется внешним состоянием приложения, а не самим `PromptInput`.

## Что проверить при обновлении

Релиз выглядит обратно совместимым: новый `inputRef` опционален, а существующие `bodyProps.placeholder`, `minRows`, `maxRows`, `autoFocus`, `qa`, `autoFocusOnNewChat` и `autoFocusOnChatSelect` не меняли контракт. При переходе на `@gravity-ui/aikit@2.8.0` стоит проверить три вещи:

- если в приложении уже были DOM-запросы к textarea `PromptInput` через QA-селекторы, их можно заменить на типизированный `bodyProps.inputRef`;
- если есть собственная обёртка над `PromptInput`, пробросьте `inputRef` дальше в `bodyProps`, иначе внешний код по-прежнему не увидит textarea;
- если в коде ориентировались на раннюю формулировку из PR про `controlRef`, используйте фактическое имя из релиза — `inputRef`.

Установка версии остаётся обычной:

```bash
npm install @gravity-ui/aikit@2.8.0
```

---
author: Артём Нецветаев
pubDatetime: 2026-06-28T22:32:21.000Z
title: "@gravity-ui/components 4.22.0: уведомления без обязательного content"
slug: gravity-ui-components-v4-22-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
description: "Разбор минорного релиза @gravity-ui/components v4.22.0: NotificationProps.content стал опциональным, а Notification больше не рендерит пустую content-обёртку для title-only уведомлений."
---

Gravity UI выпустила минорный релиз [`@gravity-ui/components v4.22.0`](https://github.com/gravity-ui/components/releases/tag/v4.22.0). В release body есть один пункт, но он меняет публичный контракт `Notification`: поле `content` в `NotificationProps` больше не обязательно.

Источник для обзора — GitHub Release [`gravity-ui/components@v4.22.0`](https://github.com/gravity-ui/components/releases/tag/v4.22.0), compare [`v4.21.0...v4.22.0`](https://github.com/gravity-ui/components/compare/v4.21.0...v4.22.0), PR [`#395`](https://github.com/gravity-ui/components/pull/395) и merge commit [`a0965d1`](https://github.com/gravity-ui/components/commit/a0965d15e260f1fb8e4714643fa854a7b5516ff7).

## `NotificationProps.content` стал опциональным

До `v4.22.0` тип `NotificationProps` требовал `content` для каждого уведомления:

```ts
export type NotificationProps = {
  id: string;
  content:
    | React.ReactNode
    | ((props: {
        wrapperRef?: React.RefObject<HTMLDivElement | null>;
      }) => React.ReactNode);
};
```

В [`src/components/Notification/definitions.ts`](https://github.com/gravity-ui/components/blob/a0965d15e260f1fb8e4714643fa854a7b5516ff7/src/components/Notification/definitions.ts) это поле изменено на `content?`. Состав значения не поменялся: если контент есть, он по-прежнему может быть обычным `React.ReactNode` или функцией, которая получает `{wrapperRef}` и возвращает `React.ReactNode`. Изменился именно признак обязательности.

Практический эффект: уведомления, где достаточно заголовка, источника, даты, темы или swipe actions, больше не требуют искусственный пустой `content` ради TypeScript.

```tsx
import type { NotificationProps } from "@gravity-ui/components";

const notification: NotificationProps = {
  id: "only-title",
  source: {
    title: "Yandex",
    icon: svgYandexStoryIcon,
    href: "https://example.com",
  },
  theme: "info",
  title: "You hired!",
  formattedDate: "12 seconds ago",
  swipeActions,
};
```

Этот сценарий не придуман в статье: такой `only-title` объект добавлен в story mock data в [`src/components/Notifications/__stories__/mockData.tsx`](https://github.com/gravity-ui/components/blob/a0965d15e260f1fb8e4714643fa854a7b5516ff7/src/components/Notifications/__stories__/mockData.tsx). Он показывает целевой кейс релиза — уведомление с `source`, `theme`, `title`, `formattedDate` и `swipeActions`, но без `content`.

## Рендер теперь пропускает content-обёртку, если контента нет

Изменение не ограничилось типом. В [`src/components/Notification/Notification.tsx`](https://github.com/gravity-ui/components/blob/a0965d15e260f1fb8e4714643fa854a7b5516ff7/src/components/Notification/Notification.tsx) блок рендера контента теперь сначала проверяет наличие `content`:

```tsx
let renderedContent;
if (content) {
  const node =
    typeof content === "function" ? content({ wrapperRef }) : content;
  renderedContent = (
    <div className={b("content-wrapper")}>
      <div className={b("content")}>{node}</div>
    </div>
  );
}
```

Раньше компонент всегда попадал в одну из двух веток: если `content` был функцией, он вызывался с `{wrapperRef}`, иначе значение рендерилось внутри `content-wrapper`/`content`. После релиза при отсутствующем `content` `renderedContent` остаётся пустым, поэтому DOM не получает лишнюю обёртку под несуществующее тело уведомления.

Для существующего кода миграция не нужна: варианты с `content={<span />}` и `content={({wrapperRef}) => ...}` продолжают работать. Новое поведение важно для дизайн-системных уведомлений, где заголовок сам является основным сообщением, а дополнительный текст не нужен.

## Что проверить после обновления

- Если в проекте есть локальные типы или фабрики уведомлений, которые сами объявляют `content` обязательным, их можно синхронизировать с `NotificationProps` и разрешить title-only объекты.
- Если раньше для коротких уведомлений передавали `content: null`, `content: ""` или пустой фрагмент только ради типа, проверьте, можно ли убрать это поле совсем.
- Если CSS или тесты завязаны на наличие `.content-wrapper` у каждого `Notification`, обновите ожидания: в `v4.22.0` эта обёртка появляется только при непустом `content`.

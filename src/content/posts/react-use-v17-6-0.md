---
author: Артём Нецветаев
pubDatetime: 2026-06-28T18:48:18.000Z
title: "react-use 17.6.0: onChange для useWindowSize и новый формат options"
slug: react-use-v17-6-0
featured: false
draft: false
tags:
  - release
  - react-use
  - react
  - hooks
description: "Обзор минорного релиза react-use v17.6.0: useWindowSize получил callback onChange, а параметры initialWidth и initialHeight теперь передаются через объект options."
---

`react-use` выпустил минорную версию [`v17.6.0`](https://github.com/streamich/react-use/releases/tag/v17.6.0). В release notes указан один пользовательский пункт, но он важен для всех, кто использует `useWindowSize`: хук получил callback `onChange`, а сигнатура перешла с двух позиционных аргументов на объект `options`.

Источник для обзора — GitHub Release [`streamich/react-use@v17.6.0`](https://github.com/streamich/react-use/releases/tag/v17.6.0), PR [#2608](https://github.com/streamich/react-use/pull/2608), issue [#915](https://github.com/streamich/react-use/issues/915) и compare [`v17.5.1...v17.6.0`](https://github.com/streamich/react-use/compare/v17.5.1...v17.6.0).

## Что изменилось в useWindowSize

До этого релиза `useWindowSize` принимал начальные значения для SSR/небраузерного окружения позиционно:

```tsx
const { width, height } = useWindowSize(1024, 768);
```

В `v17.6.0` реализация в `src/useWindowSize.ts` изменила сигнатуру на объект:

```ts
interface Options {
  initialWidth?: number;
  initialHeight?: number;
  onChange?: (width: number, height: number) => void;
}
```

Теперь начальные значения передаются так:

```tsx
import { useWindowSize } from "react-use";

export function LayoutProbe() {
  const { width, height } = useWindowSize({
    initialWidth: 1024,
    initialHeight: 768,
  });

  return (
    <span>
      {width}×{height}
    </span>
  );
}
```

Это стоит проверить при обновлении: в тестах самого проекта старый helper `getHook(1, 1)` был заменён на `getHook({ initialWidth: 1, initialHeight: 1 })`. То есть код, который передавал два числа напрямую, нужно переписать на объект `options`.

## Новый callback onChange

Главное добавление — `onChange?: (width: number, height: number) => void`. Хук по-прежнему возвращает текущее состояние `{ width, height }`, но теперь можно выполнить побочную логику непосредственно в обработчике `resize`.

Минимальный пример:

```tsx
import { useWindowSize } from "react-use";

export function ResizeAnalytics() {
  const size = useWindowSize({
    onChange(width, height) {
      console.log("window resized", { width, height });
    },
  });

  return (
    <div>
      {size.width}×{size.height}
    </div>
  );
}
```

По diff видно точное поведение: обработчик берёт `window.innerWidth` и `window.innerHeight`, обновляет состояние через `useRafState`, а затем вызывает `onChange(width, height)`, если callback передан. В тесте `should call onChange callback on window resize` callback ожидаемо получает пары `(720, 480)` и `(1920, 1080)` после программного изменения размеров окна.

## Зачем это нужно

Issue [#915](https://github.com/streamich/react-use/issues/915) просил «trigger a callback when the size is updated». Такой callback полезен, когда изменения размера окна нужно не только отрисовать в React, но и отправить в отдельный слой:

- записать событие в analytics/debug-лог;
- синхронизировать layout state с внешним store;
- обновить imperative API, который не живёт внутри JSX;
- отладить resize-сценарии в Storybook.

Последний сценарий появился и в самом PR: story `stories/useWindowSize.story.tsx` подключила `@storybook/addon-actions` и передаёт `onChange: action("window resize")`, чтобы resize-события попадали в панель Actions.

## Миграция

Если вы использовали `useWindowSize()` без аргументов, менять код не обязательно:

```tsx
const { width, height } = useWindowSize();
```

Если передавали initial width/height позиционно, перепишите вызов:

```tsx
// Было до 17.6.0
const size = useWindowSize(1024, 768);

// Стало в 17.6.0
const size = useWindowSize({
  initialWidth: 1024,
  initialHeight: 768,
});
```

Если вам нужен callback на resize, добавьте `onChange` в тот же объект:

```tsx
const size = useWindowSize({
  initialWidth: 1024,
  initialHeight: 768,
  onChange: (width, height) => {
    reportViewport({ width, height });
  },
});
```

## Как обновиться

```bash
pnpm add react-use@17.6.0
```

Или через npm:

```bash
npm install react-use@17.6.0
```

После обновления стоит запустить TypeScript и тесты в местах, где используется `useWindowSize`. Особенно проверьте вызовы с двумя числовыми аргументами: новый documented reference в `docs/useWindowSize.md` теперь описывает `useWindowSize(options)`, а не позиционные параметры.

## Ссылки

- [Release v17.6.0](https://github.com/streamich/react-use/releases/tag/v17.6.0)
- [Compare v17.5.1...v17.6.0](https://github.com/streamich/react-use/compare/v17.5.1...v17.6.0)
- [PR #2608: feat: add onChange callback to useWindowSize](https://github.com/streamich/react-use/pull/2608)
- [Issue #915: useWindowSize callback](https://github.com/streamich/react-use/issues/915)

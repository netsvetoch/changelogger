---
author: Артём Нецветаев
pubDatetime: 2026-06-28T18:00:35.000Z
title: "React 19.2.0: Activity, useEffectEvent и частичный prerender"
slug: react-v19-2-0
featured: false
draft: false
tags:
  - release
  - react
  - react-dom
description: "Обзор минорного релиза React 19.2.0: новый Activity API, useEffectEvent, cacheSignal для RSC, resume/prerender API в React DOM и изменения eslint-plugin-react-hooks 6.1.0."
---

React выпустил минорный релиз [`19.2.0`](https://github.com/react/react/releases/tag/v19.2.0). Это не «косметический» апдейт: в стабильный канал попали `<Activity>`, `useEffectEvent`, `cacheSignal`, React Performance tracks и набор React DOM API для partial pre-rendering.

Источник для обзора — GitHub Release [`react@v19.2.0`](https://github.com/react/react/releases/tag/v19.2.0), официальный [release post React 19.2](https://react.dev/blog/2025/10/01/react-19-2) и связанные PR из `react/react`: [#33557](https://github.com/facebook/react/pull/33557) для `cacheSignal`, [#33475](https://github.com/facebook/react/pull/33475) для Web Streams в Node entry point, [#33027](https://github.com/facebook/react/pull/33027) для `progressiveChunkSize`, [#33422](https://github.com/facebook/react/pull/33422) для нового формата `useId` и [#32457](https://github.com/facebook/react/pull/32457) для flat config в `eslint-plugin-react-hooks`.

## `<Activity>` сохраняет UI, но отключает эффекты

Новый компонент [`<Activity>`](https://react.dev/reference/react/Activity) закрывает промежуток между «полностью размонтировать компонент» и «оставить его активным за кадром». API минимальный: `children` и `mode`, где `mode` может быть `"visible"` или `"hidden"`, а значение по умолчанию — `"visible"`.

```tsx
import { Activity, useState } from "react";

export function SettingsPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(value => !value)}>Настройки</button>

      <Activity mode={open ? "visible" : "hidden"}>
        <SettingsForm />
      </Activity>
    </>
  );
}
```

Когда Activity скрыта, React прячет subtree через `display: none`, очищает Effects внутри скрытого дерева и откладывает его обновления на более низкий приоритет. При возврате в `visible` состояние React восстанавливает сохранённое состояние компонента и DOM-состояние: например, введённый текст в `<textarea>`, scroll position или timecode медиаэлемента.

Практический эффект: табы, sidebars и экраны «назад/вперёд» можно не размонтировать ради сохранения состояния, но при этом не держать активными подписки, таймеры и сетевые эффекты скрытой части интерфейса. В документации отдельно отмечен caveat: если скрытая Activity возвращает только текст без DOM-элемента, React не сможет применить `display: none`, поэтому скрытый текст не попадёт в DOM.

## `useEffectEvent`: логика события внутри Effect без лишней пересинхронизации

[`useEffectEvent`](https://react.dev/reference/react/useEffectEvent) нужен для кода, который запускается из Effect, но должен читать самые свежие props/state без добавления этих значений в dependency array самого Effect. Классический пример — подключение к комнате чата: смена темы уведомления не должна переподключать websocket.

```tsx
import { useEffect, useEffectEvent } from "react";

function ChatRoom({ roomId, theme }: { roomId: string; theme: string }) {
  const onConnected = useEffectEvent(() => {
    showNotification("Connected!", theme);
  });

  useEffect(() => {
    const connection = createConnection(roomId);
    connection.on("connected", onConnected);
    connection.connect();

    return () => connection.disconnect();
  }, [roomId]);
}
```

Здесь `roomId` остаётся реактивной зависимостью Effect, а `theme` читается внутри Effect Event и не заставляет соединение пересоздаваться. Важное ограничение: Effect Events — не универсальная замена зависимостей. Их нельзя использовать как обычные event handlers, передавать в другие компоненты или вызывать во время render; обновлённый `eslint-plugin-react-hooks` проверяет эти ограничения.

## `cacheSignal` сообщает, что lifetime `cache()` завершён

Для React Server Components появился [`cacheSignal`](https://react.dev/reference/react/cacheSignal). PR [#33557](https://github.com/facebook/react/pull/33557) добавляет экспорт `cacheSignal` рядом с `cache` в серверные entry points React и реализует его через `AbortController` на уровне request cache.

```tsx
import { cache, cacheSignal } from "react";

const dedupedFetch = cache(fetch);

export async function Product({ id }: { id: string }) {
  const response = await dedupedFetch(`/api/products/${id}`, {
    signal: cacheSignal(),
  });

  return <ProductView data={await response.json()} />;
}
```

Сигнал abort'ится, когда React успешно завершил render, render был прерван или render упал с fatal error. В тестах PR проверяется два важных поведения: `cacheSignal()` возвращает `null` вне render scope, а signal внутри Flight render abort'ится как при нормальном завершении, так и при abort внешнего `AbortController`.

Это полезно не только для `fetch`. В серверном коде можно не логировать ошибку, если она вызвана ожидаемой отменой работы:

```ts
import { cacheSignal } from "react";

async function getData(id: string) {
  try {
    return await queryDatabase(id);
  } catch (error) {
    if (!cacheSignal()?.aborted) {
      logError(error);
    }
    return null;
  }
}
```

На клиенте текущая реализация возвращает `null` при включённом `disableClientCache`, но API уже экспортируется, чтобы общий код для server/client не приходилось ветвить по импорту.

## React DOM получил resume API для partial pre-rendering

Самая крупная серверная часть релиза — новые API для продолжения prerender'а. `prerender` теперь возвращает не только `prelude`, но и `postponed`: непрозрачное JSON-serializable состояние, которое можно сохранить и передать в resume API.

Для окружений с Web Streams добавлены:

- [`resume`](https://react.dev/reference/react-dom/server/resume) из `react-dom/server` — продолжает prerender и возвращает `ReadableStream`;
- [`resumeAndPrerender`](https://react.dev/reference/react-dom/static/resumeAndPrerender) из `react-dom/static` — продолжает prerender и снова отдаёт статический результат `{prelude, postponed}`.

Для Node streams добавлены:

- [`resumeToPipeableStream`](https://react.dev/reference/react-dom/server/resumeToPipeableStream) из `react-dom/server`;
- `resumeAndPrerenderToNodeStream` из `react-dom/static`.

Минимальный поток для Web Streams выглядит так:

```tsx
import { prerender, resumeAndPrerender } from "react-dom/static";
import { resume } from "react-dom/server";

// Этап 1: заранее получить HTML-прелюдию и состояние отложенной части.
const { prelude, postponed } = await prerender(<App />, {
  bootstrapScripts: ["/main.js"],
  signal: prerenderAbortSignal,
});

await savePrelude(prelude);
await savePostponedState(postponed);

// Этап 2: на запросе продолжить render из сохранённого состояния.
const postponedState = await loadPostponedState();
const stream = await resume(<App />, postponedState);

return new Response(stream, {
  headers: { "content-type": "text/html" },
});
```

PR [#33475](https://github.com/facebook/react/pull/33475) дополнительно делает Web Streams доступными именно из Node entry point: `packages/react-dom/npm/server.node.js` начал экспортировать `renderToReadableStream` и `resume`, а `packages/react-dom/npm/static.node.js` — `prerender` и `resumeAndPrerender`. Внутри Node-реализации для Web Streams React создаёт `ReadableStream` с `type: "bytes"`, добавляет к нему `allReady` и поддерживает abort через `options.signal`.

## Suspense boundaries и `progressiveChunkSize`

В React DOM заметно изменилось поведение серверного reveal Suspense boundaries. Release notes говорят, что React DOM теперь batch'ит reveals Suspense boundaries, ближе к client-side rendering. На практике это особенно важно для анимаций reveal, в том числе для будущего `<ViewTransition>`.

Связанный PR [#33027](https://github.com/facebook/react/pull/33027) включает опцию `progressiveChunkSize`: серверный Fizz теперь считает размер завершённых сегментов через `byteLengthOfChunk`, накапливает `byteSize` у boundary и может «outline» большую Suspense boundary, чтобы сначала показать fallback, а тяжёлый HTML вставить позже скриптом. Значение можно поставить в `Infinity`, если нужно отключить такое разбиение и гарантировать отсутствие дополнительных скриптов.

## Node Web Streams теперь доступны без edge-only entry point

Отдельный пункт релиза — Node Web Streams для SSR API. До 19.2 `renderToReadableStream` и `prerender` в основном ассоциировались с Web Streams окружениями, а Node entry point делал ставку на pipeable streams. После [#33475](https://github.com/facebook/react/pull/33475) Node-обёртки экспортируют обе модели:

```ts
import { renderToReadableStream } from "react-dom/server";
import { prerender } from "react-dom/static";
```

Это упрощает фреймворкам единый код для Node.js и Web Streams runtime: можно работать с `ReadableStream`, `Response` и `pipeTo`, не переключаясь на `renderToPipeableStream` только из-за Node entry point.

## `useId` больше не генерирует двоеточия

Релиз меняет формат ID, которые генерирует `useId`. После серии изменений команда отказалась от `:` и финально перешла на underscore-формат в [#33422](https://github.com/facebook/react/pull/33422). В diff видно конкретную замену в `ReactFizzConfigDOM.makeId`:

```diff
- let id = '\u00AB' + idPrefix + 'R' + treeId;
+ let id = '_' + idPrefix + 'R_' + treeId;

- return id + '\u00BB';
+ return id + '_';
```

В тестах React DOM ожидаемые значения тоже стали `_R_0_`, `_R_0H1_`, `_custom-prefix-R_1_`. Мотивация из PR: старые `:` мешали использовать generated ID в CSS View Transition именах и селекторах, а underscore-формат уменьшает риск конфликтов без специальных Unicode-символов.

## eslint-plugin-react-hooks 6.1.0: flat config по умолчанию

В составе релиза отдельно отмечен `eslint-plugin-react-hooks@6.1.0`: версия `6.0.0` была ошибочно опубликована и затем deprecated/untagged, поэтому `6.1.0` — первый официальный major 6.x.

Главное breaking change из [#32457](https://github.com/facebook/react/pull/32457): `recommended` теперь указывает на flat config для ESLint 9+, а legacy rc-based конфиг переехал в `recommended-legacy`.

```diff
- extends: ["plugin:react-hooks/recommended"]
+ extends: ["plugin:react-hooks/recommended-legacy"]
```

Для нового flat config документация плагина показывает такой вариант:

```js
import * as reactHooks from "eslint-plugin-react-hooks";

export default [reactHooks.configs["recommended"]];
```

В этом же выпуске плагина добавлены проверки вокруг новых API: запрет `use` внутри `try/catch`, запрет вызова функций из `useEffectEvent` в произвольных closures, поддержка `React.useEffect` в `rules-of-hooks` и настройка `settings.react-hooks.additionalEffectHooks`, которую используют и `exhaustive-deps`, и `rules-of-hooks`.

## Обновляться стоит вместе с tooling

Для приложений на React 19.1 обновление до 19.2 даёт новые стабильные API без явных breaking changes в `react` и `react-dom`, но tooling лучше обновлять синхронно:

```bash
npm install react@19.2.0 react-dom@19.2.0
npm install -D eslint-plugin-react-hooks@6.1.0
```

Если проект использует `useId` в snapshot-тестах, SSR fixtures или селекторах, проверьте ожидаемые строки: формат с `:` больше не актуален. Если проект использует legacy `.eslintrc` и полагается на `plugin:react-hooks/recommended`, после обновления плагина нужно явно перейти на `recommended-legacy` или мигрировать ESLint-конфиг на flat config.

## Ссылки

- [GitHub Release `react@v19.2.0`](https://github.com/react/react/releases/tag/v19.2.0)
- [React 19.2 release post](https://react.dev/blog/2025/10/01/react-19-2)
- [`<Activity>` reference](https://react.dev/reference/react/Activity)
- [`useEffectEvent` reference](https://react.dev/reference/react/useEffectEvent)
- [`cacheSignal` reference](https://react.dev/reference/react/cacheSignal)
- [PR #33557: Expose cacheSignal() alongside cache()](https://github.com/facebook/react/pull/33557)
- [PR #33475: Add Web Streams to Fizz Node entry point](https://github.com/facebook/react/pull/33475)
- [PR #33027: Enable the progressiveChunkSize option](https://github.com/facebook/react/pull/33027)
- [PR #33422: Use underscore instead of « » for useId algorithm](https://github.com/facebook/react/pull/33422)
- [PR #32457: make flat config the recommended config](https://github.com/facebook/react/pull/32457)

---
author: Артём Нецветаев
pubDatetime: 2026-06-28T16:56:44.000Z
title: "@hey-api/openapi-ts 0.95.0: отдельные request-схемы для Zod и Valibot"
slug: hey-api-openapi-ts-0-95-0
featured: false
draft: false
tags:
  - release
  - hey-api
  - openapi
  - typescript
description: "Обзор минорного релиза @hey-api/openapi-ts 0.95.0: Zod и Valibot больше не генерируют composite Data-схемы по умолчанию, oRPC собирает input из отдельных слоёв, а типы beforeRequest и SSE стали стабильнее."
---

`@hey-api/openapi-ts` выпустил минорный релиз [`0.95.0`](https://github.com/hey-api/hey-api/releases/tag/%40hey-api/openapi-ts%400.95.0). Главная тема версии — изменение того, как плагины Zod и Valibot генерируют request-валидаторы: вместо одной composite-схемы `Data` теперь экспортируются отдельные схемы для тела, path-параметров, query и headers.

Источники для обзора — GitHub Release [`@hey-api/openapi-ts@0.95.0`](https://github.com/hey-api/hey-api/releases/tag/%40hey-api/openapi-ts%400.95.0), diff PR [#3671](https://github.com/hey-api/hey-api/pull/3671), [#3660](https://github.com/hey-api/hey-api/pull/3660) и [#3466](https://github.com/hey-api/hey-api/pull/3466). Релиз минорный, поэтому `featured: false`.

## Zod и Valibot: больше нет composite `Data`-схем по умолчанию

До `0.95.0` request-схема для операции собиралась в один экспорт: например `zDeletePetData` или `vDeletePetData`. Внутри такого объекта лежали слои запроса — `body`, `path`, `query`, иногда `headers`. Это было удобно для передачи всей структуры целиком, но неудобно, если нужен только один слой: приходилось доставать поля через `zData.shape.body` в Zod или `vData.entries.body` в Valibot.

В [#3671](https://github.com/hey-api/hey-api/pull/3671) документация `docs/openapi-ts/plugins/zod.md` и `docs/openapi-ts/plugins/valibot.md` была переписана под новую модель: «single request schema» заменена на «schema for every request layer». В snapshots видно конкретную форму экспорта. Вместо composite-схемы:

```ts
export const vCreatePostData = v.object({
  body: vCreatePostInput,
  path: v.optional(v.never()),
  query: v.optional(v.never()),
  headers: v.object({
    "X-Author-Id": v.string(),
  }),
});
```

генератор теперь отдаёт отдельные именованные схемы:

```ts
export const vCreatePostBody = vCreatePostInput;

export const vCreatePostHeaders = v.object({
  "X-Author-Id": v.string(),
});
```

Для Zod паттерн такой же. В документации вместо старого `zData` теперь показаны отдельные exports вроде:

```ts
const zDeletePetHeaders = z.object({
  api_key: z.string().optional(),
});

const zDeletePetPath = z.object({
  petId: z.number(),
});

const zDeletePetQuery = z.object({
  additionalMetadata: z.string(),
});
```

Практический эффект: если вам нужен только `body` или только `path`, больше не надо привязываться к внутренней форме composite-объекта. Это особенно заметно в интеграциях, где внешний фреймворк ждёт отдельную схему для input-слоя, а не объект со всеми возможными частями запроса.

## Как сохранить старую composite-схему для SDK-валидаторов

Изменение затрагивает пользователей, которые подключали Zod или Valibot как validator для SDK и ожидали прежний `Data` export. В release notes и в новой секции миграции `docs/openapi-ts/migrating.md` для `v0.95.0` указан совместимый путь: включить `requests.shouldExtract` у validator-плагина.

Для Zod:

```js
export default {
  input: "hey-api/backend",
  output: "src/client",
  plugins: [
    {
      name: "sdk",
      validator: "zod",
    },
    {
      name: "zod",
      requests: {
        shouldExtract: true,
      },
    },
  ],
};
```

Для Valibot меняется только имя плагина и значение `validator`:

```js
export default {
  input: "hey-api/backend",
  output: "src/client",
  plugins: [
    {
      name: "sdk",
      validator: "valibot",
    },
    {
      name: "valibot",
      requests: {
        shouldExtract: true,
      },
    },
  ],
};
```

В diff это не просто опция из changelog: в типах Zod/Valibot `requests` получил `shouldExtract`, а также вложенные настройки `body`, `headers`, `path` и `query`. В shared-код добавлен `requestValidatorLayers = ["body", "headers", "path", "query"]` и helper `resolveValidatorLayer()`, который собирает эффективные настройки слоя из defaults и overrides.

## oRPC теперь собирает input из отдельных слоёв

Из-за отказа от `*Data`-схем поменялась и генерация oRPC-контрактов. В документации `docs/openapi-ts/plugins/orpc.md` пример был заменён с импорта `vAddPetData` на `vAddPetBody`, а `.input()` теперь явно собирает объект нужной формы:

```ts
import { oc } from "@orpc/contract";
import * as v from "valibot";

import { vAddPetBody, vAddPetResponse } from "./valibot.gen";

const addPet = oc
  .route({
    method: "POST",
    path: "/pet",
    summary: "Add a new pet to the store.",
    tags: ["pet"],
  })
  .input(v.object({ body: vAddPetBody }))
  .output(vAddPetResponse);
```

Snapshots из PR показывают тот же принцип для более сложных операций:

```ts
export const updateUserRpc = oc
  .route({
    method: "PATCH",
    path: "/users/{userId}",
  })
  .input(v.object({ body: vUpdateUserBody, params: vUpdateUserPath }));

export const deleteUserRpc = oc
  .route({
    method: "DELETE",
    path: "/users/{userId}",
  })
  .input(
    v.object({
      headers: v.optional(vDeleteUserHeaders),
      params: vDeleteUserPath,
    })
  );
```

То есть oRPC больше не зависит от старого `vUpdateUserData`/`vDeleteUserData` и сам формирует input из конкретных request-слоёв.

## Для авторов плагинов: `plugin.getSymbol()` удалён

В этом же PR удалён internal API `plugin.getSymbol()`. В `packages/shared/src/plugins/shared/utils/instance.ts` метод убран из `PluginInstance`, а места использования в Zod/Valibot и клиентских генераторах переведены на `plugin.querySymbol()`.

Миграция простая: `querySymbol()` принимает те же аргументы и возвращает тот же результат. Если у вас есть кастомный плагин или внутренний hook, который искал сгенерированный символ, замените вызов напрямую:

```ts
// было
const symbol = plugin.getSymbol({
  category: "schema",
  resource: "operation",
  resourceId: operation.id,
  role: "data",
  tool: "zod",
});

// стало
const symbol = plugin.querySymbol({
  category: "schema",
  resource: "operation",
  resourceId: operation.id,
  role: "data",
  tool: "zod",
});
```

Для обычных пользователей SDK это изменение не должно требовать действий, но авторам расширений стоит проверить собственные плагины до обновления.

## `beforeRequest` больше не зависит от `strictFunctionTypes`

В [#3660](https://github.com/hey-api/hey-api/pull/3660) исправлена типизация generated clients для `@hey-api/client-axios`, `client-fetch`, `client-next`, `client-ky` и `client-angular`. Проблема была в том, что `request` — generic-функция, а внутренний `beforeRequest` принимал негeneric `RequestOptions`. В зависимости от `strictFunctionTypes` TypeScript мог либо считать локальный `@ts-expect-error` нужным, либо выдавать `TS2578: Unused '@ts-expect-error' directive` уже в сгенерированном клиенте.

В шаблонах `beforeRequest` теперь принимает generic-параметры и сохраняет inference request options:

```ts
const beforeRequest = async <
  TData = unknown,
  TResponseStyle extends "data" | "fields" = "fields",
  ThrowOnError extends boolean = boolean,
  Url extends string = string,
>(
  options: RequestOptions<TData, TResponseStyle, ThrowOnError, Url>
) => {
  const opts = {
    ..._config,
    ...options,
  };

  const resolvedOpts = opts as typeof opts &
    ResolvedRequestOptions<TResponseStyle, ThrowOnError, Url>;
  const url = buildUrl(resolvedOpts);

  return { opts: resolvedOpts, url };
};
```

Для пользователей это не новая runtime-фича, а снижение шума в типизации: сгенерированный клиент меньше зависит от конкретной настройки `strictFunctionTypes`, а лишние локальные `@ts-expect-error` в местах вызова `beforeRequest(options)` были удалены.

## SSE-события получили точнее типизированный `event.data`

Ещё один patch в релизе — [#3466](https://github.com/hey-api/hey-api/pull/3466). Он исправляет путь типов для SSE endpoints в SDK. До изменения callback `onSseEvent` получал `StreamEvent<unknown>`, потому что response type не протаскивался через generated `Options` на non-Nuxt пути.

Теперь type alias `Options` получил третий generic `TResponse`, который передаётся дальше в client options:

```ts
export type Options<
  TData extends TDataShape = TDataShape,
  ThrowOnError extends boolean = boolean,
  TResponse = unknown,
> = Options2<TData, ThrowOnError, TResponse> & {
  client?: Client;
};
```

Для SSE-операций generator подставляет response type операции. В snapshots это выглядит так:

```ts
export const eventSubscribe = <ThrowOnError extends boolean = false>(
  options?: Options<EventSubscribeData, ThrowOnError, EventSubscribeResponse>
) =>
  (options?.client ?? client).sse.get<
    EventSubscribeResponses,
    unknown,
    ThrowOnError
  >({
    url: "/event",
    ...options,
  });
```

Если вы используете SSE-клиенты, после обновления `event.data` в callback'ах должен быть ближе к фактическому response type endpoint'а, а не к `unknown`.

## Кому стоит обновиться

`0.95.0` стоит ставить проектам, которые генерируют Zod/Valibot validators и хотят работать с request-слоями напрямую: `body`, `headers`, `path`, `query`. Но перед обновлением проверьте места, где импортируются `zSomethingData` или `vSomethingData`: для большинства таких импортов нужно перейти на layer-specific exports или включить `requests.shouldExtract: true`.

Также релиз полезен пользователям generated clients, которые видели `TS2578` из-за `@ts-expect-error` в зависимости от `strictFunctionTypes`, и тем, кто генерирует SDK для SSE endpoints.

## Как обновиться

```bash
pnpm add @hey-api/openapi-ts@0.95.0
```

Или через npm:

```bash
npm install @hey-api/openapi-ts@0.95.0
```

После обновления стоит перегенерировать клиент и запустить typecheck. Особое внимание — импортам `*Data` из Zod/Valibot validators, oRPC-контрактам и кастомным плагинам, где мог использоваться `plugin.getSymbol()`.

## Ссылки

- [Release @hey-api/openapi-ts@0.95.0](https://github.com/hey-api/hey-api/releases/tag/%40hey-api/openapi-ts%400.95.0)
- [PR #3671: extract zod and validator schemas](https://github.com/hey-api/hey-api/pull/3671)
- [PR #3660: avoid strictFunctionTypes-dependent TS2578](https://github.com/hey-api/hey-api/pull/3660)
- [PR #3466: forward TResponse generic through SDK Options type for SSE endpoints](https://github.com/hey-api/hey-api/pull/3466)

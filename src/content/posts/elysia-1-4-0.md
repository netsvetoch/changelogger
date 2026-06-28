---
author: Артём Нецветаев
pubDatetime: 2026-06-28T20:58:46.000Z
title: "Elysia 1.4.0: Standard Schema, type soundness и новый macro API"
slug: elysia-1-4-0
featured: false
draft: false
tags:
  - release
  - elysia
  - javascript
description: "Обзор минорного релиза Elysia 1.4.0: поддержка Standard Schema и сторонних валидаторов, standalone schema для объединения нескольких схем, type soundness в lifecycle hooks, расширенные macro, автоматический HEAD для GET и миграционные изменения."
---

Elysia выпустила минорный релиз [`1.4.0`](https://github.com/elysiajs/elysia/releases/tag/1.4.0) с кодовым именем Supersymmetry. Главные темы выпуска — поддержка [Standard Schema](https://github.com/standard-schema/standard-schema) и более строгая типизация ответов из lifecycle hooks.

Источники для обзора — GitHub Release [`elysiajs/elysia@1.4.0`](https://github.com/elysiajs/elysia/releases/tag/1.4.0), официальный пост [Elysia 1.4 Supersymmetry](https://elysiajs.com/blog/elysia-14.html), compare [`1.3.21...1.4.0`](https://github.com/elysiajs/elysia/compare/1.3.21...1.4.0), тесты `test/standard-schema/*`, `test/types/lifecycle/soundness.ts`, `test/macro/macro.test.ts` и связанные изменения: [#861](https://github.com/elysiajs/elysia/issues/861), [#1389](https://github.com/elysiajs/elysia/pull/1389), коммиты [`0cc6c50`](https://github.com/elysiajs/elysia/commit/0cc6c507a0e45a8359834e4a8b7ecc8485fd1a89), [`7034649`](https://github.com/elysiajs/elysia/commit/7034649db75ee7883fe2df165b5895b078eddc87), [`823015c`](https://github.com/elysiajs/elysia/commit/823015cbd860f72f985bf102b6decab4d9178724) и [`0ecf51b`](https://github.com/elysiajs/elysia/commit/0ecf51bef792ac2e316a30ef46d8a780c0b51670).

## Standard Schema: Elysia больше не привязана только к TypeBox

До 1.4 Elysia фактически строила валидацию вокруг TypeBox. В 1.4 маршрутные схемы могут быть Standard Schema-совместимыми объектами: в тестах релиза Elysia принимает Zod-схемы для `body`, `query`, `params`, `headers`, `cookie` и `response`, а типы из этих схем попадают в handler.

Минимальный пример теперь выглядит так:

```ts
import { Elysia } from "elysia";
import { z } from "zod";

const app = new Elysia().post(
  "/user/:id",
  ({ params, body }) => {
    // params.id: number благодаря z.coerce.number()
    // body.name: "lilith" | "fouco"
    return { id: params.id, name: body.name };
  },
  {
    params: z.object({ id: z.coerce.number() }),
    body: z.object({ name: z.literal("lilith").or(z.literal("fouco")) }),
  }
);
```

В `test/standard-schema/validate.test.ts` это проверено не только для входных данных. Там есть кейсы для response validation: например, маршрут с `response: { 404: z.literal('lilith'), 418: z.literal('fouco') }` возвращает `status(404, 'lilith')` или `status(418, 'fouco')`, а неподходящее значение уходит в `422`.

Отдельно важно, что Standard Schema работает через `.model(...)` и `.guard(...)`. В `test/types/standard-schema/index.ts` модели с ключами `body`, `query`, `params`, `headers`, `cookie`, `response.404` и `response.418` затем используются в route options строковыми ссылками:

```ts
new Elysia()
  .model({
    body: z.object({ name: z.literal("lilith") }),
    "response.404": z.literal("not found"),
  })
  .post("/", ({ body, status }) => status(404, "not found"), {
    body: "body",
    response: {
      404: "response.404",
    },
  });
```

## `schema: "standalone"`: несколько валидаторов для одного слоя данных

Вторая часть Standard Schema-интеграции — standalone schema. Она нужна, когда несколько схем должны валидировать один и тот же слой запроса и затем дать объединённый результат. В официальном посте пример строится вокруг guard со `schema: 'standalone'`, а в тестах релиза это закреплено для body, query, params, headers и response.

```ts
import { Elysia, t } from "elysia";
import { z } from "zod";

const app = new Elysia()
  .guard({
    schema: "standalone",
    body: z.object({ id: z.number() }),
  })
  .post("/", ({ body }) => body, {
    body: t.Object({ name: t.Literal("lilith") }),
  });
```

Релизный тест отправляет `{ id: 1, name: 'lilith', extra: false }` и ожидает ответ `{ id: 1, name: 'lilith' }`: Zod проверяет `id`, TypeBox проверяет `name`, лишнее поле нормализуется. Невалидный запрос вроде `{ id: '1', name: 'fouco' }` получает `422`.

В `test/standard-schema/standalone.test.ts` есть и пример смешивания Zod, Valibot и ArkType. Это не просто маркетинговая совместимость «с любыми валидаторами»: Elysia реально хранит отдельные validators, прогоняет их и объединяет snapshots результата.

## Macro теперь может добавлять схемы, расширяться и влиять на контекст

Релизный changelog формулирует это как `macro schema, macro extension, macro detail`. По diff видно, что macro API стал глубже связан с route options и standalone validators.

В `test/macro/macro.test.ts` macro может добавить собственные схемы для `params`, `query` и `body`, а маршрут включает их обычными флагами:

```ts
const app = new Elysia()
  .macro({
    sartre: {
      params: t.Object({ sartre: t.Literal("Sartre") }),
    },
    focou: {
      query: t.Object({ focou: t.Literal("Focou") }),
    },
    lilith: {
      body: t.Object({ lilith: t.Literal("Lilith") }),
    },
  })
  .post("/:sartre", ({ body }) => body, {
    sartre: true,
    focou: true,
    lilith: true,
  });
```

В тесте валидный запрос `/Sartre?focou=Focou` с body `{ lilith: 'Lilith' }` проходит, а неправильный `params`, `query` или `body` даёт `422`. Другой кейс проверяет merge validation: три macro добавляют три разных поля body, и Elysia ожидает все три — `sartre`, `focou`, `lilith`.

Macro также может расширять другой macro. В тесте `lilith` включает `sartre: true` и `focou: true`, поэтому маршрут с `{ lilith: true }` получает все три body-схемы. Это полезно для внутренних mini-frameworks: один флаг в route options может подключить набор политик, схем и контекстных расширений.

## Type soundness в lifecycle hooks: ответы больше не теряются в типах

Большой блок diff посвящён типовой модели lifecycle hooks. В `test/types/lifecycle/soundness.ts` Elysia собирает статусы, которые могут вернуться из `onError`, `resolve`, `onBeforeHandle`, `guard.beforeHandle`, `guard.afterHandle`, `guard.error` и самого route handler.

Упрощённый смысл такой:

```ts
const app = new Elysia()
  .onError(({ status }) => {
    if (Math.random() > 0.5) return status(400);
  })
  .resolve(({ status }) => {
    if (Math.random() > 0.5) return status(401);
    return { user: "lilith" as const };
  })
  .onBeforeHandle(({ status }) => {
    if (Math.random() > 0.5) return status(403);
  })
  .get("/", ({ status }) =>
    Math.random() > 0.5 ? status(409) : "Hello World"
  );
```

В 1.4 тип маршрута должен учитывать не только `200: 'Hello World'`, но и возможные `400`, `401`, `403`, `409`. Тесты проверяют это для local, scoped и global lifecycle-сценариев через внутренние `~Volatile`, `~Ephemeral`, `~Metadata` и `~Routes` типы.

Практический эффект: если middleware или guard может вернуть ранний `status(401)`, это больше не выпадает из inferred response type downstream-клиентов и OpenAPI-генерации.

## `HEAD` автоматически работает для `GET`

Закрыт старый issue [#861](https://github.com/elysiajs/elysia/issues/861): раньше приложение могло отвечать `200` на `GET /`, но `HEAD /` возвращал `404`, если разработчик не объявил `.head()` вручную. Это ломало uptime checks, CDN/crawler probes и инструменты, которые сначала отправляют HEAD.

Коммит [`0cc6c50`](https://github.com/elysiajs/elysia/commit/0cc6c507a0e45a8359834e4a8b7ecc8485fd1a89) добавил тесты для static и dynamic path:

```ts
const app = new Elysia().get("/", () => "hello world");

const response = await app.handle(
  new Request("http://localhost", { method: "HEAD" })
);

response.status; // 200
response.headers.get("content-length"); // "11"
```

То есть для обычных GET-маршрутов HEAD теперь наследует обработчик и отдаёт заголовки без отдельного boilerplate. Если приложению нужен более дешёвый HEAD без вычисления тела, явный `.head()` всё ещё остаётся более точным вариантом.

## `responseValue` вместо `response` в lifecycle context

Elysia 1.4 вводит `responseValue` для `mapResponse`, `afterHandle` и `afterResponse`, а старое поле `response` помечает как deprecated. Причина понятна из типа `MapResponse` в `src/types.ts`: `responseValue` — это исходное значение handler-а или error handler-а до финальной упаковки в `Response`.

```ts
new Elysia().get("/", () => "Hu", {
  mapResponse({ responseValue, set }) {
    set.headers["X-Powered-By"] = "Elysia";

    if (typeof responseValue === "string") {
      return new Response(responseValue + "tao");
    }
  },
});
```

Тесты релиза проверяют несколько сценариев: `mapResponse` читает `responseValue`, добавляет headers через `set`, видит значение из `onError`, а `afterResponse` получает типизированное значение из global plugin. Миграция простая: переименовать destructuring с `{ response }` на `{ responseValue }`, если нужен именно payload.

## Миграционные изменения: `status`, cookies, file type и ObjectString

Есть несколько изменений, которые стоит проверить при обновлении.

Во-первых, из breaking changes удалён старый `error` helper: вместо него используется `status`. В новых тестах и примерах Elysia везде возвращает `status(404, value)` или `status(401)`. Если код ещё строит ответы через `error(...)`, его нужно переписать.

Во-вторых, `ObjectString` и `ArrayString` больше не материализуют default values из вложенной схемы так, как раньше. Коммит [`7034649`](https://github.com/elysiajs/elysia/commit/7034649db75ee7883fe2df165b5895b078eddc87) убрал `compiler.Create()` из `ObjectString`: строковая ветка теперь имеет безопасный default `{}` вместо JSON, собранного из defaults полей. Для `ArrayString` default остаётся только если он явно передан в options. Если вы рассчитывали, что query/cookie строка сама породит объект с default-полями, после 1.4 стоит задать default явно или обработать отсутствие значения в приложении.

В-третьих, cookie parsing стал динамически разбирать значения, похожие на JSON. В [`823015c`](https://github.com/elysiajs/elysia/commit/823015cbd860f72f985bf102b6decab4d9178724) `parseCookie` смотрит на первый и последний символ: `{...}` и `[...]` проходят через `JSON.parse`. Это связано с Standard Schema: без TypeBox-специфичной информации Elysia не всегда может заранее понять, что cookie должна быть объектом.

В-четвёртых, `fileType` теперь экспортируется для внешней проверки файлов. В `src/type-system/utils.ts` функция асинхронно использует пакет `file-type`, проверяет MIME против строки или массива расширений и бросает `InvalidFileType`, если фактический тип не совпадает:

```ts
import { fileType } from "elysia";

await fileType(uploadedFile, ["image/png", "image/jpeg"]);
```

Это полезно, если upload validation нужно переиспользовать вне стандартного route schema.

## Что в итоге

Elysia 1.4.0 — не косметический минор. Standard Schema снимает жёсткую зависимость от TypeBox и позволяет использовать Zod, Valibot, ArkType и другие валидаторы в обычных маршрутах, моделях и guard-ах. Standalone schema и macro schema дают способ собирать несколько независимых validation layers в один route. Type soundness делает lifecycle hooks видимыми для типов ответов, а `HEAD` для `GET` закрывает неприятный HTTP edge case.

Перед обновлением стоит проверить три места: старый macro v1 и `error(...)` helper, использование `response` в `mapResponse`/`afterResponse`, а также код, который полагался на автоматические defaults в `ObjectString`/`ArrayString` или на строковое JSON-значение cookie без парсинга.

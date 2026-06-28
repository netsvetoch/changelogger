---
author: Артём Нецветаев
pubDatetime: 2026-06-28T19:04:59.000Z
title: "Zod 4.4.0: строгие tuple, z.undefined() и безопаснее JSON Schema"
slug: zod-v4-4-0
featured: false
draft: false
tags:
  - release
  - zod
  - validation
description: "Обзор минорного релиза Zod v4.4.0: исправления tuple defaults, обязательных z.undefined()-полей, .merge() с refinements, JSON Schema, codec inversion и tree-shaking."
---

Zod выпустил минорную версию [`v4.4.0`](https://github.com/colinhacks/zod/releases/tag/v4.4.0). Это не релиз с одним большим новым API, а большой набор исправлений корректности в Zod 4: часть из них намеренно делает валидацию строже, поэтому обновление стоит прогнать через тесты, особенно если проект снапшотит `ZodError` или полагается на пограничное поведение tuple, object и JSON Schema.

Источник для этого обзора — GitHub Release [`colinhacks/zod@v4.4.0`](https://github.com/colinhacks/zod/releases/tag/v4.4.0) и связанные PR/коммиты.

## Потенциально ломающие исправления

### Tuple теперь материализуют defaults в выходном значении

Главное исправление из [#5661](https://github.com/colinhacks/zod/pull/5661) — Zod стал аккуратнее различать отсутствующий элемент tuple, явный `undefined`, `.optional()` и `.default()`. В тестах релиза добавлен кейс `tuple fills defaults for missing trailing elements`: если входной массив короче tuple, но следующая позиция имеет default, default теперь попадает в результат.

```ts
const schema = z.tuple([z.string(), z.string().default("fallback")]);

schema.parse(["a"]);
// ["a", "fallback"]
```

При этом отсутствующий trailing optional элемент не заполняется искусственным `undefined`:

```ts
const schema = z.tuple([z.string(), z.string().optional()]);

schema.parse(["a"]);
// ["a"]

schema.parse(["a", undefined]);
// ["a", undefined]
```

Есть важная деталь для смешанных tuple: если optional стоит перед более поздним default, результат теперь остаётся плотным массивом, чтобы индексы не «съезжали».

```ts
const schema = z.tuple([
  z.string(),
  z.string().optional(),
  z.string().default("fallback"),
]);

schema.parse(["a"]);
// ["a", undefined, "fallback"]
```

Так как аргументы `z.function()` tuple-shaped, проекты со строгими тестами ошибок для функций могут увидеть другие length/type errors.

### `z.undefined()` в object shape больше не означает «ключ можно пропустить»

Тот же [#5661](https://github.com/colinhacks/zod/pull/5661) меняет optionality-модель для `z.undefined()`: схема значения разрешает `undefined`, но сам ключ теперь обязателен. В diff это видно по тесту `optionality`: у `z.undefined()` и `z.union([z.string(), z.undefined()])` больше нет внутренних `optin/optout: "optional"`.

```ts
const schema = z.object({
  value: z.undefined(),
});

schema.safeParse({}).success;
// false

schema.safeParse({ value: undefined }).success;
// true
```

Если отсутствующий ключ действительно допустим, теперь нужно явно писать `.optional()`:

```ts
const schema = z.object({
  value: z.undefined().optional(),
});

schema.safeParse({}).success;
// true
```

Практический эффект шире, чем один `z.undefined()`: в тестах изменены комбинации `.catch()`, `.partial()`, `.default()` и `.prefault()`. Например, object-поле с `.catch()` больше не подставляет fallback при полностью отсутствующем ключе — missing property валится как `expected nonoptional, received undefined`, а некорректное присутствующее значение по-прежнему может попасть в `.catch()`.

### `.merge()` теперь бросает ошибку на receiver с refinements

В [#5856](https://github.com/colinhacks/zod/pull/5856) поведение `.merge()` выровняли с более безопасной композицией object-схем. Если левая схема уже содержит `.refine()` или `.superRefine()`, вызов `.merge()` теперь бросает:

```ts
const a = z
  .object({ password: z.string(), confirmPassword: z.string() })
  .refine(data => data.password === data.confirmPassword);
const b = z.object({ email: z.string() });

a.merge(b);
// Error: .merge() cannot be used on object schemas containing refinements.
// Use .safeExtend() instead.
```

До исправления `.merge()` мог молча потерять проверки с первой схемы: в реализации `checks` очищались. Теперь Zod запрещает такой ambiguous case, но сохраняет refinements второй схемы (`checks: b._zod.def.checks ?? []`). Для нового кода авторы релиза рекомендуют `.extend()` или `.safeExtend()`.

## JSON Schema и строковые валидаторы стали строже

### `$defs` больше не получают лишний `id`

[#5759](https://github.com/colinhacks/zod/pull/5759) меняет `z.toJSONSchema()`: когда schema metadata `id` используется как ключ для extracted definition, этот же `id` больше не дублируется внутри тела `$defs`.

Было концептуально так:

```json
{
  "$defs": {
    "name": {
      "id": "name",
      "type": "string"
    }
  }
}
```

Теперь redundant `id` убирается:

```json
{
  "$defs": {
    "name": {
      "type": "string"
    }
  }
}
```

Это важно для старых dialects до `$id`: обычный `id` там меняет resolution scope, и вложенный `id` внутри extracted definition мог ломать `$ref`. Если ваш генератор или downstream tooling читал эти внутренние `id` напрямую, это место нужно проверить.

В JSON Schema также исправлены пересечения min/max для `draft-04` и `openapi-3.0` ([#5700](https://github.com/colinhacks/zod/pull/5700)): при одновременных `minimum` и `exclusiveMinimum` Zod выбирает более строгую границу, например для `z.number().int().positive().lte(65535)`.

### `z.base64()` и `z.httpUrl()` закрывают неоднозначные входы

[#5888](https://github.com/colinhacks/zod/pull/5888) добавляет явный отказ от whitespace в `z.base64()`. Причина в том, что `atob()` удаляет пробельные символы перед проверкой, из-за чего строки с пробелом или переводом строки могли проходить как валидные.

```ts
z.base64().safeParse("Zm9v").success;
// true

z.base64().safeParse("Zm 9v").success;
// false
```

[#5672](https://github.com/colinhacks/zod/pull/5672) делает `z.httpUrl()` строже к протоколу: Zod больше не принимает URL, которые `URL` constructor мог бы «починить» нормализацией.

```ts
z.httpUrl().safeParse("https://example.com").success;
// true

z.httpUrl().safeParse("https:/example.com").success;
// false

z.httpUrl().safeParse("http:example.com").success;
// false
```

Для `z.cuid()` регулярное выражение тоже ужесточили, а CUID v1 помечен deprecated в [#5880](https://github.com/colinhacks/zod/pull/5880).

### Ошибки union стали полезнее, но snapshots могут измениться

В [#5708](https://github.com/colinhacks/zod/pull/5708) исправили потерю parent path при форматировании nested union errors через `z.treeifyError()` и `z.formatError()`: рекурсивная обработка теперь передаёт накопленный path внутрь вложенных `invalid_union`/`invalid_key`/`invalid_element`.

[#5723](https://github.com/colinhacks/zod/pull/5723) добавляет в ошибку discriminated union список допустимых discriminator options и меняет сообщение на формат вроде:

```txt
Invalid discriminator value. Expected 'a' | 'b'
```

Если тесты сравнивают `ZodError` целиком, это ожидаемое изменение снапшотов.

## Исправления API, которые стоит заметить

### `z.record()` теперь применяет transforms к ключам

[#5891](https://github.com/colinhacks/zod/pull/5891) закрывает issue [#5296](https://github.com/colinhacks/zod/issues/5296): key schema в `z.record()` теперь реально прогоняется, поэтому transform результата ключа попадает в выходной object.

```ts
const schema = z.record(
  z.enum(["a", "b"]).transform(key => key.toUpperCase()),
  z.number()
);

schema.parse({ a: 1, b: 2 });
// { A: 1, B: 2 }
```

В реализации для known key set Zod вызывает `def.keyType._zod.run(...)`, собирает `invalid_key` issues и использует transformed key как имя выходного свойства. Async key schemas для object keys по-прежнему не поддерживаются.

### Появился `z.invertCodec()`

В [#5770](https://github.com/colinhacks/zod/pull/5770) добавлен helper `z.invertCodec(codec)`. Он создаёт `ZodCodec` с поменянными местами `in`/`out`, `transform`/`reverseTransform`.

```ts
const stringToNumber = z.codec(z.string(), z.number(), {
  decode: Number,
  encode: String,
});

const numberToString = z.invertCodec(stringToNumber);

z.decode(numberToString, 123);
// "123"

z.encode(numberToString, "123");
// 123
```

Отдельно [#5769](https://github.com/colinhacks/zod/pull/5769) исправляет `z.discriminatedUnion().encode()`, когда discriminator сам использует codec.

### `.superRefine()` получил `when`

[#5741](https://github.com/colinhacks/zod/pull/5741) добавляет второй параметр для `.superRefine()` — `params?: { when?: (payload) => boolean }`. Он работает так же, как conditional checks: refinement запускается только если `when` возвращает `true`.

```ts
const base = z.object({ foo: z.number(), bar: z.number() });

const schema = base.superRefine(
  (data, ctx) => {
    if (data.foo > 10) {
      ctx.addIssue({ code: "custom", message: "foo must be less than 10" });
    }
  },
  {
    when: ({ value }) => base.pick({ foo: true }).safeParse(value).success,
  }
);
```

Связанное исправление [#5681](https://github.com/colinhacks/zod/pull/5681) чинит уважение `abort: true` в `.refine()` checks с `when`.

### Defaults для `Map` и `Set` больше не разделяют состояние

[#5855](https://github.com/colinhacks/zod/pull/5855) расширяет internal `shallowClone`: теперь он клонирует не только plain object и array, но и `Map`/`Set`.

```ts
const schema = z.map(z.string(), z.number()).default(new Map());

const a = schema.parse(undefined);
const b = schema.parse(undefined);

a === b;
// false
```

Это закрывает класс багов, где mutation результата одного parse могла протечь в следующий parse через общий default instance.

## Производительность, tree-shaking и окружения

### Builder methods теперь лениво bind'ятся

[#5897](https://github.com/colinhacks/zod/pull/5897) переносит classic builder methods (`optional`, `array`, `refine`, `default`, `catch` и другие) на shared internal prototype и делает ленивый bind при первом доступе. Цель — меньше per-schema allocations в коде, который создаёт много схем.

Важно, что detached usage сохраняется: в PR добавлен большой `detached-methods.test.ts`, который проверяет паттерны вроде `const optional = schema.optional; optional.call(schema)` и `arr.map(schema.parse)`.

```ts
const schema = z.string();
const optional = schema.optional;

optional.call(schema);
// продолжает работать
```

### Tree-shaking получил две конкретные подсказки для bundlers

В релиз вошли два изменения про bundle size:

- [#5689](https://github.com/colinhacks/zod/pull/5689) добавляет `"sideEffects": false` в generated stub package manifests.
- Коммит [`195e8696`](https://github.com/colinhacks/zod/commit/195e86962b5156012a4cdcfbff87dffddce87b78) размечает top-level factory calls как `/*@__PURE__*/`.

Это адресует давние жалобы на tree-shaking, особенно вокруг Next.js/Turbopack, `zod/mini`, locales и subpath imports.

```json
{
  "sideEffects": false
}
```

### `z.config({ jitless: true })` стал надёжнее

[#5889](https://github.com/colinhacks/zod/pull/5889) переносит `globalConfig` на `globalThis.__zod_globalConfig`, чтобы CJS/ESM instances и несколько bundled copies Zod видели один shared config object. Это важно для monorepo и смешанных module systems: один вызов `z.config(...)` теперь наблюдается другими загруженными экземплярами.

[#5864](https://github.com/colinhacks/zod/pull/5864) чинит другой CSP-related edge case: если `jitless` выставлен до первого доступа к `allowsEval`, Zod больше не делает probe через `new Function("")`. Даже пойманный probe мог создавать `securitypolicyviolation` в строгих CSP-страницах.

## Ещё заметные исправления

- [#5898](https://github.com/colinhacks/zod/pull/5898) добавляет hardening против prototype pollution: object catchall paths теперь пропускают ключ `__proto__`, чтобы он не менял prototype результирующего `{}`.
- [#5699](https://github.com/colinhacks/zod/pull/5699) добавляет отсутствовавший `ctx.addIssue()` в transform context.
- [#5869](https://github.com/colinhacks/zod/pull/5869) разрешает конструировать пустые `z.union([])`, `z.xor([])` и discriminated unions: они больше не падают при создании, а валятся на parse.
- [#5687](https://github.com/colinhacks/zod/pull/5687) и [#5793](https://github.com/colinhacks/zod/pull/5793) чинят точность `multipleOf()` / `step()` для decimal и exponent cases.
- [#5758](https://github.com/colinhacks/zod/pull/5758) и [`87cf0f93`](https://github.com/colinhacks/zod/commit/87cf0f93cd0f34bdc69f11c9377568e6812841c4) улучшают `fromJSONSchema()`: metadata применяется к `enum`, `const`, `not`, `anyOf` и multi-type schemas, а вход нормализуется JSON round-trip, включая отказ от циклов и `BigInt`.

## Что проверить при обновлении

1. Tuple-схемы с `.default()`, `.prefault()`, `.optional()` и недостаточно длинными входными массивами.
2. Object shapes, где `z.undefined()` раньше использовался как «ключ может отсутствовать». Теперь для этого нужен `.optional()`.
3. `.merge()` на схемах с `.refine()` / `.superRefine()`: такие места стоит заменить на `.safeExtend()` или другую явную композицию.
4. Snapshot-тесты ошибок, особенно union/discriminated union и `z.function()` argument errors.
5. JSON Schema consumers, если они читали `id` внутри `$defs` или завязаны на legacy draft/OpenAPI 3.0 output.
6. CSP/jitless и bundle-size сценарии: в этом релизе есть конкретные исправления для shared config, eval probe и tree-shaking.

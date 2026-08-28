---
author: Артём Нецветаев
pubDatetime: 2026-08-28T18:19:03.000Z
title: "Zod 4.5.0: z.compile(), z.validate() и на порядок меньше памяти"
slug: zod-v4-5-0
featured: false
draft: false
tags:
  - release
  - zod
  - validation
description: "Обзор минорного релиза Zod v4.5.0: флагманский z.compile(), z.creditCard(), z.properties(), z.validate(), циклические входы, снижение памяти ~9x и ряд ломающих исправлений корректности."
---

Zod выпустил минорную версию [`v4.5.0`](https://github.com/colinhacks/zod/releases/tag/v4.5.0) — на этот раз с одним большим флагманским API и длинным списком новых utilities и исправлений корректности. Главное — [`z.compile()`](#zcompile) и авто-компиляция схем, плюс новый быстрый путь валидации `z.validate()`. Часть исправлений намеренно делает проверки строже (секунды в датах, подсчёт длины строк, `__proto__`), поэтому перед обновлением стоит прогнать тесты.

Источник для этого обзора — GitHub Release [`colinhacks/zod@v4.5.0`](https://github.com/colinhacks/zod/releases/tag/v4.5.0), связанные PR/коммиты и проверка экспортов в исходниках на теге `v4.5.0`.

## `z.compile()` — флагманский API

Новая функция [`z.compile(schema)`](https://github.com/colinhacks/zod/pull/6085) прекомпилирует любую Zod-схему в оптимизированный плоский JS-сниппет. Скомпилированную схему можно использовать так же, как обычную, — без специальных правил[^1]:

```ts
import * as z from "zod";

const Player = z.object({
  username: z.string(),
  bio: z.string(),
  xp: z.number()
});

const CompiledPlayer = z.compile(Player);

Player.parse({ ... });
CompiledPlayer.parse({ ... }); // ~2x faster
```

По бенчмаркам из релиза, на объектах, массивах и union разгон в 3–7 раз: массив из 10 объектов парсится за 68 ns вместо 377 ns (5.5x), объект на 20 ключей — 38 ns вместо 301 ns (7.8x), union из 3 объектов — 36 ns вместо 190 ns (5.3x). Сложные схемы выигрывают больше, чем простые.

[^1]: Код примера и цифры — из релиза; бенчмарки лежат в `packages/bench/compile-matrix.ts`.

### Как это работает

Внутри `z.compile()` проходит по всей схеме и генерирует гипероптимизированный сниппет без циклов и интерпретатора. Например, для схемы:

```ts
const Point = z.object({ x: z.number(), y: z.number() });
```

генерируется функция вроде:

```ts
const isPoint = new Function(
  "input",
  `
  if (typeof input !== "object" || input === null) return false;
  if (typeof input.x !== "number") return false;
  if (typeof input.y !== "number") return false;
  return true;
`
);
```

Сниппет исполняется через `new Function()` (по сути более мощный `eval`) как fast-path валидатор. На корректных данных — прямые `typeof`-проверки и чтения свойств без интерпретатора. Если вход невалиден, Zod возвращает специальный символ `INVALID` и откатывается на обычный парсер — это структурно исключает расхождения в детальных ошибках между скомпилированным и обычным вариантами. Сборка не нужна: сниппет генерируется в рантайме внутри процесса.

### `import "zod/compile"` и глобальная авто-компиляция

Чтобы скомпилировать каждую схему в приложении, достаточно один раз импортировать `zod/compile` на входе entry-файла. Любая схема, созданная после этого импорта, автоматически компилируется при первом парсинге.

```ts
import "zod/compile"; // обязательно до модулей, определяющих схемы
import * as z from "zod";

const schema = z.object({ name: z.string() });
schema.parse({ name: "ok" }); // компилируется при первом parse
```

Работает и как CLI-флаг Node.js, что гарантирует запуск до определения любой схемы:

```sh
node --import zod/compile app.js
```

Либо через `preload` в [`bunfig.toml`](https://bun.com/docs/runtime/bunfig#preload) или [`nub.jsonc`](https://nubjs.com/docs/config#preload):

```jsonc
{ "preload": ["zod/compile"] }
```

Весь тестовый набор Zod прогоняется дважды — обычным образом и с глобально включённой авто-компиляцией — чтобы гарантировать полную фиделитность поведений.

## Новые utilities в `z`

- [`z.creditCard()`](https://github.com/colinhacks/zod/pull/5931) — новый строковый формат: 12–19 цифр, опционально разделённые пробелом или дефисом, с корректной Luhn-контрольной суммой.

  ```ts
  z.creditCard().parse("4111 1111 1111 1111"); // ✅
  z.creditCard().parse("4111 1111 1111 1112"); // ❌ bad checksum
  ```

- [`z.properties()`](https://github.com/colinhacks/zod/pull/5912) — «многоключевой» аналог `z.property()`, проверяет набор свойств через `.check(...)`:

  ```ts
  const httpsUrl = z.instanceof(URL).check(
    ...z.properties({
      protocol: z.literal("https:" as string),
      hostname: z.string().regex(z.regexes.domain),
    })
  );

  httpsUrl.parse(new URL("https://example.com")); // ✅
  httpsUrl.parse(new URL("http://localhost")); // ❌ protocol
  ```

- [`z.deepPartial()`](https://github.com/colinhacks/zod/pull/5928) — снова функциональная форма, убранная в Zod 4 как метод. Рекурсивно делает поля object-схемы опциональными, результат — всё ещё `ZodObject`, поэтому `.shape` и `.extend()` продолжают работать:

  ```ts
  const Post = z.object({
    title: z.string(),
    author: z.object({ name: z.string(), email: z.string() }),
  });

  const PartialPost = z.deepPartial(Post);
  type PartialPost = z.output<typeof PartialPost>;
  // => { title?: string; author?: { name?: string; email?: string } }

  PartialPost.parse({ author: {} }); // ✅
  ```

- [`.exactPartial()`](https://github.com/colinhacks/zod/pull/6065) — как `.partial()`, но оборачивает каждое поле в `z.exactOptional()` вместо `z.optional()`: ключ можно опустить, но явный `undefined` отклоняется. Это совпадает с TypeScript `Partial<>` при `exactOptionalPropertyTypes`. В Zod Mini это верхнеуровневая функция `z.exactPartial(Recipe)`:

  ```ts
  const Recipe = z.object({ title: z.string(), servings: z.number() });

  const PartialRecipe = Recipe.exactPartial();
  PartialRecipe.parse({}); // ✅
  PartialRecipe.parse({ title: undefined }); // ❌
  ```

## `z.validate()` — дешёвая проверка «валидно ли»

[`z.validate()`](https://github.com/colinhacks/zod/pull/6471) доступен в Zod, Zod Mini и Zod Core. Он отвечает на вопрос «валиден ли вход?» без построения `ZodError`, поэтому отклонение на невалидных данных до 16x быстрее, чем `.safeParse().success`. Возвращаемый тип — гард над входным типом схемы, а `z.validateAsync()` покрывает схемы с async-рефайнментами.

```ts
z.validate(z.string(), "hi"); // true
z.validate(z.string(), 42); // false
```

По Moltar-бенчмарку (фикстура AssertLoose, возвращает boolean) скомпилированный Zod даёт ~60.6M ops/s против ~6.5M у обычного Zod 4.

## `z.input()` / `z.output()`, `z.toZod()`, `z.getDiscriminatedOption()`

- [`z.input()` и `z.output()`](https://github.com/colinhacks/zod/pull/5928) проецируют схему на входную или выходную сторону — удобно валидировать две половины codec независимо. На схемах без codec/pipes это no-op:

  ```ts
  const isoDate = z.codec(z.iso.datetime(), z.date(), {
    decode: s => new Date(s),
    encode: d => d.toISOString(),
  });

  const Event = z.object({ name: z.string(), at: isoDate });

  z.input(Event).parse({ name: "launch", at: "2024-01-01T00:00:00Z" }); // ✅
  z.output(Event).parse({ name: "launch", at: new Date() }); // ✅
  ```

- [`z.toZod<T>()`](https://github.com/colinhacks/zod/pull/5913) — утилита, позволяющая определить Zod-схему, которая в точности согласуется со статическим типом, в том числе рукописным или внешним:

  ```ts
  type Player = { username: string; xp: number };

  const Player = z.toZod<Player>()(
    z.object({ username: z.string(), xp: z.number() })
  );

  Player.shape.username; // ZodString — схема возвращается без изменений
  ```

- [`z.getDiscriminatedOption()`](https://github.com/colinhacks/zod/pull/5947) достаёт член discriminated union по значению дискриминатора:

  ```ts
  const Fruit = z.object({ type: z.literal("fruit"), seeds: z.boolean() });
  const Veg = z.object({ type: z.literal("vegetable"), leafy: z.boolean() });
  const Produce = z.discriminatedUnion("type", [Fruit, Veg]);

  z.getDiscriminatedOption(Produce, "fruit"); // typeof Fruit
  z.getDiscriminatedOption(Produce, "meat"); // ❌ TypeScript error
  ```

## Циклические входы

Рекурсивные схемы Zod теперь поддерживают циклические данные ([#6387](https://github.com/colinhacks/zod/pull/6387), [#6482](https://github.com/colinhacks/zod/pull/6482)). В полном Zod циклическое значение распознаётся автоматически, а в Zod Mini нужно явно зарегистрировать memoizer через `z.config({ memoizer: z.memoizer() })` до определения схем.

```ts
const Category = z.object({
  name: z.string(),
  get subcategories() {
    return z.array(Category);
  },
});

const input: any = { name: "root", subcategories: [] };
input.subcategories.push(input);

const result = Category.parse(input);
result.subcategories[0] === result; // true
```

## Память и скорость

### ~9x меньше памяти на схему

В Zod 4.4 голый `z.string()` удерживал 7.5kb heap; в 4.5 — 784 байта. Причина: раньше все методы схем автоматически bind'ились к инстансу (то есть каждый метод выделял память на инстансе, а не шёл через `prototype`). Zod 4.5 реализует паттерн memoization методов, избегая аллокации bound-методов до реального обращения. Это позволяет сохранить detached-паттерны вроде `const { parse } = z.string(); parse(...)`. По бенчмарку, объект на 10 ключей занимает 11kb против 82kb у 4.4.3.

### Провалы парсинга быстрее ~7.5x

`.parse()`/`.safeParse()` создают `Error`, который захватывает stack trace; на невалидных данных это обычно дороже самой валидации. Теперь `.safeParse()` больше не захватывает stack trace на провале ([#6316](https://github.com/colinhacks/zod/pull/6316), [#6450](https://github.com/colinhacks/zod/pull/6450)):

```ts
const result = Player.safeParse({ username: 42, bio: "hello", xp: 12 });
result.success; // false — ~7.5x быстрее, чем в Zod 4.4
```

## Символьные ключи в `z.object()`

Shape схемы теперь может объявлять символьный ключ ([#6448](https://github.com/colinhacks/zod/pull/6448)). TypeScript отслеживает его: `const`-символ инферится как `unique symbol`, поэтому `z.infer` делает ключ обязательным и проверяет тип значения. Незадекларированные символьные ключи по-прежнему игнорируются.

```ts
const TAG = Symbol("tag");
const schema = z.object({ name: z.string(), [TAG]: z.number() });

schema.parse({ name: "alice", [TAG]: 42 }); // ✅ { name: "alice", [TAG]: 42 }
schema.safeParse({ name: "alice" }); // ❌ символьный ключ обязателен
```

## Потенциально ломающие исправления

Все исправления ниже закрывают проблемы корректности (soundness), поэтому схема, полагавшаяся на старое поведение, может начать отклонять ранее принимавшиеся входы.

### ⚠️ `z.iso.datetime()` требует секунды

RFC 3339 обязывает секунды. `z.iso.datetime()` и `z.iso.datetime({ offset: true })` больше не принимают даты с точностью до минуты вроде `2020-01-01T06:15Z`. При `local: true` вход `2020-01-01T06:15` по-прежнему допустим, так как неполное datetime вне RFC 3339 ([#6457](https://github.com/colinhacks/zod/pull/6457)).

```ts
z.iso.datetime().parse("2020-01-01T06:15:00Z"); // ✅
z.iso.datetime().parse("2020-01-01T06:15Z"); // ❌ было принято в 4.4
```

Чтобы принять обе точности, объедините их union'ом:

```ts
z.union([z.iso.datetime(), z.iso.datetime({ precision: -1 })]);
```

### ⚠️ Длина строки считается в code points

`.min()`, `.max()` и `.length()` раньше считали UTF-16 unit'ы, поэтому `z.string().max(5)` отклонял пять эмодзи. Теперь считается количество Unicode code points — как это делает любой не-JS потребитель границ длины (Postgres, MySQL, Go, Python и `maxLength` из `z.toJSONSchema()`). `.max()` только ослабляется; `.min()` и `.length()` ужесточаются на astral-входах. Графемы не изменились — ZWJ-последовательность всё ещё несколько code points ([#6441](https://github.com/colinhacks/zod/pull/6441)).

```ts
z.string().max(5).parse("😀😀😀😀😀"); // было too_big, теперь проходит
z.string().min(5).parse("😀😀😀"); // было норм, теперь too_small
```

### ⚠️ Ключи record и intersection теперь совпадают с TypeScript

Key schema в record управляет только теми ключами, которые ей соответствуют, подобно index signature. Пересечение объекта с record на паттерне больше не отклоняет собственные ключи объекта ([#6412](https://github.com/colinhacks/zod/pull/6412)).

```ts
z.object({ name: z.string() })
  .and(z.record(z.string().regex(/^S_/), z.string()))
  .parse({ name: "a", S_a: "s" });
// 4.4: throws invalid_key на "name"
// 4.5: { name: "a", S_a: "s" }
```

Отдельно: ошибка `unrecognized_keys` больше не прерывает схему, из которой пришла, поэтому strict object с лишним ключом _и_ некорректным значением теперь сообщает оба issues, а не только первый.

### ⚠️ `__proto__` всегда вычищается

Object- и record-парсеры теперь удаляют ключ `__proto__`, откуда бы он ни пришёл — из входа, из декларации схемы или из key transform'а record. `.strict()` сообщает собственный входной `__proto__` как `unrecognized_keys`. Оба JSON Schema конвертера и error formatter'ы используют own-property записи, чтобы путь вроде `toString` или `constructor` не мог «залезть» на `Object.prototype` ([#6213](https://github.com/colinhacks/zod/pull/6213), [#6367](https://github.com/colinhacks/zod/pull/6367), [#6346](https://github.com/colinhacks/zod/pull/6346) и другие).

### ⚠️ Строже строковые форматы

Список ужесточений из релиза:

- `z.ipv6()` больше не валидируется через `new URL()` (пропускал `::@1` и `::1\n`) — теперь проверяется алфавит адреса напрямую ([#6442](https://github.com/colinhacks/zod/pull/6442)).
- `z.ulid()` ограничивает первый символ диапазоном `0`–`7`; выше переполняется 48-битный timestamp. Фикстуры без реального timestamp, например с ведущей буквой, теперь отклоняются ([#6095](https://github.com/colinhacks/zod/pull/6095)).
- `z.httpUrl()` применяет к host ограничения длины из RFC 1035, как `z.hostname()` ([#6035](https://github.com/colinhacks/zod/pull/6035)).
- `z.emoji()` больше не делает экспоненциальный backtracking при неудачном совпадении ([#6347](https://github.com/colinhacks/zod/pull/6347)).
- `z.string().includes(sub, { position: N })` генерирует JSON Schema pattern, допускающий как минимум N ведущих символов, — согласуется с `String.prototype.includes` ([#6024](https://github.com/colinhacks/zod/pull/6024)).

## Что проверить при обновлении

1. Schemas с `z.iso.datetime()` без секунд — теперь нужен секундный вход или union по точности.
2. `.min()` / `.max()` / `.length()` на строках с эмодзи и astral-символами — границы длины могут ужесточиться (для `.min()`/`.length()`).
3. Object/record/int players, полагавшиеся на приём `__proto__` или на слабую строгость record-key и intersection.
4. `.partial()` против явного `undefined`: если нужен именно `exactOptional`-семитик, используйте `.exactPartial()`.
5. Строковые форматы `ipv6`/`ulid`/`httpUrl`/`emoji` — некоторые входы, ранее принимавшиеся, теперь отклоняются.
6. Шаблоны, которые писались под size/memory: замена на `z.compile()` или `import "zod/compile"` даёт заметный прирост производительности, а `z.validate()` — дешёвую проверку валидности без построения ошибок.

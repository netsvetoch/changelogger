---
author: Артём Нецветаев
pubDatetime: 2026-06-30T07:53:56.000Z
title: "eslint-plugin-unicorn 66–69: 139 новых правил за четыре релиза"
slug: eslint-plugin-unicorn-v66-v69
description: "Сборный обзор eslint-plugin-unicorn v66, v67, v68 и v69: переход на Node.js 22 и ESLint 10.4, переименование prevent-abbreviations, 139 новых правил и самые интересные проверки для современных JavaScript и TypeScript проектов."
featured: false
draft: false
tags:
  - release
  - eslint
  - javascript
  - typescript
---

[`eslint-plugin-unicorn`](https://github.com/sindresorhus/eslint-plugin-unicorn) за четыре релиза — [`v66.0.0`](https://github.com/sindresorhus/eslint-plugin-unicorn/releases/tag/v66.0.0), [`v67.0.0`](https://github.com/sindresorhus/eslint-plugin-unicorn/releases/tag/v67.0.0), [`v68.0.0`](https://github.com/sindresorhus/eslint-plugin-unicorn/releases/tag/v68.0.0) и [`v69.0.0`](https://github.com/sindresorhus/eslint-plugin-unicorn/releases/tag/v69.0.0) — превратился в гораздо более широкий набор правил для современного JavaScript/TypeScript. Если считать только секции `New rules`, в этих версиях добавилось **139 новых правил**: 74 в v66, 16 в v67, 37 в v68 и 12 в v69.

Главная картина такая: v66 — большой compatibility/reset-релиз под новые платформы и новые возможности языка; v67 добавляет больше проверок на читаемость и корректные API-идиомы; v68 доводит плагин до **300+ правил** и добавляет много правил на «почти очевидные баги»; v69 уже выглядит как релиз про свежие стандартизованные API: `AbortSignal.timeout()`, `Promise.try()`, `Set#union()`/`intersection()`/`difference()`, `Error.isError()`, `URLSearchParams` и observer APIs.

Источники для обзора — GitHub Releases [`v66.0.0`](https://github.com/sindresorhus/eslint-plugin-unicorn/releases/tag/v66.0.0), [`v67.0.0`](https://github.com/sindresorhus/eslint-plugin-unicorn/releases/tag/v67.0.0), [`v68.0.0`](https://github.com/sindresorhus/eslint-plugin-unicorn/releases/tag/v68.0.0), [`v69.0.0`](https://github.com/sindresorhus/eslint-plugin-unicorn/releases/tag/v69.0.0) и документация самих правил в `docs/rules/*.md` на соответствующих тегах.

## Коротко по версиям

| Версия                                                                                  | Дата релиза | Новых правил | Что важно                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------- | ----------: | -----------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`v66.0.0`](https://github.com/sindresorhus/eslint-plugin-unicorn/releases/tag/v66.0.0) |  2026-06-14 |           74 | Требует Node.js 22 и ESLint 10.4, переименовывает `no-array-for-each` в `no-for-each`, удаляет `no-hex-escape` в пользу `prefer-unicode-code-point-escapes`. Много правил под новые JS/TS возможности: `Temporal`, `using`, `Iterator#toArray()`, `Uint8Array#toBase64()`, безопасные DOM HTML API. |
| [`v67.0.0`](https://github.com/sindresorhus/eslint-plugin-unicorn/releases/tag/v67.0.0) |  2026-06-16 |           16 | Больше правил про читаемость: boolean naming, `else if`, logical assignment, `.has()` вместо `.get()` для existence checks, запрет бесполезных `continue`/override/coercion.                                                                                                                        |
| [`v68.0.0`](https://github.com/sindresorhus/eslint-plugin-unicorn/releases/tag/v68.0.0) |  2026-06-19 |           37 | Релиз «300+ rules»: правила на chained comparisons, неправильный `^` вместо `**`, `sort()` ради min/max, boolean sort comparators, `Promise.withResolvers()`, `RegExp.escape()`, `URL.canParse()`. Также breaking rename: `prevent-abbreviations` → `name-replacements`.                            |
| [`v69.0.0`](https://github.com/sindresorhus/eslint-plugin-unicorn/releases/tag/v69.0.0) |  2026-06-24 |           12 | Правила на самые свежие платформенные API: `AbortSignal.timeout()`, `Promise.try()`, `Set` methods, `Error.isError()`, `URLSearchParams`, `AggregateError`, observer APIs и корректные well-known symbol methods.                                                                                   |

## Breaking changes: что может сломать конфиг

В `v66.0.0` плагин поднял минимальные требования до **Node.js 22** и **ESLint 10.4**. Там же правило `no-array-for-each` переименовано в [`no-for-each`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-for-each.md), а `no-hex-escape` удалено: его заменяет [`prefer-unicode-code-point-escapes`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-unicode-code-point-escapes.md), потому что новое правило покрывает больше случаев legacy escapes.

В `v68.0.0` ещё одно переименование: `prevent-abbreviations` стало [`name-replacements`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/name-replacements.md). Это не просто косметика в release notes: если в конфиге был ключ `unicorn/prevent-abbreviations`, его нужно переименовать.

```js
// Было
export default [
  {
    rules: {
      'unicorn/prevent-abbreviations': 'error',
    },
  },
];

// Стало
export default [
  {
    rules: {
      'unicorn/name-replacements': 'error',
    },
  },
];
```

## Самое интересное: правила про новые стандартные API

### `AbortSignal.timeout()` вместо ручного `AbortController` + `setTimeout()`

В `v69.0.0` появилось [`prefer-abort-signal-timeout`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-abort-signal-timeout.md). Оно ловит простой паттерн, где создаётся `AbortController`, рядом ставится `setTimeout(() => controller.abort(), delay)`, а дальше используется только `controller.signal`.

```js
// ❌
const abortController = new AbortController();
setTimeout(() => abortController.abort(), 1000);

await fetch(url, { signal: abortController.signal });

// ✅
const abortSignal = AbortSignal.timeout(1000);

await fetch(url, { signal: abortSignal });
```

Правило специально не трогает контроллеры с дополнительной логикой — например, когда тот же controller ещё отменяется по клику. Это важная деталь: `AbortSignal.timeout()` использует timeout-specific reason, поэтому механическая замена не всегда эквивалентна.

### `Promise.withResolvers()` вместо deferred-boilerplate

[`prefer-promise-with-resolvers`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-promise-with-resolvers.md) из `v68.0.0` заменяет классический deferred-паттерн, где `resolve` и `reject` выносятся наружу из `new Promise()`.

```js
// ❌
let fulfill;
let fail;
const deferredPromise = new Promise((resolve, reject) => {
  fulfill = resolve;
  fail = reject;
});

// ✅
const {
  promise: deferredPromise,
  resolve: fulfill,
  reject: fail,
} = Promise.withResolvers();
```

Автофикс применяется только к простому варианту, где executor ничего больше не делает. Если внутри executor есть setup-код, правило его игнорирует, потому что `Promise.withResolvers()` не должен менять порядок и семантику выполнения.

### `Promise.try()` вместо promise-wrapping boilerplate

[`prefer-promise-try`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-promise-try.md) из `v69.0.0` покрывает соседний паттерн: «выполни callback, он может вернуть значение, promise или синхронно бросить исключение, а я хочу получить promise».

```js
// ❌
new Promise(resolve => resolve(fn(argument)));

// ✅
Promise.try(() => fn(argument));
```

Документация отдельно подчёркивает тонкость: `Promise.resolve().then(fn)` правило репортит, но не автофиксит, потому что `Promise.try(fn)` запускает `fn` в другой момент и не передаёт ему resolved `undefined` как аргумент.

### Новые Set methods вместо spread/filter-самоделок

[`prefer-set-methods`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-methods.md) из `v69.0.0` переводит ручные операции над `Set` на стандартные методы.

```js
// ❌
const union = new Set([...set, ...otherSet]);

// ✅
const union = set.union(otherSet);

// ❌
const intersection = [...set].filter(value => otherSet.has(value));

// ✅
const intersection = set.intersection(otherSet);

// ❌
const difference = [...set].filter(value => !otherSet.has(value));

// ✅
const difference = set.difference(otherSet);
```

Здесь Unicorn осторожен: union auto-fix возможен только когда operands точно `Set`/`ReadonlySet`, а intersection/difference часто предлагаются как suggestion, потому что голый `.filter()` возвращает массив, а `Set#intersection()` возвращает Set и может отличаться порядком обхода.

### `RegExp.escape()` вместо локальных escape-хелперов

[`prefer-regexp-escape`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-regexp-escape.md) из `v68.0.0` ловит hand-rolled escaping snippets и популярные helpers вроде `escape-string-regexp` или `_.escapeRegExp`.

```js
// ❌
const escaped = string.replace(/[.*+?^${}()|[\]\]/g, '\$&');

// ❌
import escapeStringRegexp from 'escape-string-regexp';
const escaped = escapeStringRegexp(string);

// ✅
const escaped = RegExp.escape(string);
```

Правило выключено в `recommended` и `unopinionated` пресетах, потому что `RegExp.escape()` — современный runtime API. Но само направление понятно: как только target runtime поддерживает новый стандарт, лучше не держать локальную реализацию с edge cases.

### `Temporal`, `using`, новые DOM HTML API

`v66.0.0` добавил несколько правил, которые показывают, куда движется платформа:

- [`prefer-temporal`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-temporal.md) предлагает `Temporal` вместо `Date`. Например, `new Date('2024-08-16')` можно заменить на `Temporal.PlainDate.from('2024-08-16')`, а `new Date(1_724_198_400_000)` — на `Temporal.Instant.fromEpochMilliseconds(...)`.
- [`prefer-dispose`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-dispose.md) предлагает `using`/`await using` вместо ручного `try/finally` для disposable resources.
- [`no-unsafe-dom-html`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unsafe-dom-html.md) запрещает XSS-синки вроде `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `srcdoc`, `document.write()` и предлагает `setHTML()`, `Document.parseHTML()` или текстовые API.

```js
// ❌
element.innerHTML = html;
element.insertAdjacentHTML("beforeend", html);

// ✅
element.setHTML(html);
element.insertAdjacentText("beforeend", text);
```

## Правила, которые ловят реальные баги, а не только стиль

### Chained comparisons в JavaScript — почти всегда ошибка

[`no-chained-comparison`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-chained-comparison.md) из `v68.0.0` запрещает выражения вроде `a < b < c`. В JavaScript это не математическая цепочка и не Python-семантика: выражение парсится как `(a < b) < c`, то есть boolean превращается в `0` или `1`.

```js
// ❌
if (a < b < c) {
}

// ✅
if (a < b && b < c) {
}
```

### `sort()` ради min/max — лишняя работа и возможные побочные эффекты

[`no-array-sort-for-min-max`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-sort-for-min-max.md) из `v68.0.0` ловит сортировку массива только ради первого или последнего элемента.

```js
// ❌
const minimum = array.sort((a, b) => a - b)[0];
const maximum = array.toSorted((a, b) => b - a)[0];

// ✅
const minimum = Math.min(...array);
const maximum = Math.max(...array);
```

Правило не автофиксит код, потому что `sort()` мутирует массив, пустые массивы и `NaN` ведут себя иначе, а spread на очень больших массивах может упасть. Но оно даёт editor suggestions для типичных случаев.

### `concat()` в цикле делает аккумулятор квадратичным

[`no-array-concat-in-loop`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-concat-in-loop.md) из `v68.0.0` ловит паттерн, где аккумулятор каждый раз пересоздаётся через `.concat()`.

```js
// ❌
let result = [];

for (const chunk of chunks) {
  result = result.concat(chunk);
}

// ✅
const result = [];

for (const chunk of chunks) {
  result.push(...chunk);
}

// ✅
const result = chunks.flat();
```

### Well-known symbols должны возвращать protocol objects синхронно

[`no-invalid-well-known-symbol-methods`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-invalid-well-known-symbol-methods.md) из `v69.0.0` проверяет реализации well-known symbol methods. Например, `Symbol.dispose` синхронный: если сделать его `async`, `using` не будет ждать возвращённый promise. Для async cleanup нужен `Symbol.asyncDispose`.

```js
// ❌
class Resource {
  async [Symbol.dispose]() {}
}

// ✅
class Resource {
  async [Symbol.asyncDispose]() {}
}
```

То же касается iterator protocols: `Symbol.iterator` не должен быть async generator; для этого есть `Symbol.asyncIterator`.

### `AggregateError` сохраняет список ошибок

[`prefer-aggregate-error`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-aggregate-error.md) из `v69.0.0` ловит guarded throw, когда код собрал массив `Error[]`, но потом выбрасывает обычный `Error` и теряет детали.

```ts
// ❌
const errors: Error[] = [new Error("Email is required.")];

if (errors.length > 0) {
  throw new Error("Validation failed.");
}

// ✅
const errors: Error[] = [new Error("Email is required.")];

if (errors.length > 0) {
  throw new AggregateError(errors, "Validation failed.");
}
```

## Правила про читаемость API и TypeScript-кода

### Boolean names

[`consistent-boolean-name`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-boolean-name.md) из `v67.0.0` требует, чтобы boolean-переменные, параметры и функции начинались с понятного префикса. По умолчанию это `is`, `has`, `can`, `should`, `was`, `did`, `will`.

```js
// ❌
const completed = progress === 100;
function download(showProgress = false) {}

// ✅
const hasCompleted = progress === 100;
function download(shouldShowProgress = false) {}
```

По умолчанию properties не проверяются; их можно включить через `checkProperties`.

### `.has()` вместо `.get()` для existence checks

[`prefer-has-check`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-has-check.md) из `v67.0.0` предпочитает `.has()`, когда код проверяет именно существование значения, а не само значение.

```ts
// ❌
declare const map: Map<string, object>;

if (map.get(key)) {
  // …
}

// ✅
if (map.has(key)) {
  // …
}
```

Правило консервативное: например, `Map<string, boolean>` с `if (map.get(key))` остаётся валидным, потому что `false` — легальное сохранённое значение, а не отсутствие ключа.

### Labeled tuple elements должны быть последовательными

[`consistent-tuple-labels`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-tuple-labels.md) из `v69.0.0` проверяет TypeScript tuple labels. Если хотя бы один элемент tuple помечен именем, все элементы должны быть помечены.

```ts
// ❌
type Point = [x: number, number];

// ✅
type Point = [x: number, y: number];

// ✅
type Point = [number, number];
```

Автофикса нет: meaningful label нельзя надёжно угадать.

### Observer APIs вместо scroll/resize listeners с layout reads

[`prefer-observer-apis`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-observer-apis.md) из `v69.0.0` нацелен не на любые scroll/resize listeners, а только на те, которые синхронно читают layout.

```js
// ❌
window.addEventListener("resize", () => {
  element.classList.toggle("is-small", element.offsetWidth < 500);
});

// ✅
new ResizeObserver(entries => {
  for (const entry of entries) {
    entry.target.classList.toggle("is-small", entry.contentRect.width < 500);
  }
}).observe(element);
```

Обычный scroll position listener остаётся валидным:

```js
// ✅
window.addEventListener("scroll", () => {
  updateScrollPosition(window.scrollY);
});
```

## Практический вывод

Если проект уже использует Unicorn, эти релизы стоит воспринимать не как «ещё 139 stylistic checks», а как большой апдейт под современную платформу:

1. **Сначала проверьте runtime baseline.** `v66+` требует Node.js 22 и ESLint 10.4, а часть правил предлагает API, которые имеют смысл только на свежих runtime target: `Temporal`, `Promise.try()`, `Promise.withResolvers()`, `Set` methods, `RegExp.escape()`.
2. **Проверьте переименования в конфиге.** Минимум: `no-array-for-each` → `no-for-each`, `prevent-abbreviations` → `name-replacements`.
3. **Не включайте всё вслепую.** В списке есть правила, выключенные даже в recommended/unopinionated presets: например, `prefer-temporal`, `prefer-dispose`, `no-unsafe-dom-html`, `prefer-regexp-escape`. Для них лучше сначала сверить target browsers/Node и security model проекта.
4. **Но правила из v68/v69 про obvious bugs я бы смотрел в первую очередь.** `no-chained-comparison`, `no-array-sort-for-min-max`, `no-boolean-sort-comparator`, `no-xor-as-exponentiation`, `no-invalid-well-known-symbol-methods`, `prefer-aggregate-error` и `prefer-has-check` ловят ситуации, где код часто не делает то, что хотел автор.

## Полный список новых правил

### v66.0.0 — 74 правила

| Rule                                                                                                                                                                         | Что проверяет                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`class-reference-in-static-methods`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/class-reference-in-static-methods.md)                       | Enforce consistent class references in static methods.                                                                 |
| [`comment-content`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/comment-content.md)                                                           | Enforce better comment content.                                                                                        |
| [`consistent-class-member-order`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-class-member-order.md)                               | Enforce consistent class member order.                                                                                 |
| [`consistent-export-decorator-position`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-export-decorator-position.md)                 | Enforce consistent decorator position on exported classes.                                                             |
| [`consistent-function-style`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-function-style.md)                                       | Enforce function syntax by role.                                                                                       |
| [`consistent-optional-chaining`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-optional-chaining.md)                                 | Enforce consistent optional chaining for same-base member access.                                                      |
| [`explicit-timer-delay`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/explicit-timer-delay.md)                                                 | Enforce or disallow explicit `delay` argument for `setTimeout()` and `setInterval()`.                                  |
| [`id-match`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/id-match.md)                                                                         | Require identifiers to match a specified regular expression.                                                           |
| [`max-nested-calls`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/max-nested-calls.md)                                                         | Limit the depth of nested calls.                                                                                       |
| [`no-asterisk-prefix-in-documentation-comments`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-asterisk-prefix-in-documentation-comments.md) | Disallow asterisk prefixes in documentation comments.                                                                  |
| [`no-break-in-nested-loop`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-break-in-nested-loop.md)                                           | Disallow `break` and `continue` in nested loops and switches inside loops.                                             |
| [`no-computed-property-existence-check`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-computed-property-existence-check.md)                 | Disallow dynamic object property existence checks.                                                                     |
| [`no-confusing-array-with`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-confusing-array-with.md)                                           | Disallow confusing uses of `Array#with()`.                                                                             |
| [`no-declarations-before-early-exit`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-declarations-before-early-exit.md)                       | Disallow declarations before conditional early exits when they are only used after the exit.                           |
| [`no-duplicate-loops`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-duplicate-loops.md)                                                     | Disallow `.map()` and `.filter()` in `for…of` and `for await…of` loop headers.                                         |
| [`no-error-property-assignment`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-error-property-assignment.md)                                 | Disallow assigning to built-in error properties.                                                                       |
| [`no-global-object-property-assignment`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-global-object-property-assignment.md)                 | Disallow assigning properties on the global object.                                                                    |
| [`no-incorrect-template-string-interpolation`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-incorrect-template-string-interpolation.md)     | Disallow incorrect template literal interpolation syntax.                                                              |
| [`no-mismatched-map-key`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-mismatched-map-key.md)                                               | Disallow checking a Map key before accessing a different key.                                                          |
| [`no-negated-array-predicate`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-negated-array-predicate.md)                                     | Disallow negated array predicate calls.                                                                                |
| [`no-negated-comparison`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-negated-comparison.md)                                               | Disallow negated comparisons.                                                                                          |
| [`no-object-methods-with-collections`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-object-methods-with-collections.md)                     | Disallow `Object` methods with `Map` or `Set`.                                                                         |
| [`no-optional-chaining-on-undeclared-variable`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-optional-chaining-on-undeclared-variable.md)   | Disallow optional chaining on undeclared variables.                                                                    |
| [`no-redundant-comparison`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-redundant-comparison.md)                                           | Disallow comparisons made redundant by an equality check in the same logical AND.                                      |
| [`no-return-array-push`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-return-array-push.md)                                                 | Disallow returning the result of `Array#push()` with arguments.                                                        |
| [`no-subtraction-comparison`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-subtraction-comparison.md)                                       | Prefer comparing values directly over subtracting and comparing to `0`.                                                |
| [`no-top-level-side-effects`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-top-level-side-effects.md)                                       | Disallow top-level side effects in exported modules.                                                                   |
| [`no-undeclared-class-members`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-undeclared-class-members.md)                                   | Require class members to be declared.                                                                                  |
| [`no-unnecessary-global-this`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-global-this.md)                                     | Disallow unnecessary `globalThis` references.                                                                          |
| [`no-unnecessary-splice`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-splice.md)                                               | Disallow `Array#splice()` when simpler alternatives exist.                                                             |
| [`no-unreadable-new-expression`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unreadable-new-expression.md)                                 | Disallow unreadable `new` expressions.                                                                                 |
| [`no-unreadable-object-destructuring`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unreadable-object-destructuring.md)                     | Disallow unreadable object destructuring.                                                                              |
| [`no-unsafe-buffer-conversion`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unsafe-buffer-conversion.md)                                   | Prevent unsafe use of ArrayBuffer view `.buffer`.                                                                      |
| [`no-unsafe-dom-html`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unsafe-dom-html.md)                                                     | Disallow unsafe DOM HTML APIs.                                                                                         |
| [`no-unsafe-property-key`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unsafe-property-key.md)                                             | Disallow unsafe values as property keys.                                                                               |
| [`no-unsafe-string-replacement`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unsafe-string-replacement.md)                                 | Disallow non-literal replacement values in `String#replace()` and `String#replaceAll()`.                               |
| [`no-useless-boolean-cast`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-boolean-cast.md)                                           | Disallow unnecessary `Boolean()` casts in array predicate callbacks.                                                   |
| [`no-useless-concat`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-concat.md)                                                       | Disallow useless concatenation of literals.                                                                            |
| [`no-useless-else`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-else.md)                                                           | Disallow `else` after a statement that exits.                                                                          |
| [`no-useless-recursion`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-recursion.md)                                                 | Disallow simple recursive function calls that can be replaced with a loop.                                             |
| [`no-useless-template-literals`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-template-literals.md)                                 | Disallow useless template literal expressions.                                                                         |
| [`prefer-add-event-listener-options`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-add-event-listener-options.md)                       | Prefer an options object over a boolean in `.addEventListener()`.                                                      |
| [`prefer-array-from-map`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-from-map.md)                                               | Prefer using the `Array.from()` mapping function argument.                                                             |
| [`prefer-await`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-await.md)                                                                 | Prefer `await` over promise chaining.                                                                                  |
| [`prefer-direct-iteration`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-direct-iteration.md)                                           | Prefer direct iteration over default iterator method calls.                                                            |
| [`prefer-dispose`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-dispose.md)                                                             | Prefer using `using`/`await using` over manual `try`/`finally` resource disposal.                                      |
| [`prefer-dom-node-html-methods`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-dom-node-html-methods.md)                                 | Prefer `.getHTML()` and `.setHTML()` over `.innerHTML`.                                                                |
| [`prefer-early-return`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-early-return.md)                                                   | Prefer early returns over full-function conditional wrapping.                                                          |
| [`prefer-global-number-constants`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-global-number-constants.md)                             | Prefer global numeric constants over `Number` static properties.                                                       |
| [`prefer-identifier-import-export-specifiers`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-identifier-import-export-specifiers.md)     | Prefer identifiers over string literals in import and export specifiers.                                               |
| [`prefer-iterable-in-constructor`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-iterable-in-constructor.md)                             | Prefer passing iterables directly to constructors instead of filling empty collections.                                |
| [`prefer-iterator-to-array`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-iterator-to-array.md)                                         | Prefer `Iterator#toArray()` over temporary arrays from iterator spreads.                                               |
| [`prefer-location-assign`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-location-assign.md)                                             | Prefer `location.assign()` over assigning to `location.href`.                                                          |
| [`prefer-minimal-ternary`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-minimal-ternary.md)                                             | Prefer moving ternaries into the minimal varying part of an expression.                                                |
| [`prefer-number-coercion`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-number-coercion.md)                                             | Prefer `Number()` over `parseFloat()` and base-10 `parseInt()`.                                                        |
| [`prefer-number-is-safe-integer`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-number-is-safe-integer.md)                               | Prefer `Number.isSafeInteger()` over integer checks.                                                                   |
| [`prefer-object-define-properties`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-object-define-properties.md)                           | Prefer `Object.defineProperties()` over multiple `Object.defineProperty()` calls.                                      |
| [`prefer-object-destructuring-defaults`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-object-destructuring-defaults.md)                 | Prefer object destructuring defaults over default object literals with spread.                                         |
| [`prefer-object-iterable-methods`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-object-iterable-methods.md)                             | Prefer the most specific `Object` iterable method.                                                                     |
| [`prefer-path2d`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-path2d.md)                                                               | Prefer `Path2D` for repeatedly drawn canvas paths.                                                                     |
| [`prefer-private-class-fields`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-private-class-fields.md)                                   | Prefer private class fields over the underscore-prefix convention.                                                     |
| [`prefer-scoped-selector`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-scoped-selector.md)                                             | Prefer `:scope` when using element query selector methods.                                                             |
| [`prefer-short-arrow-method`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-short-arrow-method.md)                                       | Prefer arrow function properties over methods with a single return.                                                    |
| [`prefer-simple-sort-comparator`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-simple-sort-comparator.md)                               | Prefer a simple comparison function for `Array#sort()`.                                                                |
| [`prefer-single-array-predicate`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-single-array-predicate.md)                               | Prefer a single `Array#some()` or `Array#every()` with a combined predicate.                                           |
| [`prefer-single-object-destructuring`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-single-object-destructuring.md)                     | Prefer a single object destructuring declaration per local const source.                                               |
| [`prefer-smaller-scope`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-smaller-scope.md)                                                 | Prefer declaring variables in the smallest possible scope.                                                             |
| [`prefer-temporal`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-temporal.md)                                                           | Prefer `Temporal` over `Date`.                                                                                         |
| [`prefer-type-literal-last`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-type-literal-last.md)                                         | Require type literals to be last in union and intersection types.                                                      |
| [`prefer-uint8array-base64`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-uint8array-base64.md)                                         | Prefer `Uint8Array#toBase64()` and `Uint8Array.fromBase64()` over `atob()`, `btoa()`, and `Buffer` base64 conversions. |
| [`prefer-unicode-code-point-escapes`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-unicode-code-point-escapes.md)                       | Prefer Unicode code point escapes over legacy escape sequences.                                                        |
| [`prefer-url-href`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-url-href.md)                                                           | Prefer `URL#href` over stringifying a `URL`.                                                                           |
| [`require-array-sort-compare`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/require-array-sort-compare.md)                                     | Require a compare function when calling `Array#sort()` or `Array#toSorted()`.                                          |
| [`require-proxy-trap-boolean-return`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/require-proxy-trap-boolean-return.md)                       | Require boolean-returning Proxy traps to return booleans.                                                              |

### v67.0.0 — 16 правил

| Rule                                                                                                                                                       | Что проверяет                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`consistent-boolean-name`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-boolean-name.md)                         | Enforce consistent naming for boolean names.                                          |
| [`logical-assignment-operators`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/logical-assignment-operators.md)               | Require or disallow logical assignment operator shorthand.                            |
| [`no-array-splice`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-splice.md)                                         | Prefer `Array#toSpliced()` over `Array#splice()`.                                     |
| [`no-invalid-argument-count`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-invalid-argument-count.md)                     | Disallow calling functions and constructors with an invalid number of arguments.      |
| [`no-non-function-verb-prefix`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-non-function-verb-prefix.md)                 | Disallow non-function values with function-style verb prefixes.                       |
| [`no-top-level-assignment-in-function`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-top-level-assignment-in-function.md) | Disallow assigning to top-level variables from inside functions.                      |
| [`no-uncalled-method`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-uncalled-method.md)                                   | Disallow referencing methods without calling them.                                    |
| [`no-unreadable-for-of-expression`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unreadable-for-of-expression.md)         | Disallow unreadable iterable expressions in `for…of` and `for await…of` loop headers. |
| [`no-useless-coercion`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-coercion.md)                                 | Disallow useless type coercions of values that are already of the target type.        |
| [`no-useless-continue`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-continue.md)                                 | Disallow useless `continue` statements.                                               |
| [`no-useless-override`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-override.md)                                 | Disallow useless overrides of class methods.                                          |
| [`operator-assignment`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/operator-assignment.md)                                 | Require assignment operator shorthand where possible.                                 |
| [`prefer-array-slice`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-slice.md)                                   | Prefer `Array#slice()` over `Array#splice()` when reading from the returned array.    |
| [`prefer-else-if`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-else-if.md)                                           | Prefer `else if` over adjacent `if` statements with related conditions.               |
| [`prefer-has-check`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-has-check.md)                                       | Prefer `.has()` when checking existence.                                              |
| [`prefer-map-from-entries`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-map-from-entries.md)                         | Prefer `new Map()` over `Object.fromEntries()` when using the result as a map.        |

### v68.0.0 — 37 правил

| Rule                                                                                                                                                         | Что проверяет                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [`consistent-conditional-object-spread`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-conditional-object-spread.md) | Enforce consistent conditional object spread style.                                                                     |
| [`default-export-style`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/default-export-style.md)                                 | Enforce consistent default export declarations.                                                                         |
| [`no-accidental-bitwise-operator`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-accidental-bitwise-operator.md)             | Disallow bitwise operators where a logical operator was likely intended.                                                |
| [`no-array-concat-in-loop`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-concat-in-loop.md)                           | Disallow array accumulation with `Array#concat()` in loops.                                                             |
| [`no-array-front-mutation`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-front-mutation.md)                           | Disallow front-of-array mutation.                                                                                       |
| [`no-array-sort-for-min-max`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-sort-for-min-max.md)                       | Disallow sorting arrays to get the minimum or maximum value.                                                            |
| [`no-boolean-sort-comparator`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-boolean-sort-comparator.md)                     | Disallow boolean-returning sort comparators.                                                                            |
| [`no-chained-comparison`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-chained-comparison.md)                               | Disallow chained comparisons such as `a < b < c`.                                                                       |
| [`no-collection-bracket-access`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-collection-bracket-access.md)                 | Disallow accessing `Map`, `Set`, `WeakMap`, and `WeakSet` entries with bracket notation.                                |
| [`no-constant-zero-expression`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-constant-zero-expression.md)                   | Disallow arithmetic and bitwise operations that always evaluate to `0`.                                                 |
| [`no-double-comparison`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-double-comparison.md)                                 | Disallow two comparisons of the same operands that can be combined into one.                                            |
| [`no-duplicate-if-branches`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-duplicate-if-branches.md)                         | Disallow duplicate adjacent branches in if chains.                                                                      |
| [`no-duplicate-logical-operands`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-duplicate-logical-operands.md)               | Disallow adjacent duplicate operands in logical expressions.                                                            |
| [`no-impossible-length-comparison`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-impossible-length-comparison.md)           | Disallow impossible comparisons against `.length` or `.size`.                                                           |
| [`no-invalid-character-comparison`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-invalid-character-comparison.md)           | Disallow comparing a single character from a string to a multi-character string.                                        |
| [`no-loop-iterable-mutation`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-loop-iterable-mutation.md)                       | Disallow mutating a loop iterable during iteration.                                                                     |
| [`no-misrefactored-assignment`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-misrefactored-assignment.md)                   | Disallow misrefactored compound assignments where the target is duplicated in the right-hand side.                      |
| [`no-nonstandard-builtin-properties`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-nonstandard-builtin-properties.md)       | Disallow non-standard properties on built-in objects.                                                                   |
| [`no-selector-as-dom-name`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-selector-as-dom-name.md)                           | Disallow selector syntax in DOM names.                                                                                  |
| [`no-unnecessary-boolean-comparison`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-boolean-comparison.md)       | Disallow unnecessary comparisons against boolean literals.                                                              |
| [`no-useless-compound-assignment`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-compound-assignment.md)             | Disallow useless compound assignments such as `x += 0`.                                                                 |
| [`no-useless-delete-check`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-delete-check.md)                           | Disallow unnecessary existence checks before deletion.                                                                  |
| [`no-useless-logical-operand`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-logical-operand.md)                     | Disallow unnecessary operands in logical expressions involving boolean literals.                                        |
| [`no-xor-as-exponentiation`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-xor-as-exponentiation.md)                         | Disallow the bitwise XOR operator where exponentiation was likely intended.                                             |
| [`prefer-array-from-async`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-from-async.md)                           | Prefer `Array.fromAsync()` over `for await…of` array accumulation.                                                      |
| [`prefer-array-iterable-methods`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-iterable-methods.md)               | Prefer iterating an array directly or with `Array#keys()` over `Array#entries()` when the index or value is unused.     |
| [`prefer-boolean-return`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-boolean-return.md)                               | Prefer directly returning boolean expressions over `if` statements.                                                     |
| [`prefer-continue`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-continue.md)                                           | Prefer early continues over whole-loop conditional wrapping.                                                            |
| [`prefer-flat-math-min-max`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-flat-math-min-max.md)                         | Prefer flat `Math.min()` and `Math.max()` calls over nested calls.                                                      |
| [`prefer-hoisting-branch-code`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-hoisting-branch-code.md)                   | Prefer moving code shared by all branches of an `if` statement out of the branches.                                     |
| [`prefer-math-constants`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-math-constants.md)                               | Prefer `Math` constants over their approximate numeric values.                                                          |
| [`prefer-promise-with-resolvers`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-promise-with-resolvers.md)               | Prefer `Promise.withResolvers()` when extracting resolver functions from `new Promise()`.                               |
| [`prefer-regexp-escape`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-regexp-escape.md)                                 | Prefer `RegExp.escape()` for escaping strings to use in regular expressions.                                            |
| [`prefer-single-replace`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-single-replace.md)                               | Enforce combining multiple single-character replacements into a single `String#replaceAll()` with a regular expression. |
| [`prefer-unary-minus`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-unary-minus.md)                                     | Prefer the unary minus operator over multiplying or dividing by `-1`.                                                   |
| [`prefer-url-can-parse`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-url-can-parse.md)                                 | Prefer `URL.canParse()` over constructing a `URL` in a try/catch for validation.                                        |
| [`prefer-while-loop-condition`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-while-loop-condition.md)                   | Prefer putting the condition in the while statement.                                                                    |

### v69.0.0 — 12 правил

| Rule                                                                                                                                                         | Что проверяет                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [`consistent-tuple-labels`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-tuple-labels.md)                           | Enforce consistent labels on tuple type elements.                                               |
| [`no-invalid-well-known-symbol-methods`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-invalid-well-known-symbol-methods.md) | Disallow invalid implementations of well-known symbol methods.                                  |
| [`no-late-event-control`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-late-event-control.md)                               | Disallow event-control method calls after the synchronous event dispatch has finished.          |
| [`prefer-abort-signal-timeout`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-abort-signal-timeout.md)                   | Prefer `AbortSignal.timeout()` over manually aborting an `AbortController` with `setTimeout()`. |
| [`prefer-aggregate-error`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-aggregate-error.md)                             | Prefer `AggregateError` when throwing collected errors.                                         |
| [`prefer-dom-node-replace-children`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-dom-node-replace-children.md)         | Prefer `.replaceChildren()` when emptying DOM children.                                         |
| [`prefer-error-is-error`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-error-is-error.md)                               | Prefer `Error.isError()` when checking for errors.                                              |
| [`prefer-observer-apis`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-observer-apis.md)                                 | Prefer observer APIs over resize and scroll listeners with layout reads.                        |
| [`prefer-promise-try`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-promise-try.md)                                     | Prefer `Promise.try()` over promise-wrapping boilerplate.                                       |
| [`prefer-set-methods`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-methods.md)                                     | Prefer `Set` methods for Set operations.                                                        |
| [`prefer-toggle-attribute`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-toggle-attribute.md)                           | Prefer using `Element#toggleAttribute()` to toggle attributes.                                  |
| [`prefer-url-search-parameters`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-url-search-parameters.md)                 | Prefer `URLSearchParams` over manually splitting query strings.                                 |

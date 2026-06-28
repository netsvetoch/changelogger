---
author: Артём Нецветаев
pubDatetime: 2026-06-28T15:44:59.000Z
title: "ESLint 10.6.0: новый режим для no-constant-binary-expression"
slug: eslint-v10-6-0
featured: false
draft: false
tags:
  - release
  - eslint
  - javascript
description: "Обзор минорного релиза ESLint 10.6.0: опция checkRelationalComparisons, новые проверки Symbol и BigInt, а также исправления ложных срабатываний правил при затенённых глобальных именах."
---

ESLint выпустил минорный релиз [`v10.6.0`](https://github.com/eslint/eslint/releases/tag/v10.6.0). Главная пользовательская часть релиза — развитие правила `no-constant-binary-expression`: оно научилось замечать ещё больше константных выражений и получило новую опцию для сравнений через `<`, `<=`, `>` и `>=`.

Источники для обзора — GitHub Release [`eslint/eslint@v10.6.0`](https://github.com/eslint/eslint/releases/tag/v10.6.0), diff связанных PR и тесты из коммитов релиза. Релиз минорный, поэтому `featured: false`.

## `no-constant-binary-expression`: опциональная проверка relational comparisons

В [#20948](https://github.com/eslint/eslint/pull/20948) у правила `no-constant-binary-expression` появилась опция `checkRelationalComparisons`. По умолчанию она выключена (`false`), чтобы не менять поведение существующих конфигураций, но при включении правило начинает репортить сравнения, где обе стороны статически известны как литералы.

Поддержанные операторы: `<`, `<=`, `>` и `>=`. В типах ESLint это отражено как объектная опция правила:

```ts
"no-constant-binary-expression": [
  "error",
  {
    checkRelationalComparisons: true,
  },
];
```

Документация и тесты показывают такие новые ошибки:

```js
/* eslint no-constant-binary-expression: ["error", { "checkRelationalComparisons": true }] */

const value1 = 1 < 2;
const value2 = "a" >= "b";
const value3 = true > false;

// Частая ошибка при смешивании ?? и >: выражение читается не так,
// как обычно ожидает автор кода.
const hasStreak = profile.streak ?? 0 > 1;
```

Исправленный вариант из документации — явно расставить скобки вокруг nullish coalescing, чтобы сравнение применялось к результату `??`:

```js
/* eslint no-constant-binary-expression: ["error", { "checkRelationalComparisons": true }] */

const hasStreak = (profile.streak ?? 0) > 1;
```

Внутри правила добавлена функция `isStaticLiteral()`: она считает статически известными обычные `Literal`, унарные литералы с `-`, `+` и `~`, глобальный `undefined`, а также template literal без выражений. Поэтому правило может поймать не только `1 < 2`, но и, например, сравнение двух пустых template literals или `undefined < 5`, если `undefined` не затенён локальной переменной.

## `Symbol()` и `BigInt()` теперь считаются заведомо non-nullish

В [#20981](https://github.com/eslint/eslint/pull/20981) то же правило стало учитывать вызовы глобальных `Symbol()` и `BigInt()` рядом с уже поддержанными `String()` и `Number()`.

Практический эффект: ESLint теперь понимает, что результат глобальных `Symbol(x)` и `BigInt(x)` не будет `null` или `undefined`, поэтому такие проверки становятся константными:

```js
/* eslint no-constant-binary-expression: "error" */

Symbol(x) ?? fallback;
BigInt(x) ?? fallback;

Symbol(x) != null;
BigInt(x) != undefined;

true === Symbol(x);
Symbol(x) === null;
BigInt(x) === undefined;
```

Важная деталь из тестов: если `Symbol` или `BigInt` затенены локальной функцией, правило не делает вид, что это встроенный глобальный API. Например, `function Symbol(n) { return n; } Symbol(x) ?? foo` остаётся валидным тест-кейсом, потому что локальная функция может вернуть что угодно.

## Меньше ложных срабатываний при затенённых globals

Заметная часть исправлений в `10.6.0` — аккуратная проверка, что правило действительно смотрит на глобальное имя, а не на параметр функции, локальную переменную или отключённый global из `languageOptions.globals`.

### `no-extra-boolean-cast` и локальный `Boolean`

В [#21013](https://github.com/eslint/eslint/pull/21013) правило `no-extra-boolean-cast` стало использовать `sourceCode.isGlobalReference(node.callee)` перед тем, как считать вызов `Boolean(...)` лишним приведением.

Теперь такие случаи не должны репортиться:

```js
function foo(Boolean) {
  if (Boolean(bar)) {
    // Boolean — параметр функции, а не global Boolean.
  }
}

let Boolean = x => x;
if (Boolean(bar)) {
  // локальная функция тоже не обязана быть boolean-cast'ом
}
```

Тесты также покрывают режим `enforceForLogicalOperands: true`, чтобы ложное срабатывание не возвращалось внутри логических выражений вроде `bar && Boolean(baz)`.

### `radix`, `no-throw-literal` и `prefer-promise-reject-errors` с локальным `undefined`

Сразу несколько правил получили одну и ту же защиту: имя `undefined` считается специальным только если это глобальная ссылка.

- [#21011](https://github.com/eslint/eslint/pull/21011): `radix` больше не считает `parseInt("10", undefined)` заведомо валидным, если `undefined` — параметр функции.
- [#21010](https://github.com/eslint/eslint/pull/21010): `no-throw-literal` не ругается на `throw undefined`, когда `undefined` затенён локальным параметром и теоретически может быть объектом `Error`.
- [#21006](https://github.com/eslint/eslint/pull/21006): `prefer-promise-reject-errors` применяет ту же проверку к причине reject'а.

Пример из новых тестов:

```js
function f(undefined) {
  Promise.reject(undefined);
}

function foo(undefined) {
  throw undefined;
}
```

До исправлений такие правила могли рассматривать идентификатор как настоящий `undefined`, хотя в JavaScript это обычное локальное имя в области видимости функции.

### `prefer-promise-reject-errors` и локальный `Promise`

В [#21003](https://github.com/eslint/eslint/pull/21003) правило `prefer-promise-reject-errors` стало проверять, что `Promise` в `Promise.reject(...)` — именно глобальный `Promise`. Это убирает ложные срабатывания для userland-объектов и классов:

```js
function f(Promise) {
  return Promise.reject("x");
}

{
  class Promise {
    static reject(x) {
      return x;
    }
  }

  Promise.reject("x");
}
```

Отдельно правило проверяет глобальность callee в executor callback, чтобы `new Promise((resolve, reject) => reject("x"))` не анализировался как настоящий Promise-конструктор, если `Promise` был затенён.

## Исправления autofix и suggestions

### `prefer-exponentiation-operator`: безопасный autofix в начале statement

[#20997](https://github.com/eslint/eslint/pull/20997) исправляет autofix правила `prefer-exponentiation-operator`, которое переписывает `Math.pow(a, b)` в `a ** b`.

Проблема была в синтаксически опасных базовых выражениях в начале statement: object literal, function expression, class expression, array/member access, regexp или template literal могли потребовать дополнительных скобок или ведущей точки с запятой. В код правила добавлен набор `continuationChars` для `(`, `[`, `/` и `` ` ``, а также проверка `astUtils.needsPrecedingSemicolon()`.

Новые тесты фиксируют такие варианты autofix:

```js
// object literal в начале statement требует скобки
Math.pow({ a: 1 }.a, 2);
// фикс: ({a:1}.a**2);

// после предыдущего statement нужна ведущая точка с запятой,
// если замена начинается с символа-продолжения
foo;
Math.pow([a, b].find(fn), c);
// фикс: foo;
// ;[a, b].find(fn)**c
```

Также правило теперь дополнительно скобит выражения, которые начинаются с `function`, `class` или `{`, если они становятся началом expression statement. Это предотвращает invalid autofix вместо простого cosmetic rewrite.

### `no-promise-executor-return`: не предлагать invalid class expression

[#21008](https://github.com/eslint/eslint/pull/21008) уточняет suggestion у `no-promise-executor-return`. Правило не должно предлагать обернуть в `{ ... }` безымянную `ClassExpression`, потому что `() => new Promise(() => {class {}})` — невалидный JavaScript.

Теперь для такого случая suggestions пустые:

```js
() => new Promise(() => class {});
```

А для именованного класса suggestion остаётся доступным:

```js
() => new Promise(() => class Foo {});
// suggestion: () => new Promise(() => {class Foo {}});
```

## Точнее `max-nested-callbacks` и диапазон `max-classes-per-file`

В `max-nested-callbacks` вошли два близких исправления:

- [#20979](https://github.com/eslint/eslint/pull/20979) перестал считать IIFE вроде `(() => {})();` callback'ом. В коде правила добавлена проверка `parent.callee === node`: если функция сама является callee вызова, это немедленно вызываемая функция, а не аргумент-callback.
- [#20995](https://github.com/eslint/eslint/pull/20995) исправил учёт внутренних non-callback функций. В тестах для `foo(function() { bar(function() { baz(function() { const qux = function() {}; }); }); });` теперь репортится только вложенность реальных callback-аргументов, а локальная `function() {}` в переменной не увеличивает callback depth.

Для `max-classes-per-file` в [#21002](https://github.com/eslint/eslint/pull/21002) восстановлен диапазон репорта: вместо слишком широкого или потерянного range правило снова использует координаты от первой до последней class declaration/expression в файле. Это важно для IDE и редакторов, которые подсвечивают именно range ошибки, а не только строку с сообщением.

## Что обновлять в конфигурации

Если у вас уже включено `no-constant-binary-expression`, поведение по relational comparisons не изменится само: новая проверка opt-in. Чтобы включить её в flat config, добавьте объект опций:

```js
export default [
  {
    rules: {
      "no-constant-binary-expression": [
        "error",
        { checkRelationalComparisons: true },
      ],
    },
  },
];
```

Командам, которые активно используют autofix ESLint в CI, полезно обновиться ради исправления `prefer-exponentiation-operator`: релиз снижает риск того, что автоматическая замена `Math.pow()` создаст синтаксически невалидный файл в начале statement.

Полный список изменений доступен в [GitHub Release v10.6.0](https://github.com/eslint/eslint/releases/tag/v10.6.0).

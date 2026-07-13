---
author: Артём Нецветаев
pubDatetime: 2026-07-13T09:41:35.000Z
title: "ESLint 10.7.0: пользовательские ошибки, callbacks в конструкторах и точнее проверки правил"
slug: eslint-v10-7-0
featured: false
draft: false
tags:
  - release
  - eslint
  - javascript
description: "Что изменилось в ESLint 10.7.0: errorClassNames для preserve-caught-error, проверка callbacks в new-вызовах, расширенный radix и исправления ложных срабатываний правил."
---

ESLint выпустил минорный релиз [`v10.7.0`](https://github.com/eslint/eslint/releases/tag/v10.7.0). В нём появились две новые настройки существующих правил, улучшилась проверка `parseInt`, а несколько правил стали лучше различать глобальные встроенные объекты и локальные переменные с такими же именами.

Материал основан на [GitHub Release v10.7.0](https://github.com/eslint/eslint/releases/tag/v10.7.0), [сравнении с v10.6.0](https://github.com/eslint/eslint/compare/v10.6.0...v10.7.0), исходных diff коммитов и документации правил в теге релиза. Это минорный релиз, поэтому `featured: false`.

## `preserve-caught-error`: проверка собственных классов ошибок

Раньше [`preserve-caught-error`](https://eslint.org/docs/latest/rules/preserve-caught-error) проверял только встроенные классы `Error`, включая `AggregateError`. В [#21032](https://github.com/eslint/eslint/pull/21032) появилась опция `errorClassNames`: список имён дополнительных классов, для которых нужно сохранять исходную ошибку в свойстве `cause`.

Строка означает, что options-объект конструктора находится на второй позиции — как у обычного `Error`. Объект позволяет указать другую позицию через 1-индексированный `argumentPosition`:

```js
export default [
  {
    rules: {
      "preserve-caught-error": [
        "error",
        {
          errorClassNames: [
            "AppError",
            { name: "APIError", argumentPosition: 3 },
          ],
        },
      ],
    },
  },
];
```

Для такой конфигурации ESLint проверит оба варианта:

```js
try {
  await request();
} catch (err) {
  throw new AppError("Request failed", { cause: err });
}

class APIError extends Error {
  constructor(message, statusCode, options) {
    super(message, options);
    this.statusCode = statusCode;
  }
}

try {
  await request();
} catch (err) {
  // options находится третьим аргументом
  throw new APIError("Request failed", 500, { cause: err });
}
```

Для строковых имён ESLint предполагает второй аргумент; для объектной записи позиция задаётся явно. Правило также понимает классы в member expression, например `new errors.AppError(...)`, если имя `AppError` есть в списке. Как и прежде, наличие `cause` проверяется при переброске ошибки из `catch`, а suggestion может добавить или заменить объект options.

У опции есть важное ограничение: правило сопоставляет классы по имени в AST и не выполняет полноценный анализ типов. Поэтому локальный класс, затеняющий импортированный `AppError`, может дать ложное срабатывание. Для встроенных ошибок в этом же релизе, наоборот, добавлена проверка глобальной ссылки.

Кроме того, исправлен suggestion для аргументов, обёрнутых дополнительными скобками. Например, для `new Error(("failed"))` `{ cause: err }` теперь вставляется после закрывающих скобок аргумента, а не внутрь них:

```js
// ESLint 10.7.0 предлагает синтаксически корректный результат:
throw new Error("failed", { cause: err });
```

## `max-nested-callbacks`: считать callbacks в `new`

Опция `checkConstructorCallCallbacks` у [`max-nested-callbacks`](https://eslint.org/docs/latest/rules/max-nested-callbacks) по умолчанию равна `false`, поэтому существующие конфигурации не меняют поведение. Если включить её, callback-функции, переданные в `NewExpression`, тоже увеличивают глубину вложенности:

```js
export default [
  {
    rules: {
      "max-nested-callbacks": [
        "error",
        {
          max: 1,
          checkConstructorCallCallbacks: true,
        },
      ],
    },
  },
];
```

При такой настройке этот код нарушает лимит: callback внутри `setTimeout` имеет глубину 1, а callback конструктора `Promise` — глубину 2.

```js
setTimeout(() => {
  new Promise(() => {});
});
```

Без `checkConstructorCallCallbacks` `new Promise(() => {})` не учитывался как вложенный callback. IIFE по-прежнему не считается callback: функция, являющаяся самим `callee`, исключается из подсчёта.

## `radix`: больше форм `Number.parseInt` и точнее числовой аргумент

Правило [`radix`](https://eslint.org/docs/latest/rules/radix) теперь распознаёт вычисляемый доступ к `Number.parseInt`. Поэтому варианты с обычной строкой и template literal анализируются так же, как точечная запись:

```js
/* eslint radix: "error" */

Number["parseInt"]("10");
Number[`parseInt`]("10");
```

Оба вызова получают suggestion с добавлением основания `10`:

```js
Number["parseInt"]("10", 10);
Number[`parseInt`]("10", 10);
```

Поддерживаются и варианты с optional chaining, например `Number?.["parseInt"]("10")`. При этом затенённый локальный `Number` не трактуется как глобальный встроенный объект.

В [#21030](https://github.com/eslint/eslint/pull/21030) проверка допустимых оснований стала учитывать знаковые числовые литералы. Теперь правило вычисляет `+` и `-` перед числовым литералом и отклоняет значения вне диапазона `2…36`, ноль и нецелые числа:

```js
parseInt("10", -1); // ошибка: недопустимое основание
parseInt("10", +37); // ошибка
parseInt("10", -0); // ошибка
parseInt("10", +10.5); // ошибка
```

Для динамических выражений вроде `+radix` статический вывод не делается. Ещё одно исправление касается spread-аргументов: если spread стоит до позиции основания, например `parseInt(...args)` или `parseInt("10", ...args)`, правило не делает предположений о фактических аргументах и не сообщает ложную ошибку. Если же основание уже явно задано до spread, проверка сохраняется:

```js
parseInt("10", 1, ...args); // недопустимое основание 1
```

## `no-compare-neg-zero`: suggestions вместо только сообщения

Правило [`no-compare-neg-zero`](https://eslint.org/docs/latest/rules/no-compare-neg-zero) теперь имеет suggestions. Для любого сравнения с `-0` ESLint предлагает заменить `-0` на `0`, сохранив обычную семантику сравнения:

```js
value === -0;
// suggestion: value === 0
```

Для строгих сравнений `===` и `!==` появляется также семантически более точная альтернатива через `Object.is`:

```js
value === -0; // suggestion: Object.is(value, -0)
value !== -0; // suggestion: !Object.is(value, -0)
```

Suggestion с `Object.is` предлагается только если `Object` не затенён и в выражении нет комментариев, которые могли бы потеряться при замене. Для нестрогих операторов (`==`, `!=`, `<`, `<=`, `>`, `>=`) остаётся безопасная замена `-0` на `0`.

## Исправления ложных срабатываний из-за затенённых имён

В нескольких правилах ESLint 10.7.0 стал явно проверять, что идентификатор указывает на глобальный объект, а не на параметр, локальную переменную или отключённый global.

- [`no-control-regex`](https://github.com/eslint/eslint/commit/a3172b69c7db63ea0321355543e3f527c7d8b76a) и [`no-invalid-regexp`](https://github.com/eslint/eslint/commit/e35b05f1961dcd691611bd68b6ff8a87072d6f76) больше не анализируют вызов `RegExp`, если `RegExp` затенён:

  ```js
  function check(RegExp) {
    RegExp("[", "z");
  }
  ```

- [`prefer-numeric-literals`](https://github.com/eslint/eslint/commit/8859bafb018e2b23b5110d52e491b69b94ad890a) не предлагает переписывать локальный `parseInt` или `Number.parseInt` в числовой литерал.
- [`use-isnan`](https://github.com/eslint/eslint/commit/a9e5961050676ef29dba9649dfcd7233d21760c7) не считает локальные `NaN` и `Number.NaN` встроенными значениями. Это распространяется на сравнения, `switch` и опцию `enforceForIndexOf`.
- В [`class-methods-use-this`](https://github.com/eslint/eslint/commit/3e7bf15e69e6d3a2c8832356bcc2e9903cc4eede) `ignoreClassesWithImplements` теперь применяется не только к `class`-объявлениям, но и к class expressions:

  ```js
  const Foo = class implements Bar {
    method() {}
  };
  ```

  Для TypeScript-класса с `implements` и опцией `ignoreClassesWithImplements: "all"` метод больше не требует фиктивного `this`.

## Другие изменения правил и документации

- [`eqeqeq`](https://github.com/eslint/eslint/commit/75ec753226010867270787b412f3dae412e421e6) теперь распознаёт статические template literals как строки в режиме `smart`. Например, `` `hello` == 'world' `` получает suggestion с `===`. Отдельно исправлена настройка `null`: с `{ null: "never" }` правило больше не репортит неравенства вроде `a >= null`, `a + null` или `null instanceof Foo`.
- [`no-implicit-coercion`](https://github.com/eslint/eslint/commit/d1f637eca27e523d613991c6bea5b8726b810e4c) добавляет скобки вокруг sequence expression в recommendation. Для `!!(a, b)` suggestion теперь — `Boolean((a, b))`, а не некорректное `Boolean(a, b)`.
- В документации ESLint появились разделы о migration codemods для перехода на v9 и v10. Также исправлена маска `**/.js` на `**/*.js` в руководстве по config files.

Подробный список коммитов и изменений доступен в [GitHub Release ESLint v10.7.0](https://github.com/eslint/eslint/releases/tag/v10.7.0).

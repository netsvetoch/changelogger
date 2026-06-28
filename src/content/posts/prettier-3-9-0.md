---
author: Артём Нецветаев
pubDatetime: 2026-06-28T13:57:55.000Z
title: "Prettier 3.9: крупные обновления парсеров и улучшения форматирования"
slug: prettier-3-9-0
featured: false
draft: false
tags:
  - release
  - prettier
  - formatter
description: "Перевод статьи о релизе Prettier 3.9.0: новые парсеры Markdown, YAML, Flow и GraphQL, улучшения JavaScript/TypeScript, HTML, CSS, Markdown и CLI."
---

> Это перевод статьи [«Prettier 3.9: Major parser upgrades and Formatting improvements»](https://prettier.io/blog/2026/06/27/3.9.0), ссылка на которую указана в GitHub Release [`prettier/prettier@3.9.0`](https://github.com/prettier/prettier/releases/tag/3.9.0). Оригинальный релиз также содержит [diff между 3.8.5 и 3.9.0](https://github.com/prettier/prettier/compare/3.8.5...3.9.0).

Мы рады объявить Prettier 3.9!

Этот релиз приносит крупные обновления парсеров для Markdown, YAML, Flow, GraphQL и Angular, а также улучшения форматирования JavaScript и TypeScript — особенно в режиме `--no-semi`.

Если Prettier полезен вам в работе, команда проекта просит рассмотреть [спонсорство через OpenCollective](https://opencollective.com/prettier) или поддержку upstream-проектов, на которые опирается Prettier. Эти вклады помогают продолжать развивать инструмент для всех пользователей.

Спасибо за поддержку! ❤️

Напоминание: при установке или обновлении Prettier [настоятельно рекомендуется](https://prettier.io/docs/install#summary) указывать точную версию в `package.json`: `"prettier": "3.9.0"`, а не `"prettier": "^3.9.0"`.

Если вы используете [`@prettier/plugin-oxc`](https://www.npmjs.com/package/@prettier/plugin-oxc) или [`@prettier/plugin-hermes`](https://www.npmjs.com/package/@prettier/plugin-hermes), не забудьте обновить их тоже, чтобы новые правила форматирования применялись корректно.

## Главное

### Markdown: переход на актуальный micromark

Prettier обновил Markdown-парсер с устаревшего `remark-parse` v8 на современный `micromark` v4 ([#18277](https://github.com/prettier/prettier/pull/18277)). Это заметно улучшает совместимость с CommonMark и GFM, исправляет много давних ошибок парсинга и закладывает более прочную основу для будущих улучшений.

Команда отдельно благодарит [@seiyab](https://github.com/seiyab), [@j-f1](https://github.com/j-f1) и всех, кто участвовал в этой давно ожидаемой миграции.

Важно: базовый Markdown-парсер уже обновлён, но [миграция MDX-парсера](https://github.com/prettier/prettier/pull/18533) ещё не завершена. Если вы хорошо знакомы с экосистемой unified, micromark или MDX, проект будет рад помощи.

### YAML: обновление зависимости `yaml` до v2

YAML-парсер теперь использует `yaml` v2 ([#18419](https://github.com/prettier/prettier/pull/18419)). Это исправляет множество давних проблем парсинга.

Большая часть работы стала возможной благодаря изменениям в [`yaml-unist-parser`](https://github.com/prettier/yaml-unist-parser/pull/301), сделанным [@ota-meshi](https://github.com/ota-meshi).

### GraphQL: поддержка GraphQL.js v17

Prettier теперь полноценно поддерживает новые синтаксические возможности из GraphQL.js v17 ([#19171](https://github.com/prettier/prettier/pull/19171), [#19297](https://github.com/prettier/prettier/pull/19297)): директивы на определениях директив, аргументы фрагментов и другие расширения.

Например, аргументы фрагментов теперь больше не ломают парсер:

```gql
# Input
fragment variableProfilePic on User {
  ...dynamicProfilePic(size: $size)
}

# Prettier 3.8
SyntaxError: Syntax Error: Expected Name, found "(". (2:23)

# Prettier 3.9
fragment variableProfilePic on User {
  ...dynamicProfilePic(size: $size)
}
```

Поддержаны и директивы на определениях директив, включая `extend directive`:

```gql
# Input
directive @a @b on QUERY
extend directive @a @b

# Prettier 3.8
Error: Syntax Error: Expected "on", found "@".

# Prettier 3.9
directive @a @b on QUERY
extend directive @a @b
```

### Flow: новый Rust-based parser

Prettier теперь использует новый Flow-парсер на Rust — oxidized parser, опубликованный командой Flow ([#19398](https://github.com/prettier/prettier/pull/19398)). Он улучшает производительность для кода с Flow-типами.

В локальных benchmark'ах только на парсинг новый парсер обрабатывал валидные Flow-fixtures Prettier за медианные `266.4ms` вместо `422.6ms` у старого парсера. Файл `flow_parser.js` парсился за `1298.0ms` вместо `2269.6ms`.

## Другие изменения

### JavaScript

#### Более стабильное форматирование комментариев около `break` и `continue` в `--no-semi`

В режиме без точек с запятой Prettier 3.8 мог давать нестабильный результат при повторном форматировании комментариев рядом с `break` и последующим выражением ([#7161](https://github.com/prettier/prettier/pull/7161)). Prettier 3.9 стабилизирует вывод:

<!-- prettier-ignore -->
```jsx
// Input
for (;;) {
  if (condition) {
    break; // breaking comment

    (possibleArray || []).sort()
  }
}

// Prettier 3.8 (--no-semi, first format)
for (;;) {
  if (condition) {
    break // breaking comment

    ;(possibleArray || []).sort()
  }
}

// Prettier 3.8 (--no-semi, second format)
for (;;) {
  if (condition) {
    break // breaking comment
    ;(possibleArray || []).sort()
  }
}

// Prettier 3.9
for (;;) {
  if (condition) {
    break; // breaking comment

    (possibleArray || []).sort();
  }
}
```

#### Меньше лишних скобок в `return`

Prettier 3.9 убирает избыточные скобки в некоторых `return`-выражениях, не теряя комментарии ([#18142](https://github.com/prettier/prettier/pull/18142)).

<!-- prettier-ignore -->
```jsx
// Input
function sequenceExpressionInside() {
  return ( // Reason for a
    a, b
  );
}

// Prettier 3.8
function sequenceExpressionInside() {
  return (
    // Reason for a
    (a, b)
  );
}

// Prettier 3.9
function sequenceExpressionInside() {
  return (
    // Reason for a
    a, b
  );
}
```

#### Улучшения embedded template interpolations

В шаблонных строках с embedded-разметкой исправлены выравнивание и лишние переносы внутри интерполяций ([#18380](https://github.com/prettier/prettier/pull/18380)). Это особенно заметно в CSS/HTML template literals.

<!-- prettier-ignore -->
```jsx
// Input
css = css`
  .class {
    flex-direction: column${
		long_cond && long_cond && long_cond
  		? "-reverse" :
		""
    };
  }
`;

// Prettier 3.8
css = css`
  .class {
    flex-direction: column${long_cond && long_cond && long_cond
        ? "-reverse"
        : ""};
  }
`;

// Prettier 3.9
css = css`
  .class {
    flex-direction: column${
      long_cond && long_cond && long_cond ? "-reverse" : ""
    };
  }
`;
```

#### Import assertions удалены в пользу import attributes

Старый синтаксис `import assertions` через ключевое слово `assert` больше не поддерживается ([#18611](https://github.com/prettier/prettier/pull/18611)). Это устаревшая версия текущего предложения import attributes, а Babel 8 полностью удалил поддержку старого parser plugin.

```js
// Старый, deprecated-синтаксис
import foo from "./foo.json" assert { type: "json" };

// Текущий стандарт
import foo from "./foo.json" with { type: "json" };
```

Миграция выглядит так:

```diff
- import foo from "./foo.json" assert { type: "json" };
+ import foo from "./foo.json" with   { type: "json" };
```

#### Другие JavaScript-исправления

В JavaScript-форматтере также исправлены и улучшены:

- печать `!`-выражений и вложенных logical expressions ([#18397](https://github.com/prettier/prettier/pull/18397), [#18401](https://github.com/prettier/prettier/pull/18401));
- лишний пробел перед выражением в CSS-селекторах внутри template literals ([#18460](https://github.com/prettier/prettier/pull/18460));
- сохранение комментариев у IIFE-функций внутри скобок ([#18538](https://github.com/prettier/prettier/pull/18538));
- комментарии у parenthesized callee ([#18540](https://github.com/prettier/prettier/pull/18540));
- сохранение значимых trailing double spaces в JSDoc ([#18594](https://github.com/prettier/prettier/pull/18594));
- обработка комментариев около пустого списка аргументов вызова ([#18615](https://github.com/prettier/prettier/pull/18615));
- короткие комментарии в пустых массивах и объектах теперь не заставляют их раскрываться на несколько строк ([#18617](https://github.com/prettier/prettier/pull/18617));
- dangling comments в параметрах функций и стрелочных функций ([#18623](https://github.com/prettier/prettier/pull/18623));
- единое поведение комментариев между `NewExpression` и `CallExpression` ([#18669](https://github.com/prettier/prettier/pull/18669));
- недостающие скобки вокруг optional chaining ([#18720](https://github.com/prettier/prettier/pull/18720));
- range formatting для объявлений переменных ([#18734](https://github.com/prettier/prettier/pull/18734), [#18740](https://github.com/prettier/prettier/pull/18740));
- пустые строки между statements в `--no-semi`-режиме ([#18736](https://github.com/prettier/prettier/pull/18736), [#18737](https://github.com/prettier/prettier/pull/18737));
- leading semicolon перед type cast comments ([#18751](https://github.com/prettier/prettier/pull/18751));
- перемещение комментариев после arrow function ([#18775](https://github.com/prettier/prettier/pull/18775));
- комментарии перед `else` ([#18813](https://github.com/prettier/prettier/pull/18813));
- ошибку `Comment was not printed` для `debugger` statement ([#18840](https://github.com/prettier/prettier/pull/18840));
- печать `do..while` в `--no-semi` ([#18851](https://github.com/prettier/prettier/pull/18851)).

### TypeScript

В TypeScript-части релиза много точечных исправлений печати типов и комментариев:

- методы в object type теперь учитывают `quote-props` точнее ([#18326](https://github.com/prettier/prettier/pull/18326));
- комментарии в mapped type могут оставаться inline ([#18731](https://github.com/prettier/prettier/pull/18731));
- в `--no-semi` корректно печатается semicolon перед type assertion ([#18738](https://github.com/prettier/prettier/pull/18738));
- conditional types в ограничении type parameter получают нужные скобки ([#18760](https://github.com/prettier/prettier/pull/18760));
- исправлена печать комментария для последнего операнда union type ([#18798](https://github.com/prettier/prettier/pull/18798));
- union type не разбивается на строки, если помещается целиком ([#18827](https://github.com/prettier/prettier/pull/18827));
- JSDoc перед элементами union type выравнивается аккуратнее ([#18833](https://github.com/prettier/prettier/pull/18833));
- комментарии в class properties не перемещаются в неверное место ([#18837](https://github.com/prettier/prettier/pull/18837));
- trailing comment в параметрах abstract method сохраняется корректно ([#19200](https://github.com/prettier/prettier/pull/19200));
- в `--no-semi` больше не добавляется лишняя `;` перед call signatures ([#19212](https://github.com/prettier/prettier/pull/19212));
- комментарии после `=` в type alias declarations сохраняют позицию ([#19410](https://github.com/prettier/prettier/pull/19410));
- добавлены недостающие скобки вокруг instantiation expression ([#19442](https://github.com/prettier/prettier/pull/19442)).

Пример с conditional type constraint:

<!-- prettier-ignore -->
```ts
// Input
const foo = <Foo extends (Bar extends Baz ? A : B)>() => true;

// Prettier 3.8
const foo = <Foo extends Bar extends Baz ? A : B>() => true;

// Prettier 3.9
const foo = <Foo extends (Bar extends Baz ? A : B)>() => true;
```

### Flow

Помимо перехода на новый Rust-based parser, Prettier 3.9 добавляет и исправляет поддержку ряда Flow-конструкций:

- optional function as return type получает нужные скобки ([#11004](https://github.com/prettier/prettier/pull/11004), [#19331](https://github.com/prettier/prettier/pull/19331));
- добавлена поддержка Flow match instance patterns и Flow records ([#18511](https://github.com/prettier/prettier/pull/18511));
- улучшена печать комментариев в inexact tuples ([#18616](https://github.com/prettier/prettier/pull/18616));
- dangling comments в components и hooks печатаются корректно ([#18629](https://github.com/prettier/prettier/pull/18629), [#18630](https://github.com/prettier/prettier/pull/18630));
- поддержаны implicit declared functions and components ([#18690](https://github.com/prettier/prettier/pull/18690));
- длинные mapped types лучше переносятся на несколько строк ([#18779](https://github.com/prettier/prettier/pull/18779));
- добавлены скобки для `keyof` type operator ([#18801](https://github.com/prettier/prettier/pull/18801));
- поддержаны literal initializers и несколько declarator'ов в `DeclareVariable` ([#18929](https://github.com/prettier/prettier/pull/18929));
- для component declarations печатается `async` ([#19053](https://github.com/prettier/prettier/pull/19053));
- добавлены `writeonly`, `in` и `out` variance modifiers ([#19102](https://github.com/prettier/prettier/pull/19102));
- inline comments в object type больше не заставляют тип раскрываться ([#19287](https://github.com/prettier/prettier/pull/19287));
- сохраняется Flow comment syntax, вместо превращения в обычный Flow-синтаксис ([#19398](https://github.com/prettier/prettier/pull/19398)).

Пример новых Flow records и match patterns:

<!-- prettier-ignore -->
```flow
// Input
record R {
  num: number,
}

const x = R {num: 1};

const label = match (x) {
  R {num: 0} => "zero",
  R {num: 1} => "one",
  R {const num} => `${num} items`,
}

// Prettier 3.8
// Unsupported

// Prettier 3.9
// Same as input
```

### JSON

Парсер `json-stringify` теперь сохраняет исходное представление чисел и строк ([#18405](https://github.com/prettier/prettier/pull/18405)). Раньше Prettier использовал `JSON.stringify()`, из-за чего в редких случаях терялась форма записи: очень большие или маленькие числа округлялись, а некоторые специальные символы переставали быть escaped.

Технически такие преобразования не меняют то, как JSON-значение читается, но форматтер не должен менять эту форму записи.

<!-- prettier-ignore -->
```jsonc
// Input
[
  "\u00FF",
  1e9999,
  -9223372036854775809,
  1e3
]

// Prettier 3.8
[
  "ÿ",
  null,
  -9223372036854776000,
  1000
]

// Prettier 3.9
[
  "\u00FF",
  1e9999,
  -9223372036854775809,
  1e3
]
```

### CSS и SCSS

В CSS исправлены переносы, когда значения атрибутов содержат literal newlines ([#18605](https://github.com/prettier/prettier/pull/18605)).

В SCSS исправлены несколько случаев:

- лишняя trailing comma в математическом выражении внутри аргументов функции ([#18530](https://github.com/prettier/prettier/pull/18530));
- печать комментариев в maps ([#18535](https://github.com/prettier/prettier/pull/18535));
- лишняя trailing comma для parenthesized scalars ([#19091](https://github.com/prettier/prettier/pull/19091));
- пробел перед `;` delimiter в SCSS `if()` function ([#19384](https://github.com/prettier/prettier/pull/19384)).

<!-- prettier-ignore -->
```scss
// Input
@include container($foo: 2 * ($bar + $baz));

// Prettier 3.8
@include container(
  $foo: 2 *
    (
      $bar + $baz,
    )
);

// Prettier 3.9
@include container($foo: 2 * ($bar + $baz));
```

### HTML и Angular

В HTML исправлены:

- ошибка вокруг unicode во front matter ([#18453](https://github.com/prettier/prettier/pull/18453));
- перенос закрывающего тега pre-like elements на несколько строк ([#19046](https://github.com/prettier/prettier/pull/19046));
- inline comment теперь остаётся привязанным к предыдущему node ([#19304](https://github.com/prettier/prettier/pull/19304)).

В Angular добавлена поддержка `@content` block ([#19431](https://github.com/prettier/prettier/pull/19431)) и комментариев в HTML-элементах ([#19465](https://github.com/prettier/prettier/pull/19465)).

```html
<!-- Input -->
<FancyButton [label]="title">
  @content(icon) {
  <span>Icon</span>
  } @content(description) {
  <span>Description text</span>
  }
  <span>Other children</span>
</FancyButton>

<!-- Prettier 3.8 -->
SyntaxError: Unexpected character "EOF"

<!-- Prettier 3.9 -->
<FancyButton [label]="title">
  @content(icon) {
  <span>Icon!</span>
  } @content(description) {
  <span>Description text</span>
  }
  <span>Other children</span>
</FancyButton>
```

### Markdown

Помимо крупного перехода на `micromark`, Prettier 3.9 исправляет несколько Markdown-сценариев:

- emphasis около non-breaking space больше не переписывается с `_..._` на `*...*` ([#17424](https://github.com/prettier/prettier/pull/17424));
- добавлена поддержка setext headings ([#18473](https://github.com/prettier/prettier/pull/18473));
- `U+3000` трактуется как CJK punctuation-equivalent, а `U+FF5E` снова распознаётся как CJK punctuation при prose wrap ([#18656](https://github.com/prettier/prettier/pull/18656));
- не теряется перенос строки около list-like numbers рядом с CJK-текстом ([#18867](https://github.com/prettier/prettier/pull/18867));
- убрана лишняя пустая строка между списком и indented code block ([#19154](https://github.com/prettier/prettier/pull/19154));
- поддержано форматирование LWC-синтаксиса в code block ([#19291](https://github.com/prettier/prettier/pull/19291));
- indented lines из `=` или `-` теперь экранируются, чтобы не превращаться в setext headings ([#19350](https://github.com/prettier/prettier/pull/19350)).

Пример поддержки setext headings:

```md
<!-- Input -->

Setext Heading 1
================

Setext Heading 2
----------------

Multiline
Setext
Heading
-------

<!-- Prettier 3.8 -->

# Setext Heading 1

## Setext Heading 2

Multiline
Setext
Heading

---

<!-- Prettier 3.9 -->

Setext Heading 1
================

Setext Heading 2
----------------

Multiline
Setext
Heading
-------
```

### YAML

После обновления parser stack для YAML исправлены:

- форматирование mapping, когда длинный ключ переносится на несколько строк ([#18330](https://github.com/prettier/prettier/pull/18330));
- block value, заканчивающееся пробельным символом ([#18331](https://github.com/prettier/prettier/pull/18331));
- сохранение пустой строки после block scalar ([#19205](https://github.com/prettier/prettier/pull/19205)).

<!-- prettier-ignore -->
```yaml
# Input
foo: >
  a
  b
bar: baz

qux: quux

# Prettier 3.8
foo: >
  a
  b
bar: baz
qux: quux

# Prettier 3.9
foo: >
  a
  b
bar: baz

qux: quux
```

### CLI

В CLI исправлены несколько практичных проблем:

- Prettier больше не падает при форматировании директорий со спецсимволами в имени ([#18452](https://github.com/prettier/prettier/pull/18452));
- поиск EditorConfig больше не поднимается выше Git worktree: `.git` file теперь считается project root marker, как и `.git` directory ([#18891](https://github.com/prettier/prettier/pull/18891));
- `--cache-strategy content` снова работает: `file-entry-cache` v11 переименовал `useChecksum` в `useCheckSum`, а Prettier раньше передавал старое имя опции ([#18914](https://github.com/prettier/prettier/pull/18914));
- исправлено форматирование файла, имя которого начинается с кавычки `"` ([#19315](https://github.com/prettier/prettier/pull/19315));
- обновлён experimental CLI до версий [`v0.11.0`](https://github.com/prettier/prettier-cli/releases/tag/v0.11.0) и [`v0.12.0`](https://github.com/prettier/prettier-cli/releases/tag/v0.12.0) ([#19381](https://github.com/prettier/prettier/pull/19381), [#19415](https://github.com/prettier/prettier/pull/19415)).

### Miscellaneous: обновление `Printer` interface

В конце релиза обновлён интерфейс `Printer` ([#19014](https://github.com/prettier/prettier/pull/19014)):

```diff
export interface Printer<T = any> {
  // ...
-    print: (AstPath<T>) => Doc,
+    print: (
+      selector?: string | number | Array<string | number> | AstPath<T>,
+      args?: unknown,
+    ) => Doc,
  // ...
}
```

## Как обновиться

Команда Prettier просит фиксировать точную версию formatter'а, чтобы форматирование в команде и CI оставалось воспроизводимым:

```json
{
  "devDependencies": {
    "prettier": "3.9.0"
  }
}
```

Если в проекте используются `@prettier/plugin-oxc` или `@prettier/plugin-hermes`, их тоже стоит обновить вместе с Prettier.

После обновления особенно стоит прогнать форматирование и review diff'а, если проект использует Markdown, YAML, Flow, GraphQL, Angular templates, TypeScript-типы или `--no-semi`: именно там в 3.9 больше всего изменений в печати и парсинге.

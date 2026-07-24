---
author: Артём Нецветаев
pubDatetime: 2026-07-24T20:36:24.000Z
title: "ESLint 10.8.0: тип ConfigObject и безопаснее HTML-отчёты"
slug: eslint-v10-8-0
featured: false
draft: false
tags:
  - release
  - eslint
  - javascript
  - typescript
description: "Что изменилось в ESLint 10.8.0: экспорт типа ConfigObject из eslint/config, экранирование rule ID в HTML formatter, исправления autofix и устойчивость правил на крайних случаях."
---

ESLint выпустил минорный релиз [`v10.8.0`](https://github.com/eslint/eslint/releases/tag/v10.8.0). В нём появился публичный тип `ConfigObject` для flat config, а также несколько практических исправлений: HTML formatter больше не вставляет ID правил как сырой HTML, `prefer-object-spread` не создаёт ASI-ловушку в autofix, а правила корректно обрабатывают крайние конфигурации и TypeScript-методы с вычисляемыми именами.

Материал основан на [GitHub Release v10.8.0](https://github.com/eslint/eslint/releases/tag/v10.8.0), [сравнении с v10.7.0](https://github.com/eslint/eslint/compare/v10.7.0...v10.8.0), а также на diff и тестах PR [#21082](https://github.com/eslint/eslint/pull/21082), [#21129](https://github.com/eslint/eslint/pull/21129), [#21116](https://github.com/eslint/eslint/pull/21116), [#21081](https://github.com/eslint/eslint/pull/21081), [#21096](https://github.com/eslint/eslint/pull/21096), [#21094](https://github.com/eslint/eslint/pull/21094) и [#21083](https://github.com/eslint/eslint/pull/21083). Это минорный релиз, поэтому `featured: false`.

## `ConfigObject` теперь доступен из `eslint/config`

В [`eslint/config`](https://github.com/eslint/eslint/blob/v10.8.0/lib/types/config-api.d.ts) появился type-only экспорт `ConfigObject`. До `10.8.0` тип приходилось получать из пакета `@eslint/config-helpers`; теперь публичная точка входа ESLint экспортирует его вместе с `Config`, `defineConfig`, `globalIgnores` и `includeIgnoreFile`.

Это удобно для библиотек, генераторов конфигураций и собственных утилит, которые принимают один flat-config объект, а не целый массив. Например, тип можно импортировать без добавления отдельной зависимости в коде пользователя:

```ts
import { type ConfigObject, defineConfig } from "eslint/config";

const baseConfig: ConfigObject = {
  name: "my-project/base",
  files: ["**/*.js"],
  rules: {
    "no-console": "warn",
    eqeqeq: ["error", "always"],
  },
};

export default defineConfig(baseConfig);
```

В самом ESLint экспорт является переэкспортом `ConfigObject` из `@eslint/config-helpers`; для релиза зависимость обновили до `@eslint/config-helpers@^0.7.0`. В собственном type-тесте ESLint объект с `files`, `ignores`, `language`, `languageOptions`, `linterOptions`, `plugins`, `rules` и `settings` проверяется через `satisfies Config` — то есть `ConfigObject` описывает форму одного конфигурационного объекта, а `Config` остаётся более широким контрактом для допустимой конфигурации.

## HTML formatter экранирует ID правила

HTML formatter раньше экранировал текст сообщения, но выводил `ruleId` внутри ссылки без `encodeHTML()`. Поэтому правило с допустимыми специальными символами в идентификаторе могло испортить разметку отчёта или внедрить в неё HTML.

Проблема проявлялась, например, если правило отключали через комментарий с необычным именем:

```js
/* eslint-disable '<img src=x onerror=alert(1)>' */
const value = 1;
```

При построении отчёта через API

```js
const formatter = await eslint.loadFormatter("html");
const html = await formatter.format(results);
```

в `v10.7.0` ID попадал в ячейку отчёта в исходном виде. В `v10.8.0` файл [`lib/cli-engine/formatters/html.js`](https://github.com/eslint/eslint/commit/6b8d2f7589b8a7c8b91b8ca2a2ef6d46178760d8) передаёт `ruleId` в `encodeHTML()`: символы `<`, `&` и `>` становятся `&lt;`, `&amp;` и `&gt;`. Это исправление особенно важно для CI, который сохраняет HTML-отчёты как артефакты или публикует их во внутреннем интерфейсе.

## Autofix `prefer-object-spread` больше не склеивает выражения

`prefer-object-spread` заменяет `Object.assign()` на object spread. Когда замена должна быть обёрнута в скобки, результат начинается с `(`. Если предыдущее выражение не было завершено точкой с запятой, автоматическая вставка может стать ASI-ловушкой.

```js
const result = doSomething();
Object.assign({}, myData);
```

Раньше autofix мог выдать начало `({ ...myData })` без защиты. В `v10.8.0` правило проверяет, является ли узел началом expression statement и требуется ли предшествующая точка с запятой. В таком случае результат теперь безопасен:

```js
const result = doSomething();
({ ...myData });
```

При этом лишняя точка с запятой не добавляется в контекстах, где она не нужна: например, после `foo();` либо внутри выражения `foo + Object.assign({}, bar)`. Исправление из [#21081](https://github.com/eslint/eslint/pull/21081) касается именно fixer, поэтому полезно командам, применяющим `eslint --fix` к коду с ASI-стилем.

## Исправления правил на редких, но реальных входных данных

### `no-unreachable-loop`: пустой набор проверяемых циклов

Опция `ignore` у [`no-unreachable-loop`](https://eslint.org/docs/latest/rules/no-unreachable-loop) может перечислить все пять поддерживаемых типов: `WhileStatement`, `DoWhileStatement`, `ForStatement`, `ForInStatement` и `ForOfStatement`.

```js
/* eslint no-unreachable-loop: ["error", {
  "ignore": [
    "WhileStatement",
    "DoWhileStatement",
    "ForStatement",
    "ForInStatement",
    "ForOfStatement"
  ]
}] */

while (ready) break;
```

До релиза такая конфигурация могла завершить ESLint ошибкой обращения к `undefined`: правило строило пустой CSS-подобный selector и продолжало инициализацию. Теперь [#21116](https://github.com/eslint/eslint/pull/21116) возвращает пустой набор visitor'ов сразу, если после `ignore` не осталось типов циклов. Конфигурация ожидаемо не выдаёт диагностику и не падает.

### `class-methods-use-this`: options применяются и к computed methods

В TypeScript `class-methods-use-this` поддерживает `ignoreOverrideMethods` и `ignoreClassesWithImplements`. До `10.8.0` вычисляемое имя метода преждевременно считалось включённым в проверку — ещё до проверки этих опций. Поэтому метод с `override ["name"]()` мог получить сообщение `Expected 'this' to be used`, хотя обычный `override name()` игнорировался.

```ts
/* eslint class-methods-use-this: ["error", {
  "ignoreOverrideMethods": true
}] */

class Service {
  override ["run"]() {}
}
```

Теперь правило сначала учитывает `ignoreOverrideMethods` и `ignoreClassesWithImplements`, а уже потом обрабатывает `computed`. Та же последовательность исправляет computed methods и public computed class fields в классе с `implements`, когда установлено `ignoreClassesWithImplements: "all"` или `"public-fields"`.

### `preserve-caught-error`: корректные suggestions для `new (Error)`

[`preserve-caught-error`](https://eslint.org/docs/latest/rules/preserve-caught-error) предлагает добавить `{ cause: error }` при повторном выбрасывании ошибки. Вариант с parenthesized callee был проблемным:

```js
try {
  run();
} catch (error) {
  throw new Error();
}
```

Некорректная suggestion добавляла аргументы внутрь скобок callee и могла превратить конструктор в вызов `Error(...)`, результат которого нельзя использовать с `new`. В `v10.8.0` suggestion добавляет список аргументов после закрывающей скобки callee:

```js
throw new Error("", { cause: error });
```

Общий код вставки аргументов также покрывает `new Error` без круглых скобок, `AggregateError` и настроенные пользовательские классы из `errorClassNames`.

## Производительность и вспомогательные выводы

- В [`prefer-template`](https://github.com/eslint/eslint/commit/20b5ad052360a443786a202e94624a3f81846511) регулярное выражение обработки обратных слешей получило negative lookbehind. Тест с миллионом `\\` раньше занимал 7–8 минут из-за квадратичной обработки; обновлённый шаблон не начинает новую проверку из позиции, уже следующей за обратным слешем.
- Для HTML formatter, `no-unreachable-loop`, `prefer-object-spread`, `class-methods-use-this` и `preserve-caught-error` добавлены регрессионные тесты, фиксирующие описанные случаи.
- Документация уточняет описание `no-eq-null`, корректирует ссылку на parser options и описание `--suppressions-location`; эти изменения не меняют API или поведение линтера.

Полный перечень коммитов доступен в [GitHub Release ESLint v10.8.0](https://github.com/eslint/eslint/releases/tag/v10.8.0).

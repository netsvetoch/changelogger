---
author: Артём Нецветаев
pubDatetime: 2026-07-14T08:21:34.000Z
title: "Oxlint 1.74.0 и Oxfmt 0.59.0: конфиги .mts, автоисправление импортов и точнее форматирование TypeScript"
slug: oxlint-oxfmt-apps-v1-74-0
featured: false
draft: false
tags:
  - release
  - oxlint
  - oxfmt
  - javascript
  - typescript
  - tooling
description: "Разбор объединённого релиза Oxlint 1.74.0 и Oxfmt 0.59.0: поддержка oxlint.config.mts и oxfmt.config.mts, автоисправление import/no-duplicates, новые параметры правил и улучшения форматирования Less и TypeScript."
---

Вышел объединённый релиз инструментов Oxc: [Oxlint 1.74.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.74.0) и [Oxfmt 0.59.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.74.0). В Oxlint появились автоисправления для `import/no-duplicates` и настройка `namespaces` у `eslint/no-inner-declarations`, а оба инструмента теперь автоматически находят конфигурации с расширением `.mts`. Oxfmt получил поддержку `quoteProps` для TypeScript enum и сигнатур методов, а CSS-форматтер научился выводить конструкции Less `:extend` и merge properties.

Это minor-релиз формата `x.y.0`, поэтому статья публикуется с `featured: false`. Источники — [GitHub Release `apps_v1.74.0`](https://github.com/oxc-project/oxc/releases/tag/apps_v1.74.0), [сравнение с `apps_v1.73.0`](https://github.com/oxc-project/oxc/compare/apps_v1.73.0...apps_v1.74.0) и исходные изменения в PR, ссылки на которые приведены в разделах.

## Oxlint 1.74.0

### Конфигурация в `oxlint.config.mts` и `oxfmt.config.mts`

Oxlint при автоматическом поиске теперь проверяет четыре стандартных имени: `.oxlintrc.json`, `.oxlintrc.jsonc`, `oxlint.config.ts` и `oxlint.config.mts`. То же изменение сделано в Oxfmt: к `oxfmt.config.ts` добавлен `oxfmt.config.mts`. LSP также регистрирует оба варианта в watch patterns, поэтому изменение `.mts`-конфига приводит к обновлению диагностики.

Для Oxlint рабочий конфиг выглядит так:

```ts
// oxlint.config.mts
import { defineConfig } from "#oxlint";

export default defineConfig({
  rules: {
    "no-debugger": "error",
  },
});
```

Внутри механизма discovery имена JavaScript/TypeScript-конфигов теперь представлены массивом, а не одним значением. Это важно и для проектов, где ESM-конфигурация уже принята как `.mts`, и для редакторных интеграций: LSP начинает отслеживать `**/oxlint.config.mts` и `**/oxfmt.config.mts`. Изменение реализовано в [PR #24357](https://github.com/oxc-project/oxc/pull/24357).

### `eslint/no-inner-declarations`: разрешение объявлений в namespace

Правило `eslint/no-inner-declarations` получило параметр `namespaces` со значениями `allow` и `disallow`. Значение по умолчанию — `disallow`, поэтому существующее поведение не меняется. В режиме `allow` разрешаются объявления `function` и `var`, расположенные непосредственно в теле TypeScript `namespace` или `module`:

```json
{
  "rules": {
    "eslint/no-inner-declarations": ["error", "both", { "namespaces": "allow" }]
  }
}
```

```ts
namespace Metrics {
  function record() {} // разрешено при namespaces: "allow"
  var version = 1; // также разрешено

  if (enabled) {
    function debug() {} // всё ещё ошибка: объявление вложено в блок
  }
}
```

Проверка смотрит сквозь `export`, чтобы одинаково обрабатывать экспортируемые и обычные объявления. Настройка добавлена в [PR #24044](https://github.com/oxc-project/oxc/pull/24044).

### `import/no-duplicates` теперь умеет исправлять код

Раньше `import/no-duplicates` только сообщал о повторных импортах. Теперь правило может объединять совместимые объявления в одно. Например:

```ts
// До
import { readFile } from "node:fs";
import { writeFile } from "node:fs";

// После автоисправления
import { readFile, writeFile } from "node:fs";
```

Фиксер также умеет объединять side-effect import с импортом спецификаторов, default import со спецификаторами и type-only импорты. При включённой опции `prefer-inline` type-спецификаторы переносятся в объединённый импорт:

```ts
// prefer-inline: true
import type { User } from "./model";
import { createUser } from "./model";

// Результат
import { type User, createUser } from "./model";
```

Фиксер намеренно отказывается от объединения, если это может изменить смысл или комментарии: например, при namespace imports (`import * as ns`), разных import attributes, конфликтующих default-именах и проблемных комментариях. В этой же серии изменений исправлены два неприятных края: при слиянии больше не появляются двойные запятые, а type-модификаторы сохраняются в синтаксически корректном виде. Автоисправления добавлены в [PR #24273](https://github.com/oxc-project/oxc/pull/24273), а исправления запятых и модификаторов — в [коммитах `ac7176d`](https://github.com/oxc-project/oxc/commit/ac7176d0bd9580375f1db5352d2c1b96ca9750a5) и [`261aa39`](https://github.com/oxc-project/oxc/commit/261aa390510d465cb6eee1deac0be2f1988d3847).

### Другие исправления Oxlint

В релиз вошли исправления, которые особенно заметны в TypeScript-проектах и монорепозиториях:

- `ignorePatterns` теперь разрешаются относительно директории конфигурации; шаблон, который не может сопоставить файлы за её пределами, приводит к явной ошибке вместо тихого пропуска. Это устранено в [PR #24339](https://github.com/oxc-project/oxc/pull/24339) и [PR #24341](https://github.com/oxc-project/oxc/pull/24341).
- В режиме `--type-check-only` Oxlint больше не валидирует и не обновляет bulk suppressions. Этот режим пропускает обычные lint-правила, поэтому прежняя финализация могла принять корректные suppressions за устаревшие. Также `--suppress-all` и `--prune-suppressions` теперь отвергаются вместе с `--type-check-only`; детали — в [PR #24462](https://github.com/oxc-project/oxc/pull/24462).
- `unicorn/prefer-string-raw` больше не пытается исправлять ключ `TSPropertySignature`: такое преобразование могло породить некорректный tagged-template синтаксис ([коммит `dbd08b6`](https://github.com/oxc-project/oxc/commit/dbd08b624d7626e945aac2de6614fbe481ed5433)).
- `eslint/no-loop-func` перестал сообщать об ошибке для переменных `catch`, а `eslint/no-unused-vars` учитывает обновление default-параметра как использование.
- `jest/prefer-lowercase-title` исправил ложное срабатывание при `lowercaseFirstCharacterOnly: false`; источники — [коммит `0b086de`](https://github.com/oxc-project/oxc/commit/0b086de) и [PR #24323](https://github.com/oxc-project/oxc/pull/24323).

### Оптимизации правил

Несколько горячих мест теперь не компилируют регулярные выражения на каждом проверяемом узле. `vue/prop-name-casing` один раз готовит `ignoreProps`, `typescript/no-require-imports` — шаблоны `allow`, `jsdoc/require-param` — `checkTypesPattern`, а `jest/valid-title` — `disallowedWords`. В `eslint/object-shorthand` regex для префикса конструктора заменён прямым сканированием символов, а в `eslint/no-underscore-dangle` устранено лишнее клонирование строки на каждый идентификатор. Это не меняет конфигурацию правил, но сокращает повторяющуюся работу на больших кодовых базах; список оптимизаций опубликован в release body и в [compare](https://github.com/oxc-project/oxc/compare/apps_v1.73.0...apps_v1.74.0).

## Oxfmt 0.59.0

### `quoteProps` для TypeScript enum и сигнатур методов

Опция `quoteProps` теперь применяется не только к ключам объектов, но и к именам членов TypeScript enum и невычисляемым ключам в `TSMethodSignature` и похожих типовых конструкциях. При `quoteProps: "consistent"` Oxfmt учитывает весь список членов enum: если хотя бы одно имя нельзя записать как обычный identifier, кавычки сохраняются последовательно.

```ts
// quoteProps: "consistent"
enum Status {
  "in-progress" = 1,
  ready = 2,
}

type Service = {
  "health-check"(): boolean;
};
```

Внутри formatter core для enum добавлена отдельная проверка `should_preserve_quote_for_enum_member`, а ключи `TSMethodSignature` проходят через тот же `format_property_key`, что и ключи объектов. Реализация находится в [PR #24309](https://github.com/oxc-project/oxc/pull/24309).

### Форматирование Less `:extend` и merge properties

CSS-форматтер теперь разбирает и форматирует statement-position форму Less `&:extend(...)`, а также Less merge markers в свойствах:

```less
.card {
  &:extend(.panel,
  .surface);
  box-shadow+: inset 0 0 10px #555;
  background+_: url(two.png);
}
```

Если список селекторов `:extend` помещается в `printWidth`, он остаётся в одной строке. При переполнении скобки и селекторы переносятся на отдельные строки. Для `all` Oxfmt сохраняет его вместе с соответствующим селектором. Merge markers `+` и `+_` приклеиваются к имени свойства, после чего форматируется двоеточие: `box-shadow+: value`.

Изменение добавляет структурный принтер для Less `LessExtendRule` и общий вывод списка `:extend` для selector-position и statement-position форм. Поддержка пришла в [PR #24358](https://github.com/oxc-project/oxc/pull/24358), одновременно обновлён `oxc-css-parser` до 0.0.7 в [PR #24434](https://github.com/oxc-project/oxc/pull/24434).

### Исправления идемпотентности и комментариев

В JavaScript/TypeScript-форматтере исправлены несколько случаев, где повторный запуск менял результат или добавлял лишние скобки:

- комментарий внутри type alias больше не заставляет переносить компактный alias на новую строку;
- подавленный через `oxfmt-ignore` оператор не дублирует завершающий `;` в режиме `semi: false`;
- добавлены необходимые скобки в ограничении type parameter для conditional type;
- исправлено определение цели type cast по span вместо лексического поиска;
- не добавляются лишние скобки вокруг type cast с комментарием;
- сохраняются кавычки у сигнатуры метода с именем `new`, комментарии внутри пустого `switch` и пустые строки между JSX-атрибутами;
- CSS-значения сохраняют комментарии в прежнем месте относительно запятых.

В результате повторное форматирование не должно менять уже отформатированные конструкции в перечисленных сценариях. Полный список и ссылки на изменения доступны в [релизе `apps_v1.74.0`](https://github.com/oxc-project/oxc/releases/tag/apps_v1.74.0).

### Небольшие внутренние API и производительность

В `formatter_core` метод `SourceText::as_str()` возвращает исходный текст как `&'a str`. Это отличается от повторного заимствования через `Deref<Target = str>`: потребитель получает срез с исходным временем жизни, что нужно для span-backed accessors в CSS-парсере ([PR #24281](https://github.com/oxc-project/oxc/pull/24281)).

Также printer core больше не создаёт отдельный `Vec` work-stack на каждый вызов удаления soft line, а коллекции `MemberChain` используют `SmallVec`. Это внутренние оптимизации без новых пользовательских флагов.

## Обновление

Установите обе версии одной командой:

```bash
pnpm add -D oxlint@1.74.0 oxfmt@0.59.0
```

После обновления проверьте автоматический поиск конфигурации. Если в проекте одновременно лежат `oxlint.config.ts` и `oxlint.config.mts` (или соответствующие файлы Oxfmt), discovery сообщает о конфликте вместо произвольного выбора — укажите путь явно через CLI/LSP-конфигурацию.

Полный список исправлений и коммитов приведён в [GitHub Release `apps_v1.74.0`](https://github.com/oxc-project/oxc/releases/tag/apps_v1.74.0).

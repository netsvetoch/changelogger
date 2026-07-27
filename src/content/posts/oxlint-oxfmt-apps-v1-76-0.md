---
author: Артём Нецветаев
pubDatetime: 2026-07-27T16:54:58.000Z
title: "Oxlint 1.76.0 и Oxfmt 0.61.0: защита matchAll, стиль CommonJS-экспортов и YAML-форматтер"
slug: oxlint-oxfmt-apps-v1-76-0
featured: false
draft: false
tags:
  - release
  - oxlint
  - oxfmt
  - javascript
  - typescript
  - tooling
description: "Разбор объединённого релиза Oxlint 1.76.0 и Oxfmt 0.61.0: правила oxc/bad-match-all-arg, n/exports-style и eslint/id-denylist, suggestions для class-literal-property-style, настройка LSP без вложенных конфигов и YAML-форматтер."
---

Вышел объединённый релиз инструментов Oxc: [Oxlint 1.76.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.76.0) и [Oxfmt 0.61.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.76.0). В Oxlint появились три реализованных правила и suggestion для преобразования literal-полей и getter’ов. Oxfmt получил YAML-форматтер и настройку LSP, отключающую поиск конфигураций в подкаталогах.

Это один minor-релиз формата `apps_v1.76.0`, поэтому пост общий для обоих пакетов и публикуется с `featured: false`. Источники: [GitHub Release](https://github.com/oxc-project/oxc/releases/tag/apps_v1.76.0), [compare с `apps_v1.75.0`](https://github.com/oxc-project/oxc/compare/apps_v1.75.0...apps_v1.76.0) и связанные PR в репозитории Oxc.

## Oxlint 1.76.0

### `oxc/bad-match-all-arg`: не передавать в `matchAll` RegExp без `g`

Новое correctness-правило `oxc/bad-match-all-arg` находит известные регулярные выражения без глобального флага, переданные в `String.prototype.matchAll`. В таком случае JavaScript выбрасывает `TypeError`, а не возвращает итератор совпадений. Проверяются regexp literal, `new RegExp(...)`, вызов `RegExp(...)`, `globalThis.RegExp(...)` и переменная, которую анализатор может разрешить к одному из этих выражений.

```json
{
  "rules": {
    "oxc/bad-match-all-arg": "error"
  }
}
```

```ts
// Ошибка: у regexp нет флага g
const matches = text.matchAll(/todo:/i);

// Корректно
const matches = text.matchAll(/todo:/gi);

const pattern = new RegExp("todo", "i");
text.matchAll(pattern); // также диагностика
```

Строковый аргумент и неизвестная на этапе linting переменная не репортятся: правило предупреждает только когда может доказать, что передан именно неглобальный `RegExp`. Реализация и набор распознаваемых форм — в [PR #24900](https://github.com/oxc-project/oxc/pull/24900).

### `n/exports-style`: выбрать один стиль CommonJS

Oxlint реализовал `n/exports-style`. Правило требует последовательно использовать либо `module.exports`, либо `exports`, чтобы не получить незаметную потерю экспортов: переназначение `module.exports` меняет экспортируемое значение, тогда как последующее `exports.name = ...` пишет в прежний объект.

По умолчанию выбран режим `"module.exports"`; вариант `"exports"` требует обратный стиль. Опция `allowBatchAssign: true` разрешает намеренную связанную инициализацию `module.exports = exports = value` в обоих режимах.

```json
{
  "rules": {
    "n/exports-style": ["error", "module.exports", { "allowBatchAssign": true }]
  }
}
```

```js
// При режиме "module.exports" — ошибка
exports.version = "1.0.0";

// Корректно
module.exports = { version: "1.0.0" };
module.exports.parse = parse;

// Допустимо только с allowBatchAssign: true
module.exports = exports = createApi();
```

Правило отличает глобальные `module` и `exports` от одноимённых локальных переменных. В режиме `"exports"` оно также проверяет обращения к `module.exports`, включая доступ к свойствам и присваивание. Подробности конфигурации и тестовые случаи — в [PR #24087](https://github.com/oxc-project/oxc/pull/24087).

### `eslint/id-denylist`: запрет конкретных имён

Новое `eslint/id-denylist` принимает массив запрещённых имён. Это не правило о регистре или шаблоне имени, а точный denylist: он полезен, если команда хочет исключить расплывчатые `data`, `callback` или внутренние имена из публичного и прикладного кода.

```json
{
  "rules": {
    "eslint/id-denylist": ["error", "data", "callback"]
  }
}
```

```ts
// Ошибки: binding и имя метода входят в denylist
const data = load();
class Store {
  callback() {}
  #data = [];
}

// Корректнее
const responsePayload = load();
class Store {
  onComplete() {}
  #items = [];
}
```

Проверка охватывает bindings, references, class fields, private identifiers, method names и labels. При этом она намеренно не запрещает вызов функции (`callback()`), нецелевые property access (`object.data`), имена ключей при destructuring и известные внешние globals: иначе конфиг запрещал бы чужой API, а не собственные идентификаторы. Реализация — [PR #24632](https://github.com/oxc-project/oxc/pull/24632).

### Suggestions для `typescript/class-literal-property-style`

Само правило `typescript/class-literal-property-style` существовало раньше, но теперь его диагностики получили suggestions. В стандартном режиме `"fields"` тривиальный getter, возвращающий literal, можно заменить на `readonly` field; в режиме `"getters"` — сделать обратное преобразование.

```ts
class BuildInfo {
  // При настройке "fields" Oxlint предложит замену:
  get channel(): string {
    return "stable";
  }
}

class BuildInfo {
  readonly channel: string = "stable";
}
```

Suggestion сохраняет `public`/`protected`/`private`, `static`, computed key и type annotation. Конвертируются literals, template literal без интерполяций и tagged template без подстановок. Преобразование не предлагается для decorated member; getter с соответствующим setter также не преобразуется. В режиме `"getters"` поле исключается, если конструктор присваивает `this.<поле>`: такая замена изменила бы контракт. См. [PR #24766](https://github.com/oxc-project/oxc/pull/24766).

### Исправления, которые меняют поведение

- При `oxlint --no-ignore` явно переданный относительный путь теперь всё равно преобразуется в абсолютный. Это устраняет panic type-aware интеграции, когда `typescript-go` получал не абсолютный путь ([PR #24646](https://github.com/oxc-project/oxc/pull/24646)).
- `jsx-a11y/interactive-supports-focus` больше не требует вручную передавать `tabindex` на custom component. Компонент может сам отрисовать DOM-элемент с нужным фокусом, поэтому поведение приведено к ESLint ([PR #24780](https://github.com/oxc-project/oxc/pull/24780)).
- Замены в `unicorn/no-array-reverse` и `unicorn/no-array-sort` стали suggestions, а не обычными auto-fix. Теперь простой `--fix` не меняет условно похожий на массив fluent API на `.toReversed()`/`.toSorted()`; явное применение suggestions остаётся потенциально изменяющей поведение операцией ([PR #24848](https://github.com/oxc-project/oxc/pull/24848)).
- `typescript/no-confusing-non-null-assertion` теперь диагностирует неоднозначные `! in` и `! instanceof` ([PR #24825](https://github.com/oxc-project/oxc/pull/24825)).

## Oxfmt 0.61.0

### YAML-форматтер в formatter core

В Oxfmt добавлен YAML-форматтер на базе нового crate `oxc_formatter_yaml` и `oxc_yaml_parser`. Его API форматирует YAML 1.2 AST в Prettier-совместимый вывод; в релизе также добавлены conformance-тесты YAML.

Для потребителей Rust API доступны `YamlFormatOptions` и `format`. Опции включают ширину строки, line ending, `proseWrap`, `singleQuote`, `bracketSpacing` и trailing commas для многострочных flow collections. YAML не допускает отступы табуляцией, поэтому `indentStyle` присутствует для общего интерфейса formatter core, но на вывод не влияет.

```rust
use oxc_allocator::Allocator;
use oxc_formatter_yaml::{format, YamlFormatOptions};

let allocator = Allocator::new();
let formatted = format(&allocator, "key:   value", YamlFormatOptions::default())?;
assert_eq!(formatted.print()?.into_code(), "key: value\n");
```

У block literal (`|`) текст не переворачивается, а для многострочных scalars режимы `proseWrap` соответствуют Prettier: `preserve` по умолчанию сохраняет структуру строк, `always` укладывает текст в print width, `never` сворачивает абзац в одну строку. Исходная реализация — [PR #24534](https://github.com/oxc-project/oxc/pull/24534).

### `oxc.fmt.disableNestedConfig` в LSP

Oxfmt LSP получил булевую настройку `oxc.fmt.disableNestedConfig`. По умолчанию сервер подбирает конфигурацию для каждого файла, включая конфиги в подкаталогах. При `true` он использует только конфигурацию корня workspace и перестаёт следить за конфигами через шаблон `**/…`. Если задан непустой `oxc.fmt.configPath`, он имеет приоритет и уже сам отключает вложенный поиск.

```json
{
  "oxc.fmt.disableNestedConfig": true
}
```

Эта настройка нужна монорепозиториям, которые хотят единый формат для всего workspace, даже если в пакетах лежат собственные `.oxfmtrc` или совместимые конфиги. Пустой `oxc.fmt.configPath` считается незаданным, поэтому при нём вложенный поиск продолжает работать, если `disableNestedConfig` не включён. Детали реализации — в [PR #24965](https://github.com/oxc-project/oxc/pull/24965).

## Обновление

Для объединённого релиза обновите оба инструмента одной командой:

```bash
pnpm add -D oxlint@1.76.0 oxfmt@0.61.0
```

После обновления стоит сначала включить новые правила в warning-режиме и посмотреть, какие соглашения уже есть в кодовой базе. Для `n/exports-style` особенно важно заранее выбрать целевой стиль CommonJS, а suggestions `class-literal-property-style` просматривать как изменения API класса. Полный список изменений и артефакты доступны в [GitHub Release `apps_v1.76.0`](https://github.com/oxc-project/oxc/releases/tag/apps_v1.76.0).

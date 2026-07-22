---
author: Артём Нецветаев
pubDatetime: 2026-07-22T00:56:28.000Z
title: "Oxlint 1.75.0 и Oxfmt 0.60.0: запрет top-level await, единый стиль React-компонентов и быстрее parse-only"
slug: oxlint-oxfmt-apps-v1-75-0
featured: false
draft: false
tags:
  - release
  - oxlint
  - oxfmt
  - javascript
  - typescript
  - tooling
description: "Разбор объединённого релиза Oxlint 1.75.0 и Oxfmt 0.60.0: новые правила node/no-top-level-await и react/function-component-definition, настройка type-only импортов, диагностика некорректных glob и отключаемое хеширование идентификаторов в parse-only сценариях."
---

Вышел объединённый релиз инструментов Oxc: [Oxlint 1.75.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.75.0) и [Oxfmt 0.60.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.75.0). В Oxlint добавлены проверки top-level `await` для публикуемых Node-модулей и единого способа объявления React function components. Oxfmt получил изменения в parser API, позволяющие не вычислять хеш каждого идентификатора там, где AST только форматируется или сериализуется.

Это объединённый minor-релиз формата `apps_v1.75.0`, поэтому статья одна для обоих пакетов и публикуется с `featured: false`. Источники — [GitHub Release](https://github.com/oxc-project/oxc/releases/tag/apps_v1.75.0), [compare с `apps_v1.74.0`](https://github.com/oxc-project/oxc/compare/apps_v1.74.0...apps_v1.75.0), а также связанные PR и исходный код на теге релиза.

## Oxlint 1.75.0

### `node/no-top-level-await`: модуль остаётся доступен через `require(esm)`

Новое правило `node/no-top-level-await` запрещает `await`, `for await...of` и `await using`, если они находятся вне обычной или стрелочной функции. Его практическая цель — не публиковать ESM-модули, которые Node.js не может загрузить через `require(esm)` из-за top-level `await`.

```json
{
  "rules": {
    "node/no-top-level-await": "error"
  }
}
```

```ts
// Ошибка
const client = await connect();

// Ошибка
for await (const item of stream) {
  process(item);
}

// Корректно: await находится внутри функции
export async function start() {
  const client = await connect();
  return client;
}
```

Для исполняемых файлов можно разрешить top-level `await` только при наличии hashbang (`#!`) через `ignoreBin: true`. Опция не отключает правило для обычного `.mjs`/`.mts` файла без hashbang.

```json
{
  "rules": {
    "node/no-top-level-await": ["error", { "ignoreBin": true }]
  }
}
```

```ts
#!/usr/bin/env node
const configuration = await readConfiguration(); // допустимо с ignoreBin: true
```

Реализация и тестовые случаи подтверждают, что блоки `if` и обычные циклы не считаются новой границей: `await` внутри них всё ещё top-level. Детали — в [PR #24634](https://github.com/oxc-project/oxc/pull/24634).

### `react/function-component-definition`: форма React-компонентов под контролем

Oxlint нативно реализовал правило `eslint-plugin-react` `react/function-component-definition`. Оно проверяет стиль function components: declaration, function expression или arrow function. По умолчанию именованные компоненты должны быть function declaration, а безымянные — function expression; допустимые варианты задаются отдельно для `namedComponents` и `unnamedComponents`.

```json
{
  "rules": {
    "react/function-component-definition": [
      "error",
      {
        "namedComponents": "arrow-function",
        "unnamedComponents": "function-expression"
      }
    ]
  }
}
```

```tsx
// При namedComponents: "arrow-function" — корректно
const Profile = () => <section />;

// Будет диагностировано как неправильная форма именованного компонента
function ProfileCard() {
  return <article />;
}
```

Правило распознаёт не просто любую функцию с JSX: для именованных выражений оно учитывает имя с заглавной буквы, экспорт по умолчанию, присваивание компонентной переменной и первый аргумент известного HOC. В [follow-up PR #24521](https://github.com/oxc-project/oxc/pull/24521) распознавание уточнили: компонентом считается функция с достижимым `return` JSX или `null`. Благодаря этому callback, метод класса, helper с JSX без возврата и HOC, который лишь содержит JSX внутри, не должны давать ложных срабатываний.

Для безопасных преобразований правило предлагает suggestion: например, может заменить форму функции. Но оно не исправляет опасные случаи — функции с `this`, generator, одиночным unconstrained type parameter или декларацию с type annotation, когда преобразование способно изменить синтаксис или типовой контракт. Исходная реализация — [PR #24471](https://github.com/oxc-project/oxc/pull/24471).

### Type-only imports и отступы в Vitest-блоках

У `import/consistent-type-specifier-style` появился вариант `prefer-top-level-if-only-type-imports`. Он разрешает смешивать value- и type-specifiers в обычном импорте, но требует top-level `import type` для импорта, состоящего только из типов.

```json
{
  "rules": {
    "import/consistent-type-specifier-style": [
      "error",
      "prefer-top-level-if-only-type-imports"
    ]
  }
}
```

```ts
// Корректно: импорт состоит только из типов
import type { User, Session } from "./types";

// Корректно: value и type используются вместе
import { createSession, type Session } from "./session";
```

Поддержка добавлена в [PR #24502](https://github.com/oxc-project/oxc/pull/24502); для существующего поведения и declaration files сохранена совместимость. Кроме того, `vitest/padding-around-test-blocks` теперь использует общую с Jest реализацию `padding-around-test-blocks`, то есть правило стало доступно с той же семантикой и схемой конфигурации ([PR #24519](https://github.com/oxc-project/oxc/pull/24519)).

### Исправления TypeScript-правил и glob-конфигурации

Несколько исправлений релиза устраняют ложные сообщения и небезопасные фиксы:

- `eslint/prefer-destructuring` по умолчанию пропускает declarations с type annotation. Новая опция `enforceForDeclarationWithTypeAnnotation` возвращает проверку в стиле typescript-eslint, но в этом случае Oxlint диагностирует код без автоисправления, чтобы не потерять записанный тип ([PR #24616](https://github.com/oxc-project/oxc/pull/24616)).
- `eslint/no-throw-literal` теперь отслеживает прямое присваивание до `throw`. Случай `let error: Error | null = null; error = new Error("failed"); throw error;` больше не считается выбросом литерала ([PR #24561](https://github.com/oxc-project/oxc/pull/24561)).
- `eslint/no-useless-computed-key` не предлагает убрать скобки у ключа с TypeScript type cast: `({ ["name" as Key]: value })` остаётся допустимым и не репортится ([PR #24524](https://github.com/oxc-project/oxc/pull/24524)).
- `unicorn/no-useless-undefined` не удаляет default `undefined` у параметра, если после такого удаления получился бы обязательный параметр после optional.

И Oxlint, и Oxfmt начали валидировать glob patterns при десериализации конфигурации; Oxfmt также проверяет glob-пути, переданные в CLI. Неверный шаблон теперь заканчивается диагностикой вместо неочевидного результата обхода файлов. Изменение опирается на `fast-glob` 1.1.0 и его API `validate()` ([PR #24744](https://github.com/oxc-project/oxc/pull/24744)).

### Breaking change для потребителей Rust AST API

Внутренний Rust AST Oxc больше не содержит универсальный `MetaProperty`. Вместо него введены отдельные `ImportMeta` и `NewTarget`. Это касается потребителей crates Oxc, которые сопоставляют `Expression::MetaProperty` или вручную создают такие узлы; CLI Oxlint и Oxfmt не требуют миграции конфигурации.

```rust
// До
Expression::MetaProperty(property) => { /* проверка property.meta/property.property */ }

// После
Expression::ImportMeta(meta) => { /* import.meta */ }
Expression::NewTarget(target) => { /* new.target */ }
```

Конструктор `new_meta_property` заменён на `new_import_meta` и `new_new_target`. Формат ESTree и сгенерированные публичные TypeScript-типы при этом сохранены. Причина разделения — старый обобщённый узел позволял вручную представить некорректные комбинации наподобие `foo.bar`; новые типы представляют только две валидные формы. См. [PR #24557](https://github.com/oxc-project/oxc/pull/24557).

## Oxfmt 0.60.0

### `ParseOptions::enable_ident_hashes` для parse-only сценариев

В `oxc_parser::ParseOptions` появилась настройка `enable_ident_hashes` со значением `true` по умолчанию. Раньше parser вычислял hash для каждого `Ident`: это полезно для semantic analysis и быстрых lookup в идентификаторных hash map. Но formatter и parse-and-serialize пути не выполняют semantic analysis, поэтому платили за эти вычисления без пользы.

При `enable_ident_hashes: false` parser создаёт `Ident` с hash `0`. Такой идентификатор нельзя смешивать с обычными хешированными `Ident` в semantic-пайплайне: `Eq` и `Hash` включают сохранённый hash, так что две одинаковые строки в этих двух режимах не равны друг другу как `Ident`.

```rust
use oxc_parser::ParseOptions;

let options = ParseOptions {
    enable_ident_hashes: false,
    ..ParseOptions::default()
};
// Подходит только для parse-only / format / serialization;
// не передавайте полученный AST в semantic analysis.
```

Сам Oxfmt отключает хеширование для JavaScript- и JSON-форматтеров. Исключение — сборка с feature `detect_code_removal`: она запускает `SemanticBuilder`, поэтому hashes остаются включёнными. В benchmark из [PR #24491](https://github.com/oxc-project/oxc/pull/24491) parse-only путь ускорился на 2,3–4,6% на проверенных fixtures; profiling оценивал стоимость hashing в 3,5–4,6% parse time.

### Комментарии и Tailwind template expressions

В CSS/SCSS/Less trailing `//` comment теперь выводится как `line_suffix` и не участвует в вычислении `printWidth`; сам CSS value может остаться в одну строку, даже если комментарий длинный. Блочные `/* ... */` комментарии по-прежнему учитываются в ширине. Аналогичное уточнение сделано для GraphQL: комментарий после `f(a: 1, b: 2) # comment` не должен ошибочно «прилипнуть» к первому аргументу через последующие аргументы ([PR #24579](https://github.com/oxc-project/oxc/pull/24579), [PR #24580](https://github.com/oxc-project/oxc/pull/24580)).

Исправлен и сценарий с Tailwind classes в template expression при `preserveWhitespace`: ранее включённая опция пропускала ignore process, теперь классы остаются связанными с expression вместо нежелательного разрыва ([PR #24609](https://github.com/oxc-project/oxc/pull/24609)). Отдельно стабилизировано форматирование комментария между tag и quasi в tagged template, чтобы повторный запуск formatter не менял результат ([PR #24738](https://github.com/oxc-project/oxc/pull/24738)).

## Обновление

Для объединённого релиза обновите оба инструмента одной командой:

```bash
pnpm add -D oxlint@1.75.0 oxfmt@0.60.0
```

После обновления имеет смысл включать новые правила постепенно: `node/no-top-level-await` может выявить модули, которые нельзя загрузить через `require(esm)`, а `react/function-component-definition` — существующие расхождения в стиле компонентов. Автоисправления `function-component-definition` стоит просматривать, когда используются TypeScript-аннотации, generics, `this` или generator-функции. Если ваш Rust-код потребляет `oxc_ast`, отдельно замените обращения к `MetaProperty` до обновления зависимостей.

Полный список изменений и артефакты релиза — в [GitHub Release `apps_v1.75.0`](https://github.com/oxc-project/oxc/releases/tag/apps_v1.75.0).

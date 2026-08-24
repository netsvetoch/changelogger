---
author: Артём Нецветаев
pubDatetime: 2026-08-24T14:03:07.000Z
title: "Oxlint 1.80.0 и Oxfmt 0.65.0: suggestion для no-confusing-non-null-assertion, разрешение глобалов по ссылке и сохранение декораторов в Oxfmt"
slug: oxlint-oxfmt-apps-v1-80-0
featured: false
draft: false
tags:
  - release
  - oxlint
  - oxfmt
  - javascript
  - typescript
  - tooling
description: "Разбор объединённого релиза Oxlint 1.80.0 и Oxfmt 0.65.0: suggestion в typescript/no-confusing-non-null-assertion, исправление ложных срабатываний при shadowing глобалов, разрешение импортов React/Vue по символу и сохранение class-декораторов в Oxfmt."
---

Вышел объединённый релиз инструментов Oxc: [Oxlint 1.80.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.80.0) и [Oxfmt 0.65.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.80.0). Это minor-релиз формата `apps_v1.80.0`, поэтому пост общий для обоих пакетов и публикуется с `featured: false`. Ключевое — серия правок, убирающих ложные срабатывания при shadowing (локальные связывания, затеняющие глобалы и импорты), suggestion в правиле про NaN-подобный нон-нул-ассерт, а в Oxfmt — сохранение class-декораторов при suppressed-выводе. Источники: [GitHub Release](https://github.com/oxc-project/oxc/releases/tag/apps_v1.80.0), [compare с `apps_v1.79.0`](https://github.com/oxc-project/oxc/compare/apps_v1.79.0...apps_v1.80.0) и связанные PR.

## Oxlint 1.80.0

### 🚀 `typescript/no-confusing-non-null-assertion`: suggestion

Правило получило **suggestion**-фикс ([PR #26012](https://github.com/oxc-project/oxc/pull/26012), issue #2180) — раньше оно помечалось как `pending` и не предлагало исправлений. Теперь для трёх сценариев генерируется авто-предложение:

- в сравнениях на равенство/неравенство лишний `!` просто удаляется;
- в операторах `in` / `instanceof` левый операнд с `!` оборачивается в скобки (чтобы сохранить приоритет);
- в левой части присваивания `!` из нон-нул-ассерт-цели удаляется.

```ts
// сравнение: suggestion удаляет `!`
a! == b; // → a == b;

// instanceof: suggestion оборачивает левую часть в скобки
a! instanceof C; // → (a!) instanceof C;

// присваивание: suggestion удаляет `!`
a! = b; // → a = b;
```

В коде это реализовано через `ctx.diagnostic_with_suggestion` / `diagnostic_with_suggestions` и два фиксера: `remove_non_null_assertion_fix` (удаляет последний символ `!` из спана) и `wrap_left_fix` (вставляет `(` перед и `)` после левого операнда). Это suggestion, а не autofix — применяется вручную, а не через `--fix`.

### Разрешение глобалов по ссылке, а не по имени

Самая заметная группа правок — замена проверок «является ли имя глобальным» на проверку конкретной ссылки. [PR #25905](https://github.com/oxc-project/oxc/pull/25905) заменил в девяти правилах код вида:

```rust
ctx.scoping().root_unresolved_references().contains_key(&ident.name)
```

на существующий хелпер `ctx.is_reference_to_global_variable(ident)`. Старый подход спрашивал, неразрешено ли **имя** где-то в файле, а не является ли **эта ссылка** глобальной — поэтому при shadowing файл, где глобал затеняется в одной области и используется в другой, давал ложное срабатывание:

```js
function f(myLogger) {
  const console = myLogger; // локальный console
  console.log(1); // раньше ошибочно репортилось `no-console`
}
console.log(2); // настоящий глобал в другом месте файла
```

Затронуты правила: `eslint/no-console`, `no-constant-binary-expression`, `no-new-native-nonconstructor`, `prefer-object-spread`, `symbol-description`, `valid-typeof`, `promise/avoid-new`, `unicorn/new-for-builtins`, `unicorn/prefer-global-this`. Хелпер также учитывает конфиг `globals: { X: "off" }`. Автор замера: по четырём корпусам (vscode, sentry, material-ui, actualbudget) **0 новых диагностик, 23 удалённых** — все удалённые это `prefer-global-this` на по-настоящему затенённом `window` (например IIFE-параметр `(function (window, document, JSON) { ... })`).

### Разрешение импортов React/Vue по символу

Похожая идея для импортов: вместо сопоставления по **имени** импорт проверяется по **символу** через общие хелперы `is_import_symbol` / `is_import_from_module`.

- **`react/no-react-children`** ([PR #25901](https://github.com/oxc-project/oxc/pull/25901)): четыре ложных срабатывания, когда локальная переменная затеняла импорт `Children`/`React`, и один ложный негатив, когда импорт был алиасирован. Теперь ловятся и такие случаи:

  ```js
  import { Children } from "react";
  function f(x) {
    const Children = { count: () => 0 }; // раньше: ложное срабатывание
    return Children.count(x);
  }

  import { Children as C } from "react"; // раньше: пропускалось
  C.toArray(x);
  ```

- **Vue** ([PR #25903](https://github.com/oxc-project/oxc/pull/25903)): `vue/no-deprecated-delete-set` проверяла `this.$set`/`this.$delete` внутри Vue-компонента по локальному имени `defineComponent`, поэтому алиасированный импорт не распознавался:

  ```vue
  <script>
  import { defineComponent as dc } from "vue";
  dc({
    mounted() {
      this.$set(obj, key, value); // раньше: не репортилось
      this.$delete(obj, key);
    },
  });
  </script>
  ```

  Оба вызова теперь репортятся. Заодно `is_imported_set_or_del_from_vue` и `is_vue_next_tick_import` упрощены до вызова хелперов.

### Прочие правки Oxlint

- **`eslint/no-useless-rename`: сохраняет `type`-модификаторы** ([PR #26020](https://github.com/oxc-project/oxc/pull/26020), issue #26004) — при удалении избыточного алиаса импорта/экспорта сохраняется inline `type`, чтобы не менять семантику под `verbatimModuleSyntax`.
- **`oxc/double-comparisons`: сгруппированные логические выражения** ([PR #26044](https://github.com/oxc-project/oxc/pull/26044)) — теперь обнаруживаются смежные сравнения через левоассоциативные группы `&&`/`||`, а спаны диагностики и suggestion ограничены упрощаемыми сравнениями (учтены смешанный приоритет, скобки и сгруппированный `&&`).
- **`eslint/no-control-regex`: уточнён help-текст** ([PR #25996](https://github.com/oxc-project/oxc/pull/25996)) — раньше текст советовал «использовать Unicode escape», хотя все формы escape также флагаются (поведение совпадает с upstream ESLint); теперь help советует отключить правило, если это намеренно.
- **`estree`: декораторы в спанах `FormalParameterRest`** ([PR #26021](https://github.com/oxc-project/oxc/pull/26021), issue #26011) — `FormalParameterRest` сериализуется с внешним спаном, чтобы его диапазон включал декораторы параметров; `sourceMapValidationDecorators.ts` убран из baseline расхождений ESTree.
- **Убраны невалидные ссылки React Compiler** ([PR #25900](https://github.com/oxc-project/oxc/pull/25900)) — общий макрос правил React Compiler генерировал `react.dev`-ссылки для внутренних категорий без публичных lint-страниц; теперь такие атрибуции рендерятся без ссылки.
- **`rust`: deprecation из nightly** ([PR #25998](https://github.com/oxc-project/oxc/pull/25998)) — `unit-bindings` переименован в `unit_bindings`, `isize::max_value()`/`usize::max_value()` заменены на `MAX`, убран макрос `clippy::legacy_numeric_constants`. Чистка для совместимости с Rust 1.98.

### 📚 Документация

- У правил, вышедших в 1.79.0, проставлен `version = "1.79.0"` ([PR #25902](https://github.com/oxc-project/oxc/pull/25902)) — это 22 правила React Compiler из PR #25500 плюс `eslint/no-unreachable-loop`, которые из-за сбоя release-задачи всё ещё числились как `version = "next"`.

## Oxfmt 0.65.0

### Сохранение class-декораторов при suppressed-выводе

Единственное изменение форматтера — [PR #26034](https://github.com/oxc-project/oxc/pull/26034), issue #25911. Для синтаксиса эти две формы эквивалентны:

```ts
@deco
export class X {}
export
@deco
class X {}
```

Но в первой декораторы лежат **вне спана** и `ExportDeclaration`, и `Class` — они не попадают ни в один узел. suppression-путь форматтера печатает спан `ExportDeclaration` дословно, поэтому декораторы молча терялись:

```ts
// Вход
@sealed
export class Foo {}

// после Oxfmt 0.64.0 (с suppression) — декоратор терялся
export class Foo {}
```

Вторая форма (декоратор внутри спана export-узла) не страдала. Теперь декораторы перед `export` сохраняются, и обе записи дают идентичный корректный вывод.

## Обновление

```bash
pnpm add -D oxlint@1.80.0 oxfmt@0.65.0
```

Изменений в конфиге не требуется: это minor-релиз без breaking changes. Стоит ожидать уменьшения числа ложных срабатываний `no-console`, `prefer-global-this`, `no-react-children` и Vue-правил на проектах, где глобалы/импорты затеняются локальными связываниями.

Полный список изменений: [GitHub Release `apps_v1.80.0`](https://github.com/oxc-project/oxc/releases/tag/apps_v1.80.0).

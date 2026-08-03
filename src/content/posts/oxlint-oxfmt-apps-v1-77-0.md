---
author: Артём Нецветаев
pubDatetime: 2026-08-03T13:03:00.000Z
title: "Oxlint 1.77.0 и Oxfmt 0.62.0: charAt/at/[], GitHub annotations, gitignore roots и YAML в CLI"
slug: oxlint-oxfmt-apps-v1-77-0
featured: false
draft: false
tags:
  - release
  - oxlint
  - oxfmt
  - javascript
  - typescript
  - tooling
description: "Разбор объединённого релиза Oxlint 1.77.0 и Oxfmt 0.62.0: расширенный oxc/bad-char-at-comparison, file:line:col в --format=github, GitignoreChecker для walk roots, prefer-const вне Svelte/Vue, YAML-форматирование в CLI и tsx-in-vue."
---

Вышел объединённый релиз инструментов Oxc: [Oxlint 1.77.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.77.0) и [Oxfmt 0.62.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.77.0). В Oxlint расширили correctness-правило сравнения одиночных символов, сделали читаемее GitHub Actions annotations и поправили обход gitignored-корней. Oxfmt подключает YAML-форматтер к CLI (breaking для parser:yaml), поддерживает `<script lang="tsx">` в Vue и подсвечивает список файлов в `--check`.

Это один minor-релиз формата `apps_v1.77.0`, поэтому пост общий для обоих пакетов и публикуется с `featured: false`. Источники: [GitHub Release](https://github.com/oxc-project/oxc/releases/tag/apps_v1.77.0), [compare с `apps_v1.76.0`](https://github.com/oxc-project/oxc/compare/apps_v1.76.0...apps_v1.77.0) и связанные PR.

## Oxlint 1.77.0

### `oxc/bad-char-at-comparison`: не только `charAt`

Правило `oxc/bad-char-at-comparison` больше не ограничено вызовом `charAt`. Теперь оно ловит бессмысленное сравнение одиночного символа со строкой длиннее одного UTF-16 code unit и для:

- `String.prototype.charAt(i)`
- `String.prototype.at(i)` (только когда receiver однозначно строка)
- computed access `str[0]` / `str["0"]` по строке

Диагностика переименована в «Invalid character comparison», а узел обхода сменился с `CallExpression` на `BinaryExpression` с equality-оператором. Длина сравниваемой строки считается в UTF-16 code units (`encode_utf16().count()`), поэтому суррогатные пары вроде `"😀"` тоже считаются «длиннее одного символа» и попадают под правило. Часть кейсов выровнена с `eslint-plugin-unicorn/no-invalid-character-comparison`.

```json
{
  "rules": {
    "oxc/bad-char-at-comparison": "error"
  }
}
```

```js
// Ошибки: слева один символ, справа строка длины > 1
a.charAt(4) === "aa";
"abc".at(0) === "ab";
"abc"[0] === "ab";
const value = "abc";
value[0] === "ab";

// Корректно
a.charAt(4) === "a";
"abc".at(0) === "a";
[1, 2].at(0) === "ab"; // receiver не строка — не репортится
```

Для `at` и bracket-доступа Oxlint требует доказать, что объект — строка: string literal, `const` со string init или binding с аннотацией `string`. Числовые индексы и безопасные строковые индексы (`"0"`, `"12"` без ведущих нулей) считаются static string index. Реализация — [PR #25001](https://github.com/oxc-project/oxc/pull/25001).

### `--format=github`: `file:line:col` в тексте annotation

Параметры `file=`, `line=`, `col=` в workflow command GitHub Actions заполняют только панель Annotations. В самом логе job раньше оставалось голое сообщение без пути:

```text
Error: Function 'foo' is declared but never used.
```

Теперь message prefix’ится локацией в стиле Ruff:

```text
::error file=test.js,line=5,endLine=5,col=1,endColumn=10,title=eslint(no-debugger)::test.js:5:1: `debugger` statement is not allowed
```

Имя файла экранируется дважды: по property-правилам для `file=` (запятая → `%2C`) и по data-правилам для текста сообщения (запятая остаётся литералом, `%` экранируется в обоих местах). В bubble annotation локация дублируется — это сознательный trade-off ради читаемого лога. См. [PR #25020](https://github.com/oxc-project/oxc/pull/25020).

### `.gitignore` для walk roots и явных путей

И oxlint, и oxfmt раньше полагались на walker crate `ignore`: directory-pattern вроде `generated` отсекает содержимое только при обходе сверху вниз. Если cwd или явный CLI-target уже лежит _внутри_ gitignored-дерева, pruning не срабатывает, и файлы линтились/форматировались вопреки `git check-ignore`.

В `oxc_config` добавлен `GitignoreChecker`: pre-walk проверка, которая воспроизводит порядок разрешения git по цепочке предков (с кэшем matchers и probe `.git`/`.jj`). Все CLI-targets проходят через неё **до** walk.

Практические последствия:

- явно переданные gitignored-файлы теперь пропускаются (раньше всегда обрабатывались);
- `oxlint --no-ignore` **не** отключает git-слой: флаг по-прежнему гасит только tool-owned ignore (`.eslintignore`, `--ignore-path`, `--ignore-pattern`), а не `.gitignore`;
- при cwd внутри ignored-дерева без явных «живых» targets оба инструмента завершаются с «no files found».

```bash
# repo/sub/.gitignore содержит "generated"
# cwd = repo/sub/generated/pkg
oxlint            # → LintNoFilesFound
oxlint index.ts   # → пропуск, даже с --no-ignore
oxfmt --check     # → "Expected at least one target file..."
```

Подробности модели слоёв ignore и фикстуры — в [PR #25133](https://github.com/oxc-project/oxc/pull/25133).

### `eslint/prefer-const` больше не трогает Svelte и Vue

Oxlint видит только блоки `<script>` в `.svelte` / `.vue`. Присваивания из template (`bind:this`, `v-model`, `@click="open = !open"`) для правила невидимы, поэтому `prefer-const` предлагал `const` и ломал компиляцию фреймворка.

```svelte
<script lang="ts">
  let divEl: HTMLElement | null = $state(null);
</script>

<div bind:this={divEl}></div>
```

```vue
<script setup>
let msg = "";
let open = false;
</script>

<template>
  <input v-model="msg" />
  <button @click="open = !open">{{ open }}</button>
</template>
```

Правило теперь пропускает `.svelte` и `.vue` через `should_run` — тот же guard, что уже используют `no-unused-vars`, `consistent-type-imports` и соседние rules. **Astro намеренно не пропускается**: frontmatter-bindings из template не переназначаются, правило там остаётся полезным. См. [PR #25148](https://github.com/oxc-project/oxc/pull/25148).

### Категория, плагины и точечные rule-fixes

- `eslint/prefer-promise-reject-errors` перенесён из `style` в `pedantic`, чтобы совпасть с type-aware TypeScript-вариантом ([PR #25201](https://github.com/oxc-project/oxc/pull/25201)). Если вы включаете наборы по категориям, правило может появиться/пропасть в другом preset.
- Дублирующиеся имена JS-плагинов после нормализации теперь отвергаются; имена плагинов изолированы per LSP workspace ([PR #25243](https://github.com/oxc-project/oxc/pull/25243)).
- `unicorn/prefer-math-trunc` больше не предлагает замену для `>>> 0` / `>>>= 0` — как upstream eslint-plugin-unicorn ([PR #25240](https://github.com/oxc-project/oxc/pull/25240)).
- `unicorn/new-for-builtins` учитывает parenthesized member expression object и выровнял diagnostic message для `Date()` с upstream.
- Серия фиксов bounded / comment-aware token lookup (`eqeqeq`, `prefer-const`, `no-unused-vars`, `yoda`, `prefer-template`, import-rules и др.): spans и автофиксы не цепляют токены внутри комментариев и не выходят за безопасные границы исходника. Отдельно source text индексируется по byte offset, а не по char count — это чинит многобайтовые пути для `no-magic-array-flat-depth` и соседних rules.
- `eslint/prefer-const` — см. выше; `eslint/no-control-regex` разрешает null escape; `no-unreachable-loop` корректнее обрабатывает caught errors; autofix больше не вставляет ASI-точку с запятой в unbraced statement body.

### Breaking для потребителей Rust AST / semantic

Для пользователей CLI oxlint эти изменения обычно прозрачны; они ломают код, который ходит по oxc AST / semantic API:

- `semantic`: JSDoc возвращается borrowed, чтобы работал parse cache ([#25186](https://github.com/oxc-project/oxc/pull/25186));
- `TSIndexSignature::parameter` хранит один parameter ([#25154](https://github.com/oxc-project/oxc/pull/25154));
- введены `ExportDeclaration` / `ExportFromDeclaration` ([#25095](https://github.com/oxc-project/oxc/pull/25095));
- тело стрелочной функции вынесено в enum `ArrowFunctionBody` ([#24987](https://github.com/oxc-project/oxc/pull/24987)).

Если вы пишете custom rules или tooling на crate’ах oxc, сверяйте match/destructure с этими типами на теге `apps_v1.77.0`.

## Oxfmt 0.62.0

### Breaking: YAML через `oxc_formatter_yaml`

В 0.61.0 YAML-форматтер появился как crate/API. В 0.62.0 oxfmt **фактически форматирует** `.yaml` / `.yml` и родственные файлы через `oxc_formatter_yaml` (в release notes помечено как breaking для `parser:yaml`).

Маршрутизация файлов:

- обычные YAML → `FormatStrategy::OxcFormatterYaml`;
- «rc»-имена вроде `.prettierrc` (как у Prettier yaml embed) → сначала попытка JSON, при неудаче YAML (`OxcFormatterYamlRc`).

Опции из `FormatConfig` мапятся в `YamlFormatOptions`: `printWidth` / indent / line ending, плюс `proseWrap`, `singleQuote`, `bracketSpacing`, `trailingComma` (`all`/`es5` для YAML flow collections эквивалентны «не none»).

```bash
oxfmt config.yml .prettierrc
```

Это breaking для тех, кто ожидал прежний external/Prettier path для `parser: yaml`, или чей YAML намеренно оставался «как есть». См. [PR #24890](https://github.com/oxc-project/oxc/pull/24890). Сопутствующие фиксы YAML: long keys у block scalar header, end-comments у sequence/collection, ancestor claim end comments после block scalars.

### `tsx` внутри Vue SFC

Раньше `<script lang="tsx">` в `.vue` не получал сигнал «это TSX» от Prettier-embed path: `filepath` оставался родительским `.vue`, JS-сторона резолвила extension в `ts`, и JSX в script ломал parse.

Теперь Rust `text_to_doc_api::run` при контексте `vue-script` и неудачном parse как TypeScript без JSX повторяет format как TSX. Обычный `ts-in-vue` остаётся single-parse (без Prettier `maybeJSXRe` sniff на каждый файл). Conformance-заметка «`lang=tsx` is not supported» снята. См. [PR #25063](https://github.com/oxc-project/oxc/pull/25063) и follow-up rework [PR #25106](https://github.com/oxc-project/oxc/pull/25106).

```vue
<script lang="tsx">
import { VNode } from "vue";
export default {
  render(h): VNode {
    return <div>{this.foo}</div>;
  },
};
</script>
```

### Цветной список файлов в `oxfmt --check`

В check mode пути с format mismatch печатаются warning-стилем `GraphicalTheme` (тот же детект цвета, что у diagnostic reporter). `FORCE_COLOR=1` / `CI=true` включают ANSI; `NO_COLOR=1` и `FORCE_COLOR=0` оставляют plain text. Режим `--list-different` остаётся без стилей — он рассчитан на piping.

```bash
oxfmt --check
# Checking formatting...
# unformatted.js (12ms)   ← path может быть цветным
# Format issues found in above 1 files. ...
```

Реализация — [PR #25061](https://github.com/oxc-project/oxc/pull/25061).

### Прочие правки formatter

- formatter CSS: glued plugin words в grid values; bump `oxc-css-parser` для substituted at-rule preludes.
- formatter JS: hug arrows с type-reference return annotations.
- shared gitignore walk-root fix — тот же [PR #25133](https://github.com/oxc-project/oxc/pull/25133), что у oxlint.
- performance: pre-alloc IR buffers в CSS/GraphQL/YAML/JSON formatters.
- JSDoc option typing для enum options в oxfmt config.

Те же AST breaking changes, что у oxlint (`TSIndexSignature`, export declarations, `ArrowFunctionBody`, плюс `TSIndexSignatureName::name` → `Ident`), затрагивают и formatter path на уровне crate API.

## Обновление

```bash
pnpm add -D oxlint@1.77.0 oxfmt@0.62.0
```

После обновления имеет смысл:

1. прогнать CI с `--format=github` и убедиться, что лог читается без второго прогона default-format;
2. проверить monorepo/husky-сценарии, где в staged попадали gitignored generated-пути — они теперь молча пропускаются;
3. для Vue/Svelte снять лишние disable’ы вокруг `prefer-const`;
4. прогнать `oxfmt --check` по YAML/`.prettierrc` и, при необходимости, закоммитить новый snapshot формата;
5. если пишете на oxc AST/semantic — обновить match’и под breaking enum/field changes.

Полный список изменений: [GitHub Release `apps_v1.77.0`](https://github.com/oxc-project/oxc/releases/tag/apps_v1.77.0).

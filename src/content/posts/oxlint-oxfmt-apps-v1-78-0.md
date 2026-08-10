---
author: Артём Нецветаев
pubDatetime: 2026-08-10T11:19:26.000Z
title: "Oxlint 1.78.0 и Oxfmt 0.63.0: one-var, jsdoc/no-blank-blocks, components у anchor-has-content и YAML front matter в CSS"
slug: oxlint-oxfmt-apps-v1-78-0
featured: false
draft: false
tags:
  - release
  - oxlint
  - oxfmt
  - javascript
  - typescript
  - tooling
description: "Разбор объединённого релиза Oxlint 1.78.0 и Oxfmt 0.63.0: eslint/one-var, jsdoc/no-blank-blocks, components у jsx-a11y/anchor-has-content, dangerous-fix для prefer-code-point, YAML front matter в CSS и ленивый tinypool."
---

Вышел объединённый релиз инструментов Oxc: [Oxlint 1.78.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.78.0) и [Oxfmt 0.63.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.78.0). В Oxlint появились нативные порты `eslint/one-var` и `jsdoc/no-blank-blocks`, у `jsx-a11y/anchor-has-content` добавили option `components`, а autofix `unicorn/prefer-code-point` понизили до dangerous. Oxfmt форматирует YAML front matter внутри CSS/SCSS/Less через `oxc_formatter_yaml` и поднимает tinypool только при первом JS-delegation.

Это один minor-релиз формата `apps_v1.78.0`, поэтому пост общий для обоих пакетов и публикуется с `featured: false`. Источники: [GitHub Release](https://github.com/oxc-project/oxc/releases/tag/apps_v1.78.0), [compare с `apps_v1.77.0`](https://github.com/oxc-project/oxc/compare/apps_v1.77.0...apps_v1.78.0) и связанные PR.

## Oxlint 1.78.0

### `eslint/one-var`: группировка объявлений переменных

Нативный порт [ESLint `one-var`](https://eslint.org/docs/latest/rules/one-var) ([PR #24470](https://github.com/oxc-project/oxc/pull/24470)). Правило категории `style` с conditional autofix. Конфиг — либо единый mode, либо object по kind/инициализации:

- mode: `"always"` (default), `"never"`, `"consecutive"`;
- per-kind: `var`, `let`, `const`, `using`, `awaitUsing`;
- overrides: `initialized` / `uninitialized` (имеют приоритет над per-kind);
- `separateRequires: true` — прямые `require(...)` не смешиваются с остальными initialized-деклараторами в одном statement.

```json
{
  "rules": {
    "one-var": ["error", "never"],
    "eslint/one-var": [
      "error",
      {
        "const": "never",
        "let": "consecutive",
        "var": "always",
        "initialized": "never",
        "separateRequires": true
      }
    ]
  }
}
```

```js
// "always" (default): соседние объявления одного kind надо объединять
var foo = 1;
var bar = 2;
// → var foo = 1, bar = 2;

// "never": каждый declarator — отдельный statement
var a = 1,
  b = 2;
// → var a = 1; var b = 2;

// separateRequires: true + var: "always"
var foo = require("foo"),
  bar = 1; // split requires into a single block
```

Поддерживаются `using` / `await using`, class static blocks, for-in/of, labels и export. Follow-up [PR #25314](https://github.com/oxc-project/oxc/pull/25314) не склеивает exported declarations при join-fix — `export const foo = 1` и соседний `const` не превращаются в один statement с `export`.

### `jsdoc/no-blank-blocks`: пустые JSDoc-блоки

Новое правило плагина `jsdoc`, категория `style` ([PR #25207](https://github.com/oxc-project/oxc/pull/25207)). Репортит JSDoc, внутри которого между `/**` и `*/` только whitespace и строки `*`. Опция:

- `enableFixer` (default `false`) — удалить весь blank-блок вместе с indentation и trailing line ending, но только если блок занимает целую строку (inline `typeof/** */value` остаётся без autofix).

```json
{
  "rules": {
    "jsdoc/no-blank-blocks": ["warn", { "enableFixer": true }]
  }
}
```

```js
// incorrect
/** */
/**
 *
 */

// correct
/** @tag */
/**
 * Text
 */
```

Диагностика: `jsdoc(no-blank-blocks): No empty blocks`. Без `enableFixer` правило только предупреждает.

### `jsx-a11y/anchor-has-content`: option `components`

Правило больше не зашито только на `<a>`. Добавлен config object как у upstream eslint-plugin-jsx-a11y ([PR #24571](https://github.com/oxc-project/oxc/pull/24571)):

```json
{
  "rules": {
    "jsx-a11y/anchor-has-content": [
      "error",
      { "components": ["Anchor", "Link"] }
    ]
  }
}
```

```jsx
// components: ["Anchor", "Link"]
<a /> // error
<Anchor /> // error — custom name из списка
<Anchor>content</Anchor> // ok
<Link /> // ok без components (имя не a и не в списке)
```

Проверка по-прежнему смотрит accessible children, `dangerouslySetInnerHTML`, `children`, `title` / `aria-label` и hidden-from-SR. Это **rule-level** `components`, отдельно от `settings["jsx-a11y"].components` (map custom → DOM element): PR сознательно повторяет upstream option правила, а не settings-map.

### `unicorn/prefer-code-point`: autofix стал dangerous

Раньше `oxlint --fix` переименовывал `charCodeAt` → `codePointAt` и `String.fromCharCode` → `String.fromCodePoint` как safe fix. Это ломает hash-циклы по UTF-16 code units и может превратить рабочий `fromCharCode` в `RangeError` на out-of-range/NaN входах ([PR #25412](https://github.com/oxc-project/oxc/pull/25412)).

Теперь у правила `fix_dangerous`: диагностика та же, но rewrite применяется только с `--fix-dangerously`. Обычный `--fix` оставляет исходник.

```js
// педантичное предупреждение остаётся
h ^= s.charCodeAt(i);

// oxlint --fix        → без изменений
// oxlint --fix-dangerously → s.codePointAt(i)
```

Upstream eslint-plugin-unicorn это правило вообще не auto-fix'ит; dangerous-tier ближе к реальной семантике, чем silent rewrite.

### React: constructor callbacks и exhaustive memo

- `react/rules-of-hooks` ловит hooks внутри anonymous callbacks, переданных в constructors — в том числе `new Promise(...).then(...)` внутри component body. Lower-case `notAComponent` по-прежнему разрешён, как у `eslint-plugin-react-hooks` ([PR #25377](https://github.com/oxc-project/oxc/pull/25377)).
- `react_compiler`: `validate_exhaustive_memoization_dependencies` по умолчанию `false`. Диагностики вида «Found extra/missing memoization dependencies» больше не сыпятся из default environment; preserve-manual-memo path остаётся ([PR #25417](https://github.com/oxc-project/oxc/pull/25417)).

### Точечные rule-fixes и LSP

- `eslint/no-implicit-coercion`: template-shorthand считается coercion только при **обеих** пустых cooked quasis; leading/trailing/escaped whitespace сохраняются при `disallowTemplateShorthand` ([PR #25470](https://github.com/oxc-project/oxc/pull/25470)).
- JS plugins + ignore fixes: `ContextSubHost` держит стабильный `source_text` даже после `take` semantic для external rules — LSP больше не падает на code actions / disable-line для JS-plugin diagnostics ([PR #25280](https://github.com/oxc-project/oxc/pull/25280)).
- LSP `rulesCustomization`: ключи нормализуются тем же parser, что и config; работают `eslint/` prefixes и aliases вроде `@typescript-eslint` ([PR #25316](https://github.com/oxc-project/oxc/pull/25316)).
- `unicorn/new-for-builtins`: ignore optional chains, поддержка `Float16Array`.
- `unicorn/error-message`: сообщения для `SuppressedError`.
- `eslint/prefer-promise-reject-errors`: parenthesized calls.
- `eslint/no-unreachable-loop`: не репортит loops, body которых содержит `finally`.
- `eslint/no-throw-literal`: false positive на variable без initializer.
- `eslint/no-param-reassign`: validate `ignorePropertyModificationsForRegex`.
- `typescript/ban-ts-comment`: validate `description_format`; `no-unused-vars` / vitest `consistent-test-filename` — report invalid regex options.
- Серия bounded token lookup (`switch-case-braces`, `no-static-only-class`, `empty-brace-spaces`, `prefer-namespace-keyword`, `no-namespace`, `consistent-type-definitions`, …) — spans/autofix не выходят за безопасные границы токенов.

### Performance (oxlint)

Сжатие rule config dispatch и visitor code size, preallocate fix-content в LSP, hoist `current_dir` в stylish reporter, single-buffer JSON report, early bail / manual parser у `ban-ts-comment` / `ban-tslint-comment`, узкий AST dispatch у vue/unicorn helpers. Для CLI-пользователя это прозрачно; для embedders — меньше аллокаций на diagnostic path.

## Oxfmt 0.63.0

### YAML front matter в CSS/SCSS/Less

Standalone CSS path больше не держит Jekyll/Hugo-style front matter «как есть с примитивной нормализацией». Oxfmt собирает `FormatSession` + `FormatDispatcher` и для YAML-блока в начале файла диспатчит body в `oxc_formatter_yaml` ([PR #25336](https://github.com/oxc-project/oxc/pull/25336)).

```scss
---
title: Home
list:
  - 1
---

.a {
  color: red;
}
```

```scss
---
title: Home
list:
  - 1
---

.a {
  color: red;
}
```

Поведение, зафиксированное end-to-end тестами:

- bare `---` и explicit `---yaml` форматируются native YAML; tag `---yaml` re-emit'ится;
- закрывающий `...` сохраняется как `...`;
- gap после блока нормализуется ровно в одну blank line перед nonempty body;
- empty block печатается delimiters-only без dispatch;
- `---mycustomparser` и TOML (`+++`) остаются verbatim (как Prettier; у TOML ещё нет IR-formatter);
- unparsable YAML → весь block verbatim, CSS body всё равно форматируется;
- `embeddedLanguageFormatting: "off"` → block verbatim;
- BOM на byte 0 сохраняется; CRLF нормализуется;
- css-in-js template и JSDoc css fence, начинающиеся с `---`, **не** получают file-envelope semantics (Fragment refuses front matter).

Детект envelope вынесен в `oxc_formatter_core::spec::{parse_front_matter, blank_front_matter}` (port Prettier `front-matter/parse.js`); CSS crate владеет routing/composition policy.

### JSDoc fences: effective print width и xxx-in-js

JSDoc fenced blocks больше не печатаются с «голым» root `printWidth`. Embedder передаёт effective width позиции комментария; native branch override'ит `PrintWidth`, Prettier branch получает `printWidth` в options JSON ([PR #25413](https://github.com/oxc-project/oxc/pull/25413)). Отдельно форматтер умеет xxx-in-js внутри JSDoc `js` fence (CSS-in-JS-in-JSDoc и т.п.) ([PR #25414](https://github.com/oxc-project/oxc/pull/25414)).

### Index / mapped type brackets

`TSIndexSignature` и mapped types печатают parameter внутри `group(soft_block_indent(...))`. Leading comment на parameter и overflow `printWidth` корректно ломают скобки, а короткий параметр без break-forcing comment снова схлопывается в одну строку ([PR #25296](https://github.com/oxc-project/oxc/pull/25296), [PR #25297](https://github.com/oxc-project/oxc/pull/25297)):

```ts
type Config = {
  [
    // key name must match widgets/ subdirectory
    widgetName: string
  ]: WidgetConfig;
};

type E = {
  [k: string]: number; // collapses
};
```

### Прочие правки formatter

- comments after TS `this` parameter сохраняются;
- drop IR Space at line start for js-in-xxx;
- unify leading-BOM handling в `formatter_core`;
- YAML: overflowing key не переписывается в implicit;
- CSS parser bump: unknown at-rule с interpolation;
- `hardlineWithoutBreakParent` equivalent IR в core;
- **perf**: tinypool (JS-side worker pool) создаётся лениво при первом format, которому реально нужна JS-delegation. CLI/LSP сессии только на native Rust path больше не держат idle workers ([PR #25298](https://github.com/oxc-project/oxc/pull/25298)). Trade-off: первый JS-delegated format в LSP session платит spawn cost один раз.

## Обновление

```bash
pnpm add -D oxlint@1.78.0 oxfmt@0.63.0
```

После обновления имеет смысл:

1. если переносите ESLint `one-var` — включить `one-var` / `eslint/one-var` с тем же mode object и прогнать `--fix` на non-export scopes;
2. для design-system link-компонентов добавить `components` в `jsx-a11y/anchor-has-content`;
3. убрать ожидание, что `oxlint --fix` перепишет `charCodeAt`/`fromCharCode` — нужен `--fix-dangerously`;
4. прогнать `oxfmt` по CSS/SCSS с YAML front matter (Jekyll/Hugo/VitePress assets) и закоммитить новый snapshot;
5. при шумах React Compiler exhaustive-memo — default уже тише; явный enable остаётся через environment config compiler path.

Полный список изменений: [GitHub Release `apps_v1.78.0`](https://github.com/oxc-project/oxc/releases/tag/apps_v1.78.0).

---
author: Артём Нецветаев
pubDatetime: 2026-08-22T19:35:14.000Z
title: "Oxlint 1.79.0 и Oxfmt 0.64.0: React Compiler разбит на категорийные правила, experimentalOperatorPosition и новые диагностики"
slug: oxlint-oxfmt-apps-v1-79-0
featured: false
draft: false
tags:
  - release
  - oxlint
  - oxfmt
  - react
  - javascript
  - typescript
  - tooling
description: "Разбор объединённого релиза Oxlint 1.79.0 и Oxfmt 0.64.0: breaking-изменение react/react-compiler (разбит на 24 категорийных правила), экспериментальный experimentalOperatorPosition и ранние диагностики React Compiler вне node_modules."
---

Вышел объединённый релиз инструментов Oxc: [Oxlint 1.79.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.79.0) и [Oxfmt 0.64.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.79.0). Главное событие — **breaking change** в экспериментальном правиле `react/react-compiler`: его разбили на 24 категорийных правила (включая «не реализованные» категории), как в `eslint-plugin-react-hooks` v7. В Oxfmt появился экспериментальный `experimentalOperatorPosition` для пересечений типов. Плюс большая порция правок диагностик React Compiler и реакт-правил.

Это один minor-релиз формата `apps_v1.79.0`, поэтому пост общий для обоих пакетов и публикуется с `featured: false`. Источники: [GitHub Release](https://github.com/oxc-project/oxc/releases/tag/apps_v1.79.0), [compare с `apps_v1.78.0`](https://github.com/oxc-project/oxc/compare/apps_v1.78.0...apps_v1.79.0), связанные PR и официальный пост [React Compiler Support](https://oxc.rs/blog/2026-08-18-react-compiler-support).

## Oxlint 1.79.0

### 💥 Breaking: `react/react-compiler` разбит на категорийные правила

Раньше вся подключаемая к Oxlint логика React Compiler жила в одном экспериментальном правиле `react/react-compiler` с опцией `reportAllBailouts`. В этом релизе ([PR #25500](https://github.com/oxc-project/oxc/pull/25500)) это правило **удалено** вместе с `reportAllBailouts`.

Принцип работы не изменился: React Compiler теперь, как и раньше, запускается один раз на файл, но структурированные диагностики маршрутизируются в каждое включённое правило по категории. Разница в том, что вместо одного правила появилось `24` именованных категорийных правила, повторяющих раскладку `eslint-plugin-react-hooks` v7.

Полный список правил (rule → upstream-пресет → категория Oxlint):

| Правило                          | ESLint-пресет      | Категория Oxlint                                                            |
| -------------------------------- | ------------------ | --------------------------------------------------------------------------- |
| `error-boundaries`               | recommended        | correctness                                                                 |
| `globals`                        | recommended        | correctness                                                                 |
| `immutability`                   | recommended        | correctness                                                                 |
| `incompatible-library`           | recommended        | correctness                                                                 |
| `preserve-manual-memoization`    | recommended        | correctness                                                                 |
| `purity`                         | recommended        | correctness                                                                 |
| `refs`                           | recommended        | correctness                                                                 |
| `set-state-in-effect`            | recommended        | correctness                                                                 |
| `set-state-in-render`            | recommended        | correctness                                                                 |
| `static-components`              | recommended        | correctness                                                                 |
| `use-memo`                       | recommended        | correctness                                                                 |
| `unsupported-syntax`             | recommended        | restriction                                                                 |
| `config`                         | recommended        | не реализовано — Oxlint использует фиксированные валидные опции компилятора |
| `gating`                         | recommended        | не реализовано — Oxlint пока не открывает gating-опции компилятора          |
| `void-use-memo`                  | recommended-latest | correctness                                                                 |
| `no-deriving-state-in-effects`   | off                | perf                                                                        |
| `invariant`                      | off                | restriction                                                                 |
| `rule-suppression`               | off                | restriction                                                                 |
| `syntax`                         | off                | restriction                                                                 |
| `todo`                           | off                | restriction                                                                 |
| `capitalized-calls`              | off                | suspicious                                                                  |
| `exhaustive-effect-dependencies` | off                | suspicious                                                                  |
| `hooks`                          | off                | suspicious                                                                  |
| `memo-dependencies`              | off                | suspicious                                                                  |
| `fbt`                            | off                | не реализовано — внутренняя категория Meta FBT                              |
| `memoized-effect-dependencies`   | off                | не реализовано — категория `EffectDependencies` отсутствует в Rust-порте    |

Так выглядит **миграция** для тех, кто включал старое nursery-правило ([PR #25500](https://github.com/oxc-project/oxc/pull/25500), [официальный пост](https://oxc.rs/blog/2026-08-18-react-compiler-support)):

```jsonc
// .oxlintrc.json
{
  "plugins": ["react"],
  "categories": {
    "correctness": "error",
  },
}
```

Если в конфиге был ключ `react/react-compiler` — его надо **удалить**: правило больше не существует, и Oxlint упадёт на незнакомом имени правила. All-recommended правила React Compiler попадают в категорию `correctness`, которая включается пресетом/category-flag выше. Правила из `suspicious` (например `hooks`, который дублирует некомпиляторный `react/rules-of-hooks`, или `memo-dependencies`, дублирующий `react/exhaustive-deps`) по умолчанию выключены и включаются точечно.

Внутри Rust-кода правило объявлено через новый макрос `declare_react_compiler_lint!` и запускается через общий раннер `run_react_compiler_rule(ctx, ErrorCategory::…)` — например `react/suspicious` правило `react/hooks` исполняет `run_react_compiler_rule(ctx, ErrorCategory::Hooks)` ([источник](https://github.com/oxc-project/oxc/blob/apps_v1.79.0/crates/oxc_linter/src/rules/react/hooks.rs)).

### Диагностики React Compiler

Вместе с реструктуризацией пришли точечные улучшения самих диагностик:

- **`react_compiler`: node_modules пропускаются по умолчанию** ([PR #25859](https://github.com/oxc-project/oxc/pull/25859)). Трансформ и lint-анализ React Compiler больше не заходят в `node_modules`, если только явные `sources`-allowlist трансформа не вернут зависимости обратно. Это исключает поток диагностик по стороннему коду в типовых проектах.
- **Категории приведены к upstream-пресетам** ([PR #25840](https://github.com/oxc-project/oxc/pull/25840)): правила, выключенные upstream, больше не висят в default `correctness`; `incompatible-library` остаётся в `correctness`, потому что выключен только в `recommended-latest`-пресете экспериментальной версии `babel-plugin-react-compiler`. В таблице выше — итоговая раскладка.
- **Разрешение неактивных правил** ([PR #25830](https://github.com/oxc-project/oxc/pull/25830)) — «неактивные» категории компилятора корректно резолвятся, а не падают как off-by-default.
- **Exhaustive effect dependencies** ([PR #25829](https://github.com/oxc-project/oxc/pull/25829)) — диагностики неполных/лишних зависимостей в `useEffect`-подобных хуках теперь репортятся в полном списке.
- **Derived state** ([PR #25804](https://github.com/oxc-project/oxc/pull/25804)) — улучшена диагностика производного состояния.
- **Стандартизация и spans** ([PR #25840](https://github.com/oxc-project/oxc/pull/25840), [PR #25742](https://github.com/oxc-project/oxc/pull/25742), [PR #25731](https://github.com/oxc-project/oxc/pull/25731), [PR #25702](https://github.com/oxc-project/oxc/pull/25702)) — единый формат сообщений, компактные spans и связанные source-локации.

Пример формата диагностики (из официального поста), который теперь генерирует категорийное правило:

```text
⚠ react(immutability): This value cannot be modified
 ╭─[immutability.tsx:7:11]
6 │           const [state, setState] = useState({a: 0});
7 │           state.a = 1;
  ·           ──┬──
  ·             ╰── value cannot be modified
8 │           return <div>{props.foo}</div>;
  ╰────
help: Modifying a value returned from 'useState()', which should not be modified directly. Use the setter function to update instead
note: React Compiler skipped optimizing this component or hook. Additional guidance: https://react.dev/reference/eslint-plugin-react-hooks/lints/immutability
```

### `typescript/no-empty-object-type`: suggestion

Правило получило **suggestion**-фикс ([PR #25833](https://github.com/oxc-project/oxc/pull/25833), issue #2180). Тесты портированы из upstream `typescript-eslint`. Empty object type `{}` заменяется на более честный тип — но именно как **suggestion**, а не autofix:

```ts
// неправильно
let x: {};

// оксильная замена (suggestion)
let x: unknown;
```

Для `interface {}` / `type X = {}` suggestion ведёт себя как в `@typescript-eslint/no-empty-object-type`: предлагаются варианты `Record<string, never>`, `unknown` или `never` в зависимости от контекста объявления. Это не `--fix`, а inline-предложение (suggestion), которое применяется вручную.

### Прочие правки правил

- `unicorn/no-array-callback-reference`: игнорирует импорты из effect-библиотек ([PR #25857](https://github.com/oxc-project/oxc/pull/25857)).
- `eslint/no-useless-constructor`: разрешает constructor с parameter properties ([PR #25811](https://github.com/oxc-project/oxc/pull/25811)).
- `eslint/no-return-assign`: диагностика якорится на `return`-statement ([PR #25803](https://github.com/oxc-project/oxc/pull/25803)).
- `jest/prefer-mock-return-shorthand`: сохраняет реализации, использующие `this` ([PR #25802](https://github.com/oxc-project/oxc/pull/25802)).
- `eslint/no-redeclare`: работает в ES-модулях, пропуская только проверку глобалов ([PR #25691](https://github.com/oxc-project/oxc/pull/25691)).
- `unicorn/prefer-default-parameters` и `typescript/no-unnecessary-type-conversion`: fixer теперь помечен как **suggestion** ([PR #25801](https://github.com/oxc-project/oxc/pull/25801), [PR #25787](https://github.com/oxc-project/oxc/pull/25787)) — то есть применяется только через suggest, а не `--fix`.
- `typescript/no-useless-empty-export`: пропускает `.d.ts`-файлы и репортит empty export только после импортов ([PR #25789](https://github.com/oxc-project/oxc/pull/25789), [PR #25786](https://github.com/oxc-project/oxc/pull/25786)).
- `eslint/no-irregular-whitespace`: проверяет комментарии по умолчанию ([PR #25660](https://github.com/oxc-project/oxc/pull/25660)).
- `eslint/no-unused-vars`: репортит «голые» параметры с `_` (например `function f(_)`), если это не `_`-refused-соглашение ([PR #25663](https://github.com/oxc-project/oxc/pull/25663)).
- `typescript/no-var-requires`: теперь запускается и на JavaScript ([PR #25664](https://github.com/oxc-project/oxc/pull/25664)).
- `react/display-name`: репортит inner-компонент curried HOC ([PR #25662](https://github.com/oxc-project/oxc/pull/25662)).
- `react/rules-of-hooks`: ловит hooks внутри `try`-блоков ([PR #25670](https://github.com/oxc-project/oxc/pull/25670)).
- `react/exhaustive-deps`: обрабатывает деструктуризованные object-зависимости и трактует binary-выражения как стабильную зависимость ([PR #25669](https://github.com/oxc-project/oxc/pull/25669), [PR #25508](https://github.com/oxc-project/oxc/pull/25508)).
- `react/no-this-in-sfc`: определяет `this` во вложенных arrow-callback ([PR #25653](https://github.com/oxc-project/oxc/pull/25653)).
- `react/no-direct-mutation-state`: ловит computed-мутации состояния ([PR #25654](https://github.com/oxc-project/oxc/pull/25654)).
- `eslint/no-eval`: indirect-case приведён к поведению ESLint ([PR #25656](https://github.com/oxc-project/oxc/pull/25656)).
- `typescript/no-non-null-asserted-optional-chain`: определяет assertion после продолженных optional chains ([PR #25659](https://github.com/oxc-project/oxc/pull/25659)).
- `eslint/no-multi-assign`: обрабатывает parenthesized initializer (например `(a) = b = c`) ([PR #25651](https://github.com/oxc-project/oxc/pull/25651)).
- `eslint/max-classes-per-file`: диагностика якорится в начале программы ([PR #25652](https://github.com/oxc-project/oxc/pull/25652)).
- `jest/expect-expect`: ловит assertions во вложенных function declarations ([PR #25650](https://github.com/oxc-project/oxc/pull/25650)).
- Config: **спред в опциях правила** — `linter` теперь позволяет spread rule options в config types ([PR #25675](https://github.com/oxc-project/oxc/pull/25675)).
- `import/no-named-default`, `import/no-named-as-default`: репорты type-only named defaults и локальных export-конфликтов ([PR #25661](https://github.com/oxc-project/oxc/pull/25661), [PR #25658](https://github.com/oxc-project/oxc/pull/25658)).
- `eslint/preserve-caught-error`: обрабатывает `AggregateError` options ([PR #25775](https://github.com/oxc-project/oxc/pull/25775)).
- `eslint/prefer-promise-reject-errors`: репортит на spread-аргументах ([PR #25648](https://github.com/oxc-project/oxc/pull/25648)).
- `unicorn/prefer-string-replace-all`: применяет фиксы за один проход ([PR #25709](https://github.com/oxc-project/oxc/pull/25709)).
- `no-large-snapshots`: прекомпилирует и документирует разрешённые snapshot-матчеры ([PR #25611](https://github.com/oxc-project/oxc/pull/25611)).
- `promise/no-multiple-resolved`: игнорирует неразрешённые глобалы ([PR #25530](https://github.com/oxc-project/oxc/pull/25530)).
- `unicorn/no-abusive-eslint-disable`: в диагностике используется «directive prefix» ([PR #25657](https://github.com/oxc-project/oxc/pull/25657)).
- `expect-expect`: валидирует assertion-регэксп ([PR #25504](https://github.com/oxc-project/oxc/pull/25504)).

### Performance и ранние анализаторы

- `estree`: `FormalParameterRest` теперь эмитит `decorators` ([PR #25582](https://github.com/oxc-project/oxc/pull/25582)).
- `semantic`: классификация global references по идентификатору ([PR #25608](https://github.com/oxc-project/oxc/pull/25608)).
- `react_compiler`: вместо паники «Expected a node for all scopes» — bail out ([PR #25506](https://github.com/oxc-project/oxc/pull/25506)).
- Серия правок linter: `sort_by_cached_key`, unstable sorts для unique keys, общий entry point для config-deserialization, `table` для имён правил, батчинг graphical-отчётов и preallocate graphical output ([PR #25821](https://github.com/oxc-project/oxc/pull/25821), [PR #25778](https://github.com/oxc-project/oxc/pull/25778), [PR #25820](https://github.com/oxc-project/oxc/pull/25820), [PR #25458](https://github.com/oxc-project/oxc/pull/25458), [PR #25710](https://github.com/oxc-project/oxc/pull/25710), [PR #25721](https://github.com/oxc-project/oxc/pull/25721)). Для CLI — прозрачно, для embedders — меньше аллокаций.

## Oxfmt 0.64.0

### `experimentalOperatorPosition` / `operatorPosition`

Форматтер получил два связанных коммита: базовую имплементацию опции `operatorPosition` ([PR #25581](https://github.com/oxc-project/oxc/pull/25581)) и её экспозицию в Oxfmt/конфиг как `experimentalOperatorPosition` ([PR #25643](https://github.com/oxc-project/oxc/pull/25643), issue #16366).

Пока поведение совпадает с Prettier:

- default — `"end"`;
- option работает на **пересечениях типов** (`&`), на union-типы (`|`) не влияет;
- в конфиге/overrides имя требует `experimental`-префикс, values: `"start"` | `"end"` (default).

```jsonc
// .oxfmtrc.json
{
  "experimentalOperatorPosition": "start",
}
```

```ts
// тип с длинным пересечением
type T = AAAAA & BBBBB & CCCCCCCCCCCCCCCCCCCCCCCC & DDDDDDDDDDDDDDDD;
```

```ts
// experimentalOperatorPosition: "end" (default, как Prettier)
type T = AAAAA & BBBBB & CCCCCCCCCCCCCCCCCCCCCCCC & DDDDDDDDDDDDDDDD;

// experimentalOperatorPosition: "start"
type T = AAAAA & BBBBB & CCCCCCCCCCCCCCCCCCCCCCCC & DDDDDDDDDDDDDDDD;
```

Опция доступна и на [playground](https://playground.oxc.rs). Отдельный PR ссылается на issue #16367 как на будущий трекер, где поведение может отойти от Prettier.

### Прочие правки форматтера

- Комментарии и отступы вокруг union-типов не сбиваются ([PR #25665](https://github.com/oxc-project/oxc/pull/25665)).
- Комментарии сохраняются при удалении пустых `EmptyStatement` ([PR #25730](https://github.com/oxc-project/oxc/pull/25730)).
- Печать `JSDocUnknownType` ([PR #25729](https://github.com/oxc-project/oxc/pull/25729)).
- Вложенные awaited-paren member chains не разрываются в аргументах вызова ([PR #25646](https://github.com/oxc-project/oxc/pull/25646)).
- `oxlint,oxfmt`: `.gitignore` применяется **только к walk-таргетам**, а не к явно названным файлам ([PR #25531](https://github.com/oxc-project/oxc/pull/25531)) — файл, переданный явно, форматируется даже если лежит в `node_modules`/ignored.
- `formatter_css`: собственные блочные комментарии внутри space-separated values, trailing comma и indent после comment-preceded последнего map-value, multi value function args после ведущего комментария ([PR #25578](https://github.com/oxc-project/oxc/pull/25578), [PR #25577](https://github.com/oxc-project/oxc/pull/25577), [PR #25518](https://github.com/oxc-project/oxc/pull/25518)).
- `formatter_yaml`: согласованное `eos`-поведение у chomped scalar и bump `oxc-yaml-parser` для contentless block scalar ([PR #25523](https://github.com/oxc-project/oxc/pull/25523), [PR #25519](https://github.com/oxc-project/oxc/pull/25519)).
- Unary comment сохраняется, печатаются только нужные скобки ([PR #25526](https://github.com/oxc-project/oxc/pull/25526)).
- `oxfmt`: mirror printer line suppression и восстановление dedent-to-root ([PR #25573](https://github.com/oxc-project/oxc/pull/25573)).

## Обновление

```bash
pnpm add -D oxlint@1.79.0 oxfmt@0.64.0
```

После обновления имеет смысл:

1. убрать `react/react-compiler` из конфига (правило удалено) и включить React Compiler через `plugins: ["react"]` + категорию `correctness`;
2. если нужны `react/hooks`, `react/memo-dependencies` и т.п. — включить их из `suspicious` явно (они off по умолчанию);
3. при выборочном форматировании обратить внимание, что `.gitignore` больше не блокирует явно названные файлы;
4. оценить `experimentalOperatorPosition: "start"`/`"end"` на проектах с длинными пересечениями типов.

Полный список изменений: [GitHub Release `apps_v1.79.0`](https://github.com/oxc-project/oxc/releases/tag/apps_v1.79.0), официальный пост [React Compiler Support](https://oxc.rs/blog/2026-08-18-react-compiler-support).

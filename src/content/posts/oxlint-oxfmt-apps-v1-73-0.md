---
author: Артём Нецветаев
pubDatetime: 2026-07-13T12:04:15.000Z
title: "Oxlint 1.73.0 и Oxfmt 0.58.0: новые правила, точнее CFG-анализ и обновлённый formatter core"
slug: oxlint-oxfmt-apps-v1-73-0
featured: false
draft: false
tags:
  - release
  - oxlint
  - oxfmt
  - javascript
  - typescript
  - tooling
description: "Разбор объединённого релиза Oxlint 1.73.0 и Oxfmt 0.58.0: три новых правила, новые опции существующих проверок, per-rule timing для type-aware linting и изменения форматирования JavaScript, CSS, SCSS и GraphQL."
---

Вышел объединённый релиз инструментов Oxc: [Oxlint 1.73.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.73.0) и [Oxfmt 0.58.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.73.0). Oxlint получил три новых правила, дополнительные параметры для уже знакомых проверок и более точный анализ control-flow. Oxfmt обновил CSS/SCSS/GraphQL-парсеры, расширил внутреннее представление документа и синхронизировал несколько случаев вывода с Prettier 3.9.1.

Источники для обзора — [GitHub Release `apps_v1.73.0`](https://github.com/oxc-project/oxc/releases/tag/apps_v1.73.0), [compare с предыдущим состоянием](https://github.com/oxc-project/oxc/compare/apps_v1.72.0...apps_v1.73.0), а также PR и коммиты, перечисленные ниже. Это minor-релиз формата `x.y.0`, поэтому статья публикуется с `featured: false`.

## Oxlint 1.73.0

### Три новых правила

#### `unicorn/explicit-timer-delay`

Правило проверяет вызовы `setTimeout()` и `setInterval()` — включая `window.setTimeout()` и `globalThis.setInterval()` — и предлагает выбрать один из двух режимов:

- `always` (по умолчанию): аргумент `delay` должен быть указан явно;
- `never`: явный нулевой delay запрещён, поэтому для задержки `0` используется значение по умолчанию.

```js
// unicorn/explicit-timer-delay: "error"
setTimeout(run); // ошибка: delay не указан
setInterval(poll, 0); // корректно в режиме always

// unicorn/explicit-timer-delay: ["error", "never"]
setTimeout(run, 0); // ошибка: лишний явный 0
setTimeout(run); // корректно
setTimeout(run, 1000); // корректно в обоих режимах
```

Реализация правила и его конфигурация добавлены в [PR #23612](https://github.com/oxc-project/oxc/pull/23612), коммит [`a2c97f3`](https://github.com/oxc-project/oxc/commit/a2c97f348c8bdabe99a08b2fbb45d32ffe49a529).

#### `unicorn/no-confusing-array-with`

`Array.prototype.with()` возвращает копию массива с заменённым элементом, но у него есть два легко пропускаемых случая. Новое правило сообщает о статическом отрицательном индексе и о передаче `.length` того же массива:

```js
array.with(-1, value); // ошибка: -1 — смещение от конца
array.with(array.length, value); // ошибка: это индекс за последним элементом

array.with(array.length - 1, value); // корректно: последний элемент
array.with(index, value); // корректно: индекс вычисляется динамически
```

Проверка сопоставляет объект вызова и объект в `array.length`, поэтому `items.with(otherItems.length, value)` не считается ошибкой. Computed-вызовы вроде `array["with"](...)` и optional chaining также не репортятся. Подробная семантика и тесты находятся в [PR #23638](https://github.com/oxc-project/oxc/pull/23638), коммит [`85735cb`](https://github.com/oxc-project/oxc/commit/85735cb5df27daffd32651f808a382680ee92aaf).

#### `eslint/no-unreachable-loop`

Oxlint теперь нативно поддерживает ESLint-правило, которое находит циклы, тело которых не может перейти ко второй итерации: например, цикл с безусловным `break`, `return` или `throw` на всех путях.

```js
while (ready) {
  doWork();
  break; // тело никогда не продолжает цикл
}
```

Правило учитывает `while`, `do...while`, `for`, `for...in` и `for...of`. Как и в ESLint, отдельные типы циклов можно исключить через `ignore`:

```json
{
  "rules": {
    "eslint/no-unreachable-loop": ["error", { "ignore": ["ForOfStatement"] }]
  }
}
```

Для анализа используется CFG-поиск следующего прохода, а также общий helper `effective_unreachable_blocks`, вынесенный из `eslint/no-unreachable`. Это важно для случаев с бесконечными циклами и недостижимыми блоками: [PR #23975](https://github.com/oxc-project/oxc/pull/23975) специально ограничивает дорогой полный обход CFG редкими сценариями, чтобы не замедлять обычную проверку.

### Новые параметры существующих правил

- `unicorn/filename-case` получил случаи `lowercase` и `screamingSnakeCase`. Первый означает плоское имя без разделителей (`somefilename.js`), второй — формат вроде `SOME_FILE_NAME.js`. Они выбираются через `case` или `cases`; цифры в `screamingSnakeCase` также корректно остаются прикреплёнными к имени. См. [PR #24045](https://github.com/oxc-project/oxc/pull/24045).
- `unicorn/no-array-sort` получил `allowAfterSpread`, по умолчанию `false`. При `true` разрешается сортировать свежую копию, созданную spread-оператором, например `[...mySet].sort()`. Это позволяет не делать вторую аллокацию через `toSorted()` при сортировке `Set` или другого iterable; обычный `array.sort()` по-прежнему репортится.

```json
{
  "rules": {
    "unicorn/no-array-sort": ["error", { "allowAfterSpread": true }]
  }
}
```

Параметр добавлен в [PR #24043](https://github.com/oxc-project/oxc/pull/24043).

- `react/forbid-dom-props` получил `disallowedValues`. Теперь можно запретить prop не всегда, а только с определёнными строковыми значениями; поддерживаются обычные JSX-строки, строковые expression-контейнеры и template literal без интерполяции.

```json
{
  "rules": {
    "react/forbid-dom-props": [
      "error",
      {
        "forbid": [{ "propName": "type", "disallowedValues": ["button"] }]
      }
    ]
  }
}
```

В [PR #23970](https://github.com/oxc-project/oxc/pull/23970) также сохранена совместимость с существующими `disallowedFor` и пользовательским `message`.

### Type-aware linting и исправления анализа

Для type-aware linting добавлен сбор времени выполнения отдельных правил: изменения в [PR #22488](https://github.com/oxc-project/oxc/pull/22488) протягивают timing state через lint runner и добавляют payload с timing records в tsgolint. Это не новая пользовательская директива конфигурации, а данные для интеграций и диагностики производительности.

В исправлениях анализатора особенно важны следующие изменения:

- `import/no-duplicates` больше не считает ошибкой type-only import рядом с side-effect import;
- `eslint/no-restricted-imports` теперь проверяет и динамические `import()`;
- `react/rules-of-hooks` учитывает escape-вызовы `useEffectEvent`;
- `import/extensions` уважает `never` для явно написанных расширений;
- циклические `export *` больше не приводят к повторному входу в `OnceLock`, а неразрешимый namespace re-export при destructuring не вызывает panic;
- конфигурации Oxlint с не-объектным корнем отклоняются явно, а циклический `extends` в конфиге обнаруживается вместо рекурсивного обхода;
- AST-тип `typeAnnotation` у binding node теперь явно допускает `TSTypeAnnotation | null`.

Отдельно исправлено разрешение глобальных ссылок в правилах `no-eval`, `no-deprecated-functions` и распознавании `@effect/vitest`: локально затенённые идентификаторы больше не принимаются за встроенные API. Для `unicorn/filename-case` и `unicorn/prefer-at` также устранены ложные срабатывания на цифрах, numeric-key access и некоторых формах destructuring.

## Oxfmt 0.58.0

### Внутреннее представление стало пригоднее для embedded-языков

В formatter core появились примитивы literal line и root indentation ([PR #24051](https://github.com/oxc-project/oxc/pull/24051)), а также `no-expand-parent` для многострочного текста ([PR #24050](https://github.com/oxc-project/oxc/pull/24050)). Это не новые флаги `.oxfmtrc`: изменения расширяют IR, из которого строится документ. Они убирают обходные решения в embedded-сценариях вроде Markdown-in-JS и JS-in-Vue и закладывают нужные операции для будущей поддержки YAML и Markdown.

Производительность printer queue также улучшена: очередь стала cursor-based, dispatch `fits` заинлайнен, а slice-backed accessor возвращает `impl ExactSizeIterator`. Для LSP-процесса Oxfmt теперь повторно использует процесс tinypool в рамках одной LSP-сессии ([PR #24197](https://github.com/oxc-project/oxc/pull/24197)), вместо повторного создания worker-процесса для каждого запроса.

### CSS, SCSS и GraphQL

Релиз обновил `oxc-css-parser` до 0.0.5 и `oxc-graphql-parser` до 0.0.5. Заодно вывод CSS и SCSS синхронизирован с Prettier 3.9.1: исправлены правила переноса `@forward`, содержимое Sass config list и selector lists в css-in-js, а `implements` в GraphQL теперь разбивается по `print-width`.

Среди конкретных исправлений JavaScript-форматтера:

- убираются лишние `;` у type members при `no-semi`;
- пробел после `ForStatement` печатается только при наличии `update`;
- перед JSDoc type-cast в режиме `no-semi` добавляются нужные скобки;
- `await`/`yield` с `<T>` получают скобки там, где они нужны для однозначного вывода;
- JSON сохраняет ключ и literal value в сценарии `JSON.stringify`;
- команда `oxfmt --migrate prettier` обновлена: добавлена миграция Svelte, улучшено обнаружение `overrides`, а предупреждение об уже поддерживаемом `embeddedLanguageFormatting` убрано.

## Обновление

Установите новые версии отдельно или обновите обе зависимости:

```bash
pnpm add -D oxlint@1.73.0 oxfmt@0.58.0
```

После обновления Oxlint стоит проверить конфигурацию, если вы хотите включить новые правила: они не добавляются в существующие presets автоматически только из-за установки пакета. Для `no-array-sort`, `filename-case` и `forbid-dom-props` параметры имеют обратную совместимость с прежней конфигурацией, а `eslint/no-unreachable-loop` можно включать постепенно, используя `ignore` для специфичных типов циклов.

Полный список исправлений и коммитов доступен в [GitHub Release `apps_v1.73.0`](https://github.com/oxc-project/oxc/releases/tag/apps_v1.73.0).

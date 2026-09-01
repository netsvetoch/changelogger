---
author: Артём Нецветаев
pubDatetime: 2026-09-01T16:43:36.000Z
title: "Oxlint 1.81.0 и Oxfmt 0.66.0: suggestion в nextjs/no-typos, новый подход к мутации AST для JS-плагинов и форматирование CSS-правил в Oxfmt"
slug: oxlint-oxfmt-apps-v1-81-0
featured: false
draft: false
tags:
  - release
  - oxlint
  - oxfmt
  - javascript
  - typescript
  - tooling
description: "Разбор объединённого релиза Oxlint 1.81.0 и Oxfmt 0.66.0: suggestion в nextjs/no-typos, отказ от pointer-laundering при передаче AST в JS-плагины и трёхпроходное линтингование многосекционных файлов, консервативные фиксы (suggestion вместо autofix), форматирование CSS raw-prelude блоков и серия правок Oxfmt по комментариям и suppressed-выводу."
---

Вышел объединённый релиз инструментов Oxc: [Oxlint 1.81.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.81.0) и [Oxfmt 0.66.0](https://github.com/oxc-project/oxc/releases/tag/apps_v1.81.0). Это minor-релиз формата `apps_v1.81.0`, поэтому пост общий для обоих пакетов и публикуется с `featured: false`. В Oxlint главное — разворот внутреннего механизма JS-плагинов (стабильное получение `&mut Program` вместо «отмывки» указателя и трёхпроходное линтингование многосекционных файлов), а также волна консервативных правок: ряд autofix превращён в suggestion, чтобы не менять поведение кода. В Oxfmt — новая поддержка CSS-правил с raw-prelude и большая группа фиксов suppressed-вывода и позиционирования комментариев. Источники: [GitHub Release](https://github.com/oxc-project/oxc/releases/tag/apps_v1.81.0), [compare с `apps_v1.80.0`](https://github.com/oxc-project/oxc/compare/apps_v1.80.0...apps_v1.81.0) и связанные PR.

## Oxlint 1.81.0

### 🚀 `nextjs/no-typos`: suggestion

Правило переведено из статуса `pending` в `suggestion` ([PR #26091](https://github.com/oxc-project/oxc/pull/26091), issue #1929). Как только имя функции совпадает с одной из функций получения данных Next.js с пороговым сходством по `best_match`, теперь вместо просто диагностики выдаётся замена спана через `ctx.diagnostic_with_suggestion` / `fixer.replace(span, suggestion)`. Диагностика превратилась в suggestion (примеры из тестов правила):

```ts
export const getStaticpaths = async () => {}; // → getStaticPaths
export const getStaticProp = () => {}; // → getStaticProps
export const getServurSideProps = () => {}; // → getServerSideProps
```

Функции проверяются в файлах `pages/*` (например `pages/test.tsx`), как и раньше.

### JS-плагины: стабильный `&mut Program` и новый порядок проходов

Две связанные правки внутреннего устройства JS-плагинов — самая техническая часть релиза.

**Получение мутируемого AST.** [PR #26077](https://github.com/oxc-project/oxc/pull/26077): JS-плагинам нужна изменяемая копия AST (`&mut Program`), чтобы обновлять спаны до UTF-16-смещений, но `Semantic` хранит только иммутабельную ссылку `&Program`, а `AstNodes` — иммутабельные ссылки на _все_ узлы. Старый способ был хаком: отбрасывалась вся `Semantic`, а указатель на `Program` «отмывался» до права на запись через `NonNull::with_addr`, взяв provenance курсора `Allocator`. Это требовало, чтобы `Program` лежал в текущем чанке аллокатора. Пока React Compiler rules не были включены по умолчанию, это работало; после включения эти правила сильно аллоцируют, аллокатор отращивает новый чанк, и debug-ассерты «Program в текущем чанке» начали падать. Новый способ — битовая копия исходного `Program` (bitwise copy) с возвратом копии в арену, что даёт `&mut Program` и не зависит от текущего чанка. Как отмечено в комментариях, это по-прежнему не sound (нельзя доказать, что других ссылок на узлы нет), но меняет доказанный UB на потенциальный риск, который сейчас не срабатывает, и работает «хирургичнее» — удаляет только нужные ссылки на узлы и комментарии, оставляя остальную `Semantic` нетронутой.

**Порядок проходов и Vue/Astro/Svelte.** [PR #26080](https://github.com/oxc-project/oxc/pull/26080) исправляет связанный баг. JS-плагины обязаны выполняться последними (они мутируют и уничтожают сохранённый AST). Для многосекционных файлов (Vue, Astro, Svelte) раньше правила гонялись посекционно — «секция 1: native, затем JS; секция 2: native, затем JS». Проблема: некоторые native-правила (например `vue/valid-define-emits`) обращаются и к _более ранним_ секциям, а к тому моменту JS-плагины уже прошлись по ним и выбросили их AST → некорректные результаты. Теперь выполняется три отдельных прохода, каждый по всем секциям:

1. native-правила;
2. JS-правила;
3. unused-directives.

То есть раньше: `секция1 native → секция1 JS → секция2 native → секция2 JS`, а стало: `секция1 native → секция2 native → секция1 JS → секция2 JS`. Проверка unused directives вынесена в отдельный финальный проход, потому что ей нужны результаты и native, и JS-правил. Видимый побочный эффект — меняется порядок вывода диагностик для многосекционных файлов (сначала native, затем JS), авторы считают это некритичным.

### Консервативные фиксы: suggestion вместо autofix и сохранение семантики

Несколько правок переводят опасные автоматические исправления в рекомендации:

- **`unicorn/prefer-math-min-max`: убран небезопасный autofix** ([PR #26060](https://github.com/oxc-project/oxc/pull/26060)) — замена `Math` на `Math.min`/`Math.max` классифицирована как suggestion, а не автофикс; диагностика и рекомендуемая замена сохраняются, но не применяются автоматически, чтобы не менять поведение на основе анализа значений.
- **`import/no-empty-named-blocks`: удаление пустого value-импорта стало suggestion** ([PR #26155](https://github.com/oxc-project/oxc/pull/26155)) — потому что удаление такого импорта может потерять side-эффекты вычисления модуля. Удаление пустого **type-only** импорта осталось автофиксом.
- **`eslint/object-shorthand`: сохранение семантики `__proto__`** ([PR #26154](https://github.com/oxc-project/oxc/pull/26154)) — не-вычисляемые свойства `__proto__` исключены из конвертаций в shorthand/longform, чтобы не менять появление прототипа объекта; вычисляемые `["__proto__"]` считаются безопасно фиксируемыми. Добавлены регрессии для методов, стрелочных функций, property shorthand, кавычек и режима `never`.

  ```js
  // `__proto__` как не-вычисляемое свойство больше не трогается
  const obj = { __proto__: proto }; // не преобразуется в shorthand/longform
  const ok = { ["__proto__"]: value }; // вычисляемое — по-прежнему корректно фиксируется
  ```

- **`unicorn/prefer-set-size`: игнор затенённых конструкторов `Set`** ([PR #26153](https://github.com/oxc-project/oxc/pull/26153)) — перед репортом/фиксом проверяется, что конструктор `new Set` разрешается во встроенный глобал; прямое создание и const-bound `Set` по-прежнему детектируются, добавлен регресс для локально затенённого конструктора, возвращающего массив.

### Правила ESLint/React на JS и JSX

- **`eslint/no-use-before-define`: заработало на JS/JSX** ([PR #26114](https://github.com/oxc-project/oxc/pull/26114), issue #26113) — правило перенесли в ESLint-плагин, но сохранили TypeScript-гейт выполнения, из-за чего оно не запускалось для JavaScript/JSX-файлов. Гейт убран, добавлен JS-регресс-тест для ссылки в temporal dead zone. Теперь правило покрывает `no-use-before-define` и в JS/JSX.
- **`react/no-unstable-nested-components`: проверяются имена объектных пропсов** ([PR #26101](https://github.com/oxc-project/oxc/pull/26101)) — раньше проверка `allowAsProps`/`propNamePattern` искала только ближайший JSX-атрибут (например `columns`), теперь сначала ищется прямое имя объектного свойства. Вложенный компонент в `columns={[{ render: () => <div/> }]}` с конфигом `propNamePattern: "render*"` теперь корректно распознаётся:

  ```js
  function ParentComponent() {
    return (
      <Table
        columns={[
          {
            name: "A",
            render: ({ id }) => <div>{id}</div>,
          },
        ]}
      />
    );
  } // ок при { propNamePattern: "render*" }; раньше не матчилось
  ```

- **`unicorn/no-useless-spread`: типизированные массивы как отдельный value-hint** ([PR #26067](https://github.com/oxc-project/oxc/pull/26067)) — в `const_eval` типизированные массивы (`Uint8Array` и т. п.) помечены как отдельная подсказка значения, чтобы не путать их вывод со спредом обычного массива.
- **`eslint/no-unassigned-vars`: пропуск Svelte и Vue файлов** ([PR #26042](https://github.com/oxc-project/oxc/pull/26042)) — правило больше не репортит в `.svelte`/`.vue`, чтобы не ловить реактивные переменные.

### Прочие правки и локации JS-плагинов

- **Нормализация и ограничение локаций JS-плагинов** ([PR #26138](https://github.com/oxc-project/oxc/pull/26138), [PR #26144](https://github.com/oxc-project/oxc/pull/26144)) — реверсированные локации JS-плагинов нормализуются, а невалидные (вышедшие за пределы файла) «зажимаются», чтобы колонки диагностик не были бессмысленными.
- **`eslint/no-empty-named-blocks` — прочее:** помимо suggestion выше, сохранено прежнее поведение удаления.
- **LSP: `tsgolint` больше не держит процессы** ([PR #25570](https://github.com/oxc-project/oxc/pull/25570)) — предотвращено удержание дочерних процессов инструментом `tsgolint` при работе через lint-сервер.

### 📚 Документация

- **Общий `short_description` для правила jest/vitest** ([PR #26186](https://github.com/oxc-project/oxc/pull/26186)) — `declare_oxc_lint!` теперь принимает путь к общей константе для `short_description` (по аналогии с `docs = SHARED_DOCUMENTATION`), за гейтом фичи `ruledocs`. Общий short description добавлен для `expect-expect`, `no-disabled-tests`, `valid-expect`; правила с различающейся формулировкой сохраняют per-plugin строки.
- **`vue/no-dupe-keys`: short description** ([PR #26183](https://github.com/oxc-project/oxc/pull/26183)), **`typescript/switch-exhaustiveness-check`: уточнение паттерна комментария default-case** ([PR #26100](https://github.com/oxc-project/oxc/pull/26100)) и исправление рассогласования export/import в примере `bar` и `foo` ([PR #25927](https://github.com/oxc-project/oxc/pull/25927)).

## Oxfmt 0.66.0

### 🚀 CSS: форматирование declaration-shaped raw-prelude правил

[PR #26194](https://github.com/oxc-project/oxc/pull/26194), issue #26158. Когда CSS-правило «похоже на объявление» (raw-prelude) и срабатывает fallback из CSS Syntax Level 3 — «восстановить метку из потока токенов, затем потребить qualified rule с `nested: true` и стоп-токеном `<semicolon-token>`» — форматтер теперь форматирует внутренний блок, а прелюдию оставляет дословно (keep prelude verbatim). Это чинит форматирование вложенных блоков конфига, например в postcss.

```css
/* конфигурационный пост-процессинг с raw-prelude правилом */
@custom-selector :--heading h1, h2, h3;

:--heading {
  margin: 0;
}
```

### Suppressed-вывод (`// oxfmt-ignore`)

- **Возвращены suppressed statement-терминаторы по `options.semi`** ([PR #26220](https://github.com/oxc-project/oxc/pull/26220), issue #26217) — с `semi: false` при риске ASI в suppressed-выражении теперь выводится `;`, чтобы не сломать выполнение:

  ```js
  // semi: false
  let a = 1;
  // oxfmt-ignore
  [b].sort();

  // до: … [b].sort();  ← ASI failure
  // после: … ;[b].sort()  ← OK
  ```

- **Печать скобок suppressed typecast** ([PR #26218](https://github.com/oxc-project/oxc/pull/26218)) — скобки вокруг типизированного выражения с комментарием больше не теряются при `// oxfmt-ignore`:

  ```js
  foo(
    // oxfmt-ignore
    /** @type {A} */ (x), // раньше скобки: ... */ x
    /** @type {B} */ (y)
  );
  ```

- **Cast comment lookup не пропускается** ([PR #26216](https://github.com/oxc-project/oxc/pull/26216), issue #26202) — при наличии suppressed typecast комментарий печатался в последующей проверке typecast через механизм каста, но из-за пропуска `cast comment lookup` не находил собственный comment (`const cast = /** c */ (x)`), что ломало позиционирование комментария перед ним.

### sort-imports: пользовательские side-effect группы

[PR #26217](https://github.com/oxc-project/oxc/pull/26217), issue #26165: `side_effect` — предопределённый селектор и не может использоваться как имя пользовательской группы; при этом группа, использующая `side_effect` для обозначения side-effect-импортов, теперь уважается, а баг в определении метаданных исправлен. То есть конфигурация вроде `{ "customGroups": { "value": ["./styles/**"], "sideEffect": ["./side-effects/**"] } }` работает корректно.

### Комментарии между head и body

Серия правок, доводящих позиционирование комментариев вокруг головы и тела конструкций (кластер PR #26074/#26073/#26071/#26058/#26043/#26041, плюс #26213):

- **`head body policy` теперь применяется везде** ([PR #26074](https://github.com/oxc-project/oxc/pull/26074)) — покрыты дополнительные случаи вроде `label`/`case`.
- **Комментарии внутри `for (init; test; update)`** ([PR #26073](https://github.com/oxc-project/oxc/pull/26073)) — остаются в своём слоте головы `for`, а также перед пустым телом и `do-while`.
- **Комментарии между head и body не загоняются в фигурные скобки** ([PR #26071](https://github.com/oxc-project/oxc/pull/26071)) — во всех конструкциях комментарий между головой и телом печатается вне `{}`.
- **Комментарий между head и открывающей скобкой** ([PR #26058](https://github.com/oxc-project/oxc/pull/26058)) и **между head оператора и телом** ([PR #26043](https://github.com/oxc-project/oxc/pull/26043)) — размещаются предсказуемо.
- **Идемпотентность при комментарии и удалённых скобках** ([PR #26041](https://github.com/oxc-project/oxc/pull/26041)) — исправлено неидемпотентное форматирование комментария внутри «dropped parens».
- **Сохранение комментария для statement-терминаторов и бинарных кастов** ([PR #26213](https://github.com/oxc-project/oxc/pull/26213)).
- **`jsdoc`: следование CommonMark для прерывающих списков** ([PR #26098](https://github.com/oxc-project/oxc/pull/26098)) — форматтер JSDoc следует CommonMark при прерывании списков и защищает обёртку от создания новых.

### YAML и документация

- **`formatter_yaml`: сохранение завершающих пробелов в block scalars** ([PR #26072](https://github.com/oxc-project/oxc/pull/26072)) — пробелы внутри значения block scalar — это контент, их нужно сохранять.
- **Документация:** `DIVERGENCES.md` вынесен из `AGENTS.md` ([PR #26121](https://github.com/oxc-project/oxc/pull/26121)), задокументирована policy перемещения комментариев ([PR #26075](https://github.com/oxc-project/oxc/pull/26075)), уточнена инфраструктура тестов идемпотентности ([PR #26069](https://github.com/oxc-project/oxc/pull/26069)), а own-line comment inlining помечен как известное нарушение policy ([PR #26131](https://github.com/oxc-project/oxc/pull/26131)).

### ⚡ Производительность

- **Фиксированные ANSI-стили в диагностиках** ([PR #26130](https://github.com/oxc-project/oxc/pull/26130)) — стили ANSI для вывода диагностик жёстко заданы (фиксированы), а не пересчитываются.

## Обновление

```bash
pnpm add -D oxlint@1.81.0 oxfmt@0.66.0
```

Изменений в конфиге не требуется: это minor-релиз без breaking changes. Стоит обратить внимание на смену характера ряда исправлений: `prefer-math-min-max` и `import/no-empty-named-blocks` больше не применяются автоматически — их замены теперь suggestion, и их нужно принимать вручную (или в IDE), чтобы не потерять side-эффекты и не изменить поведение. `eslint/no-use-before-define` теперь срабатывает и на JavaScript/JSX-файлах, что может добавить новых диагностик на таких проектах.

Полный список изменений: [GitHub Release `apps_v1.81.0`](https://github.com/oxc-project/oxc/releases/tag/apps_v1.81.0).

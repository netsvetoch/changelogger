---
author: Артём Нецветаев
pubDatetime: 2026-06-28T16:00:48.000Z
title: "Stylelint 17.14.0: исправлен calc после умножения и деления"
slug: stylelint-17-14-0
featured: false
draft: false
tags:
  - release
  - stylelint
  - css
  - linting
description: "Обзор минорного релиза Stylelint 17.14.0: правило function-calc-no-unspaced-operator снова видит + и - после * или /, а запуск stylelint стал быстрее за счёт кеша путей модулей и ленивого TIMING."
---

Stylelint выпустил минорный релиз [`17.14.0`](https://github.com/stylelint/stylelint/releases/tag/17.14.0). В релиз вошли три пользовательских исправления: одно закрывает false negative в правиле `function-calc-no-unspaced-operator`, два уменьшают накладные расходы при запуске и загрузке модулей.

Источники для обзора — GitHub Release [`stylelint/stylelint@17.14.0`](https://github.com/stylelint/stylelint/releases/tag/17.14.0), compare [`17.13.0...17.14.0`](https://github.com/stylelint/stylelint/compare/17.13.0...17.14.0) и diff связанных PR [#9354](https://github.com/stylelint/stylelint/pull/9354), [#9356](https://github.com/stylelint/stylelint/pull/9356), [#9357](https://github.com/stylelint/stylelint/pull/9357). Релиз минорный, поэтому `featured: false`.

## `function-calc-no-unspaced-operator`: теперь проверяются `+` и `-` после `*` или `/`

Главное исправление для пользователей правил — [#9357](https://github.com/stylelint/stylelint/pull/9357). Правило `function-calc-no-unspaced-operator` должно требовать пробелы вокруг `+` и `-` внутри CSS math-функций, потому что для этих операторов пробелы значимы. До `17.14.0` оно пропускало часть ошибок, если перед `+` или `-` в том же выражении уже встретился оператор умножения или деления.

Проблемные примеры из PR:

```css
a {
  width: calc(1px * 2px+3px);
}
a {
  width: calc(1px / 2+3px);
}
a {
  width: calc(1px + 2px * 3px+4px);
}
```

В этих строках `*` и `/` сами по себе не обязаны иметь пробелы, но последующие `+` и `-` обязаны. Старый parser error recovery останавливал анализ слишком поздно: когда разбор операции не складывался, он потреблял всё до запятой, точки с запятой или конца выражения. Из-за этого хвост вроде `2px+3px` уже не проверялся.

В `17.14.0` в `lib/rules/function-calc-no-unspaced-operator/index.mjs` добавлен набор `MULTIPLICATIVE_OPERATORS = new Set(['*', '/'])`, а error recovery теперь считает `*` и `/` границей, на которой можно остановиться и продолжить сканирование дальше. Практический результат: Stylelint оставляет умножение и деление как есть, но репортит и автоисправляет последующий `+` или `-`.

```css
/* было пропущено */
a {
  top: calc(1px * 2px+3px);
}

/* stylelint --fix в 17.14.0 */
a {
  top: calc(1px * 2px + 3px);
}

/* было пропущено */
a {
  top: calc(1px / 2-3px);
}

/* stylelint --fix в 17.14.0 */
a {
  top: calc(1px / 2 - 3px);
}
```

Новые тесты также фиксируют, что цепочки только с умножением или только с делением остаются валидными: `calc(1px*2*3)` и `calc(8px/2/2)` не должны получать предупреждения.

## Быстрее резолвятся `extends` и `plugins`

[#9354](https://github.com/stylelint/stylelint/pull/9354) ускоряет получение путей к модулям, которые Stylelint резолвит для конфигураций, `extends` и `plugins`. Автор PR указывает, что большинство таких lookup'ов проходят через `import-meta-resolve` в `resolveSilent.mjs`, а это заметно дороже быстрых путей с абсолютными module path.

В коде появился новый utility `lib/utils/MemoryCache.mjs`: ограниченный in-memory cache с `maxSize = 1000` и TTL `30 * 60 * 1000` мс. Раньше похожая логика жила только внутри `cachedImport.mjs`; теперь её вынесли в общий класс и переиспользовали для путей модулей.

Конкретное изменение в `lib/utils/getModulePath.mjs`:

```js
const cacheKey = `${basedir}\0${lookup}\0${cwd}`;
const cached = modulePathCache.get(cacheKey);

if (cached) return cached;

// ...resolveSilent из basedir, cwd и globalModules...

modulePathCache.set(cacheKey, path);
return path;
```

Для тестов экспортирована функция `clearModulePathCache()`, а новый regression test проверяет, что повторный lookup возвращает закешированный путь даже после удаления файла, пока cache явно не очищен. По данным benchmark из PR, на конфигурациях с `stylelint-config-standard` это дало улучшение от примерно `-3.2%` на small-наборе до `-10.1%` на x-large-наборе.

## `TIMING` больше не тянет модуль `table` на каждом запуске

[#9356](https://github.com/stylelint/stylelint/pull/9356) убирает eager import `./timing.mjs` из `lib/lintPostcssResult.mjs`. Причина практичная: `timing.mjs` использует пакет `table`, но режим timing нужен только когда задана переменная окружения `TIMING`.

До релиза модуль загружался при каждом lint run, даже если пользователь не включал измерение времени. Теперь Stylelint проверяет environment variable и импортирует timing лениво:

```js
const timing = process.env.TIMING
  ? (await import("./timing.mjs")).default
  : undefined;

// ...

if (timing?.enabled) {
  return timing.time(ruleName, () => ruleFn(postcssRoot, postcssResult))();
}
```

Это не меняет публичную команду для профилирования: пользователи по-прежнему включают её через `TIMING=1` перед запуском Stylelint. Но обычные запуски больше не платят за загрузку `table`. В benchmark из PR улучшение было небольшим, но стабильным: от `-2.4%` на small до `-4.4%` на x-large.

```bash
# как и раньше: timing включается только явно
TIMING=1 npx stylelint "src/**/*.css"
```

## Кому стоит обновиться

Обновление особенно полезно проектам, которые полагаются на `stylelint --fix` и правило `function-calc-no-unspaced-operator`: после `17.14.0` правило ловит реальные ошибки CSS в `calc()`-выражениях, где смешаны `*`/`/` и `+`/`-`.

Также релиз стоит поставить большим монорепозиториям и конфигурациям с множеством `extends`/`plugins`: кеширование `getModulePath()` снижает повторные расходы на module resolution, а ленивый `TIMING` убирает лишнюю загрузку вспомогательного форматтера при обычном запуске.

Полный список изменений доступен в [GitHub Release 17.14.0](https://github.com/stylelint/stylelint/releases/tag/17.14.0).

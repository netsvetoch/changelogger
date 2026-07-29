---
author: Артём Нецветаев
pubDatetime: 2026-07-29T06:57:42.000Z
title: "dpdm 4.3.0: конфиг проекта, @dpdm-ignore и tsconfig references"
slug: dpdm-v4-3-0
featured: false
draft: false
tags:
  - release
  - dpdm
  - javascript
  - typescript
  - dependency-analysis
description: "Разбор минорного релиза dpdm v4.3.0: файлы dpdm.config.*, исключение отдельных импортов комментарием @dpdm-ignore, фильтры предупреждений, ближайший tsconfig.json и project references."
---

[`dpdm v4.3.0`](https://github.com/acrazing/dpdm/releases/tag/v4.3.0) добавляет конфигурацию для CLI, несколько способов исключить шум из анализа и более точное разрешение TypeScript-модулей в монорепозиториях. Релизный текст содержит только ссылку на полный changelog, поэтому детали ниже проверены по [diff `v4.2.0...v4.3.0`](https://github.com/acrazing/dpdm/compare/v4.2.0...v4.3.0), основному [коммиту изменений](https://github.com/acrazing/dpdm/commit/bf2eb301b42cd05715dce54d82e0321c3b366839), README и тестам релизного тега.

## Конфигурация без длинной командной строки

CLI теперь ищет в рабочей директории один из файлов `dpdm.config.ts`, `dpdm.config.mts`, `dpdm.config.cts`, `dpdm.config.mjs`, `dpdm.config.cjs`, `dpdm.config.js` или `dpdm.config.json`. Добавлен и явный путь: `--config <file>`.

В TypeScript-конфиге можно импортировать `defineConfig` из пакета. Поля соответствуют опциям CLI: в частности, `files`, `cwd`, `context`, `extensions`, `tsconfig`, `transform`, `exitCode`, `skipImports`, `groupByPackage`, `ignoreMissWarning` и `ignoreSkipWarning`. Позиционные файлы и флаги в командной строке имеют приоритет над значениями из файла.

```ts
// dpdm.config.ts
import { defineConfig } from "dpdm";

export default defineConfig({
  files: ["./src/index.ts"],
  exitCode: "circular:1",
  transform: true,
  warning: false,
});
```

После этого достаточно запустить:

```bash
dpdm
```

В реализации `loadConfig()` читает JSON напрямую, JavaScript-модули загружает через dynamic `import()`, а `.ts`/`.mts`/`.cts` предварительно транспилирует TypeScript в CommonJS. Неподходящий export — например массив вместо объекта — завершается ошибкой `dpdm config should export an object`, а не тихо игнорируется.

## Исключить конкретное ребро: `@dpdm-ignore`

Для намеренных циклов и условных зависимостей больше не требуется глобально отключать целый файл или менять `--skip-imports`. Комментарий `@dpdm-ignore` перед конкретной конструкцией не добавляет это ребро в дерево зависимостей. Он действует на `import`, `export ... from`, `require()` и dynamic `import()`.

```ts
// @dpdm-ignore
import "./intentional-cycle";

/* @dpdm-ignore */
export * from "./generated-bridge";

export async function loadPlugin() {
  // @dpdm-ignore
  return import("./optional-plugin");
}
```

Это именно исключение dependency edge: тест релиза строит граф из `index.ts` и `cycle-b.ts`, но после пометок ожидает у `index.ts` пустой список зависимостей и отсутствие найденного цикла. Поэтому комментарий подходит, когда импорт должен остаться в исходнике, но не должен влиять на отчёт dpdm.

## Подавление известных предупреждений по регулярным выражениям

Добавлены два повторяемых флага:

- `--ignore-miss-warning <regexp>` отбрасывает предупреждение `miss`, если регулярному выражению соответствует текст import request;
- `--ignore-skip-warning <regexp>` отбрасывает предупреждение `skip`, если выражению соответствует путь пропущенного файла.

Например, проект с расширением VS Code может не считать `vscode` ошибкой, а отчёт — не засорять содержимым `node_modules`:

```bash
dpdm ./src/index.ts \
  --ignore-miss-warning '^vscode$' \
  --ignore-skip-warning '^node_modules/'
```

Эти же настройки доступны в конфиге как `ignoreMissWarning` и `ignoreSkipWarning` (строка или массив строк). Внутри CLI превращает каждую строку в `RegExp` и передаёт в `parseWarnings()`: первый фильтр сравнивает `dep.request`, второй — ключ пропущенного файла. То есть это не фильтрация готовой консоли по тексту, а отключение соответствующих диагностик при формировании списка.

## `tsconfig.json` выбирается рядом с исходником и понимает references

До этого обновления явный `--tsconfig` помогал с aliases, но типичный монорепозиторий всё равно требовал подбирать один конфиг для запуска. В `v4.3.0` при отсутствии `--tsconfig` dpdm поднимается от директории каждого анализируемого файла вверх до ближайшего `tsconfig.json`.

Если `--tsconfig` задан, загрузчик читает и его `references`, рекурсивно открывает связанные проекты и выбирает наиболее вложенный проект, содержащий текущий контекст. Затем `typescript.resolveModuleName()` использует compiler options именно этого проекта.

Релизная fixture подтверждает оба случая: пакет `@repo/ref-cycle` имеет собственный `tsconfig.json` с `baseUrl: "."` и alias `#ref-cycle/* → src/*`, а родительский `packages/tsconfig.json` ссылается на него через `references`. В тесте импорт `#ref-cycle/a.js` резолвится в `a.ts`, а цикл `a.ts → b.ts → a.ts` обнаруживается и на package-уровне как `@repo/ref-cycle`.

Практически это позволяет запускать анализ монорепозитория с корневым solution-конфигом:

```bash
dpdm --tsconfig packages/tsconfig.json \
  packages/ref-cycle/src/index.ts
```

или анализировать отдельный пакет, полагаясь на его ближайший `tsconfig.json`, без дополнительного флага.

## Дополнения к пакетному выводу и проверкам

При `--group-by-package` dpdm теперь объединяет циклы, найденные в уже сгруппированном дереве, с циклами файлового дерева, преобразованными через `groupCircularsByPackage()`, а затем удаляет дубликаты через `uniqueCirculars()`. Это сохраняет package-level циклы, которые могли потеряться при простом схлопывании узлов.

Также обработка glob вынесена в `globFiles()`: если паттерн содержит обратные слэши, включается `windowsPathsNoEscape`. В набор тестов добавлен сценарий с `packages\\shared\\src\\index.ts`, который ожидает нормализованные пути с `/`. Наконец, CI проекта теперь запускает `yarn typecheck` между тестами и сборкой.

## Кому стоит обновиться

`dpdm 4.3.0` особенно полезен, если вы:

- храните настройки анализа рядом с проектом и не хотите повторять флаги в CI;
- хотите исключить один намеренный import из проверки циклов, не скрывая остальные зависимости файла;
- анализируете TypeScript-монорепозиторий с package-local конфигами или project references;
- настраиваете отчёты для окружений с известными unresolved imports и пропускаемыми путями.

Изменение минорное: существующий запуск с позиционными файлами и флагами остаётся рабочим. Но новый конфиг может менять значения по умолчанию, поэтому при первом добавлении `dpdm.config.*` стоит проверить, что `files`, `warning`, `tree` и `circular` заданы так, как ожидает ваш CI.

---
author: Артём Нецветаев
pubDatetime: 2026-06-28T17:12:48.000Z
title: "dpdm 4.2.0: cwd для анализа вне текущей папки и package-level graph"
slug: dpdm-v4-2-0
featured: false
draft: false
tags:
  - release
  - dpdm
  - javascript
  - typescript
description: "Обзор минорного релиза dpdm v4.2.0: новый флаг --cwd, поддержка абсолютных entry paths, группировка зависимостей по package.json и изменения в ParseOptions."
---

`dpdm` выпустил минорную версию [`v4.2.0`](https://github.com/acrazing/dpdm/releases/tag/v4.2.0). Это релиз для пользователей, которые запускают анализатор зависимостей в монорепозиториях, CI-скриптах и wrapper-инструментах: теперь CLI умеет анализировать проект не из `process.cwd()`, а из явно заданной рабочей директории, а вывод можно свернуть с уровня файлов до уровня пакетов.

Источник для обзора — GitHub Release [`acrazing/dpdm@v4.2.0`](https://github.com/acrazing/dpdm/releases/tag/v4.2.0) и diff [`v4.1.0...v4.2.0`](https://github.com/acrazing/dpdm/compare/v4.1.0...v4.2.0). Сам release body содержит только ссылку на full changelog, поэтому детали ниже проверены по коммитам `b1aded0`, `7a50ec3`, `0960674` и изменениям в `src/bin/dpdm.ts`, `src/parser.ts`, `src/utils.ts`, `src/types.ts`, README и новых parser fixtures.

## `--cwd`: анализ проекта из другой директории

Главное CLI-изменение — новый флаг `--cwd`. До `v4.2.0` dpdm завязывал glob matching и относительные пути на текущую директорию процесса. Это ломало сценарии, где wrapper запускается из одной папки, а анализировать нужно другую: в [issue #22](https://github.com/acrazing/dpdm/issues/22) пользователю приходилось временно подменять `process.cwd`, а [issue #63](https://github.com/acrazing/dpdm/issues/63) показывает ошибку `No entry files were matched` для абсолютного entry path.

В `v4.2.0` CLI вычисляет отдельные `cwd` и `context`:

- `cwd` — рабочая директория для glob matching и разрешения относительных путей;
- `context` — база для сокращения путей в выводе; если `--context` не задан, он считается как `.` внутри `cwd`;
- glob entries теперь вызываются как `G.glob(pattern, {cwd})`, а найденные имена превращаются в абсолютные через `path.resolve(cwd, name)`.

Практический пример из обновлённого README:

```bash
dpdm --cwd ../other-project ./src/index.ts
```

Такой запуск можно делать из директории CI-скрипта или отдельного tooling-пакета, не переходя предварительно в анализируемый проект. Относительный entry `./src/index.ts` будет искаться внутри `../other-project`, а не внутри текущей папки shell-процесса.

## Абсолютные entry paths больше не должны проваливаться на glob step

Отдельно исправлен сценарий с абсолютным entry path из [#63](https://github.com/acrazing/dpdm/issues/63). В `src/parser.ts` dpdm перестал брать `currentDirectory = process.cwd()` и вместо этого нормализует опции через `normalizeOptions(options)`. После этого entry glob вызывается с `fullOptions.cwd`, а каждый match передаётся в рекурсивный парсер как `path.resolve(fullOptions.cwd, filename)`.

В релиз добавлен regression test `should parse an absolute entry file path`: он вызывает `parseDependencyTree(path.join(fixture, "packages/shared/src/index.ts"), {context: fixture})` и ожидает дерево с относительными id `packages/shared/src/index.ts` и `packages/shared/src/dep.ts`.

Для потребителей API важная деталь: `ParseOptions` теперь явно содержит `cwd: string`. В README интерфейс выглядит так:

```ts
export interface ParseOptions {
  cwd: string;
  context: string;
  extensions: string[];
  js: string[];
  include: RegExp;
  exclude: RegExp;
  tsconfig: string | undefined;
  onProgress: (event: "start" | "end", target: string) => void;
  transform: boolean;
  skipDynamicImports: boolean;
}
```

При обычном использовании это не обязательно должно ломать код: публичная функция принимает `Partial<ParseOptions>`, а `defaultOptions` задаёт `cwd: process.cwd()`. Но если у вас есть собственные типизированные wrappers вокруг полного `ParseOptions`, их нужно обновить и явно передавать `cwd`.

## `--group-by-package`: зависимости на уровне пакетов

Вторая новая возможность — флаг `--group-by-package`, закрывающий [feature request #33](https://github.com/acrazing/dpdm/issues/33). Он нужен монорепозиториям, где файловый граф слишком подробный, а задача — увидеть зависимости и циклы между workspace-пакетами.

Пример из README:

```bash
dpdm --group-by-package './packages/*/src/index.ts'
```

При включённом флаге CLI меняет две части вывода:

- дерево печатается с заголовком `• Package Dependencies Tree` вместо `• Dependencies Tree`;
- блок циклов печатается как `• Package Circular Dependencies` и строится уже по сгруппированному графу.

В реализации это не косметика вокруг текста. Новый helper `groupDependencyTreeByPackage(tree, context)` проходит по файловому `DependencyTree`, ищет ближайший `package.json` вверх от файла и берёт `package.json#name` как id узла. Если имя пакета отсутствует, fallback — относительный путь к найденной директории или basename. Дублирующиеся edges между одними и теми же пакетами схлопываются через `Set`, а зависимости сортируются по `id`.

У этого есть важный эффект для циклов: `parseCircular()` получает уже package-level tree. В новых тестовых fixtures есть пакеты `@repo/cycle-a` и `@repo/cycle-b`, которые импортируют друг друга через файлы `src/index.ts`; после группировки тест ожидает один цикл из двух пакетов:

```ts
expect(circulars[0].sort()).toEqual(["@repo/cycle-a", "@repo/cycle-b"]);
```

То есть в CI можно проверять архитектурные циклы между пакетами, не разбирая каждый промежуточный файл в выводе.

## Новый программный API для группировки

Группировка доступна не только через CLI. В README появился экспорт `groupDependencyTreeByPackage(tree, context)`:

```ts
export declare function groupDependencyTreeByPackage(
  tree: DependencyTree,
  context: string
): DependencyTree;
```

Типичный сценарий для собственного отчёта теперь можно собрать так:

```ts
import {
  groupDependencyTreeByPackage,
  parseCircular,
  parseDependencyTree,
} from "dpdm";

const context = process.cwd();
const tree = await parseDependencyTree(["packages/*/src/index.ts"], {
  cwd: context,
  context,
});

const packageTree = groupDependencyTreeByPackage(tree, context);
const packageCirculars = parseCircular(packageTree);

console.log(packageCirculars);
```

Этот пример основан на реально добавленных API: `groupDependencyTreeByPackage` экспортирован из `src/utils.ts`, а `cwd` добавлен в `ParseOptions` и `defaultOptions`.

## Разрешение `tsconfig` стало согласовано с `cwd`

В `normalizeOptions()` поменялась и логика `tsconfig`. Если `tsconfig` не передан, dpdm по-прежнему ищет `tsconfig.json` в `context`. Но если путь указан явно, теперь он нормализуется как `path.resolve(newOptions.cwd, options.tsconfig)`, а не через текущую директорию процесса.

Это небольшая, но важная деталь для монорепозиториев: при запуске вида `dpdm --cwd ../other-project --tsconfig tsconfig.json ./src/index.ts` конфиг будет искаться внутри `../other-project`, а не рядом со скриптом, который запустил dpdm.

В тестах это покрыто сценарием с `fixtures/parser/monorepo/tsconfig.json`, где alias `~/*` указывает на `./packages/shared/src/*`. Абсолютный путь к `tsconfig` корректно резолвит import `~/dep` в `packages/shared/src/dep.ts`.

## Кому стоит обновиться

`dpdm v4.2.0` особенно полезен, если вы:

- запускаете анализ из CI/tooling-пакета, а не из корня проекта;
- передаёте абсолютные пути к entry-файлам;
- анализируете монорепозиторий и хотите видеть граф на уровне `package.json#name`;
- пишете собственную обвязку над `parseDependencyTree()` и хотите отдельно контролировать `cwd` и `context`.

Если вы используете dpdm только как `dpdm ./src/index.ts` из корня проекта, поведение должно остаться привычным. Для typed wrappers стоит проверить, не ожидают ли они старую форму `ParseOptions` без обязательного `cwd`.

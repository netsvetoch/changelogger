---
author: Артём Нецветаев
pubDatetime: 2026-08-28T00:45:59.000Z
title: "Nub 0.8.0: envFile как массив, Varlock-передача и GC package store"
slug: nub-v0-8-0
featured: false
draft: false
tags:
  - release
  - nub
  - nodejs
  - package-manager
  - tooling
  - config
description: "Разбор Nub 0.8.0: пути envFile теперь в массиве, объявленный envFile смещает hand-over с .env.schema, нечитаемый tsconfig останавливает запуск, версионные флаги ушли из NODE_OPTIONS, а nub store prune получил сборку мусора виртуального store."
---

Минорный релиз [Nub `v0.8.0`](https://github.com/nubjs/nub/releases/tag/v0.8.0) (28 августа 2026) перерабатывает конфигурацию environment-файлов, чинит ряд соответствий npm/pnpm в пакетном менеджере и добавляет сборку мусора для package store. В релизе пять breaking changes, и два из них автор ставит в блок `[!IMPORTANT]` перед upgrade: пути в `envFile` теперь идут массивом, а первый install после upgrade один раз релинкует каждое тёплое дерево из-за изменения порядка hidden-hoist.

Источники: [GitHub Release v0.8.0](https://github.com/nubjs/nub/releases/tag/v0.8.0), compare [`v0.7.5...v0.8.0`](https://github.com/nubjs/nub/compare/v0.7.5...v0.8.0), PR [#735](https://github.com/nubjs/nub/pull/735), [#774](https://github.com/nubjs/nub/pull/774), [#778](https://github.com/nubjs/nub/pull/778), [#768](https://github.com/nubjs/nub/pull/768), [#698](https://github.com/nubjs/nub/pull/698), [#777](https://github.com/nubjs/nub/pull/777), [#720](https://github.com/nubjs/nub/pull/720), [#775](https://github.com/nubjs/nub/pull/775). Это минорный релиз, поэтому `featured: false`.

## Breaking changes

### Пути в `envFile` теперь идут массивом

Строковое значение `"envFile": ".env"` становится ошибкой, которая подсказывает правильную форму `["\.env"]` ([#735](https://github.com/nubjs/nub/pull/735)). Строковое значение резервируется за именами режимов, и пока такой режим один:

```jsonc
{
  "envFile": [".env", ".env.local"], // список файлов
  // "envFile": "varlock"            // режим — единственный строковый вариант
}
```

Это делает `envFile` согласованным с остальными list-valued полями конфига.

### Объявленный `envFile` смещает hand-over с `.env.schema` на всех уровнях

Файл `.env.schema` решает окружение только тогда, когда `envFile` не объявлен. Раньше наличие обоих одновременно было жёсткой ошибкой, а `envFile: false` в schema-проекте всё равно прочитывал schema. Теперь работает «объявленное намерение»:

- `envFile: false` (или `--no-env-file`) не загружает ничего;
- список `envFile` загружает перечисленные файлы;
- `envFile: "varlock"` явно сохраняет hand-over.

Это касается и глобального `envFile`: у `~/.config/nub/nub.jsonc` с `envFile: false` schema-проект опустошится, если сам проект не объявит `"varlock"` ([#735](https://github.com/nubjs/nub/pull/735), [#774](https://github.com/nubjs/nub/pull/774)).

### Нечитаемый `tsconfig.json` останавливает запуск

Раньше при отсутствии цели в `extends` проект продолжал работать под опциями, которые его автор никогда не писал, — а именно в `extends` обычно лежат `strict`, `target` и алиасы путей. Теперь Nub останавливается с ошибкой чтения, как это делает `tsc` (TS5083). Обход — починить конфиг либо запустить с `--node`. Однако нечитаемый `tsconfig.json` у зависимости по-прежнему «спасается», а не становится фатальным ([#778](https://github.com/nubjs/nub/pull/778), [#768](https://github.com/nubjs/nub/pull/768)).

### Чужой конфиг пакетного менеджера больше не управляет layout `node_modules`

Layout задаётся в `nub.jsonc` (`install.linker`, `install.publicHoist`) под каждой identity проекта. Исчезли последние два брендированных исключения: ключи layout из `pnpm-workspace.yaml` pnpm 11 больше не читаются, а `install-strategy=nested` npm больше не прерывает install ([#698](https://github.com/nubjs/nub/pull/698)).

### Флаги по версии ушли из `NODE_OPTIONS`

`NODE_OPTIONS` наследуется всем поддеревом процессов, и флаги, подобранные под host Node, валили любой потомок на более старом Node — Electron-приложения падали на старте. Флаги теперь передаются через argv. Цена: инструмент, который спавнит Node по абсолютному пути (минуя shim), теряет функции под версию, хотя сохраняет preload и source-map remapping ([#777](https://github.com/nubjs/nub/pull/777)).

## Package manager

| Область                  | Что изменилось                                                                                                                                                                                                                                                               | PR                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Опциональные зависимости | Ошибка сборки в записи `optionalDependencies` теперь пропускает пакет с предупреждением, а не роняет install, как в npm/pnpm.                                                                                                                                                | [#737](https://github.com/nubjs/nub/pull/737) |
| Обслуживание store       | `nub store prune` чистит и виртуальный store, и слой extracted-tree, а не только content store. Install регистрирует проект в store; проект с последним install до 0.8.0 регистрируется при следующем install.                                                               | [#720](https://github.com/nubjs/nub/pull/720) |
| `nub outdated`           | `minimumReleaseAge` применяется к обеим колонкам отчёта, так что он больше не предлагает апгрейды, которые отклонил бы `nub update`. Удерживаемая версия помечается временем, когда станет доступной; проект, где единственный ожидающий апгрейд удержан, выходит с кодом 0. | [#743](https://github.com/nubjs/nub/pull/743) |
| Release-age policy       | Frozen install перевалидирует release policy только когда возрастной лимит реально сдвинулся.                                                                                                                                                                                | [#710](https://github.com/nubjs/nub/pull/710) |
| Перенос store            | Оверрайд `store-dir` теперь переносит все уровни store вместе, так что защита от phantom-dependency продолжает работать, а дефолтный store машины не трогается.                                                                                                              | [#644](https://github.com/nubjs/nub/pull/644) |
| `.bin`-обёртки           | Пакет, чей bin совпадает с именем интерпретатора (например npm-пакет `node`), больше не порождает обёртку, резолвящуюся сама в себя — `nub install node` раньше зависал.                                                                                                     | [#741](https://github.com/nubjs/nub/pull/741) |
| Workspaces               | Резолвятся workspace-алиасы и workspace-спеки с относительными путями.                                                                                                                                                                                                       | [#717](https://github.com/nubjs/nub/pull/717) |
| Workspaces               | `nub update` со скоупом участника резолвится во фрейме корня workspace.                                                                                                                                                                                                      | [#754](https://github.com/nubjs/nub/pull/754) |
| Workspaces               | Диск-materialize eject применяется и в workspace-проектах.                                                                                                                                                                                                                   | [#736](https://github.com/nubjs/nub/pull/736) |
| Workspaces               | `nub config init` пишет `nub.jsonc` в корень workspace.                                                                                                                                                                                                                      | [#714](https://github.com/nubjs/nub/pull/714) |
| Lockfiles                | Пустой importer читается как drift, а не как особый формат без specifier'ов.                                                                                                                                                                                                 | [#763](https://github.com/nubjs/nub/pull/763) |
| Linker                   | Имена hidden-hoist занимаются shallowest-first, совпадая с глубинной сортировкой pnpm — `1.0.0` больше не бьёт `2.0.0` по лексикографической случайности.                                                                                                                    | [#775](https://github.com/nubjs/nub/pull/775) |
| Resolution               | Сходимость peer-context ограничивается размером графа.                                                                                                                                                                                                                       | [#716](https://github.com/nubjs/nub/pull/716) |
| Registry                 | Зависший fetch packument'а ограничивается по времени и всплывает вместо того, чтобы вешать install.                                                                                                                                                                          | [#723](https://github.com/nubjs/nub/pull/723) |
| Конфигурация             | `NUB_CACHE_DIR` переносит engine cache, а `nub config get`/`list` показывают значения, заданные через окружение.                                                                                                                                                             | [#740](https://github.com/nubjs/nub/pull/740) |
| Конфигурация             | Дефолт с namespace резолвится против активного embedder'а.                                                                                                                                                                                                                   | [#780](https://github.com/nubjs/nub/pull/780) |
| Чистые install           | Shim-директории при свежем install чтят `XDG_DATA_HOME`; существующий `~/.nub` сохраняет свой путь.                                                                                                                                                                          | [#752](https://github.com/nubjs/nub/pull/752) |
| Source build             | Source build (Homebrew и другое) теперь громко падает при отсутствии build-зависимости вместо тихо ухудшенного бинарника.                                                                                                                                                    | [#761](https://github.com/nubjs/nub/pull/761) |

## Runtime

| Область        | Что изменилось                                                                                  | PR                                            |
| -------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `import defer` | Deferred module evaluation включено на Node 26.4+, где Node прокладывает defer-фазу.            | [#770](https://github.com/nubjs/nub/pull/770) |
| Loaders        | Пользовательский loader через `NODE_OPTIONS` виден CommonJS-sync guard'у.                       | [#742](https://github.com/nubjs/nub/pull/742) |
| `fetch` cache  | Cache-evict builtins грузятся синхронно, закрывая гонку на старте.                              | [#707](https://github.com/nubjs/nub/pull/707) |
| Types          | `@nubjs/types` покрывает шесть polyfill'нутых proposals, до которых не добирается lib `es2024`. | [#734](https://github.com/nubjs/nub/pull/734) |
| Windows        | `nub.exe` резервирует 8 MB стек основного потока, как `node.exe`.                               | [#701](https://github.com/nubjs/nub/pull/701) |

## CLI

- Help-флаг после глагола работает в группах команд `pm` и `node` ([#739](https://github.com/nubjs/nub/pull/739)).
- Ctrl-C сигналит каждому concurrent-ребёнку `nub run`, и `--color` теперь даёт эффект ([#744](https://github.com/nubjs/nub/pull/744)).

## Что проверить при upgrade

- В `nub.jsonc` строковое значение `"envFile": ".env"` заменяется на `".env": ["\.env"]`.
- Если используете `.env.schema`/Varlock и глобальный `envFile: false` — проект должен явно объявить `envFile: "varlock"`, иначе окружение опустеет.
- Первый install после upgrade один раз релинкнет тёплые деревья из-за нового порядка hidden-hoist.
- Проект с недоступной целью `extends` в `tsconfig.json` теперь останавливается — чините конфиг или запускайте с `--node`.

```sh
# npm
npm install -g @nubjs/nub@0.8.0

# install script
curl -fsSL https://nubjs.com/install.sh | bash

# уже установленный Nub
nub upgrade
```

Полный changelog и список PR — в [GitHub Release v0.8.0](https://github.com/nubjs/nub/releases/tag/v0.8.0). Релиз минорный (`0.8.0`), поэтому пост не помечен как featured.

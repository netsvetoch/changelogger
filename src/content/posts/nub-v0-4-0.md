---
author: Артём Нецветаев
pubDatetime: 2026-07-07T22:18:52.000Z
title: "Nub 0.4.0: APP_ENV вместо NODE_ENV, Nuxt 4 и VitePress"
slug: nub-v0-4-0
featured: false
draft: false
tags:
  - release
  - nub
  - nodejs
  - tooling
description: "Обзор минорного релиза Nub v0.4.0: breaking change в выборе .env-режима через APP_ENV/--env вместо NODE_ENV, исправления для Nuxt 4 и VitePress, а также lockfile-only install в CI."
---

Nub выпустил минорный релиз [`v0.4.0`](https://github.com/nubjs/nub/releases/tag/v0.4.0). GitHub Release у этой версии подробный, но ключевые изменения я сверил с PR: env-file режим — с [#351](https://github.com/nubjs/nub/pull/351), Nuxt 4 — с [#350](https://github.com/nubjs/nub/pull/350), VitePress — с [#346](https://github.com/nubjs/nub/pull/346), а поведение `--lockfile-only` в CI — с [#349](https://github.com/nubjs/nub/pull/349). Полный diff релиза — [`v0.3.1...v0.4.0`](https://github.com/nubjs/nub/compare/v0.3.1...v0.4.0).

Главное изменение — Nub больше не использует `NODE_ENV` как переключатель `.env.{mode}` файлов. Это breaking change для проектов, где ambient `NODE_ENV=production` или `NODE_ENV=staging` раньше выбирал `.env.production` / `.env.staging`: теперь для этого нужен `APP_ENV` или новый флаг `--env`.

## `.env` mode: `--env` и `APP_ENV` вместо `NODE_ENV`

До `v0.4.0` набор автоматически загружаемых файлов зависел от `NODE_ENV`: при `NODE_ENV=production` Nub пытался читать `.env.production.local`, `.env.local`, `.env.production` и `.env`. Это удобно для выбора файлов, но смешивает две разные задачи. `NODE_ENV` читают React/Next/Vite и другие инструменты как dev/prod/test-переключатель приложения, поэтому значение вроде `NODE_ENV=staging` может неожиданно включить development-поведение в toolchain.

В [#351](https://github.com/nubjs/nub/pull/351) выбор режима вынесен в отдельную цепочку приоритета:

1. `nub --env <mode> ...` — самый высокий приоритет;
2. `APP_ENV`, если переменная непустая;
3. пустой режим, если не задано ни то, ни другое.

Практическая миграция выглядит так:

```bash
# Было: NODE_ENV выбирал .env.production*
NODE_ENV=production nub server.ts

# Стало: NODE_ENV остаётся переменной приложения,
# а APP_ENV выбирает .env.production*
NODE_ENV=production APP_ENV=production nub server.ts

# Или явно через CLI-флаг для file runner / watch
nub --env production server.ts
nub watch --env production server.ts
```

В коде это сделано не как косметическое переименование. В `crates/nub-core/src/workspace/env.rs` появилась чистая логика `resolve_mode`: непустой `--env` побеждает непустой `APP_ENV`, а `NODE_ENV` вообще не участвует в выборе имён файлов. Список имён теперь строится как `.env.[mode].local`, `.env.local`, `.env.[mode]`, `.env`; при режиме `test` слот `.env.local` по-прежнему пропускается.

Есть и защитная граница: mode используется только если он состоит из символов `[A-Za-z0-9_.-]`. Значения с разделителем пути, например `APP_ENV=../other`, тихо считаются «нет режима», чтобы `.env.{mode}` не мог выйти за пределы корня проекта. В таком случае Nub загрузит только `.env.local` и `.env`.

`NODE_ENV` при этом не становится доступным для перезаписи из `.env`: Nub по-прежнему игнорирует `NODE_ENV`, заданный внутри env-файла, и предупреждает об этом. Разница в том, что ambient `NODE_ENV=production` теперь просто проходит в child process как переменная приложения, но не выбирает `.env.production`.

## Nuxt 4: optional peer `@vue/compiler-sfc` становится достижимым под GVS

Исправление [#350](https://github.com/nubjs/nub/pull/350) закрывает сбой Nuxt 4 под global virtual store: `nuxt prepare` / `nuxt dev` могли падать с `Cannot find package '@vue/compiler-sfc'`. Причина была в форме графа зависимостей: `vue-router@5` статически импортирует `@vue/compiler-sfc` из своего `/vite` entry, но объявляет его optional peer. Сам пакет `@vue/compiler-sfc` в дереве присутствует и подходит по range, но под GVS ejected/materialized копия `vue-router` не могла дойти до него обычным realpath-поиском.

В `crates/nub-cli/src/pm_engine/phantom_closure.rs` добавлен этап planner-а, который для уже ejected closure member-ов поднимает optional peers внутрь их локального `node_modules`, но только при трёх условиях:

- optional peer реально присутствует в lockfile graph;
- его версия удовлетворяет npm range из `peerDependencies`;
- он ещё не доступен как обычная sibling dependency.

Тест в PR фиксирует Nuxt-форму: `vue-router@5.1.0` зависит от `vite@7.0.0`, объявляет optional peer `@vue/compiler-sfc@^3.5.34`, а в дереве есть `@vue/compiler-sfc@3.5.39`. После планирования `@vue/compiler-sfc@3.5.39` появляется в `hoist_within` для `vue-router@5.1.0`.

Это важно именно для совместимости, а не для «случайного» hoist-а всех optional peers: Nub не добавляет пакет, которого нет в дереве, не игнорирует range и не расширяет closure новым seed-ом. Он восстанавливает достижимость present-and-satisfying optional peer-а там, где ejected layout уже существует.

## VitePress: store directory теперь добавляется к `server.fs.allow`

В `v0.3.x` Nub уже имел Vite-compat patch для Vite `< 8.1`: он читал `node_modules/.modules.yaml`, находил `virtualStoreDir` и добавлял store directory в allow-list Vite, чтобы `/@fs` мог читать файлы из global virtual store. Проблема VitePress была в месте вставки этого sniff-а.

В [#346](https://github.com/nubjs/nub/pull/346) выяснилось, что для Vite 5 старый anchor жил внутри ветки `if (!allowDirs) { ... }`. VitePress задаёт собственный `server.fs.allow` — например, включает `DIST_CLIENT_PATH`, `srcDir` и `searchForWorkspaceRoot(cwd)`. Из-за этого условная ветка пропускалась, вместе с ней пропускался nub-sniff, и store `/@fs` оставался за пределами allow-list.

Теперь patch вставляется сразу после объявления `allowDirs`:

```js
let allowDirs = server.fs?.allow;
// nub-sniff: если allowDirs пустой — поставить workspace root,
// затем прочитать node_modules/.modules.yaml и append virtualStoreDir
```

Для Vite 6/7 anchor — `let allowDirs = server.fs.allow;`, для Vite 5 — `let allowDirs = server.fs?.allow;`. Вставленный код не заменяет framework allow-list, а добавляет `virtualStoreDir` к тому, что уже выбрал framework. Это соответствует Vite 8.1, где upstream native handler тоже безусловно делает `allowDirs.push(virtualStoreDir)`.

Отдельная полезная деталь из PR: sniff остаётся PM-agnostic и YAML-tolerant. Он сначала пробует `JSON.parse`, а затем fallback-regex для block YAML, то есть читает `virtualStoreDir` из `.modules.yaml` без жёсткой привязки к собственному формату Nub.

## `nub install --lockfile-only` снова пригоден в CI

Последнее изменение релиза — [#349](https://github.com/nubjs/nub/pull/349). В CI Nub, как pnpm, автоматически включает frozen-lockfile режим для обычного install: если manifest расходится с lockfile, команда должна падать, а не переписывать lock в пайплайне. Но `--lockfile-only` существует ровно для обратной задачи — пересчитать lockfile без установки зависимостей.

До исправления сочетание `CI=true nub install --lockfile-only` могло упереться в `ERR_NUB_OUTDATED_LOCKFILE`: CI auto-default выбирал frozen mode, и команда падала на drift-е, который сама должна была исправить. В vendored `aube` это поменяли на pnpm-подобную проверку `is_ci() && !lockfile_only`.

Теперь поведение такое:

```bash
# В CI обычный install остаётся frozen и не мутирует lockfile
CI=true nub install

# Но lockfile-only может обновить nub.lock при изменившемся package.json
CI=true nub install --lockfile-only
```

Регрессионный тест создаёт проект с `nub.lock` для `is-positive@1.0.0`, меняет manifest на `is-positive@3.1.0` и проверяет два плеча: `install --lockfile-only` под `CI=true` успешно переписывает lock на `3.1.0`, а простой `install` под тем же `CI=true` продолжает падать с `ERR_NUB_OUTDATED_LOCKFILE`.

## Что это значит для пользователей Nub

Если вы используете `.env.production`, `.env.staging` или похожие файлы, проверьте запускные скрипты и CI. После `v0.4.0` `NODE_ENV=<mode>` больше не выбирает `.env.<mode>`; для этого нужен `APP_ENV=<mode>` или `nub --env <mode>`. Это самый важный migration item релиза.

Для фреймворков релиз скорее снимает острые углы: Nuxt 4 получает доступ к присутствующему `@vue/compiler-sfc` в GVS-layout, а VitePress больше не ломается из-за собственного `server.fs.allow`. Для CI-пайплайнов полезна небольшая, но практичная правка: `nub install --lockfile-only` снова можно запускать в CI для обновления lockfile без отключения frozen-поведения у обычного install.

Для обновления npm-пакета:

```bash
npm install -g --ignore-scripts=false @nubjs/nub@0.4.0
nub --version
```

Релиз минорный (`0.4.0`), поэтому пост не помечен как featured.

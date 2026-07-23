---
author: Артём Нецветаев
pubDatetime: 2026-07-23T00:15:33.000Z
title: "Nub 0.5.0: TypeScript-скелет через nub init, create-* и корректный packageExtensions"
slug: nub-v0-5-0
featured: false
draft: false
tags:
  - release
  - nub
  - nodejs
  - typescript
  - package-manager
  - tooling
description: "Обзор Nub v0.5.0: новый TypeScript-first scaffold nub init, запуск create-* через nub create с корректным user agent, packageExtensions с проверкой lockfile, dist-tags в nub update, обновлённый nubx и ускоренная установка Node."
---

Nub выпустил минорную версию [`v0.5.0`](https://github.com/nubjs/nub/releases/tag/v0.5.0). Центральное нововведение — собственный генератор проекта `nub init`, но релиз также меняет несколько контрактов package manager-а и `nubx`. Детали сверены с исходным релизом, compare [`v0.4.13...v0.5.0`](https://github.com/nubjs/nub/compare/v0.4.13...v0.5.0), документацией на теге и PR [#499](https://github.com/nubjs/nub/pull/499), [#526](https://github.com/nubjs/nub/pull/526), [#529](https://github.com/nubjs/nub/pull/529), [#507](https://github.com/nubjs/nub/pull/507), [#509](https://github.com/nubjs/nub/pull/509), [#516](https://github.com/nubjs/nub/pull/516), [#503](https://github.com/nubjs/nub/pull/503), [#508](https://github.com/nubjs/nub/pull/508) и [#525](https://github.com/nubjs/nub/pull/525).

## `nub init` создаёт готовый TypeScript-проект

`nub init` — не перенаправление на npm/pnpm `init`, а собственная команда Nub. В пустом каталоге она создаёт `package.json`, `tsconfig.json`, `index.ts`, `README.md` и `.gitignore`, инициализирует Git и по умолчанию запускает установку. После этого появляются также `nub.lock` и `node_modules`.

```console
$ mkdir my-app && cd my-app
$ nub init -y
$ nub index.ts
Hello from Nub
```

Манифест сразу обозначает проект как Nub-native через `packageManager` и `devEngines`, добавляет script `start: "nub index.ts"` и три dev dependency:

```json
{
  "type": "module",
  "packageManager": "nub@0.5.0",
  "scripts": { "start": "nub index.ts" },
  "devDependencies": {
    "@nubjs/types": "^0.5.0",
    "@types/node": "^26",
    "typescript": "^7"
  }
}
```

`typescript` здесь нужен редактору и `tsc --noEmit`, а не запуску программы: TypeScript Nub транспилирует сам. Поэтому у scaffold-а нет runtime dependency. `@nubjs/types` добавляет типы для полифиллов Nub, а `lib` намеренно остаётся `[`"`es2024`"`]`: проект не получает DOM-глобалы вроде `window` и `document` только из-за настройки Node-типов.

Сгенерированный `tsconfig.json` выбирает Node-совместимую семантику модулей и строгую проверку:

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "es2024",
    "lib": ["es2024"],
    "types": ["node", "@nubjs/types"],
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true
  }
}
```

То есть imports можно писать с настоящим расширением — `import { helper } from "./helper.ts"` — а TypeScript не будет переписывать спецификатор. Это соответствует тому, как файл разрешают Node и Nub.

В интерактивном терминале команда спрашивает имя, TypeScript/JavaScript и необходимость `git init`; у каждого вопроса есть default. `-y` пропускает все вопросы, а в non-TTY окружении defaults выбираются автоматически, поэтому CI не повиснет на prompt-е. Полезные варианты:

```bash
nub init --js --no-install --no-git
nub init --name api-service -y
nub init --force
```

`--js` создаёт `index.js` без `tsconfig.json` и type devDependencies. Без `--force` команда отказывается перезаписывать любой из пяти целевых файлов и выводит список конфликтов; существующий `.git/` не удаляется и не переинициализируется. Позиционные аргументы для `init` запрещены: для шаблонов предназначена следующая команда.

## `nub create`: шаблоны получают команды Nub, а не npm

`nub create <template>` разворачивает соглашение `create-*`: например, `nub create vue my-app` запускает `create-vue`. Аргументы после имени шаблона передаются scaffold-утилите.

```console
$ nub create vue my-app --default

└  Done. Now run:

   cd my-app
   nub install
   nub run dev
```

Ключевая деталь из [#529](https://github.com/nubjs/nub/pull/529): дочернему процессу `dlx`/`create` теперь передаётся `npm_config_user_agent` с идентичностью Nub. Многие `create-*` читают эту переменную, чтобы напечатать дальнейшие команды для вызвавшего package manager-а; без неё они принимали вызов за npm и советовали `npm install`. Исправление относится также к `exec`-дочерним процессам.

На момент релиза интеграция уже влита в `create-vue`, Nuxt, solid-cli, react-router, create-cloudflare и package-manager-detector; `create-vite` уже читает user agent напрямую. Для шаблона, которого нет в этом списке, `nub create` всё равно запускает обычный `create-*`, но его финальная подсказка зависит от поддержки Nub в самом scaffold-е.

## `packageExtensions` теперь участвует в Nub-native lockfile

В Nub-native проекте можно держать нейтральное top-level поле `packageExtensions` в `package.json`. Оно дополняет metadata зависимости при resolve: может добавлять `dependencies`, `optionalDependencies`, `peerDependencies` и `peerDependenciesMeta`, но не заменяет уже объявленный range.

```json
{
  "packageExtensions": {
    "some-package@1.2.3": {
      "peerDependenciesMeta": {
        "react": { "optional": true }
      }
    }
  }
}
```

[#507](https://github.com/nubjs/nub/pull/507) добавил поддержку этого поля в Nub identity. Важно, что [#509](https://github.com/nubjs/nub/pull/509) довёл контракт до корректного состояния:

- top-level `packageExtensions` применяется только когда проект работает именно как Nub-native;
- в compatibility-режиме Nub не подмешивает это поле в семантику чужого менеджера: для pnpm читается его `pnpm.packageExtensions`, а npm, Yarn и Bun не получают скрытую top-level интерпретацию;
- эффективная конфигурация получает `packageExtensionsChecksum` в `nub.lock`; её изменение делает lockfile устаревшим, а не «косметическим»;
- `--frozen-lockfile` на несовпадении завершится `ERR_NUB_OUTDATED_LOCKFILE`, обычный `nub install` пересоберёт lock, а `--lockfile-only` тоже учитывает изменение.

Для существующего Nub-проекта с уже применённым top-level `packageExtensions` первое обновление может намеренно сломать frozen install: старый `nub.lock` ещё не содержит checksum. Нужно один раз выполнить обычный `nub install` и закоммитить обновлённый lockfile; после этого `--frozen-lockfile` снова проходит.

## Небольшие, но практичные изменения package manager-а

`nub update` принимает не только версию и `latest`, но любой registry dist-tag. Нестандартный tag записывается точным resolved version, а не сохраняет прежний оператор диапазона:

```bash
nub update typescript@beta
# например, ^5.3.0 заменяется на точную beta-версию из registry
```

Если tag не существует, команда отвечает `ERR_NUB_NO_MATCHING_VERSION`; URL, alias и protocol-spec по-прежнему не принимаются. Поведение `pkg@latest` и обычных version/range аргументов сохраняет прежнее «приклеивание» оператора `^`/`~`.

`nub approve-builds` теперь не только записывает разрешение для lifecycle script-ов зависимости, но и запускает одобренные build script-ы в том же вызове — отдельный `nub install` или `nub rebuild` больше не нужен. Для этого `allowBuilds` включён в digest install shape: новое разрешение не потеряется из-за быстрого пути «already up to date».

Для workspace с `nodeLinker=hoisted` [#511](https://github.com/nubjs/nub/pull/511) переключает default `hoistingLimits=none` на единый план для всего workspace. Одинаковая версия общего пакета, например React, располагается один раз в корневом `node_modules`; конфликтующие версии остаются вложенными у соответствующего member-а. Это устраняет несколько физических копий и разные module identity, от которых возможны ошибки React hooks. `hoistingLimits=workspaces` сохраняет границу каждого member-а, а `link:` siblings не переезжают в root.

## `nubx` возвращается к npx-модели

В `v0.3.0` `nubx` был универсальным runner-ом для файла, script, локального bin и registry. [#525](https://github.com/nubjs/nub/pull/525) отменяет file и script tiers ради parity с npx: теперь `nubx <name>` ищет исполняемый файл в цепочке `node_modules/.bin`, а при промахе предлагает registry fetch.

```bash
nub index.ts        # запуск файла
nub run test        # package.json script
nubx eslint . --fix # локальный bin, иначе registry fallback
```

Первый неявный fetch не стал тихим: в CI Nub отказывает без интерактивного согласия, а `-y` — явный способ разрешить download-and-run. Это миграционно важно для скриптов, которые использовали `nubx` для `.ts` файлов или именованных scripts: их следует заменить на `nub` и `nub run` соответственно.

## Установка Node начинает распаковку до конца скачивания

[#508](https://github.com/nubjs/nub/pull/508) меняет pipeline установки Node для `.tar.xz`: загрузка, xz-декодирование и распаковка перекрываются во времени, а запрос `SHASUMS256.txt` идёт параллельно скачиванию. Вместо последовательной схемы «скачать → проверить SHA-256 → распаковать» wall-clock время приближается к максимуму из download и decode/extract.

Проверка целостности не ослаблена. Распаковка идёт в quarantine-каталог `.tmp-`; только после совпадения SHA-256 дерево атомарно переносится в store. При checksum mismatch временное дерево удаляется. Windows `.zip` остаётся на прежнем пути «сначала скачать, потом распаковать».

## Кому обновляться

`v0.5.0` особенно полезен для новых Node/TypeScript-проектов: `nub init -y` создаёт строгую, но готовую к запуску основу, не добавляя DOM-типы и runtime зависимости. Пользователям packageExtensions стоит обновить lockfile до появления checksum, а пользователям `nubx` — проверить automation на старое file/script-значение команды.

Обновление глобальной установки:

```bash
npm install -g --ignore-scripts=false @nubjs/nub@0.5.0
nub --version
```

Релиз минорный (`0.5.0`), поэтому пост не помечен как featured.

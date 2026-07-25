---
author: Артём Нецветаев
pubDatetime: 2026-07-25T22:37:00.000Z
title: "Nub 0.6.0: POSIX-скрипты на Windows, строгий release-age и canary"
slug: nub-v0-6-0
featured: false
draft: false
tags:
  - release
  - nub
  - nodejs
  - package-manager
  - tooling
description: "Обзор Nub 0.6.0: package.json-скрипты через POSIX shell на всех ОС, fail-closed окно minimumReleaseAge, канал canary и новый интерактивный выбор обновлений."
---

Минорный релиз [Nub `v0.6.0`](https://github.com/nubjs/nub/releases/tag/v0.6.0) меняет два поведения, на которые нужно обратить внимание при обновлении: на Windows тела скриптов из `package.json` больше не исполняются в `cmd.exe`, а 24-часовой фильтр свежих npm-релизов теперь по умолчанию не подбирает старую версию молча. Также появился непрерывный канал `canary` и переработан `nub update -i`.

Детали проверены по GitHub Release и связанным изменениям: [#559](https://github.com/nubjs/nub/pull/559) для script runner, [#544](https://github.com/nubjs/nub/pull/544) для release-age, [#551](https://github.com/nubjs/nub/pull/551), [#557](https://github.com/nubjs/nub/pull/557) и [#558](https://github.com/nubjs/nub/pull/558) для canary, [#512](https://github.com/nubjs/nub/pull/512) для update picker. Полный диапазон изменений: [`v0.5.0...v0.6.0`](https://github.com/nubjs/nub/compare/v0.5.0...v0.6.0).

## Скрипты `package.json` теперь одинаково работают на трёх ОС

Nub запускает каждое тело скрипта через POSIX `sh`. На macOS и Linux это системный `/bin/sh`; для Windows Nub кладёт рядом с бинарником BusyBox и использует его вместо `cmd.exe`. Поэтому конструкции POSIX shell — пайпы, `&&`, glob, command substitution и parameter expansion — имеют один и тот же смысл на всех платформах:

```json
{
  "scripts": {
    "build": "rm -rf dist && mkdir dist && NODE_ENV=production node build.js",
    "serve": "node server.js --port ${PORT:-3000}",
    "check": "eslint src/**/*.ts | tee lint.log"
  }
}
```

Это именно POSIX `sh`, а не Bash: `[[ ... ]]`, массивы и `${VAR^^}` не входят в обещанный контракт. Документация Nub отдельно отмечает, что и npm на Unix обычно вызывает `sh -c` (например, `dash` в Debian/Ubuntu), поэтому bash-специфичный синтаксис не стоит считать переносимым.

### Breaking change для Windows-проектов

Скрипты, написанные на синтаксисе `cmd.exe`, после обновления не работают. В частности, нужно заменить `set NAME=value`, `%NAME%` и `rd /s /q` на POSIX-эквиваленты:

```json
{
  "scripts": {
    "build:before": "set NODE_ENV=production && node build.js",
    "clean:before": "rd /s /q dist",
    "show:before": "echo %PORT%",

    "build": "NODE_ENV=production node build.js",
    "clean": "rm -rf dist",
    "show": "echo $PORT"
  }
}
```

Если миграцию нужно отложить, можно вернуть командный интерпретатор Windows для проекта или одного вызова:

```ini
# .npmrc
script-shell=cmd
```

```sh
nub run --script-shell cmd build
```

В [#559](https://github.com/nubjs/nub/pull/559) также исправлена передача аргументов: дополнительные аргументы экранируются для выбранного shell и добавляются к _неэкранированному_ телу скрипта. Поэтому аргумент с пробелом остаётся одним токеном, а собственные `$VAR`, `$(...)` и glob-расширения внутри тела всё ещё исполняются shell:

```sh
nub run test "tests/unit with space"
```

## `minimumReleaseAge`: 24 часа теперь действительно fail-closed

Nub устанавливает для встроенного package manager два своих default-а: `minimumReleaseAge=1440` минут и `minimumReleaseAgeStrict=true`. Первый отсекает версии, опубликованные менее 24 часов назад; второй заставляет установку завершиться ошибкой, если для заданного semver range не осталось достаточно «зрелой» версии.

До `0.6.0` базовый движок при таком исчерпании кандидатов мог выбрать минимальную удовлетворяющую range версию. Теперь документированная защитная модель соответствует реализации: Nub не заменяет невозможность выбрать версию неожиданным fallback-ом.

Например, для зависимости `^3.2.0`, у которой все подходящие версии опубликованы недавно, установка теперь остановится. Если старое поведение необходимо сознательно вернуть, пользовательская `.npmrc`-настройка имеет приоритет над default-ом Nub:

```ini
# Вернуть fallback на старейшую подходящую версию
minimumReleaseAgeStrict=false

# Либо отключить возрастной фильтр целиком
minimumReleaseAge=0
```

Первый install после обновления может один раз перелинковать `node_modules` и пересобрать native add-ons. Это следствие другого исправления релиза: ключи global virtual store, side-effects cache, freshness/delta gates теперь учитывают Node engine проекта, а не только платформу или Node оболочки. Пакеты заново не скачиваются; зато артефакты, собранные для другого Node, больше не переиспользуются.

## Canary: rolling-сборка каждого push в `main`

Каждый push кода в `main` теперь создаёт полный набор сборок для восьми платформ в rolling release `canary` и публикует npm dist-tag `canary`. Установить этот канал можно так:

```sh
# macOS и Linux
curl -fsSL https://nubjs.com/install.sh | bash -s canary

# npm
npm install -g --ignore-scripts=false @nubjs/nub@canary
```

У уже установленного Nub канал переключается без переустановки вручную:

```sh
nub upgrade --canary  # перейти на rolling canary
nub upgrade --stable  # вернуться к последнему stable
```

На canary-сборке обычный `nub upgrade` остаётся в canary; `--stable` или явная версия возвращают stable-ветку. Самостоятельно установленный бинарник берётся из `releases/download/canary/`, проверяется по SHA-256 и заменяется тем же атомарным механизмом, что stable. npm-установка использует dist-tag. Homebrew намеренно остаётся stable-only и при попытке перехода выводит команду установки вместо незаметной смены канала.

## `nub update -i`: не обновлять всё по Enter

В интерактивном режиме прежний multiselect был заранее выделен: Enter мог обновить все показанные зависимости. Новый picker в [#512](https://github.com/nubjs/nub/pull/512) отображает для каждой прямой зависимости три состояния:

- **keep** — оставить текущую версию;
- **latest in range** — взять максимум, который укладывается в manifest range;
- **latest** — перейти на npm dist-tag `latest`.

Все строки стартуют в состоянии `keep`, поэтому Enter без выбора теперь ничего не обновляет. Клавиши `Space` и `←`/`→` переключают состояние строки, `a` циклически меняет видимые строки, `/` фильтрует список. `nub update -i --latest` использует тот же интерфейс, а обычный неинтерактивный `nub update` не менялся. Для `nub outdated` минорные обновления также сменили цвет с cyan на yellow.

## Что проверить после обновления

1. На Windows перепишите cmd-синтаксис в `package.json` на POSIX `sh` или временно задайте `script-shell=cmd`.
2. Если CI рассчитывал на неявный fallback при свежих версиях, зафиксируйте сознательное исключение через `minimumReleaseAgeStrict=false` или настройте собственное окно.
3. Не пугайтесь единственного relink/rebuild после первой установки: кеши стали привязаны к Node engine именно для предотвращения повторного использования несовместимых native-артефактов.
4. Для ранней проверки следующей версии используйте `nub upgrade --canary`; для production-проектов оставьте stable-канал.

Релиз минорный (`0.6.0`), поэтому пост не помечен как featured.

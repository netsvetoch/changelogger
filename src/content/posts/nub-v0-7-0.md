---
author: Артём Нецветаев
pubDatetime: 2026-08-15T00:50:27.000Z
title: "Nub 0.7.0: nub.jsonc, Varlock env-schema и fail-closed supply-chain gates"
slug: nub-v0-7-0
featured: false
draft: false
tags:
  - release
  - nub
  - nodejs
  - package-manager
  - tooling
  - config
  - supply-chain
description: "Разбор Nub 0.7.0: typed-конфиг nub.jsonc, передача .env.schema в Varlock, пять breaking changes при upgrade, ужесточённый minimumReleaseAge, typosquat/package-age gates и runtime polyfills Stage 3+."
---

Минорный релиз [Nub `v0.7.0`](https://github.com/nubjs/nub/releases/tag/v0.7.0) (5 августа 2026) добавляет project-level конфиг `nub.jsonc`, отдаёт schema-driven окружение [Varlock](https://varlock.dev), ужесточает supply-chain gates и чинит hoisted-linker, который сносил postinstall-артефакты. Пять изменений ломают привычное поведение при upgrade — их стоит прочитать до `nub upgrade`.

Источники: [GitHub Release v0.7.0](https://github.com/nubjs/nub/releases/tag/v0.7.0), compare [`v0.6.0...v0.7.0`](https://github.com/nubjs/nub/compare/v0.6.0...v0.7.0), PR [#587](https://github.com/nubjs/nub/pull/587), [#659](https://github.com/nubjs/nub/pull/659), [#602](https://github.com/nubjs/nub/pull/602), [#616](https://github.com/nubjs/nub/pull/616), [#621](https://github.com/nubjs/nub/pull/621), [#584](https://github.com/nubjs/nub/pull/584), [#665](https://github.com/nubjs/nub/pull/665).

## Пять breaking changes при upgrade

### 1. Незнакомые имена пакетов теперь challenge'ятся

При `nub add <name>`:

- публичное npm-имя, впервые зарегистрированное за последние 30 дней (`minimumPackageAge`), и
- имя, достаточно похожее на популярный пакет (typosquat),

в интерактивном терминале спрашивают подтверждение, а без TTY — падают. Уже существующие lockfile-записи и `allowedUnpopularPackages` освобождены. На один вызов:

```sh
nub add some-new-pkg --allow-low-downloads
```

или в `.npmrc`:

```ini
minimumPackageAge=0
```

Gates не применяются к `nub install`, `nub ci` и `nubx` ([#621](https://github.com/nubjs/nub/pull/621), [#658](https://github.com/nubjs/nub/pull/658)).

### 2. Release-age gate fail-closed, когда нет publish time

Раньше registry без поля `time` у версий **молча отключал** 24-часовое cooling window — даже при default `minimumReleaseAgeStrict=true`. Теперь Nub:

1. пробует last-modified packument'а как upper bound возраста;
2. если и его нет — отказывает с `ERR_NUB_RELEASE_AGE_MISSING_TIME` (exit 28).

Обходы: `minimumReleaseAgeExclude`, `minimumReleaseAge=0`, либо per-invocation флаги ([#602](https://github.com/nubjs/nub/pull/602), [#607](https://github.com/nubjs/nub/pull/607), [#622](https://github.com/nubjs/nub/pull/622), [#645](https://github.com/nubjs/nub/pull/645)):

```sh
nub install --minimum-release-age 3d --minimum-release-age-exclude '@company/*'
```

Голое число — минуты (как в pnpm); `0` отключает gate на этот run. Важно: `minimumReleaseAgeStrict=false` **не** уменьшает окно — оно лишь считает версию без установленного возраста «прошедшей» gate, то есть newest matching range ставится без age-check.

### 3. `allowBuilds` больше не читается из `.npmrc`

Allowlist сборок задаётся в `pnpm-workspace.yaml` или `package.json`. Проект, державший список только в `.npmrc`, снова увидит запросы на approve native builds.

### 4. `bunfig.toml` `[install].linker` игнорируется

Nub не воспроизводит linker modes Bun из этого поля. Bun-проект получает default layout Nub, пока явно не задан `install.linker` в `nub.jsonc` или `node-linker` в `.npmrc`. Yarn `nodeLinker` по-прежнему не читался и не менялся.

### 5. Скрипты получают `node-options` из `.npmrc`

Поведение выровнено с npm/pnpm: если `node-options` уже стоял «для других инструментов», он впервые дойдёт до lifecycle-скриптов Nub.

Первый install после upgrade один раз пересоздаёт два кэша (переименованы on-disk paths, [#600](https://github.com/nubjs/nub/pull/600)). Пакеты заново не скачиваются.

## `nub.jsonc`: typed-конфиг runtime, install и dlx

Корень проекта может нести `nub.jsonc` — JSON with comments и trailing commas. Nub ищет ближайший файл вверх от cwd ([#587](https://github.com/nubjs/nub/pull/587)):

```jsonc
{
  "$schema": "https://nubjs.com/schema/latest.json",
  "preload": ["./instrumentation.ts"],
  "conditions": ["development"],
  "loader": { ".graphql": "text" },
  "install": {
    "linker": { "strategy": "global-virtual-store", "eject": ["electron"] },
    "minimumReleaseAge": "3d",
  },
}
```

Precedence (most-specific first): CLI flag → environment → project `nub.jsonc` → global `~/.config/nub/nub.jsonc` → built-in default.

Валидация намеренно разная:

- **project file** — shared и checked-in: неизвестный ключ останавливает команду;
- **global file** — на всю машину: незнакомая секция игнорируется, чтобы не снести остальные defaults.

`install.linker` — discriminated union: у `global-virtual-store` есть `eject`, у `isolated` — `hoist`, у `hoisted` — ни того ни другого; bare-строка выбирает strategy с defaults. `publicHoist` (например `@types/*`) вынесен вне union — он пишет в root `node_modules` проекта при любой strategy. `v8Flags` отдельно от `nodeOptions`, потому что `NODE_OPTIONS` отвергает часть V8-флагов (`--stack-size`, `--expose-gc`, …), а CLI их принимает. Поле `dlx` допускается **только** в global-файле: решение «ходить ли в registry» — про машину, не про один checkout.

Чтение/запись любых полей:

```sh
nub config set install.linker hoisted
nub config set preload '["./setup.ts"]'
nub config set --location user envFile false   # personal default everywhere
nub config path
```

`nub config` валидирует по тем же правилам, что и runtime, и переписывает файл in place, сохраняя comments, blank lines и порядок ключей. Ключи, не принадлежащие `nub.jsonc`, по-прежнему читают/пишут `.npmrc`. Schema для editor completion: `https://nubjs.com/schema/latest.json`. Справочник полей: [config reference](https://nubjs.com/docs/config).

## Schema-driven environments через Varlock

`@env-spec` schema (обычно `.env.schema`) описывает типы, validation, секреты и источники значений. Если schema есть и установлен [Varlock](https://varlock.dev), Nub **перестаёт** сам грузить `.env*` и ставит Varlock перед Node ([#659](https://github.com/nubjs/nub/pull/659)):

```sh
nub add -D varlock
nub server.ts
# фактически: varlock run --path <schema-dir> -- <node> --import=preload.mjs server.ts
```

Nub не резолвит schema, не inject'ит значения и не redact'ит вывод — всем этим владеет Varlock end-to-end (включая `process.stdout.write` и subprocess, чего in-process patch не давал). Hand-over покрывает file run, `nub run`, `nub watch`, `nubx` и lifecycle scripts. В workspace schema ищется в project root, затем в workspace root.

Явные `envFile` / `--env-file` побеждают; `--node` / `NODE_COMPAT=1` отключают весь path. Имя `.env.schema` само по себе не триггерит stand-down: [dotenv-extended](https://www.npmjs.com/package/dotenv-extended) с 2016 использует тот же filename для несовместимого формата — Nub сдаёт окружение только при реальном `@env-spec` и отсутствии rival-tool в dependencies. Varlock не установлен → Nub грузит `.env*` и один раз предупреждает; объявлен в `package.json`, но не installed → run останавливается, а не стартует с пустыми значениями.

## Package manager: hoisted wipe и alias-фиксы

Критичный баг hoisted layout ([#616](https://github.com/nubjs/nub/pull/616)): каждый relink **стирал и заново заливал** каждый placed package из published tarball. Несвязанный `nub add` удалял postinstall-output (`build/Release/*.node`, скачанный binary), а delta filter потом пропускал rebuild, потому что fingerprint манифеста не менялся. Теперь directory переиспользуется, если предыдущий link дошёл до completion-sentinel и contents unchanged. Isolated layout не затронут. Уже потерянный build output upgrade не вернёт — нужен reinstall/rebuild.

Другие заметные фиксы:

| Проблема                                                                                    | PR                                                                                                                                          |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit/`outdated`/`approve-builds`/`dedupe --check` смотрели на alias-имя для `npm:`-алиасов | [#609](https://github.com/nubjs/nub/pull/609)                                                                                               |
| `.bin` symlink'и были absolute → dangling после move/copy `node_modules`                    | [#596](https://github.com/nubjs/nub/pull/596)                                                                                               |
| Hoisted: bins только у root direct deps → lifecycle exit 127 на transitive bin              | [#597](https://github.com/nubjs/nub/pull/597)                                                                                               |
| Частичный fail link оставлял half-written package как «complete»                            | [#598](https://github.com/nubjs/nub/pull/598)                                                                                               |
| Windows: `os error 183` / Access denied поверх npm/Yarn `node_modules`                      | [#595](https://github.com/nubjs/nub/pull/595), [#613](https://github.com/nubjs/nub/pull/613), [#618](https://github.com/nubjs/nub/pull/618) |
| macOS: `com.apple.quarantine` на native binaries из store                                   | [#601](https://github.com/nubjs/nub/pull/601), [#608](https://github.com/nubjs/nub/pull/608)                                                |
| `optionalDependencies` без matching version валили весь install                             | [#604](https://github.com/nubjs/nub/pull/604)                                                                                               |
| Косметические packument-поля (`dist.unpackedSize`, `modified`, …) abort'или install         | [#646](https://github.com/nubjs/nub/pull/646), [#648](https://github.com/nubjs/nub/pull/648)                                                |
| node-gyp bootstrap'ился перед каждым approved build                                         | [#666](https://github.com/nubjs/nub/pull/666)                                                                                               |
| cgroup v1 PID limit в контейнере не детектился                                              | [#640](https://github.com/nubjs/nub/pull/640)                                                                                               |

Sync package-manager engine до upstream 1.35.0 ([#621](https://github.com/nubjs/nub/pull/621)) дополнительно:

- `update` пишет обратно в `catalog:` entries;
- non-deprecated version выигрывает у deprecated в том же range;
- `audit.level` / `audit.ignore` (advisory IDs);
- `update.ignoreDeps` заменяет deprecated `updateConfig.ignoreDependencies`;
- `cacheDir` переносит и global virtual store; warning, если store и metadata на разных filesystem (иначе каждый install деградирует до per-file copy).

## Runtime: Stage 3+ surfaces под Nub

Все library surfaces Stage 3+, которых нет ни в одном supported Node, доступны под Nub; surfaces, которые Node отдаёт только в новых major, polyfill'ятся ниже native line. Native **никогда** не clobber'ится ([#584](https://github.com/nubjs/nub/pull/584)):

- нет ни в одном engine: `Promise.allKeyed` / `allSettledKeyed`, `Iterator.zip` / `zipKeyed`, `Iterator.prototype.chunks`/`windows`/`includes`/`join`, `Math.sumPrecise`, `Symbol.metadata`, `Atomics.pause`;
- ниже native major: `Promise.withResolvers`, Set methods, `Array.fromAsync` и iterator helpers (&lt;22); `Object.groupBy`, `ArrayBuffer.prototype.transfer` (&lt;21); `Map.getOrInsert`, `Iterator.concat` (&lt;26).

`@nubjs/types` несёт declarations для surfaces, которых нет в `@types/node` / TS lib.

Прочие runtime-фиксы:

- extensionless bare subpath `import "pkg/sub"` пробует `.js`/`.json`/`.ts`/`.tsx` (если у dep нет `exports`) — [#599](https://github.com/nubjs/nub/pull/599);
- `preload` больше не ломает augmentation в forks через repeated `NODE_OPTIONS` token; bare specifier резолвится от cwd — [#673](https://github.com/nubjs/nub/pull/673), [#651](https://github.com/nubjs/nub/pull/651);
- `nub watch` на Node &lt;20.6 не передаёт `--env-file` (inject напрямую, без live-reload); orphaned `node --watch` supervisor больше не остаётся после смерти parent — [#573](https://github.com/nubjs/nub/pull/573), [#620](https://github.com/nubjs/nub/pull/620);
- дерево, установленное под другой Node major, переустанавливается один раз вместо сырого `ERR_DLOPEN_FAILED` — [#555](https://github.com/nubjs/nub/pull/555);
- `require()` `.yaml`/`.toml`/`.json5`/`.jsonc`/`.txt` парсит документ, а не компилирует как JS — [#587](https://github.com/nubjs/nub/pull/587).

## Distribution и docs

Platform packages больше не возят два byte-identical 45 MB binary (`nub` + `nubx`): один binary, verb в `__NUB_ARGV0` — unpacked ~45 MiB вместо ~90, archive ~24.5 MB. Шесть из восьми packages раньше превышали 80 MiB unpacked limit npmmirror, из-за чего mirror застрял на 0.0.31 ([#665](https://github.com/nubjs/nub/pull/665)).

На Windows рядом с npm shims ставится реальный `nub.exe`, чтобы `cmd.exe` не поднимал Node ради spawn ([#671](https://github.com/nubjs/nub/pull/671)). Следствие: `npm uninstall -g @nubjs/nub` **не** удаляет `nub.exe` — его нужно снести из npm global `bin` вручную; upgrade с `--ignore-scripts` тоже оставляет старую копию.

Launcher fast-path снова срабатывает под pnpm 11 (детектор shim-template, [#649](https://github.com/nubjs/nub/pull/649)).

Документация: deployment guides для Vercel, Cloudflare, Railway, Render, AWS Lambda, Google Cloud Run; Cloudflare Workers Builds image включает `nub` с 2026-07-30 без setup step ([#639](https://github.com/nubjs/nub/pull/639), [#641](https://github.com/nubjs/nub/pull/641)).

## Кому обновляться и что проверить

- Нужен единый typed-конфиг runtime+install → заведите `nub.jsonc` и `$schema`.
- Проект на `@env-spec` / Varlock → поставьте `varlock` в devDependencies, иначе останется dotenv-cascade с warning.
- Private/offline registry без publish times → заранее `minimumReleaseAgeExclude` или `minimumReleaseAge=0`, иначе install закроется.
- `allowBuilds` в `.npmrc` → перенесите в workspace/`package.json`.
- Hoisted layout с postinstall-binaries → после upgrade сделайте reinstall затронутых packages, если output уже был стёрт.
- Windows global install → помните про orphan `nub.exe` после uninstall.

```sh
# npm
npm install -g --ignore-scripts=false @nubjs/nub@0.7.0

# install script
curl -fsSL https://nubjs.com/install.sh | bash

# уже установленный Nub
nub upgrade
```

Полный changelog и список PR — в [GitHub Release v0.7.0](https://github.com/nubjs/nub/releases/tag/v0.7.0). Релиз минорный (`0.7.0`), поэтому пост не помечен как featured.

---
author: Артём Нецветаев
pubDatetime: 2026-06-28T19:37:12.000Z
title: "Nub 0.1.0: setup-nub, безопасный install и проверенный self-heal launcher"
slug: nub-v0-1-0
featured: false
draft: false
tags:
  - release
  - nub
  - nodejs
  - tooling
description: "Обзор минорного релиза Nub v0.1.0: GitHub Action setup-nub, расширенная документация package manager, исправление approve-builds, новый harness для self-heal launcher и свежие benchmark-данные."
---

Nub выпустил минорный релиз [`v0.1.0`](https://github.com/nubjs/nub/releases/tag/v0.1.0). Сам GitHub Release содержит только ссылку на compare, поэтому обзор ниже основан на [`v0.0.49...v0.1.0`](https://github.com/nubjs/nub/compare/v0.0.49...v0.1.0), коммитах релиза и файлах документации/тестов из тега.

Nub — Rust-инструментарий для Node.js: один бинарник запускает TypeScript-файлы, `package.json` scripts, локальные CLI, установку зависимостей и управление версией Node. В `v0.1.0` версия поднята не только в Cargo workspace, но и в npm-пакетах `@nubjs/nub`, `@nubjs/nub-types` и platform packages вроде `@nubjs/nub-linux-x64` / `@nubjs/nub-darwin-arm64`.

## `nubjs/setup-nub@v1` для GitHub Actions

Коммиты [`8ba0f57`](https://github.com/nubjs/nub/commit/8ba0f57e679b2ab254742bb85078abd2fbf1cbfe) и [`6984fc5`](https://github.com/nubjs/nub/commit/6984fc582553ba7df55cdb3901f5651303cfbe39) добавляют страницу документации для GitHub Action `nubjs/setup-nub` и связывают её с FAQ/Node docs.

Новый рекомендуемый CI-сценарий — заменить `actions/setup-node` на action Nub:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: nubjs/setup-nub@v1
  - run: nub install
  - run: nub test
```

Важная деталь: action устанавливает CLI `nub`, а Node-версию дальше выбирает сам Nub по проектному pin (`.node-version`, `.nvmrc` или `engines.node`). Входы `node-version` и `node-version-file` остались, но это warm-up hint для кеша, а не источник истины для запуска проекта. Также задокументированы `cache`, `cache-dependency-path`, `registry-url`, `scope`, `always-auth`, `nub-version` и outputs `nub-version`, `node-version`, `cache-hit`.

Для миграции с `setup-node` это удобно тем, что привычные inputs вроде `node-version`, `cache` и `registry-url` принимаются. Неподдержанные `check-latest`, `architecture`, `mirror`, `mirror-token` не ломают workflow: action их принимает и игнорирует.

## Package manager: точнее описаны lockfile-совместимость, workspace-фильтры и build scripts

Коммит [`a1835bc`](https://github.com/nubjs/nub/commit/a1835bc9ec69a60d5ec68f534eebffcf8372017e) закрывает пробелы в документации package manager. Это не просто редактура: в `site/content/docs/install/index.mdx` теперь явно перечислены поддержанные команды и границы совместимости.

Для `nub install` подтверждены pnpm-совместимые flags, включая production/dev install, frozen lockfile, offline-режимы, `--node-linker`, `--registry` и `--dir`/`-C`:

```bash
nub install
nub install --frozen-lockfile
nub install -P
nub install -D
nub install --node-linker hoisted
nub ci
```

В workspace-сценариях `install` и `ci` принимают те же selectors, что и script runner: `--filter`/`-F`, `--recursive`/`-r`, `--filter-prod`, `--include-workspace-root`, `--fail-if-no-match`. Для зависимостей зафиксированы команды `nub add`, `nub remove`, `nub update`, `nub dedupe`, `nub import`, а также дополнительные verbs вроде `why`, `outdated`, `approve-builds`, `rebuild`, `fetch`, `audit`, `licenses`, `publish`, `pack`, `dlx`, `create`.

Самое полезное для production-проектов — уточнённая модель build scripts. Nub остаётся deny-by-default: `preinstall`/`install`/`postinstall` запускаются только после явного разрешения или прохождения curated trust floor. Документация прямо называет поля, куда пишется разрешение:

```bash
nub approve-builds
nub add --allow-build=<pkg> <pkg>
nub rebuild
nub install --ignore-scripts
```

Для pnpm-проектов это `pnpm.onlyBuiltDependencies` / `pnpm.allowBuilds`, для Bun — `trustedDependencies`, а нейтральный `allowBuilds` и команда `nub approve-builds` работают как общий механизм.

## Исправлен `approve-builds` на pnpm-compat поверхности

Коммит [`9b70a8b`](https://github.com/nubjs/nub/commit/9b70a8b3ea9cd825475d36f1bd18c91bdef49461) обновляет vendored `aube` до `b8e046f` и исправляет конкретный no-op: `approve-builds` на pnpm-lock/fresh поверхности раньше мог записать `allowBuilds` в top-level `package.json`, который install engine в этом режиме не читал.

После исправления approval попадает в `pnpm-workspace.yaml`, то есть в место, которое pnpm-compatible engine действительно использует. Практический эффект: предупреждение `WARN_NUB_IGNORED_BUILD_SCRIPTS` теперь лечится командой `nub approve-builds` в pnpm-совместимом проекте, а поведение NubIdentity отдельно не менялось.

## Self-heal launcher теперь покрыт отдельным harness

Самая технически важная часть релиза — коммит [`d4f785d`](https://github.com/nubjs/nub/commit/d4f785d763c67e0bb5e09fa07a33109025875af1), который заменяет старый `.github/scripts/heal-test.sh` на каталог `tests/launcher/` и обновлённый workflow `.github/workflows/launcher.yml`.

Что проверяет новый harness:

- `heal`: первый POSIX-вызов `nub` переписывает on-PATH entry в `#!/bin/sh` trampoline к native binary;
- `zero-node`: второй вызов не запускает Node вообще — это проверяется через `node` wrapper, который пишет каждый spawn в `node.log`;
- `polyglot`: уже healed entry можно выполнить как Node script, что защищает race, когда concurrent process уже прошёл shebang `node`, но перечитал заменённый файл;
- `nubx-verb`: `nubx` после heal продолжает попадать в `bin/nubx`, а не превращается в обычный `nub`;
- `ensure-chmod`: native binary, распакованный npm как `0o644`, становится executable без postinstall;
- `foreign`: unrelated `nub` раньше в `PATH` не перезаписывается;
- `concurrency`: N параллельных первых запусков должны завершиться без failures;
- Docker non-owner case: root-owned `0o644` binary + non-root user работает через staged copy в `~/.cache/nub/bin/<size>-<mtime>/<verb>`.

CI теперь гоняет host matrix на Ubuntu и macOS, а Docker-leg — на Ubuntu. В README к harness отдельно зафиксирован предел проверки: Windows intentionally не проходит через этот self-heal fast path, потому что там нет shebang/symlink механики; Windows остаётся на JS launcher и покрывается install smoke в других workflow.

## Меньше flaky-тестов вокруг `nubx`

Коммит [`4e078e6`](https://github.com/nubjs/nub/commit/4e078e61a5d836259f3c719a0661a127f3473d24) исправляет race в integration test `nubx_help_and_version_do_not_error_on_missing_bin`. Старый temp path включал только `process::id()`, но `cargo test` запускает тесты параллельными threads в одном процессе. Два потока могли одновременно писать и exec'ать один и тот же временный `nubx`, что на Linux давало `ETXTBSY`.

В `crates/nub-cli/tests/integration.rs` к имени временной директории добавлен `AtomicU64` counter:

```rust
static NUBX_N: AtomicU64 = AtomicU64::new(0);
let dir = std::env::temp_dir().join(format!(
    "nub-nubx-meta-{}-{}",
    std::process::id(),
    NUBX_N.fetch_add(1, Ordering::Relaxed)
));
```

Это изменение не добавляет новый пользовательский API, но делает test suite честнее: каждый test invocation получает собственную copy target, как уже устроено в других местах через `unique_test_cache()`.

## Benchmark-данные обновлены и привязаны к реальным версиям Node/Bun/pnpm/npm

Релиз добавляет новые результаты в `tests/bench/results/` и отдельный runner `tests/bench/run-bin-runner-pure.sh`. В сообщениях коммитов [`9b8cd49`](https://github.com/nubjs/nub/commit/9b8cd4942ebb91f653529fc79254a80b88fbfb9e) и [`68d6164`](https://github.com/nubjs/nub/commit/68d6164b9cd152e1ca7ff29c715bfd101c9ae41d) зафиксировано, что предыдущий warm-install прогон сравнивался со stale Homebrew Bun `0.5.7`; новые прогоны используют Bun `1.3.14`, pnpm `10.15.1` / `10.11.0`, npm `11.13.0` / `11.11.0` и очищенный `PATH` без `~/.nub/shims` contamination.

В одном из добавленных warm-t3 прогонов (`tests/bench/results/warm-t3-20260617-100743.json`) средние значения такие: `nub install` — около 1.04 с, `bun install (ref)` — около 1.37 с, `pnpm install` — около 2.93 с, `npm ci (offline)` — около 4.14 с. Это не синтетический marketing claim в тексте релиза, а committed JSON с 12 измерениями на команду.

Отдельно обновлена cross-runtime совместимость: коммит [`76bc00d`](https://github.com/nubjs/nub/commit/76bc00d5d19a2b999d5c77517e4e659907b8b9f5) возвращает измерение на Node `25.8.1`, чтобы corpus и binary version не расходились. В этом прогоне Node проходит 4368 checks, Nub — 4315, то есть 98.79% node-relative.

## Что это значит для пользователей Nub

Если вы уже пробуете Nub как faster `node`/`npm run`/`npx`, `v0.1.0` в первую очередь уменьшает operational risk: CI можно перевести на `nubjs/setup-nub@v1`, build-script approvals теперь документированы и исправлены для pnpm-compatible проектов, а fast launcher проверяется не только happy-path smoke test, но и race/non-owner сценариями.

Для установки или обновления npm-пакета:

```bash
npm install -g --ignore-scripts=false @nubjs/nub@0.1.0
nub --version
```

Для CI-эксперимента достаточно заменить setup step и оставить установку зависимостей через Nub:

```yaml
- uses: nubjs/setup-nub@v1
- run: nub install --frozen-lockfile
- run: nub run test
```

Релиз минорный (`0.1.0`), поэтому пост не помечен как featured.

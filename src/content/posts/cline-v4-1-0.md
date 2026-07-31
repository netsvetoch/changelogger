---
author: Артём Нецветаев
pubDatetime: 2026-07-31T04:26:32.000Z
title: "Cline 4.1.0: combined A/B VSIX и staged rollout SDK-extension"
slug: cline-v4-1-0
featured: false
draft: false
tags:
  - release
  - cline
  - ai-agents
  - vscode
description: "Разбор Cline v4.1.0: один VSIX с legacy и SDK-based bundles, loader apps/vscode-rollout, PostHog-флаг ext-sdk-bundle-rollout, override cline.rollout.bundleOverride, crash-fallback на legacy и shared storage."
---

[`cline`](https://github.com/cline/cline) выпустил minor-релиз [`v4.1.0`](https://github.com/cline/cline/releases/tag/v4.1.0). Это не набор новых UI-фич: stable VS Code extension превращается в **combined A/B package** — один VSIX, внутри которого лежат legacy-extension (линия 4.0.12), SDK-based extension с `main` и небольшой loader, который активирует ровно один bundle на окно.

Источники: GitHub Release [`cline/cline@v4.1.0`](https://github.com/cline/cline/releases/tag/v4.1.0), секция `## [4.1.0]` в root `CHANGELOG.md`, annotated tag message, пакет [`apps/vscode-rollout`](https://github.com/cline/cline/tree/v4.1.0/apps/vscode-rollout) (README + `src/cohort.ts`, `src/extension.ts`, `src/rollout.ts`, `src/scoped-context.ts`, `scripts/gen-manifest.mjs`) и workflow `ext-vscode-ab-package`.

## Зачем combined package после 4.0.x

Контекст важен. В [`v4.0.0`](https://github.com/cline/cline/releases/tag/v4.0.0) VS Code extension уже переезжал на Cline SDK, но [`v4.0.1`](https://github.com/cline/cline/releases/tag/v4.0.1) откатил stable к pre-SDK кодовой базе (по сути 3.89.2 под более высоким version number), потому что в поле появились regressions. Дальше 4.0.2–4.0.12 чинили и наращивали **legacy**-линию.

Marketplace VS Code не умеет staged rollout: публикация версии обновляет всех сразу. `4.1.0` решает это иначе: в одном VSIX живут оба runtime, а доля пользователей на SDK-bundle управляется удалённо. В release body прямо сказано: **для почти всех ничего не меняется** — loader включает тот же extension, что в 4.0.12; небольшой процент (старт с 1%) постепенно получает next, и по мере soak rollout станет default.

Annotated tag фиксирует конкретные refs бандлов:

- legacy: `legacy-extension` @ `3fdc186f1` (4.0.12 + wording free-model button, [#12668](https://github.com/cline/cline/pull/12668));
- next: `main` @ `0746ea72bf6` (в т.ч. ACP agent error handling [#12766](https://github.com/cline/cline/pull/12766));
- machinery: `apps/vscode-rollout`.

## Что лежит внутри VSIX

Published package устроен так (из README `apps/vscode-rollout`):

```text
extension.js          ← loader (~40 KB entrypoint)
package.json          ← UNION-манифест обоих bundles
assets/, walkthrough/ ← ресурсы, на которые ссылается манифест
next/                 ← SDK extension (dist/, webview-ui/build/, assets/)
legacy/               ← legacy extension (dist/, webview-ui/build/, assets/, codicons)
```

На каждое окно loader:

1. Синхронно читает cached cohort assignment из собственных `globalState` ключей — **не** из сети при activate.
2. Выставляет context key `cline.sdkBundle` (для nightly — `cline-nightly.sdkBundle`), которым gated cohort-specific menus/keybindings в union-манифесте.
3. `require()` ровно одного bundle и вызывает его `activate()` с Proxy-обёрткой `ExtensionContext`.
4. После успешной активации в фоне обновляет assignment через PostHog `/decide` — уже **для следующего** window reload.

## Как выбирается bundle

Решение полностью синхронное и deterministic. В `decideBundle()` приоритет такой:

1. `CLINE_BUNDLE_OVERRIDE=next|legacy` (env) — сильнее всего, для local dev и e2e;
2. user setting `cline.rollout.bundleOverride`: `"auto" | "next" | "legacy"`;
3. локальный crash-pin: если next уже падал на **этой** version string VSIX (`cline.rollout.nextActivationFailedVersion`), снова берётся legacy;
4. иначе cached assignment `cline.rollout.bundle` из предыдущего окна; всё, кроме явного `"next"`, остаётся legacy.

Флаг rollout — PostHog boolean release flag `ext-sdk-bundle-rollout` с percentage rollout. Парсер намеренно строгий: promote только при literal `true` из `/decide`; multivariate string, number, payload или отсутствующий flag → legacy. Это fail-safe: ошибочная конфигурация flag не должна массово выталкивать пользователей на next.

Assignment **двухсторонний**: dial percentage up промоутит, down — демоутит на следующем reload. Emergency lever — просто `0%`. Отдельного kill-switch flag нет.

Ручной override в settings.json (stable identity):

```json
{
  "cline.rollout.bundleOverride": "next"
}
```

или

```json
{
  "cline.rollout.bundleOverride": "legacy"
}
```

`"auto"` (default) следует remote assignment. Override применяется только после reload окна — mid-session flip не бывает. Setting инжектится в union `package.json` скриптом `gen-manifest.mjs`.

## Shared storage и scoped paths

`scopedContext()` перенаправляет только install-root свойства:

- `extensionUri` / `extensionPath` → `<vsix>/<next|legacy>/`;
- `asAbsolutePath()` — относительно subtree бандла.

Storage (`globalState`, `workspaceState`, `secrets`, `globalStorageUri`, `storageUri`, `logUri`) проходит untouched. Оба bundle делят тот же `~/.cline/data` и VS Code storage, что standalone extension. Поэтому settings, credentials и preferences **не мигрируют и не теряются** при смене cohort.

Оговорка из release notes и README всё же есть:

- tasks, созданные на next (SDK sessions), **не видны** в history legacy, пока машину снова не promote'нут — данные не удаляются;
- credentials, rotated на next, при demotion на legacy могут потребовать re-login.

## Crash fallback без marketplace re-publish

Если `next` бросает при `activate()`:

1. loader dispose'ит subscriptions, добавленные half-activated next;
2. пишет pin `cline.rollout.nextActivationFailedVersion = <current VSIX version>`;
3. кэширует cohort как `legacy`;
4. в **том же** окне активирует legacy;
5. шлёт telemetry (`extension.rollout.loader_decision` с `fallback: true` и authoritative `extension.rollout.bundle_activated` через export legacy bundle).

Новая published version снова получает шанс попробовать next. Если падает и legacy — VS Code получает failure; loader дополнительно репортит `double_failure: true`, потому что bundle telemetry pipeline уже мёртв.

Local builds без `TELEMETRY_SERVICE_API_KEY` сеть не трогают: все остаются на legacy, пока не задан `CLINE_BUNDLE_OVERRIDE`.

## Union-манифест

`package.json` contributions VS Code читает **до** любого кода, поэтому shipped manifest — union обоих bundles (`scripts/gen-manifest.mjs` на stitch):

- contributions, объявленные обоими, проходят as-is;
- menu/keybinding только одного бандла получают `when` AND-ed с `cline.sdkBundle` / `!cline.sdkBundle`;
- command palette entries exclusive to one cohort скрыты у другого;
- `views` / `viewsContainers` / `configuration` / `walkthroughs` **должны совпадать** — runtime-gate для них нет, divergence валит build;
- `engines` берёт более новый requirement.

Drift между ветками либо merge'ится чисто, либо stitch fails — silent ship contribution mismatch не должен проходить.

## Nightly и packaging workflow

Тот же combined package публикуется как nightly `saoudrizwan.cline-nightly` workflow'ом `ext-vscode-publish-nightly`. `scripts/nightlify.mjs` переписывает identity:

|                                | stable                       | nightly                          |
| ------------------------------ | ---------------------------- | -------------------------------- |
| manifest `name`                | `claude-dev`                 | `cline-nightly`                  |
| contribution / settings prefix | `cline.*`                    | `cline-nightly.*`                |
| version                        | operator-supplied (`4.1.0+`) | `<major>.<minor>.<unix-seconds>` |

Loader выводит namespace из `packageJSON.name` (`idPrefix` в `cohort.ts`), поэтому stable и nightly могут стоять рядом. Nightly дополнительно показывает status-bar indicator `Cline: Next` / `Cline: Legacy`; stable — нет.

Сборка: `ext-vscode-ab-package` (manual dispatch) билдит оба ref, stitch'ит, smoke-тестит loader (`scripts/smoke-loader.mjs`), заливает `.vsix` и опционально публикует. Marketplace version line combined VSIX обязана быть выше последнего published с любой ветки — legacy stable был 4.0.x, поэтому combined стартует с **4.1.0**.

## Что это значит для пользователя

- Обновились с Marketplace до 4.1.0 — почти наверняка останетесь на legacy runtime (4.0.12 lineage) до remote promote.
- Promote/demote применяются только на window reload, не mid-session.
- Если next не активируется, loader сам уйдёт на legacy в том же окне; действие пользователя не нужно.
- Settings и credentials общие; history SDK-tasks на legacy не показывается до re-promotion.
- Нужен именно next (dogfood / debug) или наоборот legacy:

```bash
# dev / e2e
CLINE_BUNDLE_OVERRIDE=next code .
# или
CLINE_BUNDLE_OVERRIDE=legacy code .
```

либо setting `cline.rollout.bundleOverride`.

- Telemetry событий rollout: `extension.rollout.bundle_activated` (из активированного bundle) и `extension.rollout.loader_decision` (loader-owned; уважает telemetry opt-out и `vscode.env.isTelemetryEnabled`).

## Итог

`4.1.0` — инфраструктурный minor: controlled re-entry SDK-based VS Code extension после rollback 4.0.1, без big-bang переключения всего Marketplace. Архитектурный контракт простой — один VSIX, два полных bundle, ~40 KB loader, remote percentage flag, local overrides, automatic crash pin и shared storage. Когда next дойдёт до 100% и soak, runbook предполагает убрать loader и публиковать plain SDK extension; до этого рычаг emergency — `ext-sdk-bundle-rollout = 0%`.

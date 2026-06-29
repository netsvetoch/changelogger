---
author: Артём Нецветаев
pubDatetime: 2026-06-29T09:19:55.000Z
title: "grok-cli 1.1.0: проверка обновлений в CLI и PR-level security scan"
slug: grok-cli-grok-dev-1-1-0
featured: false
draft: false
tags:
  - release
  - grok-cli
  - ai-agents
  - cli
description: "Разбор grok-cli 1.1.0: новый update checker для grok-dev, команда --update и slash-команда /update, уведомление в TUI, переход Brin security scan с commit-level на PR-level проверку и исправление schedule modal."
---

[`grok-cli`](https://github.com/superagent-ai/grok-cli) выпустил минорный релиз [`grok-dev@1.1.0`](https://github.com/superagent-ai/grok-cli/releases/tag/grok-dev%401.1.0). Это не большой релиз новых моделей: главное пользовательское изменение — встроенная проверка обновлений для `grok-dev`, а вокруг неё добавлены UI-уведомление, команда обновления и тесты. Ещё релиз меняет CI-защиту pull request'ов: вместо прохода по каждому коммиту репозиторий теперь сканирует весь PR через Brin API.

Источник: GitHub Release [`superagent-ai/grok-cli@grok-dev@1.1.0`](https://github.com/superagent-ai/grok-cli/releases/tag/grok-dev%401.1.0), compare [`grok-dev@1.0.0-rc7...grok-dev@1.1.0`](https://github.com/superagent-ai/grok-cli/compare/grok-dev@1.0.0-rc7...grok-dev@1.1.0) и связанные PR: [#223](https://github.com/superagent-ai/grok-cli/pull/223), [#224](https://github.com/superagent-ai/grok-cli/pull/224), [#226](https://github.com/superagent-ai/grok-cli/pull/226), [#220](https://github.com/superagent-ai/grok-cli/pull/220) и [#219](https://github.com/superagent-ai/grok-cli/pull/219).

## CLI сам проверяет свежую версию `grok-dev`

Главная функциональная часть релиза пришла из PR [#223](https://github.com/superagent-ai/grok-cli/pull/223). В проект добавлен новый модуль `src/utils/update-checker.ts`, а в `package.json` и `bun.lock` появились зависимости `semver` и `@types/semver`. Проверка устроена просто и предсказуемо:

```ts
const PACKAGE_NAME = "grok-dev";
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const FETCH_TIMEOUT_MS = 3_000;
```

`checkForUpdate(currentVersion)` запрашивает `https://registry.npmjs.org/grok-dev/latest` с заголовком `Accept: application/json`, отменяет запрос через `AbortController` после 3 секунд, валидирует обе версии через `semverValid()` и сравнивает их через `semverGt()`. Если сеть недоступна, registry вернул не-OK ответ или версия не похожа на semver, функция возвращает `null`, а не ломает запуск CLI.

Тесты `src/utils/update-checker.test.ts` фиксируют несколько важных сценариев: новая registry-версия даёт `hasUpdate: true`, совпадающая — `false`, переход с prerelease вроде `1.0.0-rc7` на стабильную `1.0.0` считается обновлением, а ошибки fetch/timeout/невалидные версии превращаются в `null`.

Практический смысл для пользователя: интерактивный `grok-dev` может подсказать, что локальная глобальная установка устарела, но при проблемах с npm registry обычная работа CLI продолжается.

## Появились `--update`, `/update` и баннер в TUI

В `src/index.ts` релиз добавляет флаг верхнего уровня:

```bash
grok-dev --update
```

При запуске с этим флагом CLI печатает `Checking for updates...`, вызывает `runUpdate()` и завершает процесс с кодом `0` при успехе или `1` при ошибке. Само обновление выполняется подтверждённой командой из `src/utils/update-checker.ts`:

```ts
const command = `npm install -g ${PACKAGE_NAME}@latest`;
```

В интерактивном UI тот же механизм подключён к slash menu. В `SLASH_MENU_ITEMS` появился пункт:

```ts
{ id: "update", label: "update", description: "Update grok to the latest version" }
```

Поэтому внутри TUI можно вызвать `/update`: приложение выставляет `isUpdating`, запускает `runUpdate()` и показывает либо `Update complete! Restart the CLI to use the new version.`, либо текст ошибки. При старте интерактивного режима в `AppStartupConfig` теперь передаётся `version: packageJson.version`, а footer больше не хардкодит `v1.0.0` — он выводит `v${startupConfig.version}`.

Если `checkForUpdate()` на старте нашёл свежую версию, TUI показывает строку:

```text
┃ Update available: v<current> → v<latest> — run /update to install
```

Дополнительно появился `UpdateModal`: Enter запускает обновление сразу, Escape закрывает окно. Это важно для пользователей глобальной npm-установки: обновление теперь не нужно искать в README или release notes, оно встроено прямо в рабочий интерфейс.

## Brin security scan переехал с коммитов на весь PR

В релиз вошли два связанных CI-изменения. Сначала PR [#220](https://github.com/superagent-ai/grok-cli/pull/220) добавил `.github/workflows/pr-commit-security-scan.yml`: workflow на `pull_request_target` перебирал коммиты PR через `gh api repos/${REPO}/pulls/${PR_NUMBER}/commits`, вызывал Brin endpoint вида `https://api.brin.sh/commit/${REPO}@${sha}?details=true&mode=full&tolerance=conservative`, считал `blocking`, `review` и `inconclusive`, обновлял единый комментарий с маркером `<!-- brin-pr-commit-scan -->` и падал, если вердикт `dangerous` или score ниже `30`.

Затем PR [#224](https://github.com/superagent-ai/grok-cli/pull/224) удалил этот commit-level workflow и заменил его на `.github/workflows/pr-security-scan.yml`. Новый вариант сканирует не каждый SHA отдельно, а PR целиком:

```bash
curl -sfL --max-time 300 \
  "https://api.brin.sh/pr/${REPO}/${PR_NUMBER}?details=true&mode=full&tolerance=conservative"
```

У нового workflow ниже `timeout-minutes` — 10 минут вместо 20, и проще модель результата: он читает `score`, `verdict` и `pending_deep_scan`. Если score пустой или deep scan ещё pending, статус становится `inconclusive` и check не падает. Если `verdict == "dangerous"` или `score < 30`, workflow пишет `should_fail=true` и завершает job ошибкой. Для `suspicious` он оставляет PR живым, но публикует review-комментарий с маркером `<!-- brin-pr-scan -->`, score, verdict и списком threats.

Для контрибьюторов это означает меньше шума в security-комментариях: вместо таблицы по каждому коммиту PR получает один aggregate verdict. Для мейнтейнеров сохраняется жёсткий блок на dangerous/low-score PR, но inconclusive case больше не превращается в автоматический отказ.

## Исправлен schedule modal в TUI

PR [#226](https://github.com/superagent-ai/grok-cli/pull/226) точечно меняет `src/ui/schedule-modal.tsx`. В `ScheduleBrowserModal` расчёт высоты стал чуть больше:

```diff
-const contentHeight = itemCount + 8;
+const contentHeight = itemCount + 10;
```

А строка расписания больше не рендерится одним вложенным `<text>` со `<span>` внутри. Теперь она разбита на row-контейнер и два текстовых узла: отдельно имя schedule с цветом выбранного элемента, отдельно ` - ${scheduleText}` muted-цветом.

```tsx
<box width="100%" flexDirection="row">
  <text fg={selected ? t.primary : t.text}>
    <b>{schedule.name}</b>
  </text>
  <text fg={t.textMuted}>{` - ${scheduleText}`}</text>
</box>
```

Это небольшое изменение, но оно относится к реальному UI-пути: модалка расписаний получает больше вертикального места и более безопасную структуру для терминального рендера.

## Что ещё попало в релиз

PR [#219](https://github.com/superagent-ai/grok-cli/pull/219) обновил `CHANGELOG.md`, добавив секцию `1.0.0-rc7` с уже выпущенными возможностями: scheduled headless runs, Shuru sandbox mode и configurable sandbox settings. В текущем compare это изменение документации, а не новая runtime-функция версии `1.1.0`.

Также release включает bump `package.json` до `1.1.0`. Это важно для нового update checker: именно `packageJson.version` теперь передаётся в TUI и используется для сравнения с npm registry, поэтому версия пакета больше не просто метаданные релиза, а часть пользовательского поведения CLI.

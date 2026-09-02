---
author: Артём Нецветаев
pubDatetime: 2026-09-02T16:16:00.000Z
title: "ompweb 0.4.0: durable auto-updates, нативный трей для Windows, единые уведомления и новый топбар"
slug: ompweb-v0-4-0
featured: false
draft: false
tags:
  - release
  - ompweb
  - oh-my-pi
  - coding-agent
  - self-update
  - windows
  - tray
description: "Разбор ompweb v0.4.0: self-update вернулся как detached-воркер с файловым lease 30м/TTL 24ч и API prepare/commit/status/acknowledge, нативный dotnet-трей для Windows с автозапуском через Task Scheduler, единые тосты/Alert и топбар в 3 зоны."
---

[ompweb](https://github.com/kahme247/ompweb) — локальный веб-UI для [oh-my-pi (omp)](https://github.com/can1357/oh-my-pi) — выпустил минор [`v0.4.0`](https://github.com/kahme247/ompweb/releases/tag/v0.4.0) (2 сентября 2026). Главное в этом релизе — разворот относительно `0.3.0`: там инсталляцию пакетов из UI убрали полностью, а тут самообновление возвращается, но уже как isolation-воркер с файловой арендой (а не мутатор глобального install из основного процесса). Плюс — нативный трей для Windows вместо `wscript → powershell`, единый пайплайн уведомлений и редизайн верхней панели в три зоны.

Источники: [GitHub Release v0.4.0](https://github.com/kahme247/ompweb/releases/tag/v0.4.0), compare [`v0.3.6...v0.4.0`](https://github.com/kahme247/ompweb/compare/v0.3.6...v0.4.0), PR [#47](https://github.com/kahme247/ompweb/pull/47). Это минор-граница semver (как `0.3.0`), не патч — `featured: false`.

## Durable auto-update: самообновление вернулось по-другому

В `0.3.0` in-app установку omp/ompweb сняли (удалили `bin/omp-web-update.js`, `lib/update-backups.ts`, `action: "update"`). В `0.4.0` её возвращают, но принципиально иначе: больше не играется с глобальным install из основного Node-процесса, а отдельный detached-воркер выполняет обновление вне приложения.

**Файловая аренда и статус.** Состояние живёт как JSON в `tmp/` (`.omp`-каталог): `ompweb-self-update[-uid]` / `omp-self-update`, внутри — файл `lease.json`. Константы в `lib/self-update.ts`:

```ts
const LEASE_MS = 30 * 60 * 1000; // аренда на 30 минут
const TERMINAL_STATUS_TTL_MS = 24 * 60 * 60 * 1000; // статус живёт 24ч
```

Аренда защищена от DoS-скрутки времени: в `isActiveLease` время истечения не может быть дальше `now + LEASE_MS + 5 * 60 * 1000` — «будущее» свыше ~35 минут трактуется как подделанный lease и не считается активным.

**Воркер вне основного процесса.** За обновление отвечает `bin/omp-web-update-worker.js` (CommonJS). Он копируется за пределы `pkgDir` (чтобы не держать Windows-лок на собственный файл) и запускается с `--kind app` или `--kind omp`. Пять стадий:

```js
const STAGES = [
  "preparing",
  "stopping",
  "installing",
  "restarting",
  "finalizing",
];
```

`preparing` держит минимум `PREPARING_MIN` (1с) перед стартом; поллинг статуса — 500мс; `stopping`/`restarting` на управляемом хосте дёргают tray (`omp-web-tray.exe --stop`) и launchd (`launchctl bootout` / `bootstrap`); на установке у воркера есть таймаут `5 * 60 * 1000` с `SIGKILL` при зависшей команде.

**HTTP API.** Две ручки. `POST /api/app-update` принимает действия `prepare` / `commit` / `status` / `acknowledge` и на асинхронные отвечает `202 Accepted`:

```sh
# 1. подготовить попытку
curl -s -X POST http://127.0.0.1:30177/api/app-update \
  -H 'Content-Type: application/json' \
  -d '{"action":"prepare"}'
# → { attemptId: "…", status: 202 }

# 2. закоммитить после подтверждения пользователем
curl -s -X POST http://127.0.0.1:30177/api/app-update \
  -H 'Content-Type: application/json' \
  -d '{"action":"commit","attemptId":"…"}'
# → { accepted: true, attemptId: "…" }
```

`POST /api/omp-update` переиспользует ту же машинерию с фиксированным `kind="omp"` и принимает `check` / `restart` / `update` / `status` / `acknowledge`; `GET /api/app-update` возвращает check npm-обновления + `selfUpdateSupported` + текущий `selfUpdateStatus` (заголовок `Cache-Control: no-store`). Коммит защищён от повтора (`validateCommitSelfUpdate` возвращает `"replay"` для уже закоммиченного `attemptId`), а на этапах работает `409`-guard, если состояние не позволяет переход.

**Отдельные исправления контракта:** `detectManager` теперь идёт через `detectInstallMethod`, у активной подготовленной попытки владение `hasLivePreparedOwnership` считается как `(prepared || running)`, дескриптор использует `OMP_WEB_HOSTNAME/PORT`, сбой установки больше не глотается, а `kind=omp` в воркере пропускает `stopOriginalProcesses`/`restartServices` — раньше это убивало `next dev` и валило апдейт с `ECONNRESET`.

## Нативный системный трей для Windows

`native/tray` — dotnet WinForms-программа, собираемая в single-file `bin/omp-web-tray.exe` (~171KB). Она заменяет скрытый мост `wscript → powershell`, которым раньше поднимался трей. Ярлыки теперь предпочитают нативную сборку с флагами `-OpenBrowser` / `-Startup` и только при её отсутствии откатываются на `wscript`; `launch-tray.vbs` получил `-Sta`.

Для автозапуска добавили headless-вариант: `omp-web-service.ps1` без Windows Forms регистрируется как Scheduled Task `omp-web` (триггер `ONLOGON`, `schtasks`), чтобы сервис стартовал без консольного окна. В `lib/windows-service.ts`:

- `start` предпочитает `schtasks /run` → нативная exe → `wscript` (fallback-цепочка);
- `stop` завершает таск и дополнительно убивает `omp-web-tray.exe`;
- `isRunning` при промахе WMI по скрытому `wscript` делает HTTP-проба через `fetch` к локальному сервису, а `isTrayProcessRunning` следит за `omp-web-tray.exe`/`service.ps1`.

Заодно из `scripts/windows` убрали эмодзи из ps1/vbs (UTF-8 без BOM вылезал ошибкой `Unexpected token '<'`).

На macOS добавлен launchd-инсталлятор (`bin/omp-web-launchd.js`, plist `com.kahme247.ompweb`), который воркер и трогает на остановке/перезапуске.

## Единые уведомления

Раньше тосты добавлялись разными частями UI и могли конфликтовать по стилям. Теперь один `toast()`-провайдер с per-toast `timeout` и `id`:

- апдейт-готов тост «Update now → Settings System» — sticky, `timeout: 0` (не уезжает сам);
- update-тосты в `AppShell` тоже sticky;
- события `Agents`/`Mcp` дедуплицируются: успех → тост, ошибка → инлайн `Alert`;
- у `FieldError` сменили визуальный статус на `status-error`.

Для вывода внутри форм в `ui/field` появился новый компонент `Alert` с вариантами `success` / `error` / `warning` / `info` (для warning — иконка `TriangleAlert` и рамка/фон `status-warning`).

## Топбар-редизайн

Верхняя панель пересобрана в три зоны:

- **лево** — утилиты (`Sidebar`, `Theme`, `Language`) отделены от инструментов сессии (`History`, `Branches`, `Terminal`);
- **центр** — геометрически отцентрированный breadcrumb проекта/сессии `📁 <Project> / <Session Title>` с wand-переименованием на месте;
- **право** — сегментированные пилюли: квота провайдера, контекст/стоимость и live/средняя скорость генерации (`⚡ t/s`).

Поповеры переведены с хрупкого позиционирования через `getBoundingClientRect()` на абсолютное якорение относительно топбара (`top: calc(100% + 4px)`) — это убирает дрейф координат при UI Scale и zoom. Меню «три точки» теперь zoom-aware (`placement below`), а Archive/Delete выполняются сразу, без промежуточного подтверждения. Карточки использования провайдера перерисованы: бейджи провайдеров, план и прогресс-бары по окнам 5h / 7d / month с обратным отсчётом.

## Также в релизе

Несколько независимых PR попали в окно `0.3.6 → 0.4.0`:

- **Collapsible composer** ([#41](https://github.com/kahme247/ompweb/pull/41)) — поле ввода сворачивается в тонкую пилюлю.
- **Tool preset picker** ([#45](https://github.com/kahme247/ompweb/pull/45)) — выбор пресета инструментов в тулбаре композера.
- **Usage analytics dashboard** — новый таб настроек с SQLite-хранилищем и квотами провайдеров ([#20](https://github.com/kahme247/ompweb/pull/20)).
- **File search** в explorer ([#30]) поверх существующего файлового индекса.
- **Chat Font Size / Interface Scale** — настройки с pre-hydration и фиксом CSS-переменных против Tailwind purge/inlining.

## Кому стоит обновиться

Всем, кто обновляет omp/ompweb из браузера: ручейка «Update now» в `0.4.0` снова работает, но честно (accepted `202`, статус в стейте, sticky-уведомление), и обновление omp теперь тоже идёт через тот же воркер вместо вручную в терминале. Пользователям Windows особенно заметны нативный трей и автозапуск через Task Scheduler вместо скрытых `wscript`/`powershell`.

## Как обновиться

```sh
npm install -g @kahme247/ompweb@0.4.0
# или без установки:
npx @kahme247/ompweb@0.4.0
```

После апдейта перезапустите живые RPC-сессии (`POST /api/omp-update` `{"action":"restart"}` или кнопка в UI). По умолчанию UI слушает `http://127.0.0.1:30177`.

Полный changelog — [v0.4.0](https://github.com/kahme247/ompweb/releases/tag/v0.4.0), diff — [`v0.3.6...v0.4.0`](https://github.com/kahme247/ompweb/compare/v0.3.6...v0.4.0).

---
author: Артём Нецветаев
pubDatetime: 2026-06-29T01:12:46.000Z
title: "vite-plugin-pwa 1.3.0: Vite 8 в peerDependencies и контроль перезагрузки service worker"
slug: vite-plugin-pwa-v1-3-0
featured: false
draft: false
tags:
  - release
  - vite-plugin-pwa
  - vite
  - pwa
description: "Разбор vite-plugin-pwa 1.3.0: peer dependency теперь допускает Vite 8, а registerSW и framework-хуки получили onNeedReload для управления моментом hard reload после обновления service worker."
---

[`vite-plugin-pwa` 1.3.0](https://github.com/vite-pwa/vite-plugin-pwa/releases/tag/v1.3.0) — небольшой минорный релиз с двумя пользовательскими изменениями, но оба важны для приложений на Vite: пакет можно ставить рядом с Vite 8 без npm-override, а клиентский runtime теперь позволяет перехватить автоматическую перезагрузку страницы после обновления service worker.

Источник: GitHub Release [`vite-pwa/vite-plugin-pwa@v1.3.0`](https://github.com/vite-pwa/vite-plugin-pwa/releases/tag/v1.3.0), compare [`v1.2.0...v1.3.0`](https://github.com/vite-pwa/vite-plugin-pwa/compare/v1.2.0...v1.3.0), PR [#924](https://github.com/vite-pwa/vite-plugin-pwa/pull/924) и PR [#914](https://github.com/vite-pwa/vite-plugin-pwa/pull/914). Для конкретики я проверил коммиты [`276af62`](https://github.com/vite-pwa/vite-plugin-pwa/commit/276af62eeecf8b5513b80a7021f39be981e5b670) и [`fb30890`](https://github.com/vite-pwa/vite-plugin-pwa/commit/fb30890423891165e2ee1a2f4bc2655842d1fc3c), а также файлы runtime, типов и документации.

## Vite 8 теперь входит в peer dependency range

До 1.3.0 `package.json` разрешал Vite от `^3.1.0` до `^7.0.0`. PR [#924](https://github.com/vite-pwa/vite-plugin-pwa/pull/924) меняет именно публичный peer dependency range:

```diff
"peerDependencies": {
  "@vite-pwa/assets-generator": "^1.0.0",
- "vite": "^3.1.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0",
+ "vite": "^3.1.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0",
  "workbox-build": "^7.4.0",
  "workbox-window": "^7.4.0"
}
```

Практический эффект простой: проект на Vite 8 может обновить `vite-plugin-pwa` до `1.3.0` и устанавливать зависимости обычным путём, без `overrides`, `resolutions` или `--legacy-peer-deps`, которые раньше приходилось использовать только из-за peer dependency warning/error.

В теле PR автор отдельно писал, что это не добавляет новую Vite Environment API-интеграцию; изменение ограничено совместимостью установки и уже проверенным стандартным сценарием precaching через `generateSW`. Поэтому при миграции на Vite 8 всё равно стоит прогнать свой PWA flow: dev/build, генерацию manifest/service worker и обновление уже открытой вкладки.

## `onNeedReload`: перехват hard reload после обновления service worker

Главное клиентское изменение из PR [#914](https://github.com/vite-pwa/vite-plugin-pwa/pull/914) — новый callback `onNeedReload` в `RegisterSWOptions`:

```ts
export interface RegisterSWOptions {
  immediate?: boolean;
  /**
   * Called when the service worker has taken control and the page would normally reload.
   *
   * Useful to fully control the reload flow (for example, to defer reload until the next
   * SPA navigation).
   */
  onNeedReload?: () => void;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}
```

Раньше runtime сам вызывал `window.location.reload()` в местах, где обновлённый service worker получил контроль. В 1.3.0 `src/client/build/register.ts` сохраняет старое поведение как fallback, но перед ним проверяет callback:

```ts
if (event.isUpdate || event.isExternal) {
  if (onNeedReload) onNeedReload();
  else window.location.reload();
}
```

Та же логика добавлена во второй путь обновления: в режиме `registerType: "prompt"`, когда пользователь вызывает `updateSW()`, service worker переходит через `skipWaiting`, срабатывает событие `controlling`, и вместо немедленного reload можно выполнить свой callback. Если `onNeedReload` не передан, страница перезагружается как раньше.

## Где это полезно: SPA-router, формы и controlled refresh

Новый callback закрывает сценарий, который описан прямо в PR: SPA может знать, что новая версия готова, но не хотеть делать hard reload в середине формы, черновика или сложной навигации. Например, приложение на TanStack Router/React Router может дождаться следующего перехода и только там выполнить reload-навигацию.

Минимальный пример для базового `virtual:pwa-register`:

```ts
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  onNeedRefresh() {
    showUpdateToast({
      onAccept: () => updateSW(),
    });
  },
  onNeedReload() {
    // Обновлённый service worker уже взял контроль.
    // Вместо немедленного window.location.reload() можно
    // синхронизировать refresh с роутером или UI-состоянием.
    markReloadPending();
  },
  onOfflineReady() {
    showOfflineReadyToast();
  },
});
```

Важно: `onNeedReload` не заменяет `onNeedRefresh`. `onNeedRefresh` по-прежнему отвечает за момент «есть новая версия, покажите пользователю prompt», а `onNeedReload` вызывается позже — когда обновлённый service worker уже берёт контроль и библиотека раньше сделала бы hard reload.

## Framework-хуки тоже прокидывают callback

Изменение не ограничилось базовым `registerSW`. Коммит [`fb30890`](https://github.com/vite-pwa/vite-plugin-pwa/commit/fb30890423891165e2ee1a2f4bc2655842d1fc3c) добавляет `onNeedReload` в framework wrappers:

- `virtual:pwa-register/react` — `src/client/build/react.ts`;
- `virtual:pwa-register/vue` — `src/client/build/vue.ts`;
- `virtual:pwa-register/svelte` — `src/client/build/svelte.ts`;
- `virtual:pwa-register/solid` — `src/client/build/solid.ts`;
- `virtual:pwa-register/preact` — `src/client/build/preact.ts`.

В каждом wrapper-е callback достаётся из `RegisterSWOptions` и передаётся в общий `registerSW({ ... })`. Поэтому для React-хука API выглядит так же:

```tsx
import { useRegisterSW } from "virtual:pwa-register/react";

export function PwaUpdater() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onNeedReload() {
      // Например, закрыть модалки, сохранить draft и затем
      // выполнить router-controlled reload.
      scheduleReloadOnNextNavigation();
    },
  });

  if (!needRefresh) return null;

  return <button onClick={() => updateServiceWorker(true)}>Обновить</button>;
}
```

Документация тоже обновлена: `docs/guide/auto-update.md` объясняет, что default при отсутствии callback — `window.location.reload()`, а `docs/guide/prompt-for-update.md` уточняет поведение после `updateSW()`. Type declaration snippets для `virtual:pwa-register`, React, Vue, Svelte, Solid и Preact теперь включают `onNeedReload?: () => void`.

## Что проверить при обновлении

- Если проект уже на Vite 8 и держал npm/yarn/pnpm override только ради `vite-plugin-pwa`, попробуйте убрать override после обновления до `1.3.0`.
- Если используете `registerType: "autoUpdate"`, проверьте, нужен ли вам `onNeedReload`: без него поведение останется прежним — автоматический hard reload при обновлении или external service worker takeover.
- Если используете prompt-flow, помните порядок: сначала `onNeedRefresh`, затем пользователь вызывает `updateSW()`, затем при `controlling` срабатывает `onNeedReload` или fallback reload.
- Для framework wrappers (`react`, `vue`, `svelte`, `solid`, `preact`) можно передавать `onNeedReload` в те же options, что и `onNeedRefresh`/`onOfflineReady`.

В compare также видно обновление Workbox-пакетов с `7.4.0` до `7.4.1` в `package.json`, `docs/package.json` и `pnpm-lock.yaml`, но GitHub Release вынес в пользовательские features именно Vite 8 peer dependency и новый callback для reload-flow.

---
author: Артём Нецветаев
pubDatetime: 2026-07-07T16:17:30.000Z
title: "Nub 0.3.0: phantom-зависимости без настройки, безопасный nubx и nub.lock"
slug: nub-v0-3-0
featured: false
draft: false
tags:
  - release
  - nub
  - nodejs
  - tooling
description: "Обзор минорного релиза Nub v0.3.0: автоматическое materialize для phantom-зависимостей, единый nubx с consent-gate, поддержка Vite/Parcel/Expo, auto-provision Node, nub.lock и более информативный install progress."
---

Nub выпустил минорный релиз [`v0.3.0`](https://github.com/nubjs/nub/releases/tag/v0.3.0). GitHub Release у этой версии подробный, но самые важные механизмы я сверил с PR: phantom-зависимости — с [#302](https://github.com/nubjs/nub/pull/302), [#319](https://github.com/nubjs/nub/pull/319), [#321](https://github.com/nubjs/nub/pull/321) и [#328](https://github.com/nubjs/nub/pull/328), новый `nubx` — с [#224](https://github.com/nubjs/nub/pull/224) и [#275](https://github.com/nubjs/nub/pull/275), совместимость фреймворков — с [#318](https://github.com/nubjs/nub/pull/318), [#338](https://github.com/nubjs/nub/pull/338), [#327](https://github.com/nubjs/nub/pull/327) и [#293](https://github.com/nubjs/nub/pull/293).

Главное изменение: строгая isolated-layout модель больше не ломает распространённые пакеты, которые импортируют транзитивные зависимости без объявления в собственном `package.json`. Раньше такие случаи были «правильными» с точки зрения package manager-а, но неприятными на практике: пакет устанавливался, а затем падал на `ERR_MODULE_NOT_FOUND`. В `v0.3.0` Nub сам находит такие phantom-use случаи и materialize-ит минимальную closure, нужную для разрешения импорта.

## Phantom-зависимости теперь работают из коробки

До релиза проблемный класс выглядел так: `@inkjs/ui` импортирует `react`, `@crawlee/basic` требует `@apify/datastructures`, но конкретный пакет не перечисляет эту зависимость как свою. В изолированном layout Nub такой импорт не мог «случайно» подняться к транзитивной зависимости, поэтому runtime получал `ERR_MODULE_NOT_FOUND`.

В `v0.3.0` включён default-on механизм phantom-eject:

- [#302](https://github.com/nubjs/nub/pull/302) добавил внутренний scanner `crates/nub-phantom`: он берёт опубликованный npm tarball, идёт от `exports` / `main` / `bin`, парсит bare `import`, `require`, `require.resolve` и dynamic `import()` через `oxc`, отбрасывает type-only imports, unreached dev/test files, optional peers, builtins и guarded optional loads, а hard-phantom помечает отдельно;
- [#319](https://github.com/nubjs/nub/pull/319) добавил ancestor-closure materialization: если нужно принудительно вынести пакет на диск, Nub материализует не только seed, но и reverse-BFS closure импортёров, чтобы не получить две разные realpath-копии одного singleton-а;
- [#321](https://github.com/nubjs/nub/pull/321) сделал dynamic scanner источником истины по умолчанию и убрал прежний curated static list `NUB_FORCE_MATERIALIZE_PACKAGES`; опт-аут остался через `NUB_DYNAMIC_PHANTOM_EJECT=0`;
- [#328](https://github.com/nubjs/nub/pull/328) добавил версию scanner-а в sidecar path (`<store>/v1/phantom/s<VERSION>/<fingerprint>.json`) и в install-state fingerprint, чтобы улучшение детектора пересканировало уже закешированные пакеты и заставляло тёплое дерево один раз перелинковаться.

Практический эффект: phantom-eject включён на каждый `nub install`; существующие warm installs один раз re-link-нутся при следующем install, ручной миграции нет. Если нужно вообще обойти virtual store, release notes отдельно фиксируют настройку:

```toml
[install]
materialization = "disk"
```

Она materialize-ит зависимости на диск целиком, а не только найденную phantom closure.

## `nubx` стал единым runner-ом, но не скачивает код молча

До `v0.3.0` пользователю приходилось держать в голове несколько поверхностей: запуск файла, script из `package.json`, локальный bin и registry downloader. В [#224](https://github.com/nubjs/nub/pull/224) `nubx <name>` стал проходить четыре tier-а в фиксированном порядке:

```console
$ nubx build.ts             # файл, как `nub build.ts`
$ nubx test                 # package.json script
$ nubx vite                 # локальный node_modules/.bin/vite
$ nubx create-vite my-app   # registry package, если локальных совпадений нет
```

Приоритет такой же, как у `nub run`: файл выигрывает у script/bin, script выигрывает у bin, а локальное совпадение не трогает сеть. Это важно для CI и для monorepo: `nubx vite` не станет внезапно скачивать registry-пакет, если CLI уже установлен локально.

Registry tier специально сделан consent-gated. На полном локальном miss-е:

- интерактивный TTY спрашивает разрешение перед первым fetch конкретного spec-а и запоминает согласие;
- CI и non-interactive контекст fail-closed;
- `-y` / `--yes` — явный opt-in для скриптов;
- `nub dlx` и короткий alias `nub x` — отдельный явный downloader, где сам вызов считается согласием;
- `nub exec` остаётся local-bin-only runner-ом.

[#275](https://github.com/nubjs/nub/pull/275) улучшил prompt: вместо простого `[y/N]` в TTY теперь select с вариантами `Yes`, `No`, `Never (don't ask me again)`. Выбор `Never` пишет глобальную настройку:

```toml
[exec]
implicit-dlx = "never"
```

Её можно менять командами `nub config get/set/delete exec.implicit-dlx`; в режиме `never` `nubx` продолжает искать file/script/bin, но registry fallback отключён без prompt-а и без сети.

## Vite, Parcel, Expo и `@types/*`: меньше ручных исключений

Релиз заметно расширяет список scaffold-and-run сценариев: Vite, Astro, SvelteKit, SolidStart, Qwik, Next.js, React Router 7 / Remix, Angular, Nuxt 4 и Parcel проверены через install/dev/build/serve.

Для Vite [#318](https://github.com/nubjs/nub/pull/318) закрывает `403 ... is outside of Vite serving allow list` под machine-global virtual store. Nub теперь пишет `node_modules/.modules.yaml` с `virtualStoreDir`, который Vite 8.1+ умеет читать нативно; для direct-dep Vite `< 8.1` Nub force-materialize-ит Vite project-local и patch-ит dist в месте вычисления `server.fs.allow`. Это работает даже когда сам dev server запущен без Nub, потому что фиксация живёт на диске в `node_modules`.

Для Parcel [#338](https://github.com/nubjs/nub/pull/338) исправил другую причину: prewarm global virtual store хешировал widened graph со всеми platform optional native deps, а link phase — host-filtered graph. В результате `@parcel/core` мог материализоваться в двух byte-identical store dirs, `parcel` и `@parcel/workers` загружали разные экземпляры core, и worker farm падал на `DataCloneError`. Теперь prewarm применяет тот же host filter, что и link phase; harness проверял Parcel 2.9.3, 2.10.3, 2.11.0, 2.12.0, 2.13.3 и 2.16.4.

Для Expo / React Native [#327](https://github.com/nubjs/nub/pull/327) исправил auto-installed wildcard peer: `react-native-worklets` объявляет `@babel/core: "*"`, а `react-native` уже тянет `@babel/core@^7.25.2`. Nub раньше мог взять registry-highest `@babel/core@8`, после чего Metro/Worklets падали с ошибкой Babel major. Теперь transitive auto peers откладываются до конца resolution pass и выбирают highest already-resolved version, подходящую под range; в проверке `expo export` стал проходить с Babel 7.29.7.

Отдельно [#293](https://github.com/nubjs/nub/pull/293) сделал hidden hoist tree GVS-aware. Если global virtual store фактически не включён — CI, `nub ci`, explicit `enableGlobalVirtualStore=false`, `dlx` или trigger-пакет — Nub строит pnpm-parity дерево `node_modules/.nub/node_modules/`, чтобы ambient `@types/*` находились ожидаемым образом.

## Runtime: `tsx` на Node 22 LTS, Import Text и marker версии

Самое прикладное runtime-исправление — [#340](https://github.com/nubjs/nub/pull/340). На Node 22.15.0–24.11.0 sync `module.registerHooks` плохо композировался с foreign async loader-ами `tsx` / `ts-node`: common case `nub run dev`, где script запускает `tsx`, мог падать с `ERR_METHOD_NOT_IMPLEMENTED: resolveSync`. Nub теперь определяет такой процесс и выставляет `__NUB_FORCE_ASYNC_TIER`, чтобы preload зарегистрировал свои hooks через async loader-worker tier. Остальные процессы на той же версии Node остаются на fast sync tier.

[#284](https://github.com/nubjs/nub/pull/284) добавил Import Text для любой extension:

```ts
import readme from "./README.md" with { type: "text" };
import rawConfig from "./config.yaml" with { type: "text" };
```

Атрибут `type: "text"` обрабатывается раньше extension dispatch, поэтому `.yaml` вернётся сырой строкой, а не parsed object; `.json` — тоже сырой текст. Экспорт только default, named import должен падать load-time `SyntaxError`. Поддерживаются Node 18.20+ / 20.10+ / 22+, но не 18.19.x: эти patch-релизы ещё не парсят синтаксис import attributes до loader hook.

Ещё одно небольшое, но полезное API-изменение — [#253](https://github.com/nubjs/nub/pull/253): под augmented Nub теперь есть read-only marker `process.versions.nub`, похожий на `process.versions.bun` или `.electron`. Под `--node` / `NODE_COMPAT=1` marker отсутствует.

```js
if (process.versions.nub) {
  console.log(`running under Nub ${process.versions.nub}`);
}
```

## Node auto-provisioning и глобальный `node` shim

[#296](https://github.com/nubjs/nub/pull/296) меняет fresh-machine сценарий. Если на машине нет `node` в `PATH` и в проекте нет pin-а, обычный `nub app.ts` больше не заканчивается `no Node binary found on PATH`: Nub берёт newest supported Node из своего cache, а если подходящего нет — скачивает `latest`. Pin не записывается автоматически, поэтому для воспроизводимости всё равно нужен явный жест:

```console
$ nub node pin 26.4.0
```

[#297](https://github.com/nubjs/nub/pull/297) добавляет persistent shim-команды:

```console
$ nub node shim
$ nub node unshim
```

Это opt-in global `node` → Nub shim для машин без установленного Node. Важная граница из PR: shimmed `node` делает version resolution/provisioning, но не включает Nub augmentation по умолчанию; обычный per-invocation hijack остаётся отдельным поведением.

## Lockfile переименован в `nub.lock`

Собственный lockfile Nub теперь называется `nub.lock`, а не `lock.yaml`. Миграция deliberately no-churn: существующий `lock.yaml` продолжает читаться и переезжает только при реальной записи lockfile — например, при add/remove/update dependency. Рутинный install без изменений ничего не переименовывает, а `nub ci` не переписывает checked-in lockfile.

Это поведение пришло из [#274](https://github.com/nubjs/nub/pull/274). Там же вернули decoupling имени lockfile в `aube-lockfile`, чтобы non-`.yaml` canonical name не ломал pnpm-проекты вроде `pnpm-lock.yaml` → `pnpm-lock.lock`.

## Install progress: spinner, linking count и имя пакета

Старый progress bar мог выглядеть зависшим: fetch уже дошёл до конца, а linking на медленной FS ещё долго не давал видимого движения. [#300](https://github.com/nubjs/nub/pull/300) заменил TTY bar на spinner + phase + live count; во время linking счётчик увеличивается по материализованным файлам, а append-only/CI renderer периодически печатает продвигающийся file count.

Последующие PR довели UX до текущего вида:

- [#337](https://github.com/nubjs/nub/pull/337) сделал spinner плавным;
- [#339](https://github.com/nubjs/nub/pull/339) убрал misleading ETA, который на хвосте крупных native binaries показывал бессмысленные sub-second оценки;
- [#343](https://github.com/nubjs/nub/pull/343) добавил имя текущего fetched package в TTY line, например `⠏ fetching  42/465 pkgs · react`.

## Package manager и run/exec мелочи

В package-manager части релиза есть несколько небольших, но конкретных изменений:

| Изменение                  | Деталь                                                                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nub pm pin [<version>]`   | [#276](https://github.com/nubjs/nub/pull/276) пишет exact `packageManager: "nub@<version>"` и `devEngines.packageManager`, не выполняя полную миграцию `nub pm use nub`.                                                   |
| dependency freshness check | [#278](https://github.com/nubjs/nub/pull/278) проверяет direct deps перед `nub run`, file-runner, `nub exec` и `nubx`; default — warn, `.npmrc`/env могут поставить `error` или `off`, а `--no-check` пропускает проверку. |
| `nub ci` для Docker COPY   | [#261](https://github.com/nubjs/nub/pull/261) делает virtual store project-local: `.nub/<dep>` становятся переносимыми, без absolute symlinks в machine-global store.                                                      |
| `prune --prod`             | release notes фиксируют сохранение hoisted production transitives, чтобы production tree не терял нужные пакеты.                                                                                                           |
| BOM в `package.json`       | [#269](https://github.com/nubjs/nub/pull/269) убирает UTF-8 BOM перед parse, вместо ошибки на первом символе.                                                                                                              |

Для runner-а также закрыты повседневные edge cases: `node_modules/.bin` всегда добавляется в script `PATH`, даже если директории ещё нет ([#283](https://github.com/nubjs/nub/pull/283)); файлы с точкой в имени корректно запускаются ([#245](https://github.com/nubjs/nub/pull/245)); аргументы после entry point проходят через `node` hijack без потери ([#248](https://github.com/nubjs/nub/pull/248)); на Windows cache directory падает обратно на `%LOCALAPPDATA%` ([#268](https://github.com/nubjs/nub/pull/268)).

## Что это значит для пользователей Nub

`v0.3.0` — релиз про снижение числа «почти работает, но нужно знать исключение». Если вы ставите реальные frontend/framework проекты через Nub, главное изменение — phantom-зависимости, Vite/Parcel/Expo и `@types/*` больше требуют меньше ручной настройки. Если используете Nub как runner, `nubx` теперь безопаснее для локального/registry смешения: локальные script/bin выигрывают без сети, а удалённый код требует явного согласия.

Для обновления npm-пакета:

```bash
npm install -g --ignore-scripts=false @nubjs/nub@0.3.0
nub --version
```

Релиз минорный (`0.3.0`), поэтому пост не помечен как featured.

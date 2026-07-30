---
author: Артём Нецветаев
pubDatetime: 2026-07-30T04:31:53.000Z
title: "RxJS 7.0.0: firstValueFrom/lastValueFrom, configurable share и жёстче TypeScript"
slug: rxjs-v7-0-0
featured: true
draft: false
tags:
  - release
  - rxjs
  - javascript
  - typescript
description: "Major RxJS 7.0.0: firstValueFrom/lastValueFrom, configurable share/connect/connectable, timeout config, package exports, rename *With/*All operators, ajax queryParams и ключевые breaking changes при миграции с 6.x."
---

RxJS выпустил major [`7.0.0`](https://github.com/ReactiveX/rxjs/releases/tag/7.0.0) (тег `7.0.0`, 29 апреля 2021). Отдельного GitHub Release body у тега нет: контракт релиза зафиксирован в [`CHANGELOG.md`](https://github.com/ReactiveX/rxjs/blob/7.0.0/CHANGELOG.md) (секция `# [7.0.0]` и вся линия alpha/beta/rc), в [Breaking Changes in Version 7](https://github.com/ReactiveX/rxjs/blob/7.0.0/docs_app/content/deprecations/breaking-changes.md) и в [6.x → 7.x Detailed Change List](https://github.com/ReactiveX/rxjs/blob/7.0.0/docs_app/content/6-to-7-change-summary.md). Compare с последним стабильным 6.x: [`6.6.7...7.0.0`](https://github.com/ReactiveX/rxjs/compare/6.6.7...7.0.0) (~1000 коммитов).

Ниже — практические API, которые появились или стали «каноническими» в 7.x, и breaking changes, которые реально ломают сборку или runtime при апгрейде с 6.x. Финальный `7.0.0` относительно `7.0.0-rc.3` сам по себе маленький (auto-import операторов в VS Code, строже `AjaxResponseType`); смысл major — вся накопившаяся линия 7.0.0-*.

## `firstValueFrom` / `lastValueFrom` вместо `toPromise`

В 7.x появились [`firstValueFrom`](https://github.com/ReactiveX/rxjs/blob/7.0.0/src/internal/firstValueFrom.ts) и [`lastValueFrom`](https://github.com/ReactiveX/rxjs/blob/7.0.0/src/internal/lastValueFrom.ts) — явная замена deprecated `toPromise`.

- `firstValueFrom(source)` подписывается, резолвит Promise первым `next` и сразу отписывается.
- `lastValueFrom(source)` ждёт `complete` и резолвит последним значением.
- Если поток завершился без значений — Promise reject'ится с `EmptyError`, пока не передан `config.defaultValue`.
- Ошибка источника уходит в `reject`.

```ts
import { interval, of, firstValueFrom, lastValueFrom } from "rxjs";
import { take } from "rxjs/operators";

const first = await firstValueFrom(interval(2000));
// 0 — и подписка уже закрыта

const last = await lastValueFrom(interval(200).pipe(take(5)));
// 4

const emptyDefault = await firstValueFrom(of(), { defaultValue: -1 });
// -1 вместо EmptyError
```

Тип `toPromise()` в TypeScript стал `Promise<T | undefined>`: это корректнее (пустой complete), но ломает строгие consumer'ы, которые ждали `Promise<T>`. Для новых мест используйте `firstValueFrom`/`lastValueFrom` с явным `defaultValue`, если пустой complete — нормальный сценарий.

## `share` стал полностью конфигурируемым

[`share`](https://github.com/ReactiveX/rxjs/blob/7.0.0/src/internal/operators/share.ts) принимает опциональный `ShareConfig<T>`:

```ts
export interface ShareConfig<T> {
  connector?: () => SubjectLike<T>;
  resetOnError?: boolean;
  resetOnComplete?: boolean;
  resetOnRefCountZero?: boolean;
}
```

Это закрывает типичные кейсы, ради которых раньше тащили `publish`/`publishReplay`/`refCount`/`shareReplay` с разным поведением сброса:

```ts
import { share } from "rxjs/operators";
import { ReplaySubject } from "rxjs";

// multicast через ReplaySubject + сброс при refCount === 0
const shared$ = source$.pipe(
  share({
    connector: () => new ReplaySubject(1),
    resetOnError: true,
    resetOnComplete: false,
    resetOnRefCountZero: true,
  })
);
```

Рядом появились [`connectable`](https://github.com/ReactiveX/rxjs/blob/7.0.0/src/internal/observable/connectable.ts) (creation function с явным `connect()`) и оператор [`connect`](https://github.com/ReactiveX/rxjs/blob/7.0.0/src/internal/operators/connect.ts) для multicast внутри selector'а — удобно, когда источник синхронный и обычный `share()` не успевает разделить одну подписку между несколькими ветками `merge`.

Финальный breaking change линии 7: `connectable` принимает **конфиг-объект**, а не «голый» `Subject`:

```ts
import { connectable, interval, Subject } from "rxjs";

// было (в ранних beta/rc): connectable(source$, new Subject())
const c$ = connectable(interval(1000), {
  connector: () => new Subject<number>(),
  resetOnDisconnect: true,
});
c$.connect();
c$.subscribe(console.log);
```

## Единый `timeout` с конфигом `each` / `first` / `with` / `meta`

[`timeout`](https://github.com/ReactiveX/rxjs/blob/7.0.0/src/internal/operators/timeout.ts) получил `TimeoutConfig`:

```ts
import { timeout, TimeoutError } from "rxjs";
import { ajax } from "rxjs/ajax";
import { catchError } from "rxjs/operators";
import { of } from "rxjs";

ajax("/api/slow").pipe(
  timeout({
    first: 5_000, // первый ответ не позже 5s
    each: 2_000, // дальше не больше 2s между значениями
    meta: { requestId: "user-profile" },
    with: ({ meta, seen, lastValue }) => {
      console.warn("timeout", meta, seen, lastValue);
      return of(null); // fallback-stream вместо ошибки
    },
  }),
  catchError(err => {
    if (err instanceof TimeoutError) {
      // err.info?.meta, err.info?.seen, err.info?.lastValue
    }
    throw err;
  })
);
```

Старые overload'ы с «просто числом» остаются, но config-форма закрывает first-byte timeout, inter-value timeout, кастомный fallback и metadata в `TimeoutError` одним API.

## Promise-границы, `throwError(() => err)` и `retry({ resetOnSuccess })`

`throwError` предпочитает **фабрику** ошибки, а не готовый instance (старый вызов с value deprecated). Это важно, когда одну и ту же definition переиспользуют в нескольких подписках — каждый раз получается свежий stack/timestamp:

```ts
import { throwError } from "rxjs";

const boom$ = throwError(() => new Error(`fail at ${Date.now()}`));
```

`retry` принимает `RetryConfig`:

```ts
import { retry } from "rxjs/operators";

source$.pipe(
  retry({
    count: 3,
    resetOnSuccess: true, // успешный next сбрасывает счётчик ошибок
  })
);
```

## Переименования операторов: `*With` и `*All`

Чтобы убрать коллизию static/instance API, pipeable-варианты переименованы (старые имена — deprecated aliases до v8):

| Было (pipeable)              | Стало               |
| ---------------------------- | ------------------- |
| `combineLatest`              | `combineLatestWith` |
| `concat`                     | `concatWith`        |
| `zip`                        | `zipWith`           |
| `race`                       | `raceWith`          |
| `exhaust`                    | `exhaustAll`        |
| higher-order `combineLatest` | `combineLatestAll`  |

```ts
import { of } from "rxjs";
import {
  combineLatestWith,
  zipWith,
  concatWith,
  raceWith,
  exhaustAll,
} from "rxjs/operators";

a$.pipe(combineLatestWith(b$, c$)); // [a, b, c] на каждом обновлении
a$.pipe(zipWith(b$));
a$.pipe(concatWith(b$));
a$.pipe(raceWith(b$));
higherOrder$.pipe(exhaustAll());
```

Static `combineLatest` дополнительно принимает **словарь** источников и эмитит объект с теми же ключами:

```ts
import { combineLatest, timer } from "rxjs";
import { map } from "rxjs/operators";

combineLatest({
  a: timer(0, 1000).pipe(map(n => `A${n}`)),
  b: timer(0, 1500).pipe(map(n => `B${n}`)),
}).subscribe(console.log);
// { a: "A0", b: "B0" }, затем обновления по ключам
```

Также добавлены `switchScan`, `animationFrames()`, поддержка `ReadableStream` и async iterables в `from()`, `filter(Boolean)` с нормальным type narrowing, `groupBy` с type guards.

## Package exports, entry points и TypeScript

В [`package.json` тега `7.0.0`](https://github.com/ReactiveX/rxjs/blob/7.0.0/package.json):

- `"sideEffects": false` — безопаснее tree-shaking.
- Поле `exports` для scoped loading:
  - `rxjs`
  - `rxjs/ajax`
  - `rxjs/fetch`
  - `rxjs/operators`
  - `rxjs/testing`
  - `rxjs/webSocket`
- `typesVersions` (`>=4.2` → `dist/types/*`) и правки, чтобы VS Code корректно auto-import'ил операторы (финальные commits `7.0.0` / `#6276`).
- Документированное требование: **TypeScript 4.2+** ([breaking-changes.md](https://github.com/ReactiveX/rxjs/blob/7.0.0/docs_app/content/deprecations/breaking-changes.md)).
- **`rxjs-compat` для v7 не публиковался**; import site `rxjs/Rx` больше невалиден.

```bash
npm install rxjs@7
```

```ts
import { of, firstValueFrom } from "rxjs";
import { map, share } from "rxjs/operators";
import { ajax } from "rxjs/ajax";
import { webSocket } from "rxjs/webSocket";
import { TestScheduler } from "rxjs/testing";
```

## `ajax`: `AjaxConfig`, `queryParams`, progress, serialization

Конфиг создания — `AjaxConfig` (вместо «ручного» `AjaxRequest` как входного типа). Важные поля из [`types.ts`](https://github.com/ReactiveX/rxjs/blob/7.0.0/src/internal/ajax/types.ts):

- `queryParams` — string / `URLSearchParams` / record / tuples; дописывается к URL, при совпадении ключей перезаписывает значения из query в `url`.
- `progressSubscriber` и include-download-progress режим — стриминг progress-событий как `AjaxResponse`.
- `xsrfCookieName` / `xsrfHeaderName` — кастомный XSRF header из cookie.
- `createXHR` — подмена XHR (тесты, нестандартные среды).
- `responseType` по умолчанию снова `"json"`.
- Строже тип `AjaxResponse.type`: `AjaxResponseType = \`${AjaxDirection}_${ProgressEventType}\``.

```ts
import { ajax } from "rxjs/ajax";

ajax({
  url: "/api/search",
  method: "GET",
  queryParams: { q: "rxjs", page: 1, tags: ["ts", "rx"] },
  headers: { Authorization: "Bearer …" },
}).subscribe(({ response, status }) => {
  console.log(status, response);
});
```

Breaking по serialization:

- body `Blob` / `ArrayBuffer` / typed arrays / `FormData` / `URLSearchParams` / `string` / `ReadableStream` — default XHR handling;
- прочий `typeof body === "object"` → `JSON.stringify` + `Content-Type: application/json;charset=utf-8`;
- заголовок `Content-Type` **больше не управляет** выбором сериализации;
- IE10 и ниже не поддерживаются;
- `instanceof AjaxError` снова работает (fix в rc.3).

## Глобальный `config`: unhandled errors и stopped notifications

[`config`](https://github.com/ReactiveX/rxjs/blob/7.0.0/src/internal/config.ts):

```ts
import { config } from "rxjs";

config.onUnhandledError = err => {
  // асинхронно, отдельный call stack
  console.error("rxjs unhandled", err);
};

config.onStoppedNotification = (notification, subscriber) => {
  // next/error/complete в уже stopped subscriber
};

// только для миграции; оба флага deprecated к v8
config.useDeprecatedSynchronousErrorHandling = false;
config.useDeprecatedNextContext = false;
```

По умолчанию unhandled errors после complete/error больше не «глотаются» через `console.warn`, а бросаются в своём call stack. В Node с `uncaughtException → process.exit` это может ронять процесс — верните `console.warn` через `onUnhandledError`, если нужен старый operational-профиль.

`unsubscribe` через `this` внутри observer `next` **выключен**; временно: `config.useDeprecatedNextContext = true` (с penalty на все подписки).

## Breaking changes, которые чаще всего бьют по миграции 6 → 7

Сводка по [официальному breaking-changes](https://github.com/ReactiveX/rxjs/blob/7.0.0/docs_app/content/deprecations/breaking-changes.md) и CHANGELOG линии 7:

1. **TypeScript ≥ 4.2**, без `rxjs-compat` и без `rxjs/Rx`.
2. **`toPromise(): Promise<T | undefined>`** — поправьте strict null checks или перейдите на `firstValueFrom`/`lastValueFrom`.
3. **`Observable.lift` снят с публичных типов** — пишите операторы как `(source) => new Observable(...)` по [guide/operators](https://rxjs.dev/guide/operators), не через `lift`.
4. **`Subscription.add` больше не возвращает Subscription**; `remove` принимает и teardown-функции, и `Subscription`.
5. **`defer` factory обязана вернуть `ObservableInput`** — нельзя `return;`/`undefined`; используйте `EMPTY` / `of()`.
6. **`defaultIfEmpty` требует аргумент** — больше не превращает «ничего» в `null`.
7. **`single`**, **`take`**, **`takeLast`** строже к пустым/невалидным аргументам и отсутствию matching values (runtime `TypeError` / updated error types).
8. **Notifier-операторы** (`buffer`/`bufferToggle`/`bufferWhen`, `window`/`windowToggle`, `debounce`, `throttle`, `sample`, `audit`, `delayWhen`): complete notifier'а **не** закрывает окно/буфер и **не** семплит — нужен `next`. Для старого поведения комбинируйте `endWith` / `takeUntil` / `skipLast` как в CHANGELOG.
9. **`buffer` всегда эмитит финальный буфер** при complete источника.
10. **`ReplaySubject` + scheduler** больше не планирует emissions сам — добавьте `observeOn`.
11. **`zip` по бесконечному iterable** зацикливает поток чтения; не передавайте endless iterator «как pull».
12. **Result-selector / scheduler arguments** на creation-функциях deprecated — предпочитайте `scheduled` + map/`*All`.
13. **Ошибки RxJS с нормальным `stack`** — deep-equal тесты на Error instance могут начать падать.
14. **`Notification.createNext(undefined)`** больше не возвращает один и тот же singleton reference.

Минимальный чеклист апгрейда:

```bash
# 1. TS 4.2+
# 2. npm i rxjs@7
# 3. убрать rxjs-compat и импорты rxjs/Rx
# 4. toPromise → firstValueFrom / lastValueFrom
# 5. pipeable combineLatest/zip/concat/race/exhaust → *With / *All
# 6. кастомные операторы на lift → new Observable
# 7. прогнать тесты на EmptyError / single / timeout / ajax body
```

## Тестирование: `TestScheduler`

- `expectObservable(a$).toEqual(b$)` — сравнение двух cold/hot потоков.
- animate helper в run mode.
- поддержка emoji в marble diagrams.
- schedulers внутри `run()`.

```ts
import { TestScheduler } from "rxjs/testing";

const ts = new TestScheduler((actual, expected) => {
  expect(actual).toEqual(expected);
});

ts.run(({ cold, expectObservable }) => {
  const a = cold("a-b-c|");
  const b = cold("a-b-c|");
  expectObservable(a).toEqual(b);
});
```

## Что смотреть дальше

- Полный diff API: [6-to-7-change-summary](https://rxjs.dev/6-to-7-change-summary) (тот же документ, что в репозитории на теге `7.0.0`).
- Deprecations index: [`docs_app/content/deprecations/`](https://github.com/ReactiveX/rxjs/tree/7.0.0/docs_app/content/deprecations) — `multicasting`, `resultSelector`, `scheduler-argument`, `subscribe-arguments`, `array-argument`.
- CHANGELOG линии 7: от alpha до [`7.0.0`](https://github.com/ReactiveX/rxjs/blob/7.0.0/CHANGELOG.md).

Итог: RxJS 7 — major про типы, multicast (`share`/`connect`/`connectable`), Promise-границу (`firstValueFrom`/`lastValueFrom`), единый `timeout`, package `exports` и зачистку legacy (`lift`, `rxjs-compat`, notifier-complete semantics). Если проект на 6.x с `rxjs-compat` и `toPromise`, закладывайте отдельный миграционный PR: API-поверхность шире, чем «просто bump minor».

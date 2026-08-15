---
author: Артём Нецветаев
pubDatetime: 2026-08-15T00:17:31.000Z
title: "RxJS 7.1.0: Subject.observed, share reset-notifiers, groupBy options"
slug: rxjs-v7-1-0
featured: false
draft: false
tags:
  - release
  - rxjs
  - javascript
  - typescript
  - observables
description: "Minor RxJS 7.1.0: getter Subject.observed; ShareConfig.resetOn* принимают notifier-factory; groupBy(key, options) с ObservableInput duration; multicast operators снова referentially transparent."
---

RxJS [`7.1.0`](https://github.com/ReactiveX/rxjs/compare/7.0.1...7.1.0) (тег `7.1.0`, 21 мая 2021) — первый minor после 7.0.x. Отдельного GitHub Release body у тега нет: контракт в [`CHANGELOG.md`](https://github.com/ReactiveX/rxjs/blob/7.1.0/CHANGELOG.md) (секция `# [7.1.0]`) и compare [`7.0.1...7.1.0`](https://github.com/ReactiveX/rxjs/compare/7.0.1...7.1.0) (11 коммитов). User-facing surface: **`Subject.observed`**, расширенный **`ShareConfig`** (reset через notifier observable), **`groupBy(key, options)`**, плюс fix referential transparency у `share` / `publish*` / `shareReplay`.

## `Subject.observed`: есть ли подписчики без доступа к `observers`

В [`#6405`](https://github.com/ReactiveX/rxjs/pull/6405) / [`f47425d`](https://github.com/ReactiveX/rxjs/commit/f47425d349475231c0f3542bb6ecef16a63e933a) у `Subject` (и наследников — `BehaviorSubject`, `ReplaySubject`, `AsyncSubject`) появился **readonly getter** `observed`:

```ts
// src/internal/Subject.ts @ 7.1.0
get observed() {
  return this.observers?.length > 0;
}
```

API guard:

```ts
export declare class Subject<T>
  extends Observable<T>
  implements SubscriptionLike
{
  // ...
  get observed(): boolean;
  observers: Observer<T>[]; // ещё public, но планировалось сделать private
}
```

Зачем: раньше, чтобы узнать «есть ли живые подписчики», приходилось смотреть на массив `observers` (или `observers.length`). Команда RxJS готовила закрытие этого массива; `observed` — стабильный boolean-контракт без доступа к internals.

```ts
import { Subject } from "rxjs";

const subject = new Subject<number>();
console.log(subject.observed); // false

const sub = subject.subscribe(v => console.log(v));
console.log(subject.observed); // true

sub.unsubscribe();
console.log(subject.observed); // false
```

Кого касается: любой код, который ветвится по наличию listeners (lazy connect, pause upstream, debug/metrics). Миграция: `subject.observers.length > 0` → `subject.observed`. Сам массив `observers` в 7.1.0 ещё public, но новый API — предпочтительный.

## `share`: reset через notifier factory, не только boolean

В [`#6169`](https://github.com/ReactiveX/rxjs/pull/6169) / [`12c3716`](https://github.com/ReactiveX/rxjs/commit/12c3716cecbf01f353c980488bf18845177b37b6) поля `ShareConfig` расширили: вместо только `boolean` можно передать **factory, возвращающую `Observable`**, который одним next/complete запускает reset внутреннего state:

```ts
export interface ShareConfig<T> {
  connector?: () => SubjectLike<T>;
  resetOnError?: boolean | ((error: any) => Observable<any>);
  resetOnComplete?: boolean | (() => Observable<any>);
  resetOnRefCountZero?: boolean | (() => Observable<any>);
}
```

Семантика boolean без изменений: `true` — reset сразу, `false` — не сбрасывать (subject остаётся «горячим»). Factory даёт **отложенный / условный** reset: helper `handleReset` при function-значении подписывается на `on(...args).pipe(take(1))` и только после эмиссии вызывает `reset()`.

Пример из docs коммита — отложенный reset при `refCount === 0`:

```ts
import { interval, share, take, timer } from "rxjs";

const source = interval(1000).pipe(
  take(3),
  share({ resetOnRefCountZero: () => timer(1000) })
);

const subscriptionOne = source.subscribe(x =>
  console.log("subscription 1:", x)
);
setTimeout(() => subscriptionOne.unsubscribe(), 1300);

// ~400ms спустя — source ещё не сброшен (окно 1s), продолжение с 1, 2
setTimeout(
  () => source.subscribe(x => console.log("subscription 2:", x)),
  1700
);

// ~2s после unsub второго — reset уже произошёл, снова 0, 1, 2
setTimeout(
  () => source.subscribe(x => console.log("subscription 3:", x)),
  5000
);
```

Важно (прямо в JSDoc `share`): reset на error/complete **не** делает transparent retry — error/complete уходят текущим подписчикам и закрывают их subscription. Только **новые** подписчики после reset получают fresh connect к source. Transparent retry/restart по-прежнему нужно pipe'ить до `share` (`retry`, `repeat`, …).

Кого касается: multicasting HTTP/WebSocket/interval, где нужен grace period перед отпиской от upstream, или reset только при определённых ошибках (`resetOnError: (err) => err.status === 503 ? of(0) : EMPTY` — условно, через notifier).

## `groupBy`: named options + `ObservableInput` для duration

В [`#5679`](https://github.com/ReactiveX/rxjs/pull/5679) / [`7a99397`](https://github.com/reactivex/rxjs/commit/7a9939773802c4f7948c6d868a8f75facdea9f37) у `groupBy` появился overload с объектом options (в духе v7 API других операторов). Позиционные `element` / `duration` / `connector` помечены `@deprecated` в пользу options:

```ts
interface BasicGroupByOptions<K, T> {
  element?: undefined;
  duration?: (grouped: GroupedObservable<K, T>) => ObservableInput<any>;
  connector?: () => SubjectLike<T>;
}

interface GroupByOptionsWithElement<K, E, T> {
  element: (value: T) => E;
  duration?: (grouped: GroupedObservable<K, E>) => ObservableInput<any>;
  connector?: () => SubjectLike<E>;
}

// новые overloads
groupBy(key, options: BasicGroupByOptions<K, T>);
groupBy(key, options: GroupByOptionsWithElement<K, E, T>);
// старые positional сохранены (deprecated)
```

Два конкретных изменения поведения/типов:

1. **Named arguments** — не нужно передавать `undefined` вторым аргументом, чтобы задать только duration/connector.
2. **`duration` принимает `ObservableInput`**, не только `Observable`: promise, array, iterable и т.д. через `innerFrom(duration(grouped))`.

```ts
import { of, groupBy, mergeMap, toArray, timer } from "rxjs";

of(
  { id: 1, name: "JavaScript" },
  { id: 2, name: "Parcel" },
  { id: 2, name: "webpack" },
  { id: 1, name: "TypeScript" },
  { id: 3, name: "TSLint" }
)
  .pipe(
    groupBy(p => p.id, {
      // раньше: groupBy(key, undefined, durationSelector)
      duration: () => timer(0), // ObservableInput — и timer, и Promise, и [...]
      element: p => p.name,
    }),
    mergeMap(group => group.pipe(toArray()))
  )
  .subscribe(console.log);
```

Старые вызовы `groupBy(key, element, duration, subjectSelector)` продолжают работать; новый код лучше писать через options. `subjectSelector` в options переименован в **`connector`** (тот же factory `() => SubjectLike`).

## Fix: `share` / `publish*` referentially transparent

В [`#6410`](https://github.com/ReactiveX/rxjs/pull/6410) / [`e2f2e51`](https://github.com/ReactiveX/rxjs/commit/e2f2e516514bdeb76229e69c639f10f21bccafad) (closes [#5411](https://github.com/ReactiveX/rxjs/issues/5411)) исправлена регрессия ~6.x: результат вызова multicast-оператора **должен** быть referentially transparent — один и тот же operator function, переданный в несколько `pipe`, не должен делить один Subject между разными source.

**Было (сломанно):** `publishReplay(n)` создавал `ReplaySubject` **сразу при вызове оператора** и замыкал его во всех последующих применениях:

```ts
// до фикса — один ReplaySubject на все pipe
return source => multicast(subject, selector)(source);
// subject = new ReplaySubject(...) создан снаружи returned function
```

**Стало:** Subject/connector создаётся **внутри** operator function, на каждый `source.pipe(...)`:

```ts
// publishReplay
return source =>
  multicast(
    new ReplaySubject(bufferSize, windowTime, timestampProvider),
    selector!
  )(source);

// publish
return selector
  ? source => connect(selector)(source)
  : source => multicast(new Subject())(source);
```

`share` обернули так, что closure с `connection` / `refCount` / `subject` живёт per application к source, а не per `share(options)` call — иначе static `pipe(share())` нельзя было безопасно переиспользовать:

```ts
import { pipe, publishReplay } from "rxjs";

const partial = pipe(publishReplay(1));

const a = source1.pipe(partial); // свой ReplaySubject
const b = source2.pipe(partial); // другой ReplaySubject, без «накопления» буфера a
```

Если кто-то **намеренно** опирался на сломанное «один Subject на все pipe» (редко), в [комментарии к PR #6410](https://github.com/ReactiveX/rxjs/pull/6410#issuecomment-846087374) есть workaround: вынести `connector`/Subject наружу явно через `share({ connector: () => sharedSubject })` или `connectable` — то есть сделать sharing осознанным, а не accidental.

Затронуты: `share`, `shareReplay`, `publish`, `publishBehavior`, `publishLast`, `publishReplay` (тесты referential transparency добавлены во все).

## Что ещё в compare

В [`7.0.1...7.1.0`](https://github.com/ReactiveX/rxjs/compare/7.0.1...7.1.0) 11 коммитов: docs (multicast deprecation, defaultIfEmpty, scan, broken links), remove googlebot noindex, test description fix, `chore(publish): 7.1.0`. Runtime/library surface релиза — четыре пункта выше.

## Миграция

```bash
npm install rxjs@7.1.0
# или
yarn add rxjs@7.1.0
```

- `Subject.observers.length` → `subject.observed` (рекомендуется).
- `share({ resetOnRefCountZero: true })` без изменений; для grace period — factory `() => timer(ms)`.
- `groupBy(key, undefined, duration)` → `groupBy(key, { duration })`.
- Переиспользование `const op = share()` / `publishReplay(1)` в нескольких `pipe` теперь безопасно и изолировано; если нужен общий subject — задайте его явно через `connector`.

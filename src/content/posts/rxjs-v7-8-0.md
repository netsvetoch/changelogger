---
author: Артём Нецветаев
pubDatetime: 2026-07-30T06:38:48.000Z
title: "RxJS 7.8.0: ObservableInput у buffer/delayWhen/sequenceEqual/share/skipUntil/window"
slug: rxjs-v7-8-0
featured: false
draft: false
tags:
  - release
  - rxjs
  - javascript
  - typescript
description: "Minor RxJS 7.8.0: closingNotifier, delayDurationSelector, compareTo, ShareConfig reset-factories, notifier и windowBoundaries принимают любой ObservableInput через innerFrom."
---

RxJS [`7.8.0`](https://github.com/ReactiveX/rxjs/compare/7.7.0...7.8.0) (тег `7.8.0`, 15 декабря 2022) — minor сразу после 7.7.0. Отдельного GitHub Release body у тега нет: контракт в [`CHANGELOG.md`](https://github.com/ReactiveX/rxjs/blob/7.8.0/CHANGELOG.md) (секция `# [7.8.0]`) и compare [`7.7.0...7.8.0`](https://github.com/ReactiveX/rxjs/compare/7.7.0...7.8.0) (7 коммитов). Весь user-facing surface — **шесть операторов**, у которых notifier / compare / factory-аргумент расширен с `Observable` до `ObservableInput` через `innerFrom`.

`ObservableInput` в RxJS — union, который `innerFrom` умеет превратить в `Observable`: сам `Observable`, interop-observable (`Symbol.observable`), `Promise`, `Array`/`ArrayLike`, `Iterable`, `AsyncIterable`, `ReadableStreamLike`. 7.7.0 уже сделал то же для `distinct` / `sample` / `repeatWhen` / `retryWhen`; 7.8.0 продолжает ту же линию consistency API.

## `buffer`: `closingNotifier` — любой `ObservableInput`

В [`src/internal/operators/buffer.ts`](https://github.com/ReactiveX/rxjs/blob/7.8.0/src/internal/operators/buffer.ts) ([#7073](https://github.com/ReactiveX/rxjs/pull/7073) / [`61b877a`](https://github.com/ReactiveX/rxjs/commit/61b877a50c2557196a45e12622305c5a84fc3f0a)):

```ts
// было
export function buffer<T>(
  closingNotifier: Observable<any>
): OperatorFunction<T, T[]>;

// стало
export function buffer<T>(
  closingNotifier: ObservableInput<any>
): OperatorFunction<T, T[]>;
```

Runtime: `innerFrom(closingNotifier).subscribe(...)` вместо `closingNotifier.subscribe(...)`. На каждый next notifier'а текущий буфер эмитится как массив, и начинается новый — семантика та же, расширился только входной тип.

```ts
import { interval, buffer, take } from "rxjs";

// как раньше — Observable-notifier
interval(100).pipe(buffer(interval(500)), take(3));

// новое: Promise как closingNotifier (один flush после resolve)
interval(3)
  .pipe(
    take(5),
    buffer(new Promise<void>(resolve => setTimeout(() => resolve(), 8)))
  )
  .subscribe(console.log);
// типичный результат: [0, 1], затем [2, 3, 4]
```

Dtslint: `buffer(Promise.resolve('foo'))` — `$ExpectType Observable<number[]>`. Runtime-тесты покрывают и resolve, и reject Promise.

Кого касается: код, который закрывает буфер по HTTP/таймеру/событию, уже имеющемуся как Promise/iterable/stream, без `from(closingNotifier)`.

## `delayWhen`: `delayDurationSelector` → `ObservableInput`

В [`src/internal/operators/delayWhen.ts`](https://github.com/ReactiveX/rxjs/blob/7.8.0/src/internal/operators/delayWhen.ts) ([#7049](https://github.com/ReactiveX/rxjs/pull/7049) / [`dfd95db`](https://github.com/ReactiveX/rxjs/commit/dfd95db952a6772d35d11bdd1974f2c4b4d68b25)):

```ts
// было
delayDurationSelector: (value: T, index: number) => Observable<any>;

// стало
delayDurationSelector: (value: T, index: number) => ObservableInput<any>;
```

Runtime: вместо прямой подписки на результат selector'а — `innerFrom(delayDurationSelector(value, index)).pipe(take(1), mapTo(value))` внутри `mergeMap`. Deprecated-параметр `subscriptionDelay` по-прежнему типизирован как `Observable<any>` (его уберут в v8).

```ts
import { interval, delayWhen, take } from "rxjs";

// duration = Promise: value эмитится после resolve
interval(1)
  .pipe(
    take(5),
    delayWhen(() => Promise.resolve(42))
  )
  .subscribe(console.log);

// per-value: reject на конкретном элементе пробрасывает error downstream
source$.pipe(
  delayWhen(x => (x === 3 ? Promise.reject(err) : Promise.resolve(0)))
);
```

Dtslint: `delayWhen(() => Promise.resolve('a'))` — `$ExpectType Observable<number>`.

Кого касается: delay по асинхронному сигналу (fetch, sleep-Promise, async iterable) без ручного `from(...)` / `from(promise)`.

## `sequenceEqual`: `compareTo` — любой `ObservableInput<T>`

В [`src/internal/operators/sequenceEqual.ts`](https://github.com/ReactiveX/rxjs/blob/7.8.0/src/internal/operators/sequenceEqual.ts) ([#7102](https://github.com/ReactiveX/rxjs/pull/7102) / [`d501961`](https://github.com/ReactiveX/rxjs/commit/d50196187710c7a0cad50703b2071fc3f2cabd3c)):

```ts
// было
export function sequenceEqual<T>(
  compareTo: Observable<T>,
  comparator?: (a: T, b: T) => boolean
): OperatorFunction<T, boolean>;

// стало
export function sequenceEqual<T>(
  compareTo: ObservableInput<T>,
  comparator?: (a: T, b: T) => boolean
): OperatorFunction<T, boolean>;
```

Подписка на вторую последовательность: `innerFrom(compareTo).subscribe(...)`. Тип элемента по-прежнему должен совпадать с source: Promise/iterable «чужого» `T` — type error.

```ts
import { of, sequenceEqual } from "rxjs";

// сравнение source с Promise (один элемент)
of(1).pipe(sequenceEqual(Promise.resolve(1))); // Observable<boolean>

// Promise с другим T — ошибка типов
of(1, 2, 3).pipe(sequenceEqual(Promise.resolve("foo"))); // $ExpectError

// iterable как compareTo
of(1, 2, 3).pipe(sequenceEqual([1, 2, 3]));
```

Кого касается: попарное сравнение последовательности с уже готовым Promise/array/stream той же формы значений.

## `share`: factory-свойства `ShareConfig` → `ObservableInput`

В [`src/internal/operators/share.ts`](https://github.com/ReactiveX/rxjs/blob/7.8.0/src/internal/operators/share.ts) ([#7093](https://github.com/ReactiveX/rxjs/pull/7093) / [`cc3995a`](https://github.com/ReactiveX/rxjs/commit/cc3995a6f6baf9456ec11f749fe89bf61b9e2d62)):

```ts
export interface ShareConfig<T> {
  connector?: () => SubjectLike<T>;
  // было: boolean | ((...) => Observable<any>)
  // стало:
  resetOnError?: boolean | ((error: any) => ObservableInput<any>);
  resetOnComplete?: boolean | (() => ObservableInput<any>);
  resetOnRefCountZero?: boolean | (() => ObservableInput<any>);
}
```

`handleReset` подписывается через `innerFrom(on(...args))` вместо `on(...args).subscribe(...)`. Boolean `true`/`false` и мгновенный reset без изменений; расширились только notifier-factory ветки — можно отложить/условно сбросить shared-состояние через Promise/iterable.

```ts
import { of, share, timer } from "rxjs";

const factory = () => Promise.resolve();

source$.pipe(
  share({
    resetOnError: factory,
    resetOnComplete: factory,
    // delayed reset после ухода последнего подписчика
    resetOnRefCountZero: () => timer(5_000),
  })
);
```

Dtslint: все три factory с `() => Promise.resolve()` — `$ExpectType Observable<number>`.

Кого касается: тонкая настройка lifetime multicasted-потока, когда reset должен ждать внешний сигнал, а не срабатывать синхронно.

## `skipUntil`: `notifier` — любой `ObservableInput`

В [`src/internal/operators/skipUntil.ts`](https://github.com/ReactiveX/rxjs/blob/7.8.0/src/internal/operators/skipUntil.ts) ([#7091](https://github.com/ReactiveX/rxjs/pull/7091) / [`60d6c40`](https://github.com/ReactiveX/rxjs/commit/60d6c40fb484903286feca2bbfa9fcb2cde720e2)):

```ts
// было
export function skipUntil<T>(
  notifier: Observable<any>
): MonoTypeOperatorFunction<T>;

// стало
export function skipUntil<T>(
  notifier: ObservableInput<any>
): MonoTypeOperatorFunction<T>;
```

Runtime уже шёл через `innerFrom(notifier)`; коммит дотягивает публичный тип и JSDoc. На первый next notifier'а оператор перестаёт скипать source; complete/error notifier'а без next — source так и не начнёт эмитить.

```ts
import { interval, skipUntil, take } from "rxjs";

interval(3)
  .pipe(
    take(5),
    skipUntil(new Promise<void>(resolve => setTimeout(() => resolve(), 8)))
  )
  .subscribe(console.log);
// типично: 2, 3, 4 (ранние тики отброшены)

// reject notifier'а — error downstream, next source не будет
source$.pipe(skipUntil(Promise.reject(err)));
```

Кого касается: «открой поток после ready-сигнала», когда ready уже Promise/fetch/stream.

## `window`: `windowBoundaries` — любой `ObservableInput`

В [`src/internal/operators/window.ts`](https://github.com/ReactiveX/rxjs/blob/7.8.0/src/internal/operators/window.ts) ([#7088](https://github.com/ReactiveX/rxjs/pull/7088) / [`8c4347c`](https://github.com/ReactiveX/rxjs/commit/8c4347c48f2432d7399c911d329fa74e0d6c6e8d)):

```ts
// было
export function window<T>(
  windowBoundaries: Observable<any>
): OperatorFunction<T, Observable<T>>;

// стало
export function window<T>(
  windowBoundaries: ObservableInput<any>
): OperatorFunction<T, Observable<T>>;
```

Подписка на границы окон: `innerFrom(windowBoundaries).subscribe(...)`. На next boundary текущее окно-`Subject` завершается, открывается новое; output — higher-order `Observable<Observable<T>>`.

```ts
import { interval, window, take, mergeMap, toArray } from "rxjs";

interval(3)
  .pipe(
    take(5),
    window(new Promise<void>(resolve => setTimeout(() => resolve(), 8))),
    mergeMap(w => w.pipe(toArray()))
  )
  .subscribe(console.log);
// типично: [0, 1], затем [2, 3, 4]
```

Dtslint: `window(Promise.resolve('foo'))` — `$ExpectType Observable<Observable<number>>`.

Кого касается: нарезка source на окна по внешнему сигналу, который удобнее передать как Promise/iterable, чем оборачивать в `from`.

## Что ещё в compare

В [`7.7.0...7.8.0`](https://github.com/ReactiveX/rxjs/compare/7.7.0...7.8.0) помимо шести feature-коммитов:

- мелкий test-speedup в `spec/operators/audit-spec.ts` (интервал 10 → 1 в Promise-тестах) — пришёл вместе с `delayWhen`;
- `chore(publish): 7.8.0`.

Breaking changes нет: widening типов + `innerFrom` на уже существующих аргументах. Старый код с `Observable` notifier/compare/factory компилируется и работает как раньше. Вместе с 7.7.0 это закрывает основную волну «notifier = только Observable» в public operator API 7.x.

## Ссылки

- Changelog: [7.8.0](https://github.com/ReactiveX/rxjs/blob/7.8.0/CHANGELOG.md)
- Compare: [7.7.0...7.8.0](https://github.com/ReactiveX/rxjs/compare/7.7.0...7.8.0)
- buffer closingNotifier: [#7073](https://github.com/ReactiveX/rxjs/pull/7073) / [61b877a](https://github.com/ReactiveX/rxjs/commit/61b877a50c2557196a45e12622305c5a84fc3f0a)
- delayWhen delayDurationSelector: [#7049](https://github.com/ReactiveX/rxjs/pull/7049) / [dfd95db](https://github.com/ReactiveX/rxjs/commit/dfd95db952a6772d35d11bdd1974f2c4b4d68b25)
- sequenceEqual compareTo: [#7102](https://github.com/ReactiveX/rxjs/pull/7102) / [d501961](https://github.com/ReactiveX/rxjs/commit/d50196187710c7a0cad50703b2071fc3f2cabd3c)
- share ShareConfig factories: [#7093](https://github.com/ReactiveX/rxjs/pull/7093) / [cc3995a](https://github.com/ReactiveX/rxjs/commit/cc3995a6f6baf9456ec11f749fe89bf61b9e2d62)
- skipUntil notifier: [#7091](https://github.com/ReactiveX/rxjs/pull/7091) / [60d6c40](https://github.com/ReactiveX/rxjs/commit/60d6c40fb484903286feca2bbfa9fcb2cde720e2)
- window windowBoundaries: [#7088](https://github.com/ReactiveX/rxjs/pull/7088) / [8c4347c](https://github.com/ReactiveX/rxjs/commit/8c4347c48f2432d7399c911d329fa74e0d6c6e8d)

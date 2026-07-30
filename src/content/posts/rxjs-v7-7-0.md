---
author: Артём Нецветаев
pubDatetime: 2026-07-30T06:22:38.000Z
title: "RxJS 7.7.0: ObservableInput у distinct/sample/repeatWhen/retryWhen"
slug: rxjs-v7-7-0
featured: false
draft: false
tags:
  - release
  - rxjs
  - javascript
  - typescript
description: "Minor RxJS 7.7.0: flushes у distinct и notifier у sample/repeatWhen/retryWhen принимают любой ObservableInput (Promise, iterable, ReadableStream) через innerFrom."
---

RxJS [`7.7.0`](https://github.com/ReactiveX/rxjs/compare/7.6.0...7.7.0) (тег `7.7.0`, 15 декабря 2022) — minor после 7.6.0. Отдельного GitHub Release body у тега нет: контракт в [`CHANGELOG.md`](https://github.com/ReactiveX/rxjs/blob/7.7.0/CHANGELOG.md) (секция `# [7.7.0]`) и compare [`7.6.0...7.7.0`](https://github.com/ReactiveX/rxjs/compare/7.6.0...7.7.0) (8 коммитов). Весь user-facing surface — **четыре оператора**, у которых аргумент-«нотификатор» расширен с `Observable` до `ObservableInput` через `innerFrom`.

`ObservableInput` в RxJS — это union, который `innerFrom` умеет превратить в `Observable`: сам `Observable`, interop-observable (`Symbol.observable`), `Promise`, `Array`/`ArrayLike`, `Iterable`, `AsyncIterable`, `ReadableStreamLike`. До 7.7.0 эти четыре места в API ещё требовали именно `Observable` (или возвращали `Observable` из factory).

## `distinct`: `flushes` — любой `ObservableInput`

В [`src/internal/operators/distinct.ts`](https://github.com/ReactiveX/rxjs/blob/7.7.0/src/internal/operators/distinct.ts) ([#7081](https://github.com/ReactiveX/rxjs/pull/7081) / [`74c9ebd`](https://github.com/ReactiveX/rxjs/commit/74c9ebd818113f9f25f1fb2b9fee4a0eac121ae0)):

```ts
// было
export function distinct<T, K>(
  keySelector?: (value: T) => K,
  flushes?: Observable<any>
): MonoTypeOperatorFunction<T>;

// стало
export function distinct<T, K>(
  keySelector?: (value: T) => K,
  flushes?: ObservableInput<any>
): MonoTypeOperatorFunction<T>;
```

Runtime: подписка на flusher идёт через `innerFrom(flushes)` вместо `flushes?.subscribe(...)`. На каждый next flusher'а очищается внутренний `Set` ключей — семантика та же, расширился только входной тип.

```ts
import { of, distinct, interval } from "rxjs";
import { take } from "rxjs/operators";

// как раньше — Observable flush
of(1, 1, 2, 1, 3)
  .pipe(distinct(undefined, interval(1000).pipe(take(1))))
  .subscribe(console.log);

// новое: Promise как flush (один clear после resolve)
of("a", "a", "b").pipe(distinct(x => x, Promise.resolve("flush")));

// array-like / iterable — тоже ObservableInput
of(1, 1, 2).pipe(distinct(n => n, [0]));
```

Dtslint в `spec-dtslint/operators/distinct-spec.ts` покрывает interop observable, array-like, Promise, async/sync iterable, `ReadableStream` и `$ExpectError` на `{}`.

Кого касается: код, который сбрасывает окно уникальности `distinct` по таймеру/событию и хочет передать Promise/iterable без обёртки `from(...)`.

## `sample`: `notifier` — любой `ObservableInput`

В [`src/internal/operators/sample.ts`](https://github.com/ReactiveX/rxjs/blob/7.7.0/src/internal/operators/sample.ts) ([#7104](https://github.com/ReactiveX/rxjs/pull/7104) / [`b18c2eb`](https://github.com/ReactiveX/rxjs/commit/b18c2eb2bc8dc1a717c927f998028316eec83937)):

```ts
// было
export function sample<T>(
  notifier: Observable<any>
): MonoTypeOperatorFunction<T>;

// стало
export function sample<T>(
  notifier: ObservableInput<any>
): MonoTypeOperatorFunction<T>;
```

Подписка: `innerFrom(notifier).subscribe(...)`. На next notifier'а эмитится последнее значение source с момента предыдущего sample (если оно было).

```ts
import { fromEvent, sample } from "rxjs";

// sample по Promise — один снимок после resolve
clicks$.pipe(sample(fetch("/ready").then(() => "ok")));

// sample по ReadableStream chunk'ам
const stream = new ReadableStream({
  start(c) {
    c.enqueue("tick");
    c.close();
  },
});
source$.pipe(sample(stream));
```

Кого касается: sampling по внешнему сигналу, который уже есть как Promise/stream/iterable, без `from(notifier)`.

## `repeatWhen` / `retryWhen`: return type `notifier` → `ObservableInput`

Оба оператора **deprecated** (removal в v9/v10; миграция — `repeat({ delay })` / `retry({ delay })` из 7.5 / 7.3), но сигнатуры notifier factory всё равно расширили для consistency с остальным API.

### `repeatWhen` — [#7103](https://github.com/ReactiveX/rxjs/pull/7103) / [`8f1b976`](https://github.com/ReactiveX/rxjs/commit/8f1b976125c55a5e884317c2b463fd019662e6af)

```ts
// было
notifier: (notifications: Observable<void>) => Observable<any>;

// стало
notifier: (notifications: Observable<void>) => ObservableInput<any>;
```

Внутри: `innerFrom(notifier(completions$)).subscribe(...)`. В JSDoc добавлен явный migration hint:

```ts
// deprecated path
source$.pipe(repeatWhen(() => notify$));

// recommended
source$.pipe(repeat({ delay: () => notify$ }));
```

Заодно из root и `rxjs/operators` реэкспортирован тип **`RepeatConfig`** (раньше был только runtime `repeat`):

```ts
export { repeat, RepeatConfig } from "./internal/operators/repeat";
```

### `retryWhen` — [#7105](https://github.com/ReactiveX/rxjs/pull/7105) / [`794f806`](https://github.com/ReactiveX/rxjs/commit/794f8064cf8fe754e9dfebeee0ffef0ac1562252)

```ts
// было
notifier: (errors: Observable<any>) => Observable<any>;

// стало
notifier: (errors: Observable<any>) => ObservableInput<any>;
```

Аналогично: `innerFrom(notifier(errors$))`. Migration:

```ts
// deprecated
source$.pipe(retryWhen(() => notify$));

// recommended
source$.pipe(retry({ delay: () => notify$ }));
```

Dtslint для обоих: Promise, interop observable, iterable/async iterable, ReadableStream; `$ExpectError` на `number`; `$ExpectDeprecation` на сам вызов оператора.

```ts
import { of, repeatWhen, retryWhen } from "rxjs";

// notifier может вернуть Promise — resubscribe после resolve
of(1).pipe(repeatWhen(() => Promise.resolve(true)));

// errors-stream по-прежнему приходит как Observable;
// вернуть из factory можно любой ObservableInput
flaky$.pipe(retryWhen(errors$ => Promise.resolve("retry-once")));
```

Кого касается: legacy-код на `repeatWhen`/`retryWhen`, которому удобнее вернуть Promise/iterable из factory; для нового кода — `repeat`/`retry` с `delay`.

## Что ещё в compare

В [`7.6.0...7.7.0`](https://github.com/ReactiveX/rxjs/compare/7.6.0...7.7.0) помимо четырёх feature-коммитов:

- [`5df07eb`](https://github.com/ReactiveX/rxjs/commit/5df07eb) / [#7128](https://github.com/ReactiveX/rxjs/pull/7128): удалён **ts-api-guardian** и каталог `api_guard/dist/types/*.d.ts` — tooling/CI, не public runtime API.
- `chore(publish): 7.7.0`.

Breaking changes нет: все изменения — widening типов + `innerFrom` на уже существующих аргументах. Старый код с `Observable` notifier/flushes компилируется и работает как раньше.

## Ссылки

- Changelog: [7.7.0](https://github.com/ReactiveX/rxjs/blob/7.7.0/CHANGELOG.md)
- Compare: [7.6.0...7.7.0](https://github.com/ReactiveX/rxjs/compare/7.6.0...7.7.0)
- distinct flushes: [#7081](https://github.com/ReactiveX/rxjs/pull/7081) / [74c9ebd](https://github.com/ReactiveX/rxjs/commit/74c9ebd818113f9f25f1fb2b9fee4a0eac121ae0)
- sample notifier: [#7104](https://github.com/ReactiveX/rxjs/pull/7104) / [b18c2eb](https://github.com/ReactiveX/rxjs/commit/b18c2eb2bc8dc1a717c927f998028316eec83937)
- repeatWhen notifier: [#7103](https://github.com/ReactiveX/rxjs/pull/7103) / [8f1b976](https://github.com/ReactiveX/rxjs/commit/8f1b976125c55a5e884317c2b463fd019662e6af)
- retryWhen notifier: [#7105](https://github.com/ReactiveX/rxjs/pull/7105) / [794f806](https://github.com/ReactiveX/rxjs/commit/794f8064cf8fe754e9dfebeee0ffef0ac1562252)

---
author: Артём Нецветаев
pubDatetime: 2026-07-30T06:06:51.000Z
title: "RxJS 7.6.0: onErrorResumeNextWith, union-overloads subscribe/tap, TimerHandle без @types/node"
slug: rxjs-v7-6-0
featured: false
draft: false
tags:
  - release
  - rxjs
  - javascript
  - typescript
description: "Minor RxJS 7.6.0: оператор onErrorResumeNextWith на top-level (старый onErrorResumeNext deprecated), union-overloads для subscribe/tap, TimerHandle = ReturnType<typeof setTimeout>."
---

RxJS [`7.6.0`](https://github.com/ReactiveX/rxjs/compare/7.5.7...7.6.0) (тег `7.6.0`, 3 декабря 2022) — minor после серии 7.5.x. Отдельного GitHub Release body у тега нет: контракт в [`CHANGELOG.md`](https://github.com/ReactiveX/rxjs/blob/7.6.0/CHANGELOG.md) (секция `# [7.6.0]`) и compare [`7.5.7...7.6.0`](https://github.com/ReactiveX/rxjs/compare/7.5.7...7.6.0) (11 коммитов). User-facing surface: rename/export оператора **`onErrorResumeNextWith`**, type fix **`subscribe`/`tap` overloads**, type fix **`TimerHandle`** без `@types/node`.

## `onErrorResumeNextWith`: rename оператора + top-level export

До 7.6.0 creation function `onErrorResumeNext(...)` жила на top-level `'rxjs'`, а pipeable-оператор с тем же именем — только из `'rxjs/operators'` / internal path, **не** реэкспортировался из root `src/index.ts`. Это ломало схему «все `*With` операторы с top-level `rxjs`», уже принятую для `combineLatestWith` / `concatWith` / `mergeWith` / `raceWith` / `zipWith`.

В [`#6755`](https://github.com/ReactiveX/rxjs/pull/6755) / [`51e3b2c`](https://github.com/ReactiveX/rxjs/commit/51e3b2c8ec28b5d30bca4c63ad69ce6942c2cdcc):

1. Файл оператора переименован: `src/internal/operators/onErrorResumeNext.ts` → `onErrorResumeNextWith.ts`.
2. Pipeable API: `onErrorResumeNextWith(...sources)` / `onErrorResumeNextWith(sources)`.
3. Новый export в [`src/index.ts`](https://github.com/ReactiveX/rxjs/blob/7.6.0/src/index.ts):
   ```ts
   export { onErrorResumeNextWith } from "./internal/operators/onErrorResumeNextWith";
   ```
4. Старое имя оператора оставлено как deprecated alias:
   ```ts
   /**
    * @deprecated Renamed. Use {@link onErrorResumeNextWith} instead. Will be removed in v8.
    */
   export const onErrorResumeNext = onErrorResumeNextWith;
   ```
   (из `rxjs/operators` alias всё ещё доступен до v8.)
5. Creation function `onErrorResumeNext` **не** переименована — имя creation vs `*With` operator, как у остальных пар.
6. Реализацию оператора свели к creation function: `(source) => oERNCreate(source, ...nextSources)`; logic подписки/error-skip вынесли в `src/internal/observable/onErrorResumeNext.ts` (раньше creation делегировал в operator от `EMPTY`).

Семантика прежняя: при error текущего source подписка переключается на следующий ObservableInput, errors «глотаются», complete — когда цепочка исчерпана.

```ts
import { of, throwError, onErrorResumeNextWith } from "rxjs";

// pipeable, top-level — то, чего не хватало до 7.6.0
of(1, 2)
  .pipe(
    // если source упадёт — продолжим с fallback'ов
    onErrorResumeNextWith(
      throwError(() => "x"),
      of(3, 4)
    )
  )
  .subscribe(console.log);
// 1, 2, 3, 4  (error "x" проглочен)

// creation function — имя без With, как раньше
import { onErrorResumeNext } from "rxjs";

onErrorResumeNext(
  throwError(() => new Error("a")),
  of("recovered")
).subscribe(console.log);
// "recovered"
```

Миграция pipeable-кода:

```ts
// было (rxjs/operators, имя совпадало с creation)
import { onErrorResumeNext } from "rxjs/operators";
source.pipe(onErrorResumeNext(fallback$));

// стало (top-level, suffix With)
import { onErrorResumeNextWith } from "rxjs";
source.pipe(onErrorResumeNextWith(fallback$));
```

В guide `importing.md` таблица deprecated→`*With` дополнена строкой `onErrorResumeNext` → `onErrorResumeNextWith`; `partition` (operator) отдельно помечен deprecated в пользу creation `partition` из `'rxjs'`.

Кого касается: любой `pipe(onErrorResumeNext(...))` и импорты из `rxjs/operators` — alias работает, но deprecation → v8 removal; новые импорты — `onErrorResumeNextWith` с top-level.

## `subscribe` / `tap`: один union-overload вместо двух

Runtime не менялся — pure TypeScript. Раньше в [`Observable.ts`](https://github.com/ReactiveX/rxjs/blob/7.6.0/src/internal/Observable.ts) и [`tap.ts`](https://github.com/ReactiveX/rxjs/blob/7.6.0/src/internal/operators/tap.ts) были **два** overload'а с одним аргументом:

```ts
// было
subscribe(observer?: Partial<Observer<T>>): Subscription;
subscribe(next: (value: T) => void): Subscription;
// + deprecated 3-arg form
```

TypeScript при передаче union `Partial<Observer<T>> | ((value: T) => void)` **не** сопоставлял его ни с одним overload'ом (классическая ловушка «prefer union params over split overloads» из TS handbook). Issue [`#6717`](https://github.com/ReactiveX/rxjs/issues/6717):

```ts
function handleObservableOrNext<T>(
  observable: Observable<T>,
  observerOrNext?: Partial<Observer<T>> | ((value: T) => void)
) {
  observable.subscribe(observerOrNext); // TS error до 7.6.0
}
```

[`#6718`](https://github.com/ReactiveX/rxjs/pull/6718) / [`af1a9f4`](https://github.com/ReactiveX/rxjs/commit/af1a9f446a860883abaa36ace21345dc923e7e53) слили overload'и:

```ts
// стало
subscribe(
  observerOrNext?: Partial<Observer<T>> | ((value: T) => void)
): Subscription;
/** @deprecated separate callback args → remove in v8 */
subscribe(
  next?: ((value: T) => void) | null,
  error?: ((error: any) => void) | null,
  complete?: (() => void) | null
): Subscription;

// tap — зеркально
tap(
  observerOrNext?: Partial<TapObserver<T>> | ((value: T) => void)
): MonoTypeOperatorFunction<T>;
```

Кого касается: generic-обёртки, где `next` callback и partial observer прокидываются одним параметром (`subscribe` / `tap` / свои helpers поверх RxJS). Вызовы `obs.subscribe(x => ...)` и `obs.subscribe({ next, error })` как раньше.

## `TimerHandle`: без `@types/node`

В [`src/internal/scheduler/timerHandle.ts`](https://github.com/ReactiveX/rxjs/blob/7.6.0/src/internal/scheduler/timerHandle.ts) тип handle таймера ссылался на `NodeJS.Timeout`:

```ts
// было
export type TimerHandle = number | NodeJS.Timeout;

// стало (c1a07b7)
export type TimerHandle = number | ReturnType<typeof setTimeout>;
```

[`c1a07b7`](https://github.com/ReactiveX/rxjs/commit/c1a07b71ac050ab36b371ff7f18dc9a924fffc9f): `NodeJS.Timeout` тянет `@types/node`. В browser/DOM-only / library tsconfig **без** Node types сборка падала на public/internal scheduler types. `ReturnType<typeof setTimeout>` даёт тот же union (в DOM — `number`, в `@types/node` — `NodeJS.Timeout`) без hard dependency на Node typings.

Кого касается: TS-проекты, которые импортируют RxJS schedulers и **не** ставят `@types/node` (фронт, Deno-like, strict lib-only).

## Что ещё в compare (не в changelog features/fixes)

В [`7.5.7...7.6.0`](https://github.com/ReactiveX/rxjs/compare/7.5.7...7.6.0) дополнительно:

- [`b97fa05`](https://github.com/ReactiveX/rxjs/commit/b97fa05b633d28e0b183c320e41b5ff9de0762da) / [#6545](https://github.com/ReactiveX/rxjs/pull/6545): export `observable` (`Symbol.observable` / `@@observable`) помечен `@deprecated` — в будущих версиях уберут; polyfill `Symbol.observable` или пакет [`symbol-observable`](https://www.npmjs.com/package/symbol-observable).
- CI: Node versions в workflows обновлены до актуальных на момент релиза (`#7127`).
- Docs typos (glossary, operators, ReplaySubject JSDoc).

Runtime behavior creation/`pipe` operators кроме rename alias не ломался; deprecations — prep к v8 surface cleanup.

## Ссылки

- Changelog: [7.6.0](https://github.com/ReactiveX/rxjs/blob/7.6.0/CHANGELOG.md)
- Compare: [7.5.7...7.6.0](https://github.com/ReactiveX/rxjs/compare/7.5.7...7.6.0)
- onErrorResumeNextWith: [#6755](https://github.com/ReactiveX/rxjs/pull/6755) / [51e3b2c](https://github.com/ReactiveX/rxjs/commit/51e3b2c8ec28b5d30bca4c63ad69ce6942c2cdcc)
- subscribe/tap overloads: [#6718](https://github.com/ReactiveX/rxjs/pull/6718) / [#6717](https://github.com/ReactiveX/rxjs/issues/6717) / [af1a9f4](https://github.com/ReactiveX/rxjs/commit/af1a9f446a860883abaa36ace21345dc923e7e53)
- TimerHandle / schedulers types: [c1a07b7](https://github.com/ReactiveX/rxjs/commit/c1a07b71ac050ab36b371ff7f18dc9a924fffc9f)
- deprecate `observable` symbol: [#6545](https://github.com/ReactiveX/rxjs/pull/6545) / [b97fa05](https://github.com/ReactiveX/rxjs/commit/b97fa05b633d28e0b183c320e41b5ff9de0762da)

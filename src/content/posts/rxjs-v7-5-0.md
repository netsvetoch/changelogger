---
author: Артём Нецветаев
pubDatetime: 2026-07-30T05:51:01.000Z
title: "RxJS 7.5.0: repeat с delay, типы takeWhile(Boolean), фиксы forEach/WebSocket/schedulers"
slug: rxjs-v7-5-0
featured: false
draft: false
tags:
  - release
  - rxjs
  - javascript
  - typescript
description: "Minor RxJS 7.5.0: RepeatConfig.count/delay у repeat (как у retry), TruthyTypesOf для takeWhile(Boolean), unsubscribe в forEach после throw в next, slow WebSocket close, flush schedulers, tslib ^2.1.0."
---

RxJS [`7.5.0`](https://github.com/ReactiveX/rxjs/compare/7.4.0...7.5.0) (тег `7.5.0`, 27 декабря 2021) — minor после 7.4.0. Отдельного GitHub Release body у тега нет: контракт в [`CHANGELOG.md`](https://github.com/ReactiveX/rxjs/blob/7.5.0/CHANGELOG.md) (секция `# [7.5.0]`) и compare [`7.4.0...7.5.0`](https://github.com/ReactiveX/rxjs/compare/7.4.0...7.5.0) (34 коммита). Единственный user-facing feature — **`repeat` с configurable `delay`** (паритет с `retry` из 7.3.0); остальное — type fix `takeWhile(Boolean)`, поведение `forEach`/WebSocketSubject/schedulers и диапазон зависимости `tslib`.

## `repeat`: `RepeatConfig` с `count` и `delay`

До 7.5.0 сигнатура была `repeat(count?: number)`: после complete source resubscribe'ился сразу, без паузы. Задержку и backoff обычно собирали через `repeatWhen` + `delay`/`timer`. В [`#6640`](https://github.com/ReactiveX/rxjs/pull/6640) / [`6b7a534`](https://github.com/ReactiveX/rxjs/commit/6b7a534f579f95f97f47eff74bdea9991ee85712) в [`src/internal/operators/repeat.ts`](https://github.com/ReactiveX/rxjs/blob/7.5.0/src/internal/operators/repeat.ts) API выровняли с `retry`:

```ts
export interface RepeatConfig {
  /** Сколько раз подписаться на source; default Infinity. */
  count?: number;
  /**
   * Число миллисекунд ИЛИ функция (count) => ObservableInput.
   * count — сколько раз source уже был подписан (начинается с 1).
   * Notifier: первый next → resubscribe; empty notifier → complete результата;
   * throw из delay-функции / error notifier'а → error downstream.
   */
  delay?: number | ((count: number) => ObservableInput<any>);
}

export function repeat<T>(
  countOrConfig?: number | RepeatConfig
): MonoTypeOperatorFunction<T>;
```

Позиционный `repeat(n)` и `repeat()` без аргументов сохранены (не breaking). Object-form: `count` optional с default `Infinity`.

Простой repeat три раза с паузой 1 с:

```ts
import { of, repeat } from "rxjs";

of("tick").pipe(
  repeat({
    count: 3,
    delay: 1000,
  })
);
```

`repeat({ delay: 200 })` без `count` — бесконечный цикл с паузой 200 ms между complete и следующей подпиской. Exponential step-back через notifier (`count` в callback — 1, 2, 3…):

```ts
import { defer, of, repeat, timer } from "rxjs";

const source = defer(() => of(`Hello, it is ${new Date()}`));

source.pipe(
  repeat({
    count: 3,
    delay: 1000,
  }),
  // затем бесконечно, с растущей паузой (как в JSDoc релиза)
  repeat({
    delay: count => timer(Math.min(60_000, 2 ** count * 1000)),
  })
);
```

Семантика (по `spec/operators/repeat-spec.ts` и реализации):

- `delay: number` → внутри `timer(delay)`;
- `delay: (count) => ObservableInput` → `innerFrom(...)`; первый next снимает notifier и снова подписывает source;
- throw из `delay`-функции → error downstream (тест `should handle delay function throwing`);
- как и раньше, `repeat` **не** ловит errors source — для ошибок нужен `retry`;
- `repeat(0)` / `count <= 0` → `EMPTY`; `repeat()` / без delay → немедленный resubscribe forever.

Это закрывает типичные «poll until take/takeUntil» и «restart after complete with backoff» без отдельного `repeatWhen`-loop.

## `takeWhile(Boolean)`: типы через `TruthyTypesOf`

Runtime `takeWhile(Boolean)` не менялся — чистый type fix. Раньше overload с `BooleanConstructor` отдавал `Exclude<T, Falsy> extends never ? never : T`, из‑за чего при union с truthy-членом TypeScript **не сужал** поток до truthy-типа. [`#6633`](https://github.com/ReactiveX/rxjs/issues/6633) / [`081ca2b`](https://github.com/ReactiveX/rxjs/commit/081ca2ba7290aa3084c1477a6d4bcc573bf478f6) в [`takeWhile.ts`](https://github.com/ReactiveX/rxjs/blob/7.5.0/src/internal/operators/takeWhile.ts):

```ts
// было (упрощённо):
// takeWhile(Boolean) → OperatorFunction<T, Exclude<T, Falsy> extends never ? never : T>
// стало:
export function takeWhile<T>(
  predicate: BooleanConstructor
): OperatorFunction<T, TruthyTypesOf<T>>;
export function takeWhile<T>(
  predicate: BooleanConstructor,
  inclusive: false
): OperatorFunction<T, TruthyTypesOf<T>>;
export function takeWhile<T>(
  predicate: BooleanConstructor,
  inclusive: true
): MonoTypeOperatorFunction<T>;
```

dtslint (`spec-dtslint/operators/takeWhile-spec.ts`):

```ts
// mix falsy + "hi"
of(false as const, 0 as const, "hi" as const, null, undefined).pipe(
  takeWhile(Boolean)
); // Observable<"hi">  — было шире / без proper narrow

of(false as const, 0 as const, "hi" as const, null, undefined).pipe(
  takeWhile(Boolean, true)
); // Observable<false | "" | 0 | ... | "hi" | null | undefined> — inclusive, без narrow
```

Кого касается: пайплайны вида `source.pipe(takeWhile(Boolean), map(s => s.length))` — после 7.5.0 `s` уже truthy-тип, а не весь исходный union.

## `forEach`: unsubscribe после throw в `next`

`Observable.prototype.forEach(next)` оборачивает подписку в Promise. Если `next(value)` бросал, Promise reject'ился, но отписка от source могла не сработать вовремя: при синхронном producer'е после throw всё ещё доходили последующие `next`. [`#6677`](https://github.com/ReactiveX/rxjs/pull/6677) / [`b9ab67d`](https://github.com/ReactiveX/rxjs/commit/b9ab67d21ca9d227fcd1123bf80ab87ca9296af9) (closes [#6676](https://github.com/ReactiveX/rxjs/issues/6676)) в [`Observable.ts`](https://github.com/ReactiveX/rxjs/blob/7.5.0/src/internal/Observable.ts) перевели путь на `SafeSubscriber` и явный `subscriber.unsubscribe()` в `catch` вокруг `next`:

```ts
// суть фикса (упрощённо)
const subscriber = new SafeSubscriber<T>({
  next: value => {
    try {
      next(value);
    } catch (err) {
      reject(err);
      subscriber.unsubscribe();
    }
  },
  error: reject,
  complete: resolve,
});
this.subscribe(subscriber);
```

Тест в `spec/Observable-spec.ts`: после throw на value `3` в results больше **нет** `4` — source отписан. Кого касается: любой `await source.forEach(...)` / promise-style consume, где handler может бросить.

## `WebSocketSubject`: медленный `close`

`WebSocket.close()` не всегда сразу даёт `onclose`: сокет сначала уходит в `CLOSING`. Если за это время открывали **новый** socket на том же `WebSocketSubject`, старый `onclose` вызывал `_resetState()` и сбрасывал уже актуальный `_socket`. [`#6708`](https://github.com/ReactiveX/rxjs/pull/6708) / [`8cb201c`](https://github.com/ReactiveX/rxjs/commit/8cb201cd42dd751b4185b94fe2d36c6bfda02fe2) (closes [#4650](https://github.com/ReactiveX/rxjs/issues/4650), [#3935](https://github.com/ReactiveX/rxjs/issues/3935)) в [`WebSocketSubject.ts`](https://github.com/ReactiveX/rxjs/blob/7.5.0/src/internal/observable/dom/WebSocketSubject.ts):

```ts
socket.onclose = (e: CloseEvent) => {
  if (socket === this._socket) {
    this._resetState();
  }
  // closeObserver.next(e) — как раньше
};
```

Тест: unsubscribe → socket1 `CLOSING` → subscribe снова → socket2 `OPEN` → `socket1.triggerClose` **не** трогает socket2; unsubscribe socket2 закрывает уже его. Mock WebSocket в спеках больше не форсит `CLOSED` синхронно из `close()` — отражает реальное `CLOSING` → later `close` event.

## Schedulers: reschedule / unsubscribe во время `flush`

У `asapScheduler` и `animationFrameScheduler` старый `flush` брал `count = actions.length` и крутил цикл по счётчику. Если внутри action'а schedule'или новое действие **или** unsubscribe'или соседа, очередь сдвигалась: action, предназначенный для **следующего** flush, мог выполниться в текущем, либо recycle async id ошибочно отменял/не отменял frame/microtask. [`e35f589`](https://github.com/ReactiveX/rxjs/commit/e35f589e2ca10ab2d2d69f7e9fe60727edc4c53d) (closes [#6672](https://github.com/ReactiveX/rxjs/issues/6672)) в `AsapScheduler` / `AnimationFrameScheduler` + `AsapAction` / `AnimationFrameAction`:

- flush запоминает `flushId = this._scheduled` и снимает только actions с `action.id === flushId`;
- actions, запланированные _во время_ flush, получают другой id и ждут следующего flush;
- `recycleAsyncId` отменяет frame/immediate, только если в очереди **не осталось** actions с тем же `id` (а не «очередь пуста»).

Кого касается: код, который из asap/animationFrame action'а снова `schedule`'ит или отменяет соседние actions (вложенные UI/microtask цепочки). `asyncScheduler` в этом коммите не трогали.

## `tslib`: `^2.1.0` вместо `~2.1.0`

[`#6692`](https://github.com/ReactiveX/rxjs/pull/6692) / [`0b2495f`](https://github.com/ReactiveX/rxjs/commit/0b2495f72e76627fdd19dd7a670dd74847d6449c) (closes [#6689](https://github.com/ReactiveX/rxjs/issues/6689)): в root `package.json` dependency `"tslib": "~2.1.0"` → `"tslib": "^2.1.0"`. Peers/apps на tslib 2.2+ / 2.x больше не упираются в узкий tilde-range 2.1.x. Runtime helpers RxJS от этого не менялись — только допустимый диапазон версии.

## Что ещё в compare

В [`7.4.0...7.5.0`](https://github.com/ReactiveX/rxjs/compare/7.4.0...7.5.0) помимо changelog: docs_app (Angular 12, guide importing, marble SVG для audit/debounce/throttle), перевод части operator-spec на TestScheduler `run` mode (`repeat`, `reduce`, `refCount`), правки issue templates, dependency bumps в docs_app. User-facing surface — feature `repeat` config, type fix `takeWhile(Boolean)`, fixes `forEach` / `WebSocketSubject` / asap+animationFrame schedulers, `tslib` range.

## Ссылки

- Changelog: [7.5.0](https://github.com/ReactiveX/rxjs/blob/7.5.0/CHANGELOG.md)
- Compare: [7.4.0...7.5.0](https://github.com/ReactiveX/rxjs/compare/7.4.0...7.5.0)
- repeat delay: [#6640](https://github.com/ReactiveX/rxjs/pull/6640)
- takeWhile Boolean types: [#6633](https://github.com/ReactiveX/rxjs/issues/6633)
- forEach unsubscribe: [#6677](https://github.com/ReactiveX/rxjs/pull/6677) / [#6676](https://github.com/ReactiveX/rxjs/issues/6676)
- WebSocketSubject slow close: [#6708](https://github.com/ReactiveX/rxjs/pull/6708)
- schedulers flush: [e35f589](https://github.com/ReactiveX/rxjs/commit/e35f589e2ca10ab2d2d69f7e9fe60727edc4c53d) / [#6672](https://github.com/ReactiveX/rxjs/issues/6672)
- tslib range: [#6692](https://github.com/ReactiveX/rxjs/pull/6692)

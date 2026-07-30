---
author: Артём Нецветаев
pubDatetime: 2026-07-30T05:19:10.000Z
title: "RxJS 7.3.0: retry с delay, lifecycle-handlers в tap, тип Connectable"
slug: rxjs-v7-3-0
featured: false
draft: false
tags:
  - release
  - rxjs
  - javascript
  - typescript
description: "Minor RxJS 7.3.0: RetryConfig.delay (число или notifier-функция), TapObserver с subscribe/unsubscribe/finalize, публичный тип Connectable, fix AsyncSubject при reentrant subscribe."
---

RxJS [`7.3.0`](https://github.com/ReactiveX/rxjs/compare/7.2.0...7.3.0) (тег `7.3.0`, 28 июля 2021) — minor после 7.2.0. Отдельного GitHub Release body у тега нет: контракт в [`CHANGELOG.md`](https://github.com/ReactiveX/rxjs/blob/7.3.0/CHANGELOG.md) (секция `# [7.3.0]`) и compare [`7.2.0...7.3.0`](https://github.com/ReactiveX/rxjs/compare/7.2.0...7.3.0) (15 коммитов). Два user-facing feature — **`retry({ delay })`** и **lifecycle-handlers у `tap`**; плюс экспорт типа **`Connectable`** и фикс **`AsyncSubject`** при reentrant-подписке.

## `retry`: configurable `delay` в `RetryConfig`

До 7.3.0 конфиг-overload `retry(config)` принимал в основном `count` и `resetOnSuccess`. Задержки и backoff обычно собирали через `retryWhen` + `delay`/`timer`. В [`#6421`](https://github.com/ReactiveX/rxjs/pull/6421) / [`5f69795`](https://github.com/ReactiveX/rxjs/commit/5f69795f4be035499cf223bf9a3d7352c4975291) в [`src/internal/operators/retry.ts`](https://github.com/ReactiveX/rxjs/blob/7.3.0/src/internal/operators/retry.ts) расширили `RetryConfig`:

```ts
export interface RetryConfig {
  /** Максимум попыток resubscribe; default Infinity, если не задан. */
  count?: number;
  /**
   * Число миллисекунд ИЛИ функция (error, retryCount) => ObservableInput.
   * Notifier: первый next → resubscribe; complete без emit → complete результата;
   * error notifier'а / throw из функции → error downstream.
   */
  delay?: number | ((error: any, retryCount: number) => ObservableInput<any>);
  resetOnSuccess?: boolean;
}
```

Позиционный `retry(count?: number)` и object-form сохранены (не breaking). При object-form `count` стал optional с default `Infinity`.

Простой retry каждые 5 секунд, максимум 100 раз:

```ts
import { retry } from "rxjs";

source.pipe(
  retry({
    count: 100,
    delay: 5000,
  })
);
```

`delay: 0` или отрицательное число ведут себя как обычный немедленный retry (без таймера). Exponential backoff через notifier-функцию (`retryCount` начинается с 1):

```ts
import { retry, timer } from "rxjs";

source.pipe(
  retry({
    count: 100,
    delay: (_err, retryCount) =>
      timer(Math.min(60_000, 1000 * 2 ** retryCount)),
  })
);
```

Семантика notifier'а (по тестам в `spec/operators/retry-spec.ts`):

- `delay: number` → внутри `timer(delay)`;
- `delay: (err, retryCount) => ObservableInput` → `innerFrom(...)`; первый next снимает notifier и resubscribe'ит source;
- complete notifier без next → downstream **complete** (не error);
- error notifier'а или throw из `delay`-функции → error downstream.

Это покрывает типичные сценарии, ради которых тянули `retryWhen`, без отдельного «retry-loop» observable. Старый `retry(n)` / `retry({ count, resetOnSuccess })` без `delay` работает как раньше.

## `tap`: `subscribe` / `unsubscribe` / `finalize`

В [`#6527`](https://github.com/ReactiveX/rxjs/pull/6527) / [`eb26cbc`](https://github.com/ReactiveX/rxjs/commit/eb26cbc4488c9953cdde565b598b1dbdeeeee9ea) object-form `tap` принимает не `Partial<Observer<T>>`, а `Partial<TapObserver<T>>`:

```ts
export interface TapObserver<T> extends Observer<T> {
  subscribe: () => void;
  unsubscribe: () => void;
  finalize: () => void;
}
```

Поведение (из PR и `spec/operators/tap-spec.ts`):

| Handler                       | Когда вызывается                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `subscribe`                   | сразу при подписке на source (до next)                                               |
| `next` / `error` / `complete` | как у обычного Observer                                                              |
| `unsubscribe`                 | только при **явном** `subscription.unsubscribe()`, **не** если source complete/error |
| `finalize`                    | всегда при финализации (аналог оператора `finalize`)                                 |

```ts
import { Subject, tap } from "rxjs";

const subject = new Subject<number>();

const sub = subject
  .pipe(
    tap({
      subscribe: () => console.log("subscribed"),
      next: v => console.log("next", v),
      complete: () => console.log("complete"),
      unsubscribe: () => console.log("unsubbed"),
      finalize: () => console.log("finalize"),
    })
  )
  .subscribe();

// logs: subscribed
subject.next(1);
sub.unsubscribe();
// logs: unsubbed, finalize

// если вместо unsubscribe сделать subject.complete():
// logs: complete, finalize  — без unsubscribe
```

Реализация в [`tap.ts`](https://github.com/ReactiveX/rxjs/blob/7.3.0/src/internal/operators/tap.ts): флаг `isUnsub` сбрасывается на `complete`/`error`; teardown OperatorSubscriber вызывает `unsubscribe` только если флаг ещё true, затем всегда `finalize`. Полезно, когда нужно отличить «consumer сам отписался» от нормального завершения (логирование, метрики, cleanup UI-подписок). Positional `tap(next, error, complete)` по-прежнему deprecated к v8.

## Публичный тип `Connectable`

`connectable()` возвращал `ConnectableObservableLike<T>` — внутренний interface в `connectable.ts`, **не** экспортируемый с root. В TypeScript нельзя было нормально аннотировать return type без хака. [`#6531`](https://github.com/ReactiveX/rxjs/issues/6531) / [`69f5bfa`](https://github.com/ReactiveX/rxjs/commit/69f5bfae0eb2880a3d5cfb34db3a182182b325de) (closes [#6529](https://github.com/ReactiveX/rxjs/issues/6529)):

- интерфейс переименован в **`Connectable<T>`** и перенесён в [`src/internal/types.ts`](https://github.com/ReactiveX/rxjs/blob/7.3.0/src/internal/types.ts);
- root re-export идёт через `export * from './internal/types'` в `src/index.ts`;
- сигнатура: `connectable<T>(...): Connectable<T>`.

```ts
import { connectable, Connectable, interval } from "rxjs";

const source$: Connectable<number> = connectable(interval(1000));
const connection = source$.connect(); // Subscription
```

Контракт тот же: `Connectable<T> extends Observable<T>` с idempotent `connect(): Subscription`. Runtime multicast не менялся — только публичный тип return value.

## `AsyncSubject`: emit при reentrant subscription

Если во время `_checkFinalizedStatuses` (доставка финального value + complete) подписчик **синхронно** подписывался на тот же `AsyncSubject`, новый subscriber мог не получить значение: проверка смотрела только на `isStopped`, а reentrant-путь опирается на `_isComplete`. [`#6522`](https://github.com/ReactiveX/rxjs/issues/6522) / [`dd8bdf3`](https://github.com/ReactiveX/rxjs/commit/dd8bdf3b18b596155b66029ef16ebabf989360c5) (closes [#6520](https://github.com/ReactiveX/rxjs/issues/6520)) в [`AsyncSubject.ts`](https://github.com/ReactiveX/rxjs/blob/7.3.0/src/internal/AsyncSubject.ts):

```ts
// было:  else if (isStopped) {
// стало:
else if (isStopped || _isComplete) {
  _hasValue && subscriber.next(_value!);
  subscriber.complete();
}
```

Тест: outer next при complete подписывает inner; ожидаемый порядок `['inner: 2', 'inner: done', 'outer: 1', 'outer: done']` для `next(1)` + `complete()`. Кого касается: код, который в `AsyncSubject` next/complete handler'е делает `subject.subscribe(...)` (типичный edge case single-value multicast / last-value gate).

## Что ещё в compare

В [`7.2.0...7.3.0`](https://github.com/ReactiveX/rxjs/compare/7.2.0...7.3.0) помимо четырёх пунктов changelog: перевод части operator-spec на TestScheduler `run` mode (`retry`, `retryWhen`, `pairwise`, `pluck`, `onErrorResumeNext`), мелкий refactor `Observable`, docs/comment fixes, dependency bump. User-facing surface — features `retry`/`tap`, type export `Connectable`, bugfix `AsyncSubject`.

## Ссылки

- Changelog: [7.3.0](https://github.com/ReactiveX/rxjs/blob/7.3.0/CHANGELOG.md)
- Compare: [7.2.0...7.3.0](https://github.com/ReactiveX/rxjs/compare/7.2.0...7.3.0)
- retry delay: [#6421](https://github.com/ReactiveX/rxjs/pull/6421)
- tap lifecycle: [#6527](https://github.com/ReactiveX/rxjs/pull/6527)
- Connectable type: [#6531](https://github.com/ReactiveX/rxjs/pull/6531) / [#6529](https://github.com/ReactiveX/rxjs/issues/6529)
- AsyncSubject reentrant: [#6522](https://github.com/ReactiveX/rxjs/pull/6522) / [#6520](https://github.com/ReactiveX/rxjs/issues/6520)

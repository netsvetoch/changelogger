---
author: Артём Нецветаев
pubDatetime: 2026-07-30T05:03:00.000Z
title: "RxJS 7.2.0: операторы с верхнего уровня `rxjs`, fix fromEvent types и debounceTime"
slug: rxjs-v7-2-0
featured: false
draft: false
tags:
  - release
  - rxjs
  - javascript
  - typescript
description: 'Minor RxJS 7.2.0: все pipeable-операторы реэкспортируются из "rxjs" (вместо rxjs/operators), fromEvent корректно выводит R при resultSelector+options, debounceTime снимает dangling schedule при unsubscribe.'
---

RxJS [`7.2.0`](https://github.com/ReactiveX/rxjs/compare/7.1.0...7.2.0) (тег `7.2.0`, 5 июля 2021) — minor после линии 7.0/7.1. Отдельного GitHub Release body у тега нет: контракт зафиксирован в [`CHANGELOG.md`](https://github.com/ReactiveX/rxjs/blob/7.2.0/CHANGELOG.md) (секция `# [7.2.0]`) и compare [`7.1.0...7.2.0`](https://github.com/ReactiveX/rxjs/compare/7.1.0...7.2.0) (32 коммита). Главное пользовательское изменение — **все pipeable-операторы доступны с корневого entrypoint `"rxjs"`**; плюс два точечных бага в `fromEvent` (типы) и `debounceTime` (теardown scheduler task).

## Операторы с верхнего уровня: `import { map } from "rxjs"`

До 7.2.0 канонический импорт pipeable-операторов шёл через deep path:

```ts
import { of } from "rxjs";
import { map, filter, take } from "rxjs/operators";

of(1, 2, 3)
  .pipe(
    map(x => x * 2),
    filter(x => x > 2),
    take(1)
  )
  .subscribe(console.log);
```

В [`#6488`](https://github.com/ReactiveX/rxjs/pull/6488) / [`512adc2`](https://github.com/ReactiveX/rxjs/commit/512adc25f350660113275d8277d16b7f3eec1d49) в [`src/index.ts`](https://github.com/ReactiveX/rxjs/blob/7.2.0/src/index.ts) добавили re-export **всех** операторов из `./internal/operators/*` — `map`, `filter`, `switchMap`, `catchError`, `share`, `debounceTime`, `combineLatestWith`, `mergeWith`, `zipWith`, multicast-семейство (`publish*`, `multicast`, `refCount`) и остальные pipeable API, которые раньше жили в `rxjs/operators`.

Рекомендуемый стиль с 7.2.0:

```ts
import { of, map, filter, take } from "rxjs";

of(1, 2, 3)
  .pipe(
    map(x => x * 2),
    filter(x => x > 2),
    take(1)
  )
  .subscribe(console.log);
```

Что важно на практике:

- **Это не breaking change.** `rxjs/operators` по-прежнему работает; changelog прямо говорит, что deep import **скоро deprecate'нут**, а top-level — новый preferred path.
- В scope PR **не** переносили side entrypoints: `rxjs/ajax`, `rxjs/webSocket`, `rxjs/fetch`, `rxjs/testing` остаются отдельными пакетами/путями (это отдельно оговорено в body PR).
- Bundlephobia и похожие tools могут показать «рост» корневого entrypoint: они раньше не учитывали deep `rxjs/operators`, а теперь операторы видны на `rxjs`. На tree-shaking при named imports это не отменяет: импортируете только то, что используете.
- Golden API guard `api_guard/dist/types/index.d.ts` и `spec/index-spec.ts` обновлены под полный список exports — регресс «оператор пропал с root» ловится тестами.

Миграция в кодовой базе — механическая: заменить `from "rxjs/operators"` на `from "rxjs"` (или слить с уже существующим import из `"rxjs"`). Поведение runtime у операторов не менялось — меняется только surface экспорта.

## `fromEvent`: корректный `Observable<R>` при `options` + `resultSelector`

В overload'е с **и** `EventListenerOptions`, **и** `resultSelector` return type ошибочно был `Observable<T>` (тип события), а не `Observable<R>` (тип результата selector'а). Без `options` overload уже возвращал `R`; с `options` TypeScript «терял» transform.

Фикс [`#6447`](https://github.com/ReactiveX/rxjs/issues/6447) / [`39b9d81`](https://github.com/ReactiveX/rxjs/commit/39b9d818ef6ea033dc8e53800e3a220d56c76b4a) в [`fromEvent.ts`](https://github.com/ReactiveX/rxjs/blob/7.2.0/src/internal/observable/fromEvent.ts):

```ts
// было (сигнатура):
// fromEvent<T, R>(target, eventName, options, resultSelector): Observable<T>
// стало:
// fromEvent<T, R>(target, eventName, options, resultSelector): Observable<R>

import { fromEvent } from "rxjs";

const clicks$ = fromEvent(document, "click", { once: true }, () => "clunk");
// Observable<string>, а не Observable<Event>
```

dtslint в `spec-dtslint/observables/fromEvent-spec.ts` добавил явные кейсы: `options` alone → `Observable<Event>`, `options` + resultSelector → `Observable<string>`. Runtime не менялся — только inference для consumer'ов на строгом TypeScript.

## `debounceTime`: dangling task снимается при unsubscribe

Если downstream отписывался **до** complete, а debounce-таймер ещё висел в scheduler, scheduled action мог остаться «висячим». В [`#6464`](https://github.com/ReactiveX/rxjs/issues/6464) / [`7ab0a4c`](https://github.com/ReactiveX/rxjs/commit/7ab0a4c649b1b54e763a726c4ffdc183b0b45b23) scheduled task регистрируют в subscription через `subscriber.add(activeTask)` — и при создании таймера, и при reschedule на новый `targetTime`:

```ts
// debounceTime.ts (идея фикса)
activeTask = scheduler.schedule(emitWhenIdle, dueTime);
subscriber.add(activeTask);
// ...
activeTask = this.schedule(undefined, targetTime - now);
subscriber.add(activeTask);
```

Тест на `AnimationFrameScheduler`: после `NEVER.pipe(startWith(1), debounceTime(0, scheduler)).subscribe()` в scheduler есть action; после `subscription.unsubscribe()` — `_scheduled` пуст и `actions` пустой. Кого это касается: UI/анимационные scheduler'ы, долгие debounce-окна, частые subscribe/unsubscribe (autocomplete, resize/scroll handlers) — меньше шансов на «пустой» callback после teardown.

## Что ещё вошло в compare, но не в user-facing changelog

В [`7.1.0...7.2.0`](https://github.com/ReactiveX/rxjs/compare/7.1.0...7.2.0) есть docs (`core-semantics.md`, правки installation/operators/deprecations), bump TypeScript в CI, dependency bumps и внутренний refactor error-handling path (`errorContext.ts`, правки `Observable`/`Subject`/`Subscriber` в коммите Core semantics / related). В секции Features/Bug Fixes changelog на 7.2.0 перечислены только три пункта выше — на них и стоит опираться при release notes и code review upgrade'а.

## Ссылки

- Changelog: [7.2.0](https://github.com/ReactiveX/rxjs/blob/7.2.0/CHANGELOG.md)
- Compare: [7.1.0...7.2.0](https://github.com/ReactiveX/rxjs/compare/7.1.0...7.2.0)
- PR top-level operators: [#6488](https://github.com/ReactiveX/rxjs/pull/6488)
- fromEvent types: [#6447](https://github.com/ReactiveX/rxjs/issues/6447)
- debounceTime teardown: [#6464](https://github.com/ReactiveX/rxjs/issues/6464)

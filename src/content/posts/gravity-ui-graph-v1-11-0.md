---
author: Артём Нецветаев
pubDatetime: 2026-06-28T23:37:00.000Z
title: "@gravity-ui/graph 1.11.0: wheel intent вместо resolveWheelDevice"
slug: gravity-ui-graph-v1-11-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - graph
  - canvas
description: "Разбор минорного релиза @gravity-ui/graph v1.11.0: breaking change resolveWheelDevice → resolveWheelIntent, новый resolver wheel intent, debug hooks, исправление DPR и selection bucket для соединений."
---

Gravity UI выпустила минорный релиз [`@gravity-ui/graph v1.11.0`](https://github.com/gravity-ui/graph/releases/tag/v1.11.0). Главное изменение — camera больше не пытается угадать устройство колеса как `mouse` или `trackpad`: вместо удалённой настройки `resolveWheelDevice` появился resolver намерения (`pan` или `zoom`). Это breaking change для проектов, которые переопределяли классификацию wheel-событий.

Источник для разбора — GitHub Release [`gravity-ui/graph@v1.11.0`](https://github.com/gravity-ui/graph/releases/tag/v1.11.0), compare [`v1.10.3...v1.11.0`](https://github.com/gravity-ui/graph/compare/v1.10.3...v1.11.0), PR [`#302`](https://github.com/gravity-ui/graph/pull/302) и [`#300`](https://github.com/gravity-ui/graph/pull/300). Для конкретики я проверил diff по `src/graphConfig.ts`, `src/store/settings.ts`, `src/services/camera/Camera.ts`, `src/utils/functions/wheelIntent.ts`, `src/services/Layer.ts` и `src/store/connection/*`.

## Breaking change: `resolveWheelDevice` заменён на `resolveWheelIntent`

До `v1.11.0` кастомизация wheel-маршрутизации строилась вокруг устройства: пользовательский callback возвращал `EWheelDeviceKind.Mouse` или `EWheelDeviceKind.Trackpad`. В этом релизе файл `src/utils/functions/isTrackpadDetector.ts` удалён, а публичные `defaultResolveWheelDevice` / `EWheelDeviceKind` больше не являются точкой расширения.

Новый контракт в `TGraphSettingsConfig` называется `resolveWheelIntent` и возвращает не тип устройства, а действие камеры:

```ts
import {
  EWheelIntent,
  createWheelIntentResolver,
  type TResolveWheelIntent,
} from "@gravity-ui/graph";

const resolveWheelIntent: TResolveWheelIntent = (event, mouseWheelBehavior) => {
  if (event.altKey) {
    return EWheelIntent.Pan;
  }

  return createWheelIntentResolver()(event, mouseWheelBehavior);
};

graph.updateSettings({
  resolveWheelIntent,
});
```

Встроенное значение по умолчанию теперь задаётся как `resolveWheelIntent: createWheelIntentResolver()` в `src/store/settings.ts`. Camera вызывает `settings.wheelIntentFromEvent(event, MOUSE_WHEEL_BEHAVIOR)` и дальше делает ровно две ветки: `EWheelIntent.Pan` уходит в `handlePan(event)`, всё остальное — в `handleZoom(event, acceleration)`. `PINCH_ZOOM_SPEED` применяется только когда `isPinchZoomGesture(event)` распознаёт Ctrl/Cmd + небольшой или fractional scroll как pinch-to-zoom.

## Как работает новый `createWheelIntentResolver()`

PR [`#302`](https://github.com/gravity-ui/graph/pull/302) добавил отдельный документ [`docs/system/wheel-intent.md`](https://github.com/gravity-ui/graph/blob/f1793f5b7572423042c1a140f61cb78eff03f528/docs/system/wheel-intent.md) и реализацию [`src/utils/functions/wheelIntent.ts`](https://github.com/gravity-ui/graph/blob/f1793f5b7572423042c1a140f61cb78eff03f528/src/utils/functions/wheelIntent.ts). Resolver оценивает правила в порядке приоритета и возвращает `EWheelIntent.Pan` или `EWheelIntent.Zoom`:

- `I1:pinch` — `(ctrlKey || metaKey)` плюс fractional или небольшой delta; это zoom и именно эта ветка включает `PINCH_ZOOM_SPEED`.
- `I2:horizontal-or-diagonal` — горизонтальный или диагональный scroll; это pan.
- `I3:integer-trackpad` / `I3:integer-trackpad-slow` — `deltaMode === DOM_DELTA_PIXEL` и integer `deltaX`/`deltaY`; это pan и не зависит от `MOUSE_WHEEL_BEHAVIOR`.
- `I4:mouse-wheel-step`, `I4:large-step`, `I4:fractional-mouse` и `I4-burst:smoothing` — mouse wheel; результат берётся из `MOUSE_WHEEL_BEHAVIOR`: `"zoom"` даёт zoom, `"scroll"` даёт pan.
- `I5:last-intent` — fallback на предыдущее намерение, если событие неоднозначное.

Это меняет важную практическую деталь: `MOUSE_WHEEL_BEHAVIOR` больше не означает «все wheel-события ведут себя как zoom или scroll». В документации к camera теперь явно сказано, что настройка влияет на mouse wheel-классификацию, а integer trackpad scroll всегда остаётся pan. Горизонтальные и диагональные жесты trackpad тоже маршрутизируются в pan.

## Появились публичные экспорты для настройки и отладки wheel intent

В публичный entrypoint `src/index.ts` добавлены типы и утилиты из `wheelIntent.ts`: `TResolveWheelIntent`, `TWheelIntentDebugEntry`, `createWheelIntentResolver`, `enableWheelIntentDebug`, `isPinchZoomGesture` и enum `EWheelIntent`. Те же сущности экспортируются из `src/graphConfig.ts`, рядом с `TMouseWheelBehavior`.

Для диагностики спорных wheel-событий можно включить debug hook. По diff видно, что logger получает raw fields `WheelEvent`, нормализованные delta, состояние сессии, набор boolean-сигналов и rule id, который победил в классификации:

```ts
import { enableWheelIntentDebug } from "@gravity-ui/graph";

enableWheelIntentDebug(entry => {
  console.log(entry.rule, entry.result, entry.input, entry.signals);
});

// Чтобы отключить:
enableWheelIntentDebug(null);
```

Это полезно при миграции кастомного поведения: вместо предположений «это мышь или трекпад» можно смотреть, почему конкретное событие попало, например, в `I3:integer-trackpad-slow` или `I4:mouse-wheel-step`.

## Исправлено наблюдение за DPR у canvas-слоёв

В тот же PR вошло исправление для device pixel ratio. В [`src/utils/functions/observeDPR.ts`](https://github.com/gravity-ui/graph/blob/f1793f5b7572423042c1a140f61cb78eff03f528/src/utils/functions/observeDPR.ts) callback на `change` теперь откладывается до `requestAnimationFrame`, чтобы не читать `devicePixelRatio` в момент, когда media query уже сработал, а браузер ещё не обновил значение. Unsubscribe также отменяет ожидающий `rafId`.

В [`src/services/Layer.ts`](https://github.com/gravity-ui/graph/blob/f1793f5b7572423042c1a140f61cb78eff03f528/src/services/Layer.ts) `getDRP()` теперь берёт актуальный DPR из `this.context.graph.layers.rootSize.value.dpr`, а `updateCanvasSize()` использует `width`, `height` и `dpr` из `getRootSize()`. Практический эффект — canvas-слои корректнее реагируют на смену DPR, например при переносе окна между дисплеями или изменении масштабирования ОС.

## Selection state у соединений теперь берётся из selection bucket

Bug fix из PR [`#300`](https://github.com/gravity-ui/graph/pull/300) выравнивает `ConnectionState` с паттерном `BlockState`. Раньше `ConnectionState` хранил `selected` прямо в writable `$state`. Если затем вызвать `setEntities()` или `updateConnection()` без поля `selected`, старое `selected: true` могло остаться в состоянии, потому что `Object.assign` не перезаписывает значение отсутствующим ключом.

Теперь `ConnectionState` разделён на raw data и derived state:

```ts
protected $rawState = signal<T>(undefined);

public readonly $selected = computed(() => {
  return this.connectionSelectionBucket.$selected.value.has(this.$rawState.value.id);
});

public $state = computed(() => ({
  ...this.$rawState.value,
  selected: this.$selected.value,
}));
```

`isSelected()` читает `$selected.value`, `toJSON()` и `asTConnection()` собирают результат из `$rawState` плюс bucket-derived `selected`, а `updateConnection()` пишет только в `$rawState`. В `ConnectionList.ts` удалён неиспользуемый `setSelection`, который напрямую менял `state.selected`; `deleteSelectedConnections()` теперь проверяет `c.$selected.value`.

Для пользователей это означает, что selection bucket стал единственным источником правды и для соединений тоже. Если приложение подсвечивает связи рядом с выбранными блоками, можно обновлять bucket без ручного проталкивания `selected: false` в каждое соединение:

```ts
graph.rootStore.connectionsList.connectionSelectionBucket.updateSelection(
  connectionIds,
  true,
  ESelectionStrategy.REPLACE
);
```

В релиз добавлены Storybook-сценарии `Api/Connection Selection`: один показывает прямую работу через selection bucket, второй — сценарий с React state и `setEntities`, где раньше stale `selected` мог сохраняться.

## Что проверить при обновлении

- Если вы использовали `resolveWheelDevice`, перенесите код на `resolveWheelIntent` и возвращайте `EWheelIntent.Pan` / `EWheelIntent.Zoom` вместо `EWheelDeviceKind.*`.
- Если UX зависел от `MOUSE_WHEEL_BEHAVIOR`, проверьте trackpad-сценарии отдельно: integer two-finger scroll теперь явно классифицируется как pan и не переопределяется этой константой.
- Для сложных окружений включите `enableWheelIntentDebug()` и посмотрите rule id на реальных устройствах пользователей.
- Если у вас был workaround вокруг `selected` у connections, проверьте, можно ли заменить его на работу через `connectionSelectionBucket`.

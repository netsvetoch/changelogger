---
author: Артём Нецветаев
pubDatetime: 2026-08-04T10:37:00.000Z
title: "Base UI 1.7.0: Root владеет store handle'ов, точные reason'ы Combobox и нормализация Progress"
slug: base-ui-v1-7-0
featured: false
draft: false
tags:
  - release
  - base-ui
  - react
description: "Разбор минорного релиза Base UI v1.7.0: store ownership у Dialog/Menu/Popover handle'ов, input-press/cancel-open в Combobox, типизация render callback, Progress/Meter min-max, Avatar.Fallback delay={0} и stripInternal в .d.ts."
---

Base UI выпустил минорный релиз [`v1.7.0`](https://github.com/mui/base-ui/releases/tag/v1.7.0). Это снова changelog-dense релиз без одной «главной фичи»: 208 коммитов между [`v1.6.0...v1.7.0`](https://github.com/mui/base-ui/compare/v1.6.0...v1.7.0), много bundle-size и popup-lifecycle правок, плюс несколько API/typing изменений, которые стоит проверить до обновления.

Главное:

- popup-handle'ы больше не владеют store между remount'ами: `Dialog`/`AlertDialog`/`Drawer`/`Menu`/`Popover`/`PreviewCard`/`Tooltip` Root создаёт store сам;
- у `Autocomplete`/`Combobox` в публичный union `onOpenChange` details добавлены reason'ы `input-press` и `cancel-open`;
- `render`-callback'и частей, жёстко привязанных к одному HTML-элементу, типизированы как props этого элемента;
- `Progress`/`Meter` согласуют процент, formatted text и ARIA с `min`/`max`;
- `Avatar.Fallback` считает `delay={0}` мгновенным показом (и это теперь default);
- из published `.d.ts` вырезаются `@internal` декларации через `stripInternal`.

Источник — GitHub Release [`mui/base-ui@v1.7.0`](https://github.com/mui/base-ui/releases/tag/v1.7.0) и PR'ы [`#5109`](https://github.com/mui/base-ui/pull/5109), [`#5149`](https://github.com/mui/base-ui/pull/5149), [`#5104`](https://github.com/mui/base-ui/pull/5104), [`#5356`](https://github.com/mui/base-ui/pull/5356), [`#5376`](https://github.com/mui/base-ui/pull/5376), [`#5332`](https://github.com/mui/base-ui/pull/5332), [`#5147`](https://github.com/mui/base-ui/pull/5147), [`#5095`](https://github.com/mui/base-ui/pull/5095), [`#5409`](https://github.com/mui/base-ui/pull/5409), [`#5210`](https://github.com/mui/base-ui/pull/5210), [`#5165`](https://github.com/mui/base-ui/pull/5165), [`#5287`](https://github.com/mui/base-ui/pull/5287) и соседние.

## Handle'ы popup'ов: Root владеет store

Самое архитектурное изменение релиза — model ownership для imperative handle API.

Раньше module-scoped `Dialog.createHandle()` (и аналоги у других popup'ов) держал один long-lived store на весь lifetime handle'а. Если `<Dialog.Root handle={dialog}>` размонтировали в open-состоянии (типичный animated route transition), следующий root с тем же handle сразу открывался снова со stale state.

В [`#5109`](https://github.com/mui/base-ui/pull/5109) для `Dialog` / `AlertDialog` / `Drawer` модель инвертировали:

- каждый `<*.Root>` создаёт свой store один раз на mount (`useRefWithInit`);
- handle только attach/detach'ится к store текущего root;
- detached triggers следят за pointer'ом handle'а и перерегистрируются при смене root;
- imperative `open` / `openWithPayload` / `close` без attached root — no-op (в dev есть warning), `isOpen` возвращает `false`;
- два root'а на одном handle одновременно не поддерживаются: побеждает последний mounted (dev warning).

[`#5149`](https://github.com/mui/base-ui/pull/5149) переносит ту же модель на `Menu`, `Popover`, `PreviewCard`, `Tooltip` и выносит shared machinery в `packages/react/src/utils/popups` (`BasePopupHandle`, `usePopupRootStore`, `useAttachHandle`, `usePopupHandleStore`). Отсюда же:

- `handle.open(id)` для anchored popup'ов **throws**, если trigger с таким `id` не зарегистрирован (`throwOnMissingTrigger`, default `true`);
- Dialog-семейство opt-out'ится: оно не anchored, поэтому открывается без trigger с dev warning.

Практический сценарий, который теперь должен работать предсказуемо:

```tsx
import { Dialog } from "@base-ui/react/dialog";

const dialog = Dialog.createHandle();

function RoutePage() {
  // Remount Root (route change / conditional render) больше не «вспоминает» open=true
  return (
    <Dialog.Root handle={dialog}>
      <Dialog.Trigger>Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup>
          <Dialog.Title>Details</Dialog.Title>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Пока Root снят, imperative API inert:
// dialog.open() -> no-op + dev warning
// dialog.isOpen -> false
```

Для Menu/Popover с `open(triggerId)` стоит убедиться, что id trigger'а реально в DOM до вызова — иначе получите throw вместо тихого no-op.

## `render` callback: element-specific props

[`#5104`](https://github.com/mui/base-ui/pull/5104) специализирует третий generic `BaseUIComponentProps` у `render`-callback'а. Раньше callback почти везде получал широкий `HTMLProps`; теперь части, жёстко привязанные к одному тегу, отдают `ComponentPropsWithRef<'tag'>`.

Специализированы, среди прочего:

| Part                                                                          | Element   |
| ----------------------------------------------------------------------------- | --------- |
| `Avatar.Image`                                                                | `<img>`   |
| `Form`                                                                        | `<form>`  |
| `NumberField.Input`, `OTPField.Input`                                         | `<input>` |
| `PreviewCard.Trigger`, `Menu.LinkItem`, `NavigationMenu.Link`, `Toolbar.Link` | `<a>`     |

Оставлены loose (`HTMLProps`), где polymorphism реален:

- `Combobox.Input` / `Autocomplete.Input` — могут быть `<textarea>`;
- `Field.Control`, `Toolbar.Input` — generic control;
- `Field.Label` при `nativeLabel={false}` — может быть `<div>`;
- `Fieldset.Root` — group controls;
- `*.Button` parts — polymorphic через `nativeButton`.

Для `Combobox.Input` / `Autocomplete.Input` заодно убрали inject `type="text"`: native default и так text, а на `<textarea>` атрибут был невалиден.

Пример, где TypeScript теперь видит `src`/`alt` как img-props:

```tsx
import { Avatar } from "@base-ui/react/avatar";

<Avatar.Root>
  <Avatar.Image
    render={(props, state) => (
      // props типизированы как img attributes
      <img {...props} src="/me.png" alt={state.imageLoadingStatus} />
    )}
  />
  <Avatar.Fallback>AN</Avatar.Fallback>
</Avatar.Root>;
```

Если вы кастомизировали specialized part через `render` в «чужой» тег и полагались на широкий `HTMLProps`, типы могут стать строже — это ожидаемо.

## Autocomplete / Combobox: публичные reason'ы и inline `aria-expanded`

### `input-press` и `cancel-open`

Два PR выравнивают TypeScript union с runtime, который уже эмитился раньше:

- [`#5356`](https://github.com/mui/base-ui/pull/5356) — `input-press` (runtime с `#4015`);
- [`#5376`](https://github.com/mui/base-ui/pull/5376) — `cancel-open` (runtime с drag-to-select `#3167`).

В docs/types для `Autocomplete.Root` и `Combobox.Root`:

```ts
type ComboboxRootChangeEventReason =
  | "trigger-press"
  | "input-press"
  | "outside-press"
  | "item-press"
  | "close-press"
  // ...
  | "cancel-open"
  | "none";

// details:
// | { reason: 'input-press'; event: MouseEvent | PointerEvent | TouchEvent | KeyboardEvent }
// | { reason: 'cancel-open'; event: MouseEvent }
```

Константы в `packages/react/src/internals/reason-parts.ts`: `inputPress = 'input-press'`, `cancelOpen = 'cancel-open'`.

`cancel-open` — сценарий slip-out: mousedown на trigger открыл popup, mouseup ушёл за пределы tolerance → popup закрывается, `onOpenChange(false, { reason: 'cancel-open', ... })`. Рядом в релизе [`#5159`](https://github.com/mui/base-ui/pull/5159) расширяет slip-out release tolerance для Combobox/Select/Menu trigger'ов.

```tsx
import { Combobox } from "@base-ui/react/combobox";

<Combobox.Root
  onOpenChange={(open, details) => {
    if (details.reason === "input-press") {
      // клик/press по input, а не по отдельному Trigger
    }
    if (details.reason === "cancel-open") {
      // drag-open отменён: mouseup вне tolerance trigger'а
    }
  }}
>
  <Combobox.Input />
  <Combobox.Portal>
    <Combobox.Positioner>
      <Combobox.Popup>
        <Combobox.List />
      </Combobox.Popup>
    </Combobox.Positioner>
  </Combobox.Portal>
</Combobox.Root>;
```

Это не «новые» runtime-события, а публичный typing contract: exhaustive `switch` по `details.reason` больше не должен падать на эти ветки.

### Inline combobox всегда expanded

[`#5332`](https://github.com/mui/base-ui/pull/5332) чинит ARIA для `Combobox.Root inline`. Inline-list живёт в дереве независимо от internal `open`, поэтому:

```ts
const expanded = open || inline;
// aria-expanded / aria-controls / shouldApplyAria завязаны на expanded, не только open
```

Для inline input (и inline `<textarea>` через `render`) `aria-expanded="true"` и `aria-controls={listbox.id}` выставляются сразу, даже до первого взаимодействия. Это продолжает линию `v1.6.0`, где inline-режим перестал сам прятать list и потребовал явного `open` для visibility-контракта.

Другие Combobox/Autocomplete fixes в том же миноре:

- [`#5195`](https://github.com/mui/base-ui/pull/5195) — default filter Autocomplete учитывает `locale` в режимах `list`/`both` (есть Turkish collation coverage);
- [`#5230`](https://github.com/mui/base-ui/pull/5230) / [`#5232`](https://github.com/mui/base-ui/pull/5232) — initial highlight в inline и возврат highlight на selected item при clear query;
- [`#5086`](https://github.com/mui/base-ui/pull/5086) — grouped items перестают фильтроваться после `limit`;
- [`#5365`](https://github.com/mui/base-ui/pull/5365) — `Combobox.Item` / `Select.Item` наследуют `disabled` от Root;
- [`#5265`](https://github.com/mui/base-ui/pull/5265) — hover в Safari больше не ворует highlight при scroll списка (Select + Combobox);
- [`#5334`](https://github.com/mui/base-ui/pull/5334) — portalled popup content Combobox остаётся open в соответствующем сценарии.

## Avatar.Fallback: `delay={0}` = сразу

[`#5147`](https://github.com/mui/base-ui/pull/5147) выравнивает `Avatar.Fallback` с остальными delay-API Base UI.

Было: мгновенный показ только при `delay={undefined}`; `delay={0}` всё равно шёл через delayed path. Стало:

```tsx
const { delay = 0, ... } = componentProps;
const [delayPassed, setDelayPassed] = React.useState(delay === 0);
// enabled: imageLoadingStatus !== 'loaded' && (delay === 0 || delayPassed)
```

Документированный default теперь `0`. Опущенный `delay` по-прежнему показывает fallback сразу (поведение omitted prop не ломается).

```tsx
import { Avatar } from "@base-ui/react/avatar";

// раньше для «без задержки» приходилось писать undefined
// <Avatar.Fallback delay={delayEnabled ? 300 : undefined}>

<Avatar.Fallback delay={delayEnabled ? 300 : 0}>AN</Avatar.Fallback>;
```

## Progress и Meter: один clamped percent на все surfaces

[`#5095`](https://github.com/mui/base-ui/pull/5095) закрывает рассинхрон Progress. До фикса `Progress.Indicator` уже нормализовал value через `valueToPercent(min, max)`, а `Progress.Value` / default `aria-valuetext` брали raw value.

Пример бага: `min={20} max={40} value={30}` → indicator 50%, text/`aria-valuetext` — `30%`.

После фикса Root один раз считает `clampedValue` и `percentageValue` и кормит ими:

- completion status (`clampedValue === max`, overshoot → `complete`);
- `aria-valuenow` (clamped, не вылезает за min/max);
- formatted text / default `aria-valuetext` через `formatNumber(percentageValue / 100, …, { style: 'percent' })`;
- `Progress.Indicator` читает `percentageValue` из context, а не пересчитывает сам.

[`#5409`](https://github.com/mui/base-ui/pull/5409) делает то же для Meter formatting: visible/accessible text идут из clamped range value; raw value по-прежнему доступен в `getAriaValueText`.

```tsx
import { Progress } from "@base-ui/react/progress";

<Progress.Root min={20} max={40} value={30}>
  {/* indicator width, Value text и aria-valuetext теперь согласованы ≈ 50% */}
  <Progress.Track>
    <Progress.Indicator />
  </Progress.Track>
  <Progress.Value />
</Progress.Root>;
```

Если UI или тесты ассертили raw percent при custom range — после обновления ждите normalized percent. Это bugfix, но snapshot'ы могут «поехать» в правильную сторону.

## Toast: `render` prop наконец монтирует контент

[`#5210`](https://github.com/mui/base-ui/pull/5210) чинит `Toast.Title` / `Toast.Description` / `Toast.Action`: раньше mount gated на `children`, поэтому

```tsx
<Toast.Description render={<div>Server error details</div>} />
```

не монтировался (`shouldRender === false`), вместе с `aria-*` wiring.

Теперь gate смотрит на **evaluated element resolved children**. Shared predicate `isRenderableNode` считает content'ом числа/`0`/`0n`/`NaN`, но не nullish, boolean, empty string и «пустые» массивы. Стилевой childless `render={<MyHeading />}`, где текст приходит из `toast.title` / `add({ title })`, по-прежнему не force-mount'ит пустой узел. `aria-labelledby` / `aria-describedby` регистрируются только пока part реально в дереве.

## Form / Checkbox / Radio: native submission и focus order

[`#5287`](https://github.com/mui/base-ui/pull/5287) — после invalid submit `Form` фокусирует первое invalid field **в document order**, а не в порядке внутренней Map. Value change больше не deregister/re-register'ит control (это сдвигало entry в конец Map); deregister остаётся на unmount / disabled registration. Для controls в одном tree используется `compareDocumentPosition`.

Checkbox Group:

- [`#5216`](https://github.com/mui/base-ui/pull/5216) — focus уходит на checkbox, чей hidden input failed validation;
- [`#5218`](https://github.com/mui/base-ui/pull/5218) — Form values проецируются из checked + mounted + enabled checkbox'ов, associated с текущей native form (logical group value для validation сохраняется).

Radio Group [`#5238`](https://github.com/mui/base-ui/pull/5238) — та же native successful-control семантика: selected input должен быть checked, не `:disabled` (включая ancestor `<fieldset disabled>`), и принадлежать submitted form. Public single-representative `inputRef` и logical group value не менялись.

Смежные form-фиксы:

- [`#5176`](https://github.com/mui/base-ui/pull/5176) — internal input clicks Checkbox/Radio/Switch не всплывают к ancestors;
- [`#5116`](https://github.com/mui/base-ui/pull/5116) — disabled Field сохраняет invalid state;
- [`#5290`](https://github.com/mui/base-ui/pull/5290) — `data-dirty` корректно для null-valued controls;
- [`#5089`](https://github.com/mui/base-ui/pull/5089) — OTP Field держит focus на invalid field, когда `autoSubmit` заблокирован.

## Slider, Tabs, Scroll Area, Drawer

[`#5097`](https://github.com/mui/base-ui/pull/5097) закрывает пять Slider-багов:

1. range values clamp'ятся поэлементно до sort (`defaultValue={[19, 41]}` при `min={20} max={40}` больше не даёт out-of-range thumbs/`aria-valuenow`);
2. `onFocus`/`onBlur` на Thumb идут на nested `<input>`, как `onKeyDown` (typed как input handlers);
3. `format` change сразу пересчитывает `formattedValues` и `aria-valuetext` Thumb;
4. range blur между thumbs не commit'ит validation mid-interaction (`contains(controlRef, relatedTarget)`);
5. range pointer path не пишет за конец values array, если thumb index устарел mid-drag.

[`#5003`](https://github.com/mui/base-ui/pull/5003) выкидывает prehydration script Tabs.Indicator / Slider.Thumb из client bundles через package `imports` map: `#prehydration/*` → empty stub в `browser` condition, real script в `default` (SSR). В PR замерено примерно −406 B gzip на `@base-ui/react/tabs` и −329 B на `@base-ui/react/slider`.

Scroll Area:

- [`#5099`](https://github.com/mui/base-ui/pull/5099) — thumb-drag divide-by-zero и лишний re-render на scroll;
- [`#5157`](https://github.com/mui/base-ui/pull/5157) — visibility scrollbar при touch scroll на iOS;
- [`#5145`](https://github.com/mui/base-ui/pull/5145) — WebKit overscroll feedback на `ScrollArea.Thumb`;
- [`#5259`](https://github.com/mui/base-ui/pull/5259) — нет scroll snapping во время thumb drag;
- [`#5374`](https://github.com/mui/base-ui/pull/5374) — thumb drag заканчивается, когда primary button уже не зажата.

Drawer:

- [`#5105`](https://github.com/mui/base-ui/pull/5105) — swipe-to-open;
- [`#5112`](https://github.com/mui/base-ui/pull/5112) — flash fully-open frame на swipe area re-grab;
- [`#5179`](https://github.com/mui/base-ui/pull/5179) — scroll при focus + virtual keyboard;
- [`#5257`](https://github.com/mui/base-ui/pull/5257) — cross-axis scroll на iOS ниже touchmove slop;
- [`#5308`](https://github.com/mui/base-ui/pull/5308) — snap point jump при pinned pointer move без смены drag offset;
- [`#5360`](https://github.com/mui/base-ui/pull/5360) — swipe в Shadow DOM.

## Button, Menu, Accordion и прочие точечные API

[`#4838`](https://github.com/mui/base-ui/pull/4838) — keyboard activation (Enter/Space) на non-native Button (`nativeButton={false}`) диспатчит **реальный** `.click()`, а не вызывает captured `onClick` prop напрямую. Раньше handlers на render-element не срабатывали:

```tsx
import { Button } from "@base-ui/react/button";

<Button
  nativeButton={false}
  render={<span onClick={() => console.log("runs on keyboard too")} />}
/>;
```

Menu:

- [`#5363`](https://github.com/mui/base-ui/pull/5363) — disabled propagates to items;
- [`#5342`](https://github.com/mui/base-ui/pull/5342) / [`#5384`](https://github.com/mui/base-ui/pull/5384) — VoiceOver submenu announcement и open submenu на Android TalkBack press;
- [`#5178`](https://github.com/mui/base-ui/pull/5178) — нет duplicate `onOpenChange` при close submenu;
- [`#5252`](https://github.com/mui/base-ui/pull/5252) — exit animation на uncheck item;
- [`#5153`](https://github.com/mui/base-ui/pull/5153) — stale submenu hover-open, когда Chrome дропает mouseleave;
- [`#4485`](https://github.com/mui/base-ui/pull/4485) — ignore pinch-zoom shifting (Menu + Navigation Menu).

[`#5117`](https://github.com/mui/base-ui/pull/5117) убирает неявный `dir` с `<Accordion.Root>` — это был единственный component, который ставил атрибут явно и без документации; направление берётся из окружения/CSS как у остальных частей.

[`#5240`](https://github.com/mui/base-ui/pull/5240) — Navigation Menu больше не «замерзает», если open trigger unmount'ится.

Toast дополнительно: [`#5261`](https://github.com/mui/base-ui/pull/5261) remaining timer, [`#5258`](https://github.com/mui/base-ui/pull/5258) re-add closing toast, [`#5295`](https://github.com/mui/base-ui/pull/5295) swipe direction lock для two-axis, [`#5338`](https://github.com/mui/base-ui/pull/5338) prop effect ordering у `Toast.Provider`.

## Types: `stripInternal` в published `.d.ts`

[`#5165`](https://github.com/mui/base-ui/pull/5165) включает TypeScript `stripInternal` для declaration build `@base-ui/react`. Декларации с `@internal` больше не попадают в published `.d.ts`. Public portal prop types инлайнят небольшой container shape вместо ссылок на internal Floating UI helper props. Workspace project references остаются на unstripped config (docs/tests), в CI добавлен API Extractor check рядом с public-types.

Если IDE/типы случайно опирались на internal helper names из пакета — после 1.7.0 их не будет в graph. Public API при этом должен остаться целым; цель PR как раз поймать public→internal holes экстрактором.

## Popup engine и bundle size

General changes вокруг popup/store — в основном correctness + size, без новых public props:

- unpositioned popups держатся у viewport origin ([`#5299`](https://github.com/mui/base-ui/pull/5299));
- `collisionPadding` off-by-one на biased side ([`#5143`](https://github.com/mui/base-ui/pull/5143));
- unwanted flip при capped scrollable content ([`#5120`](https://github.com/mui/base-ui/pull/5120));
- complete unmount после canceled exit transition ([`#5401`](https://github.com/mui/base-ui/pull/5401));
- sync mount popup subtrees при open в React 17 ([`#5309`](https://github.com/mui/base-ui/pull/5309));
- auto-resize origin для left-anchored popups ([`#5370`](https://github.com/mui/base-ui/pull/5370));
- restore visible focus after keyboard close в Safari/Firefox ([`#5093`](https://github.com/mui/base-ui/pull/5093));
- stale cleanup больше не чистит registered part IDs ([`#5340`](https://github.com/mui/base-ui/pull/5340));
- series reduce bundle size: popup ([`#5233`](https://github.com/mui/base-ui/pull/5233)), store ([`#5250`](https://github.com/mui/base-ui/pull/5250)), shared popup ([`#5192`](https://github.com/mui/base-ui/pull/5192)), Dialog/Popover ([`#5193`](https://github.com/mui/base-ui/pull/5193)), Checkbox family ([`#5223`](https://github.com/mui/base-ui/pull/5223)), Field/Form ([`#5225`](https://github.com/mui/base-ui/pull/5225)), Slider/Tabs/Toast/Number Field и др.

Composite: nested list reorder ([`#5156`](https://github.com/mui/base-ui/pull/5156)), always skip natively disabled items в list navigation ([`#5185`](https://github.com/mui/base-ui/pull/5185)), RTL scroll alignment в `scrollIntoViewIfNeeded` ([`#5234`](https://github.com/mui/base-ui/pull/5234)).

## Как обновляться

Релиз минорный. Перед blind upgrade имеет смысл:

1. Если используете `*.createHandle()` + conditional remount Root (роутинг, animated transitions) — проверьте, что reopen-after-remount больше не случается; для Menu/Popover не зовите `handle.open(id)` без зарегистрированного trigger.
2. Exhaustive handlers `onOpenChange` у Autocomplete/Combobox — добавьте ветки `input-press` и `cancel-open` (или default), иначе TS сузит union.
3. Кастомные `render` на specialized parts (`Avatar.Image`, link items, form/input parts) — прогоните `tsc`: props callback'а стали element-specific.
4. `Avatar.Fallback delay={0}` теперь genuinely immediate; условный `delayEnabled ? 300 : 0` работает как ожидается.
5. Progress/Meter с custom `min`/`max` — пересмотрите snapshot'ы percent text / `aria-valuetext` / indicator width.
6. Toast parts, которые отдавали контент только через `render={...}` без `children`, должны начать монтироваться.
7. Form invalid-submit focus order и Checkbox/Radio native `FormData` при `fieldset disabled` — обновите e2e/a11y ожидания.
8. Не опирайтесь на `@internal` типы из published `.d.ts` — их вырезали.

Установка:

```bash
pnpm add @base-ui/react@1.7.0
```

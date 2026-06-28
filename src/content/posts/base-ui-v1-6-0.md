---
author: Артём Нецветаев
pubDatetime: 2026-06-28T21:29:21.000Z
title: "Base UI 1.6.0: стабильный OTP Field, Drawer для экранной клавиатуры и точные Number Field"
slug: base-ui-v1-6-0
featured: false
draft: false
tags:
  - release
  - base-ui
  - react
description: "Разбор минорного релиза Base UI v1.6.0: breaking change в OTP Field, Drawer.VirtualKeyboardProvider, ускорение Combobox, исправления Number Field, Select, Checkbox/Radio Group и popup-компонентов."
---

Base UI выпустил минорный релиз [`v1.6.0`](https://github.com/mui/base-ui/releases/tag/v1.6.0). Это не релиз с одной большой фичей: в нём много точечных исправлений для формы, popover/dialog/menu-семейства и мобильных drawer-сценариев. Но есть и API-изменения, которые стоит заметить до обновления.

Главное: OTP Field вышел из preview и переименовал namespace export, Drawer получил opt-in провайдер для экранной клавиатуры, Combobox перестал перерисовывать все элементы на каждый ввод, а Number Field исправил несколько путей, где отображаемое и сохранённое числовое значение расходились.

Источник для обзора — GitHub Release [`mui/base-ui@v1.6.0`](https://github.com/mui/base-ui/releases/tag/v1.6.0), release body и связанные PR'ы: [`#5029`](https://github.com/mui/base-ui/pull/5029), [`#4353`](https://github.com/mui/base-ui/pull/4353), [`#4964`](https://github.com/mui/base-ui/pull/4964), [`#5040`](https://github.com/mui/base-ui/pull/5040), [`#4804`](https://github.com/mui/base-ui/pull/4804), [`#5025`](https://github.com/mui/base-ui/pull/5025) и другие.

## Breaking change: `OTPFieldPreview` стал `OTPField`

Единственный явно отмеченный breaking change в релизе — OTP Field больше не считается preview-компонентом. В [`#5029`](https://github.com/mui/base-ui/pull/5029) namespace export в `packages/react/src/otp-field/index.ts` переименован с `OTPFieldPreview` на `OTPField`, а документация убрала предупреждение «currently in preview».

Миграция небольшая, но обязательная для проектов, которые уже использовали компонент:

```diff
-import { OTPFieldPreview as OTPField } from "@base-ui/react/otp-field";
+import { OTPField } from "@base-ui/react/otp-field";
```

В diff'е обновлены демо, тесты, `types.md` и anatomy-пример. Сам состав частей остаётся тем же: `OTPField.Root`, `OTPField.Input`, `OTPField.Group`, `OTPField.Segment`, `OTPField.Separator` и callback'и вроде `onValueChange`, `onValueComplete`, `onValueInvalid` продолжают жить в новом namespace.

Практический вывод: если вы импортировали `OTPFieldPreview`, TypeScript/бандлер после обновления подскажут место поломки. Исправление — заменить namespace export, а не переписывать разметку компонента.

## Drawer получил `Drawer.VirtualKeyboardProvider`

Самое заметное новое API — [`Drawer.VirtualKeyboardProvider`](https://github.com/mui/base-ui/pull/4353). Это opt-in wrapper для bottom sheet drawer'ов с полями ввода на мобильных устройствах. Когда открывается программная клавиатура, провайдер оставляет popup-рамку стабильной и прокручивает ближайший scrollable body так, чтобы сфокусированное поле осталось видимым.

Подтверждённые детали из PR:

- новый export добавлен в `packages/react/src/drawer/index.parts.ts` как `VirtualKeyboardProvider`;
- типы экспортируются из `packages/react/src/drawer/index.ts`;
- в документации `Drawer.Viewport` появился CSS variable `--drawer-keyboard-inset` — inset клавиатуры от нижнего края layout viewport;
- провайдер не добавляет новый `Drawer.ScrollArea` и не переносит footer сам: header/footer layout остаётся под контролем пользователя.

Минимальная форма использования из нового demo выглядит так:

```tsx
import { Drawer } from "@base-ui/react/drawer";

export function DeliveryDrawer() {
  return (
    <Drawer.Root>
      <Drawer.Trigger>Open keyboard-aware drawer</Drawer.Trigger>
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop />
          <Drawer.Viewport>
            <Drawer.Popup>
              <header>
                <Drawer.Title>Delivery details</Drawer.Title>
              </header>

              <Drawer.Content>
                <input placeholder="Street address" />
                <input placeholder="Postal code" />
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}
```

Для закреплённых элементов внизу drawer'а можно использовать подтверждённую CSS-переменную:

```css
.DrawerFooter {
  transform: translateY(calc(-1 * var(--drawer-keyboard-inset, 0px)));
}
```

Это изменение важно для мобильных форм: раньше bottom sheet с несколькими input'ами легко оказывался под клавиатурой, а локальные workaround'ы часто ломали высоту popup'а или scroll anchoring.

## Swipe в Drawer стал дешевле для браузера

В том же Drawer-блоке есть производительное исправление [`#4980`](https://github.com/mui/base-ui/pull/4980). До релиза каждый `touchmove` во время свайпа мог проходить через делегированные React touch handlers и заставлять Chrome перерисовывать содержимое sheet'а на каждом кадре, хотя сам transform уже был compositor-friendly.

Исправление конкретное:

- swipe move обрабатывается native capture-phase `touchmove` listener'ом;
- когда Drawer забирает жест, он вызывает `stopPropagation()`, чтобы событие не дошло до React delegated touch system;
- в `useSwipeDismiss` добавлен метод `moveNative(nativeEvent, currentTarget)`;
- transform переключён на `translate3d(...) scale(...)`.

В PR приведён стресс-бенчмарк на 800 DOM-узлах с 20× CPU slowdown: paint time у Base UI снизился с 341 ms до 70 ms, paint events — с 78 до 6, средняя задача move — с 17.1 ms до 8.9 ms. Для пользователей API это не требует миграции, но мобильные drawer'ы с тяжёлым содержимым должны меньше «дёргаться» при закрытии свайпом.

## Combobox: меньше лишних render'ов и честнее inline-режим

В [`#4964`](https://github.com/mui/base-ui/pull/4964) исправлена причина, из-за которой каждый `Combobox.Item` подписывался на context со значением, меняющимся на каждый keystroke. Из-за смены identity React перерисовывал всех потребителей даже при `React.memo`.

Что изменилось внутри:

- `hasItems` вынесен в отдельный стабильный `ComboboxHasItemsContext`;
- fallback index для virtualized items вынесен в отдельного subscriber'а;
- non-virtualized items больше не читают context, который меняется на каждую букву.

В PR зафиксирован production benchmark на 500 открытых item'ов: ввод `"Row "` снизил React render work с 46.3 ms до 13.8 ms, а число перерисовок item'ов в сценарии, где все 500 остаются mounted, упало с 1500 до 0. Ограничение тоже важно: benefit зависит от referentially stable props. Паттерн `value={item}>{item.label}` подходит, а свежесозданный `<span>{item.label}</span>` на каждый render сам ломает memoization.

Отдельно [`#5069`](https://github.com/mui/base-ui/pull/5069) уточняет контракт `inline` для `Combobox.Root` и `Autocomplete.Root`. Если список рендерится inline, компонент больше не управляет видимостью popup'а, поэтому `open` нужно задать явно:

```tsx
import { Combobox } from "@base-ui/react/combobox";

<Combobox.Root inline open>
  <Combobox.Input />
  <Combobox.List>
    <Combobox.Item value="react">React</Combobox.Item>
  </Combobox.List>
</Combobox.Root>;
```

Для композиции `Combobox.Root` внутри `Dialog.Root` документация рекомендует связать `open`/`onOpenChange` Combobox'а с состоянием Dialog'а, чтобы при закрытии сбрасывались transient state: filter query, highlighted item и input value.

## Number Field: rounding через `Intl` и сохранение точности

У Number Field в `v1.6.0` сразу несколько исправлений, которые стоит читать вместе.

[`#4804`](https://github.com/mui/base-ui/pull/4804) исправил blur commit path: раньше значение округлялось через `toFixed`, поэтому могло расходиться с тем, что реально показывает `Intl.NumberFormat`. Теперь blur учитывает fraction digits, significant digits, `roundingMode`, `roundingIncrement`, `roundingPriority`, а также percent/permille и локализованный ввод.

[`#5040`](https://github.com/mui/base-ui/pull/5040) исправил другую сторону проблемы: когда у `format` нет явных rounding options, внутреннее числовое значение больше не теряет точность до трёх знаков после запятой. Видимый текст остаётся совместимым с default `Intl.NumberFormat`, но numeric pipeline хранит больше данных.

Подтверждённое поведение из PR для `value = 1.23456` без `format`:

| Действие                              | Отображается                               | Numeric value                              |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| ввести `1.23456` и blur               | `1.235`                                    | `1.23456`                                  |
| снова focus + blur без редактирования | `1.235`                                    | `1.23456`, без нового commit               |
| increment `+1`                        | `2.235`                                    | `2.23456`                                  |
| `step={0.0001}` от `0`                | может отображаться как `0` по Intl default | значение двигается `0.0001`, `0.0002`, ... |

Пример сценария, который теперь не должен терять точность:

```tsx
import { NumberField } from "@base-ui/react/number-field";

<NumberField.Root
  defaultValue={1.23456}
  step={0.0001}
  onValueChange={value => {
    // value хранит точность, даже если input визуально округлён Intl.NumberFormat
    console.log(value);
  }}
>
  <NumberField.Input />
  <NumberField.Increment />
  <NumberField.Decrement />
</NumberField.Root>;
```

[`#4905`](https://github.com/mui/base-ui/pull/4905) добавляет ещё несколько correctness-fix'ов: blur commit теперь использует уже clamp'нутое значение для callbacks, display text и validation; `Alt+ArrowUp`/`Alt+ArrowDown` используют `smallStep`; а snap выполняется до clamp, чтобы non-step-aligned границы `min`/`max` оставались достижимыми. Например, при `min={0}`, `max={10}`, `step={3}` значение при выходе за верхнюю границу может корректно попасть в `10`, а не откатиться к ближайшему step-aligned `9`.

## Select, Checkbox и Radio Group закрывают edge cases форм

В `Select` [`#5025`](https://github.com/mui/base-ui/pull/5025) исправил сразу несколько пользовательских багов:

- typeahead теперь пропускает disabled items и в open, и в closed state;
- matching стал locale-neutral, поэтому ввод `i` не ломается на Turkish/Azeri casing для label вроде `Istanbul`;
- в multiple mode общий hidden input остаётся nameless, а `itemToStringValue` больше не вызывается со всем массивом value;
- `positionerElement.style.maxHeight` исправлен с невалидного `auto` на `none`;
- trigger callback refs перестали вызываться дважды.

Для формы это означает меньше неожиданных submit-значений и меньше ситуаций, когда typeahead выбирает пункт, который пользователь не может выбрать мышью или стрелками.

Checkbox/Checkbox Group получили важное исправление [`#4941`](https://github.com/mui/base-ui/pull/4941): отмена через `eventDetails.cancel()` теперь происходит до parent/child обработки группы, поэтому cancel больше не оставляет group state в изменённом виде. Ещё один подтверждённый фикс — manually indeterminate parent checkbox теперь отдаёт правильный `aria-checked` и hidden input state, а не только визуально выглядит mixed.

Для `CheckboxGroup` и `RadioGroup` в [`#4997`](https://github.com/mui/base-ui/pull/4997) наконец прокидывается `id` на root element:

```tsx
<CheckboxGroup id="notifications" />
<RadioGroup id="billing-cycle" />
```

В diff'е это буквально добавление `id: idProp` к root props и тесты, проверяющие `screen.getByRole("group")` / `screen.getByRole("radiogroup")`.

## Accordion и popup-компоненты стали ближе к accessibility-ожиданиям

Accordion получил два заметных accessibility-изменения. В [`#4961`](https://github.com/mui/base-ui/pull/4961) из `Accordion.Root` убран `region` role, а [`#4965`](https://github.com/mui/base-ui/pull/4965) выровнял keyboard navigation с актуальным APG: Accordion APG больше не рекомендует roving focus, поэтому компонент уходит от старого поведения.

Для Dialog/Popover/Menu/Tooltip/Preview Card релиз в основном закрывает lifecycle-ошибки вокруг focus и positioning:

- [`#4925`](https://github.com/mui/base-ui/pull/4925): keep-mounted popup'ы теперь наблюдают реальный positioning reference, custom anchors запускают updates, `preventUnmountOnClose` сбрасывается при reopen, disabled hover popover triggers не открывают popup;
- [`#5030`](https://github.com/mui/base-ui/pull/5030): `FloatingFocusManager` сбрасывает refs после pointerdown/click-trigger и teardown, а `tabindex="0"` помечается `data-tabindex`, чтобы контейнер мог вернуться к `-1`, когда внутри появляется tabbable content;
- [`#5010`](https://github.com/mui/base-ui/pull/5010): keep-mounted popup viewport снова делает morphing snapshot после close/reopen и переключения обратно на ранее обработанный trigger.

Эти изменения особенно важны для приложений с `keepMounted`, controlled popups и кастомными anchors: проблемы часто проявлялись не при первом открытии, а после нескольких циклов close/reopen.

## Как обновляться

Релиз минорный, но перед blind upgrade стоит проверить несколько мест:

1. Заменить импорт OTP Field:

   ```diff
   -import { OTPFieldPreview as OTPField } from "@base-ui/react/otp-field";
   +import { OTPField } from "@base-ui/react/otp-field";
   ```

2. Если используете inline Combobox/Autocomplete, явно задайте `open` или свяжите `open`/`onOpenChange` с внешним Dialog state.
3. Если есть мобильные bottom sheet формы, попробуйте обернуть drawer в `Drawer.VirtualKeyboardProvider` и проверьте layout footer'ов с `--drawer-keyboard-inset`.
4. Для Number Field с кастомным `format`, `step`, `smallStep`, `min`/`max` и `onValueCommitted` прогоните тесты: релиз исправляет баги, но именно поэтому callback'и могут начать получать более правильные значения, чем раньше.
5. Для Select/Checkbox/Radio Group пересмотрите тесты форм, где раньше приходилось обходить disabled typeahead, cancel handling или отсутствие `id` на group root.

Установка обычная:

```bash
pnpm add @base-ui/react@1.6.0
```

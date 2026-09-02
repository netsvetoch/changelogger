---
author: Артём Нецветаев
pubDatetime: 2026-09-02T15:15:58.000Z
title: "@gravity-ui/uikit 7.49.0: DefaultPropsProvider, размер иконки кнопки и чистое закрытие useForkRef"
slug: gravity-ui-uikit-v7-49-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
  - typescript
  - ui
  - accessibility
description: "Разбор @gravity-ui/uikit v7.49.0: публичный DefaultPropsProvider для значений компонентов по умолчанию, Button.Icon c контекстом размера и render-prop, CSS API --g-help-mark-size, поддержка cleanup-функции React 19 в useForkRef и мобильные фиксы Modal/Dialog."
---

Вышел минорный релиз [`@gravity-ui/uikit v7.49.0`](https://github.com/gravity-ui/uikit/releases/tag/v7.49.0). Между `v7.48.3` и `v7.49.0` — 13 коммитов: четыре фичи и три багфикса. Главные изменения: из приватного под капотом вытащили полноценный провайдер значений компонентов по умолчанию, `Button.Icon` научился подхватывать размер из контекста кнопки, у `HelpMark` появился CSS API для размера, а `useForkRef` теперь корректно поддерживает cleanup-функцию ref-колбэка React 19.

Источники: [GitHub Release](https://github.com/gravity-ui/uikit/releases/tag/v7.49.0), [compare `v7.48.3...v7.49.0`](https://github.com/gravity-ui/uikit/compare/v7.48.3...v7.49.0), PR [#2802](https://github.com/gravity-ui/uikit/pull/2802), [#2799](https://github.com/gravity-ui/uikit/pull/2799), [#2803](https://github.com/gravity-ui/uikit/pull/2803), [#2804](https://github.com/gravity-ui/uikit/pull/2804), [#2793](https://github.com/gravity-ui/uikit/pull/2793), [#2800](https://github.com/gravity-ui/uikit/pull/2800), [#2798](https://github.com/gravity-ui/uikit/pull/2798). Версия `7.49.0` — minor-граница semver; `featured: false`.

## `DefaultPropsProvider`: общие значения по умолчанию вне темы

Раньше механизм `defaultProps` жил в `ThemeProvider` через приватный `PrivateDefaultPropsProvider`/`PrivateDefaultPropsContext`, которые снаружи не использовались. В [`#2799`](https://github.com/gravity-ui/uikit/pull/2799) / коммит [`53ce6be`](https://github.com/gravity-ui/uikit/commit/53ce6be20241bf556b5adfebd1dee5b4fdf5f25c) контекст сделали публичным и выделили в самостоятельный провайдер.

Новое публичное API:

```ts
export interface DefaultPropsProviderProps extends React.PropsWithChildren<{}> {
  defaultProps?: ComponentDefaultPropsMap;
}
```

`ThemeProvider` теперь принимает `defaultProps` через тот же `DefaultPropsProvider`, но его можно использовать и сам по себе — чтобы переопределить дефолты для части дерева, не создавая ещё одну область темы:

```tsx
import type { ComponentDefaultPropsMap } from "@gravity-ui/uikit";
import { Button, DefaultPropsProvider } from "@gravity-ui/uikit";

const actionButtonDefaults = {
  Button: { view: "action" },
} satisfies ComponentDefaultPropsMap;

<DefaultPropsProvider defaultProps={actionButtonDefaults}>
  <Button>Акцентная кнопка</Button>
</DefaultPropsProvider>;
```

Провайдеры вкладываются: вложенный наследует настройки остальных компонентов, но целиком заменяет настройки совпавшего компонента. Например, внутренний `Button: {view: "action"}` заменит и `view`, и `size` из внешнего `Button: {view: "outlined", size: "l"}` — а не сольёт их. Сброс всех унаследованных значений для части дерева пока не поддерживается.

Ссылка на объект `defaultProps` должна оставаться стабильной (объявите его вне render или через `React.useMemo`): inline-объект создаёт новое значение контекста на каждом render родителя и заставляет все компоненты, читающие дефолты, перерисовываться. Явно переданные компоненту props имеют приоритет над дефолтами, а проп со значением `undefined` дефолт не переопределяет.

Внутри потребитель получает дефолты через `useDefaultProps(componentName, props)`, который отбрасывает undefined-поля и подмешивает значения из контекста. В `ComponentDefaultPropsMap` в этом релизе добавилась запись `PasswordInput`; сам `PasswordInput` теперь в паре с внутренним `TextInput` читает свои дефолты (`useDefaultProps("PasswordInput", rawProps)` затем `useDefaultProps("TextInput", …)`).

## `Button.Icon`: размер из контекста кнопки и render-prop

Раньше `Button.Icon` просто оборачивал переданную иконку в `span.button__icon` и не знал про размер кнопки — размер иконки приходилось задавать вручную (или он оставался дефолтным у иконки). В [`#2802`](https://github.com/gravity-ui/uikit/pull/2802) / [`cf62374`](https://github.com/gravity-ui/uikit/commit/cf6237474611ca199f490d66471684fe8ab86cc0) появился `ButtonIconSizeContext`, а `Button` оборачивает содержимое в `<ButtonIconSizeContext.Provider value={BUTTON_ICON_SIZE_MAP[size]}>`.

Соответствие размеров кнопки → размеру иконки (`BUTTON_ICON_SIZE_MAP`):

```ts
export const BUTTON_ICON_SIZE_MAP = {
  xs: 12,
  s: 14,
  m: 16,
  l: 16,
  xl: 20,
} as const;
```

У `Button.Icon` теперь расширено API. Во-первых, `children` может быть render-функцией с текущим размером:

```tsx
export interface ButtonIconRenderProps {
  size?: number;
}
```

```tsx
<Button
  icon={
    <Button.Icon>
      {({ size }) => <MySvg width={size} height={size} />}
    </Button.Icon>
  }
>
  Кнопка
</Button>
```

Во-вторых, при передаче обычной иконки `Button.Icon` сам пытается выставить размер: если передан компонент `Icon` без `size` (и без пары width/height) — клонируется с `{size: buttonIconSize}`; если передан inline-`<svg>` — недостающие `width`/`height` подставляются из размера. Явно заданный `size` иконки не перезаписывается.

## CSS API для размера `HelpMark`

В [`#2803`](https://github.com/gravity-ui/uikit/pull/2803) / [`3b85e05`](https://github.com/gravity-ui/uikit/commit/3b85e05fdab8aeb451787aca25094324feaadaad) размер `HelpMark` стал переопределяться через CSS-переменную (раньше задавался только внутренней `--_--size`):

```scss
width: var(--g-help-mark-size, var(--_--size));
height: var(--g-help-mark-size, var(--_--size));
```

```css
.g-help-mark {
  --g-help-mark-size: 24px;
}
```

Переменная задокументирована в README «CSS API»: `--g-help-mark-size` — размер иконки в пикселях. Внутренний `__icon` тоже наследует эту переменную, так что иконка масштабируется вместе с корнем.

## `useForkRef`: cleanup-функция ref-колбэка React 19

React 19 позволяет function ref вернуть cleanup, который вызывается при размонтировании / смене ref. Раньше `setRef`/`mergeRefs` просто вызывали колбэк и отбрасывали результат, из-за чего cleanup из приватных флеймов терялся. В [`#2804`](https://github.com/gravity-ui/uikit/pull/2804) / [`4c35599`](https://github.com/gravity-ui/uikit/commit/4c35599ab2ab8a2520955cde0081a9c2e3b06732) `setRef` теперь возвращает cleanup-функцию, а `mergeRefs` собирает их и возвращает общий cleanup:

```ts
// setRef.ts
export function setRef<T>(
  ref: React.Ref<T | null> | undefined,
  value: T | null
) {
  if (typeof ref === "function") {
    const cleanup = ref(value);
    return typeof cleanup === "function"
      ? cleanup
      : () => {
          ref(null);
        };
  } else if (ref) {
    const mutableRef = ref as { current: T | null };
    mutableRef.current = value;
    return () => {
      mutableRef.current = null;
    };
  }
  return undefined;
}
```

```ts
// mergeRefs.ts
export function mergeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return function mergedRefs(value) {
    const cleanups: (() => void)[] = [];
    for (const ref of refs) {
      const cleanup = setRef(ref, value);
      if (cleanup) {
        cleanups.push(cleanup);
      }
    }

    if (value === null || cleanups.length === 0) {
      return undefined;
    }

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  };
}
```

Поведение: при установке ref `mergeRefs` возвращает функцию, которая дёргает cleanup всех форкнутых ref; объектные ref дополнительно обнуляют `current`. Это чинит подписки/эффекты, которые компоненты навешивают внутри function-ref (например, привязанные слушатели), — теперь они корректно снимаются при смене узла или размонтировании.

## Багфиксы

- [[#2793](https://github.com/gravity-ui/uikit/pull/2793)] **`Drawer`: захват указателя во время ресайза.** Раньше при перетаскивании хэндла-ресайзера указатель «терялся», если курсор уходил за границы iframe — resize зависал и не завершался на pointerup. Теперь активный указатель захватывается на `resize` handle, и обработка resize/pointerup продолжает работать даже при пересечении iframe. Добавлен Playwright-регрессионный тест, воспроизводящий drag через iframe.

- [[#2800](https://github.com/gravity-ui/uikit/pull/2800)] **`Modal`/`Dialog`: фикс мобильных стилей.** Селектор модального контейнера запретили для мобильной модификации: `&__modal:not(.g-dialog__modal_mobile)` — раньше мобильный `Dialog` с `maxWidth="s"` и `fullWidth` мог подхватывать desktop-ограничение `--g-modal-max-width: 480px`. В `Dialog` теперь передают `{mobile}` в `b("modal", …)`, и мобильный диалог заполняет вьюпорт независимо от desktop-ограничений ширины (добавлен visual-тест «fills the mobile viewport regardless of desktop width constraints»).

- [[#2798](https://github.com/gravity-ui/uikit/pull/2798)] **`Modal`/`Dialog`: responsive viewport units.** Высоты в `Modal.scss`/`Dialog.scss` переведены с фиксированных `100vh` на динамические `100dvh` (и `100svh` для `--g-modal-min-height` в мобильном режиме), чтобы модалка корректно учитывала смещение адресной строки мобильного браузера. Заодно в CSS API `Modal` появились две новые переменные: `--g-modal-min-width` и `--g-modal-min-height`.

## Обновление

```bash
pnpm add @gravity-ui/uikit@7.49.0
```

Что проверить после апдейта:

1. Если задавали дефолты `Button` через `ThemeProvider.defaultProps` — они работают как раньше; новый `DefaultPropsProvider` можно использовать для точечного переопределения в поддереве (помните про стабильную ссылку на объект).
2. Иконки кнопок с явным `Button.Icon` — теперь отрисуются в размере кнопки по умолчанию; заданный явно `size`/`width`/`height` останется без изменений.
3. После фикса `useForkRef` убедитесь, что ваши function ref ничего не ломают из-за возвращаемой cleanup-функции.
4. Мобильные `Modal`/`Dialog` — ширина/высота во вьюпорте и работа `--g-modal-min-height`.

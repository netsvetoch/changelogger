---
author: Артём Нецветаев
pubDatetime: 2026-06-28T22:16:11.000Z
title: "Material Web 2.4.0: disabled-ссылки в Button, showPicker() для Select и CSS zoom в Ripple"
slug: material-web-v2-4-0
featured: false
draft: false
tags:
  - release
  - material-web
  - web-components
description: "Разбор минорного релиза Material Web v2.4.0: disabled и soft-disabled для кнопок-ссылок, gradient container colors, Select.showPicker(), исправления Menu, Radio и Ripple."
---

Material Web выпустил минорный релиз [`v2.4.0`](https://github.com/material-components/material-web/releases/tag/v2.4.0). Это обновление без breaking changes в release body, но с несколькими изменениями, которые напрямую влияют на поведение компонентов: кнопки-ссылки теперь честно поддерживают disabled-состояния, цвета контейнера button-компонентов могут быть градиентами, у Select появился публичный `showPicker()`, а Ripple исправил расчёты для `CSS zoom`.

Источник для обзора — GitHub Release [`material-components/material-web@v2.4.0`](https://github.com/material-components/material-web/releases/tag/v2.4.0), compare [`v2.3.0...v2.4.0`](https://github.com/material-components/material-web/compare/v2.3.0...v2.4.0) и связанные коммиты: [`c3c4848`](https://github.com/material-components/material-web/commit/c3c48485b152595c0e892383dc5ab38fdb1ac442), [`5bc1506`](https://github.com/material-components/material-web/commit/5bc15069d136c51e912137dcba1b212a106bb1dd), [`8808a25`](https://github.com/material-components/material-web/commit/8808a25da8cb879d120c11b6961e10ef75ca5add), [`ca5f750`](https://github.com/material-components/material-web/commit/ca5f75094b3ac2d314ccb31ec06ec653501cf801), [`688ab3c`](https://github.com/material-components/material-web/commit/688ab3cf5f12ddbff07407910b8e8e158b3282d7), [`3072a9b`](https://github.com/material-components/material-web/commit/3072a9bc286876be157e15d65b0d4877245e1acc) и [`cd7512f`](https://github.com/material-components/material-web/commit/cd7512ff90cf25ad98c6caa9842bf86d284146c7).

## Button: `disabled` и `soft-disabled` теперь работают и на ссылках

До `v2.4.0` внутренний `Button` явно считал, что link button нельзя отключить: ripple выключался только для кнопок без `href`, а `softDisabled`-обработка клика тоже была привязана к `!this.href`. В [`c3c4848`](https://github.com/material-components/material-web/commit/c3c48485b152595c0e892383dc5ab38fdb1ac442) это ограничение снято.

Что изменилось в `button/internal/button.ts`:

- ripple теперь отключается при `this.disabled || this.softDisabled` независимо от того, рендерится `<button>` или `<a href="...">`;
- link-renderer добавляет `aria-disabled`, если включён `disabled` или `softDisabled`;
- для обычного `disabled` на ссылке выставляется `tabindex="-1"`, чтобы элемент ушёл из tab order;
- `handleClick()` блокирует переход и всплытие для `softDisabled` и для сочетания `disabled + href` через `stopImmediatePropagation()` и `preventDefault()`.

Минимальный пример теперь можно писать без отдельной обёртки вокруг ссылки:

```html
<md-filled-button href="/billing" disabled> Billing </md-filled-button>

<md-text-button href="/docs" soft-disabled> Documentation </md-text-button>
```

Практический эффект: если дизайн-система использует Material Web buttons как ссылки для навигации, disabled-состояние больше не является только визуальной договорённостью. Компонент сам выставляет accessibility-состояние и предотвращает переход по ссылке.

В том же коммите обновлена demo-story `button/demo/stories.ts`: knobs `disabled` и `softDisabled` прокинуты во все link-варианты — `md-filled-button`, `md-outlined-button`, `md-elevated-button`, `md-filled-tonal-button` и `md-text-button`, включая примеры с `aria-label`.

## Button container colors теперь могут быть градиентами

В [`5bc1506`](https://github.com/material-components/material-web/commit/5bc15069d136c51e912137dcba1b212a106bb1dd) изменение выглядит маленьким, но снимает реальное CSS-ограничение. В `button/internal/_shared.scss` для `.background` свойство заменено с `background-color` на `background`; то же сделано для disabled container color.

Почему это важно: `background-color` принимает только цвет, а `background` принимает и `<color>`, и `<gradient>`. Значит, токены контейнера, которые попадают в `--_container-color` или `--_disabled-container-color`, теперь могут быть не только `rgb(...)`/`var(...)`, но и `linear-gradient(...)`.

```css
md-filled-button.hero-action {
  --md-filled-button-container-color: linear-gradient(90deg, #6750a4, #0b57d0);
  --md-filled-button-label-text-color: white;
}
```

Для проектов с брендированными CTA это убирает необходимость дублировать внутреннюю разметку кнопки или перекрывать `.background` через нестабильные селекторы. При этом старые однотонные значения продолжают работать: `background` принимает обычные CSS-цвета.

## Select получил публичный `showPicker()`

В [`8808a25`](https://github.com/material-components/material-web/commit/8808a25da8cb879d120c11b6961e10ef75ca5add) в `select/internal/select.ts` добавлен метод:

```ts
/** Shows the picker. If it's already open, this is a no-op. */
showPicker() {
  this.open = true;
}
```

То есть у Material Web Select появился программный аналог «открыть выпадающий список». Метод не делает сложной синхронизации: он просто выставляет `open = true`; если picker уже открыт, повторный вызов ничего не меняет.

Пример сценария для кастомной кнопки рядом с select:

```ts
const select = document.querySelector("md-outlined-select");
const openButton = document.querySelector("#open-country-picker");

openButton?.addEventListener("click", () => {
  select?.showPicker();
});
```

Это полезно для форм, где открытие списка должно быть привязано не только к самому select: onboarding-подсказка, отдельная иконка действия, keyboard shortcut или шаг в wizard-интерфейсе. До этого приходилось управлять `open` напрямую; теперь есть небольшой именованный метод с ожидаемым no-op поведением.

## Menu item theme values больше не отфильтровываются преждевременно

Bug fix [`ca5f750`](https://github.com/material-components/material-web/commit/ca5f75094b3ac2d314ccb31ec06ec653501cf801) затрагивает `menu/internal/menuitem/_menu-item.scss`. В mixin условие изменено с:

```scss
@if $value and list.index($supported-tokens, $token) == null {
  --md-menu-item-#{$token}: #{$value};
}
```

на:

```scss
@if $value {
  --md-menu-item-#{$token}: #{$value};
}
```

Важная деталь: проверка `@error 'Token ... is not a supported token.'` осталась выше. То есть неподдерживаемые токены по-прежнему отсекаются, но поддерживаемые значения больше не пропадают из output CSS из-за неверного условия `list.index(...) == null`.

Практический эффект для темизации меню: значения вроде `--md-menu-item-*`, которые должны генерироваться из theme tokens, теперь действительно попадают в CSS custom properties, а не теряются на этапе Sass-миксина.

## Radio: меньше риска stack overflow при массовом mount/unmount

В [`688ab3c`](https://github.com/material-components/material-web/commit/688ab3cf5f12ddbff07407910b8e8e158b3282d7) исправлен `radio/internal/single-selection-controller.ts`. Раньше `hostConnected()` и `hostDisconnected()` синхронно вызывали `updateTabIndices()`. При одновременном рендеринге большого числа radio-элементов это могло запускать цепочку Lit updates прямо внутри connected/disconnected callbacks и приводить к переполнению стека.

Теперь обновление sibling radio-элементов откладывается в microtask:

```ts
queueMicrotask(() => {
  this.updateTabIndices();
});
```

А при disconnect вместе с обновлением siblings откладывается и сброс `this.root = null`.

Для потребителей API миграции нет: разметка `md-radio` не меняется. Исправление важно для больших динамических форм, virtualized-списков или экранов, где десятки/сотни radio появляются и исчезают одним React/Lit/render-пакетом.

## Ripple: корректные координаты при `CSS zoom` и упрощение long-press пути

В релиз вошли два исправления Ripple.

Первое, [`3072a9b`](https://github.com/material-components/material-web/commit/3072a9bc286876be157e15d65b0d4877245e1acc), добавляет компенсацию `currentCSSZoom` в расчёты размера и координат ripple. В `ripple/internal/ripple.ts` теперь используется `const zoom = this.currentCSSZoom ?? 1`, после чего:

- `initialSize` делится на `zoom`;
- итоговый `rippleScale` дополнительно делится на `zoom`;
- координаты pointer event нормализуются как `(pageX - documentX) / zoom` и `(pageY - documentY) / zoom`;
- центр и endpoint для translation считаются от `width / zoom` и `height / zoom`.

Если контейнер или страница использует CSS `zoom`, ripple раньше мог стартовать не из точки клика или визуально не совпадать с размером элемента. После обновления расчёты явно переводят координаты в масштабированную систему.

Второе исправление, [`cd7512f`](https://github.com/material-components/material-web/commit/cd7512ff90cf25ad98c6caa9842bf86d284146c7), удаляет старую защиту `checkBoundsAfterContextMenu`. В сообщении коммита причина сформулирована прямо: Chrome-баг, при котором после long-press contextmenu мог прилетать лишний `pointerdown`, больше не воспроизводится. Поэтому из Ripple удалены флаг, проверка `inBounds(event)` и сам helper `inBounds()`.

Для приложений это означает меньше специальной логики в pointerdown/contextmenu пути, а основное пользовательское изменение — более точное позиционирование ripple в масштабированных интерфейсах.

## Catalog-изменения и инфраструктура релиза

Два пункта changelog относятся к catalog-сайту Material Web, а не к runtime API пакета.

- [`bf89645`](https://github.com/material-components/material-web/commit/bf896458b0a656a40187d3fdddbc573407a4e55b) переносит CSS для `body[dsd-pending] { display: none; }` в `<head>` catalog layout. Это скрывает body до выполнения Declarative Shadow DOM polyfill на браузерах без нативной поддержки DSD.
- [`0037c14`](https://github.com/material-components/material-web/commit/0037c14f6ba17ae224f8377e4afcba35862c4bf4) меняет layout component pages так, чтобы CSR-страницы гидратировались через `<lit-island on:idle ...>` с содержимым внутри острова, а SSR-only страницы продолжали рендерить markdown напрямую.

В compare также видны инфраструктурные изменения: версия пакета поднята до `2.4.0`, TypeScript в корневом `package.json` обновлён с `5.6.2` до `5.8.2`, `wireit` — с `0.13.0` до `0.14.12`, а GitHub Actions перешли на `google/wireit@setup-github-actions-caching/v2`. Для потребителей `@material/web` это не отдельная миграция, но важно для сопровождения репозитория.

## Что проверить после обновления

- Если вы используете Material Web buttons как ссылки, проверьте сценарии `disabled` и `soft-disabled`: теперь компонент предотвращает переход и выставляет `aria-disabled`, а обычный disabled link получает `tabindex="-1"`.
- Если тема переопределяет button container tokens, можно заменить локальные background-workaround'ы на прямое значение `linear-gradient(...)` в container color custom property.
- Если рядом с `md-*-select` есть внешняя кнопка открытия или wizard-логика, используйте `select.showPicker()` вместо ручного `select.open = true`.
- Если интерфейс использует CSS `zoom`, особенно в embedded/desktop-like окружениях, перепроверьте Ripple: релиз исправляет расчёт размера, scale и стартовых координат.

---
author: Артём Нецветаев
pubDatetime: 2026-06-29T10:07:58.000Z
title: "nanotags 0.15.0: render снова обновляет шаблон без data, а DOM-запросы стали типизироваться как refs"
slug: nanotags-v0-15-0
featured: false
draft: false
tags:
  - release
  - nanotags
  - web-components
description: "Разбор nanotags 0.15.0: исправлен render без data, из-за которого повторный вызов мог не запускать update, а getElement/getElements получили overloads для tag-name inference и явного Element-типа."
---

[`nanotags` 0.15.0](https://github.com/psd-coder/nanotags/blob/main/CHANGELOG.md#0150) — минорный релиз маленькой обёртки над Web Components и Nano Stores. В changelog у версии всего два пункта, поэтому я проверил исходный `CHANGELOG.md`, compare [`0.14.0...0.15.0`](https://github.com/psd-coder/nanotags/compare/0.14.0...0.15.0), коммиты [`bd6b012`](https://github.com/psd-coder/nanotags/commit/bd6b01240f9a13bafecaf3d883769d3c328044f3) и [`ed68403`](https://github.com/psd-coder/nanotags/commit/ed684030663ad65b05f37433baf2a51a37391622), а также изменения в `packages/nanotags/src/render.ts`, `setup-context.ts` и тестах.

Практический смысл релиза: если вы используете `nanotags/render` для повторного обновления одного и того же шаблона без явного `data`, `update` снова вызывается на каждом `render(...)`. А для `ctx.getElement()` и `ctx.getElements()` теперь можно выбирать между автотипизацией по HTML-тегу и явным типом элемента — так же, как в ref builder API `one`/`many`.

## `render()` без `data` больше не пропускает повторный `update`

Публичный API `render(container, template, options?)` построен поверх `renderList`. `renderList` хранит последний `item` для DOM-элемента в `WeakMap` и вызывает `update`, только если ссылка на данные изменилась:

```ts
if (elementData.get(el) !== item) {
  update(el as E, item);
  elementData.set(el, item);
}
```

До 0.15.0 `render()` передавал в `renderList` массив из одного элемента, где при отсутствии `options.data` использовался общий fallback `null`:

```ts
renderList(container, template, {
  data: [options?.data ?? (null as T)],
  // ...
});
```

Из-за этого сценарий «обновить тот же шаблон, но без data» мог сработать только один раз. На втором вызове ключ шаблона совпадал, DOM-элемент переиспользовался, а `elementData.get(el) !== item` превращалось в `null !== null`, то есть `false`. В результате callback `update` не запускался, даже если код ожидал перерисовать текст, классы или вложенный список.

В 0.15.0 fallback изменён на свежий объект для каждого вызова без явного `data`:

```ts
export function render<T, E extends Element = Element>(
  container: Element,
  template: HTMLTemplateElement,
  options?: RenderOptions<T, E>
): void {
  const data = [
    options !== undefined && "data" in options ? options.data : {},
  ] as T[];

  renderList(container, template, {
    data,
    key: () => {
      // stable id per template
    },
    update: options?.update ?? (() => {}),
  });
}
```

Это не отменяет оптимизацию для явных данных: если вы передали один и тот же объект в `data`, `renderList` по-прежнему считает, что данные не изменились, и не вызывает `update` повторно.

Минимальный пример поведения после обновления:

```ts
import { render } from "nanotags/render";

let calls = 0;

render(container, template, {
  update(el) {
    el.textContent = `call-${++calls}`;
  },
});

render(container, template, {
  update(el) {
    el.textContent = `call-${++calls}`;
  },
});

// update вызван дважды, textContent стал "call-2".
```

Новый тест `render.test.ts` прямо фиксирует этот случай: три последовательных `render(container, tpl, { update })` без `data` должны дать `callCount === 3` и менять `textContent` с `call-1` до `call-3`. Рядом добавлен контрольный тест, что явный неизменившийся объект `data` всё ещё пропускает повторный `update`.

## Почему это важно для вложенного `render`/`renderList`

В релиз также вошёл большой набор тестов для nested rendering: `render()` создаёт обёртку, внутри `update` вызывается `renderList()` для групп, а внутри групп — ещё один `renderList()` для блоков. Тесты проверяют, что библиотека:

- переиспользует внешний wrapper между обновлениями;
- переиспользует group и block элементы по ключам;
- умеет добавлять, удалять и переупорядочивать группы без разрушения вложенного состояния;
- очищает вложенную структуру при переключении внешнего template;
- восстанавливает вложенную структуру при переключении template обратно.

Это не отдельный новый API, но важное подтверждение исправления: повторный `render()` без `data` теперь действительно запускает outer `update`, а значит вложенные списки получают шанс синхронизироваться.

Условный пример такого паттерна:

```ts
render(container, wrapperTpl, {
  update(wrapper) {
    renderList(wrapper, groupTpl, {
      data: groups,
      key: group => group.pageId,
      update(groupEl, group) {
        renderList(groupEl.querySelector("[data-blocks]")!, blockTpl, {
          data: group.blocks,
          key: block => block.heading,
          update(blockEl, block) {
            blockEl.textContent = block.snippet;
          },
        });
      },
    });
  },
});
```

До исправления второй вызов такого outer `render()` без `data` мог не зайти в `update`, и вложенные `renderList()` вообще не выполнялись.

## `getElement` и `getElements`: отдельные overloads для тегов и Element-типов

Вторая пользовательская правка — TypeScript-рефакторинг `Context#getElement` и `Context#getElements`. Раньше методы были завязаны на один generic вида `E extends keyof HTMLElementTagNameMap`:

```ts
getElement<E extends keyof HTMLElementTagNameMap>(selector: E | string): HTMLElementTagNameMap[E];
getElements<E extends keyof HTMLElementTagNameMap>(selector: E | string): HTMLElementTagNameMap[E][];
```

Такая форма хорошо работает для вызова по имени HTML-тега, например `ctx.getElement("button")`, но плохо совпадает с уже существующим паттерном ref builders `one`/`many`, где можно явно указать тип элемента. В 0.15.0 overloads разделены:

```ts
getElement<const Tag extends keyof HTMLElementTagNameMap>(
  selector: Tag,
): HTMLElementTagNameMap[Tag];
getElement<E extends Element>(selector: string): E;
getElement(selector: string): Element;

getElements<const Tag extends keyof HTMLElementTagNameMap>(
  selector: Tag,
): HTMLElementTagNameMap[Tag][];
getElements<E extends Element>(selector: string): E[];
getElements(selector: string): Element[];
```

Те же варианты есть и для scoped-запросов с первым аргументом `root: DocumentFragment | Element`. Реализация при этом стала проще: runtime всё так же вызывает `querySelectorAll(selector)`, проверяет, что найден хотя бы один элемент, и бросает `invariant(..., "missing <selector>")`, если совпадений нет. Изменение касается именно типов.

Что это даёт на практике:

```ts
define("x-profile", ctx => {
  // tag-name overload: TypeScript выводит HTMLButtonElement
  const button = ctx.getElement("button");

  // explicit Element overload: удобно для custom element или CSS-селектора
  const avatar = ctx.getElement<HTMLElement & { src: string }>(".avatar");

  // scoped variant тоже поддерживает явный Element-тип
  const form = ctx.getElement("form");
  const fields = ctx.getElements<HTMLInputElement>(form, "[data-field]");
});
```

В тестах это закреплено через `expectTypeOf`: `ctx.getElement<CustomEl>(".item")` возвращает `CustomEl`, `ctx.getElements<CustomEl>(".item")` — `CustomEl[]`, а scoped-варианты с `container` возвращают те же типы.

## Небольшие сопутствующие изменения

В `packages/nanotags/package.json` версия поднята с `0.14.0` до `0.15.0`, а лимит для `.size-check/render.mjs` увеличен с `410 B` до `417 B`. Это согласуется с исправлением `render()`: в runtime добавилась проверка наличия свойства `data` и создание свежего fallback-объекта.

Ещё один не пользовательский, но заметный в diff пункт: GitHub Actions в `.github/workflows/*` и локальной composite action закреплены на конкретные commit SHA (`actions/checkout`, `actions/setup-node`, `upload-pages-artifact`, `deploy-pages`, `andresz1/size-limit-action`). На API `nanotags` это не влияет, но делает CI-конфигурацию воспроизводимее.

## Стоит ли обновляться

Да, особенно если вы используете `nanotags/render` без явного `data` или строите вложенный rendering через outer `render()` и inner `renderList()`. Исправление не требует миграции в пользовательском коде: прежний вызов `render(container, template, { update })` просто начинает стабильно выполнять `update` при повторных вызовах.

Если у вас есть типизированные DOM-запросы внутри `setup`, после обновления можно привести их к тому же стилю, что и refs:

```ts
const control = ctx.getElement<HTMLInputElement>("[data-control]");
const items = ctx.getElements<HTMLLIElement>("[data-item]");
```

Это особенно полезно для custom elements и селекторов, которые не являются буквальным ключом `HTMLElementTagNameMap`.

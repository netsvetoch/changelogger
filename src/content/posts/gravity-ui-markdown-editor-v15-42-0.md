---
author: Артём Нецветаев
pubDatetime: 2026-06-30T13:04:08.000Z
title: "@gravity-ui/markdown-editor 15.42.0: управление preview из API и аккуратная сериализация HTML-блоков"
slug: gravity-ui-markdown-editor-v15-42-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - markdown
  - editor
description: "Разбор минорного релиза @gravity-ui/markdown-editor v15.42.0: новый changePreviewVisible() для full-screen preview, событие change-preview-visible и исправления ToolbarSelect и YfmHtmlBlock."
---

Gravity UI выпустила минорный релиз [`@gravity-ui/markdown-editor v15.42.0`](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.42.0). В нём публичный API редактора получил управление full-screen preview в markup-режиме, а два исправления закрывают неприятные UI/serialization-регрессии: выпадающий список `ToolbarSelect` больше не фокусирует редактор при открытии, а `YfmHtmlBlock` сохраняет вложенную разметку внутри blockquote и list item без потери префиксов.

Источник для обзора — GitHub Release [`markdown-editor-v15.42.0`](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.42.0), compare [`markdown-editor-v15.41.1...markdown-editor-v15.42.0`](https://github.com/gravity-ui/markdown-editor/compare/markdown-editor-v15.41.1...markdown-editor-v15.42.0), а также PR [`#1153`](https://github.com/gravity-ui/markdown-editor/pull/1153), [`#1165`](https://github.com/gravity-ui/markdown-editor/pull/1165) и [`#1162`](https://github.com/gravity-ui/markdown-editor/pull/1162).

## `changePreviewVisible()` выносит preview из React state в публичный API

Главное изменение релиза — PR [`#1153`](https://github.com/gravity-ui/markdown-editor/pull/1153). До него full-screen preview markup-редактора жил как локальный React state внутри `MarkdownEditorView`: его можно было открыть из встроенного UI, но внешней интеграции приходилось повторять логику компонента или обходиться без программного переключения.

Теперь состояние preview хранится в `EditorImpl`, а публичный `MarkdownEditorInstance` получил два новых элемента:

```ts
readonly previewVisible: boolean;
changePreviewVisible(visible?: boolean): void;
```

`previewVisible` показывает, открыт ли сейчас full-screen preview. `changePreviewVisible(true)` явно открывает preview, `changePreviewVisible(false)` закрывает, а вызов без аргумента работает как toggle.

Пример внешней кнопки для собственного toolbar:

```tsx
function PreviewButton({ editor }: { editor: MarkdownEditorInstance }) {
  return (
    <button
      type="button"
      disabled={editor.currentMode !== "markup"}
      onClick={() => editor.changePreviewVisible()}
    >
      {editor.previewVisible ? "Скрыть preview" : "Показать preview"}
    </button>
  );
}
```

Важные ограничения тоже зафиксированы в тестах PR: метод ничего не делает, если в `markupConfig` не настроен `renderPreview`, и не включает preview, пока активен split mode. Повторный вызов с тем же значением (`changePreviewVisible(false)`, когда preview уже закрыт) не эмитит лишних событий.

## Новое событие `change-preview-visible`

Для интеграций, которым нужно синхронизировать собственный UI, в `EventMap` добавлено событие:

```ts
editor.on("change-preview-visible", ({ visible }) => {
  console.info("Preview visible:", visible);
});
```

Событие отправляется только при реальном изменении состояния. Внутри `EditorImpl` после изменения `#previewVisible` вызываются `rerender` и `change-preview-visible`, поэтому React-обёртка и внешний код получают один и тот же источник правды.

В demo playground релиза это уже используется напрямую: компонент слушает `change-preview-visible`, хранит `previewVisible` для текста пункта меню и вызывает `mdEditor.changePreviewVisible()` из `DropdownMenu.Item` `Toggle Preview (on/off)`.

## Preview и split mode остаются взаимоисключающими

PR [`#1153`](https://github.com/gravity-ui/markdown-editor/pull/1153) не просто добавляет метод, а аккуратно переносит существующее поведение в core editor. В `MarkdownEditorView` старый `useBooleanState(false)` для `showPreview` удалён, а UI теперь читает `editor.previewVisible`.

Практический эффект:

- переключение режима редактора вызывает `editor.changePreviewVisible(false)`, чтобы preview не оставался открытым после смены режима;
- checkbox/переключатель split mode вызывает `editor.changeSplitModeEnabled({splitModeEnabled})`, а открытый preview не пытается жить параллельно split mode;
- горячая клавиша preview теперь вызывает `editor.changePreviewVisible()` вместо локального toggle;
- submit с `hidePreviewAfterSubmit` закрывает preview через публичный метод.

Для проектов с кастомными контролами это важно: внешняя кнопка, встроенный toolbar и keyboard shortcut теперь изменяют одно состояние, а не несколько разрозненных React state.

## `ToolbarSelect` больше не фокусирует редактор при открытии списка

Исправление из PR [`#1165`](https://github.com/gravity-ui/markdown-editor/pull/1165) маленькое по diff, но заметное по UX. Раньше `ToolbarSelect` передавал `focus` напрямую в `onOpenChange` компонента `Select`:

```tsx
onOpenChange = { focus };
```

Это означало, что фокус возвращался в редактор и при закрытии, и при открытии dropdown. В релизе обработчик проверяет состояние открытия:

```tsx
onOpenChange={(open) => {
  if (!open) focus();
}}
```

Теперь редактор получает фокус обратно только после закрытия списка. Это устраняет сценарий, когда попытка открыть выпадающий список в toolbar тут же перебивалась фокусом редактора и список открывался некорректно.

## `YfmHtmlBlock` сохраняет вложенные HTML-блоки построчно

PR [`#1162`](https://github.com/gravity-ui/markdown-editor/pull/1162) чинит сериализацию `YfmHtmlBlock` для вложенных случаев. До исправления serializer писал весь `srcdoc` одной строковой операцией после `::: html`. Для многострочного HTML внутри blockquote или list item это могло ломать Markdown-обрамление: последующие строки теряли нужный `>` или list indentation.

В новой реализации serializer сначала убирает только структурный последний перевод строки, который приходит от parser перед закрывающим `:::`, затем пишет содержимое через `state.text(srcdoc, false)`. Именно `state.text()` даёт Markdown serializer возможность проставить корректные префиксы для каждой строки внутри текущего контекста.

Проверенные regression cases из тестов:

```md
> ::: html
> <div>one</div>
> <div>two</div>
> :::
```

и HTML-блок внутри list item:

```md
- ::: html
  <div>one</div>
  <div>two</div>
  :::
```

Отдельно добавлены тесты на намеренную trailing blank line внутри `srcdoc`. Релиз сохраняет пустую строку как содержимое, но отбрасывает служебный перевод строки перед закрывающим `:::`. Для верхнего уровня есть дополнительная проверка `srcdoc.endsWith('\n') && state.atBlank()`, чтобы финальная пустая строка была видима в сериализованном Markdown.

## Кому стоит обновиться

Релиз выглядит безопасным минорным обновлением: в GitHub Release нет breaking changes, а новые API вокруг preview добавлены без удаления старых публичных методов.

Обновление особенно полезно, если вы:

- строите собственные панели управления вокруг `MarkdownEditorInstance` и хотите открывать/закрывать full-screen preview программно;
- синхронизируете внешний UI с состоянием редактора и можете подписаться на `change-preview-visible`;
- используете toolbar select-компоненты и сталкивались с некорректным открытием dropdown;
- сохраняете YFM HTML-блоки внутри цитат или списков и хотите избежать повреждения `>`/indentation при сериализации.

## Как обновиться

```bash
pnpm add @gravity-ui/markdown-editor@15.42.0
```

Или через npm:

```bash
npm install @gravity-ui/markdown-editor@15.42.0
```

Если у вас есть кастомный preview UI, после обновления можно заменить локальное состояние на `editor.previewVisible` и `editor.changePreviewVisible()`, а для реактивной синхронизации подписаться на `change-preview-visible`.

## Ссылки

- [Release markdown-editor-v15.42.0](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.42.0)
- [Compare markdown-editor-v15.41.1...markdown-editor-v15.42.0](https://github.com/gravity-ui/markdown-editor/compare/markdown-editor-v15.41.1...markdown-editor-v15.42.0)
- [PR #1153: add `changePreviewVisible` method to editor api](https://github.com/gravity-ui/markdown-editor/pull/1153)
- [PR #1165: fixed opening of drop-down list in `ToolbarSelect`](https://github.com/gravity-ui/markdown-editor/pull/1165)
- [PR #1162: preserve nested `YfmHtmlBlock` serialization](https://github.com/gravity-ui/markdown-editor/pull/1162)

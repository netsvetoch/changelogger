---
author: Артём Нецветаев
pubDatetime: 2026-06-28T23:52:44.000Z
title: "@gravity-ui/markdown-editor 15.41.0: insert(), ссылки без лишнего протокола и новые YFM-таблицы"
slug: gravity-ui-markdown-editor-v15-41-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - markdown
  - editor
description: "Разбор минорного релиза @gravity-ui/markdown-editor v15.41.0: новый метод editor.insert(), более аккуратная вставка ссылок, фон и header rows в YFM-таблицах."
---

Gravity UI выпустила минорный релиз [`@gravity-ui/markdown-editor v15.41.0`](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.41.0). В нём есть одно изменение публичного API редактора, два заметных улучшения YFM-таблиц и небольшая, но полезная правка поведения при вставке ссылок из буфера.

Источник для обзора — GitHub Release [`gravity-ui/markdown-editor@markdown-editor-v15.41.0`](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.41.0), compare [`markdown-editor-v15.40.0...markdown-editor-v15.41.0`](https://github.com/gravity-ui/markdown-editor/compare/markdown-editor-v15.40.0...markdown-editor-v15.41.0), а также PR [`#1140`](https://github.com/gravity-ui/markdown-editor/pull/1140), [`#1043`](https://github.com/gravity-ui/markdown-editor/pull/1043), [`#1126`](https://github.com/gravity-ui/markdown-editor/pull/1126), [`#1132`](https://github.com/gravity-ui/markdown-editor/pull/1132) и [`#1123`](https://github.com/gravity-ui/markdown-editor/pull/1123).

## `editor.insert()` добавляет разметку в текущую позицию курсора

Главное API-изменение релиза — новый метод `insert(markup: MarkupString)` в публичном интерфейсе `MarkdownEditorInstance`. До этого у editor instance уже были операции вроде `prepend()` и `append()`, но они работали с началом или концом документа. `insert()` вставляет переданную Markdown/YFM-разметку туда, где сейчас стоит курсор, или заменяет выделенный фрагмент.

Из PR [`#1140`](https://github.com/gravity-ui/markdown-editor/pull/1140) видно, что метод добавлен сразу в несколько слоёв:

- `MarkdownEditorInstance` в `packages/editor/src/bundle/editor-public-types.ts` получил `insert(markup: MarkupString): void`;
- `EditorImpl` прокидывает вызов в текущую реализацию редактора;
- `ContentHandler` теперь тоже знает про `insert()`;
- WYSIWYG-редактор вставляет распарсенный ProseMirror `Slice`, а внутри code block вставляет строку как plain text;
- markup-редактор на CodeMirror использует `state.replaceSelection(markup)`.

Практический сценарий — тулбар или внешняя кнопка, которая добавляет сниппет в текущую позицию, а не в конец документа:

```tsx
function InsertCalloutButton({ editor }: { editor: MarkdownEditorInstance }) {
  return (
    <button
      type="button"
      onClick={() => {
        editor.insert("> [!note]\n> Важное замечание");
        editor.focus();
      }}
    >
      Вставить note
    </button>
  );
}
```

Тесты в PR покрывают несколько важных деталей поведения: inline-вставка превращает `hello world` в `hello inserted world`, выделенный `world` заменяется на `there`, block-разметка вроде `> quoted` вставляется отдельным blockquote, а внутри code block Markdown для изображения остаётся текстом `![](https://example.com/img.png)`, не превращаясь в картинку.

## Вставка ссылок больше не добавляет `http://` в видимый текст

PR [`#1043`](https://github.com/gravity-ui/markdown-editor/pull/1043) меняет обработку ссылок при paste. Раньше логика работала с одной строкой URL, поэтому bare hostname из буфера мог получить нормализованный протокол и в `href`, и в видимом тексте. Теперь код использует отдельный объект `PastedLink = {href: string; label: string}`: `href` нормализуется для ссылки, а `label` остаётся тем, что пользователь вставил.

Проверенный regression case из теста:

```md
[ya.ru](http://ya.ru)
```

То есть при вставке `ya.ru` редактор создаёт ссылку с `href="http://ya.ru"`, но текст внутри документа остаётся `ya.ru`, без визуального `http://`. Для email похожая логика даёт Markdown вида:

```md
[test@ya.ru](mailto:test@ya.ru)
```

Это особенно полезно для редакторов документации и комментариев: ссылка остаётся кликабельной и нормализованной, но пользователь не получает внезапно изменённый отображаемый текст.

## YFM-таблицы: фон строк и колонок через `cellBackground`

В PR [`#1126`](https://github.com/gravity-ui/markdown-editor/pull/1126) у расширения `YfmTable` появился opt-in параметр `cellBackground?: boolean`. Он работает только вместе с включёнными table controls: в коде опция передаётся в `yfmTableControlsPlugins({ cellBackgroundEnabled: options.cellBackground === true })`.

```ts
builder.use(YfmTable, {
  controls: true,
  cellBackground: true,
});
```

Когда опция включена, в floating menu строки и колонки появляется color picker. По PR это не просто UI-обёртка: добавлен атрибут ячейки `YfmTableAttr.CellBg = 'data-bg'`, команда `setCellBg({ tablePos, rows?, cols?, bg })` проходит по реальным ячейкам выбранных строк или колонок и выставляет `data-bg`, а serializer сохраняет цвет в YFM-разметку через `::{bg="..."}`.

Пример разметки, которую теперь может сохранить редактор:

```md
#|
||::{bg="yellow"}

Заголовок

|::{bg="blue"}

Значение

||
|#
```

В визуальных тестах проверены сценарии для строки и колонки отдельно: выбор `Yellow` у строки выставляет `data-bg="yellow"` на все ячейки этой строки, выбор `Blue` у колонки — на ячейки выбранной колонки. Также есть проверка `No color`, которая очищает `data-bg`, и кейс, где цвет колонки перезаписывает цвет пересекающейся ячейки строки. В PR указано важное условие совместимости: сохранение в Markdown через `::{bg="..."}` требует `@diplodoc/transform` версии `4.75.0` или выше.

## YFM-таблицы: header rows в разметке и UI

PR [`#1132`](https://github.com/gravity-ui/markdown-editor/pull/1132) добавляет поддержку строк-заголовков в YFM-таблицах. Новая опция расширения называется `headerRows?: boolean`, тоже opt-in и тоже требует включённых `controls`.

```ts
builder.use(YfmTable, {
  controls: true,
  headerRows: true,
});
```

На уровне схемы у table node появился атрибут `YfmTableAttr.HeaderRows = 'data-header-rows'`. Parser читает количество header rows из `token.meta?.headerRows`, DOM parser дополнительно умеет взять значение из `data-header-rows` или посчитать строки в `<thead>`, а serializer пишет YFM-директиву перед телом таблицы:

```md
#|
|:{header-rows="1"}
||

Header 1

|

Header 2

||
||

Cell 1

|

Cell 2

||
|#
```

UI-часть добавляет переключатель в row menu. Команда `toggleHeaderRows({ tablePos, value })` ограничивает значение диапазоном от `0` до количества строк таблицы и меняет `data-header-rows` у table node. В тестах есть важное ограничение для сложных таблиц: не любую строку можно сделать header. Функция `canMakeRowHeader()` разрешает первую строку, а следующую — только если она визуально «приклеена» к текущему header-блоку через `rowspan`, который пересекает границу header/body.

Релиз также синхронизирует поведение editing-команд с новой моделью header rows:

- вставка строки внутрь header-блока уменьшает `header-rows`, чтобы новая строка и всё ниже перестали быть заголовком;
- удаление header-строк уменьшает счётчик на количество удалённых header rows;
- drag-and-drop для header rows запрещён, чтобы не ломать header-секцию;
- при переносе обычных строк вокруг header-блока счётчик пересчитывается.

Для проектов, которые рендерят таблицы с accessibility-требованиями, это более конкретное улучшение, чем просто «поддержка заголовков»: редактор теперь сохраняет header rows в Markdown, восстанавливает их при повторном открытии и декорирует строки в DOM (`data-header`, `columnheader` roles в реализации PR).

## Мелкие исправления английской локализации

В [`#1123`](https://github.com/gravity-ui/markdown-editor/pull/1123) поправлены несколько строк English i18n:

- `Adress the image link leads to.` → `Address the image link leads to.`;
- GPT-кнопка `To the beginning` переименована в `Start over`;
- пункт меню `More action` стал `More actions`;
- в подсказке настроек guillemets вокруг `+` заменены на обычные английские кавычки.

Это не требует действий при обновлении, но уменьшает шероховатости в английском интерфейсе редактора.

## Кому стоит обновиться

Релиз выглядит безопасным минорным обновлением: в GitHub Release нет явных breaking changes, а новые возможности в YFM-таблицах включаются через opt-in flags.

Обновление особенно интересно, если вы:

- добавляете кастомные кнопки или slash-команды и хотите вставлять Markdown в текущую позицию курсора через `editor.insert()`;
- обрабатываете paste ссылок и не хотите, чтобы нормализация URL меняла видимый текст;
- используете YFM-таблицы и хотите дать редакторам фон строк/колонок без ручной правки Markdown;
- хотите сохранять header rows в YFM-разметке и управлять ими из row menu.

## Как обновиться

```bash
pnpm add @gravity-ui/markdown-editor@15.41.0
```

Или через npm:

```bash
npm install @gravity-ui/markdown-editor@15.41.0
```

Если включаете `cellBackground` или `headerRows`, проверьте версию `@diplodoc/transform`: в PR для обеих возможностей указан минимум `4.75.0`, а в релизе с header rows workspace dependency поднята до `4.75.1`.

## Ссылки

- [Release markdown-editor-v15.41.0](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.41.0)
- [Compare markdown-editor-v15.40.0...markdown-editor-v15.41.0](https://github.com/gravity-ui/markdown-editor/compare/markdown-editor-v15.40.0...markdown-editor-v15.41.0)
- [PR #1140: add `insert()` method to editor API](https://github.com/gravity-ui/markdown-editor/pull/1140)
- [PR #1043: link paste visible text](https://github.com/gravity-ui/markdown-editor/pull/1043)
- [PR #1126: YFM table cell background](https://github.com/gravity-ui/markdown-editor/pull/1126)
- [PR #1132: YFM table header rows](https://github.com/gravity-ui/markdown-editor/pull/1132)

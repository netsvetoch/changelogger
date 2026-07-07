---
author: Артём Нецветаев
pubDatetime: 2026-07-07T11:01:50.000Z
title: "@gravity-ui/markdown-editor 15.43.0: новый UI ссылок и аккуратные цвета YFM-таблиц"
slug: gravity-ui-markdown-editor-v15-43-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - markdown
  - editor
description: "Разбор минорного релиза @gravity-ui/markdown-editor v15.43.0: новая форма создания и редактирования ссылок, наследование фона в YFM-таблицах, безопасная сериализация code block с внутренними fence-последовательностями."
---

Gravity UI выпустила минорный релиз [`@gravity-ui/markdown-editor v15.43.0`](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.43.0). В нём заметно переработали UX ссылок в WYSIWYG, довели работу с цветами YFM-таблиц до более предсказуемого поведения и закрыли важный edge case сериализации fenced code block: если внутри кода встречаются ` ``` ` или `~~~`, редактор больше не закрывает блок раньше времени.

Источник для обзора — GitHub Release [`markdown-editor-v15.43.0`](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.43.0), compare [`markdown-editor-v15.42.0...markdown-editor-v15.43.0`](https://github.com/gravity-ui/markdown-editor/compare/markdown-editor-v15.42.0...markdown-editor-v15.43.0), а также PR [`#1154`](https://github.com/gravity-ui/markdown-editor/pull/1154), [`#1170`](https://github.com/gravity-ui/markdown-editor/pull/1170), [`#1169`](https://github.com/gravity-ui/markdown-editor/pull/1169), [`#1172`](https://github.com/gravity-ui/markdown-editor/pull/1172), [`#1168`](https://github.com/gravity-ui/markdown-editor/pull/1168) и [`#1173`](https://github.com/gravity-ui/markdown-editor/pull/1173).

## Ссылки: одна компактная форма вместо старого Form.Layout

Самое крупное изменение релиза — PR [`#1154`](https://github.com/gravity-ui/markdown-editor/pull/1154). Старый компонент `LinkForm.tsx` удалён: раньше форма создания ссылки была собрана на `Form.Form`, `Form.Row`, `UrlInputRow`, `TextInput` и footer-кнопках submit/cancel. В 15.43.0 вместо него появился новый `packages/editor/src/forms/Link.tsx` и стиль `Link.scss`.

Новый компонент экспортирует явный payload для submit:

```ts
export type LinkSubmitParams = {
  url: string;
  text: string;
};

export type LinkProps = {
  autoFocus?: boolean;
  initialUrl?: string;
  initialText?: string;
  readOnlyText?: boolean;
  onSubmit(params: LinkSubmitParams): void;
  onUrlChange?: (url: string) => void;
  onTextChange?: (text: string) => void;
};
```

Практически это означает, что форма теперь состоит из двух больших `TextInputFixed` (`size="l"`) с `hasClear`: поле адреса и поле текста ссылки. Кнопка действия одна — `Button view="action" size="l"`, она disabled, пока `url` пустой. Для локализации добавлены новые ключи `link-href-placeholder`, `link-name-placeholder` и `link_add`; в русской локали это «Адрес ссылки», «Текст, который отобразится как ссылка» и «Добавить ссылку».

## Закрытие popup теперь может сохранить ссылку

PR [`#1154`](https://github.com/gravity-ui/markdown-editor/pull/1154) меняет не только внешний вид, но и поведение `PlaceholderWidget`. Раньше `Popup` создания ссылки на любое закрытие вызывал `onCancel`. Теперь widget хранит текущие значения в `useRef` через новые callbacks `onUrlChange` и `onTextChange`, а `onOpenChange` различает причину закрытия:

```tsx
const handleOpenChange: NonNullable<PopupProps["onOpenChange"]> = (
  open,
  _event,
  reason
) => {
  if (open) return;

  if (reason === "escape-key") {
    onCancel();
    return;
  }

  const url = currentUrlRef.current.trim();
  if (url) {
    onSubmit({ url, text: currentTextRef.current });
  } else {
    onCancel();
  }
};
```

То есть Escape по-прежнему отменяет создание ссылки, но клик вне popup с заполненным URL теперь создаёт ссылку. В visual tests это закреплено отдельным сценарием: тест открывает toolbar-кнопку `Link`, вводит `gravity-ui.com`, кликает по координате `(0, 0)` вне формы и проверяет, что текст `gravity-ui.com` появился в `contenteditable`.

## Редактирование ссылки получило действия «удалить» и «открыть»

В `LinkTooltipPlugin` старый tooltip на `Popup + LinkForm` заменён на новый компактный `TooltipView.tsx`. В нём `TextInputFixed` работает в `view="clear"`, а справа показываются две icon-кнопки, если URL непустой:

- `LinkSlash` с tooltip `link_remove_help` снимает mark ссылки с диапазона `from..to` через `tr.removeMark(from, to, linkType(schema))`;
- `ArrowUpRightFromSquare` открывает URL в новой вкладке с `target="_blank"` и `rel="noopener noreferrer"`.

Логика закрытия edit-tooltip тоже стала осторожнее. При закрытии по Escape вызывается `cancelPopup()`. Клик по toolbar-кнопкам undo/redo только скрывает tooltip, чтобы не перезаписать ссылку случайным submit. Во всех остальных outside-click случаях plugin смотрит на текущий URL: пустой URL удаляет ссылку, непустой вызывает `changeAttrs({href: url})`.

Для пользователей это исправляет неприятный сценарий из старого UI: изменения текста/адреса ссылки теперь не теряются при закрытии popup вне кнопки submit, а редактирование существующей ссылки получило явное удаление без поиска отдельной команды.

## YFM-таблицы наследуют фон при добавлении строк и колонок

PR [`#1170`](https://github.com/gravity-ui/markdown-editor/pull/1170) добавляет поведение, которого не хватало при ручной разметке таблиц: новая строка или колонка наследует `bg` от исходной строки/колонки, из которой пользователь запустил вставку.

В командах появились новые параметры:

```ts
export type InsertEmptyRowParams = {
  tablePos: number;
  rowIndex: number;
  sourceRowIndex?: number;
};

export type InsertEmptyColumnParams = {
  tablePos: number;
  colIndex: number;
  sourceColIndex?: number;
};
```

`yfm-table-cell-view.tsx` и `yfm-table-view.tsx` теперь передают индекс исходной строки или колонки: для add-before — начало диапазона, для add-after — конец диапазона. Внутри `insert-empty-row.ts` собирается массив `newCellBgs`, а `createSimpleRow()` создаёт новые ячейки с атрибутом `{[YfmTableAttr.CellBg]: bg}` там, где фон найден. В `insert-empty-column.ts` аналогичная логика хранит пары `{pos, bg}` и создаёт `td.createAndFill(bg ? {[YfmTableAttr.CellBg]: bg} : undefined)`.

Для merged cells добавлен helper `getCellBg(tableDesc, rowIdx, colIdx)`: если позиция указывает на virtual cell, он идёт к реальной ячейке через `rowspan` или `colspan` и берёт `YfmTableAttr.CellBg` уже оттуда.

Пример исходной YFM-таблицы из regression tests:

```md
#|
||::{bg="yellow"} one |::{bg="blue"} two ||
||::{bg="green"} three | four ||
|#
```

Проверки покрывают четыре сценария: добавить строку после, строку до, колонку после и колонку до. Например, при добавлении колонки после первой ячейки новые cells получают `yellow` и `green`, а существующие `blue` и пустой фон остаются на своих местах.

## Цвет строки/колонки применяется даже если первая ячейка уже была нужного цвета

Исправление [`#1168`](https://github.com/gravity-ui/markdown-editor/pull/1168) закрывает более тонкий баг YFM-таблиц. До релиза, если первая ячейка строки уже имела выбранный цвет, повторный выбор этого же цвета в palette мог ничего не сделать: `CellBgPalette` отбрасывал click, когда `swatchValue === value`, и остальные ячейки строки/колонки не получали фон.

В 15.43.0 ранний return из `CellBgPalette` удалён, поэтому выбор того же swatch всё равно отправляет действие наверх. Заодно `set-cell-bg.ts` стал сравнивать старое и новое значение на уровне каждой конкретной ячейки:

```ts
const newBgValue = params.bg || null;

const apply = cellPos => {
  if (cellPos.type !== "real") return;
  const node = state.doc.nodeAt(cellPos.from);
  if (!node || node.attrs[YfmTableAttr.CellBg] === newBgValue) return;
  tr.setNodeAttribute(
    tr.mapping.map(cellPos.from),
    YfmTableAttr.CellBg,
    newBgValue
  );
};
```

Так уже окрашенная первая ячейка пропускается, но соседние реальные ячейки с другим или пустым `data-bg` всё равно обновляются. Тесты проверяют оба случая: строка, где первая ячейка уже `yellow`, и колонка, где первая ячейка уже `blue`.

## Выделение ячеек больше не перекрашивает фон

PR [`#1169`](https://github.com/gravity-ui/markdown-editor/pull/1169) меняет SCSS drag-and-drop выделения YFM-таблиц. Из `dnd.scss` удалено правило:

```scss
&:not([class*="cell-bg-"]) {
  background-color: var(--g-color-base-selection);
}
```

После этого selected cells во время drag-and-drop больше не получают дополнительный generic background. Для таблиц с цветными ячейками это важно визуально: выделение оставляет border/overlay, но не создаёт впечатление, что сам `bg` ячейки изменился.

## CodeBlock выбирает fence длиннее внутренней последовательности

PR [`#1172`](https://github.com/gravity-ui/markdown-editor/pull/1172) исправляет сериализацию fenced code blocks. Старый serializer брал `node.attrs[CodeBlockNodeAttr.Markup]` и писал те же opening/closing markers вокруг `node.textContent`. Если сам код содержал строку с такой же fence-последовательностью, Markdown закрывался раньше времени.

Теперь `CodeBlockSpecs/index.ts` вычисляет безопасный fence:

````ts
function getCodeBlockFence(markup: string, content: string): string {
  markup = markup.trim() || "```";
  const fenceChar = markup.startsWith("~") ? "~" : "`";
  let length = Math.max(markup.length, 3);

  const match = content.match(fenceChar === "~" ? /~{3,}/g : /`{3,}/g);
  if (match) {
    const longest = match.reduce((max, run) => Math.max(max, run.length), 0);
    if (longest >= length) {
      length = longest + 1;
    }
  }

  return fenceChar.repeat(length);
}
````

Поведение из тестов:

- содержимое с ` ``` ` сериализуется во внешний fence из четырёх backticks;
- содержимое с ` ` ```` сериализуется во внешний fence из пяти backticks;
- для tilde-блоков работает тот же принцип: `~~~` внутри контента заворачивается в `~~~~`;
- backtick-fence не удлиняется только из-за `~~~` внутри контента, и наоборот.

Это особенно важно для редакторов документации и changelog-постов, где внутри code block часто показывают Markdown-примеры с вложенными fenced blocks.

## Логирование цвета в YFM-таблицах стало информативнее

Небольшой фикс [`#1173`](https://github.com/gravity-ui/markdown-editor/pull/1173) меняет analytics events для выбора фона строки и колонки. Раньше события отправлялись только с `event` и `source`:

```ts
this._logger.event({ event: "row-set-cell-bg", source: "row-menu" });
this._logger.event({ event: "column-set-cell-bg", source: "column-menu" });
```

Теперь payload включает выбранное значение:

```ts
this._logger.event({
  event: "row-set-cell-bg",
  source: "row-menu",
  value: bg || "no-color",
});
```

Для продуктовой аналитики это различает выбор конкретного цвета и действие «без цвета» (`no-color`) без необходимости восстанавливать контекст из состояния документа.

## Кому стоит обновиться

Релиз выглядит безопасным минорным обновлением: GitHub Release не содержит breaking changes, а изменения в публичном API ограничены новым внутренним React-компонентом формы ссылок и новыми callback-ами, которые используются самим редактором.

Обновление особенно полезно, если вы:

- активно работаете со ссылками в WYSIWYG и хотите, чтобы outside click с заполненным URL сохранял ссылку;
- редактируете ссылки через tooltip и хотите быстро удалить mark или открыть текущий URL в новой вкладке;
- используете YFM-таблицы с цветными ячейками и часто добавляете соседние строки/колонки;
- сохраняете Markdown-документы, где code block может содержать вложенные ` ``` ` или `~~~`;
- собираете аналитику по действиям с фоном строк/колонок таблиц.

## Как обновиться

```bash
pnpm add @gravity-ui/markdown-editor@15.43.0
```

Или через npm:

```bash
npm install @gravity-ui/markdown-editor@15.43.0
```

После обновления стоит вручную проверить свои сценарии создания ссылок, если поверх редактора есть кастомные toolbar/tooltip-интеграции: поведение закрытия popup стало более «сохраняющим», а Escape остался явной отменой.

## Ссылки

- [Release markdown-editor-v15.43.0](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.43.0)
- [Compare markdown-editor-v15.42.0...markdown-editor-v15.43.0](https://github.com/gravity-ui/markdown-editor/compare/markdown-editor-v15.42.0...markdown-editor-v15.43.0)
- [PR #1154: update link creation and editing view](https://github.com/gravity-ui/markdown-editor/pull/1154)
- [PR #1170: inherit cell background on row/column add](https://github.com/gravity-ui/markdown-editor/pull/1170)
- [PR #1169: remove background from selected table cells](https://github.com/gravity-ui/markdown-editor/pull/1169)
- [PR #1172: preserve code content containing fence sequences](https://github.com/gravity-ui/markdown-editor/pull/1172)
- [PR #1168: fix color propagation to already colored cells](https://github.com/gravity-ui/markdown-editor/pull/1168)
- [PR #1173: include color value in row/column bg logging events](https://github.com/gravity-ui/markdown-editor/pull/1173)

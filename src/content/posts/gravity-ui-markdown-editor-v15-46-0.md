---
author: Артём Нецветаев
pubDatetime: 2026-08-15T01:20:20.000Z
title: "@gravity-ui/markdown-editor 15.46.0: latex-extension v2, paste pipe-таблиц и Opt+Shift+A на macOS"
slug: gravity-ui-markdown-editor-v15-46-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - markdown
  - editor
  - latex
  - tables
description: "Разбор минорного релиза @gravity-ui/markdown-editor v15.46.0: поддержка @diplodoc/latex-extension v2, вставка Markdown-таблиц из text/plain, исправление Opt+Shift+A в markup-режиме на macOS и миграция specs расширений на новые builder API."
---

Gravity UI выпустила минорный релиз [`@gravity-ui/markdown-editor v15.46.0`](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.46.0). В нём одно функциональное изменение — разрешение peer-диапазона `@diplodoc/latex-extension` на major v2 — плюс практичные фиксы paste таблиц и macOS-клавиатуры в markup-режиме. Параллельно базовые Markdown-расширения перевели регистрацию nodes/marks на новые методы builder.

Источник — [GitHub Release `markdown-editor-v15.46.0`](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.46.0), [compare с 15.45.0](https://github.com/gravity-ui/markdown-editor/compare/markdown-editor-v15.45.0...markdown-editor-v15.46.0) и связанные PR/коммиты ниже.

## `@diplodoc/latex-extension`: можно ставить v2

Главный feature-пункт релиза — [PR #1209](https://github.com/gravity-ui/markdown-editor/pull/1209) / [`4db7052`](https://github.com/gravity-ui/markdown-editor/commit/4db7052f3f5c77dff7c961031e5e6192aabdaec9).

Раньше и `packages/editor`, и workspace-пакет `packages/latex-extension` требовали только v1:

```json
"@diplodoc/latex-extension": "^1.0.3"
```

Теперь диапазон расширен до dual-major:

```json
"@diplodoc/latex-extension": "^1.0.3 || ^2.0.0"
```

То же самое указано:

- в `dependencies` у `@gravity-ui/markdown-editor` (`packages/editor/package.json`);
- в `peerDependencies` у `@gravity-ui/markdown-editor-latex-extension`.

В monorepo-каталоге `pnpm-workspace.yaml` default для dev/demo сдвинули на `^2.0.2`, а в `packages/latex-extension` сам `@diplodoc/latex-extension` перенесли из runtime `dependencies` в `devDependencies` (peer остаётся контрактом для потребителей).

Практически это значит: можно обновить `@diplodoc/latex-extension` до 2.x, не ждать отдельного major у markdown-editor, и при этом v1 по-прежнему валиден. Если вы уже на v1 и не трогаете latex-стек — миграция не обязательна.

```bash
pnpm add @gravity-ui/markdown-editor@15.46.0 @diplodoc/latex-extension@^2.0.2
```

## Paste Markdown-таблиц из plain text

[PR #1188](https://github.com/gravity-ui/markdown-editor/pull/1188) / [`3f9aa5e`](https://github.com/gravity-ui/markdown-editor/commit/3f9aa5e7872f9814bce0a3101f30a0c920f3219f) чинит вставку pipe-таблиц, когда в буфере одновременно есть `text/plain` и `text/html`.

Добавлен ProseMirror-плагин `markdownTablePastePlugin` с `builder.Priority.High`. Он перехватывает `paste` раньше обычного HTML-пути, если:

1. в clipboard нет YFM-формата (`DataTransferType.Yfm`);
2. курсор не внутри code;
3. plain text выглядит как pipe-таблица: после `trim()` строка начинается и заканчивается на `|`;
4. `textParser.parse(text)` даёт ровно один root-узел типа table.

```ts
export function isPipeTableCandidate(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function parsePipedMarkdownTable(text: string, parser: Parser): Slice | null {
  if (!isPipeTableCandidate(text)) return null;

  try {
    const content = parser.parse(text).content;
    return content.childCount === 1 &&
      content.firstChild?.type.name === TableNode.Table
      ? new Slice(content, 0, 0)
      : null;
  } catch {
    return null;
  }
}
```

Плагин подключается в extension `Table`:

```ts
builder.addPlugin(markdownTablePastePlugin, builder.Priority.High);
```

Типичный сценарий: копируете таблицу из Markdown-файла или чата, а браузер/ОС кладёт в clipboard и HTML-вариант. Раньше HTML-ветка могла «съедать» строки; теперь приоритет у plain Markdown, если он парсится в одну таблицу. Если текст лишь «похож» на pipe (`| not a table |`) или рядом есть extra nodes (`таблица + текст`), плагин не вмешивается и остаётся прежний HTML/text fallback.

## Markup-режим на macOS: Opt+Shift+A снова печатает символ

[PR #1208](https://github.com/gravity-ui/markdown-editor/pull/1208) / [`fcab4b7`](https://github.com/gravity-ui/markdown-editor/commit/fcab4b757b9493ee951e9c52e8fcec2d023b2e31) убирает конфликт с CodeMirror `defaultKeymap`.

В markup-режиме `@codemirror/commands` биндит:

```js
{ key: "Alt-A", run: toggleBlockComment }
```

На macOS `Opt+Shift+A` на US-раскладке даёт символ `Å`. Из-за того, как `w3c-keyname` резолвит Alt-комбинации по key code, событие попадало в `Alt-A` и вместо символа вставлялся HTML-комментарий `<!--  -->`.

В `createCodemirror` на macOS этот binding вырезают из `defaultKeymap`:

```ts
...defaultKeymap.filter(
  (binding) => !(isMac() && (binding.mac || binding.key) === "Alt-A"),
),
```

Block comment на macOS не пропадает: `Mod-/` (`toggleComment`) для Markdown без line-comment синтаксиса и так падает в block comments. Остальные платформы не затронуты. Фикс помечен как временный workaround до upstream-override в CodeMirror.

## Рефакторинг specs: `addNode` / `addMark` → новые builder methods

Большой блок changelog — серия однотипных PR (#1196–#1206): `Blockquote`, `Bold`, `Breaks`, `Code`, `Deflist`, `Heading`, `HorizontalRule`, `Html`, `Image`, `Italic`, `Table`.

Старый монолитный регистратор:

```ts
builder.addMark(boldMarkName, () => ({
  spec: {/* ProseMirror mark spec */},
  fromMd: {
    tokenSpec: {/* markdown-it token → mark */},
  },
  toMd: {/* mark → markdown */},
}));
```

заменён цепочкой специализированных методов:

```ts
builder
  .addMarkSpec(boldMarkName, () => ({/* ProseMirror mark spec */}))
  .addMarkdownTokenParserSpec(boldMarkName, () => ({
    name: boldMarkName,
    type: "mark",
    getAttrs: token => ({
      [BoldAttrs.Markup]: token.markup,
    }),
  }))
  .addMarkSerializerSpec(boldMarkName, () => ({
    open: getMarkup,
    close: getMarkup,
    mixable: true,
    expelEnclosingWhitespace: true,
  }));
```

Для nodes картина та же: `addNode` → `addNodeSpec` + `addMarkdownTokenParserSpec` + `addNodeSerializerSpec`. Поведение Markdown/ProseMirror для этих built-in расширений по смыслу не менялось — это внутренняя миграция на API builder, которое уже использовалось в более новых частях редактора. Если вы пишете кастомные extensions через старые `addNode`/`addMark`, этот релиз сам по себе их не ломает, но показывает целевой стиль регистрации specs.

## Прочее

- **docs:** [PR #1187](https://github.com/gravity-ui/markdown-editor/issues/1187) / [`f70a596`](https://github.com/gravity-ui/markdown-editor/commit/f70a596f1c2e147ad11ec73645f1a3d2c5f35863) — починка сборки package docs (инфраструктура документации, не runtime API редактора).

## Кому обновляться в первую очередь

- Командам, которые хотят перейти на `@diplodoc/latex-extension` 2.x без major bump markdown-editor.
- Тем, кто часто копирует pipe-таблицы из Markdown/чатов в WYSIWYG и терял строки из-за HTML clipboard.
- Пользователям markup-режима на macOS, которым нужен ввод `Å` / Opt+Shift+A без превращения в HTML-комментарий.
- Авторам кастомных extensions — как ориентир на `addNodeSpec` / `addMarkSpec` и раздельные parser/serializer specs.

## Как обновиться

```bash
pnpm add @gravity-ui/markdown-editor@15.46.0
```

Или через npm:

```bash
npm install @gravity-ui/markdown-editor@15.46.0
```

После обновления имеет смысл проверить:

1. latex-рендер на `@diplodoc/latex-extension@2`, если вы его поднимаете;
2. paste таблицы вида `| a | b |\n| --- | --- |\n| 1 | 2 |` при наличии HTML в clipboard;
3. на macOS в markup-режиме — `Opt+Shift+A` и запасной `Cmd+/` для block comment.

## Ссылки

- [Release markdown-editor-v15.46.0](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.46.0)
- [Compare markdown-editor-v15.45.0...markdown-editor-v15.46.0](https://github.com/gravity-ui/markdown-editor/compare/markdown-editor-v15.45.0...markdown-editor-v15.46.0)
- [PR #1209: allow latex-extension v2](https://github.com/gravity-ui/markdown-editor/pull/1209)
- [PR #1188: insert markdown tables from plain text](https://github.com/gravity-ui/markdown-editor/pull/1188)
- [PR #1208: keep Opt+Shift+A typable on macOS](https://github.com/gravity-ui/markdown-editor/pull/1208)
- [Commit `4db7052`](https://github.com/gravity-ui/markdown-editor/commit/4db7052f3f5c77dff7c961031e5e6192aabdaec9)
- [Commit `3f9aa5e`](https://github.com/gravity-ui/markdown-editor/commit/3f9aa5e7872f9814bce0a3101f30a0c920f3219f)
- [Commit `fcab4b7`](https://github.com/gravity-ui/markdown-editor/commit/fcab4b757b9493ee951e9c52e8fcec2d023b2e31)

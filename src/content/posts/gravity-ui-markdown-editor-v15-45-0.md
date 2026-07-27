---
author: Артём Нецветаев
pubDatetime: 2026-07-27T12:53:18.000Z
title: "@gravity-ui/markdown-editor 15.45.0: подмена URL изображений без изменения Markdown"
slug: gravity-ui-markdown-editor-v15-45-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - markdown
  - editor
  - images
description: "Разбор минорного релиза @gravity-ui/markdown-editor v15.45.0: опция ImgSize resolveImageSrc для отображения относительных путей к изображениям без изменения атрибутов узла и исходного Markdown."
---

Gravity UI выпустила минорный релиз [`@gravity-ui/markdown-editor v15.45.0`](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.45.0). В нём одно функциональное изменение: расширение `ImgSize` получило callback `resolveImageSrc`, который преобразует адрес изображения только перед рендерингом в `<img>`.

Источник — [GitHub Release `markdown-editor-v15.45.0`](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.45.0), его [compare с 15.44.0](https://github.com/gravity-ui/markdown-editor/compare/markdown-editor-v15.44.0...markdown-editor-v15.45.0) и PR [#1186](https://github.com/gravity-ui/markdown-editor/pull/1186). В диапазоне релиза два коммита: реализация этой возможности и release-коммит с версией пакета.

## `resolveImageSrc`: отдельный URL для отображения

Новая опция входит в `ImgSizeOptions`:

```ts
resolveImageSrc?: (src: string) => string;
```

Она нужна хост-приложениям, где относительный путь из Markdown не доступен браузеру напрямую. В описании PR приведён пример webview VS Code: путь `./img.png` может быть корректной частью документа, но не быть URL, который сможет загрузить `<img>` внутри webview.

Теперь приложение может сопоставить исходный путь с доступным URL при настройке WYSIWYG-редактора:

```tsx
const resolveImageSrc = (src: string) => {
  const images: Record<string, string> = {
    "./avatar.jpg": "https://cdn.example.com/doc-assets/avatar.jpg",
  };

  return images[src] ?? src;
};

const editor = useMarkdownEditor({
  initial: {
    mode: "wysiwyg",
    markup: "![Avatar](./avatar.jpg =320x200)",
  },
  wysiwygConfig: {
    extensionOptions: {
      imgSize: { resolveImageSrc },
    },
  },
});
```

Это не новая схема хранения изображений и не загрузчик файлов: callback получает строковый `src` и синхронно возвращает строковый URL. Если преобразование не требуется, можно вернуть исходное значение — именно так устроен официальный demo для этой возможности.

## Что остаётся в документе

Ключевое свойство изменения — разделение отображаемого и сохранённого адресов. В `ImageNodeView` реализация сначала читает исходный `src` из `node.attrs`, затем вычисляет адрес для DOM:

```ts
const rawSrc = node.attrs[ImgSizeAttr.Src] || "";
const src = extensionOptions?.resolveImageSrc?.(rawSrc) ?? rawSrc;

<img src={src} alt={alt} />;
```

`rawSrc` остаётся источником данных для атрибутов ноды и сериализации Markdown. Поэтому при отображении `./avatar.jpg` через CDN или специальную webview-схему исходная разметка по-прежнему содержит `./avatar.jpg`; callback не записывает преобразованный URL в документ. Это же означает, что настройки размера изображения и UI-кнопка `ImgSettingsButton`, которые читают `node.attrs`, продолжают работать с исходным адресом.

## Ошибка загрузки возвращает изображение в текст Markdown

В том же изменении обработчик `onError` у `<img>` использует именно исходный путь. Если браузер не смог загрузить уже преобразованный URL, node view заменяет image-ноду текстом:

```ts
const text = view.state.schema.text(`![${alt}](${rawSrc})`);

view.dispatch(
  view.state.tr
    .replaceWith(pos, pos + node.nodeSize, text)
    .setMeta("image-load-failed", rawSrc)
);
```

Таким образом, fallback не теряет ссылку на исходный файл и не сохраняет временный display-URL в Markdown. Это полезно для редакторов документации: пользователь видит обычную Markdown-запись, которую можно исправить вручную, а интеграция может отследить транзакцию по meta-ключу `image-load-failed`.

## Кому стоит обновиться

Версия 15.45.0 адресована прежде всего интеграторам `@gravity-ui/markdown-editor`, которые показывают документы из файловой системы, desktop/webview-среды или собственного хранилища ассетов. Если относительные URL уже открываются в браузере, обновление не требует миграции: `resolveImageSrc` необязателен, а без него `ImgSize` использует исходный `src` как раньше.

## Как обновиться

```bash
pnpm add @gravity-ui/markdown-editor@15.45.0
```

Или через npm:

```bash
npm install @gravity-ui/markdown-editor@15.45.0
```

После добавления callback стоит проверить два сценария: что преобразованный URL загружается в WYSIWYG, а при ошибке загрузки исходный Markdown-путь остаётся доступен пользователю.

## Ссылки

- [Release markdown-editor-v15.45.0](https://github.com/gravity-ui/markdown-editor/releases/tag/markdown-editor-v15.45.0)
- [Compare markdown-editor-v15.44.0...markdown-editor-v15.45.0](https://github.com/gravity-ui/markdown-editor/compare/markdown-editor-v15.44.0...markdown-editor-v15.45.0)
- [PR #1186: add ability to override relative image URLs](https://github.com/gravity-ui/markdown-editor/pull/1186)
- [Commit `fa6ca63`: реализация `resolveImageSrc`](https://github.com/gravity-ui/markdown-editor/commit/fa6ca637672e0ecd61b4d19e1a8b3a31f59b1537)

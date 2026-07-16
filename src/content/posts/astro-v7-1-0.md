---
author: Артём Нецветаев
pubDatetime: 2026-07-16T13:13:37.000Z
title: "Astro 7.1.0: отложенный рендеринг контента, chunked storage и точный CSP"
slug: astro-v7-1-0
featured: false
draft: false
tags:
  - release
  - astro
  - frontend
  - content
  - security
description: "Обзор Astro 7.1.0: deferRender для glob(), экспериментальное chunked-хранилище content layer, CSP-директивы для элементов и атрибутов, форматирование URL пагинации, --ignore-lock и URL entrypoint для logger."
---

Astro выпустил минорный релиз [`astro@7.1.0`](https://github.com/withastro/astro/releases/tag/astro%407.1.0). В нём шесть новых возможностей: контентные коллекции можно рендерить по требованию, data store — разбивать на content-addressed части, CSP — настраивать отдельно для элементов и атрибутов, а URL пагинации — преобразовывать перед публикацией. Кроме того, `astro dev` получил `--ignore-lock`, а пользовательский logger теперь принимает `URL`.

Ниже — не пересказ заголовков changeset'ов, а разбор реализаций и тестов из связанных PR: [#17302](https://github.com/withastro/astro/pull/17302), [#17296](https://github.com/withastro/astro/pull/17296), [#17214](https://github.com/withastro/astro/pull/17214), [#17258](https://github.com/withastro/astro/pull/17258), [#17331](https://github.com/withastro/astro/pull/17331) и [#17389](https://github.com/withastro/astro/pull/17389). Патч-изменения в статью не включены.

## `glob()` умеет откладывать рендеринг Markdown

До 7.1.0 `glob()` синхронно вызывал `getRenderFunction()` для renderable entries во время content sync и сохранял результат в data store. Для больших Markdown-коллекций это означало, что Astro держал в памяти HTML всех записей ещё до того, как страницы начали реально собираться. В PR [#17302](https://github.com/withastro/astro/pull/17302) появился параметр `deferRender?: boolean`.

При `deferRender: true` entry сохраняет исходное тело и получает отметку `deferredRender: true`, но поле `rendered` не заполняется. Когда запись понадобится странице, Astro использует уже существующий on-demand путь, применяемый для `.mdx`. Это особенно полезно для Markdown с тяжёлыми rehype-плагинами вроде `rehype-katex`: в тестовом сценарии PR сборка с 200 KaTeX-файлами проходила с ограничением `--max-old-space-size=256`, тогда как прежний eager-путь приводил к OOM.

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const docs = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "src/content/docs",
    deferRender: true,
  }),
});
```

Опция действует только для типов, у которых есть функция рендера: YAML и другие data entries не становятся deferred. Значение по умолчанию — `false`, поэтому существующие коллекции сохраняют eager-rendering и возможность кэшировать готовый HTML между сборками.

## Content layer: data store можно разбить на чанки

Раньше весь content layer сериализовался в `.astro/data-store.json`. Для очень больших коллекций такой файл мог упереться в лимит размера файла платформы. PR [#17296](https://github.com/withastro/astro/pull/17296) добавляет экспериментальную настройку `experimental.collectionStorage`.

```js
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
  experimental: {
    collectionStorage: "chunked",
  },
});
```

В режиме `chunked` Astro пишет небольшие части в `.astro/data-store/`, а соответствие коллекций и частей — в `manifest.json`. Сериализация сначала сортирует коллекции и записи по ключу, поэтому результат детерминирован даже при параллельной обработке файлов. Часть ограничена 20 MiB и создаётся при достижении лимита; в реализации также учитывается граница UTF-8, чтобы не разрезать Unicode code point.

Имя каждой части — хэш её содержимого. Поэтому неизменившиеся части получают то же имя на следующей сборке и не переписываются, а одинаковые части могут быть дедуплицированы. Значение по умолчанию — `'single-file'`, то есть текущая схема с `.astro/data-store.json` остаётся без изменений.

Внутренняя сторона этого изменения подготовлена под другие источники данных: `DataStoreSource` предоставляет асинхронные `get()`, `entries()`, `values()`, `keys()` и `collections()`, а текущая реализация `InMemorySource` адаптирует существующий `ImmutableDataStore`. Для пользователя публичный API пока ограничен выбором `'chunked'` или `'single-file'`.

## CSP: `kind` разделяет элементы и атрибуты

Astro 7.1.0 расширяет `security.csp` в PR [#17214](https://github.com/withastro/astro/pull/17214). Раньше ресурсы и хэши попадали только в общие `script-src` и `style-src`. Теперь можно использовать специфичные CSP-директивы:

- `script-src-elem` и `style-src-elem` — для `<script>`, `<style>` и `<link rel="stylesheet">`;
- `script-src-attr` и `style-src-attr` — для inline event handlers и атрибутов `style`;
- `script-src` и `style-src` — прежний общий scope.

Строки сохраняют старое поведение и считаются `kind: 'default'`. Для точного scope используется объект с `resource` или `hash` и обязательным `kind`:

```js
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
  security: {
    csp: {
      scriptDirective: {
        resources: [{ resource: "https://cdn.example.com", kind: "element" }],
      },
      styleDirective: {
        resources: [{ resource: "'unsafe-inline'", kind: "attribute" }],
      },
    },
  },
});
```

Та же форма доступна в runtime API `Astro.csp`/`ctx.csp`:

```js
ctx.csp.insertScriptResource({
  resource: "https://cdn.example.com",
  kind: "element",
});

ctx.csp.insertStyleResource({
  resource: "'unsafe-inline'",
  kind: "attribute",
});
```

Важна разница между хэшами и ресурсами. Когда включена более узкая element-директива, хэши по умолчанию переносятся в неё: браузер не будет fallback'иться из `script-src-elem` в `script-src`. Общие ресурсы автоматически не переносятся, поскольку это изменило бы политику; если пользователь смешал общий ресурс и более узкий scope, Astro выдаёт предупреждение. Astro-сгенерированные хэши для islands и inline styles также направляются в соответствующую element-директиву.

Для `kind: 'attribute'` схема CSP дополнительно валидирует допустимые значения: ресурсы должны быть одним из `'none'`, `'unsafe-hashes'`, `'unsafe-inline'` или `'report-sample'`; host вроде `https://cdn.example.com` для `style-src-attr` или `script-src-attr` отклоняется. Это ограничение следует правилам CSP, а не является произвольным ограничением Astro.

## `paginate()` может форматировать все URL

PR [#17258](https://github.com/withastro/astro/pull/17258) добавляет в `PaginateOptions` callback `format?: (url: string) => string`. Он вызывается после построения и добавления base path ко всем существующим URL результата: `current`, `next`, `prev`, `first` и `last`. Неопределённые ссылки для первой или последней страницы callback не получают.

Это закрывает практический сценарий со статическим файловым сервером, которому нужны `.html`, а не clean URLs:

```astro
---
export async function getStaticPaths({ paginate }) {
  const response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=150");
  const result = await response.json();

  return paginate(result.results, {
    pageSize: 10,
    format: url => `${url}.html`,
  });
}

const { page } = Astro.props;
---
```

Если base path равен `/site`, форматтер получает уже `/site/posts/2`, поэтому результатом становится `/site/posts/2.html`. Без `format` URLs остаются прежними.

## `astro dev --ignore-lock` запускает второй foreground-сервер

Новый флаг из PR [#17331](https://github.com/withastro/astro/pull/17331) позволяет поднять ещё один dev server для того же проекта:

```bash
astro dev --ignore-lock
```

Такой экземпляр не проверяет и не записывает `.astro/dev.json`. Поэтому он не попадёт в `astro dev stop`, `astro dev status` или `astro dev logs`; lock-tracked сервер продолжает оставаться единственным управляемым через эти команды. Флаг рассчитан на foreground-запуск и конфликтует с `--background`, включая автоматически включённый background mode в окружении AI-агента, а также с `--force`: первая опция означает «сосуществовать», вторая — «заменить существующий сервер».

## Logger принимает URL entrypoint

В PR [#17389](https://github.com/withastro/astro/pull/17389) тип `logger.entrypoint` расширен с `string` до `string | URL`. Astro нормализует URL через `.href` перед динамическим импортом, в том числе для logger'ов внутри `astro/logger/compose`.

```js
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
  logger: {
    entrypoint: new URL("./logger.js", import.meta.url),
  },
});
```

Это позволяет задавать локальный logger в той же URL-форме, которая уже используется другими API Astro, и не приводит к ошибкам с сообщением `[object URL]`, если модуль не найден.

## Что проверить после обновления

- Для больших Markdown-коллекций с тяжёлыми rehype-плагинами протестируйте `deferRender: true`: он снижает пиковое потребление памяти, но переносит рендеринг с sync на момент сборки страницы.
- Для коллекций, упирающихся в размер `.astro/data-store.json`, попробуйте экспериментальный `collectionStorage: 'chunked'` и учитывайте, что это экспериментальная настройка.
- В CSP используйте `kind: 'attribute'` только с допустимыми keyword sources; не переносите host-ресурсы в `*-src-attr`.
- Если хостинг требует физические `.html`-файлы, добавьте `format` в `paginate()`; для остальных проектов поведение URL не меняется.
- `--ignore-lock` не делает второй сервер управляемым через `astro dev stop/status/logs` и не совместим с background mode.

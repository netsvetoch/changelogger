---
author: Артём Нецветаев
pubDatetime: 2026-09-03T10:47:11.000Z
title: "Astro 7.3.0: astro preview --ignore-lock и runtime-логгер для image services и cache providers"
slug: astro-v7-3-0
featured: false
draft: false
tags:
  - release
  - astro
  - frontend
  - ssr
  - cli
  - image
description: "Разбор Astro 7.3.0: флаг astro preview --ignore-lock для нескольких preview-серверов, runtime-логгер как аргумент image services hooks и в контексте cache providers, плюс патч-фиксы памяти кэша, incrementalBuild concurrency и i18n-паддинга."
---

Astro выпустил минорный релиз [`astro@7.3.0`](https://github.com/withastro/astro/releases/tag/astro%407.3.0). Два тематических блока: возможность поднять несколько preview-серверов одновременно через `--ignore-lock`, и прокидывание runtime-логгера Astro в кастомные image services и cache providers — чтобы предупреждения шли через настроенный `logger`, а не прямо в консоль.

Ниже — разбор по release body и PR [#17767](https://github.com/withastro/astro/pull/17767), [#17818](https://github.com/withastro/astro/pull/17818). Патч-фиксы вынесены в отдельный короткий раздел.

## `astro preview --ignore-lock`: несколько preview-серверов на разных портах

В 7.2.0 у preview появился lock-файл (PR [#17174](https://github.com/withastro/astro/pull/17174)), но не было способа его обойти — при попытке запустить второй `astro preview` всегда вылетало «Another astro preview server is already running». Для dev-сервера флаг `--ignore-lock` уже существовал (PR [#17331](https://github.com/withastro/astro/pull/17331)), а на preview его не перенесли.

Именно это и закрывает PR [#17767](https://github.com/withastro/astro/pull/17767): `--ignore-lock` поддержан в `packages/astro/src/cli/preview/index.ts` через общий хелпер `isIgnoreLock()`.

```sh
# поднять два preview-сервера одновременно, например для Playwright E2E
astro preview --port 4321 --ignore-lock
astro preview --port 4322 --ignore-lock
```

Поведение:

- при `--ignore-lock` проверка и запись lock-файла полностью пропускаются, поэтому несколько preview-серверов могут работать одновременно на разных портах;
- флаг нельзя комбинировать с `--force` или `--background` — конфликт детектится и отклоняется, как на dev-сервере;
- `--ignore-lock` добавлен в вывод `astro preview --help`.

Это важно для E2E-настроек (Playwright и т.п.), где нужно поднять несколько preview-серверов сразу. Ранее обходного пути не было.

## Runtime-логгер: image services hooks получают `logger` аргументом

PR [#17818](https://github.com/withastro/astro/pull/17818) — «use logger instead of console where possible». Custom image services теперь получают runtime-логгер Astro как дополнительный аргумент. Сообщения через него идут в destination, сконфигурированный в `logger`, и уважают уровень логирования — вместо прямой записи в консоль.

```ts
import type { LocalImageService } from "astro";

const service: LocalImageService = {
  // ...
  async transform(inputBuffer, transform, imageConfig, logger) {
    logger.warn(
      `Could not optimize "${transform.src}". Passing it through unchanged.`
    );
    return { data: inputBuffer, format: "png" };
  },
};
```

Встроенный Sharp-сервис теперь использует этот логгер для предупреждений, которые раньше писал при неожиданном или неподдерживаемом исходном формате.

## Runtime-логгер: `logger` в контексте cache providers

Тот же PR добавляет `logger` в контекст, который передаётся cache provider'у в `onRequest()`. Логи идут через настроенный destination `logger` и уважают log level.

```ts
import type { CacheProvider } from "astro";

const provider: CacheProvider = {
  name: "my-cache",
  async onRequest({ request, url, logger }, next) {
    logger.warn(
      `Skipping cache for ${url.pathname} because the response sets a cookie.`
    );
    return next();
  },
  // ...
};
```

Встроенный провайдер `memoryCache()` теперь использует этот логгер для предупреждений, когда пропускает кэширование ответа с cookies и когда падает background revalidation.

## Примечательные патч-фиксы в этом релизе

Минорные изменения — главное, но в 7.3.0 вошли и несколько заметных патчей:

- [#17795](https://github.com/withastro/astro/pull/17795) — concurrent rendering для `experimental.incrementalBuild`, в т.ч. с `@astrojs/cloudflare`. Инкрементальный build больше не отключает кэш при `build.concurrency > 1`; workaround `build.concurrency: 1` для сохранения кэша можно убрать. Cloudflare-сборки снижают сериализационные накладные расходы для больших prerendered-страниц.
- [#17886](https://github.com/withastro/astro/pull/17886) — memory cache provider теперь пропускает ответы с `Vary: Cookie` или `Vary: *` (не кэширует то, что зависит от cookies).
- [#17879](https://github.com/withastro/astro/pull/17879) — исправлена потеря стилей, ссылок и скриптов у content collection entries, отрендеренных внутри server islands.
- [#17861](https://github.com/withastro/astro/pull/17861) — фикс i18n fallback-маршрутов: страница `src/pages/en/enterprise.astro` с `fallback: { es: 'en' }` раньше давала маршрут `/es/esterprise` вместо `/es/enterprise`. Теперь переписывается только ведущий locale-сегмент.
- [#17885](https://github.com/withastro/astro/pull/17885) — улучшена производительность сборки для сайтов с большим числом страниц, приходящих из большого количества разных модулей.

## Что обновлять

```sh
npm install astro@7.3.0
# или
pnpm add astro@7.3.0
```

Если уже на 7.x:

1. E2E с несколькими preview-серверами — пробовать `astro preview --ignore-lock` (не совместим с `--background`/`--force`);
2. кастомный image service или cache provider — использовать `logger` в `transform()` / `onRequest()` вместо `console.log`/`console.warn`;
3. инкрементальные сборки с `build.concurrency > 1` — убрать workaround `build.concurrency: 1`, если ставили только ради кэша.

Источники: [GitHub Release astro@7.3.0](https://github.com/withastro/astro/releases/tag/astro%407.3.0), PR [#17767](https://github.com/withastro/astro/pull/17767), [#17818](https://github.com/withastro/astro/pull/17818), [#17795](https://github.com/withastro/astro/pull/17795), [#17886](https://github.com/withastro/astro/pull/17886), [#17879](https://github.com/withastro/astro/pull/17879), [#17861](https://github.com/withastro/astro/pull/17861), [#17885](https://github.com/withastro/astro/pull/17885).

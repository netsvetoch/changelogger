---
author: Артём Нецветаев
pubDatetime: 2026-06-28T22:00:29.000Z
title: "Servo 0.3.0: Sanitizer API, SharedWorker, Service Worker и больше CSS-шрифтов"
slug: servo-v0-3-0
featured: false
draft: false
tags:
  - release
  - servo
  - browser
  - web-platform
  - rust
description: "Разбор минорного релиза Servo v0.3.0: экспериментальный Sanitizer API с Document.parseHTML и setHTML, новые execCommand-команды, SharedWorker и Service Worker, Font Variant/OpenType CSS-свойства, File API, PerformanceMark и опции servoshell."
---

Servo выпустил минорный релиз [`v0.3.0`](https://github.com/servo/servo/releases/tag/v0.3.0). Upstream-чейнджлог на этот раз почти полностью сгенерирован из сотен PR, поэтому полезнее смотреть не на список заголовков, а на конкретные куски платформы, которые стали ближе к браузерному поведению.

Главная линия релиза: Servo продолжает закрывать Web Platform Tests вокруг DOM, редактирования, CSS Fonts, File API, воркеров и инфраструктуры для embedders. Для тех, кто пробует Servo Tech Demo, в release body также есть практические заметки: на Linux при ошибке `loading shared libraries` авторы отправляют в [troubleshooting guide](https://servo.org/download/#troubleshooting), а `servo-aarch64-linux-ohos.hap` подписан для OpenHarmony; для HarmonyOS нужна самостоятельная подпись через DevEco Studio и ArkTS [Servo Demo](https://github.com/jschwe/ServoDemo).

Источник для обзора — GitHub Release [`servo/servo@v0.3.0`](https://github.com/servo/servo/releases/tag/v0.3.0) и связанные PR: [`#44701`](https://github.com/servo/servo/pull/44701), [`#44655`](https://github.com/servo/servo/pull/44655), [`#44952`](https://github.com/servo/servo/pull/44952), [`#44983`](https://github.com/servo/servo/pull/44983), [`#44761`](https://github.com/servo/servo/pull/44761), [`#45082`](https://github.com/servo/servo/pull/45082), [`#44903`](https://github.com/servo/servo/pull/44903), [`#44950`](https://github.com/servo/servo/pull/44950), [`#44989`](https://github.com/servo/servo/pull/44989), [`#45059`](https://github.com/servo/servo/pull/45059), [`#44858`](https://github.com/servo/servo/pull/44858), [`#45133`](https://github.com/servo/servo/pull/45133), [`#44703`](https://github.com/servo/servo/pull/44703), [`#45029`](https://github.com/servo/servo/pull/45029) и [`#44880`](https://github.com/servo/servo/pull/44880).

## Sanitizer API включён как экспериментальная возможность

Самое заметное веб-платформенное направление релиза — Sanitizer API. PR [`#44701`](https://github.com/servo/servo/pull/44701) добавляет `dom_sanitizer_enabled` в список экспериментальных pref'ов servoshell. Это важно не потому, что API внезапно стал полностью готовым: сам PR фиксирует текущий статус как 205/704 проходящих WPT subtests. Но теперь API можно включать экспериментально и прогонять на wpt.fyi без локальных хаков в `tests/wpt/meta/sanitizer-api/__dir__.ini`.

Внутри этого направления есть несколько конкретных новых методов:

- [`#44655`](https://github.com/servo/servo/pull/44655) раскомментировал в `components/script_bindings/webidls/Sanitizer.webidl` методы `Sanitizer.setComments(boolean)`, `Sanitizer.setDataAttributes(boolean)` и `Sanitizer.removeUnsafe()`;
- [`#44952`](https://github.com/servo/servo/pull/44952) добавил статический `Document.parseHTML(html, options)` и алгоритмы `get a sanitizer instance from options`, `sanitize`, `sanitize core`, а также проверку `javascript:` URL;
- [`#44983`](https://github.com/servo/servo/pull/44983) добавил `Element.setHTML(html, options)` и `ShadowRoot.setHTML(html, options)` через общий алгоритм `set and filter HTML`.

Практический вид API, который теперь отражён в WebIDL Servo:

```js
const sanitizer = new Sanitizer();
sanitizer.setComments(false);
sanitizer.setDataAttributes(true);
sanitizer.removeUnsafe();

const doc = Document.parseHTML('<a href="javascript:alert(1)">bad</a>', {
  sanitizer,
});

document.querySelector("#preview").setHTML(userHtml, { sanitizer });
shadowRoot.setHTML(templateHtml, { sanitizer });
```

Ограничение стоит держать в голове: это экспериментальный pref и частичная реализация. Но для авторов движка и тестов прогресс уже измеримый — из WPT metadata убраны ожидаемые падения для `Document.parseHTML`, `Element.setHTML`, `ShadowRoot.setHTML`, `setComments`, `setDataAttributes`, `removeUnsafe`, базовой фильтрации, обработки `javascript:` URL и части safety/tree-construction сценариев.

## `execCommand`: больше совместимости для contenteditable

В релиз вошла серия PR вокруг старого, но всё ещё встречающегося API `document.execCommand()`. Это не новый модный API, зато он влияет на совместимость редакторов, legacy CMS и тестовых страниц с `contenteditable`.

Подтверждённые команды из diff'ов и WPT metadata:

- [`#44644`](https://github.com/servo/servo/pull/44644) — `backColor` и алиас `hiliteColor`;
- [`#44657`](https://github.com/servo/servo/pull/44657) — `foreColor`, включая корректное чтение цвета из `HTMLFontElement`;
- [`#44677`](https://github.com/servo/servo/pull/44677) — `subscript` и `superscript`;
- [`#44682`](https://github.com/servo/servo/pull/44682) — `createLink` и `unlink`, включая сценарии вокруг выделенных изображений и ссылок;
- [`#44710`](https://github.com/servo/servo/pull/44710) — `removeFormat`, причём PR прямо отмечает исправление effectively contained nodes для родителей полностью выделенного text node;
- [`#44909`](https://github.com/servo/servo/pull/44909) — начальная реализация `insertParagraph`.

Минимальный пример того, какие сценарии теперь имеют реализацию в Servo:

```js
editor.focus();
document.execCommand("foreColor", false, "#0000ff");
document.execCommand("backColor", false, "#ffffcc");
document.execCommand("createLink", false, "https://servo.org/");
document.execCommand("removeFormat", false, null);
```

Здесь важно не обещать лишнего: например, `insertParagraph` в PR назван начальной реализацией, и часть WPT metadata всё ещё остаётся с `FAIL` или даже `CRASH` для отдельных white-space сценариев. Но по факту релиз снимает большое количество expected-fail записей в `tests/wpt/meta/editing/run/*.ini`, то есть Servo начинает проходить больше совместимых браузерных тестов для реального редактирования.

## Worker API: SharedWorker уже создаётся, Service Worker получил базовый lifecycle

Для worker-семейства релиз двигает две разные области.

[`#44761`](https://github.com/servo/servo/pull/44761) реализует конструктор `SharedWorker`, создаёт и отдаёт `port`, стартует `SharedWorkerGlobalScope` и доставляет подключения через `connect` events. В тексте PR зафиксировано, что порт передаётся через `MessageEvent` в `event.ports[0]`.

То есть базовый паттерн SharedWorker становится ближе к обычному браузерному коду:

```js
const worker = new SharedWorker("/worker.js");
worker.port.start();
worker.port.postMessage({ type: "ping" });
```

В Service Worker PR [`#45082`](https://github.com/servo/servo/pull/45082) добавляет базовую реализацию lifecycle и messaging. Diff показывает не только внутренний `serviceworker_manager.rs`, но и изменения в WebIDL:

- `Client.postMessage(...)` раскомментирован в `Client.webidl`;
- `ExtendableMessageEvent.source` теперь может быть `Client`, `ServiceWorker` или `MessagePort`;
- `ServiceWorkerContainer.getRegistration(clientURL)` раскомментирован;
- `ServiceWorkerRegistration.unregister()` раскомментирован;
- добавлен `WindowClient.webidl`.

Это ещё не означает «полный Service Worker как в Chromium»: в PR service worker feature глобально выключен для WPT и включается точечно для streams suite. Но API-поверхность и маршрутизация сообщений уже продвинулись достаточно, чтобы тесты перестали таймаутиться в части CSP/worker-src сценариев и начали падать как обычные проверяемые failures.

## CSS Fonts и shaping: `font-variant-*`, `font-feature-settings`, кернинг

В CSS-шрифтах релиз закрывает сразу несколько свойств, которые влияют на реальный текстовый рендеринг.

Серия PR добавляет поддержку OpenType-фич через Stylo и HarfBuzz:

- [`#44634`](https://github.com/servo/servo/pull/44634) отключает кернинг, когда CSS задаёт `font-kerning: none`;
- [`#44903`](https://github.com/servo/servo/pull/44903) реализует `font-variant-ligatures`;
- [`#44950`](https://github.com/servo/servo/pull/44950) добавляет `font-variant-numeric`;
- [`#44989`](https://github.com/servo/servo/pull/44989) добавляет `font-variant-east-asian`;
- [`#45059`](https://github.com/servo/servo/pull/45059) реализует `font-feature-settings`, но явно не добавляет поддержку `font-feature-settings` внутри `@font-face` rules.

Пример CSS, для которого в Servo стало больше реальной поддержки:

```css
.price {
  font-variant-numeric: tabular-nums lining-nums;
}

.logo {
  font-variant-ligatures: common-ligatures discretionary-ligatures;
  font-feature-settings:
    "kern" 1,
    "liga" 1;
}

.japanese {
  font-variant-east-asian: jis04 ruby;
}
```

Технически это не только парсинг CSS. В [`#45059`](https://github.com/servo/servo/pull/45059) изменения доходят до `components/fonts/shapers/mod.rs` и `components/fonts/shapers/harfbuzz.rs`: Servo вычисляет используемые font features и передаёт их в shaping. Поэтому эффект должен проявляться в глифах, а не только в `getComputedStyle()`.

## File API, Blob и media: меньше несовместимых углов

В File API релиз закрывает несколько точек, где поведение легко видно из JS.

[`#44858`](https://github.com/servo/servo/pull/44858) реализует `FileReader.readAsBinaryString()`. Затем [`#44921`](https://github.com/servo/servo/pull/44921) уточняет важную деталь: каждый байт должен становиться code unit с тем же значением `[0..255]`, а не декодироваться как UTF-8. [`#44897`](https://github.com/servo/servo/pull/44897) исправляет формат data URL: для Blob без типа Servo должен выдавать `data:;base64,...`, а не `data:base64,...`; [`#44924`](https://github.com/servo/servo/pull/44924) переносит тот же default `application/octet-stream` на `FileReaderSync.ReadAsDataURL`.

Проверяемый пользовательский сценарий:

```js
const reader = new FileReader();
reader.onload = () => console.log(reader.result);
reader.readAsBinaryString(new Blob([new Uint8Array([0xff, 0x00, 0x41])]));
```

Отдельно [`#45133`](https://github.com/servo/servo/pull/45133) меняет `Blob.stream()`: для in-memory и file-backed blobs поток теперь создаётся как readable byte stream, что требуется File API и покрывается BYOB WPT для `Blob.stream()`.

В media-подсистеме [`#45084`](https://github.com/servo/servo/pull/45084) исправляет MP4-файлы, у которых `moov` atom находится в конце файла. До исправления `qtdemux` мог завершаться с ошибкой `no 'moov' atom within the first 10 MB`, потому что источник был объявлен как sequential push-only и не позволял seek-to-end. PR также добавляет размер ассета в headers для `file://`, чтобы media backend мог получить `set_input_size`.

## Performance API: больше timing-полей в `PerformanceMark`

В Performance API несколько PR передают navigation timing значения в document и открывают их для `PerformanceMark`:

- [`#44624`](https://github.com/servo/servo/pull/44624) — `redirectStart`;
- [`#44673`](https://github.com/servo/servo/pull/44673) — `redirectEnd`;
- [`#44739`](https://github.com/servo/servo/pull/44739) — `secureConnectionStart`;
- [`#44850`](https://github.com/servo/servo/pull/44850) — `responseEnd`;
- [`#44702`](https://github.com/servo/servo/pull/44702) — конструктор `PerformanceMark`.

Плюс [`#44675`](https://github.com/servo/servo/pull/44675) исправляет единицы времени: `Duration` создаётся из microseconds timestamp, а не milliseconds. Для пользователей это означает меньше расхождений в тестах и инструментах, которые полагаются на точные performance entry timestamps.

## Новые опции для embedders и диагностики servoshell

Servo — это не только Tech Demo, но и движок для embedding. В этой части релиза есть несколько практичных изменений.

[`#44703`](https://github.com/servo/servo/pull/44703) меняет API `DiagnosticsLogging`: старый `extend_from_string` был завязан на servoshell, текст help и даже мог завершать процесс. Новый подход переводит диагностики на `BitArray` и добавляет strum-based API: embedder может перечислять доступные diagnostic options, получать документацию к каждой опции и парсить строковые флаги без побочных эффектов вроде `process::exit`.

[`#45029`](https://github.com/servo/servo/pull/45029) добавляет конкретную diagnostic option `accessibility-tree`. Она печатает дерево accessibility nodes через `PrintTree` в конце update. Это полезно при отладке недавних изменений accessibility tree, которых в релизе тоже много: вычисление labels для name-from-content nodes, уникальные IDs, incremental updates и очистка stale nodes.

Наконец, [`#44880`](https://github.com/servo/servo/pull/44880) добавляет скрытую, но важную для тестовой инфраструктуры опцию servoshell:

```text
servo --host-file /path/to/hosts
```

Она позволяет передать путь к hosts-файлу без переменной окружения `HOST_FILE`. В PR прямо указано, что это нужно для Android/OHOS wptrunner-интеграции, где environment variable не всегда подходит. Если `HOST_FILE` всё же задан, он имеет приоритет над `--host-file`.

## Итог

Servo `v0.3.0` — это не релиз с одним пользовательским баннером, а большой срез платформенной совместимости. Самые заметные изменения: экспериментальный Sanitizer API с `Document.parseHTML()`/`setHTML()`, серия `execCommand` для contenteditable, базовые SharedWorker/Service Worker pieces, расширенная поддержка CSS Fonts/OpenType, исправления File API и новые diagnostic/host-file возможности для embedders.

Если вы просто запускаете Tech Demo, начните с артефактов релиза и troubleshooting guide из release body. Если вы следите за Servo как движком, этот релиз интересен тем, что многие изменения подтверждаются не маркетинговыми формулировками, а снятыми expected-fail в WPT metadata и конкретными WebIDL additions.

---
author: Артём Нецветаев
pubDatetime: 2026-08-22T21:26:22.000Z
title: "Bun 1.4.0: Bun переписан на Rust, WebView, Bun.Image, Bun.cron() и параллельные run/test"
slug: bun-v1-4-0
featured: false
draft: false
tags:
  - release
  - bun
  - javascript
description: "Bun 1.4 добавляет +1 517 тестов из test suite Node.js и исправляет более 2 900 проблем. Снижает idle CPU в 5×, память — до 35%, стартует в 2× быстрее на Linux. Встроенные Bun.Image, Bun.WebView, Bun.markdown, Bun.cron(), Bun.Terminal, bun run --parallel, bun test --parallel, bun audit fix, bun dedupe и bun prune. Главное — базовая стандартная библиотека расширяется и то, что само Bun переписан с Zig на Rust."
---

> Это перевод статьи [«Bun 1.4»](https://bun.com/blog/bun-v1.4) (авторы — Jarred, Ciro, Dylan, Alistair & Sosuke), ссылка на которую указана в GitHub Release [`bun-v1.4.0`](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.0). Перевод сохраняет структуру и смысл оригинала; код и таблицы оставлены как в первоисточнике. Огромные сгенерированные дампы профилировщика и многострочные бенчмарк-скрипты в переводе заменены краткими примерами, полные версии есть в оригинальной статье.

Bun — это полный набор инструментов для создания и тестирования full-stack приложений на JavaScript и TypeScript. Если вы новичок в Bun, можете начать с [поста о Bun 1.0](https://bun.com/blog/bun-v1.0).

### Установка

```bash
curl -fsSL https://bun.sh/install | bash
```

Windows:

```bash
powershell -c "irm bun.sh/install.ps1 | iex"
```

```bash
npm install -g bun
```

```bash
brew install oven-sh/bun/bun
```

```bash
docker pull oven/bun
```

Bun 1.4 добавляет +1 517 тестов из test suite Node.js — это самый большой скачок в совместимости с Node.js начиная с Bun 1.0. Bun v1.4 также исправляет более 2 900 проблем. Он снижает idle CPU в 5 раз, уменьшает потребление памяти на величину до 35% и стартует на 50% быстрее на Linux. Он добавляет `Bun.Image`, `Bun.WebView`, `Bun.markdown`, `Bun.cron()`, `Bun.Terminal`, `bun run --parallel`, `bun test --parallel`, `bun audit fix`, `bun dedupe` и `bun prune`. И — главное — переписывает сам Bun с Zig на Rust.

Этот пост покрывает всё, что мы выпустили начиная с Bun 1.3.0 (изменения с тегами «новое в Bun v1.4»).

Обновление:

```bash
bun upgrade
```

## Node.js compatibility

Bun спроектирован как drop-in замена Node.js. Мы добавили +1 517 тестов из test suite Node.js, которые теперь прогоняются на каждом коммите Bun.

`node:http`, `node:fs`, `node:cluster`, `node:timers`, `node:zlib`, `node:vm` и `node:stream` проходят 97% собственных тестов Node; `node:quic` — 99%; `node:events`, `node:trace_events` и `node:sqlite` — 100%.

Тест suite Node.js v26.3.0 · проходят на каждом коммите · **+1 517** новых проходящих тестов. Прирост по модулям: quic 235/237 (+235), http 403/415 (+193, переписан), fs 349/358 (+133), tls 191/224 (+106), http2 261/280 (+102, переписан), repl 82/109 (+77), stream 254/262 (+61), worker 116/157 (+57), process 160/190 (+45), net 171/191 (+39), https 61/65 (+39), internal 68/108 (+35), cluster 85/88 (+31), trace_events 30/30 (+30), webcrypto 39/50 (+28), crypto 123/135 (+27), vm 98/101 (+25), webstreams 28/38 (+23), test_runner 28/81 (+21), module 68/93 (+19), diagnostics_channel 36/69 (+19), sqlite 18/18 (+18), child_process 105/116 (+15), inspector 22/110 (+14).

### Playwright v1.4.0

Теперь Playwright работает на Bun: управляйте браузером через `connectOverCDP()`, запускайте свой suite через `playwright test` с `playwright.config.ts`, открывайте `--ui` и запускайте Chromium на Windows.

### Next.js 16 v1.3.2

`bun --bun next build` работает на Next.js 16.3 c Turbopack и React Compiler.

### vitest v1.4.0

`vitest` работает под Bun, включая `--coverage`, с пулами `threads` и `forks`.

### OpenTelemetry v1.4.0

Инструментирование `http` и `fs` из OpenTelemetry экспортирует spans; `shimmer` и `require-in-the-middle` патчат бандленные модули.

### dd-trace v1.4.0

`dd-trace` трассирует, а `@datadog/pprof` непрерывно профилирует; реализованы V8 C++ API, на которые они опираются.

### Дополнительные улучшения совместимости с Node.js

С каждым днем Bun всё ближе к 100% совместимости с Node.js. Больше пакетов теперь работают в Bun без изменений:

- **Nuxt**: `nuxt dev` подключает HMR и Nuxt DevTools.
- **testcontainers и dockerode**: работает `container.exec()`.
- **https-proxy-agent и socks-proxy-agent**: `http.request()` туннелирует через них.
- **crawlee**: обходит сайты через proxy-chain.
- **@grpc/grpc-js и ConnectRPC**: работают серверы за Envoy и клиенты за AWS ALB.
- **amqplib**: подключается к RabbitMQ.
- **@aws-sdk/client-s3**: работают streaming-загрузки.
- **TypeORM**: запускается с настройками decorator из вашего `tsconfig.json`.
- **nock**: перехватывает http и https запросы.
- **Fastify `inject()` и light-my-request**: работают.
- **happy-dom**: больше не ломает `console.log`.
- **piscina**: работает.

Новые Node.js API в Bun:

- `worker_threads`: опции `resourceLimits`, `stdout`, `stderr` и `eval`.
- `ws`: события `'upgrade'` и `'unexpected-response'`.
- `socket.upgradeTLS({ isServer: true })`: серверный STARTTLS.
- `node:cluster`: разделяет listening-sockets между воркерами.
- `node:repl`, `node:trace_events`, `node:domain`: реализованы.

## Production

Bun v1.4 использует меньше памяти, меньше CPU и стартует быстрее.

До Bun v1.4 Bun использовал два аллокатора памяти — аллокатор libpas из JavaScriptCore и mimalloc. JavaScriptCore в Bun теперь использует mimalloc (улучшено освобождение памяти), а сам mimalloc мы расширили: частичная очистка страниц, поток-scavenger, который освобождает память, пока JavaScript простаивает, и улучшенное ленивое обнуление.

### CPU usage

Для Claude Code, крупного долгоживущего приложения на Bun, потребление CPU в production упало в 2 раза: p99 — с 24% до 10%, p50 — с 5.8% до 2.5%.

Для маленького «hello world» приложения idle CPU падает в 5 раз.

Мы добились этого, оптимизировав запросы GC по таймерам, переведя обход Strong-корней в JavaScriptCore со связного списка на связный список сегментированных массивов и сократив число вызовов futex — плюс упомянутые выше изменения в mimalloc.

### Memory usage

Приложения, использующие HTTP-серверы Bun, должны увидеть снижение потребления памяти на 13%–48%.

Пик памяти под нагрузкой (1 000 000 запросов с 64 соединениями; для Next.js и Vite — 100 000):

| Server | Bun 1.4 | Bun 1.3 | Node.js 26 | Δ vs Bun 1.3 |
| fastify | 120 MB | 233 MB | 156 MB | −48% |
| Express | 92 MB | 169 MB | 145 MB | −46% |
| node:http | 81 MB | 135 MB | 107 MB | −40% |
| Elysia | 55 MB | 91 MB | n/a | −40% |
| Next.js | 285 MB | 397 MB | 342 MB | −28% |
| Bun.serve | 36 MB | 45 MB | n/a | −20% |
| Vite dev server | 233 MB | 268 MB | 214 MB | −13% |

Server-side rendering с Next.js получает ещё большее снижение. На типичном паттерне App Router, который в 1.3 неограниченно рос (React.cache + no-store fetch в динамическом маршруте), Bun 1.4 стабилизируется на 238 MB на 4 000 страниц — ниже Node'овских 410 MB.

### Startup

На Windows Bun стартует в 2.5 раза быстрее.

| hello.js на Windows | Bun 1.4 | Bun 1.3.14 | Node.js 26 |
| Startup time | 15.5 ms | 39.0 ms | 40.1 ms |
| Peak memory | 16.8 MB | 46.5 MB | 32.5 MB |

На Linux Bun стартует в 2 раза быстрее и использует меньше половины памяти.

| hello.js на Linux | Bun 1.4 | Bun 1.3 | Node.js 26 |
| Startup time | 5.1 ms | 10.9 ms | 27.2 ms |
| Peak memory | 14.6 MB | 33.0 MB | 44.5 MB |

### Binary size

На Linux и Windows биндинг становится меньше на величину до 17%.

| | Bun 1.4 | Bun 1.3.14 |
| Linux x64 | 77.0 MB | 88.5 MB |
| Linux arm64 | 76.8 MB | 87.6 MB |
| Windows x64 | 84.8 MB | 93.9 MB |
| Windows arm64 | 75.1 MB | 90.2 MB |
| macOS arm64 | 61.2 MB | 60.2 MB |
| macOS x64 | 66.6 MB | 66.0 MB |

macOS-биндинги примерно на 1 MB больше.

### Observability

Инструменты, которые вы уже используете, работают с Bun 1.4.

- `bun --cpu-prof` записывает `.cpuprofile`. Открывается в Chrome DevTools или VS Code.
- `bun --heap-prof` записывает V8-совместимый `.heapsnapshot`. Открывается в Chrome DevTools.
- `node:inspector`: `Session` может запускать и останавливать CPU-профиль на лету через `Profiler.start`/`Profiler.stop`.
- **Datadog**: `dd-trace` трассирует запросы, а `@datadog/pprof` непрерывно профилирует CPU.
- **OpenTelemetry**: пакеты `@opentelemetry/instrumentation-http` и `@opentelemetry/instrumentation-fs` с npm работают с `node:http` и `node:fs` в Bun.
- **Async stack traces**: ошибка из `fs.promises`, `fetch()`, S3, DNS или crypto указывает на `await` в вашем коде, а не на нативные фреймы.

Что-то из этого новое в Bun.

#### --cpu-prof-md

`--cpu-prof-md` пишет CPU-профиль в виде Markdown, чтобы можно было найти горячую функцию прямо из терминала: топ функций по self time, call tree и кто кого вызывает. Его можно читать по SSH, грепать, вставлять в баг-репорт или отдавать LLM.

```bash
bun --cpu-prof-md ./app.ts
```

Результат — текстовый отчёт с таблицами времени self/total, call tree и деталями функций. Полный пример вывода в оригинальной статье.

`BUN_CPU_PROFILE=1` включает CPU-профилирование для процесса, которому нельзя передать флаги (например, воркера, запущенного фреймворком).

#### --heap-prof-md

`--heap-prof-md` пишет heap-профиль в виде Markdown: общий размер, типы, удерживающие больше всего памяти, крупнейшие объекты и цепочки, которые держат их живыми.

```bash
bun --heap-prof-md ./app.ts
```

#### bun build --metafile-md

`bun build --metafile-md` пишет анализ бандла в виде Markdown: крупнейшие модули, что грузит каждая точка входа и цепочка импортов, которая затащила каждый файл.

```bash
bun build ./src/index.ts --outdir ./dist --metafile-md=./dist/meta.md
```

#### process.on("memoryPressure")

Когда ОС сообщает о нехватке памяти, Bun получает уведомление и генерирует событие `"memoryPressure"` на `process`. Используйте его, чтобы освободить память раньше, чем ОС прибьёт процесс: очистить кэш, закрыть простаивающие соединения, остановить простаивающие воркеры. Работает на macOS, Linux и Windows.

```js
process.on("memoryPressure", level => {
  cache.clear();
  pool.drainIdle();
});
```

- macOS: `kqueue` с `EVFILT_MEMORYSTATUS` — то же событие, что libdispatch использует для `DISPATCH_SOURCE_TYPE_MEMORYPRESSURE`. `level` — `"warning"` или `"critical"`.
- Linux: PSI-триггер, записанный в `/proc/pressure/memory` (или `memory.pressure` из cgroup), отслеживаемый через epoll с `EPOLLPRI`. `level` — `"critical"`.
- Windows: `CreateMemoryResourceNotification(LowMemoryResourceNotification)`, ожидаемый через `RegisterWaitForSingleObject`. `level` — `"critical"`.

### Streams and bodies

`ReadableStream`, `WritableStream` и `TransformStream` теперь нативные. Они используют меньше памяти, работают быстрее и проходят 100% Web Platform Tests.

Четыре пайплайна, каждый передаёт 64 MB чанками по 4 KB:

- Download: `fetch()` → `DecompressionStream("gzip")` → `TextDecoderStream` → `for await`
- Upload: `fs.createReadStream()` → `CompressionStream("gzip")` → `fetch()` POST body
- Transcode: `fs.createReadStream()` → `TextDecoderStream` → `TextEncoderStream` → `fs.createWriteStream()`
- Subprocess: `fetch()` body → cat stdin, затем cat stdout → `for await`

Пропускная способность, MB/s:

| Pipeline | Bun 1.4 | Bun 1.3 | Node.js 26 | Deno 2.9 |
| Download | 1 519 | n/a | 204 | 530 |
| Upload | 179 | n/a | 78 | 137 |
| Transcode | 132 | 116 | 52 | 91 |
| Subprocess | 751 | 505 | 256 | 170 |

Пик памяти, MB:

| Pipeline | Bun 1.4 | Bun 1.3 | Node.js 26.7 | Deno 2.9 |
| Download | 57 | n/a | 86 | 64 |
| Upload | 60 | n/a | 84 | 61 |
| Transcode | 62 | 92 | 72 | 57 |
| Subprocess | 65 | 207 | 106 | 114 |

Методика: все четыре рантайма выполняют один и тот же скрипт; файловые потоки используют `Readable.toWeb()` и `Writable.toWeb()` из `node:stream`. В Bun 1.3 нет `CompressionStream` и `DecompressionStream`, поэтому соответствующие строки — n/a.

`Response.clone()` и `Request.clone()` больше не копируют каждый чанк во вторую ветку: клон разделяет чанки тела с оригиналом.

Чтение 64 MB streaming-тела после `res.clone()` (чтение обоих тел):

| Runtime | Peak memory | Time |
| Bun 1.4 | 220 MB | 96 ms |
| Bun 1.3 | 311 MB | 129 ms |
| Node.js 26 | 382 MB | 230 ms |
| Deno 2.9 | 297 MB | 134 ms |

Чтение только клона, без оригинала:

| Runtime | Peak memory | Time |
| Bun 1.4 | 155 MB | 63 ms |
| Bun 1.3 | 243 MB | 98 ms |
| Node.js 26 | 318 MB | 162 ms |
| Deno 2.9 | 233 MB | 104 ms |

Изменение затрагивает и саму потоковость: `CompressionStream` и `DecompressionStream` теперь реализованы нативно. 1 GB JSON-текста через gzip-поток, чанки по 64 KB:

| Stream | Bun 1.4 | Node.js 26 | Deno 2.9 |
| CompressionStream | 152 MB/s | 135 MB/s | 130 MB/s |
| DecompressionStream | 2 291 MB/s | 491 MB/s | 679 MB/s |

Компрессия ограничена самой zlib, поэтому рантаймы близки; разрыв виден именно на декомпрессии. `TextEncoderStream`/`TextDecoderStream` используют примерно вдвое меньше памяти, чем в Bun 1.3.

Полный набор бенчмарков (`native-pipeline.mjs`, `serve-body.mjs`, `response-clone.mjs`, `compression-stream.mjs`, `text-encoder-stream.mjs`) есть в оригинальной статье.

Все цифры: AMD EPYC 9R14, Linux x64. Bun 1.3.0, Bun 1.4.0, Node.js 26.7.0, Deno 2.9.5. Медиана из 3 прогонов, один процесс на прогон, пик RSS из `/usr/bin/time -v`.

### Backpressure

`Bun.serve` автоматически приостанавливает тело запроса/ответа `ReadableStream`, когда соединение не может принять больше данных, — медленный или зависший клиент удерживает максимум один буфер серверной памяти.

```js
Bun.serve({
  routes: {
    "/": () => {
      return new Response(
        new ReadableStream({
          // приостанавливается, когда send-буфер сокета заполняется
          pull(controller) {
            controller.enqueue(new Uint8Array(65536));
          },
        })
      );
    },
  },
});
```

То же самое делает `fetch()` на принимающей стороне. Работает также с `TransformStream` (`CompressionStream`, `DecompressionStream`), `HTMLRewriter.transform`, `child_process`, `Bun.spawn`, `Bun.file(path).stream()`, `Blob.stream()` и не только.

## We rewrote Bun in Rust

Теперь Bun написан на Rust — и это первый релиз (хотя Claude Code уже несколько месяцев использует Rust-порт Bun, а Prisma запустила на нём Prisma Compute). Мы написали отдельный [пост про переписывание на Rust](https://bun.com/blog/bun-in-rust) с подробностями.

## What's new

Релиз делает встроенную стандартную библиотеку Bun больше.

15 зависимостей · теперь встроены · 0 зависимостей осталось. Пакеты и их замена встроенными API Bun:

- **sharp** → `Bun.Image` (обработка изображений)
- **puppeteer** → `Bun.WebView` (headless-браузер)
- **marked** → `Bun.markdown` (рендер markdown)
- **node-cron** → `Bun.cron` (запланированные задачи)
- **node-pty** → `Bun.Terminal` (нативная PTY)
- **concurrently / npm-run-all** → `bun run --parallel` (параллельные скрипты)
- **serve-static** → `Bun.serve` routes (статические файлы)
- **json5** → `Bun.JSON5` (парсинг JSON5)
- **fast-xml-parser** → `Bun.XML` (парсинг XML)
- **tar** → `Bun.Archive` (tarball)
- **string-width** → `Bun.stringWidth` (ширина в колонках терминала)
- **slice-ansi** → `Bun.sliceAnsi` (ANSI-обрезка)
- **cli-truncate** → `Bun.sliceAnsi` (ANSI-усечение)
- **wrap-ansi** → `Bun.wrapAnsi` (ANSI-перенос)

Всё это поставляется в бинарнике Bun — без шага установки, без нативной сборки, без записи в lockfile. Каждое рассматривается ниже в своём разделе.

### Bun.Image v1.3.14

`Bun.Image` — встроенная библиотека для работы с изображениями.

```js
await Bun.file("photo.jpg")
  .image()
  .resize(1024, 1024, { fit: "inside" })
  .rotate(90)
  .webp({ quality: 85 })
  .write("thumb.webp");

// Stream прямо в Response
return new Response(new Bun.Image(upload).resize(200).jpeg());
```

Декодирование, ресайз, поворот и кодирование JPEG, PNG, WebP, GIF и BMP. HEIC, AVIF и TIFF работают на macOS и Windows. API похож на sharp, нативный аддон не нужен. ICC-цветовые профили (например, Display P3) переживают транскодинг.

На PNG 1080p, ресайзнутом в JPEG 400×400, это в 1.38 раза быстрее sharp. На JPEG → WebP — в 1.19 раза.

### Bun.WebView v1.3.12 v1.4.0

`Bun.WebView` — это автоматизация headless-браузера, встроенная в Bun, без Puppeteer и Playwright.

```js
await using view = new Bun.WebView({ width: 800, height: 600 });
await view.navigate("https://bun.sh");
await view.click("a[href='/docs']");
const title = await view.evaluate("document.title");
await Bun.write("page.png", await view.screenshot());
```

Переходы, клики, скролл, выполнение JavaScript и скриншоты. Клики и скролл — это настоящий пользовательский ввод (приходят как trusted input, `event.isTrusted === true`).

На macOS он использует системный WebKit — ничего устанавливать не нужно. На macOS, Linux и Windows он также может управлять установленными Chrome, Chromium или Edge.

`Bun.WebView` расширяет `EventTarget`, возвращает скриншоты как `Blob` и предоставляет escape-hatch `.cdp(method, params?)` для сырых команд Chrome DevTools Protocol. Подробности — в доках.

### Bun.markdown v1.3.8 v1.4.0

`Bun.markdown` — встроенный парсер Markdown.

```js
const html = Bun.markdown.html("# Hello **world**");
// "<h1>Hello <strong>world</strong></h1>\n"

// ANSI-вывод в терминал
const ansi = Bun.markdown.render("# Hello\n\n**bold**", {
  heading: children => `\x1b[1;4m${children}\x1b[0m\n`,
  paragraph: children => children + "\n",
  strong: children => `\x1b[1m${children}\x1b[22m`,
});

// React
export default function Page() {
  return Bun.markdown.react(readme);
}
```

`Bun.markdown.html()` возвращает HTML-строку. `Bun.markdown.react()` — React-элементы, причём для любого тега можно подставить свой компонент. `Bun.markdown.render()` — колбэк на каждый элемент, например для вывода в терминал.

Поддерживаются GFM-таблицы, strikethrough, чек-листы и autolinks, `.md` — это loader бандлера, а парсер работает за линейное время даже на враждебном входе.

HTML-вывод не санитизируется: сырой HTML, атрибуты обработчиков событий и `javascript:`-ссылки проходят как есть.

### Bun.cron() v1.3.11 v1.4.0

`Bun.cron()` регистрирует запланированную задачу в операционной системе: crontab на Linux, launchd на macOS, Task Scheduler на Windows.

Скрипт экспортирует обработчик `scheduled(controller)` — той же формы, что Cron Triggers в Cloudflare Workers.

Стандартный 5-полевой cron-синтаксис, включая именованные дни и `@daily`.

```js
// Регистрируем OS-уровневую cron-задачу
await Bun.cron("./worker.ts", "30 2 * * MON", "weekly-report");

// Парсим cron-выражение → следующая подходящая дата в UTC
const next = Bun.cron.parse("*/15 * * * *");

// worker.ts
export default {
  async scheduled(controller) {
    // controller.cron === "30 2 * * 1"
    // controller.scheduledTime === 1737340200000
    await doWork();
  },
};
```

Вместо файла можно передать функцию — Bun запускает её на event loop без системного cron.

Задачи никогда не перекрываются, а `using` останавливает задачу, когда она выходит из области видимости.

```js
using job = Bun.cron("*/5 * * * *", async () => {
  await cleanupTempFiles();
});
job.cron; // "*/5 * * * *"
job.unref(); // разрешить выход процесса
job.stop(); // отменить (или пусть `using` освободит)
```

Расписание `Bun.cron` по умолчанию использует локальное время, с новой опцией `{ tz }` для явной временной зоны; `parse()` отклоняет метки времени вне диапазона ECMAScript `Date`.

### Bun.Terminal v1.3.5 v1.4.0

`Bun.Terminal` — встроенный псевдо-терминал: можно управлять bash, vim или htop из JavaScript без node-pty.

Передайте `terminal` в `Bun.spawn`, пишите ввод, меняйте размер, читайте цветной вывод. Работает на Linux, macOS и Windows.

```js
const proc = Bun.spawn(["bash"], {
  terminal: {
    cols: 80,
    rows: 24,
    data(term, data) {
      process.stdout.write(data);
    },
  },
});

proc.terminal.write("echo Hello from PTY!\n");
```

### bun run --parallel v1.3.9 v1.4.0

`bun run --parallel` выполняет несколько скриптов из package.json одновременно, с префиксом имени в выводе. Имена скриптов можно матчить по glob, разворачиваться на все воркспейсы через `--filter` и продолжать работу при ошибках через `--no-exit-on-error`. Это замена инструментам npm-run-all и concurrently.

```bash
# Запуск "build" и "test" одновременно
bun run --parallel build test
```

```bash
# Имена скриптов по glob
bun run --parallel "build:*"
```

```bash
# Запуск "build" в каждом пакете воркспейса
bun run --parallel --filter '*' build
```

```bash
# Продолжать, даже если один пакет упал
bun run --parallel --no-exit-on-error --filter '*' test
```

Каждая строка вывода префиксуется именем скрипта (или `package:script` под `--filter`), а хуки prebuild/postbuild группируются с основным скриптом, чтобы сохранялся порядок зависимостей. `--sequential` запускает скрипты по одному, с тем же префиксным выводом и фильтрацией.

### 3x faster bun:ffi v1.4.0

`bun:ffi` теперь работает на FFI, встроенном в JavaScriptCore, заменяя TinyCC. Мы добавили нативную поддержку FFI в JavaScriptCore.

| | Bun 1.3 | Bun 1.4 | |
| no-op call | 2.13 ns | 0.70 ns | 3.0× |
| new CString(ptr) | 92.5 ns | 24.1 ns | 3.8× |
| opentui layout reads (1 000) | | | 2.08× |

Новый тип аргумента `buffer_length` передаёт длину TypedArray вместе с указателем, так что эти два значения не могут разойтись.

```js
import { dlopen } from "bun:ffi";

const { symbols } = dlopen("libhash.so", {
  hash: { args: ["buffer", "buffer_length"], returns: "cstring" },
});

const digest = symbols.hash(data, data);
typeof digest; // "string"
```

`returns: "cstring"` теперь возвращает обычную строку. `NULL` даёт `null`.

Когда вызов становится «горячим», JIT компилирует его в прямой вызов C-функции: типы аргументов известны из сигнатуры, поэтому значения передаются без box'инга в регистрах, минуя проверки типов.

### Dev tooling v1.3.2 v1.4.0

- `--cpu-prof`, `--cpu-prof-md`: `.cpuprofile` для Chrome DevTools, либо тот же профиль как Markdown-отчёт для вставки в баг или LLM; `BUN_CPU_PROFILE=1` — для процессов, которым нельзя передать флаги.
- `--heap-prof`, `--heap-prof-md`: V8-совместимый `.heapsnapshot` или Markdown-отчёт о крупнейших типах и объектах.
- **Async stack traces**: ошибки из async-нативных API (`fs.promises`, `Bun.file()`, S3, DNS, crypto, fetch) указывают на `await` в вашем коде.
- `--no-orphans`: Bun завершает работу, когда умирает его родитель, и SIGKILL'ит всех потомков при выходе — на Linux, macOS и Windows.
- `--no-env-file`: пропустить автоматическую загрузку `.env` в production и CI (`env = false` в bunfig.toml).

### HTTP/3 в Bun.serve() (экспериментально) v1.3.14 v1.4.0

`Bun.serve()` поддерживает HTTP/3. Установите `http3: true` рядом с `tls` — и Bun будет слушать UDP на том же порту.

HTTP/1.1 продолжает работать по TCP, а ответы рекламируют HTTP/3 через заголовок Alt-Svc, так что браузеры апгрейдятся сами.

На бенчмарке статических маршрутов HTTP/3 в 2.7 раза быстрее HTTPS/1.1 на том же сервере.

```js
Bun.serve({
  port: 443,
  tls: { ... },
  http3: true, // также слушает UDP/443 для HTTP/3
  // h1: false, // опционально: только HTTP/3
  fetch(req) {
    return new Response("hi");
  },
});
```

Экспериментально: возобновление соединения за нулевой RTT отключено, `server.upgrade()` возвращает `false` по H3, а unix-сокеты пропускают H3-listener. Не выкатывайте `http3: true` в production.

### HTTP/2 и HTTP/3 в fetch() (экспериментально) v1.3.14 v1.4.0

`fetch()` теперь поддерживает HTTP/2 и HTTP/3. Передайте `protocol: "http2"` или `protocol: "http3"`.

```js
const [a, b, c] = await Promise.all([
  fetch("https://api.example.com/a", { protocol: "http2" }),
  fetch("https://api.example.com/b", { protocol: "http2" }),
  fetch("https://api.example.com/c", { protocol: "http2" }),
]);

const res = await fetch("https://example.com", { protocol: "http3" });
```

По HTTP/2 параллельные запросы к одному origin'у разделяют одно соединение. Redirect, декомпрессия и стриминг работают так же, как по HTTP/1.1.

Чтобы включить везде, задайте `BUN_FEATURE_FLAG_EXPERIMENTAL_HTTP2_CLIENT=1` или передайте `--experimental-http3-fetch`. С флагом HTTP/3 Bun запоминает, какие origin'ы его поддерживают, и использует его для последующих запросов сам.

### Serve files & folders v1.4.0

Маршруты `Bun.serve()` теперь могут отдавать директорию.

Файлы стримятся через sendfile. `Content-Type`, `ETag`, `Last-Modified`, `304` и `Range` обрабатываются автоматически, для директорий отдаётся `index.html`. Это заменяет `express.static`, `serve-static` и `sirv`.

```js
Bun.serve({
  routes: {
    "/static/*": { dir: "./public" },
  },
});
```

При отдаче файлов с диска пути нормализуются перед поиском, а на Linux файлы открываются через `openat2` с `O_RESOLVE_BENEATH` — поэтому симлинк внутри директории не может выйти за её пределы.

### Range and conditional requests v1.3.13 v1.4.0

`Bun.serve` учитывает заголовок `Range` для файловых ответов — работает перемотка видео и возобновляемые загрузки. И статические маршруты, и `Bun.file()` тела возвращают `206 Partial Content`.

Статические маршруты и `Bun.file()`-ответы также обрабатывают conditional-запросы: `If-None-Match` и `If-Modified-Since` дают `304`, а `If-Match` и `If-Unmodified-Since` — `412`, когда условие не выполнено.

```js
Bun.serve({
  routes: {
    "/video.mp4": new Response(Bun.file("./video.mp4")),
    "/logo.png": new Response(Bun.file("./logo.png")),
  },
});
```

```bash
curl -H 'Range: bytes=0-1023' localhost:3000/video.mp4
```

```
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1023/104857600
```

```bash
curl -H 'If-None-Match: "1a2b3c"' localhost:3000/logo.png
```

```
HTTP/1.1 304 Not Modified
```

### HTML routes sourcemaps disabled in production v1.4.0

В production `Bun.serve` больше не отдаёт sourcemap'ы для HTML-маршрутов — ваш исходный код остаётся на сервере. Dev-режим по-прежнему их отдаёт. Чтобы выбрать явно, задайте `sourcemap` в `[serve.static]` в bunfig.toml.

```toml
[serve.static]
sourcemap = "linked"
```

### fetch() request compression v1.4.0

`fetch()` получает опцию `compress`. Она сжимает тело запроса перед отправкой и автоматически выставляет заголовок `Content-Encoding`. Поддерживаются gzip, deflate, br и zstd (с необязательным уровнем сжатия). Буферизованные тела (string, ArrayBuffer, TypedArray, Blob) сжимаются, и `Content-Length` отражает сжатый размер. Стриминг-тела проходят без изменений.

```js
await fetch(url, {
  method: "POST",
  body: largeJsonString,
  compress: "gzip", // или true, "deflate", "br", "zstd", { encoding, level }
});
```

### fetch() proxy headers v1.3.4

Опция `proxy` у `fetch()` теперь принимает и объект с `url` и `headers`, позволяя отправлять свои заголовки (например, `Proxy-Authorization`) прямо на прокси — независимо от того, HTTPS или обычный HTTP адресат.

```js
await fetch(url, {
  proxy: {
    url: "http://proxy.example.com:8080",
    headers: { "Proxy-Authorization": "Bearer token" },
  },
});
```

### TLS session resumption v1.4.0

Второе «холодное» соединение к origin'у возобновляется за 1 RTT. LRU-кэш на 32 записи хранит клиентские сессии BoringSSL по origin'у — так что переподключение после вытеснения из keep-alive-пула пропускает полный handshake и обход цепочки сертификатов.

### Connection reuse v1.3.10 v1.4.0

`fetch()` переиспользует соединения через HTTPS-прокси, а также для запросов с кастомными TLS-опциями (клиентский сертификат или свой CA).

### Also built in v1.3.3 v1.4.0

- **Bun.JSON5**: `Bun.JSON5.parse()`/`stringify()`; импорт `.json5`-файлов напрямую. Замена json5.
- **Bun.JSONL**: `parse()` и стриминговый `parseChunk()` для JSON с переносами строк. Замена ndjson.
- **Bun.JSONC.parse()**: JSON с комментариями и висящими запятыми — тот же парсер, что читает tsconfig.json. Замена jsonc-parser.
- **Bun.XML**: SIMD-парсер и сериализатор XML; импорт `.xml`-файлов напрямую. Замена fast-xml-parser и xml2js.
- **Bun.TOML**: TOML v1.1.0, 708/708 в toml-test; новый `stringify()`. Замена @iarna/toml.
- **Bun.Archive**: создание и извлечение tarball вне главного потока. Замена tar.
- **Bun.sliceAnsi(), Bun.wrapAnsi(), Bun.stringWidth()**: ANSI- и grapheme-aware обрезка, перенос и измерение по колонкам терминала. Замена slice-ansi, cli-truncate, wrap-ansi и string-width.
- **URLPattern**: Web API, 408 проходящих WPT. Замена path-to-regexp.
- **CompressionStream / DecompressionStream**: Web-standard потоки для gzip, deflate, deflate-raw, плюс brotli и zstd.
- **Response.textStream()**: `ReadableStream<string>` тела, декодированного в UTF-8.
- **process.on("memoryPressure")**: уведомление ОС о нехватке памяти на macOS, Linux и Windows.
- **ML-DSA и ML-KEM**: постквантовые подписи и инкапсуляция ключей NIST в `crypto.subtle` и `node:crypto`.
- **Bun.spawn({ cgroup })**: поместить дочерний процесс в cgroup до его запуска, на Linux.
- **bun repl**: нативный REPL: подсветка, история, таб-дополнение, `-e`/`-p`.
- **bun ./README.md**: рендер Markdown в терминал без запуска VM. Замена glow.

## bun install

`bun install` — npm-совместимый пакетный менеджер.

На T3-stack Next.js-приложении `bun install` во много раз быстрее yarn, pnpm и npm и использует долю их памяти. Это верно и для первой установки, и для чистого checkout, и для CI с кэшем/без, и для no-op переустановки.

Одно приложение, шесть установок · T3-stack Next.js-приложение, 25 прямых зависимостей, ~220 пакетов в lockfile · время и пик памяти:

| Scenario | bun v1.4 | npm v12.0.2 | pnpm v11.21.0 | yarn v1.22.22 |
| Первая установка, без кэша · без lockfile · без node_modules | 1.41s · 15× · 376 MB | 18.1s · 503 MB | 13.5s · 1.8 GB | 20.5s · 498 MB |
| Чистый checkout, тёплый кэш · lockfile нет · всё в кэше | 251ms · 30× · 52 MB | 7.61s · 798 MB | 2.38s · 1.1 GB | 1.83s · 204 MB |
| CI без кэша · lockfile закоммичен · tarball из registry | 951ms · 19× · 214 MB | 4.92s · 455 MB | 11.7s · 2.7 GB | 17.6s · 323 MB |
| CI с тёплым кэшем · lockfile закоммичен · cache восстановлен · node_modules пересобран | 210ms · 21× · 12 MB | 4.45s · 698 MB | 1.92s · 1.4 GB | 1.76s · 205 MB |
| node_modules есть, кэша нет · уже установлено · очищен только cache | 12ms · 33× · 12 MB | 384ms · 129 MB | 399ms · 141 MB | 212ms · 107 MB |
| Всё уже актуально · переустановка без изменений | 12ms · 33× · 12 MB | 337ms · 114 MB | 400ms · 141 MB | 211ms · 107 MB |

Linux x64, EPYC 9R14 · у каждого менеджера свой lockfile и node_modules, состояние готовится по сценарию перед каждым прогоном, всё на дефолтах · медианы из 3, пик памяти — максимум из 3 прогонов.

### Global virtual store: up to 7x faster installs v1.3.14 v1.4.0

`bun install --linker=isolated` теперь использует общий глобальный virtual store. Пакеты распаковываются один раз в кэш Bun и симлинкуются в `node_modules/.bun/` каждого проекта, вместо копирования в `node_modules` при каждой установке.

На тёплой isolated-установке копирование пакетов в `node_modules` (`clonefileat()` на macOS) составляло 95% времени главного потока, а macOS выполняет только один такой вызов за раз.

Как только пакет существует где-то на машине, следующие установки делают один `symlink()` на пакет вместо одного `clonefileat()`. На типичном пути CI (lockfile есть, кэш тёплый, node_modules вычищен) установка 1 400 пакетов в 7 раз быстрее. Глобальный store — опт-ин: он применяется, когда выбран isolated-линкер, который по умолчанию для существующих проектов не используется.

```toml
# bunfig.toml
[install]
linker = "isolated"
```

### bun pm diff v1.4.0

`bun pm diff` показывает, что изменилось между двумя версиями пакета.

Сначала идёт сводка: какие файлы изменились, есть ли новые install-скрипты и новые импорты `child_process`, `fs`, `net` или `vm`. Затем сам diff. Минифицированные файлы перед сравнением разминифицируются, а чисто форматные правки пропускаются — видно только реально изменённые строки.

```bash
bun pm diff react # версия в bun.lock → latest
```

```bash
bun pm diff react@18.2.0 19.0.0 # две опубликованные версии
```

```bash
bun pm diff ./vendored-pkg pkg@2.1.0 # папка против опубликованной версии
```

```bash
bun pm diff react-dom@18.2.0 18.3.1 '*.min.js'
```

### bun audit fix v1.4.0

`bun audit fix` обновляет уязвимые пакеты до безопасной версии и устанавливает их.

Если для исправления нужна новая major-версия, он сообщает об этом; `--latest` разрешает это сделать. `--dry-run` показывает, что бы изменилось.

```bash
bun audit fix
```

```
fixing:
  ms@0.7.0 → 0.7.1
  lodash@4.17.20 → 4.17.21
  package.json: 4.17.20 → 4.17.21

blocked by a dependent's range:
  minimatch@0.3.0 → 3.0.2
  express@3.21.2 depends on minimatch@0.3.0

Fixed 2 vulnerabilities in 2 packages
1 vulnerability remaining
```

### bun dedupe v1.4.0

`bun dedupe` удаляет дубликаты версий пакетов из `bun.lock`.

Если у вас есть `esbuild@0.15.10` и `esbuild@0.15.11` и одна версия удовлетворит обе — останется одна. Он никогда не меняет `package.json`, а `--check` падает в CI при наличии дубликатов.

```bash
bun dedupe
```

### bun prune v1.4.0

`bun prune` удаляет из `node_modules` пакеты, которых больше нет в `bun.lock`.

`bun prune --production` также удаляет devDependencies — можно собрать с ними, а задеплоить без них.

```bash
bun prune --production
```

Пример для Docker:

```dockerfile
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
RUN bun prune --production
```

### bun pm licenses v1.4.0

`bun pm licenses` перечисляет ваши зависимости по лицензиям. `--json` даёт машиночитаемый вывод, `--prod` пропускает devDependencies.

```bash
bun pm licenses --prod --json > licenses.json
```

### bun update updates transitive dependencies v1.4.0

`bun update` теперь обновляет и зависимости ваших зависимостей, а не только те, что в вашем `package.json`.

```bash
bun update
```

```bash
bun update zod
```

```bash
bun update '@types/*' --latest
```

`bun update <name>` обновляет этот пакет везде, где он встречается, а `bun update '@types/*'` принимает паттерн.

### bun add --filter v1.4.0

`bun add`, `bun remove` и `bun update` принимают `--filter` — можно добавить пакет в один воркспейс из корня монорепозитория.

```bash
bun add zod --filter api
```

```bash
bun run --filter 'web...' build
```

`--filter 'web...'` означает web и всё, от чего он зависит. `--filter '...web'` — всё, что зависит от web.

### bun add --catalog v1.4.0

`bun add <pkg> --catalog` добавляет пакет в корневой каталог и пишет `"catalog:"` в `package.json` воркспейса.

```bash
bun add react --catalog
```

Если пакет уже есть в вашем дефолтном каталоге, обычный `bun add` использует его.

### Nested overrides v1.4.0

Теперь можно переопределить зависимость зависимости, не переопределяя её везде. Работают npm-форма (`express: { qs }`), yarn-форма (`a/b`) и pnpm-форма (`a>b`), а override можно ограничить диапазоном версий.

```json
{
  "overrides": {
    "express": { "qs": "6.13.0" },
    "lodash@<4.17.21": "4.17.21"
  }
}
```

### Lockfile integrity для GitHub и tarball зависимостей v1.3.10

`bun.lock` теперь записывает SHA-512 хэш и для GitHub-, и для tarball-зависимостей — так же, как всегда делал для npm-пакетов. Существующие lockfile подхватят хэши при следующей установке.

```json
["pkg@github:user/repo#ref", {}, "resolved-commit"]
["pkg@github:user/repo#ref", {}, "resolved-commit", "sha512-..."]
```

### trustedDependencies доверяет только npm registry по умолчанию v1.3.5

Дефолтный список trusted-dependencies в Bun применяется только к пакетам из npm registry.

Зависимость `file:`, `link:`, `git:` или `github:` с именем `esbuild` не получает доверия от записи настоящего esbuild. Чтобы запустить её lifecycle-скрипты, укажите её в `trustedDependencies` сами.

```json
{
  "dependencies": {
    "esbuild": "github:some-fork/esbuild#main"
  },
  "trustedDependencies": ["esbuild"]
}
```

Имена trusted-зависимостей, имена scope в `.npmrc` и локальные `file:`-пути сравниваются по полным байтам, а не по хэшу; registry-креды остаются привязанными к настроенному хосту — никогда не отправляются на другой origin, не даунгрейдятся до `http://` и не печатаются в error/verbose-выводе.

### nativeDependencies и ignoreScripts v1.3.2

Для пакетов, поставляющих прекомпилированные бинарники как per-platform optionalDependencies (esbuild и `@esbuild/darwin-arm64`), Bun линкует нужный бинарник напрямую, вместо запуска postinstall. Укажите их в `nativeDependencies`.

`ignoreScripts` полностью пропускает lifecycle-скрипты пакета, даже если он есть в `trustedDependencies`.

Оба настраиваются в `package.json`; отключить нативное линкование бинарников можно через `BUN_FEATURE_FLAG_DISABLE_NATIVE_DEPENDENCY_LINKER=1`, а пропуск скриптов — через `BUN_FEATURE_FLAG_DISABLE_IGNORE_SCRIPTS=1`.

```json
{
  "nativeDependencies": ["esbuild", "my-custom-package"],
  "ignoreScripts": ["sharp", "another-package"]
}
```

## bun test

`bun test --parallel` запускает тест-файлы в воркер-процессах. `--shard` разбивает их по CI-машинам. `--timings` балансирует и то, и другое по реальному времени каждого файла. `--changed` запускает только тесты, которые затрагивает ваш дифф.

```bash
bun test --changed=main # только то, что трогает ваша ветка
```

```bash
bun test --parallel --timings=timings.json --update-timings
```

```bash
bun test --parallel --shard=1/3 --timings=timings.json # в CI, на машину
```

### bun test --parallel v1.3.13 v1.4.0

`bun test --parallel[=N]` запускает тест-файлы в N воркер-процессах (по умолчанию — число ваших CPU). Файл уходит тому воркеру, который освободится следующим.

```bash
bun test --parallel
```

```bash
bun test --parallel=4 --isolate
```

Coverage и JUnit-вывод объединяются между воркерами. `--bail` останавливает все воркеры при первом провале.

`--parallel` подразумевает `--isolate` (ниже). `--no-isolate` выключает это — каждый воркер держит один global и один module registry для каждого файла.

Каждый воркер отдаёт свой 1-индексированный слот как `JEST_WORKER_ID` / `BUN_TEST_WORKER_ID`, поэтому Jest-сетапы, которые выстраивают БД или порты по `JEST_WORKER_ID`, работают без изменений. Preload-скрипты с top-level await завершаются до того, как воркеры начнут запуск тестов. На тех же 24 тест-файлах `--parallel=4` ускоряет прогон примерно в 3.9 раза (9.4s → 2.4s).

### bun test --isolate v1.3.13 v1.4.0

`bun test --isolate` запускает каждый тест-файл в свежем глобальном объекте JavaScript в том же процессе — так по умолчанию ведут себя Jest и Vitest. Это убирает баги вида «в одиночку проходит, в полном suite падает».

```bash
bun test --isolate
```

Между файлами Bun:

- создаёт новый `globalThis`, поэтому свойства, которые файл положил в `globalThis`, патченные встроенные модули и состояние на уровне модуля исчезают;
- очищает ESM и CommonJS module registries, поэтому каждый файл пере-вычисляет свои импорты;
- закрывает серверы, сокеты, файловые watcher'ы и подпроцессы, которые файл оставил открытыми, отменяет таймеры и восстанавливает fake timers;
- повторно запускает `--preload`-скрипты в новом global.

Транспилированный исходник и байткод кэшируются на уровне процесса и разделяются между global'ами. Второй файл, импортирующий модуль, пропускает чтение, транспиляцию и парсинг — снова выполняется только top-level-код модуля.

Bun 1.4 чинит несколько проблем стабильности из первой версии `--isolate`: fake timers больше не протекают в следующий файл; подпроцессы, запущенные на уровне модуля, убиваются по завершении файла; `process.chdir()` в одном файле не меняет рабочую директорию следующего; утёкшие хэндлы больше не держат global-объект в памяти; нативные аддоны (N-API) корректно работают между файлами; дебаггер разрешает брейкпоинты в файлах под `--isolate`.

### bun test --shard v1.3.13 v1.4.0

`bun test --shard=M/N` разбивает тест-файлы по нескольким CI-раннерам. Файлы сортируются детерминированно и распределяются round-robin так, что каждая машина видит одно и то же разбиение, с 1-индексированием, как в Jest, Vitest и Playwright. Работает вместе с `--changed` и `--randomize`. Пустой шард завершается кодом 0, а не ошибкой.

```bash
# В матрице из 3 job'ов:
bun test --shard=1/3
```

```bash
bun test --shard=2/3
```

```bash
bun test --shard=3/3
```

### bun test --timings v1.4.0

`--timings=<path>` читает длительности файлов из прошлого прогона, чтобы `--shard` и `--parallel` балансировали по wall-time, а не по числу файлов. `--update-timings` записывает длительности.

```bash
bun test --timings=timings.json --update-timings # записать длительности по файлам
```

```bash
bun test --shard=1/3 --timings=timings.json # нарезать шарды по равному времени
```

```bash
bun test --parallel --timings=timings.json # воркеры стартуют с самого медленного
```

С timings каждый шард получает примерно одинаковое суммарное время, а не одинаковое число файлов. Файлы с общими импортами остаются вместе, поэтому module cache остаётся тёплым. `--parallel` запускает каждый воркер с самого медленного файла; файл длительностей пишется от медленного к быстрому, так что он же служит отчётом о медленных тестах.

### bun test --changed v1.3.13 v1.4.0

`bun test --changed` запускает только те файлы, на которые влияют ваши незакоммиченные изменения, или дифф против ветки/коммита через `--changed=main`. Флаг совместим с vitest.

```bash
bun test --changed # незакоммиченные (unstaged + staged + untracked)
```

```bash
bun test --changed=HEAD~1 # дифф против коммита / ветки / тега
```

```bash
bun test --changed=main
```

```bash
bun test --changed --watch # перефильтрация при каждом рестарте
```

Bun сканирует импорты каждого тест-файла, спрашивает у git, какие файлы изменились, и обходит граф импортов в обратную сторону, находя тесты, которые их достигают. Псевдонимы tsconfig paths вроде `@/*` работают. С `--watch` правка любого исходника перефильтровывает при рестарте.

### bun test --retry v1.3.3 v1.4.0

`test()` принимает `{ retry: n }`, чтобы перезапускать флакийный тест до n раз, и `{ repeats: n }`, чтобы запускать n раз и падать, если упадёт хоть один прогон. `bun test --retry <N>` задаёт дефолт для всего suite.

```js
test(
  "flaky network call",
  async () => {
    await fetch("https://example.com");
  },
  { retry: 5 }
);

test(
  "stress",
  () => {
    if (Math.random() < 0.1) throw new Error("uh oh!");
  },
  { repeats: 20 }
);
```

### jest.useFakeTimers() v1.3.4 v1.4.0

`jest.useFakeTimers()` позволяет управлять `setTimeout`, `setInterval` и `Date` из тестов. `@testing-library/react`'s `waitFor` детектит fake timers и продвигает их, не ожидая в реальном времени.

```js
import { jest, test, expect } from "bun:test";

test("debounce", () => {
  jest.useFakeTimers();
  let called = 0;
  setTimeout(() => called++, 1000);
  jest.advanceTimersByTime(1000);
  expect(called).toBe(1);
  jest.useRealTimers();
});
```

`jest.setSystemTime()` работает вместе с `advanceTimersByTime()`, а расписания `Bun.cron` можно продвигать по fake-часам.

## bun build

### Built-in React Compiler v1.4.0

`bun build --react-compiler` (или `reactCompiler: true` в `Bun.build()`) запускает компилятор автоматической мемоизации React на ваших компонентах и хуках — без Babel или SWC в цепочке. Компилятор работает внутри собственного парсера Bun, поэтому нет отдельного прохода парсинг/печать.

На большом React-кодбейзе (~860 компонентов) включение добавляет 71 мс к сборке (394 → 465 мс) — примерно в 20 раз быстрее Babel-плагина (9.15 с на том же входе). Полная `--compile`-сборка — 3.62 с против 13.04 с (в 3.6 раза).

```js
await Bun.build({
  entrypoints: ["./src/index.tsx"],
  outdir: "./dist",
  reactCompiler: true,
});
```

### Barrel import optimization v1.3.10 v1.4.0

Когда вы пишете `import { Button } from "antd"`, Bun пропускает сотни файлов за теми именами, которые вы не импортировали.

Пакеты, объявляющие `"sideEffects": false`, получают это автоматически. Для остальных — опт-ин через `optimizeImports`.

```js
await Bun.build({
  entrypoints: ["./src/index.tsx"],
  optimizeImports: ["antd", "@mui/material"],
});
```

Из ~70 top-level экспортов antd парсится и таким образом учитывается только то, что реально нужно (в примере Bun 1.4 парсит 4 модуля за 6 мс вместо всего barrel-файла).

### Compile-time feature flags с bun:bundle v1.3.5

`feature("FLAG")` из `bun:bundle` становится `true` или `false` на этапе сборки, а мёртвая ветка удаляется.

Флаги задаются через `--feature=FLAG` или `features: [...]` в `Bun.build()`. Они работают в `bun build`, `bun run` и `bun test`.

```js
import { feature } from "bun:bundle";

if (feature("SUPER_SECRET")) {
  console.log("Secret feature enabled!");
}

// bun build --feature=SUPER_SECRET index.ts
```

### In-memory files в Bun.build() v1.3.6

`Bun.build()` принимает опцию `files`: карту путей к строкам, Blob или TypedArray. Так можно собрать бандл полностью из памяти или смешать виртуальные модули с реальными файлами на диске — виртуальные пути имеют приоритет. Удобно для codegen или подмены модуля в тестах без записи на диск.

```js
await Bun.build({
  entrypoints: ["/app/index.ts"],
  files: {
    "/app/index.ts": `import { greet } from "./greet.ts"; console.log(greet("World"));`,
    "/app/greet.ts": `export function greet(name: string) { return "Hello, " + name + "!"; }`,
  },
});
```

### Single-file HTML с --compile --target=browser v1.3.10

`bun build --compile --target=browser` создаёт один HTML-файл со всеми встроенными скриптами, стилями и ассетами. Его можно открыть двойным кликом по `file://`, без веб-сервера.

```bash
bun build ./index.html --compile --target=browser --outdir=dist
# → dist/index.html (всё встроено, ноль внешних запросов)
```

### metafile: true v1.3.6 v1.4.0

`Bun.build()` поддерживает `metafile: true`, возвращая метаданные сборки в формате metafile от esbuild: полную карту входов, выходов, импортов, экспортов и размеров в байтах. `result.metafile` работает как есть с `https://esbuild.github.io/analyze/` и всем остальным, что читает формат esbuild.

```js
const result = await Bun.build({
  entrypoints: ["./index.js"],
  metafile: true,
});

console.log(result.metafile.inputs);
console.log(result.metafile.outputs);
```

### --metafile-md v1.3.8 v1.4.0

`bun build --metafile-md` пишет граф модулей как Markdown-отчёт: быстрая сводка, крупнейшие входные файлы, разбивка по точкам входа, цепочки зависимостей и grep-friendly raw-секция. Отчёт — обычный Markdown, так что его можно вставить в LLM и спросить, почему бандл большой.

```bash
bun build entry.js --metafile-md --outdir=dist
```

```bash
bun build entry.js --metafile-md=analysis.md --outdir=dist
```

```bash
bun build entry.js --metafile=meta.json --metafile-md=meta.md --outdir=dist
```

### Standard TC39 decorators v1.3.10 v1.4.0

Теперь в Bun можно использовать стандартные TC39-декораторы.

```js
function logged(value, { kind, name }) {
  if (kind === "method") {
    return function (...args) {
      console.log(`calling ${name}`);
      return value.call(this, ...args);
    };
  }
}

class C {
  @logged
  greet() {}
}
```

Это те декораторы, которые вы получаете при `experimentalDecorators: false` в tsconfig.json. Работают на классах, методах, полях, аксессорах и приватных членах. Bun проходит тест suite декораторов esbuild.

### --asset v1.4.0

`bun build --compile --asset <path>` встраивает файл или целую директорию в исполняемый файл, сохраняя исходные имена. Используйте это для папки `public/`, шаблонов или SvelteKit `client/`-сборки. `path.join(import.meta.dir, ...)` находит их так же, как на диске.

`node:fs` теперь трактует `/$bunfs/` как настоящее дерево директорий: `existsSync`, `statSync`, `lstatSync`, `accessSync`, `readdirSync` и `fs.promises.readdir` (включая `{ withFileTypes: true }` и `{ recursive: true }`) работают с встроенными путями — поэтому static-file серверы, которые перечисляют директорию при старте, работают без изменений внутри скомпилированного бинарника.

```bash
bun build ./build/index.js --compile \
  --asset ./build/client --asset ./build/prerendered \
  --outfile server
```

```bash
./server # каждый маршрут и статический ассет отдаются из бинарника
```

### Bytecode compilation для ES modules v1.3.9 v1.4.0

`--bytecode` теперь поддерживает ES modules. `--bytecode --format=esm` требует `--compile` и включает в байткод-скомпилированных бинарниках top-level await, `import.meta`, динамические импорты и code splitting; раньше `--bytecode` принудительно давал CommonJS-вывод.

### Code splitting на графах из 20 000 модулей в 14 раз быстрее v1.4.0

Обход достижимости в code splitting теперь BFS и O(V+E). Diamond-граф из 20 000 модулей линкуется за 320 мс вместо 4.65 с. Travel-анализ tree-shaking, валидация TLA, CSS-order и part-visitor проходы выполняются на явных стеках — линейные цепочки импортов из тысяч модулей линкуются без роста стека.

## Faster

Между Bun 1.3 и 1.4 мы 39 раз обновили наш пин WebKit, притащив примерно восемь месяцев работы над JavaScriptCore; regex-движок, Promise и большинство встроенных String/Array переехали из self-hosted JavaScript в C++, а Bun поменял zlib и SIMD-ядра на собственные горячие пути.

### new URL() до 4.6 раза быстрее v1.4.0

Парсер URL переписан. Разбором занимается новый парсер WebKit. На стороне Bun `href` переиспользует входную строку, кэшируется последний базовый URL, а уже ASCII punycode-хосты пропускают ICU.

| Operation | Bun 1.3 | Bun 1.4 | Node.js 26 |
| new URL("http://localhost:3000/api/users/42") | 349 ns | 75 ns | 232 ns |
| new URL("../x", base) | 523 ns | 168 ns | 612 ns |
| url.href | 16 ns | 5 ns | 8 ns |

### Faster RegExp v1.4.0

Закрыт разрыв в производительности RegExp между JavaScriptCore и V8.

`marked.parse()` стал в 138 раз быстрее: на 80 KB Markdown-фикстуре он выполняется ~6 мс вместо 912 мс. `isbot` — в 200 раз быстрее: один вызов на типичном user agent занимает 1.07 мкс вместо 218 мкс в Bun 1.3 (в Node.js 26 — 1.47 мкс).

### node:zlib использует zlib-ng v1.3.13 v1.4.0

Bun теперь использует zlib-ng — ту же библиотеку, что Node.js 24 и Chromium, — для `node:zlib`, gzip-ответов `fetch()` и всего остального, что сжимается. На рантайме выбирается самый быстрый код-путь под ваш CPU.

Время на вызов на 1 MB JSON, дефолтный уровень, мс:

| Encoding | Operation | Bun 1.4 | Bun 1.3 | Node.js 26 | Deno 2.9 |
| gzip | gzipSync | 9.36 | 9.11 | 10.27 | 9.76 |
| gzip | gunzipSync | 1.28 | 1.56 | 2.11 | 2.06 |
| deflate | inflateSync | 1.21 | 1.54 | 1.95 | 2.07 |
| brotli | brotliDecompressSync | 1.38 | 1.40 | 2.11 | 2.39 |
| zstd | zstdCompressSync | 2.09 | 2.18 | 2.09 | 2.18 |
| zstd | zstdDecompressSync | 0.81 | 0.73 | 1.57 | 1.65 |

Пик памяти, те же прогоны, MB:

| Encoding | Operation | Bun 1.4 | Bun 1.3 | Node.js 26 | Deno 2.9 |
| gzip | gzipSync | 50 | 74 | 75 | 69 |
| gzip | gunzipSync | 62 | 94 | 125 | 129 |
| deflate | inflateSync | 63 | 94 | 126 | 128 |
| brotli | brotliDecompressSync | 73 | 110 | 129 | 130 |
| zstd | zstdCompressSync | 55 | 79 | 77 | 71 |
| zstd | zstdDecompressSync | 62 | 95 | 128 | 136 |

Скорость сжатия зависит от входа: на JSON gzip-сжатие такое же, как в 1.3; на повторяющемся HTML `gzipSync` на 1 MB занимает 3.9 мс вместо 5.75 мс. Декомпрессия быстрее примерно на 20% везде, а пик памяти ниже на 25–35 MB.

### Buffer.from(str, "hex") в 8 раз и "base64url" в 46 раз быстрее v1.4.0

`Buffer.from(str, "hex")` и `Buffer.from(str, "base64url")` декодируются через SIMD.

Декодирование 1 MiB:

| Encoding | Bun 1.4 | Bun 1.3 | Node.js 26 | Deno 2.9 |
| hex | 128 µs | 1 035 µs | 743 µs | 3 863 µs |
| base64url | 84 µs | 3 897 µs | 68 µs | 104 µs |

### Source map decoding в 3.1 раза быстрее v1.4.0

Декодирование sourcemap использует SIMD. `new SourceMap(json)` на карте 9.5 MB занимает 12 мс — в 3.1 раза быстрее прежнего и в 24 раза быстрее Node.js.

### Promises на 1.5–2.4 раза быстрее v1.4.0

JavaScriptCore переписал реализацию Promise, снизив накладные расходы.

Время на операцию, 2 миллиона итераций:

| Operation | Bun 1.4 | Bun 1.3 |
| Promise.race из 4 промисов | 142 ns | 342 ns |
| Promise.all из 4 промисов | 207 ns | 316 ns |
| Promise.allSettled из 4 промисов | 253 ns | 411 ns |
| await уже-resolved промиса | 84 ns | 143 ns |
| цепочка .then() из 4 | 172 ns | 332 ns |
| async-функция без await | 37 ns | 89 ns |

Память: 1 000 000 висящих промисов, резолвнутых разом:

| | Bun 1.4 | Bun 1.3 |
| Peak memory | 251 MB | 668 MB |
| Time to settle | 12.5 ms | 39.0 ms |

## Security

Bun 1.4 включает много security-исправлений. Мы рекомендуем всем обновиться. Большинство из них не изменят ничего заметного — они перечислены в changelog под «Security hardening». Немногие пункты ниже ужесточают дефолт, в большинстве случаев — проверку TLS-сертификата. Это может превратить соединение, которое работало на 1.3, в ошибку верификации. Адвайзери появятся на GitHub, когда люди успеют обновиться.

### checkServerIdentity выполняется до отправки запроса fetch() v1.4.0

Когда вы передаёте `tls: { checkServerIdentity }` в `fetch()`, колбэк выполняется после TLS-handshake и до записи любой части запроса, а также снова на каждом redirect-прыжке. Если он возвращает `Error`, `fetch()` отклоняется с этой ошибкой, и ничего не отправляется.

```js
await fetch("https://api.example.com/upload", {
  method: "POST",
  body: secretPayload,
  tls: {
    checkServerIdentity(hostname, cert) {
      if (cert.fingerprint256 !== PINNED) return new Error("pin mismatch");
    },
  },
});
// ничего не отправляется, пока checkServerIdentity не вернёт undefined
```

Если вы пинните сертификат так и URL редиректит через хост с другим сертификатом, колбэк теперь видит и его — либо принимайте сертификат каждого прыжка, либо передайте `redirect: "manual"` и следуйте `Location` сами.

### tls.connect теперь использует host как дефолтный servername v1.3.13

`tls.connect({ host, port })` без `servername` теперь использует `host` и для SNI, и для проверки идентичности сертификата — как в Node.js. Подключение по IP-адресу или к localhost теперь падает с `ERR_TLS_CERT_ALTNAME_INVALID`, когда сертификат выпущен на другое имя. Это касается и ваших прямых вызовов `tls.connect()`, и драйверов вроде pg или ioredis. Передайте имя сертификата как `servername`. Либо `checkServerIdentity: () => undefined`, если вы сознательно доверяете серверу только по его CA.

```js
tls.connect({
  host: "10.0.0.12",
  port: 5432,
  ca,
  servername: "db.internal",
});
```

### Bun.connect и Bun.listen теперь применяют rejectUnauthorized v1.4.0

`Bun.connect({ tls })`, `socket.upgradeTLS()` и `Bun.listen()` с `requestCert: true` теперь по умолчанию используют `rejectUnauthorized: true`, как `node:tls` и `fetch()`. Типичный случай — `Bun.connect()` к dev/staging-серверу с самоподписанным или private-CA сертификатом и без `ca`. Ошибки не выбрасывается: handshake-обработчик выполняется с `socket.authorized === false`, записи возвращают `-1`, сокет закрывается без доставки данных. Передайте CA в `tls`, либо `rejectUnauthorized: false` (здесь также уважается `NODE_TLS_REJECT_UNAUTHORIZED=0`).

### RedisClient проверяет hostname по TLS v1.3.14

`rediss://`-клиент `RedisClient` сверяет сертификат сервера с хостом в URL — как клиенты Postgres и MySQL, — и отклоняет первую команду с `ERR_TLS_CERT_ALTNAME_INVALID` при несовпадении. Если вы подключаетесь к Redis по IP или через port-forward на localhost — подключайтесь по имени из сертификата, либо передайте `tls: { rejectUnauthorized: false }`.

### HTTP request parsing hardening в Bun.serve v1.3.4

`Bun.serve()` отвечает `400` и закрывает соединение для большего числа видов кривых заголовков `Content-Length` и `Transfer-Encoding` и chunked-тел. Браузеры, curl, `fetch()` и reverse-прокси ничего такого не отправляют. Если самописный клиент начал получать `400`, сперва смотрите его framing-заголовки — для большинства таких случаев Bun не вызывает ваш fetch-обработчик и ничего не логирует.

### Tarball extraction hardening v1.3.6

Извлечение tarball для `github:`/URL-зависимостей и `bun create`-шаблонов пропускает записи, которые приземлились бы вне каталога пакета. Если после апгрейда у такого пакета чего-то не хватает и вы получаете `Cannot find module` — поищите в его репозитории симлинк, указывающий наружу пакета, и замените его реальным файлом или относительной ссылкой.

## Platforms

### Native FreeBSD builds v1.3.14 v1.4.0

Bun теперь поставляет официальные FreeBSD-бинарники для x86_64 и aarch64. На FreeBSD 14.3+ полный рантайм (`Bun.serve()`, `fetch()`, `node:fs`, `node:os`, `Bun.spawn`) работает на чистой установке без дополнительных системных пакетов. Это нативный порт, собранный с собственными kernel API FreeBSD, а не Linux-совместимый слой.

```bash
curl -fsSL https://bun.sh/install | bash
```

```bash
uname -sm
```

```
FreeBSD amd64
```

```bash
bun --version
```

```
1.4.0
```

### Windows on ARM64 v1.3.7 v1.4.0

Bun теперь собирается нативно для Windows on ARM64. Машины на Surface, Snapdragon X и Ampere запускают Bun нативно.

```powershell
PS> powershell -c "irm bun.sh/install.ps1|iex"
PS> $env:PROCESSOR_ARCHITECTURE
ARM64
PS> bun --version
1.4.0
```

### Experimental Android support v1.4.0

Bun поставляет экспериментальные Android-сборки для aarch64 и x64 с каждым релизом.

### Linux glibc минимум снижается до 2.17 v1.3.13

Минимальное требование glibc на Linux снижается с 2.26 до 2.17. Bun теперь работает на RHEL/CentOS 7, Amazon Linux 1 и ARM64 Linux-дистрибутивах без отдельной compatibility-сборки.

### Fallback для in-memory files на старых ядрах Linux v1.3.13

На ядрах Linux старше 3.17, например на RHEL 7, Bun один раз детектит отсутствие `memfd_create` и переключается на фолбэк. Задокументированный минимум ядра теперь — 3.10.

```bash
BUN_FEATURE_FLAG_DISABLE_MEMFD=1 bun run server.ts
```

### Готов к TypeScript 7

`bun init` и React-шаблоны поставляют `tsconfig.json`, работающий с TypeScript 7, а `@types/bun` разрешается относительно него корректно.

```json
{
  "compilerOptions": {
    "types": ["bun"]
  }
}
```

### Таймеры быстрее 15 мс на Windows v1.4.0

На Windows `setTimeout(fn, 1)` срабатывает примерно за 1.4 мс вместо 15.5 мс. Таймеры больше не округляются до системного тика 15.6 мс.

### Bun работает внутри AppContainer v1.4.0

Bun запускается в Windows AppContainer, так что встраивающие хосты могут песочничать его с помощью lowbox-токена. `bun install`, `bun run`, `Bun.spawn`, `child_process.fork` и `Bun.Terminal` работают внутри контейнера. Bun также работает в директориях только для чтения (например, Program Files) и на read-only сетевых шарах и больше не падает, когда предок-директория недоступна для чтения.

## Upgrading to 1.4

Большинство кода не затронуто. Пять изменений с наибольшей вероятностью потребуют строки в вашем проекте:

- **Node.js 26**: теперь `process.versions.modules` равен 147. Пакеты, выбирающие прекомпилированный native-аддон по `NODE_MODULE_VERSION`, нуждаются в сборке под 147. `res.writeHeader()` удалён; используйте `res.writeHead()`. В paused-режиме `readable.read()` возвращает один чанк.
- **Новые монорепозитории по умолчанию используют isolated-линкер.** `bun.lock` записывает `configVersion: 1`. Существующие lockfile сохраняют hoisted-линкер. Чтобы отказаться, закрепите `linker = "hoisted"` в bunfig.toml.
- **Bun, вызванный как node** (`bun --bun`, `bunx --bun`, симлинк node) не загружает `.env`-файлы — как Node. Передайте `--env-file`, чтобы их сохранить.
- **Bun.YAML следует YAML 1.2**: `yes/no/on/off` — строки. `on:` в GitHub Actions workflow парсится как `"on"`.
- **Bun.TOML и bunfig.toml строгие**: строки без кавычек, отсутствие переводов строк между парами и целые числа за `Number.MAX_SAFE_INTEGER` — это SyntaxError.

### Node.js 26: NODE_MODULE_VERSION 147, res.writeHeader() удалён, paused read() возвращает один чанк v1.4.0

Bun теперь сообщает Node.js 26. Меняются три вещи:

- `process.versions.modules` равен 147. Пакеты, выбирающие prebuilt-аддон по `NODE_MODULE_VERSION`, нуждаются в сборке под 147.
- `res.writeHeader()` в `node:http` удалён. Вызывайте `res.writeHead()`.
- В paused-режиме `readable.read()` без размера возвращает один буферизованный чанк (раньше — весь буфер; `setEncoding()` сохраняет старое поведение). Циклитесь, пока не получите `null`.

```js
res.writeHeader(200, { "Content-Type": "text/plain" });
res.writeHead(200, { "Content-Type": "text/plain" });
```

### x64-сборки теперь только baseline v1.4.0

x64-релизы теперь поставляют только baseline-сборку. Отдельная сборка, скомпилированная с `-march=haswell`, удалена. URL-загрузки `-baseline` и npm-пакеты по-прежнему существуют и содержат тот же бинарник. Существующие install-скрипты и `bun upgrade` продолжают работать. Предупреждение о старте без поддержки AVX удалено.

### Temporal включён по умолчанию, toEqual() сравнивает Temporal-объекты по значению v1.4.0

`Temporal` и `Date.prototype.toTemporalInstant` теперь определены. Выключить можно через `BUN_JSC_useTemporal=0`. `Bun.deepEquals()`, `toEqual()`, `toStrictEqual()` и `util.isDeepStrictEqual()` теперь сравнивают Temporal-объекты по значению. Раньше любые два экземпляра одного класса считались равными.

```js
Bun.deepEquals(
  Temporal.PlainDate.from("2020-01-01"),
  Temporal.PlainDate.from("1999-12-31")
); // false
```

### bun:ffi: cstring-значения — это обычные строки, CString больше не имеет .ptr v1.4.0

`bun:ffi` теперь engine-native. Меняются четыре вещи:

- Значение `returns: "cstring"` или аргумент-колбэк `cstring` — это обычная строка. `NULL`-указатель — `null`.
- `new CString(ptr)` возвращает строку без `.ptr`, `.byteLength` и `.arrayBuffer`. Сохраните исходный указатель, если его нужно освободить.
- Типы аргументов `napi_env` и `napi_value` выбрасывают `TypeError` вне `cc()`.
- `dlopen()` и другие точки входа выбрасывают `TypeError`, когда JIT отключён.

```js
const str = new CString(ptr);
my_library_free(str.ptr);
my_library_free(ptr);
```

### bun build --compile больше не автозагружает tsconfig.json/package.json на рантайме v1.3.4

Standalone-исполняемые файлы, собранные с `bun build --compile`, больше не загружают автоматически `tsconfig.json` и `package.json` из рабочей директории. Раньше скомпилированный бинарник мог подхватить чужие конфиг-файлы из директории, где запускался. Вернуть можно через `--compile-autoload-tsconfig` / `--compile-autoload-package-json` (или `compile.autoloadTsconfig` / `compile.autoloadPackageJson` в `Bun.build()`). `.env` и `bunfig.toml` по-прежнему автозагружаются по умолчанию; у них остаются флаги `--compile-autoload-dotenv` / `--compile-autoload-bunfig`.

### bun install по умолчанию использует isolated-линкер для новых монорепозиториев v1.3.2

Новые монорепозитории (проекты с workspaces) теперь используют `linker: "isolated"` — симлинковую раскладку `node_modules`, предотвращающую phantom-зависимости. Нужен `configVersion`. Существующие lockfile (config version 0) сохраняют hoisted-линкер, с которым создавались. Ваша раскладка `node_modules` при апгрейде не меняется.

```toml
# bunfig.toml: закрепите старое поведение, если нужно
[install]
linker = "hoisted"
```

### bun.lock теперь lockfileVersion: 2 v1.4.0

Новые lockfile используют версию 2. Версия 2 добавляет две более строгие проверки на этапе парсинга:

- npm-пакеты, разрешённые в tarball вне вашего настроенного registry, обязаны нести integrity-хэш;
- git-зависимости валидируются на блокировку path traversal (никаких `/`, `\` или `..`).

Lockfile, записанные как v0/v1, продолжают загружаться без этих проверок. Существующие проекты не ломаются. Выполните `bun install`, чтобы мигрировать.

### Bun, вызванный как node, не загружает .env-файлы v1.4.0

Когда Bun работает как node (под `bun --bun`, `bunx --bun` или node-симлинком на Bun), он больше не загружает `.env`, `.env.local` или `.env.{development,production,test}` — как Node.js. `bun file.js` их по-прежнему загружает. Скрипт package.json, вызывающий `node` под `bun --bun run`, теперь видит эти переменные как `undefined`. Чтобы их сохранить, передайте `--env-file` команде node.

```json
"scripts": {
  "check": "node ./check.js"
  "check": "node --env-file=.env ./check.js"
}
```

### Bun.YAML парсит yes/no/on/off как строки, а не булевы v1.3.5

`Bun.YAML` теперь парсит булевы по спецификации YAML 1.2. `yes/no/on/off/y/Y` — обычные строки, не булевы. Это легаси-значения YAML 1.1, убранные из 1.2. Ключ `on:` в GitHub Actions workflow теперь парсится как строка `"on"`, а не `true`. В булевы разрешаются только `true/True/TRUE` и `false/False/FALSE`.

```js
Bun.YAML.parse("on: push");
// { on: "push" }
```

### Bun.TOML.parse() и bunfig.toml строже и выбрасывают SyntaxError v1.4.0

Переписанный парсер `Bun.TOML` выбрасывает `SyntaxError` вместо `BuildMessage`. Он отклоняет TOML, который старый парсер пропускал:

- значения строк без кавычек;
- отсутствие переводов строк между парами ключ/значение;
- целые числа за `Number.MAX_SAFE_INTEGER`.

Теперь `bunfig.toml` со значением без кавычек падает на старте с `TOML Parse error: Strings must be quoted`.

```toml
[install]
linker = isolated
linker = "isolated"
```

### .xml-импорты теперь возвращают распарсенный документ вместо пути к файлу v1.4.0

`import`/`require()` `.xml`-файла теперь возвращает тот же объект, что `Bun.XML.parse()`. Это работает и на рантайме, и в `bun build`. Раньше возвращался путь к файлу. Файл, который не парсится, выбрасывает ошибку на рантайме и валит сборку. Чтобы получить путь, передайте `--loader .xml:file`.

### import "." и import ".." теперь разрешаются как директории v1.4.0

`"."` и `".."` в `import`/`require()` теперь разрешаются в index-файл или `package.json` `main` директории — как в Node.js. Раньше они разрешались в соседний файл с именем директории: так, `"."` внутри `lib/run.ts` грузил `lib.ts`, а теперь грузит `lib/index.ts`. Чтобы сохранить соседний файл, назовите его.

```js
import { e } from ".";
import { e } from "../lib";
```

### .css-импорты на рантайме теперь экспортируют {} вместо пути к файлу v1.4.0

На рантайме дефолтный экспорт `.css`-импорта теперь `{}`. Это касается `import`, `require()`, динамического `import()` и Workers. Раньше это был абсолютный путь к файлу как строка. `bun build` уже генерировал `{}`. `.module.css` по-прежнему отличается от `bun build`, который выдаёт карту имён классов.

### "jsx": "react-jsx" в tsconfig.json теперь генерирует jsx вместо jsxDEV v1.4.0

С `"jsx": "react-jsx"` `bun run` и `bun build` теперь импортируют `jsx` и `jsxs` из `<pkg>/jsx-runtime`. Раньше оба импортировали `jsxDEV` из `<pkg>/jsx-dev-runtime`, если не были заданы `NODE_ENV=production` или `--production`. Явный `NODE_ENV` по-прежнему побеждает. Чтобы сохранить dev-рантайм, задайте `"jsx": "react-jsxdev"`.

```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
    "jsx": "react-jsxdev"
  }
}
```

### useDefineForClassFields: false в tsconfig.json теперь учитывается v1.4.0

С `useDefineForClassFields: false` Bun делает то же, что tsc: инициализаторы полей экземпляра переносятся в конструктор после присваиваний параметров-свойств; поля только с объявлением отбрасываются. Раньше опция игнорировалась. Инициализатор, читающий параметр-свойство, теперь работает вместо броска. Приватные и декорированные поля сохраняют объявления. Статические поля и классы с вычисляемым нелитеральным ключом поля остаются как были. Чтобы сохранить старый вывод, удалите опцию.

### Bun.Socket#setKeepAlive() теперь трактует initialDelay как миллисекунды v1.4.0

`setKeepAlive(true, delay)` на `Bun.Socket` теперь делит `delay` на 1000 перед установкой `TCP_KEEPIDLE` — как задокументировано. Раньше сырое значение использовалось как секунды, поэтому 4000 значило 4000 секунд. Значение меньше 1000 теперь делится до 0 и оставляет `TCP_KEEPIDLE` неизменным. Код, передававший секунды, должен передавать миллисекунды. `setKeepAlive(true)` теперь возвращает `true`, а не `false`. `net.Socket#setKeepAlive()` по-прежнему ставит то же kernel-значение.

```js
socket.setKeepAlive(true, 60);
socket.setKeepAlive(true, 60_000);
```

### Bun.mmap({ offset }) теперь начинает вью с offset v1.4.0

`Bun.mmap(path, { offset })` теперь возвращает вью, чей индекс 0 — это байт на `offset`. Раньше `offset` округлялся вниз до границы страницы, и вью начиналось с этой границы — и для чтений, и для записей через `{ shared: true }`. Уберите компенсацию `offset % pageSize`, которую вы могли добавить.

```js
const m = Bun.mmap("data.bin", { offset: 100 });
m[0]; // байт 0 файла
m[0]; // байт 100 файла
```

### Bun.cron.parse() и in-process Bun.cron() теперь используют локальное время v1.4.0

`Bun.cron.parse()` и overload `Bun.cron(schedule, handler)` теперь читают расписания в локальной временной зоне процесса. Раньше они использовали UTC. Это соответствует overload'у, регистрируемому в ОС. `"0 9 * * *"` при `TZ=America/Los_Angeles` теперь означает 9:00 по Тихоокеанскому. Чтобы сохранить старые времена, передайте `{ tz: "UTC" }` — оба принимают его как новый финальный аргумент.

```js
Bun.cron("0 9 * * *", handler);
Bun.cron("0 9 * * *", handler, { tz: "UTC" });
```

### Bun.$ теперь глоублит только паттерны из самого шаблона v1.4.0

Glob-символы, приходящие через `${...}`, shell-переменную, подстановку команд или кавычки, теперь литеральны. Раскрываются только `*`, `**` и фигурные скобки, написанные прямо в шаблоне. `?`, `[...]` и ведущий `!` литеральны везде. Раньше `` $`echo ${\"**/\"}*` `` матчился рекурсивно; теперь он падает с `no matches found`. Пишите паттерн прямо в шаблоне.

```js
await $`echo ${\"**/\"}*`;
await $`echo **/*`;
```

### fs.rmdir больше не принимает { recursive: true } v1.4.0

Передача `recursive: true` в `fs.rmdir` теперь бросает `ERR_INVALID_ARG_VALUE` — как в Node.js, который удалил опцию после длительной deprecation. Используйте `fs.rm`.

```js
await fs.rmdir("build", { recursive: true });
await fs.rm("build", { recursive: true, force: true });
```

### X509Certificate serial и modulus теперь uppercase hex v1.4.0

`X509Certificate#serialNumber`, `.toLegacyObject().modulus` и `tls.TLSSocket#getPeerCertificate()` теперь возвращают шестнадцатеричные значения в верхнем регистре — как Node.js и `openssl x509 -serial`. Если вы пинните сертификат по lower-case serial-строке, сначала нормализуйте регистр.

### tls.createServer({ requestCert: true }) теперь отклоняет непроверенные клиентские сертификаты v1.4.0

Сервер `node:tls` с `requestCert: true` и без явного `rejectUnauthorized` применяет дефолт `true`. Соединение с клиентским сертификатом, который не верифицируется, уничтожается, а сервер генерирует `tlsClientError`. Раньше оно доходило до вашего обработчика с `authorized: false`. Чтобы продолжать пускать таких клиентов, передайте `rejectUnauthorized: false`.

### dgram.Socket теперь бросает синхронно при повторном bind() и после close() v1.4.0

Два изменения в `node:dgram`, оба соответствуют Node.js:

- `bind()` на уже-забинденном сокете бросает `ERR_SOCKET_ALREADY_BOUND` (раньше — событие error).
- `bind()`, `send()`, `address()`, `remoteAddress()` и `close()` на закрытом сокете бросают `ERR_SOCKET_DGRAM_NOT_RUNNING` (раньше — некодированный TypeError или, для `bind()`, событие error).

Коду, обрабатывавшему второй `bind()` в error-listener, нужен try/catch.

### dns.lookup() теперь использует system resolver на Linux v1.4.0

На Linux `dns.lookup()`, `dns.promises.lookup()` и резолв hostname в `net.connect()` теперь проходят через `getaddrinfo()` — как в Node.js. Раньше использовался c-ares. Имена, известные только systemd-resolved или split-DNS VPN, теперь резолвятся (раньше — `getaddrinfo EREFUSED`). `dns.setServers()` больше не влияет на эти вызовы. `dns.resolve*()` и `Bun.dns.lookup()` по-прежнему используют c-ares. Если нужно старое поведение — передайте `{ backend: "c-ares" }` в `Bun.dns.lookup()`.

### Исключения в колбэках node:fs, node:dns и crypto.pbkdf2 теперь uncaughtException v1.4.0

Исключение, брошенное внутри колбэка `node:fs`, `node:dns` или `crypto.pbkdf2()`, теперь достигает `process.on("uncaughtException")` — как в Node.js. Раньше оно всплывало как `unhandledRejection`. Зарегистрированный там обработчик его больше не видит — перенесите обработчик.

```js
fs.readFile("config.json", () => {
  throw new Error("bad config");
});
process.on("unhandledRejection", onError);
process.on("uncaughtException", onError);
```

### net.Server и tls.Server больше не авто-возобновляют принятые сокеты; tls.Server проверяет requestCert/rejectUnauthorized буквально v1.4.0

- Сокеты, принятые `net.Server`/`tls.Server`, больше не возобновляются автоматически. Байты, пришедшие до подключения 'data'-listener'а, буферизуются — как в Node.
- Проверку отключает только литеральный `rejectUnauthorized: false`. Это относится к `tls.connect()` и `tls.Server`. Раньше так же работал `null`.
- `requestCert` должен быть буквально `true`.
- `tls.Server` больше не читает `NODE_TLS_REJECT_UNAUTHORIZED` для своего дефолта.
- `handshakeTimeout` теперь также генерирует событие `'timeout'` сокета (после `'tlsClientError'`), оставляя сокет открытым, а не уничтожая его.
- Исключение в колбэке `onread` или в listener'е `'secureConnection'` — теперь uncaught exception.

### fetch()-ответы и Bun.serve-запросы теперь объединяют дубликаты заголовков через "," v1.4.0

Дубликаты заголовков в `fetch()`-ответе или `Bun.serve`-запросе теперь объединяются через `, ` по Fetch-спецификации. Раньше сохранялось только последнее значение. Частые заголовки уже объединялись; изменение затрагивает остальные, включая кастомные. `fetch()`-ответы также сохраняют пустые значения: заголовок без значения читается как `""`, а не `null`. `Set-Cookie` по-прежнему возвращается отдельными значениями через `getSetCookie()`.

```js
// X-Dup: first
// X-Dup: second
res.headers.get("x-dup");
// "second"
// "first, second"
```

### Request#clone() и Response#clone() теперь бросают после чтения тела v1.4.0

`clone()` на `Request`/`Response`, чьё тело уже прочитано или чей поток заблокирован, теперь бросает `TypeError: Body is disturbed or locked (ERR_BODY_ALREADY_USED)` — по Fetch-спецификации. Это включает запрос, переданный обработчикам маршрутов `Bun.serve`. Раньше `clone()` срабатывал, а проблема проявлялась позже — как пустое тело или ошибка при чтении клона. Вызывайте `clone()` до чтения тела.

### fetch()-сетевые ошибки теперь TypeError, а неудачное чтение тела ставит bodyUsed v1.4.0

`fetch()` и чтение тела ответа теперь отклоняют сетевую ошибку как `TypeError` (раньше — обычный `Error`). `.code` (например, `ECONNRESET`) по-прежнему выставлен. После неудачного чтения тела `bodyUsed` становится `true`; второе чтение отклоняется с `ERR_BODY_ALREADY_USED` вместо ошибки сокета. Чтобы повторить — делайте новый `fetch()`. `fetch(request)` с уже использованным стриминговым телом отклоняется тем же `TypeError` до соединения.

### Bun.serve({ inspector }) удалён v1.3.14

Недокументированная опция `inspector: true` теперь молча игнорируется. Она монтировала WebSocket дебаггера `/bun:inspect` на вашем HTTP-порту. Она предшествовала `bun --inspect` и никогда не была в публичных типах. Используйте флаг `--inspect`, чтобы подключить дебаггер.

```js
Bun.serve({ inspector: true, fetch });
Bun.serve({ fetch });
```

```bash
bun --inspect server.ts
```

### server.publish() и ws.publish() теперь возвращают 0 или -1 при backpressure v1.4.0

`server.publish()`, `ws.publish()`, `ws.publishText()` и `ws.publishBinary()` теперь возвращают:

- `0`, если сообщение дропнуто для любого подписчика или у темы не было подписчиков;
- `-1`, если у какого-то подписчика backpressure;
- число байт в противном случае.

Раньше они возвращали число байт всякий раз, когда у темы был подписчик, даже если данные отбрасывались. Код, сравнивающий возврат с числом байт, должен трактовать `0` как дроп, а `-1` — как помещение в очередь.

### server.stop() теперь закрывает idle-соединения и ждёт in-flight-запросы v1.4.0

`server.stop()` теперь сразу закрывает idle keep-alive соединения. Бизнес-соединения он закрывает после отправки ответа. Разрешается, когда закрылось последнее соединение. Раньше закрывался только listener, и resolve происходил, пока запросы ещё обслуживались. Теперь он остаётся висячим на соединении, которое отправило часть запроса и остановилось. `server.stop(true)` закрывает и такие соединения. Работает и после gracefully-`stop()`.

### WebSocket (global) больше не принимает опцию agent v1.3.6

Нестандартная опция `agent` в Web-стандартном конструкторе `WebSocket` удалена. Глобальный `WebSocket` Node.js использует undici dispatcher, а не `http.Agent`. WebSocket из пакета `ws`, который Bun полифиллит нативно, теперь принимает `agent` наоборот — соответствует его задокументированному API.

```js
const ws = new WebSocket(url, { agent }); // global
import WebSocket from "ws";
const ws = new WebSocket(url, { agent }); // ws module
```

### WebSocket#close(), ping() и pong() теперь валидируют аргументы v1.4.0

`close()` теперь бросает `InvalidAccessError` для кода вне 1000–1003, 1007–1014 или 3000–4999. `SyntaxError` — для reason длиннее 123 UTF-8 байт. Раньше невалидный код уходил без проверки; с дефолтным кодом слишком длинный reason молча отправлялся пустым. `ping()`/`pong()` на клиенте WebSocket, `ServerWebSocket` и в пакете `ws` теперь бросают `RangeError` для payload больше 125 байт (раньше отправляли). Укоротите reason или payload.

### WebSocket теперь валит handshake, если запрошенный subprotocol не согласован v1.4.0

`new WebSocket(url, protocols)` теперь закрывается с кодом 1002, когда сервер в 101-ответе опускает `Sec-WebSocket-Protocol` — по RFC 6455, как в браузерах. Раньше открывался с `ws.protocol === ""`. Поправьте сервер, чтобы он эхоил протокол, либо не передавайте protocols. Соединения без запрошенного subprotocol не затронуты.

### WebSocket#close() больше не вызывает close до своего возврата v1.4.0

`ws.close()` и `ws.terminate()` на WebSocket-клиенте теперь ставят событие close в очередь — как в Node.js и браузерах. Когда вызов возвращается, `readyState` равен `CLOSING`, а `onclose` ещё не сработал. Код, читавший `CLOSED` на следующей строке или полагавшийся на выполнение `onclose`, должен await'ить событие close.

### jest.resetAllMocks() теперь дропает mock-реализации v1.4.0

`jest.resetAllMocks()` и `vi.resetAllMocks()` теперь сбрасывают и реализацию каждого мока, и его историю вызовов — как в Jest. Раньше они вели себя как `clearAllMocks()`. После сброса `jest.fn(() => 42)` возвращает `undefined`; spy из `spyOn()` возвращает `undefined`, пока не вызван `mockRestore()`. Если нужно только очистить историю — вызывайте `clearAllMocks()`.

```js
afterEach(() => {
  jest.resetAllMocks();
  jest.clearAllMocks();
});
```

### expect().toContain() теперь сравнивает через === вместо Object.is v1.4.0

`toContain()` в `bun:test` теперь сравнивает элементы массивов/итерируемых через `===` вместо `Object.is` — как в Jest. `expect([-0]).toContain(0)` проходит, а `expect([NaN]).toContain(NaN)` падает. `toBe()` по-прежнему использует `Object.is`. `toContainEqual()` — глубокое равенство.

### Bun.sql декодирует MySQL DATETIME и TIMESTAMP как UTC v1.4.0

Колонки MySQL `DATETIME` и `TIMESTAMP` теперь декодируются как UTC. Это соответствует тому, как их кодирует Bun.sql, поэтому `Date` round-trip'ит без изменений. Раньше на хосте не в UTC значение смещалось на UTC-offset машины. Postgres-`timestamp`, прочитанный через `.simple()`, тоже декодируется как UTC. `timestamptz` не затронут. Уберите компенсацию offset'а, которую вы добавили.

### Bun.sql теперь парсит JSON-колонки MariaDB 10.5+ вместо строк v1.4.0

На MariaDB 10.5 и выше `Bun.sql` теперь парсит JSON-колонки и результаты JSON-функций вроде `JSON_OBJECT()` и `JSON_EXTRACT()`. Раньше он возвращал JSON-текст строкой. Колонка `json` с `{"b": 1}` теперь читается как объект `{ b: 1 }`. Уберите `JSON.parse()`.

```js
const [row] = await sql`SELECT a FROM t`;
const a = JSON.parse(row.a);
const a = row.a; // { b: 1 }
```

### Прочие изменения поведения v1.4.0

- Удалена команда `bun feedback`.
- `Bun.password.hash()` с argon2 теперь требует `memoryCost` не меньше 8. Хэши, сделанные Bun 1.3 с меньшим `memoryCost`, по-прежнему верифицируются.
- `bun update` теперь переносит транзитивные пакеты. `bun update <name>` падает (exit 1), если ничто не зависит от этого имени (раньше — добавлял пакет). `--production`/`--prod` на update означает «обновить только dependencies и optionalDependencies». `-i` обновляет только выделенное.
- `bunfig.toml` проекта теперь переопределяет `.npmrc` для того же ключа.
- `bun install <pkg> --filter x` теперь правит x, а не корень. `bun add y --filter x` больше не устанавливает пакет с именем x. `add/remove --filter '*'` больше не включает корень.
- Обычный `bun add x` в воркспейсе, где дефолтный каталог уже содержит x, теперь пишет `catalog:`; `audit fix` может перезаписывать точные пины; `--frozen-lockfile --lockfile-only` ничего не пишет; изменения overrides/catalog валят frozen-установки.
- Проекты с catalog: peers или мёртвыми строками `pkg@range` override столкнутся с однократной переписью lockfile после апгрейда. Lockfile с nested/version-scoped overrides — версии 3; более старый Bun его не прочитает.
- `bun init` теперь пишет typescript `^7`. Раньше — `^5` или ничего в React-шаблонах. Свежий проект ставит TypeScript 7.
- `bun init` с не-TTY stdin (CI, пайп) теперь ведёт себя как `bun init -y` (раньше открывал пикер шаблонов).
- `bun update -i` с не-TTY stdin теперь выходит с кодом 1 и ошибкой (раньше открывал пикер). Используйте `bun update` или `bun outdated`.
- `bun update` без имён теперь переписывает записи корневого каталога и каталогов (до новейшей версии с `--latest`), оставляя ссылки `catalog:` в workspace-файлах. Раньше заменял их на `^<version>`.
- `bun install` и `bun remove` теперь убирают пакет из `bun.lock`, когда на него указывает только optional peer.
- Записи `trustedDependencies`/`--trust` теперь матчатся по точному имени пакета, а не по усечённому хэшу.
- `bun install --registry <url>` больше не отправляет креды настроенного registry на другой host или при даунгрейде с `https://` на `http://`.
- Диапазоны `workspace:` теперь учитываются только в корневом и воркспейс-`package.json`; внутри скачанного пакета они фейлятся как неизвестный диапазон.
- `Bun.JSONC.parse()` теперь бросает `SyntaxError` на невалидном входе и на `""` (раньше — `BuildMessage` и `{}`).
- Wildcard-экспорты/импорты в `package.json`, не указывающие на существующий файл, теперь ретраются с каждым известным расширением (или `.ts` вместо `.js`).
- `bun build` теперь бандлит неразрешимый `require()`/`require.resolve()`/`await import()` внутри catch как runtime-бросок.
- Присваивание импортированному биндингу больше не является parse-ошибкой на рантайме: модуль грузится, а присваивание бросает `TypeError` при достижении.
- `bun build --target browser` теперь уважает поле `browser` пакета для Node-встроенных, а не бандлит полифилл.
- `import * as ns`-неймспейс в бандле теперь перечисляет экспорты в отсортированном порядке.
- `bun build --minify` больше не генерирует голый идентификатор `$` (он шадоуил jQuery `$` при загрузке бандла как классического скрипта).
- ESM-импорты встроенных модулей (node:fs, node:process, node:module) и `export * from "bun"` больше не вычисляют каждый ленивый экспорт при импорте — каждый вычисляется при первом биндинге.
- `bun build --metafile` теперь кладёт путь бандленного импорта в ключ inputs импортированного файла.
- `Bun.randomUUIDv7()` теперь бросает `RangeError` для timestamp от 2**48 и больше; также для NaN timestamp, невалидной Date или Date до 1970.
- `Bun.udpSocket({ connect: { port } })` теперь бросает для порта вне 1–65535.
- `Bun.YAML.parse()` теперь бросает `SyntaxError` на NUL-байте.
- Вывод `Bun.color()` изменился для `"ansi-16"`, `"hsl"`, `"lab"` и близких к чёрному `"ansi-256"` цветов; 24-битное число вроде `0xff0000` теперь непрозрачно.
- `Bun.Cookie` теперь сериализует `Expires` как `Date#toUTCString()`.
- `structuredClone()`, `self.postMessage()` в воркере и `new Worker(path, { transferList })` теперь бросают `TypeError` для не-объектного transfer-элемента (например, `null`).
- `bun:ffi viewSource()` и `new JSCallback()` теперь бросают на невалидных аргументах.
- `Bun.FileSystemRouter.match()` теперь возвращает `null` для непустого пути, не начинающегося с `/`.
- `Bun.Terminal#write()` теперь возвращает полную длину ввода (весь ввод буферизуется).
- `new Bun.RedisClient(url)` теперь бросает на неиндексном пути, например `redis://host/notadb`.
- `Bun.spawn()`/`Bun.spawnSync()` бросают `ERR_INVALID_ARG_VALUE` на NUL-байт в `argv0`/`cwd`.
- `Bun.$` падает с `ambiguous redirect`, когда redirect-цель вроде `> *.txt` раскрывается в несколько слов.
- `Bun.spawn()`/`Bun.spawnSync()` бросают `ERR_OUT_OF_RANGE` для `timeout: NaN` и `ERR_UNKNOWN_SIGNAL` для `killSignal: 0`.
- `Bun.spawn()`/`Bun.spawnSync()` бросают `AbortError` (с `cause = signal.reason`) для уже-отменённого сигнала — процесс не создаётся вовсе.
- `bun:sqlite db.close()` теперь финализирует каждый `db.query()`-стейтмент; `db.prepare()`-стейтменты работают до финализации.
- `S3Client.list()` теперь отдаёт `checksumAlgorithm` (опечатка `checksumAlgorithme` не перечисляема).
- `new URL(bad)` теперь бросает Node'овский `TypeError: Invalid URL` с `code` и `input`.
- `assert.deepStrictEqual()`/`util.isDeepStrictEqual()` теперь сравнивают прототипы.
- `child_process.spawn()` игнорирует `options.encoding`, как Node; стdout/stderr всегда отдают Buffer-чанки.
- N-API статус-коды на путях валидации теперь совпадают с Node 26.
- `fs.open()` бросает `ERR_INVALID_ARG_VALUE`, когда объект передан как `flags`.
- `fs.rm()/fs.rmSync()` отклоняют `recursive/force/retryDelay/maxRetries`, явно установленные в `undefined`.
- Изменения в `process.execve()`, `process.title`, `require()` для builtin-ов, `process.reallyExit()`, `util.styleText()`, формате warnings, `crypto.subtle` getter, `Response.redirect()`, парсинге `fetch()` (`Connection`/`Transfer-Encoding`/`Content-Encoding`/`Upgrade`), redirect-кодах, idle timeout, пре-валидации и многом другом.
- `Bun.serve` верифицирует порт (`RangeError` для нецелых/отрицательных/вне диапазона), off-range статусы уходят в `error()`, HEAD обслуживается GET-обработчиком per-method маршрутов, unmasked-кадры WebSocket закрывают с 1006, HTTP/3 применяет per-serverName TLS-правила.
- `Bun.sql`: `connectionTimeout` ограничивает весь handshake, уважает `PGSSLMODE`, декодирует infinity-даты Postgres, жим/структурные проверки MySQL.
- `fs.watch`, `node:http2`, `node:test`, `process.memoryUsage`, `Bun.embeddedFiles` и множество мелких исправлений — полный список в changelog.

## Changelog

Ниже — «длинный хвост»: меньшие возможности, исправления совместимости и баги, сгруппированные по областям. Полный список — в changelog.

### Runtime

- **ServerWebSocket.subscriptions** (v1.3.2): новый getter возвращает массив всех тем, на которые подписаны сокеты.
- **bun repl** (v1.3.10 v1.4.0): теперь нативный. Встроен в бинарник Bun (раньше — отдельный npm-пакет по первому запуску). Полный TUI: подсветка синтаксиса, строковое редактирование (Ctrl-A/E/K), постоянная история `~/.bun_repl_history`, таб-дополнение, многострочный ввод, команды `.help/.load/.save/.editor`, top-level await и `_`/`_error`. Голые объектные литералы `{ a: 1 }` не требуют скобок. Появились `-e <script>` (вычислить) и `-p <script>` (вычислить и напечатать).
- **bun ./README.md** (v1.3.12): заготовка маркдауна прямо в терминал — заголовки, таблицы, чек-листы, цитаты, подсвеченные код-блоки, кликабельные ссылки; корректное выравнивание для эмодзи и CJK-символов. JS VM не запускается.
- **Bun.JSON5** (v1.3.7 v1.4.0): нативный парсер JSON5. `Bun.JSON5.parse()/stringify()`; прямой импорт `.json5` в рантайме и бандлере. Проходит официальный JSON5 test suite.
- **Bun.JSONL** (v1.3.7): встроенный парсер JSON с переносами строк. `parse()` целиком, `parseChunk()` для стримингового ввода (`{ values, read, done, error }`).
- **Bun.JSONC.parse()** (v1.3.6 v1.4.0): JSON с комментариями и висящими запятыми — тот же парсер, что читает tsconfig.json.
- **Bun.XML** (v1.4.0): нативный XML-парсер. `parse()/stringify()`; импорт `.xml` в рантайме и бандлере. ~в 5× быстрее fast-xml-parser и xml2js.
- **Bun.TOML** (v1.4.0): переписан для полного TOML v1.1.0 — 708/708 в toml-test. Есть `stringify()`.
- **Bun.Archive** (v1.3.6): создание и извлечение tarball без node-tar.
- **CompressionStream/DecompressionStream** (v1.3.3 v1.4.0): Web-стандартные потоки gzip/deflate/deflate-raw + brotli/zstd.
- **URLPattern** (v1.3.4): Web API декларативного сопоставления URL.
- **ML-DSA и ML-KEM в crypto.subtle** (v1.4.0): постквантовые NIST-алгоритмы.
- **ML-DSA и ML-KEM в node:crypto** (v1.4.0): поддерживаются в `generateKeyPair`/`sign`/`verify`/`createPublicKey`.
- **Response.textStream() / Request.textStream()** (v1.4.0): `ReadableStream<string>` тела в UTF-8; мультибайтовые символы склеиваются, BOM убирается, невалидные последовательности → U+FFFD.
- **process.on("memoryPressure")** (v1.4.0): событие при нехватке памяти на macOS/Linux/Windows; не держит event loop живым.
- **Bun.sliceAnsi()/Bun.wrapAnsi()/Bun.stringWidth()**: ANSI/grapheme-aware обрезка, перенос и измерение по колонкам терминала; быстрее slice-ansi/wrap-ansi и т.д.
- **Bun.spawn({ cgroup })** (v1.4.0): на Linux — поместить дочерний процесс в cgroup до старта (memory.max/pids.max действуют с первой инструкции).
- **Async stack traces из нативного I/O** (v1.3.12): ошибки из `fs.promises`, `Bun.file()`, `Bun.S3Client`, DNS, crypto, `fetch()` содержат async-stack с `await` в вашем коде.
- **--cpu-prof / --heap-prof** (v1.3.x): встроенные CPU (Chrome `.cpuprofile`) и V8-совместимый `.heapsnapshot` профайлеры + Markdown-режимы.
- **--no-env-file** (v1.3.3): отключить автозагрузку `.env` (или `env = false` в bunfig).
- **--no-orphans** (v1.3.14 v1.4.0): Bun завершает работу при смерти родителя и SIGKILL'ит всех потомков.
- **Bun.Transpiler REPL mode** (v1.3.7): `replMode` для интерактивного REPL-кода.
- **Bun.YAML 402/402 yaml-test-suite** (v1.4.0): явные `?` ключи, табы, `{}`-маппинги, якоря на пустых значениях, циклические якоря/алиасы.
- **WebSocket-прокси и unix-сокеты** (v1.3.6 v1.4.0), **URL-креды в WebSocket** (v1.3.7), **SHA-3 и X25519 в Web Crypto** (v1.3.13), **structuredClone сохраняет identity объектов** (v1.4.0), **Bun.CSRF sessionId** (v1.4.0), **Bun.udpSocket ECONNREFUSED/truncation** (v1.3.12), **Grapheme-кластеры для индийских скриптов** (v1.3.7).
- **Bun.S3Client** (v1.3.1 v1.4.0): поддержка Requester Pays bucket (`requestPayer: true`), `contentDisposition`/`contentEncoding` в write/writer/presign, фиксы range-header, queueSize и утечки в `list()`.
- **Bun.sql надёжнее** (v1.3.11 v1.4.0): с `prepare: false` каждая команда — в одном round-trip (безопасно за PgBouncer transaction pooling); экспоненциальный backoff для Docker-стартовых окон.
- **Named parameters в Bun.sql для SQLite** (v1.4.0): объект именованных параметров для `:name`, `$name`, `@name`.
- **SQLite 3.53.0** (v1.3.14): обновлённый встроенный SQLite; `db.close(true)` больше не бросает после `db.transaction()`.
- **Bun.isStandaloneExecutable** (v1.4.0): read-only boolean, true внутри `bun build --compile`-бинарника.
- **bun init --react=tanstack** (v1.3.4): новый шаблон TanStack Start с Vite и Tailwind.

### fetch()

- **fetch() response backpressure** (v1.4.0): стриминговое чтение тел ставит HTTP-поток на паузу вместо буферизации всего тела; `.text()/.json()/.arrayBuffer()` — опт-аут.
- **HTTPS-прокси переиспользуют CONNECT-туннели** (v1.3.12 v1.4.0); **custom TLS options переиспользуют keep-alive** (v1.3.10); **сохранение регистра имён заголовков** (v1.3.7); **HTTP_PROXY перечитывается на рантайме** (v1.3.12).

### Test runner

- **onTestFinished()** (v1.3.2): Vitest-совместимый хук «после текущего теста».
- **bun test --only-failures** (v1.3.1), **--path-ignore-patterns** (v1.3.11), **--pass-with-no-tests** (v1.3.1), **--grep** (алиас для `-t`, v1.3.6), **`using spy = spyOn(...)`** (v1.3.9), **vi global** (v1.3.1 v1.4.0), **таймауты на beforeAll/afterAll** (v1.3.2 v1.4.0).

### Bundler

- **Execute-only standalone бинарники на Linux** (v1.3.12): graph модулей встраивается в сегмент, загружаемый OS вместе с бинарником; запуск с `chmod 111` и нулевым файловым I/O.
- **useDefineForClassFields и "jsx": "react-jsx"** (v1.4.0): как tsc.
- **Native using/await using для --target=bun** (v1.3.14 v1.4.0): больше не лоуэрятся в helper-функции.
- **emitDecoratorMetadata подразумевает legacy-декораторы** (v1.3.11): чинит NestJS/TypeORM/Angular.
- **--compile-executable-path** (v1.3.6); **reactFastRefresh и allowUnresolved в Bun.build()** (v1.3.6); **browser-field remaps для Node builtins** (v1.4.0, jszip 459→149 KB); **code splitting 20 000 модулей в 14× быстрее** (v1.4.0).

### Node.js compatibility

- **node:http переписан** (v1.3.4 v1.4.0): прямой порт `_http_client.js` — `http.ClientRequest` на net/tls-сокетах, парсере Node и Agent socket pool; keep-alive reuse +65.9%, throughput +190%.
- **node:http2** (v1.4.0): spec-совместимый HTTP/2-парсер, server push через `pushStream()`/`createPushResponse()`, 93.2% test suite Node.
- **node:net и node:tls** (v1.4.0): `socket.end()` полузакрывает соединение; `localAddress`/`localPort`; события `'session'`/`'keylog'`, структурированные OpenSSL-ошибки, `SNICallback`/`ALPNCallback`, PFX.
- **node:worker_threads** (v1.4.0): `postMessageToThread()`/`'workerMessage'`, `SHARE_ENV`, captured stdio, introspection; suite на 73.9% (было ~37%).
- **node:fs** (v1.4.0): полные ERR_FS_CP_* семантики, `fs.watch` `ignore`, AbortSignal в `fs.promises.watch`; 97.5% тестов Node.
- **node:stream** (v1.4.0): stream/iter и zlib/iter за `--experimental-stream-iter`; 96.9%.
- **process** (v1.4.0): смена `process.env.TZ` обновляет существующие Date; `--no-warnings` и другое; 84.2% (было 60.5%).
- **AsyncLocalStorage** (v1.4.0): Node 26 `defaultValue`/`name` опции и `withScope()`; покрытие async_hooks удвоено до 50%.
- **node:vm** (v1.4.0): top-level await в SourceTextModule, v26 module-linking API, `microtaskMode: 'afterEvaluate'`; 72%→97%.
- **node:cluster** (v1.4.0): разделение сокетов, round-robin планировщик, UDP-кластеризация.
- **vitest --coverage** (v1.4.0): node:inspector реализует методы покрытия V8 Profiler; работает дефолтный v8 provider.
- **chrome://inspect** (v1.4.0): `inspector.open()/url()/close()/waitForDebugger()`.
- **node:test** (v1.4.0): subtests (t.test/t.describe), `t.plan()`, `t.waitFor()`, `t.mock`, runtime `t.skip()/t.todo()`, programmatic `run()`, `expectFailure`.
- **node:quic** (v1.4.0): полноценный, на lsquic; все 235 тестов Node v26.3.0.
- **node:sqlite** (v1.3.2 v1.4.0): 18/18 файлов тестов Node, включая `DatabaseSync`/`StatementSync`, backup, sessions.
- **node:repl** (v1.4.0): рабочий порт Node v26.3.0 REPL; 75.2%; флаг `--interactive`.
- **node:trace_events** (v1.4.0): 100%; **node:domain** (v1.4.0): реальная реализация; **node:buffer** (v1.4.0): 92.9%; **TextDecoder поддерживает все WHATWG-кодировки** (v1.4.0) — 16 отсутствовавших single-byte кодировок.
- **uid/gid для child processes** (v1.4.0); **NODE_COMPILE_CACHE** (v1.4.0); **Datadog continuous profiling** (v1.4.0); **await worker.terminate()** (v1.4.0); **Node-API version 10** (v1.4.0); **N-API finalizers LIFO** (v1.3.13); **tls.setDefaultCACertificates()/secureContext.addCACert()** (v1.4.0); **node:http2 diagnostics_channel/AltSvc/CONNECT/allowHTTP1** (v1.4.0); **fs.mkdtempDisposable()/FileHandle pull/writer** (v1.4.0); **node:zlib brotli/zstd словари** (v1.4.0). Наконец, ws-совместимые `'upgrade'`/`'unexpected-response'` события, `dns.promises.getDefaultResultOrder()/getServers()`, `SIGWINCH` на Windows, `--use-system-ca` на Windows.

### Package manager

- **Lockfile migration** (v1.4.0): package-lock.json v1–4, pnpm-lock.yaml v9.
- **bun.lock versioning** (v1.3.2): `configVersion` рядом с `lockfileVersion`, чтобы будущие релизы могли менять дефолты без влияния на существующие проекты.
- **publicHoistPattern/hoistPattern** (v1.3.1); **install.hoist = false** (v1.4.0, как pnpm); **bun update --recursive/--filter** (v1.4.0); **bun update <name> обновляет каждую копию** (v1.4.0); **Happy Eyeballs для registry** (v1.4.0, RFC 8305); **streaming tarball extraction** (v1.3.13); **peer resolution до 8× быстрее** (v1.3.13); **bun list = bun pm ls** (v1.3.2); **bun publish шлёт README** (v1.3.14); **per-path .npmrc токены** (v1.3.11 v1.4.0); **bun update обновляет каталоги** (v1.4.0); **patchedDependencies по полному SHA-1** (v1.4.0); **bun pm ls --trusted** (v1.4.0).

### Performance / JavaScriptCore

- **Temporal включён по умолчанию** (v1.4.0) — замена Date.
- **WebAssembly** (v1.4.0): JSPI (`WebAssembly.Suspending`/`promising`), Wasm SIMD в интерпретаторе, Memory64, multi-memory, relaxed SIMD, `compileStreaming` compileOptions.
- **ES module loader переписан на C++** — top-level-await порядок и import()-ошибки точно по спецификации.
- **Promises и async-функции в C++** с elimination-аллокациями.
- Таблицы ускорений String (indexOf 44.98×, endsWith 10.5×, includes 9.76×, isWellFormed 5.36×, replace 3.0×, и др.), Array (indexOf 5.39×, arr.length=N 4.30×, flat 2–3.2×, from 2.5–2.85×), Map/Set (spread ~6×, size 2.24×/2.74×, клонирование 2.09×/1.99×), Object/JSON/Intl (Intl.DurationFormat 26.5×, Object.defineProperty 8.6×, Object.hasOwn 4.31×, JSON.stringify Int32 3.08×) — полный перечень в changelog.

### Другие фиксы

Сводка по «другим фиксам» из changelog: исправления в `Bun.RedisClient` (закрытие сокета при неудачном соединении, `idleTimeout` от connect, stop-таски), `process.memoryUsage`, `console.write()` в beforeExit, `ShadowRealm` в node:vm, `Bun.file(path).arrayBuffer()` для файлов >4 GiB, файлы ≥2 GiB, аллокация ICU/libuv/BoringSSL через mimalloc, точность NaN/-0.0/отрицательных BigInt, `require("ws")` не грузит node:http заранее. Плюс большой список исправлений совместимости в `fetch()` (reader.cancel() закрывает соединение, ENOTFOUND с `syscall: "getaddrinfo"`, Content-Encoding case-insensitive, Base64-кодирование Proxy-Authorization, redirect-коды, AbortSignal, keep-alive), в test runner, bundler, Node.js, package manager, `Bun.serve()`, `Bun.$` (shell), `Bun.sql`, `Bun.spawn()`, Web Streams, WebSocket client и Windows (включая bun:ffi на Windows ARM64, dlopen с non-ASCII путями). Полные списки — в оригинальной статье и changelog.

### Bug fixes

Мы исправили более 2 900 проблем с Bun 1.3. Многие найдены непрерывным фаззингом runtime API через Fuzzilli, coverage-guided фаззингом системных вызовов и парсеров, AddressSanitizer и LeakSanitizer в CI, а также непрерывной Claude Code-сессией, сверявшей выводы Bun canary против Bun v1.3.14 и Node.js. Среди них: standalone-бинарники на Linux работают на WSL1, паттерны обработки очень длинных путей, thread-safe таймер за `Atomics.waitAsync`, `Request.formData()` не обрезает бинарные загрузки по нулевому байту, пустой `process.env` при недоступной на чтение cwd, старт на старых ядрах без `getrandom()`, корректная работа с less/fzf/fx (raw-mode больше не ломается), и многое другое.

## Спасибо!

Bun свободен, с открытым исходным кодом и распространяется под лицензией MIT. Мы получаем много вкладов от сообщества и благодарим всех, кто исправил баг или добавил возможность в этом релизе. Полный список контрибьюторов — в [оригинальной статье](https://bun.com/blog/bun-v1.4) и в [GitHub Release](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.0).

Предыдущий: [Bun v1.3.14](https://bun.com/blog/bun-v1.3.14)

Обновление:

```bash
bun upgrade
```

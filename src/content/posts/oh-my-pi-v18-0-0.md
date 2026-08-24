---
author: Артём Нецветаев
pubDatetime: 2026-08-24T02:15:00.000Z
title: "oh-my-pi 18.0.0: глиф-токенизация для Claude, macOS-автокоррекция и управляемый scrollback при resize"
slug: oh-my-pi-v18-0-0
featured: true
draft: false
tags:
  - release
  - oh-my-pi
  - coding-agent
  - tui
  - claude
  - macos
description: "Разбор oh-my-pi v18.0.0: reversible-токенизация private-use глифов для Claude-совместимых провайдеров (pi-agent-core/pi-ai/pi-catalog), breaking-перевод native macOS spelling-функций на Promises, настройка tui.resizeScrollback (append/rebuild/preserve), TtyWriter и ширина-эпоха для resize, omp render, live benchmark dashboard в omp bench и /shake thinking."
---

[oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`) — форк терминального coding-агента [Pi](https://github.com/badlogic/pi-mono) Марио Цехнера. 22 августа 2026 вышел мажорный релиз [`v18.0.0`](https://github.com/can1357/oh-my-pi/releases/tag/v18.0.0), который целиком фокусируется на терминальной стороне агента: модель впервые перестаёт спотыкаться о private-use иконки в tool calls (обратимая глиф-токенизация для Claude-совместимых провайдеров), macOS-редактор получает нативные проверку орфографии и автокоррекцию, а главное — под контроль берётся то, как TUI переживает изменение ширины терминала в мультиплексорах (tmux/screen/Zellij).

Источники: [GitHub Release v18.0.0](https://github.com/can1357/oh-my-pi/releases/tag/v18.0.0), compare [`v17.4.4...v18.0.0`](https://github.com/can1357/oh-my-pi/compare/v17.4.4...v18.0.0) (63 коммита), PR [#9304](https://github.com/can1357/oh-my-pi/pull/9304), [#7920](https://github.com/can1357/oh-my-pi/pull/7920), [#7921](https://github.com/can1357/oh-my-pi/pull/7921), [#9294](https://github.com/can1357/oh-my-pi/pull/9294), [#9298](https://github.com/can1357/oh-my-pi/pull/9298), [#9325](https://github.com/can1357/oh-my-pi/pull/9325).

## Visible-private-use глифы: обратимая глиф-токенизация для Claude

Сквозная тема релиза — совместимость с Claude-совместимыми провайдерами, когда в tool calls присутствуют приватные иконки (символы из private-use области Unicode). Такие глифы видны провайдеру, но модель не может их корректно воспроизвести, что ломало вызовы инструментов.

- **`@oh-my-pi/pi-agent-core` (Fixed)**: tool calls Anthropic Claude, содержащие provider-visible private-use icon glyphs, больше не падают — глифы **обратимо токенизируются на wire boundary** (на границе отправки в провайдер), а вновь придуманные моделью или неразрешённые глиф-токены **отклоняются до исполнения**.
- **`@oh-my-pi/pi-ai` (Added)**: добавлена обратимая глиф-токенизация для запросов Claude-совместимых провайдеров — c **prompt notices**, корректным **декодированием стримленных ответов** и безопасной обработкой неразрешённых model-authored глиф-токенов.
- **`@oh-my-pi/pi-catalog` (Added)**: у моделей появились **capability-метаданные** reversible глиф-токенизации для Claude-совместимых моделей, чтобы слой совместимости применялся по явной capability, а **не по поиску по деталям транспорта**.

Тот же пакет `pi-ai` чинит и залипание завершённых Anthropic-ходов (Fixed): если провайдер отправил `message_stop`, но держал SSE-соединение открытым, turn оставался busy и застревал в выполнении инструментов и queued steering до таймаута.

## Breaking: нативные macOS spelling-функции вернули Promises

В `@oh-my-pi/pi-tui` три контракта стали асинхронными — это **breaking change** для кода, который звал их синхронно.

1. Нативные macOS функции проверки орфографии и дополнения слов теперь возвращают **Promises** (асинхронно, без блокировки JS-потока — сами native-API описаны в `pi-natives`).
2. `EditorTextAssistProvider.tryAutocorrect` теперь получает **editor state**, а не сырой текст.
3. `Editor.decorateText` теперь получает **строка/колонка контекста** вместо сырого текста.

```ts
// было (синхронно, native macOS API в pi-natives)
const word = macOSCheckSpelling(previousText, caret);
const completions = macOSCompleteWord(token);

// стало — Promises из pi-tui
const word = await macOSCheckSpelling(previousText, caret);
const completions = await macOSCompleteWord(token);
```

## macOS prompt editor: опечатки, word completion и автокоррекция

В `pi-coding-agent` автономию macOS-редактора перевели в фоновый режим: **проверка орфографии больше не блокирует рендер и отзывчивость ввода** (macOS spelling checks работают в фоне).

- Поддерживаются **конфигурируемое обнаружение опечаток** с подсказками по `Ctrl+.`, **word completion по Tab** (вставленная правка автоматически добирает завершающий пробел, если следом не идёт пробел или пунктуация) и **опт-in автокоррекция**.
- За это отвечает новый `EditorTextAssistProvider` из `pi-tui` — с поддержкой spelling-предложений (`ctrl+.`), вариантов замены слова и **асинхронной** автокоррекции.

## TUI: resize scrollback, TtyWriter и ширина-эпоха

Главный технический сюжет — правильная перерисовка при состыкованном изменении ширины терминала, прежде всего внутри мультиплексоров, где хост наивно переносит историю по старой ширине и разрывает строки.

Новая настройка агентом **`tui.resizeScrollback`** (по умолчанию `append`) управляет поведением при settled-изменении ширины:

- **`append`** — переигрывает транскрипт на новой ширине ниже старой истории (одна свежая копия на каждый стабилизированный resize);
- **`rebuild`** — сначала очищает историю панели (через ED3; нужен хост вроде tmux), чтобы в ней осталась ровно одна копия текущей ширины; стирает и pre-session scrollback;
- **`preserve`** — оставляет старую историю нетронутой с нулевым ростом.

В самом `pi-tui` это реализовано через `setResizeScrollback()` / `ResizeScrollbackMode` (env-инициализатор `PI_TUI_RESIZE_SCROLLBACK`); raw-ядро по умолчанию использует `preserve`, а кодинг-агент в интерактивных сессиях — `append`. Это чинит [#8193](https://github.com/can1357/oh-my-pi/issues/8193) и [#7026](https://github.com/can1357/oh-my-pi/issues/7026).

Технически устранена «ширина-эпоха»: ошибка, из-за которой conservative full-transcript replay (и одна дублированная копия в истории панели) срабатывал на каждый settled resize. Финализированные блоки без `getTranscriptBlockVersion` теперь трактуются как immutable по контракту, Container-блоки без вложенного epoch-источника фолбечат на стабильность всего сегмента, а `Markdown` сообщает revision, не зависящий от ширины, поэтому может стоять выше epoch-источника. Интерактивный resize-листенер больше не помечает каждый `SIGWINCH` как «render pending».

Отдельно добавлен **`TtyWriter`** — off-thread писатель вывода: записи в stdout не блокируют поток, а backlog-метрики используются для отбрасывания устаревших фреймов на медленных терминалах (`Terminal.pendingOutputBytes` и backpressure render gate) — TUI перестаёт замирать при больших repaint в медленных/закрытых терминиадах.

У сопутствующих фиксов `visibleWidth` больше не считает payload APC-последовательностей (Kitty graphics, cursor markers) за печатный текст, и Kitty Unicode-placeholder строки с длинными стилизованными префиксами (например bordered thumbnail cards) снова распознаются как строки изображений и идут по verbatim render path.

## omp render, benchmark dashboard и /shake thinking

- **`omp render`** — новая команда для **реплея session thread** и бенчмарка производительности транскрипт-пайплайна.
- **`omp bench`** получил **live benchmark dashboard**: оценки производительности в реальном времени, статистика **p50/p95**, раздельные метрики throughput по входу/выходу, **cost tracking**, **mixed challenge suites по умолчанию** и опция **`--prefill-bytes`** для синтетических prefill-бенчмарков.
- **`/shake thinking`** — команда, которая вырезает блоки reasoning модели из истории сессии.
- **Session history rewinds** (через `Esc-Esc` или `/tree`) теперь **усекают хвосты транскрипта на месте**, а не очищают и переигрывают весь терминальный scrollback.
- Startup composer стал рендериться сразу на кэшированных session/theme-данных — можно печатать до завершения инициализации сессии без потери нажатий (`deferInput` startup option + `enableInput()` в `Terminal`/`TUI`/`TUIStartOptions`).

## Edit tool и редактор

- Edit tool поддерживает **`＋`-префиксные вставки строк**, **unified diff форматы**, **bare selection replacements** и надёжное восстановление при распространённых синтаксических вариациях и неоднозначных span'ах. Исправлено склеивание целых строк (вставка selection, висящая сама по себе, теперь ложится на новую строку, когда анкор был последней совпавшей линией, перед пустой строкой или на EOF), и обработка payload'а с склеенной линией `«»` (после `MATCH` — как mistyped `»`, иначе — как лишний terminator).
- Fallback edit mode **переключён на `sloppy`** для моделей без поддержки hashline.
- **Word completion по Tab** ставит завершающий пробел, если дальше не пробел/пунктуация; **выпадающий список** по умолчанию показывает **10 строк** (было 5) и настраивается через **`autocompleteMaxVisible`**; slash-command описания в autocomplete обрезаются до двух строк. В автодополнении появились **иконки и ранжирование по частоте использования** (`commandUsage` callback у `CombinedAutocompleteProvider`).
- Новые API редактора: `Editor.viewportRowsProvider` (вписывает dropdown в доступную высоту терминала), `Editor.setTheme()` (динамическая смена темы без пересоздания редактора и потери черновика), `maxDescriptionRows` у `SelectList`, `MarkdownTheme.createHighlightStream` для инкрементальной подсветки законченных строк в стримленных Markdown-блоках (`HighlightStream` в `pi-natives`).

## Прочие исправления

- **Streaming code blocks** перестали ждать завершения, чтобы показать syntax highlighting — live-подсветка работает сразу.
- Прерывание Claude во время reasoning больше не реплеит частичные thinking-блоки в следующие ходы (что вызывало API rejection).
- Устранено дублирование edit-matching при resume сессий — рост производительности на исторических транскриптах.
- **Kimi Code / Moonshot** больше не падают с 400 на requests с изображениями — inline base64 отправляется напрямую.
- Чтение **WAL-mode SQLite** без активных `-wal`/`-shm` файлов.
- Layout транскрипта на Windows при collapsed edit-результатах с длинными wrapped diff строками; C#-файлы больше не показывают D3.js-иконки ([#9323](https://github.com/can1357/oh-my-pi/issues/9323)); корректные token delta в сводках компакции ([#9293](https://github.com/can1357/oh-my-pi/issues/9293)).
- Вставленные скриншоты не рендерятся пустыми боксами в Kitty graphics (номер первой строки не искажается из-за ширины Kitty placement-префикса).
- Контекст-gauge в статусной строке для unnamed-сессий; исправлен счётчик бенчмарк input tokens на провайдерах с автоматическим prompt caching.
- **`pi-mnemopi`**: ужесточены проверки капитализации для извлечения локаций в episodic gists (меньше ложных срабатываний, [#7920](https://github.com/can1357/oh-my-pi/pull/7920)) и участники эпизодов извлекаются с поддержкой Unicode (не-латинские имена, [#7921](https://github.com/can1357/oh-my-pi/pull/7921)).
- Пассивные подсчёты токенов в `pi-tui` корректно обрабатывают неизвестные compaction source token'ы ([#9294](https://github.com/can1357/oh-my-pi/pull/9294)), а collapsed edit-строки ограничены по высоте ([#9304](https://github.com/can1357/oh-my-pi/pull/9304)).

## Кому стоит обновиться

Пользователям Claude-совместимых провайдеров с приватной иконографикой в tool calls, тем, кто годами терпел рваную историю в tmux/screen/Zellij после изменения ширины окна, всем на macOS, кто хочет нативные проверку орфографии и автокоррекцию без лагов, и бенчмаркерам транскрипт-пайплайна через `omp render`/`omp bench`. Плагин-авторам на TypeScript стоит проверить breaking-изменения `pi-tui` (Promises вместо синхронных macOS spelling-функций, новые сигнатуры `tryAutocorrect`/`decorateText`).

## Как обновиться

```sh
curl -fsSL https://omp.sh/install | sh
```

или `npm i -g @oh-my-pi/pi-coding-agent`. Полный changelog — в [GitHub Release v18.0.0](https://github.com/can1357/oh-my-pi/releases/tag/v18.0.0).

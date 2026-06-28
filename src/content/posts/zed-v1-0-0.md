---
author: Артём Нецветаев
pubDatetime: 2026-06-28T21:45:37.000Z
title: "Zed 1.0.0: bookmarks, git: view commit, DeepSeek V4 и GIF в Markdown preview"
slug: zed-v1-0-0
featured: true
draft: false
tags:
  - release
  - zed
  - editor
  - ai
description: "Разбор major-релиза Zed v1.0.0: bookmarks в gutter с навигацией и persistence, новая команда git: view commit, DeepSeek V4 Pro/Flash, interleaved_reasoning для OpenAI-compatible моделей, Responses API для OpenAI, multi-word fuzzy search и изменения soft_wrap."
---

Zed выпустил major-релиз [`v1.0.0`](https://github.com/zed-industries/zed/releases/tag/v1.0.0). В upstream-релизе есть символическая часть про статус 1.0, но для пользователей редактора важнее практические изменения: bookmarks в редакторе, команда `git: view commit`, обновлённые AI-модели и несколько заметных исправлений Markdown preview, fuzzy search и настроек soft wrap.

Источник для обзора — GitHub Release [`zed-industries/zed@v1.0.0`](https://github.com/zed-industries/zed/releases/tag/v1.0.0) и связанные PR: [`#51404`](https://github.com/zed-industries/zed/pull/51404), [`#39009`](https://github.com/zed-industries/zed/pull/39009), [`#54731`](https://github.com/zed-industries/zed/pull/54731), [`#54016`](https://github.com/zed-industries/zed/pull/54016), [`#54910`](https://github.com/zed-industries/zed/pull/54910), [`#54112`](https://github.com/zed-industries/zed/pull/54112), [`#54123`](https://github.com/zed-industries/zed/pull/54123), [`#53459`](https://github.com/zed-industries/zed/pull/53459), [`#53758`](https://github.com/zed-industries/zed/pull/53758), [`#54374`](https://github.com/zed-industries/zed/pull/54374) и [`#54051`](https://github.com/zed-industries/zed/pull/54051).

## Bookmarks: строки можно помечать, искать и переносить между сессиями

Главная пользовательская фича релиза — bookmarks из [`#51404`](https://github.com/zed-industries/zed/pull/51404). Это не просто визуальная метка в текущем буфере: PR добавляет отдельный `crates/editor/src/bookmarks.rs`, новые editor actions и настройку gutter.

Подтверждённые команды из release body и diff'а:

- `editor: toggle bookmark` — ставит или снимает bookmark на текущей строке; при нескольких курсорах PR дедуплицирует строки, чтобы не переключать одну и ту же строку дважды;
- `editor: go to next bookmark` и `editor: go to previous bookmark` — переходят по bookmark'ам в текущем файле с wrap-around на концах буфера;
- `editor: view bookmarks` — открывает список bookmark'ов проекта в multibuffer, по аналогии с references/diagnostics;
- `workspace: clear bookmarks` — очищает bookmark'и в текущем проекте.

В `assets/settings/default.json` появилась новая настройка gutter:

```json
{
  "gutter": {
    "bookmarks": true
  }
}
```

То есть bookmarks по умолчанию видны в gutter. Если в проекте вы используете очень компактный gutter и хотите убрать новый слой, его можно выключить именно через `gutter.bookmarks`, не затрагивая line numbers, breakpoints или folds. В PR также добавлена persistence: bookmark'и восстанавливаются между сессиями, а не живут только до закрытия Zed.

Отдельная деталь из diff'а: в `CommitView` bookmarks принудительно скрываются через `editor.set_show_bookmarks(false, cx)`, как и breakpoints. Поэтому новый gutter-слой не должен засорять диффы commit view.

## `git: view commit`: открыть commit view по ref, SHA, ветке или тегу

PR [`#39009`](https://github.com/zed-industries/zed/pull/39009) добавляет command palette action `git: view commit`. Команда принимает git ref и открывает commit view: upstream прямо перечисляет примеры `HEAD`, SHA, branch и tag.

Практический сценарий теперь выглядит так:

```text
Command Palette → git: view commit → HEAD
Command Palette → git: view commit → main
Command Palette → git: view commit → v1.0.0
Command Palette → git: view commit → 72a9dcd
```

Если ref некорректный, PR показывает пользователю ошибку вместо молчаливого провала. По diff'у команда регистрируется в `crates/git_ui/src/git_ui.rs`, а для отображения используется существующий `CommitView`, так что это именно быстрый вход в уже имеющийся UI просмотра коммита, а не новый отдельный экран.

## AI: DeepSeek V4, `interleaved_reasoning` и Responses API для OpenAI

В AI-части релиза есть несколько изменений, которые важны для тех, кто настраивает Zed Agent под свои провайдеры.

[`#54731`](https://github.com/zed-industries/zed/pull/54731) заменяет преднастроенные DeepSeek-модели на новые id:

- `deepseek-v4-flash` — display name `DeepSeek V4 Flash`, используется как быстрый default (`default_fast()`);
- `deepseek-v4-pro` — display name `DeepSeek V4 Pro`, становится default-моделью enum `Model`.

В документации `docs/src/ai/llm-providers.md` пример custom DeepSeek config теперь показывает обе модели с `max_tokens: 1000000` и `max_output_tokens: 384000`:

```json
{
  "language_models": {
    "deepseek": {
      "api_url": "https://api.deepseek.com",
      "available_models": [
        {
          "name": "deepseek-v4-flash",
          "display_name": "DeepSeek V4 Flash",
          "max_tokens": 1000000,
          "max_output_tokens": 384000
        },
        {
          "name": "deepseek-v4-pro",
          "display_name": "DeepSeek V4 Pro",
          "max_tokens": 1000000,
          "max_output_tokens": 384000
        }
      ]
    }
  }
}
```

[`#54016`](https://github.com/zed-industries/zed/pull/54016) добавляет capability `interleaved_reasoning` для OpenAI-compatible моделей. По умолчанию она `false`. Если включить её для совместимого провайдера, Zed перестаёт отправлять thinking tokens как обычный inline text и кладёт их в отдельное поле `reasoning_content` у assistant message. Это добавлено для OpenAI-compatible backends, которым нужен такой формат, например для сценариев с llama.cpp и Qwen reasoning-моделями.

Минимальный вид capability:

```json
{
  "language_models": {
    "openai_compatible": {
      "available_models": [
        {
          "name": "qwen-reasoning-local",
          "display_name": "Qwen reasoning local",
          "max_tokens": 131072,
          "capabilities": {
            "chat_completions": true,
            "interleaved_reasoning": true
          }
        }
      ]
    }
  }
}
```

[`#54910`](https://github.com/zed-industries/zed/pull/54910) меняет дефолт для OpenAI-провайдера: встроенные OpenAI-модели теперь идут через Responses API. В diff это видно по замене `supports_chat_completions()` на `uses_responses_api()` и переключению streaming-пути с `stream_completion`/`OpenAiEventMapper` на `stream_response`/`OpenAiResponseEventMapper`. Для custom-моделей сохранился escape hatch: поле `supports_chat_completions` инвертируется в `uses_responses_api`, так что модели, которым нужен старый Chat Completions endpoint, можно оставить на нём.

## Fuzzy search: path matching быстрее, pickers понимают multi-word query

В fuzzy-поиске релиз закрывает две разные проблемы.

[`#54112`](https://github.com/zed-industries/zed/pull/54112) ускоряет path matching в `fuzzy_nucleo`: в `PathMatchCandidate` появился `CharBag` prefilter, который заранее отбрасывает кандидаты без нужных символов, а восстановление byte positions переведено на работу с уже отсортированными char indices. В PR добавлен criterion benchmark `crates/fuzzy_nucleo/benches/match_benchmark.rs`; в описании PR автор приводит таблицу, где для 10 000 path-кандидатов one-word query улучшилась примерно с `1.78 ms` до `1.26 ms`, а для 100 000 — с `20.06 ms` до `14.80 ms`.

[`#54123`](https://github.com/zed-industries/zed/pull/54123) добавляет строковый matcher в `fuzzy_nucleo` (`crates/fuzzy_nucleo/src/strings.rs`) и переводит на него несколько UI-пикеров:

- command palette (`crates/command_palette/src/command_palette.rs`);
- branch picker (`crates/git_ui/src/branch_picker.rs`);
- tab switcher;
- recent projects picker, включая WSL picker.

Практический эффект — multi-word queries. Например, command palette теперь может матчить запросы вида:

```text
format selections
view bookmarks
checkout branch
recent project
```

В реализации query разбивается по whitespace на fuzzy atoms, а Smart case используется как scoring hint: несовпадение регистра штрафует результат, но не выкидывает его полностью. Это важно для команд вроде `Editor: Backspace`, где пользователь может набрать lower-case вариант.

## Markdown preview: GIF-анимация, Copy Link и нормальные heading sizes

Markdown preview получил сразу три заметных исправления.

[`#53459`](https://github.com/zed-industries/zed/pull/53459) одновременно исправляет crash и включает GIF animation support. По PR причина crash'а была в partially decoded GIF, включая GIF с empty comment extension `21 fe 00`; фикс пришёл через bump зависимости `gif` до `0.14.2`. В markdown-рендеринге изображение теперь получает стабильный id вида `("markdown-image", range.start)`, что нужно для корректного image/cache lifecycle при анимации.

[`#53758`](https://github.com/zed-industries/zed/pull/53758) добавляет `Copy Link` в right-click menu для Markdown views — это касается и Markdown preview, и agent panel. В `crates/markdown/src/markdown.rs` появился `context_menu_link`, а `MarkdownPreviewView` строит контекстное меню через `right_click_menu` и пишет ссылку в clipboard через `ClipboardItem`.

[`#54374`](https://github.com/zed-industries/zed/pull/54374) чинит размеры заголовков в Markdown preview. До фикса `MarkdownStyle::themed()` переопределял `heading_level_styles` маленькими размерами примерно `1.15rem`, `1.1rem`, `1.05rem`, из-за чего `# H1`, `## H2` и `### H3` почти не отличались от обычного текста. PR удаляет этот override и возвращает стандартную иерархию через `apply_heading_style`: `text_3xl`, `text_2xl`, `text_xl` и т.д. Также heading block получает верхний отступ `mt_4()`.

## Breaking notice: `soft_wrap: "preferred_line_length"` заменён на `"bounded"`

Единственный breaking notice в release body — настройка soft wrap. PR [`#54051`](https://github.com/zed-industries/zed/pull/54051) удаляет вариант `SoftWrap::Column` и документирует замену:

```diff
 {
   "languages": {
     "Git Commit": {
       "preferred_line_length": 80,
-      "soft_wrap": "preferred_line_length"
+      "soft_wrap": "bounded"
     }
   }
 }
```

Смысл изменения: старый режим `preferred_line_length` выбирал preferred line length как границу wrap даже в узком editor viewport. Из-за этого, например, commit editor в Git panel мог не переносить строки в narrow layout. Новый `bounded` использует меньшую из двух границ: `preferred_line_length` или фактическую ширину редактора.

Важно: в `crates/settings_content/src/language.rs` для `Bounded` добавлен serde alias `"preferred_line_length"`. Это смягчает миграцию при чтении старых настроек, но документация и default settings больше не предлагают старое значение. Новые конфиги лучше обновить на `"bounded"` явно.

## Менее громкие, но полезные исправления

Несколько изменений из релиза стоит держать в голове при ежедневном использовании:

- [`#53178`](https://github.com/zed-industries/zed/pull/53178): `editor: format selections` теперь показывается только если активный formatter действительно умеет range formatting. LSP должен advertising range-formatting capability; Prettier остаётся поддержан через собственный range formatting; external command и code action formatters не включают эту команду сами по себе.
- [`#53353`](https://github.com/zed-industries/zed/pull/53353): debugger build task теперь уважает `"save": "all"` из task definition перед запуском build. PR вынес общий helper `Workspace::save_for_task(...)` и использует его в debugger path.
- [`#50746`](https://github.com/zed-industries/zed/pull/50746): file watching стал корректно реагировать на изменения в symlinked directories, даже если symlink указывает за пределы watched/project directory.
- [`#50754`](https://github.com/zed-industries/zed/pull/50754): Outline panel для JavaScript/TypeScript теперь видит shorthand methods внутри nested object literals, а не только методы в объекте верхнего уровня.
- [`#52162`](https://github.com/zed-industries/zed/pull/52162): terminal больше не применяет contrast adjustment к явно заданным 24-bit RGB escape sequences (`ESC[38;2;R;G;Bm`), поэтому true-color цвета не превращаются в вымытые pink/lavender оттенки.
- [`#50653`](https://github.com/zed-industries/zed/pull/50653): Windows path handling в extension manifests исправлен для remote environments вроде WSL.

## Итог

Zed 1.0.0 — не только маркетинговая отметка стабильности. В релизе появились команды, которые меняют ежедневный workflow (`editor: toggle bookmark`, `editor: view bookmarks`, `git: view commit`), улучшилась настройка AI-провайдеров, а Markdown preview и fuzzy-пикеры стали заметно практичнее.

Перед обновлением стоит проверить только один конфиг-нюанс: если где-то явно стоит `"soft_wrap": "preferred_line_length"`, замените его на `"bounded"`. Всё остальное в этом релизе выглядит как additive upgrade или bugfix без обязательной миграции.

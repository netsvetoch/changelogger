---
author: Артём Нецветаев
pubDatetime: 2026-07-01T17:35:58.000Z
title: "Zed 1.9.0: Telescope-style pickers, text finder, поиск в Agent Panel и новые настройки Git Panel"
slug: zed-v1-9-0
featured: false
draft: false
tags:
  - release
  - zed
  - editor
  - ai
description: "Разбор minor-релиза Zed v1.9.0: resizable pickers с preview, новый text finder, поиск внутри Agent Panel, кликабельные grep-результаты агента, настройки Git Panel, markdown_preview.max_width и zed --completions."
---

Zed выпустил minor-релиз [`v1.9.0`](https://github.com/zed-industries/zed/releases/tag/v1.9.0). Это не pointer-only release: основной источник — GitHub Release и связанные PR. Самое заметное изменение — большой PR [`#59604`](https://github.com/zed-industries/zed/pull/59604), который добавляет Telescope-style preview в pickers, делает picker-модалки resizable и вводит новый `text finder` как альтернативный UI для project search.

Источник для обзора — GitHub Release [`zed-industries/zed@v1.9.0`](https://github.com/zed-industries/zed/releases/tag/v1.9.0) и PR [`#59604`](https://github.com/zed-industries/zed/pull/59604), [`#57231`](https://github.com/zed-industries/zed/pull/57231), [`#59230`](https://github.com/zed-industries/zed/pull/59230), [`#59359`](https://github.com/zed-industries/zed/pull/59359), [`#59213`](https://github.com/zed-industries/zed/pull/59213), [`#59043`](https://github.com/zed-industries/zed/pull/59043), [`#59649`](https://github.com/zed-industries/zed/pull/59649), [`#59512`](https://github.com/zed-industries/zed/pull/59512), [`#57440`](https://github.com/zed-industries/zed/pull/57440), [`#57756`](https://github.com/zed-industries/zed/pull/57756) и [`#56038`](https://github.com/zed-industries/zed/pull/56038).

## Pickers стали ближе к Telescope: preview справа/снизу и resize

PR [`#59604`](https://github.com/zed-industries/zed/pull/59604) закрывает давний запрос [`#8279`](https://github.com/zed-industries/zed/issues/8279) про Telescope-like search box. В описании PR автор явно разделяет use cases поиска: navigation, exploration и collecting. Старый project search хорошо подходил для «collecting» через multibuffer, но хуже для быстрой навигации и исследования результата рядом с контекстом. Поэтому в `Picker` добавлен optional `Preview`, а общий picker-rendering переписан так, чтобы показывать результаты вместе с preview и позволять менять размер модалки.

Для пользователя это означает две вещи:

- file finder теперь может показывать preview выбранного файла справа или снизу, в зависимости от доступного места;
- preview — часть общей инфраструктуры picker'ов, а не одноразовый хак только для поиска файлов. В diff у `Picker` появились действия `picker::TogglePreview`, `picker::SetPreviewRight`, `picker::SetPreviewBelow`, `picker::SetPreviewHidden` и новый rendering path для `Preview::Right` / `Preview::Below`.

Новые bindings вынесены в `assets/keymaps/specific-overrides*.json`, потому что они должны иметь более высокий приоритет, чем базовые editor bindings:

```json
{
  "context": "Picker > Editor",
  "bindings": {
    "ctrl-shift-a": "picker::ToggleActionsMenu",
    "ctrl-alt-p": "picker::TogglePreview",
    "ctrl-alt-right": "picker::SetPreviewRight",
    "ctrl-alt-down": "picker::SetPreviewBelow",
    "ctrl-alt-up": "picker::SetPreviewHidden"
  }
}
```

На macOS те же действия доступны через `cmd-shift-a`, `cmd-alt-p`, `cmd-alt-right`, `cmd-alt-down` и `cmd-alt-up`. В file finder старые отдельные меню фильтра/сплита заменены общим actions menu picker'а, а `ctrl-shift-i` / `cmd-shift-i` теперь используется для `search::ToggleIncludeIgnored`.

## Новый `text finder`: быстрый modal-поиск по проекту с живым preview

В том же [`#59604`](https://github.com/zed-industries/zed/pull/59604) появился `crates/search/src/text_finder.rs` и отдельный delegate. Комментарий в `text_finder/delegate.rs` описывает сценарий прямо: text finder — «minimal modal interface to the project_search», ориентированный на exploration. Он умеет переходить в обычный project search tab через `text_finder::ToProjectSearch`, а project search, наоборот, может открыть modal text finder.

Практический workflow теперь такой:

```text
Command Palette → text finder: toggle
Project Search → Open Text Finder
Text Finder → ToProjectSearch
```

В default keymaps для project/buffer search добавлен shortcut открытия text finder:

```json
{
  "context": "ProjectSearchBar",
  "bindings": {
    "ctrl-alt-p": "project_search::OpenTextFinder"
  }
}
```

На macOS это `cmd-alt-p`. В самом `TextFinder` тот же chord используется для возврата в project search (`text_finder::ToProjectSearch`), а `ctrl/cmd-j/k/h/l` оставлены для открытия результата в split down/up/left/right.

Два последующих PR улучшают seed query:

- [`#59766`](https://github.com/zed-industries/zed/pull/59766) берёт selection или слово под курсором из активного editor через `query_suggestion`, учитывая настройку `seed_search_query_from_cursor`, и выделяет весь query в picker'е, чтобы следующий ввод сразу заменил его;
- [`#59779`](https://github.com/zed-industries/zed/pull/59779) расширяет приоритет источников: сначала query активного `ProjectSearchView`, затем focused buffer search bar через общий helper `buffer_search_query`, затем слово под курсором.

То есть если вы уже искали `useEffect` в project search или через buffer search, переключение в text finder не начинает с пустой строки — текущий query переносится в новый modal UI.

## Agent Panel: поиск по текущему thread и кликабельные grep-результаты

AI-часть релиза не ограничивается списком новых моделей. PR [`#57231`](https://github.com/zed-industries/zed/pull/57231) добавляет in-thread search в Agent Panel: `Ctrl+F` на Linux/Windows и `Cmd+F` на macOS вызывает `agent::ToggleSearch`. Навигация сделана отдельными actions `agent::SelectNextThreadMatch` и `agent::SelectPreviousThreadMatch`; в keymaps это `F3` / `Shift+F3` или `Cmd+G` / `Cmd+Shift+G` на macOS.

Важная граница поведения из PR: поиск scoped только на текущий загруженный thread. Он ищет видимый контент — user messages, assistant chunks и labels tool calls. Thought blocks и rendered tool-call content намеренно пропущены, чтобы счётчик совпадений соответствовал тому, что пользователь видит в панели. Подсветка делается двумя путями: markdown content получает `Markdown::set_search_highlights`, а прошлые user messages подсвечиваются через `Editor::highlight_background(HighlightKey::BufferSearchHighlights, …)`.

PR [`#59230`](https://github.com/zed-industries/zed/pull/59230) чинит другой ежедневный friction point Agent Panel: результаты `grep` tool больше не plain markdown. `GrepTool` теперь отправляет по каждому совпадению `ResourceLink` вида `file:///abs/path#L12-15`, добавляет `locations` в tool call и сохраняет прежний model-facing text output. В `agent_ui` renderer дополнительно разбирает `#L...` fragment, поэтому label выглядит как `path#L12-15`, а клик открывает файл на найденной строке.

Отдельно [`#59359`](https://github.com/zed-industries/zed/pull/59359) делает remote MCP server заметнее: в Agent Panel options menu добавлен пункт `Add Remote Server`, а `Add Custom Server` теперь явно вызывает local-вариант. Modal для нового context server получает тип `ContextServerType::Remote` или `ContextServerType::Local` и для remote сразу показывает HTTP input.

## OpenAI-compatible reasoning models: UI и wire-format стали конкретнее

PR [`#59213`](https://github.com/zed-industries/zed/pull/59213) исправляет настройку reasoning/thinking для OpenAI-compatible провайдеров. До изменения `OpenAiCompatibleLanguageModel` не репортил thinking support надёжно, поэтому `reasoning_effort` мог не доходить до запроса, а Responses API мог не включать `reasoning.encrypted_content`.

Что поменялось в настройке custom model:

- в UI добавлен checkbox `Supports thinking`;
- при включённом thinking можно выбрать `Default reasoning effort` из common OpenAI-style levels;
- для chat completions доступен флаг `Preserves thinking in chat history`, который включает `interleaved_reasoning` только если одновременно включены thinking и chat completions;
- появился capability `max_tokens_parameter` для endpoints, которым нужен output limit именно как `max_tokens`;
- streamed thinking fields теперь разбирают common поля `reasoning` и `reasoning_content`.

Пример формы настройки теперь ближе к такому содержимому settings:

```json
{
  "language_models": {
    "openai_compatible": {
      "available_models": [
        {
          "name": "my-reasoning-model",
          "display_name": "My Reasoning Model",
          "reasoning_effort": "medium",
          "capabilities": {
            "chat_completions": true,
            "interleaved_reasoning": true,
            "max_tokens_parameter": true
          }
        }
      ]
    }
  }
}
```

Это не универсальный готовый config для любого backend, а иллюстрация подтверждённых полей из diff'а: точные значения зависят от конкретного OpenAI-compatible endpoint.

## Git Panel: View Options, отдельные sort/group settings и primary click behavior

Git Panel получил сразу несколько пользовательских настроек. PR [`#59043`](https://github.com/zed-industries/zed/pull/59043) убирает старый перегруженный boolean `sort_by_path` и заменяет его двумя enum-настройками:

```json
{
  "git_panel": {
    "sort_by": "path",
    "group_by": "status"
  }
}
```

В `crates/settings_content/src/settings_content.rs` добавлены `GitPanelSortBy` со значениями `path` / `name` и `GitPanelGroupBy` со значениями `none` / `status`. В UI это вынесено в Git Panel View Options menu со sliders icon: можно переключать list/tree view, сортировку по path/name и группировку по status. Важная деталь из PR: Project Diff теперь использует тот же порядок файлов, что и Git Panel, включая tree ordering, status grouping и flat name/path sorting.

PR [`#59649`](https://github.com/zed-industries/zed/pull/59649) добавляет ещё одну настройку — `git_panel.entry_primary_click_action`. До релиза обычный click по файлу открывал project diff со всеми изменёнными файлами, а `Cmd/Ctrl+Click` открывал single-file diff. Теперь default click можно настроить:

```json
{
  "git_panel": {
    "entry_primary_click_action": "file_diff"
  }
}
```

Подтверждённые значения enum `GitPanelClickBehavior`: `project_diff`, `file_diff`, `view_file`. Альтернативное действие всё равно остаётся доступно через `Cmd+Click` или `Ctrl+Click`.

Ещё два изменения в Git-разделе из release body: [`#59460`](https://github.com/zed-industries/zed/pull/59460) добавляет toggle Git blame в context menu gutter'а, а [`#59132`](https://github.com/zed-industries/zed/pull/59132) улучшает поиск Git Graph так, чтобы находить commits по abbreviated или full hash.

## Markdown preview, CLI completions, Helix debugger keys и Terminal vi mode

PR [`#59512`](https://github.com/zed-industries/zed/pull/59512) добавляет настройки ширины Markdown preview. До этого Markdown мог рендериться edge-to-edge на широком preview pane; теперь content можно ограничить и центрировать:

```json
{
  "markdown_preview": {
    "limit_content_width": true,
    "max_width": 800
  }
}
```

В реализации появился `MarkdownPreviewSettings`, который превращает `max_width` в `Pixels`, если `limit_content_width` включён. `MarkdownPreviewView` оборачивает rendered content в `div().w_full().max_w(max_width).mx_auto()`.

CLI получил генерацию shell completions в [`#57440`](https://github.com/zed-industries/zed/pull/57440):

```bash
zed --completions bash
zed --completions fish
zed --completions zsh
zed --completions nushell
zed --completions powershell
zed --completions elvish
```

В `docs/src/reference/cli.md` добавлены готовые snippets, например для Fish:

```fish
zed --completions fish | source
```

Для Helix-mode пользователей [`#57756`](https://github.com/zed-industries/zed/pull/57756) добавляет debugger keybindings под `space shift-g` в `assets/keymaps/vim.json`:

```text
space shift-g l       debugger::Start
space shift-g r       debugger::Restart
space shift-g c       debugger::Continue
space shift-g h       debugger::Pause
space shift-g i/o/n   StepInto / StepOut / StepOver
space shift-g t       debugger::Stop
space shift-g b       editor::ToggleBreakpoint
space shift-g ctrl-l  editor::EditLogBreakpoint
```

А terminal vi mode в [`#56038`](https://github.com/zed-industries/zed/pull/56038) получил paragraph navigation: `shift-{` мапится в `ViMotion::ParagraphUp`, `shift-}` — в `ViMotion::ParagraphDown`, дальше они транслируются в alacritty `ParagraphUp` / `ParagraphDown`.

## Модельные обновления OpenCode

В [`#59236`](https://github.com/zed-industries/zed/pull/59236) обновлён список OpenCode моделей. В enum `Model` добавлены `glm-5.2` и `kimi-k2.7-code`, `DeepSeek V4 Pro` стал доступен и для OpenCode Zen, а устаревшие upstream-модели ограничены или удалены: `minimax-m3-free` удалён, `glm-5`, `kimi-k2.5` и `minimax-m2.5` оставлены Zen-only.

Default'ы тоже сдвинулись: `default_go()` теперь возвращает `KimiK2_6`, а `default_go_fast()` — `MiniMaxM2_7`. Поэтому пользователям OpenCode Go/Zen стоит проверить выбранные модели после обновления, особенно если они полагались на старые MiniMax/Kimi defaults.

## Итог

Zed 1.9.0 — релиз про навигацию и контекст: file finder и новый text finder теперь показывают preview рядом с результатами, Agent Panel получил локальный поиск по thread и кликабельные grep-ссылки, а Git Panel стал настраиваемее без ручных обходных сценариев. Из точечных, но полезных изменений стоит отдельно отметить `markdown_preview.max_width`, `zed --completions <SHELL>` и новые Helix/terminal keybindings.

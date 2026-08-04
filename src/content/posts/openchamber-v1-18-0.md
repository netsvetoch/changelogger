---
author: Артём Нецветаев
pubDatetime: 2026-08-04T00:21:30.000Z
title: "OpenChamber 1.18.0: Walkthrough по diff, custom-провайдеры и tablet-layout"
slug: openchamber-v1-18-0
featured: false
draft: false
tags:
  - release
  - openchamber
  - ai-agents
  - mobile
  - performance
description: "Разбор OpenChamber 1.18.0: AI Walkthrough для diff/PR, OpenAI-compatible custom providers из Settings, tablet/foldable layout, lazy vendor chunks вместо 18.5 MB bundle и немецкая локаль."
---

[OpenChamber](https://github.com/openchamber/openchamber) выпустил минорный релиз [`v1.18.0`](https://github.com/openchamber/openchamber/releases/tag/v1.18.0). Главные пользовательские контуры — guided Walkthrough по diff, настраиваемые OpenAI-compatible провайдеры из Settings, переработанный tablet/foldable layout и исправление chunking, из‑за которого web-приложение тянуло один vendor bundle ~18.5 MB при старте.

Основа статьи — GitHub Release [`v1.18.0`](https://github.com/openchamber/openchamber/releases/tag/v1.18.0), compare [`v1.17.0...v1.18.0`](https://github.com/openchamber/openchamber/compare/v1.17.0...v1.18.0) (~192 коммита) и исходные изменения: [Walkthrough #2572](https://github.com/openchamber/openchamber/pull/2572), [tablet layout #2569](https://github.com/openchamber/openchamber/pull/2569), [custom providers #2571](https://github.com/openchamber/openchamber/pull/2571), [bundle chunking #1846](https://github.com/openchamber/openchamber/issues/1846) / commit [`1bbb451b`](https://github.com/openchamber/openchamber/commit/1bbb451b).

## Walkthrough: diff читается в порядке смысла, а не по путям файлов

До релиза Changes и PR показывали hunks в порядке file path. [PR #2572](https://github.com/openchamber/openchamber/pull/2572) добавляет surface **Changes Walkthrough**: small model группирует связанные hunks в _stops_, объясняет, что меняется в поведении, и упорядочивает stops так, чтобы каждый опирался на предыдущий.

Это не Review: Walkthrough **не выносит вердикты** и не составляет defect list — для оценки кода остаётся отдельное Review. Генерация **только по запросу пользователя**; ничего не стартует по таймеру, при открытии панели или при изменении файла.

### Откуда запускать и какие scope есть

Точки входа — иконка **Walkthrough** в right rail context panel и кнопка **AI walkthrough** в панелях Changes / Pull Request. Панель лишь открывается; генерация начинается по **Generate walkthrough**.

| Scope           | Что покрывает                                                           |
| --------------- | ----------------------------------------------------------------------- |
| All uncommitted | staged + unstaged + новые файлы                                         |
| Staged          | только то, что уйдёт в ближайший commit                                 |
| Unstaged        | working tree и untracked                                                |
| This branch     | всё, что ветка добавляет к base (`base...head`), включая уже запушенное |
| Pull request    | diff как на GitHub                                                      |

**This branch** — не «незапушенные коммиты», а cumulative diff ветки относительно base. После commit, но до push, branch-scope и PR-scope сознательно расходятся: первый показывает вашу локальную работу, второй — то, что видят ревьюеры. Каждый scope кэшируется отдельно.

Клиентский контракт источника (`packages/ui/src/lib/walkthrough/types.ts`):

```ts
type WalkthroughWorkingTreeScope = "all" | "staged" | "working";

type WalkthroughSource =
  | { kind: "working-tree"; scope: WalkthroughWorkingTreeScope }
  | { kind: "branch"; baseRef: string; headRef: string }
  | { kind: "pr"; number: number };
```

Структура результата: chapters → stops (`title`, `hunkIds`, `importance: 'critical' | 'normal' | 'context'`, `prose`), плюс `isStale`, `staleStopIds`, `uncoveredHunkIds` и `readiness`.

### Модель, язык, кэш и stale

- По умолчанию используется small model. Override: **Settings → Sessions → Changes Walkthrough Model** (`walkthroughModelOverride`) или picker в header панели на один прогон.
- В picker попадают только модели со **structured output** — без него walkthrough нельзя собрать. Если контекст модели меньше diff, генерация **отклоняется с объяснением**, а не режет вход «втихую».
- Язык prose по умолчанию — язык интерфейса; в header можно выбрать любой другой поддерживаемый язык. Идентификаторы, пути и API-имена остаются как в коде.
- Кэш content-addressed под `~/.config/openchamber/walkthroughs/` (LRU до 200 записей / 50 MB). В ключ входят diff, language и model — переключение между уже сгенерированными языками бесплатно.
- Серверные маршруты: `/api/walkthrough`, `/api/walkthrough/generate`, `/api/walkthrough/cancel`. Генерация живёт на сервере: reload вкладки её не убивает; останавливает только **Cancel**.
- **Outdated steps** — код, на который ссылался stop, изменился; **Not covered** — hunks текущего diff без stop (включая lockfiles и generated files, которые намеренно не отдаются модели).

Ограничения поверхности: desktop и tablet widths; **нет** в VS Code extension (Git идёт через свой bridge, `GitAPI.getGitRangeDiff` там optional/unimplemented) и в phone mobile shell (`screenWidth >= 768` + отсутствие registry surfaces). Для PR нужен подключённый GitHub.

На живом PR #2122 (103 файла, 515 hunks) walkthrough успешно собрался на `opencode-go/deepseek-v4-flash`. Открытие панели для ~80 файлов / 138 hunks ускорили с ~800 ms до ~340 ms (батч untracked diffs и отказ от дублирующего readiness pipeline).

## Tablet и foldable: phone navigation model на большом экране

[PR #2569](https://github.com/openchamber/openchamber/pull/2569) убирает «полуготовый iPad draft» поверх phone layout. Вместо UA/`isIPad` — live size class (`readTabletLayout()` в `packages/ui/src/lib/device.ts` + тесты `tabletLayout.test.ts`):

- phone (например 390×844 и landscape 844×390) → `enabled: false`;
- iPad-класс (834×1194 / 1194×834) → tablet; side panels (`roomyForPanels`) только когда ширина реально позволяет (landscape);
- unfolded foldable около-квадрат (690×840) → tablet, но drawer вместо persistent side panels;
- folding shut (~370×900) → снова phone.

Поведение на tablet:

- **Sessions** — persistent resizable left sidebar; overflow menu удалён, его пункты ушли в footer sidebar и workspace drawer;
- **Workspace** (Changes / Files / Terminal / Notes / MCP) — resizable right sidebar при `roomyForPanels`, иначе full-cover drawer; mounted panes переживают rotation/fold;
- app pages (settings, instances, update, plan) — centered dialogs, а не fullscreen cover;
- hardware keyboard: draft сохраняет starter chips, composer не схлопывается в pill (iOS публикует `GCKeyboard` state в web layer).

Ключи ширины `openchamber.ipad.*` сохранены (переименование сбросило бы пользовательские ширины); max правого sidebar поднят до 900. Desktop / VS Code / Electron layouts не трогались; phone path gated size class’ом.

Параллельно Android pairing QR больше не зависит от Google Play Services: камера закрывается сразу после распознавания кода и показывается connection-in-progress. Swipe для left/right drawer можно начинать дальше от края, вне зоны system Back gesture.

## Custom OpenAI-compatible providers из Settings

Раньше Settings → Providers подключал только catalog-провайдеров. [PR #2571](https://github.com/openchamber/openchamber/pull/2571) (closes [#394](https://github.com/openchamber/openchamber/issues/394)) добавляет **Other / Custom** для gateways, campus LLM, Ollama, LiteLLM и любых OpenAI-compatible endpoint’ов.

Поток:

1. **Settings → Providers → Add provider → Other / Custom**.
2. Заполнить provider ID (`^[a-z0-9][a-z0-9-_]*$`), display name, base URL (`http://` / `https://`), API key (литерал или `{env:VAR_NAME}`), минимум одну model id/name; опционально request headers.
3. Save: сначала `auth.set` для literal key, затем запись provider block в OpenCode config; reload providers → модели в picker/chat.
4. У уже подключённого custom-провайдера — **Edit** (ID disabled; пустой key = keep existing при `hasStoredAuth`).

Сервер: `PUT /api/provider` → `upsertProviderConfig(providerId, config, workingDirectory, scope, options)` со scope **`user` | `project` | `custom`**. Edit сохраняет effective scope (`custom` > `project` > `user`), чтобы project/custom провайдер не копировался в global user override. Без credentials провайдер не считается fully connected: модели могут появиться, но chat calls упадут.

Конфиг npm-адаптера фиксирован как `@ai-sdk/openai-compatible` (`CUSTOM_PROVIDER_NPM` в `custom-provider-form.ts`). Non-goals: well-known remote auth login flow, non-OpenAI wire formats, live endpoint probing. Паритет web + VS Code bridge с отдельными persistence/scope tests.

## Performance: vendor chunk 18.5 MB больше не грузится целиком на старте

При bun isolated install пути выглядят как `node_modules/.bun/<pkg>@<ver>/node_modules/<pkg>/...`. Старый `manualChunks` брал **первый** сегмент после `node_modules/` — получался `.bun`, и почти все зависимости, включая lazy-only, схлопывались в один eager `vendor-.bun` (~18.5 MB).

Commit [`1bbb451b`](https://github.com/openchamber/openchamber/commit/1bbb451b) чинит это в `vite.config.ts` / `packages/web/vite.config.ts`:

```ts
// 1) __vitePreload helper — в отдельный vendor-vite-runtime,
//    иначе он «прилипает» к shiki (+ oniguruma ~629KB) и тащит его в bootstrap
if (
  id.includes("vite/preload-helper") ||
  id.includes("vite/modulepreload-polyfill")
) {
  return "vendor-vite-runtime";
}

// 2) реальный package — из ПОСЛЕДНЕГО node_modules/
const lastNodeModules = id.lastIndexOf("node_modules/");
const match = id.slice(lastNodeModules + "node_modules/".length);
```

Тяжёлые библиотеки (syntax highlighting / shiki, screenshot `html-to-image` / `@zumer/snapdom`, diagram, editor, image-conversion) уходят в dynamic `import()` и грузятся по факту использования. Дополнительно: раскрытие проектов с большим числом worktrees больше не thrash’ит directory/session cache при каждом expand.

## Локализация, skills, usage и точечные фиксы

- **Немецкий (de):** UI-словари + полный набор docs в `packages/docs/content/docs/de/` (включая `walkthrough.mdx`, `providers.mdx` и остальные guide-страницы) — [#2263](https://github.com/openchamber/openchamber/pull/2263) / @SGD-DEV.
- **Skills:** repository-local `.agents/skills` видны для активного проекта; rename сохраняет `SKILL.md` и supporting files, action доступен только там, где server отдаёт `renamable`.
- **Usage:** DeepSeek quota tracking; Kimi for Coding корректно считает usage и из `used`, и из `remaining`.
- **Sessions / worktrees:** старт OpenChamber из home (не git root) больше не сыпет `"not a git repository"` и не блокирует load; shared worktree не дублируется в sidebar у нескольких проектов; sessions в только что созданном worktree появляются без refresh; archive/unarchive scoped к текущему instance/workspace; CLI create-in-worktree больше не репортит ложный timeout, пока worktree создаётся в фоне.
- **Git/Diff:** открытие changed file скроллит header к верху; live refresh трогает только реально изменившиеся файлы и сохраняет review position; save из built-in editor обновляет diff.
- **Terminal:** PTY стартует до mount viewport; startup output буферизуется, если view ещё не готов. Linux AppImage: `ARGV0` strip’ится перед child shells — чинится broken zsh startup.
- **Chat:** bash tool output применяет terminal control codes и strip’ает ANSI; queued messages retry после temporary send failure / interrupted turn; private relay не дублирует reply при drop после accept и не включает already-in-flight queued message во второй send; assistant markdown больше не рендерит active HTML.
- **VS Code:** click по `apply_patch` result открывает **каждый** changed file по своему path, а не всегда первый.
- **Files (browser):** export помечен как download; desktop-only reveal action скрыт.

## Кому обновляться

`v1.18.0` особенно полезен, если вы:

- ревьюите крупные multi-file diff/PR и хотите narrated order stops вместо alphabetical file list (desktop/tablet, structured-output small model);
- сидите за campus/gateway/Ollama и хотите GUI для custom OpenAI-compatible provider с scope user/project/custom;
- работаете с OpenChamber на iPad / Android tablet / foldable;
- открываете web UI по сети и платите latency/bandwidth за 18.5 MB vendor chunk;
- ведёте немецкий UI/docs.

Установка и артефакты — как обычно с [GitHub Releases `v1.18.0`](https://github.com/openchamber/openchamber/releases/tag/v1.18.0); desktop AppImage/Windows/macOS публикуются release workflow. Перед массовым использованием Walkthrough имеет смысл выбрать small model со structured output и помнить, что VS Code и phone shell surface не показывают.

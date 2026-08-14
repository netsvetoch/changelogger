---
author: Артём Нецветаев
pubDatetime: 2026-08-14T22:55:54.000Z
title: "OpenHands 1.11.0: child conversations, LLM cost в Activity Log и automation filter"
slug: openhands-v1-11-0
featured: false
draft: false
tags:
  - release
  - openhands
  - ai-agents
  - automations
  - canvas
  - desktop
description: "Разбор OpenHands v1.11.0: typed client tool launch_child_conversation, per-run LLM cost в Activity Log/export, automation tag filter в conversation panel, tag chips + overflow, version-update modal/tile, desktop rename/icons и direct runtime metrics без cloud-proxy."
---

[OpenHands](https://github.com/OpenHands/OpenHands) выпустил минорный релиз [`v1.11.0`](https://github.com/OpenHands/OpenHands/releases/tag/v1.11.0) (7 августа 2026). Это Canvas/Agent Canvas релиз вокруг делегирования работы агентом, стоимости automation runs и читаемости conversation panel: агент получает typed client tool `launch_child_conversation` (local/Cloud child с `parent_conversation_id`), Activity Log показывает и экспортирует per-run LLM `cost`, sidebar умеет фильтровать automation-born conversations и рендерить tag chips с overflow, а desktop surface переименован в **OpenHands Agent Canvas** с нормальными multi-size icons.

Основа статьи — GitHub Release [`v1.11.0`](https://github.com/OpenHands/OpenHands/releases/tag/v1.11.0), compare [`v1.10.0...v1.11.0`](https://github.com/OpenHands/OpenHands/compare/v1.10.0...v1.11.0) и исходные PR: [#16380](https://github.com/OpenHands/OpenHands/pull/16380), [#16351](https://github.com/OpenHands/OpenHands/pull/16351), [#16388](https://github.com/OpenHands/OpenHands/pull/16388), [#16346](https://github.com/OpenHands/OpenHands/pull/16346), [#16343](https://github.com/OpenHands/OpenHands/pull/16343), [#16372](https://github.com/OpenHands/OpenHands/pull/16372), [#16358](https://github.com/OpenHands/OpenHands/pull/16358), [#16352](https://github.com/OpenHands/OpenHands/pull/16352), [#16353](https://github.com/OpenHands/OpenHands/pull/16353), [#16392](https://github.com/OpenHands/OpenHands/pull/16392).

## Typed agent action: `launch_child_conversation`

[PR #16380](https://github.com/OpenHands/OpenHands/pull/16380) (closes [#15461](https://github.com/OpenHands/OpenHands/issues/15461)) закрывает gap «агент внутри Canvas не может стартовать другой conversation без hand-rolled `curl`». Раньше skills `openhands-api` / `agent-canvas-environment` предлагали сырой `POST /api/conversations` (local) или `POST /api/v1/app-conversations` (Cloud) без типизации session-key / encrypted `agent_settings` / tool lists — и **без** `parent_conversation_id`, так что delegated runs оказывались orphaned. Дополнительно local branch `AgentServerConversationService.createConversation()` принимал `parentConversationId`, но молча дропал его (Cloud branch форвардил).

Теперь рядом с `canvas_ui_control` регистрируется второй client tool. Константы (`src/constants/child-conversation.ts`):

```ts
export const LAUNCH_CHILD_CONVERSATION_TOOL_NAME = "launch_child_conversation";
export const LAUNCH_CHILD_CONVERSATION_ACTION_KIND =
  `ClientAction_${LAUNCH_CHILD_CONVERSATION_TOOL_NAME}` as const;
export const CHILD_CONVERSATION_RESULT_PREFIX = "[child-conversation] ";
export const CHILD_CONVERSATION_TARGETS = ["local", "cloud"] as const;
export const CHILD_CONVERSATION_ISOLATIONS = ["worktree", "shared"] as const;
export const MIN_AGENT_SERVER_VERSION_FOR_PARENT_LINK = "1.37.1";
```

JSON Schema tool (`src/api/launch-child-conversation-client-tool.ts`, `additionalProperties: false`):

| Field                   | Required | Scope          | Meaning                                                                                                              |
| ----------------------- | -------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `target`                | yes      | both           | `"local"` \| `"cloud"`                                                                                               |
| `task`                  | yes      | both           | self-contained brief — child **не** видит parent history                                                             |
| `title`                 | no       | both           | optional short title                                                                                                 |
| `repository` / `branch` | no       | **cloud only** | `owner/repo` + branch; local всегда наследует workspace parent                                                       |
| `isolation`             | no       | **local only** | `"worktree"` (default) — отдельный git worktree/branch с default branch; `"shared"` — тот же directory, что у parent |

Поток:

1. Agent вызывает `launch_child_conversation`.
2. Agent-server сразу ACK'ает client tool (ещё до реальной работы browser).
3. Frontend (`handleLaunchChildConversationAction`) создаёт child:
   - **local** — typed `ConversationClient` в working dir parent + `parent_conversation_id`;
   - **cloud** — `createCloudAppConversation` / `pickCloudBackendForLaunch()` даже если active backend local, но Cloud backend зарегистрирован.
4. Outcome (id, URL, target, status или corrective guidance) постится в parent как hidden message с prefix `[child-conversation] ` — chat скрывает её (`shouldRenderEvent`), агент ретранслирует пользователю.
5. `tool_call_id` ledger делает replay ActionEvent после reload no-op (нет duplicate children).

Невалидные комбинации (`target=clould`, `isolation` на cloud, `repository` на local) **ничего не создают** и возвращают guidance для retry. Parent link на local start-conversation требует agent-server ≥ `1.37.1`; на более старых launch всё равно succeeds, но agent получает сигнал, что relationship не persisted.

## Activity Log: per-run LLM cost

[PR #16351](https://github.com/OpenHands/OpenHands/pull/16351) дотягивает UI до backend/SDK cost path (`automation#280` column + `software-agent-sdk#4311` completion callback). Conversation metrics modal уже показывал accumulated spend; automation Activity Log — только timestamp + status badge.

Тип (`src/types/automation.ts`):

```ts
export interface AutomationRun {
  // ...
  /**
   * Accumulated LLM cost of the run in USD.
   * null = unknown; absent = automation service older than cost field.
   */
  cost?: number | null;
}

export interface AutomationRunExportRow {
  // ...
  /** Always present on export rows: missing run.cost normalizes to null. */
  cost: number | null;
}
```

Рендер рядом со status badge (`formatRunCost`):

- finite number → `$X.XXXX` (4 decimal, как metrics modal);
- measured zero → `$0.0000` (не скрывается);
- `null` / `undefined` → ничего (unknown ≠ free).

Export JSON/CSV (из 1.10.0) получает колонку `cost` **в конец** CSV — positional consumers старых колонок не ломаются; значение raw number, чтобы spreadsheet мог `SUM`.

## Conversation panel: automation filter + recognition

[PR #16388](https://github.com/OpenHands/OpenHands/pull/16388) (resolves [#16349](https://github.com/OpenHands/OpenHands/issues/16349)) добавляет client-side filter поверх loaded pages — server-side tag filtering нет ни у local, ни у cloud backend, а panel уже так же scoped'ит thread/pinned/older.

Новый preference state (`conversation-panel-preferences-store`):

```ts
type AutomationFilterMode = "all" | "hide-automations" | "only-automations";

automationFilterMode: "all";
selectedAutomationNames: string[];
```

В filter menu секция **Automations**:

- _All conversations_
- _Hide automation runs_
- _Only automation runs_ + multi-select per-automation-name rows (bucket `UNNAMED_AUTOMATION_FACET = "__unnamed__"`)
- accent dot на trigger, пока filter active

Recognition (`isAutomationConversation`):

- cloud: `trigger === "automation"` (`ConversationTrigger` union расширен);
- local: любой из automation tags (`automationname` / `automationtrigger` / `automationid` / `automationrunid`).

Chip curation: `automationid` / `automationrunid` уходят в reserved keys (raw UUID noise), `automationname` / `automationtrigger` остаются видимыми. Pinned section **exempt** от filter. Если filter опустошил visible list при наличии next page — dedicated empty-state + «Load more» остаётся, driver chain-fetch'ит до match. Stale name selections self-heal против facets loaded data. Работает с agent-server ≥ 1.28.0 (panel minimum).

## Tag chips, overflow, hovercard labels

[PR #16346](https://github.com/OpenHands/OpenHands/pull/16346) делает free-form tags first-class metadata на conversation cards.

Что появляется:

- single-row **value-only** chips (key в tooltip), width-aware `+N` overflow + portaled key/value popover;
- `TAG_CHIP_VALUE_MAX_LENGTH = 14`, `TAG_CHIP_GAP_PX = 4`, `TAG_CHIP_OVERFLOW_WIDTH_PX = 36`;
- shared pill style `CONVERSATION_CARD_META_CHIP_CLASSNAME` для repo/branch, workspace, LLM/agent chip и tags;
- card stack / Metadata filter order: **repo/branch → model → tags**;
- hovercard с той же priority + localized labels/icons для known keys (в т.ч. ACM `appmode` / `worktools` / `workwsid`), humanize unknown snake_case.

`RESERVED_CONVERSATION_TAG_KEYS` расширен, чтобы first-class facts не double-render'ились как chips:

```text
acpserver, title,
git_provider, repo, repo_name, repository,
branch, selected_branch,
archiveworkspacepath, workspace, working_dir,
automationid, automationrunid
```

Defaults на fresh install / missing preference fields: `showTagsMetadata: false`, `showLlmProfiles: false` (hover metadata остаётся on). On-card chips gated preference'ом **Tags**; hovercard всё равно lists display tags через `getDisplayConversationTags`.

## Version update UI: modal + sidebar tile

[PR #16343](https://github.com/OpenHands/OpenHands/pull/16343) (supersedes closed agent-canvas [#1891](https://github.com/OpenHands/agent-canvas/pull/1891)) убирает settings accordion, который занимал место даже когда update нет.

- `AgentCanvasVersionModal` — version status, release notes, tabs **npm** / **Docker** с copy commands (`AGENT_CANVAS_UPDATE_COMMANDS`);
- `AgentCanvasVersionTile` в `SidebarRailBody` с `hideWhenUpToDate` — tile только когда npm `latest` > installed (`compareAgentServerVersions`); collapsed sidebar скрывает tile;
- settings sidebar сохраняет check / up-to-date flow через `AgentCanvasUpdateCard`;
- registry check теперь на app load (tile mounted on every route), не только при открытии settings;
- locked-to-cloud host → tile/check disabled.

## Home Automations empty state + Customize nav

[PR #16372](https://github.com/OpenHands/OpenHands/pull/16372): `RunningAutomationsList` / Featured Automations pane больше не `return null` при zero enabled automations. После load + healthy automation backend header «Automations + Add» остаётся с empty-state hint (`FEATURED_AUTOMATIONS$EMPTY_HINT`: «No automations yet. Add one…»). Pane по-прежнему скрыт while loading / unhealthy backend / fetch error.

[PR #16358](https://github.com/OpenHands/OpenHands/pull/16358) (first contribution @DevinVinson): `EXTENSIONS_NAV_ITEMS` reorder → **MCP Servers**, Skills, Plugins; desktop Customize hub redirect `/skills` → `/mcp`.

## Desktop: name + multi-size icons

[PR #16353](https://github.com/OpenHands/OpenHands/pull/16353) — user-visible rename **Agent Canvas** → **OpenHands Agent Canvas**:

- `productName`, DMG title, installer artifact names в `electron-builder.config.mjs`;
- splash `electron/loading.html`, console banner + error dialogs в `electron/main.mjs`;
- CI followers: `PRODUCT_FILENAME`, Gatekeeper comment, `product-name` input.

Сознательно **не** тронуты identity paths:

- `appId: "dev.openhands.agent-canvas"`
- `electron/package.json` `"name": "agent-canvas"` → тот же userData dir (`~/Library/Application Support/agent-canvas`).

[PR #16352](https://github.com/OpenHands/OpenHands/pull/16352) чинит Windows default Electron icon: раньше ship'ился только 1024×1024 `icon.png`, electron-builder делал ICO с одним 256 PNG entry без classic 16/24/32/48 BMP — Explorer/NSIS/taskbar fallback. Плюс не вызывался `app.setAppUserModelId`, хотя NSIS shortcuts stamped `dev.openhands.agent-canvas`.

Теперь:

- committed `icon.ico` (16→256, small sizes BMP) + `icon.icns` (все 10 Apple representations);
- `npm run generate-icons` (`scripts/generate-icons.mjs`, `png2icons`);
- win32 `BrowserWindow` icon = `icon.ico`; `app.setAppUserModelId` matches NSIS AUMID;
- structure/sync/config guards в `__tests__/scripts/desktop-icons.test.ts`.

## Metrics: direct runtime fetch (no cloud-proxy)

[PR #16392](https://github.com/OpenHands/OpenHands/pull/16392): endpoint `/api/cloud-proxy` **удалён** из agent-server. `getRuntimeConversation` на cloud ходил через него → `404` (local Canvas + Cloud backend) или `405` (Cloud Canvas + Cloud backend) и error toast на **Display Cost**.

После фикса оба backend path'а используют один код:

```ts
const response = await new ConversationClient(
  getAgentServerClientOptions({ conversationUrl, sessionApiKey })
).getConversation<RawRuntime>(conversationId);
```

`useConversationMetrics` больше не skip'ает query на cloud — fetch идёт на per-conversation runtime host из `conversationUrl` с `X-Session-API-Key`. Runtime agent-server отдаёт CORS для browser-origin, proxy hop не нужен. Другие callers `callCloudProxy` (bash events, git diff, runtime execute, event search) — out of scope этого PR.

## New contributors

Первый contribution в этом релизе: [@DevinVinson](https://github.com/OpenHands/OpenHands/pull/16358) (Customize nav reorder).

## Кому обновляться

- **Multi-agent / delegation workflows** — typed `launch_child_conversation` вместо fragile curl skills; нужен agent-server ≥ 1.37.1 для persisted parent link.
- **Automations operators** — per-run `$cost` в Activity Log + CSV/JSON export; empty Featured Automations pane как discoverability nudge.
- **Busy conversation sidebars** — hide/only automation runs + name facets; tag chips с overflow вместо raw UUID noise.
- **Desktop Agent Canvas** — корректное имя **OpenHands Agent Canvas** и multi-size icons на Windows/macOS.
- **Cloud cost modal users** — Display Cost снова работает после удаления cloud-proxy.
- **Customize navigation** — landing `/mcp` вместо `/skills`.

## Ссылки

- Release: [v1.11.0](https://github.com/OpenHands/OpenHands/releases/tag/v1.11.0)
- Compare: [v1.10.0...v1.11.0](https://github.com/OpenHands/OpenHands/compare/v1.10.0...v1.11.0)
- Features: [#16351](https://github.com/OpenHands/OpenHands/pull/16351), [#16358](https://github.com/OpenHands/OpenHands/pull/16358), [#16343](https://github.com/OpenHands/OpenHands/pull/16343), [#16372](https://github.com/OpenHands/OpenHands/pull/16372), [#16380](https://github.com/OpenHands/OpenHands/pull/16380), [#16388](https://github.com/OpenHands/OpenHands/pull/16388), [#16346](https://github.com/OpenHands/OpenHands/pull/16346)
- Fixes: [#16352](https://github.com/OpenHands/OpenHands/pull/16352), [#16353](https://github.com/OpenHands/OpenHands/pull/16353), [#16392](https://github.com/OpenHands/OpenHands/pull/16392)

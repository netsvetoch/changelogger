---
author: Артём Нецветаев
pubDatetime: 2026-08-14T23:01:33.000Z
title: "OpenHands 1.13.0: archive диалогов, markdown previews, context meter и ready-for-dev"
slug: openhands-v1-13-0
featured: false
draft: false
tags:
  - release
  - openhands
  - ai-agents
  - canvas
  - llm
  - ui
  - github
description: "Разбор OpenHands v1.13.0: client-side archive conversations, inline markdown artifact previews, context-window meter + usage drawer + manual compaction, ready-for-dev issue gate, CreateConversationOptions, OpenRouter в Basic providers и shell-free launcher spawn."
---

[OpenHands](https://github.com/OpenHands/OpenHands) выпустил минорный релиз [`v1.13.0`](https://github.com/OpenHands/OpenHands/releases/tag/v1.13.0) (13 августа 2026). Это Canvas/Agent Canvas релиз про управление длинной историей диалогов и context window: sidebar получает недеструктивный **Archive**, chat рендерит agent-created Markdown как clipped rich preview, composer показывает ring meter заполнения контекста с manual compaction, а репозиторий закрывает quality gate для issues через label `ready-for-dev`.

Основа статьи — GitHub Release [`v1.13.0`](https://github.com/OpenHands/OpenHands/releases/tag/v1.13.0), compare [`v1.12.0...v1.13.0`](https://github.com/OpenHands/OpenHands/compare/v1.12.0...v1.13.0) (28 commits, 177 files) и исходные PR: [#16100](https://github.com/OpenHands/OpenHands/pull/16100), [#16185](https://github.com/OpenHands/OpenHands/pull/16185), [#16311](https://github.com/OpenHands/OpenHands/pull/16311), [#16449](https://github.com/OpenHands/OpenHands/pull/16449), [#16500](https://github.com/OpenHands/OpenHands/pull/16500), [#16508](https://github.com/OpenHands/OpenHands/pull/16508), [#16324](https://github.com/OpenHands/OpenHands/pull/16324), [#16453](https://github.com/OpenHands/OpenHands/pull/16453), [#16093](https://github.com/OpenHands/OpenHands/pull/16093), [#16338](https://github.com/OpenHands/OpenHands/pull/16338), [#16348](https://github.com/OpenHands/OpenHands/pull/16348).

Pin в `config/defaults.json` на теге `v1.13.0`:

| Component                        | Version                      |
| -------------------------------- | ---------------------------- |
| `agentCanvas`                    | `1.13.0`                     |
| `agentServer`                    | `1.42.1`                     |
| `automation`                     | `1.7.1`                      |
| `@openhands/typescript-client`   | `1.38.0`                     |
| constraint `agentClientProtocol` | `agent-client-protocol<0.11` |

## Client-side archive conversations

[PR #16100](https://github.com/OpenHands/OpenHands/pull/16100) закрывает gap «в sidebar можно только удалять». `DELETE /api/conversations/{id}` уничтожает conversation и event history на agent-server. Archive — недеструктивная альтернатива: history остаётся на backend, меняется только visibility списка.

Стор `src/stores/archived-conversations-store.ts` (zustand + `persist` → `localStorage`, key `archived-conversations`):

```ts
export const ARCHIVED_CONVERSATIONS_STORAGE_KEY = "archived-conversations";

interface ArchivedConversationsState {
  archivesByBackendId: Record<string, string[]>;
}

// actions:
archiveConversation(backendId, conversationId);
removeArchivedConversation(backendId, conversationId);
isArchived(backendId, conversationId);
```

Ключ — **per-backend**: архив привязан к `activeBackend.id`, а не к глобальному flat set. IDs не prune'ятся по loaded pages — archived conversation, которой нет на текущей странице, остаётся archived и не «всплывает» обратно.

UI surface:

| Surface           | Behavior                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Card context menu | `Archive` / `Unarchive` (`data-testid` `archive-button` / `unarchive-button`, icons Lucide `Archive` / `ArchiveRestore`) |
| Confirm modal     | `ConfirmArchiveModal` — warning, что history сохраняется и restore идёт через Show archived                              |
| Card footer       | chip `Archived` (`conversation-card-archived-chip`), когда toggle показывает archived rows                               |
| Filter menu       | persisted toggle `showArchivedConversations` (default `false`) в `conversation-panel-preferences-store`                  |

Важные bulk/pagination semantics (зафиксированы тестами):

1. **Delete all** ходит по `allLoadedConversations` — archive-unaware collection. Hidden archived rows **всё равно удаляются**.
2. **Load more** остаётся доступным, даже если client-side filter (archive) спрятал все loaded rows, но backend ещё отдаёт `next_page_id`. Иначе после archive всей первой страницы нельзя добраться до unarchived conversation на page 2.
3. Archive одной conversation снимает pin (`unpinConversation`), чтобы archived+pinned не держали «призрачный» pin.

Это чисто client preference layer: agent-server API archive endpoint не добавляется.

## Inline markdown artifact previews

[PR #16185](https://github.com/OpenHands/OpenHands/pull/16185) меняет то, как chat показывает agent-created Markdown. Раньше `file_editor` create `.md` шёл через обычный `CodeBlock` source dump и мог схлопнуться в collapsed action group — длинный report занимал поток и требовал ручного открытия Files drawer.

Новый helper `src/utils/is-markdown-file-path.ts`:

```ts
const MARKDOWN_EXTS = new Set(["md", "markdown", "mdx"]);

export function isMarkdownFilePath(path: string): boolean {
  const idx = path.lastIndexOf(".");
  if (idx === -1) return false;
  return MARKDOWN_EXTS.has(path.slice(idx + 1).toLowerCase());
}
```

`MarkdownFilePreview` (`tool-visualizers/primitives/markdown-file-preview.tsx`):

- height-limited rich preview через `MarkdownRenderer` + internal vertical scroll;
- footer **View** deep-link'ит в Files drawer (`selectedTab: "files"`, `useFilesTabStore.selectedPath`);
- `isMarkdownFileEditorEvent` распознаёт **create** action/observation (не `view` / `str_replace`).

Grouping (`group-events.ts`): markdown create events — group breakers. `isGroupableEvent(event, correspondingAction?)` теперь принимает paired action, чтобы observation без `path` всё равно ungroup'илась, если path живёт на action. `view` observation `.md` остаётся groupable CodeBlock path.

Дополнительно:

- event titles для create: «Wrote to …» вместо generic edit wording;
- `PathComponent` / shared path labels: `font-normal tracking-tight` вместо bold/wide mono;
- `FilePathChip` получил optional `onClick` → button, открывающий файл;
- table edge fades в `MarkdownTableScroll` читают `--oh-scroll-fade-from`, чтобы fade совпадал с surface preview card, а не всегда с base chat background.

## Context window meter, usage drawer, manual compaction

[PR #16311](https://github.com/OpenHands/OpenHands/pull/16311) (resolves [#16170](https://github.com/OpenHands/OpenHands/issues/16170)) — целый usage surface вместо старого metrics modal.

### Composer meter

`ContextWindowMeter` в `chat-input-actions.tsx`:

- ring `ContextWindowRing` (16×16, stroke 2) с tone `neutral` / `warning` / `danger` через `getContextFillTone`;
- tooltip «Show Context» + popover: percent used/left, compact token summary, action **Compact context**;
- click по ring → tab `usage`.

Helpers `src/utils/format-token-count.ts`:

```ts
formatCompactTokenCount(198_500); // "198.5k"
formatCompactTokenCount(1_050_000); // "1.1M"

getContextWindowUsagePercentage(perTurnToken, contextWindow);
// contextWindow <= 0 → 0 (нет деления на ноль у моделей без window)
// иначе min(100, perTurnToken / contextWindow * 100)
```

`useContextWindowUsage` предпочитает live WS metrics store; REST snapshot `accumulated_token_usage` — fallback. Meter **не рендерится**, пока нет usable `context_window`.

### Usage tab / drawer

Новый conversation tab `usage` (Lucide `Gauge`):

- lazy route `usage-tab` + `UsagePanel`;
- token breakdown, budget bar, provider balance;
- menu label `Display Cost` → **Display Usage and Cost**;
- старый `MetricsModal` export убран из conversation surface.

Provider balance: `LLMBalanceService.getBalance()` → `GET /api/llm/balance`, normalize snake_case → camelCase (`limit_remaining` → `limitRemaining`, `is_free_tier` → `isFreeTier`). 404 → `null` (endpoint отсутствует / provider без balance) и UI balance card прячется. Timeout остаётся error, не `null` — иначе `staleTime: Infinity` закэшировал бы «нет баланса» после transient stall.

### Manual compaction

```ts
// AgentServerConversationService
static async condenseConversation(
  conversationId: string,
  conversationUrl: string | null | undefined,
  sessionApiKey?: string | null,
): Promise<void>
```

- cloud + `conversationUrl` → `callCloudProxy` `POST /api/conversations/{id}/condense` на runtime host с session API key;
- иначе typed `ConversationClient.condenseConversation(conversationId)`.

Hooks: `use-compact-context-action`, `use-await-context-compaction`, `use-condense-conversation` + condensation event guards. WS metrics retyped как `Record<string, LLMMetrics>` (раньше фиксированный `{agent, condenser}` shape ронял ids вроде `default`, `profile:<name>:<uuid>`).

Follow-up fix в том же релизе: [PR #16534](https://github.com/OpenHands/OpenHands/pull/16534) — ring track рисуется foreground-токеном, а не border token (видимость на некоторых themes).

## ready-for-dev issue readiness gate

[PR #16449](https://github.com/OpenHands/OpenHands/pull/16449) — CI-managed label `ready-for-dev` для issues. Мотив: много AI-assisted first-time PR против underspecified issues без acceptance criteria / reproduction evidence.

Workflow `.github/workflows/issue-readiness-check.yml` на `issues: [opened, edited, reopened, labeled, unlabeled]` гоняет `.github/scripts/check_issue_readiness.py`.

Type-specific criteria:

| Issue label   | Required sections                                 | Extra                                                                                            |
| ------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `bug`         | `### Actual Behavior`, `### Acceptance Criteria`  | Actual Behavior: ≥1 supported run method **и** screenshot/video; AC: ≥1 checklist item (`- [ ]`) |
| `enhancement` | `### Desired Behavior`, `### Acceptance Criteria` | AC: ≥1 checklist item                                                                            |

Supported run methods (regex):

- `agent-canvas` (покрывает `npx @openhands/agent-canvas`, global binary, …);
- `npm run` (`dev` / `dev:minimal`);
- literal `app.all-hands.dev/canvas`.

Evidence detectors: markdown images, `<img>`/`<video>`, `github.com/user-attachments/assets/`, video file URLs, youtube/loom/vimeo/asciinema hosts.

Templates:

- `bug_report.yml` — Actual Behavior description требует run method + screenshot; новое поле Acceptance Criteria;
- новый `feature_request.yml` с Problem / Desired Behavior / Acceptance Criteria.

PR gate (`.github/scripts/check_pr_description.py` + workflow):

- body должен ссылаться на issue (`Fixes #N` / `Closes` / `Resolves` / bare `#N` в Issue Number section);
- linked issue обязан нести `ready-for-dev`;
- PR Type checkbox должен совпадать с issue labels (`Bug fix` ↔ `bug`, `Feature` ↔ `enhancement`);
- bug-fix PR требует screenshot/video reproduction evidence даже без frontend files.

Feedback comment upsert'ится маркером `<!-- issue-readiness-check -->` (`post-readiness-comment.mjs`), чтобы не спамить duplicates.

## API: `CreateConversationOptions` вместо 11 positional params

[PR #16500](https://github.com/OpenHands/OpenHands/pull/16500) (fixes [#16501](https://github.com/OpenHands/OpenHands/issues/16501), closes TODO `#1587`) — breaking change для internal frontend callers `AgentServerConversationService.createConversation`.

Было: 11 positional args, callers пропускали середину через `undefined` и даже tuple-spread `[undefined, agentProfileId, agentProfileKind]`.

Стало:

```ts
export interface CreateConversationOptions {
  initialUserMsg?: string;
  conversationInstructions?: string;
  plugins?: PluginSpec[];
  metadata?: ConversationMetadata | null;
  workingDirOverride?: string;
  workspaceMode?: WorkspaceMode;
  parentConversationId?: string;
  agentType?: "default" | "plan";
  sandboxId?: string;
  agentProfileId?: string;
  agentProfileKind?: AgentKind;
}

static async createConversation(
  options: CreateConversationOptions = {},
): Promise<AppConversationStartTask>
```

Call site example (`use-create-conversation`):

```ts
await AgentServerConversationService.createConversation({
  initialUserMsg: query,
  conversationInstructions,
  plugins,
  metadata: repository
    ? {
        selected_repository: repository.name,
        selected_branch: repository.branch ?? null,
        git_provider: repository.gitProvider,
      }
    : null,
  workingDirOverride: workingDir,
  workspaceMode,
  parentConversationId,
  agentType,
  ...(effectiveAgentProfileId
    ? {
        agentProfileId: effectiveAgentProfileId,
        agentProfileKind: resolvedAgentProfile?.agent_kind,
      }
    : {}),
});
```

HTTP payload к agent-server/cloud тот же; меняется только TypeScript call contract внутри Canvas frontend. Внешние REST clients не затрагиваются.

## Typed client only: no ad-hoc agent-server `fetch`

[PR #16508](https://github.com/OpenHands/OpenHands/pull/16508) поднимает prohibition с test-time allowlist до ESLint rule `local/no-direct-agent-server-fetch` в `eslint.config.js`.

- flags global `fetch` к agent-server `/api/...` paths;
- message направляет на `@openhands/typescript-client` / `AgentServerClient.request`;
- external URLs, npm registry version check, workspace static fileserver, OAuth `/oauth/...` не трогаются.

`llm-balance-service` / `llm-subscription-service` мигрированы на `AgentServerClient.request` (404 → `null` для balance сохранён). Test `no-direct-agent-server-calls.test.ts` больше не держит balance service в ad-hoc allowlist после migration.

## Automations: non-MCP integrations visible

[PR #16324](https://github.com/OpenHands/OpenHands/pull/16324) (fixes [#16292](https://github.com/OpenHands/OpenHands/issues/16292)): recommended automation cards резолвили integration IDs только против MCP-filtered marketplace catalog. HTTP/OpenAPI-only entry вроде Jira silently drop'ался — `jira-issue-to-pr` выглядел как «только GitHub».

Теперь:

- `getIntegrationEntries` ходит в **full** catalog;
- `isMcpInstallableEntry` классифицирует installability;
- non-MCP dependency остаётся на card с label **Needs external setup** (i18n `RECOMMENDED_AUTOMATIONS$EXTERNAL_SETUP`, 15 locales);
- счётчик «N MCPs to connect» считает только MCP-installable entries;
- launcher install queue по-прежнему ставит modal'ы только для MCP-installable required deps — exclusion теперь explicit и user-visible;
- search by external integration name (например `jira`) всё ещё находит automation.

## Basic LLM providers: снят cap 100

[PR #16453](https://github.com/OpenHands/OpenHands/pull/16453) (fixes [#15576](https://github.com/OpenHands/OpenHands/issues/15576)): local agent-server отдаёт ~149 providers из litellm; `openrouter` сидит после index 100. `useSearchProviders` вызывал `ConfigService.searchProviders({ limit: 100 }, …)` — после prepend verified providers и dedupe OpenRouter обрезался, dropdown заканчивался на `nvidia_riva`.

```ts
// src/hooks/query/use-search-providers.ts
// было: ConfigService.searchProviders({ limit: 100 }, verifiedByProvider)
const page = await ConfigService.searchProviders({}, verifiedByProvider);
```

Regression test мокает 149-entry list с `openrouter` past position 100 и assert'ит, что hook его возвращает.

## Launcher: shell-free spawn + telemetry + postinstall

### Windows shell metacharacters — [PR #16093](https://github.com/OpenHands/OpenHands/pull/16093)

`getProcessTreeSpawnOptions()` теперь **всегда** форсит `shell: false`. На Windows `shell: true` заставлял cmd.exe парсить `agent-client-protocol<0.11` как input redirection — agent-server не биндил port 18000, ingress отдавал Bad Gateway.

```js
// scripts/dev-process-utils.mjs
export function getProcessTreeSpawnOptions(options = {}) {
  return {
    ...options,
    shell: false,
    detached: process.platform !== "win32",
  };
}
```

Callers, которым нужен shell, должны явно запускать shell как command.

### Agent-server telemetry env — [PR #16348](https://github.com/OpenHands/OpenHands/pull/16348)

Canvas launchers (Node + Docker entrypoint) прокидывают `OH_TELEMETRY_*` в agent-server и добавляют PostHog dependency в `uvx` environment. Consent остаётся за persisted UI/backend settings; explicit operator env и `DO_NOT_TRACK` сохраняются.

### Global install guidance — [PR #16338](https://github.com/OpenHands/OpenHands/pull/16338)

`package.json` `postinstall` (inline `node -e`, без external script — Docker `npm ci` копирует только lockfiles):

```text
✓ @openhands/agent-canvas installed!

To start Agent Canvas, run:

  agent-canvas

This launches the full stack at http://localhost:8000.

Docs: https://docs.openhands.dev/openhands/usage/agent-canvas/setup
```

Печатается только при `npm_config_global === 'true'`; local/library/Docker installs молчат.

## Прочие bugfixes в 1.13.0

| PR                                                                                                                        | Fix                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [#16101](https://github.com/OpenHands/OpenHands/pull/16101)                                                               | overflow menus usable on touch devices                                                        |
| [#16179](https://github.com/OpenHands/OpenHands/pull/16179)                                                               | sidebar «Load more» discovers folders, not folder contents                                    |
| [#16479](https://github.com/OpenHands/OpenHands/pull/16479)                                                               | disable chat input drag-resize when not bottom-anchored (OHE-3062)                            |
| [#16504](https://github.com/OpenHands/OpenHands/pull/16504) / [#16558](https://github.com/OpenHands/OpenHands/pull/16558) | flaky `ProgressEvent` unhandled rejection / drain pending MSW callbacks before jsdom teardown |

## Dependency bumps

Из maintenance-блока релиза (не полный список dependabot):

- SDK pins: software-agent-sdk / agent-server path → `1.42.1`, automation `1.7.1`, `@openhands/typescript-client` `1.38.0` ([PR #16554](https://github.com/OpenHands/OpenHands/pull/16554));
- runtime: `zustand` 5.0.12 → 5.0.14, `i18next-http-backend` 4.0.0 → 4.0.1, `@microlink/react-json-view` 1.31.20 → 1.31.25;
- tooling: eslint group, lint-staged 16.4.0 → 17.3.0, testing/react groups, `docker/login-action` 4.5.2 → 4.6.0.

## New contributors

Первые merged contributions в этом релизе: [@Lothnic](https://github.com/Lothnic) (#16500), [@lokesh75-kank](https://github.com/lokesh75-kank) (#16324), [@lufen](https://github.com/lufen) (#16093), [@opensource-joe](https://github.com/opensource-joe) (#16453).

## Кому обновляться

| Роль                       | Зачем 1.13.0                                                                      |
| -------------------------- | --------------------------------------------------------------------------------- |
| Daily Canvas users         | Archive вместо delete, markdown reports inline, context meter + manual compact    |
| Local LLM setup            | OpenRouter и остальные providers после 100-го больше не пропадают из Basic picker |
| Windows local stack        | launcher больше не ломается на `agent-client-protocol<0.11`                       |
| Automation authors         | Jira-like non-MCP deps видны как Needs external setup                             |
| Contributors / maintainers | `ready-for-dev` gate на issues/PRs; `createConversation` options object           |
| Global npm installers      | postinstall подсказывает `agent-canvas`                                           |

Upgrade path для npm package:

```bash
npm install -g @openhands/agent-canvas@1.13.0
agent-canvas
# http://localhost:8000
```

Полный changelog: [`v1.12.0...v1.13.0`](https://github.com/OpenHands/OpenHands/compare/v1.12.0...v1.13.0).

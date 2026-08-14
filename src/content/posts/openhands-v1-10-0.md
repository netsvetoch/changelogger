---
author: Артём Нецветаев
pubDatetime: 2026-08-14T22:50:34.000Z
title: "OpenHands 1.10.0: Featured Automations, skill facets, activity-log export и GLM 5.2"
slug: openhands-v1-10-0
featured: false
draft: false
tags:
  - release
  - openhands
  - ai-agents
  - automations
  - canvas
  - mcp
description: "Разбор OpenHands v1.10.0: default model openhands/glm-5.2, Featured Automations на home, faceted rail на /skills, manifest-driven /automations dashboard+templates, JSON/CSV export Activity Log, deployment timeout cap, backend-pinned sidebar links, IPv4 proxy и MCP named-server mutations."
---

[OpenHands](https://github.com/OpenHands/OpenHands) выпустил минорный релиз [`v1.10.0`](https://github.com/OpenHands/OpenHands/releases/tag/v1.10.0) (5 августа 2026). Это Canvas/Agent Canvas релиз вокруг automations surface, skills discovery, default LLM и multi-backend reliability: home показывает live health enabled automations, `/skills` получает faceted filter rail с URL state, automation UI умеет manifest-driven dashboard/templates, Activity Log экспортируется в JSON/CSV, а несколько fixes закрывают timeout cap, backend identity на sidebar links, Windows `localhost`→`::1` proxy и wipe MCP credentials при sibling mutations.

Основа статьи — GitHub Release [`v1.10.0`](https://github.com/OpenHands/OpenHands/releases/tag/v1.10.0), compare [`v1.9.0...v1.10.0`](https://github.com/OpenHands/OpenHands/compare/v1.9.0...v1.10.0) и исходные PR: [#16146](https://github.com/OpenHands/OpenHands/pull/16146), [#16234](https://github.com/OpenHands/OpenHands/pull/16234), [#16266](https://github.com/OpenHands/OpenHands/pull/16266), [#16124](https://github.com/OpenHands/OpenHands/pull/16124), [#16303](https://github.com/OpenHands/OpenHands/pull/16303), [#16233](https://github.com/OpenHands/OpenHands/pull/16233), [#16243](https://github.com/OpenHands/OpenHands/pull/16243), [#16290](https://github.com/OpenHands/OpenHands/pull/16290), [#16144](https://github.com/OpenHands/OpenHands/pull/16144), плюс pins [#16321](https://github.com/OpenHands/OpenHands/pull/16321) / [#16334](https://github.com/OpenHands/OpenHands/pull/16334).

## Default model Canvas: `openhands/glm-5.2`

[PR #16146](https://github.com/OpenHands/OpenHands/pull/16146) меняет frontend default OpenHands LLM с MiniMax M2.7 на GLM 5.2. В `src/services/settings.ts` оба места, которые задают «пустой model → default», теперь указывают один id:

```ts
export const DEFAULT_SETTINGS: Settings = {
  llm_model: "openhands/glm-5.2",
  // ...
  agent_settings: {
    // ...
    llm: {
      model: "openhands/glm-5.2",
    },
  },
};
```

Спека `specs/llm-defaults.md` (LLD-001) фиксирует контракт: если agent-server вернул absent/empty/`whitespace-only` `llm.model` (включая путь через `encryptedAgentSettings`), frontend adapter подставляет `DEFAULT_SETTINGS.llm_model` и **никогда** не опирается на SDK default (`gpt-5.5`). Mock model metadata и settings-service tests обновлены синхронно (`default_model`, verified models list).

Кого это касается: fresh installs и пользователи без сохранённого model preference. Явно выбранная модель не переписывается этим PR.

## Featured Automations на Canvas home

[PR #16266](https://github.com/OpenHands/OpenHands/pull/16266) (closes [#16236](https://github.com/OpenHands/OpenHands/issues/16236)) выносит production landing section на home: self-gating `FeaturedAutomationsSection` / pinned dashboard вместо mock-прототипа за `VITE_FEATURED_AUTOMATIONS_DEMO`.

Что рендерится, когда automation sidecar healthy:

- chip на каждую **enabled** automation с health indicator;
- standard tooltip: trigger, last-run status/time, failure detail;
- `+` chip → `/automations`;
- per-tab persistent Featured area: expanded cards с `RunStatusBadge`, conversation-title как result line, `error_detail`, conversation link;
- hook `useLatestAutomationRuns` — `useQueries` fan-out, shared `automation-runs` key prefix (dispatch invalidation доходит до home), **3s polling** пока run в `PENDING`/`RUNNING`, без retries.

API не отдаёт run-summary text / next-run / batch «latest run per automation», поэтому production design делает limit-1 newest-first per enabled automation и берёт stand-ins:

| Prototype field         | Live source              |
| ----------------------- | ------------------------ |
| `agentMessage` / result | conversation title run'а |
| failure text            | `error_detail`           |
| `nextRun`               | `trigger.schedule_human` |

Без automation sidecar секция не монтируется — home остаётся как раньше. То же поведение на OpenHands Cloud через `/api/automation` proxy. i18n-семья `FEATURED_AUTOMATIONS$` добавлена во все 15 locales.

## Activity Log export: JSON и CSV

[PR #16234](https://github.com/OpenHands/OpenHands/pull/16234) (issue [#16157](https://github.com/OpenHands/OpenHands/issues/16157), paired automation backend) закрывает gap «Load more pagesize vs полная history». В Activity Log появляются **Export JSON** и **Export CSV**; при `total === 0` или loading кнопки disabled.

Клиент (`src/utils/automation-activity-log-export.ts`) page'ит `GET` runs с `EXPORT_PAGE_SIZE = 100` (`limit`/`offset`) через существующий `AutomationService.listAutomationRuns`, пока `offset < total`, затем:

- JSON — скачивание массива export rows;
- CSV — client-side `serializeActivityLogRowsCsv`.

Поля строки:

```text
run_id, automation_id, automation_name, trigger,
start_time, end_time, duration_seconds, status,
conversation_id, conversation_url, error
```

`conversation_url` собирается как `{origin}/conversations/{conversation_id}` (`window.location.origin` из UI). Filename: `{slug(name)|id}.activity-log.{json|csv}`. Tracking: `trackAutomationActivityLogExported({ backendKind, format })`. Существующий paged list API для UI не ломается.

## Skills: faceted filter rail + shareable URL

[PR #16124](https://github.com/OpenHands/OpenHands/pull/16124) (issue [#16123](https://github.com/OpenHands/OpenHands/issues/16123)) заменяет type dropdown на `/skills` faceted rail. До релиза каталог (~58 public skills в bundled extensions + personal/project) жил за search box и одним dropdown `agentskills` / `knowledge` / `repo` — implementation detail, а не browse axis.

Группы facet'ов (multi-select внутри группы = OR, across groups = AND, live counts на каждой row):

| Group        | Values                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **State**    | `enabled`, `disabled`                                                                                                                                                          |
| **Source**   | `project`, `personal`, `public`                                                                                                                                                |
| **Category** | 9-value taxonomy из `@openhands/extensions` (`code-quality`, `agent-authoring`, `code-hosting`, `integrations`, `environment`, `writing`, `design`, `automations`, `other`, …) |
| **Type**     | `agentskills`, `knowledge`, `repo`                                                                                                                                             |

Filter state живёт в URL — linkable и survives reload:

```text
/skills?q=review&state=enabled&source=public&category=code-quality
```

Параметры: `q`, `state`, `source`, `category`, `type` (один key repeated per value). Pure table-driven model в `src/components/features/skills/skill-filter.ts` (`GROUP_DEFS`): parse / serialize / filter / facet construction / toggle — одна точка расширения. Unknown URL values drop'аются, а не «filter everything away». Группа с меньше чем двумя discriminating values скрыта (degrade без category field в старом catalog → все public = `other` → Category group vanishes). Ниже `md` rail → Filters button + badge active count + modal. Category badge на skill card.

## Manifest-driven automation sub-pages

[PR #16303](https://github.com/OpenHands/OpenHands/pull/16303) (closes [#15466](https://github.com/OpenHands/OpenHands/issues/15466)) дополняет interface-manifest seam из #16222 sub-page surface'ом. Canvas остаётся domain-neutral host; definitions живут в `@openhands/extensions`.

Контракт (`src/manifests/types.ts`):

- `navigation.subPages` — ordered nav (`list` / `templates`);
- `pages.list.overview` — overview tiles с closed metric vocabulary;
- `pages.list.filters` / `sort` / `insights` — filters, sort, run-insight captions;
- `pages.templates` + `routes.templates` — templates page identity;
- `INTERFACE_SUB_PAGE_IDS = ["list", "templates"]`.

Admission **fail-closed, all-or-nothing**: частичный sub-page group → manifest rejected, host падает на plain list. Accessors (`getSubPagesSpec`, `getDashboardSpec`, `getTemplatesPageSpec`) возвращают `null`, когда surface не declared — host defaults намеренно нет.

С manifest'ом:

- `/automations` → dashboard: sub-page nav (desktop aside + mobile strip), overview tile grid, status/trigger/sort dropdowns рядом с search, health badges, last-run + run stats на cards, extra list columns по ширине, filtered-empty → «Clear filters»;
- `/automations/templates` — manifest title/description + recommended-automations launcher (launcher уезжает с list);
- bounded per-automation run-summaries fan-out, cache-shared с detail page;
- semantics (health precedence, predicates, comparators, formatting) host-implemented в `src/manifests/automation-insights.ts`.

Без manifest'а (например pin extensions &lt; 0.16.0): list exactly as before, `/automations/templates` → 404. [PR #16321](https://github.com/OpenHands/OpenHands/pull/16321) поднимает `@openhands/extensions` до **0.16.0** — это релиз, который actually declares sub-page surface; под 0.15.0 host уже умел, но manifest молчал.

## Automation timeout cap из deployment capabilities

[PR #16233](https://github.com/OpenHands/OpenHands/pull/16233) убирает hard-coded ceiling `AUTOMATION_TIMEOUT_MAX_SECONDS = 1800` из `src/utils/automation-timeout.ts`.

Новая логика в edit modal:

```ts
const serviceTimeoutMax = capabilities?.maxAutomationTimeoutSeconds;
// deployment owns absolute ceiling; manifest may only narrow it
const timeoutMax =
  serviceTimeoutMax === undefined
    ? undefined
    : Math.min(serviceTimeoutMax, timeoutSpec.max ?? serviceTimeoutMax);

const timeoutResult = validateAutomationTimeout(form.timeout, timeoutMax);
// error interpolates { max: timeoutMax }
```

`validateAutomationTimeout(raw, maxSeconds?)`: blank → `null` (server default); positive int; ceiling enforced only when capability present — иначе server-side validation. i18n `AUTOMATIONS$ERROR_TIMEOUT_MAX_EXCEEDED` больше не hardcode'ит «1800». Default placeholder остаётся `AUTOMATION_TIMEOUT_DEFAULT_SECONDS = 600`.

[PR #16334](https://github.com/OpenHands/OpenHands/pull/16334) pins **agent-server 1.40.1** + **automation 1.6.0** (`config/defaults.json`): automation#296 начинает реально публиковать `maxAutomationTimeoutSeconds` (1800s на default deployment), так что client перестаёт жить в «no ceiling» fallback. Заодно drop dead `AUTOMATION_FRONTEND_DIR=""` — standalone automation SPA retired upstream.

## Multi-backend: pin backend identity на sidebar links

[PR #16243](https://github.com/OpenHands/OpenHands/pull/16243) (fixes [#15573](https://github.com/OpenHands/OpenHands/issues/15573)): cmd/ctrl/middle-click conversation в sidebar открывал new tab на wrong backend → `conversation not found`.

Причина: active backend **tab-scoped** — `readStoredActiveBackend()` предпочитает `sessionStorage`, fallback `localStorage`. New tab не наследует opener `sessionStorage` и берёт last-used backend из `localStorage`.

Fix:

```ts
// src/api/backend-registry/url-selection.ts
export const BACKEND_QUERY_PARAM = "backend";
export const ORG_QUERY_PARAM = "org";

withBackendSelectionParams("/conversations/abc", {
  backend: localBackend,
  orgId: null,
});
// → "/conversations/abc?backend=local-1"

withBackendSelectionParams("/conversations/abc", {
  backend: cloudBackend,
  orgId: "org-7",
});
// → "/conversations/abc?backend=prod&org=org-7"
```

- URL selection читается **на boot active store** (module init, до React) и persist'ится — ни один request не уходит на wrong backend; in-tab navigation без query string сохраняет выбор;
- sidebar conversation rows, collapsed-rail rows, start-task cards → `useBackendScopedPath()`;
- unknown/`unregistered` id ignored (stale/other-machine link degrade к старому behaviour);
- `NavigationLink` сравнивает **pathname** portion of `to` для active highlight — иначе query ломал current-row highlight;
- params остаются в URL (reload / copy-paste address bar).

E2E: `tests/e2e/mock-llm/backends/mock-llm-cross-connect.spec.ts` — two isolated backends, sessionStorage A vs localStorage B, cmd-click sidebar.

## IPv4 loopback для local proxy targets

[PR #16290](https://github.com/OpenHands/OpenHands/pull/16290) (fixes [#16203](https://github.com/OpenHands/OpenHands/issues/16203)): на части Windows 11 установок bundled Node резолвит `localhost` только в `::1`, а agent-server/automation bind'ятся на `127.0.0.1` → ingress `/server_info` получает `ECONNREFUSED ::1:18000` / HTTP 502, onboarding timeout ~60s.

Fix: locally launched agent-server и automation proxy targets идут на **`127.0.0.1`**, не `localhost`. Stack-mode tests assert IPv4 targets для обоих services. После патча: direct `127.0.0.1:18000/server_info`, proxied `127.0.0.1:8000/server_info` и `localhost:8000/server_info` — HTTP 200.

## MCP: preserve credentials при Canvas mutations

[PR #16144](https://github.com/OpenHands/OpenHands/pull/16144) (fixes [#15418](https://github.com/OpenHands/OpenHands/issues/15418), [#15420](https://github.com/OpenHands/OpenHands/issues/15420)) — часть stack SDK → typescript-client → Canvas.

До: Canvas rebuild'ил MCP settings из **redacted display snapshot**. Add/edit одного server мог overwrite credential нетронутого sibling; positional/rendering ids считались persistence identity; destructive pre-clear / second-PATCH / rollback.

После:

- TypeScript client generated-contract MCP types; settings map key = stable server identity;
- create / patch / delete **одного named MCP server** через dedicated Agent Server endpoints;
- rename = one atomic multi-key merge patch;
- нет full-catalog reconstruction, redacted-secret substitution, encrypted settings fetch для ordinary MCP edit, destructive pre-clear sequence;
- coverage: sparse mutation semantics, sibling credential preservation, rename/collision, credential replace/clear, concurrent keys, failed mutations + mock-LLM browser regression `mock-llm-mcp-github.spec.ts` (sibling credential survives create/edit/delete).

## Pins, deps, CI

| Change                    | Detail                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@openhands/extensions`   | **0.16.0** — declares automation sub-page manifest ([#16321](https://github.com/OpenHands/OpenHands/pull/16321))                                            |
| agent-server / automation | **1.40.1** / **1.6.0** ([#16334](https://github.com/OpenHands/OpenHands/pull/16334))                                                                        |
| Dependabot groups         | react, tanstack, tailwind, monaco `0.55.1→0.56.0`, i18next, types (`@types/node` 25.6.0→26.1.2), testing, eslint-import-resolver-typescript, GitHub Actions |
| npm audit                 | frontend vulnerability cleanup ([#16264](https://github.com/OpenHands/OpenHands/pull/16264))                                                                |
| `.gitignore`              | ignore entire `/.tmp/` ([#16272](https://github.com/OpenHands/OpenHands/pull/16272); also touched in #16243)                                                |
| CI                        | frontend PRs: require screenshot/video + checked human-tested box ([#16325](https://github.com/OpenHands/OpenHands/pull/16325))                             |

## New contributors

Первые contribution в этом релизе: [@ShashwatXD](https://github.com/OpenHands/OpenHands/pull/16234) (activity log export), [@rishavnaskar](https://github.com/OpenHands/OpenHands/pull/16243) (backend-pinned links), [@wangmeiwen](https://github.com/OpenHands/OpenHands/pull/16290) (IPv4 proxy), [@sleeyax](https://github.com/OpenHands/OpenHands/pull/16124) (skills facet rail).

## Кому обновляться

- **Automations operators** — Featured home chips, Activity Log JSON/CSV export, manifest dashboard/templates (нужен extensions ≥ 0.16.0 + automation ≥ 1.6.0 для full surface и timeout capability).
- **Skills-heavy workspaces** — shareable filtered `/skills` views по state/source/category/type.
- **Multi-backend / multi-org** — cmd-click sidebar больше не теряет backend identity.
- **Windows desktop Agent Canvas** — local stack readiness без `::1` proxy miss.
- **MCP power users** — add/edit/delete одного server не затирает sibling credentials.
- **Fresh installs** — default model `openhands/glm-5.2` вместо MiniMax M2.7.

## Ссылки

- Release: [v1.10.0](https://github.com/OpenHands/OpenHands/releases/tag/v1.10.0)
- Compare: [v1.9.0...v1.10.0](https://github.com/OpenHands/OpenHands/compare/v1.9.0...v1.10.0)
- Features: [#16146](https://github.com/OpenHands/OpenHands/pull/16146), [#16234](https://github.com/OpenHands/OpenHands/pull/16234), [#16266](https://github.com/OpenHands/OpenHands/pull/16266), [#16124](https://github.com/OpenHands/OpenHands/pull/16124), [#16303](https://github.com/OpenHands/OpenHands/pull/16303)
- Fixes: [#16233](https://github.com/OpenHands/OpenHands/pull/16233), [#16243](https://github.com/OpenHands/OpenHands/pull/16243), [#16290](https://github.com/OpenHands/OpenHands/pull/16290), [#16144](https://github.com/OpenHands/OpenHands/pull/16144)
- Pins: [#16321](https://github.com/OpenHands/OpenHands/pull/16321), [#16334](https://github.com/OpenHands/OpenHands/pull/16334)

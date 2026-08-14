---
author: Артём Нецветаев
pubDatetime: 2026-08-14T22:37:15.000Z
title: "Paseo 0.2.0: multi-forge PR/MR, web file editor, OMP provider и Changes как tab"
slug: paseo-v0-2-0
featured: false
draft: false
tags:
  - release
  - paseo
  - ai-agents
  - git
  - cli
  - desktop
description: "Разбор Paseo v0.2.0: pluggable forge (GitLab/Gitea/Forgejo/Codeberg), редактирование файлов в web/desktop, native OMP provider, Changes tab + commit history, Command Center model switch, servicePorts range/portScript, thinking off/max, CLI agent open и idle collection."
---

[Paseo](https://github.com/getpaseo/paseo) выпустил минорный релиз [`v0.2.0`](https://github.com/getpaseo/paseo/releases/tag/v0.2.0) (24 июля 2026). Это большой product-релиз вокруг git-хостинга, workspace-инструментов и agent runtime: PR/MR перестали быть GitHub-only, в web/desktop появился нормальный file editor, Oh My Pi (OMP) стал native provider, Changes view вырос до tab + commit history, а CLI/MCP выровняли вокруг workspace как product boundary.

Основа статьи — GitHub Release [`v0.2.0`](https://github.com/getpaseo/paseo/releases/tag/v0.2.0) и исходные PR: [#1913](https://github.com/getpaseo/paseo/pull/1913), [#2270](https://github.com/getpaseo/paseo/pull/2270), [#2067](https://github.com/getpaseo/paseo/pull/2067), [#2298](https://github.com/getpaseo/paseo/pull/2298), [#2275](https://github.com/getpaseo/paseo/pull/2275), [#1534](https://github.com/getpaseo/paseo/pull/1534)/[#2312](https://github.com/getpaseo/paseo/pull/2312), [#2147](https://github.com/getpaseo/paseo/pull/2147), [#2324](https://github.com/getpaseo/paseo/pull/2324), [#2165](https://github.com/getpaseo/paseo/pull/2165), [#2257](https://github.com/getpaseo/paseo/pull/2257), [#2267](https://github.com/getpaseo/paseo/pull/2267), [#2186](https://github.com/getpaseo/paseo/pull/2186), [#2213](https://github.com/getpaseo/paseo/pull/2213), [#2203](https://github.com/getpaseo/paseo/pull/2203), [#2322](https://github.com/getpaseo/paseo/pull/2322).

## Multi-forge: GitLab, Gitea, Forgejo, Codeberg

До 0.2.0 PR status, PR panel (checks/reviews/comments), create/merge/auto-merge и composer attachments были захардкожены под GitHub. [PR #1913](https://github.com/getpaseo/paseo/pull/1913) вводит **pluggable forge abstraction** и адаптеры:

| Forge brand | CLI / auth surface | Facts family (`forgeSpecific.forge`) |
| ----------- | ------------------ | ------------------------------------ |
| GitHub      | существующий path  | GitHub + `COMPAT` mirror             |
| GitLab      | `glab`             | `gitlab`                             |
| Gitea       | `tea`              | `gitea`                              |
| Forgejo     | `tea`              | `gitea` (shared shape)               |
| Codeberg    | `tea`              | `gitea` (shared shape)               |

Архитектура — registry/manifest, не typed union на каждый хост:

1. optional `ForgeDefinition` в `packages/protocol/src/forge-manifest.ts`;
2. server adapter `ForgeService` + entry в `defaultForgeRegistry`;
3. app split: pure logic module (`packages/app/src/git/forges/<id>.ts`) и view module (`*.view.tsx`) с icon/brandColor/pane contributions.

Wire-контракт для forge-specific facts — open envelope:

```ts
z.object({ forge: z.string() }).passthrough();
```

`forgeSpecific.forge` — **facts-family tag**, а top-level `status.forge` — brand id. Поэтому Forgejo/Codeberg могут отдавать `forgeSpecific.forge === "gitea"`, сохраняя brand `forgejo`/`codeberg`. Unknown facts рендерятся нейтрально, а не валят parse всего сообщения — это защита от version skew между client и daemon.

Trust gate для self-hosted: host либо из known cloud list, либо CLI уже authenticated к нему. Anonymous probe удалённых host'ов запрещён. Для back-compat GitHub facts по-прежнему зеркалятся в `status.github` под `COMPAT(forgeSpecific)`.

Связанный UX: pasted PR/MR link в new-workspace composer сразу выбирается как starting ref ([#2290](https://github.com/getpaseo/paseo/pull/2290)); create ждёт завершения lookup, чтобы быстрый submit не создал workspace с current branch вместо PR. Явный выбор branch (например `main`) override'ит auto-PR selection.

## Web/desktop file editor

[PR #2270](https://github.com/getpaseo/paseo/pull/2270) (и follow-ups [#2309](https://github.com/getpaseo/paseo/pull/2309), [#2277](https://github.com/getpaseo/paseo/pull/2277), [#2382](https://github.com/getpaseo/paseo/pull/2382)) открывает текстовые workspace files прямо в editor на web и в desktop wrapper.

Поведение:

- CodeMirror editor с app syntax theme и file icons;
- Markdown: toggle Source/Preview, когда host editable; на read-only host остаётся только preview;
- autosave через version-checked writes;
- external change → conflict alert overwrite-or-reload;
- unsaved drafts помечаются на tabs и защищены на close routes;
- optional Vim keybindings в Editor settings;
- chat file refs вида `target.ts:42` открывают editable file **на нужной строке**, а не на line 1;
- CRLF/LF и leading UTF-8 BOM сохраняются при save (раньше editor нормализовал в LF и снимал BOM).

Daemon advertise'ит editing как optional capability: старые clients продолжают парсить protocol, новые получают один upgrade-required path, если editing недоступен.

## Native provider: Oh My Pi (OMP)

[PR #2067](https://github.com/getpaseo/paseo/pull/2067) добавляет native OMP provider (disabled by default), рядом с Pi, Claude, Codex, OpenCode.

Pi и OMP делят только provider-neutral JSONL child-process transport (`providers/jsonl-rpc-process.ts`). Launch args, typed RPC, runtime, history, permissions, rewind, imports — у каждого provider'а свои. OMP даёт:

- RPC-UI approvals, todos, modes, usage, slash commands;
- native branch/rewind;
- read-only native subagents;
- native Paseo host tools через `set_host_tools`;
- minimum supported binary: **`16.3.9`** (`MIN_SUPPORTED_OMP_VERSION`).

Modes map'ятся в OMP approval flags:

| Paseo mode | Launch args                      |
| ---------- | -------------------------------- |
| `full`     | `--approval-mode yolo` (default) |
| `write`    | `--approval-mode write`          |
| `ask`      | `--approval-mode always-ask`     |

Optional provider params: `sessionDir`, `smolModel`, `slowModel`, `planModel` (ролевые model overrides через `--smol`/`--slow`/`--plan`). Custom providers могут `extends: "omp"` в `$PASEO_HOME/config.json` так же, как для `claude`/`pi`.

## Changes view: tab, Files→chat, commit history

Три связанных изменения превращают sidebar diff в полноценный review surface.

**Changes as workspace tab** ([#2298](https://github.com/getpaseo/paseo/pull/2298), desktop): toolbar toggle открывает complete working comparison как один workspace tab. Пока tab открыт, выбор changed file фокусирует его и скроллит к файлу; close tab возвращает inline expand/collapse. Mobile остаётся sidebar-only. Working comparison live: add/remove/delete файлов обновляет tab. Unified/split, wrap, whitespace, refresh и inline review controls общие с commit diffs. Один comparison-wide tab, не tab-per-file.

**Add files to chat** ([#2275](https://github.com/getpaseo/paseo/pull/2275)): shared file-actions menu в Files и Changes — Open file, Copy path, Download, **Add to chat**. Attachment pill попадает в focused chat без изменения уже набранного текста; multi-file attach поддержан. Drag-and-drop из обеих pane'ов тоже работает. Attachment type уже умеет line range, но UI в этом PR отдаёт whole-file.

**Commit history** ([#1534](https://github.com/getpaseo/paseo/pull/1534), [#2146](https://github.com/getpaseo/paseo/pull/2146), [#2312](https://github.com/getpaseo/paseo/pull/2312)):

- sidebar listing-only: changed files (tree/flat + `+/-` stats) и commits;
- click commit → ephemeral commit-diff tab; click changed file → stable working-changes tab;
- desktop commit tabs делят unified/side-by-side preference с Changes;
- explorer показывает **20 последних commits reachable from HEAD** (не только ahead-of-base), newest first;
- pushed (`●`) vs unpushed (`◌`) по reachability from any remote;
- merge commits diff'ятся against first parent.

## Command Center: switch models

[PR #2147](https://github.com/getpaseo/paseo/pull/2147) добавляет model switching в Command-K palette.

- модели появляются **только после начала ввода** — default Actions/Workspaces/Agents не меняется;
- flat filterable rows `Model › Provider › Name`, current model с check;
- **running agent** — только models своего provider'а (live agent не меняет provider); select → `setAgentModel` RPC + last-model preference;
- **new draft tab** — все available providers в одном flat list; select задаёт provider+model сразу.

## Open existing agents: deep link + CLI

[PR #2324](https://github.com/getpaseo/paseo/pull/2324) закрывает #97: open already-existing agent без создания нового.

Deep link:

```text
paseo://h/<server-id>/agent/<agent-id>
```

CLI:

```bash
paseo agent open <agent-id>
paseo agent open <agent-id> --server <server-id>
```

Desktop: register protocol, reuse/focus existing window, queue navigation until renderer listener ready. Не создаёт agent и не шлёт message — только select existing.

Protocol helpers (`packages/protocol/src/agent-deep-link.ts`): `buildAgentDeepLink`, `parseAgentDeepLink`, route shape `/h/${serverId}/agent/${agentId}`.

## Workspace service ports: range или external allocator

[PR #2165](https://github.com/getpaseo/paseo/pull/2165) — configurable dynamic port allocation для workspace services (раньше только OS ephemeral).

Schema (`PaseoServicePortAllocationSchema`):

```ts
{
  range?: `${number}-${number}`; // inclusive, 1-65535, start <= end
  portScript?: string;           // executable path, no shell
}
// нужно хотя бы одно из range | portScript
```

Глобально в `~/.paseo/config.json`:

```json
{
  "worktrees": {
    "servicePorts": { "range": "3000-4000" }
  }
}
```

Per-project в `paseo.json` (project block **replaces** global):

```json
{
  "worktree": {
    "servicePorts": { "portScript": "/usr/bin/portmake" }
  }
}
```

Приоритет: explicit service `port` > `portScript` > `range` > OS free port. `portScript` запускается **без shell** с args `(scriptName, workspaceId, branchName|\"\", worktreePath)` и env `PASEO_SCRIPTNAME`, `PASEO_WORKSPACE_ID`, `PASEO_BRANCH_NAME`, `PASEO_WORKTREE_PATH`; stdout — один TCP port. External allocator trusted: port может уже быть bound (attach to existing service). Timeout script'а 10s, max stdout 1 KiB. Registry резервирует ports across workspaces и снимает reservation с workspace plan.

## Thinking controls: Claude Off + Pi Max

**Claude thinking off** ([#2257](https://github.com/getpaseo/paseo/pull/2257)): option id `off` (`CLAUDE_DISABLED_THINKING_OPTION_ID`) для models с `supportsThinkingDisabled: true` в curated manifest — Opus 4.6/4.7/4.8 (включая 1M variants), Sonnet 4.6/5. Runtime aliases **не** наследуют capability: `resolveClaudeDisabledThinkingForModel` смотрит только manifest. Unsupported model + `off` → explicit error.

**Pi Max** ([#2267](https://github.com/getpaseo/paseo/pull/2267)): `PiThinkingLevel` расширен значением `"max"` (`label: "Max"`, `description: "Extreme reasoning"`) после `xhigh`. Полный enum на 0.2.0: `off | minimal | low | medium | high | xhigh | max` (default `medium`).

Mid-turn permission/thinking changes показывают, когда они take effect ([#2201](https://github.com/getpaseo/paseo/pull/2201)): manager drain'ит session events после `setMode`/`setModel`/`setThinkingOption`/`setFeature`, чтобы later explicit mutation выигрывала у stale events от earlier mutation.

## Safer defaults + idle resource release

**Default approval modes** ([#2213](https://github.com/getpaseo/paseo/pull/2213)):

| Provider | New default when supported | Fallback                         |
| -------- | -------------------------- | -------------------------------- |
| Claude   | `auto`                     | `default` on Bedrock/Vertex      |
| Codex    | `auto-review`              | previous default on older binary |

Explicit/saved mode choices и voice defaults не трогаются. Capability-aware `resolveDefaultModeId` фильтрует unsupported modes из catalog.

**Idle agent collection** ([#2203](https://github.com/getpaseo/paseo/pull/2203), [#2209](https://github.com/getpaseo/paseo/pull/2209)): после idle timeout daemon release'ит provider runtime, agent остаётся visible/unarchived/resumable. Open or prompt restores same provider session + timeline. Active agent-target schedules keep agents resident. Protocol state остаётся `closed` как resumable closed path — отдельного suspend lifecycle нет. OpenCode server refcount теперь shutdown'ит generation, когда final lease released.

## CLI / MCP: workspace как product boundary

[PR #2186](https://github.com/getpaseo/paseo/pull/2186) выравнивает automation surfaces:

- product unit = **workspace**, не worktree abstraction;
- managed callers (MCP) create subagents by default;
- bare human runs create fresh workspaces;
- explicit workspace IDs resolve to authoritative daemon directory;
- workspace create modes: local / worktree isolation, branch-off, existing-branch, checkout-pr (`--forge` когда inference не хватает);
- new top-level CLI: `paseo workspace …`, `paseo heartbeat …` (create/delete; requires `PASEO_AGENT_ID`);
- `paseo worktree …` остаётся **hidden COMPAT alias** (added in v0.2.0, remove after 2027-01-17);
- `paseo agent detach` — manual detach;
- schedules keep full management; heartbeats — create/delete only; new writes cron-based, legacy rolling intervals retain exact behavior.

## Прочие заметные добавления

- **Keyboard shortcuts search** ([#2160](https://github.com/getpaseo/paseo/pull/2160)): filter dialog by action, section, note, or key combination; search focused on open.
- **More external editors** ([#2119](https://github.com/getpaseo/paseo/pull/2119)): pluggable editor-target registry, open file at selected line; detects bundled macOS/Windows launchers outside `PATH`.
- **Remove custom providers** ([#1951](https://github.com/getpaseo/paseo/pull/1951)): Settings kebab → Remove для custom entries; capability `providerRemoval`; builtins non-removable; snapshot marks `builtin` | `custom`.
- **Usage bar tones** ([#2322](https://github.com/getpaseo/paseo/pull/2322)): shared `toneFromUsedPct` — `ok` / `warning` (>70%) / `danger` (>90%) для Claude, Kimi, Codex windows вместо always-green `ok`.
- Mobile model selection ([#2361](https://github.com/getpaseo/paseo/pull/2361)), iPad selector popovers ([#2360](https://github.com/getpaseo/paseo/pull/2360)), focus mode confined to active workspace ([#2151](https://github.com/getpaseo/paseo/pull/2151)), desktop installs newest available update ([#2149](https://github.com/getpaseo/paseo/pull/2149)), remote daemon update failures with recovery steps ([#2120](https://github.com/getpaseo/paseo/pull/2120)).

## Fixes (выборочно)

Из большого Fixed-блока релиза практичные:

- failed agent starts больше не оставляют provider processes ([#2348](https://github.com/getpaseo/paseo/pull/2348));
- reused branches не прикрепляют unrelated merged/closed PR ([#2172](https://github.com/getpaseo/paseo/pull/2172)) — terminal PR/MR match only by exact HEAD SHA;
- notifications open correct workspace+agent ([#2331](https://github.com/getpaseo/paseo/pull/2331));
- CLI agent runs stay in current workspace unless new workspace requested ([#2315](https://github.com/getpaseo/paseo/pull/2315));
- Pi compaction waits for long summaries instead of false timeout ([#2181](https://github.com/getpaseo/paseo/pull/2181));
- browser typing/shortcuts больше не submit'ят active Paseo prompt ([#1982](https://github.com/getpaseo/paseo/pull/1982));
- terminal panes resize after focus/visibility changes ([#2059](https://github.com/getpaseo/paseo/pull/2059), [#2154](https://github.com/getpaseo/paseo/pull/2154)).

## Кому обновляться

| Сценарий                                  | Что даёт 0.2.0                                    |
| ----------------------------------------- | ------------------------------------------------- |
| GitLab / Gitea / Forgejo / Codeberg teams | PR/MR panel, merge, attachments, checkout-from-MR |
| Web-only Paseo usage                      | in-app file edit + autosave/conflict handling     |
| OMP users                                 | native provider вместо generic ACP path           |
| Desktop review flow                       | Changes tab, commit history, add-to-chat          |
| Operators with fixed port ranges          | `servicePorts.range` / `portScript`               |
| Automation on CLI/MCP                     | workspace-first commands, heartbeats, agent open  |

Установка/upgrade — как обычно с [paseo.sh](https://paseo.sh) / GitHub Release assets. После апгрейда: authenticate `glab`/`tea` для non-GitHub forges, при необходимости enable OMP provider, и пересмотрите `paseo.json`/`config.json` на `servicePorts`, если ephemeral ports не подходят окружению.

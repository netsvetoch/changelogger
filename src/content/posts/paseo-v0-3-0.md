---
author: Артём Нецветаев
pubDatetime: 2026-08-14T22:42:04.000Z
title: "Paseo 0.3.0: native mobile terminal, sidebar redesign, History search и Command Center"
slug: paseo-v0-3-0
featured: false
draft: false
tags:
  - release
  - paseo
  - ai-agents
  - mobile
  - desktop
  - git
description: "Разбор Paseo v0.3.0: native mobile terminal с selection/copy/paste, redesigned sidebar + host identity, daemon History search, Command Center git/agent controls, mid-run fork, HTML preview, orchestration skills picker, ACP Auto Accept, custom direct-connection headers."
---

[Paseo](https://github.com/getpaseo/paseo) выпустил минорный релиз [`v0.3.0`](https://github.com/getpaseo/paseo/releases/tag/v0.3.0) (8 августа 2026). Это плотный product-релиз вокруг mobile terminal, sidebar/host identity, History search, Command Center и agent runtime: терминал на телефоне стал usable для interactive work, collapsed projects показывают urgent status, History ищет по всей истории на daemon, а Command Center дорастает до git/workspace actions и live agent controls (thinking/mode/plan/fast).

Основа статьи — GitHub Release [`v0.3.0`](https://github.com/getpaseo/paseo/releases/tag/v0.3.0), compare [`v0.2.0...v0.3.0`](https://github.com/getpaseo/paseo/compare/v0.2.0...v0.3.0) (253 commits, ~300 files) и исходные PR: [#1607](https://github.com/getpaseo/paseo/pull/1607)/[#2830](https://github.com/getpaseo/paseo/pull/2830), [#2340](https://github.com/getpaseo/paseo/pull/2340)/[#2790](https://github.com/getpaseo/paseo/pull/2790)/[#2335](https://github.com/getpaseo/paseo/pull/2335), [#2995](https://github.com/getpaseo/paseo/pull/2995), [#2749](https://github.com/getpaseo/paseo/pull/2749)/[#2274](https://github.com/getpaseo/paseo/pull/2274), [#2638](https://github.com/getpaseo/paseo/pull/2638), [#2941](https://github.com/getpaseo/paseo/pull/2941), [#2792](https://github.com/getpaseo/paseo/pull/2792), [#2712](https://github.com/getpaseo/paseo/pull/2712), [#2933](https://github.com/getpaseo/paseo/pull/2933), [#2680](https://github.com/getpaseo/paseo/pull/2680), [#2752](https://github.com/getpaseo/paseo/pull/2752), [#2922](https://github.com/getpaseo/paseo/pull/2922), [#2328](https://github.com/getpaseo/paseo/pull/2328).

## Native mobile terminal: selection, copy, paste, resize ownership

До 0.3.0 mobile terminal упирался в WebView input/selection boundaries. [PR #1607](https://github.com/getpaseo/paseo/pull/1607) (follow-up [#2830](https://github.com/getpaseo/paseo/pull/2830) для Android keyboard stability) вводит **native renderer** на том же headless terminal parser, что и daemon: React Native рисует только visible rows, без WebView как primary surface.

Что появляется на mobile:

- software и hardware keyboard input без browser text surface;
- scrollback, long-press word selection, draggable handles, exact copy, clear selection, bracketed paste;
- frame-coalesced parsing и paint только viewport;
- snapshot restore без blanking/discard scrolled state;
- Diagnostics fallback: legacy WebView renderer остаётся per-device switch на два beta-цикла dogfooding; mounts ровно один renderer.

Daemon-side capabilities (optional, compatibility-gated):

| Capability                   | Поведение                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `terminal-input-mode-replay` | при attach daemon replay'ит active terminal input modes (bracketed paste, application-cursor); иначе reconnect mid-mode портит input                   |
| `terminal-size-ownership`    | PTY size — last-explicit-client-wins: focus/interaction шлёт `claim`, geometry changes — owner-only `update`; passive measurements ownership не крадут |

Legacy resize messages остаются claims. Browser/Electron renderer не заменяется. [#2830](https://github.com/getpaseo/paseo/pull/2830) отдельно делает keyboard activation idempotent на Android: tap по already-focused terminal и virtual Enter больше не cycle'ят Gboard, repeated identical clipboard commits принимаются.

Связанный mobile UX: paste images from clipboard ([#2793](https://github.com/getpaseo/paseo/pull/2793)).

## Sidebar redesign: status colours, project badge, host identity

Несколько PR превращают sidebar из «списка имён» в scannable ops surface.

**Collapsed project status badge** ([#2340](https://github.com/getpaseo/paseo/pull/2340)): когда project свёрнут, на icon появляется corner badge с самым urgent hidden workspace status. Один shell (14pt circle + 1pt sidebar-colored ring, offset −7/−7), меняется только glyph. Priority rollup:

```text
needs_input > failed > running > attention > done
```

Expanded project badge не показывает — status едет на individual workspace rows. `done` / no active work → badge отсутствует.

**Readable workspace rows + host identity** ([#2790](https://github.com/getpaseo/paseo/pull/2790)):

- synchronized amber pulsing dots для working workspace/project states; needs-input / failure / idle остаются distinct;
- compact rows: PR, host, title и hover-only diff metadata на stable rails;
- client-local **host name**, **identity color** и sidebar badge display settings с live preview;
- default desktop-local host badge скрыт, multi-host sidebar сохраняет per-host behavior;
- web-only cursor-anchored workspace/project context menus делят action definitions с kebab.

**Project icons** ([#2335](https://github.com/getpaseo/paseo/pull/2335), [#2416](https://github.com/getpaseo/paseo/pull/2416)): host-local custom image icons (upload bytes или client-side URL import → validated payload; limits: image type, square, max **1024 px**, **512 KB**); automatic icons остаются default. Status-grouped rows показывают icon перед project name. Storage — host-local, вне repository files. Settings → host → Projects.

**Worktree hover labels** ([#2711](https://github.com/getpaseo/paseo/pull/2711)): Paseo-owned worktree hover card показывает directory name (managed worktree slug от daemon), external worktrees — shortened full path; Copy path по-прежнему копирует complete workspace directory.

Release notes также фиксируют настройку того, что показывает sidebar workspace row: host, pull request, checks, scripts.

## History search: daemon-side, typo-tolerant, ranked

[PR #2995](https://github.com/getpaseo/paseo/pull/2995) закрывает #1680: History перестаёт быть «scroll date groups and eyeball rows».

- search field на filter rail рядом с host picker;
- search **на daemon** по всей persisted history, не client filter по loaded pages (pagesize 200 делал client-side «no matches» ложным);
- ranked, typo-tolerant match по **workspace title, agent title, branch, project name**;
- matched characters marked в row;
- «All hosts» ranks every host together; host picker narrows; failed/offline hosts named, чтобы incomplete list не читался как empty;
- shared matcher переехал в `packages/protocol/src/search/text-match.ts` (бывший app `score-match.ts`); fuzziness opt-in — pickers остаются exact narrowing.

Wire contract (additive):

- request: optional `search`;
- response: optional `searchTruncated`; entries: optional `searchScore` / `searchMatches`;
- feature gate: `server_info.features.agentHistorySearch` — старый daemon просто не показывает search field;
- searched response = **one ranked page, no cursor**; `hasMore: false`, truncation на своём field; cursor+search → hard `invalid_cursor`.

Non-goals явно: transcript full-text search, query tokens вроде `branch:foo`, paging past top 200 of a ranked set.

## Command Center: git/workspace actions + agent controls

Два PR расширяют Command Center после model switch из 0.2.0.

**Stable, workspace-aware palette** ([#2749](https://github.com/getpaseo/paseo/pull/2749)):

- first result fully visible on open/search/keyboard nav; scroll immediate и только чтобы reveal clipped active row;
- unfiltered workspace/agent categories limited to **five**, full coverage under search;
- focused default action set; Home и Add project searchable;
- в workspace: New agent + product-selected primary Git action by default;
- terminal, browser, split-pane и secondary Git actions searchable, где capability уже есть.

**Thinking / mode / plan / fast** ([#2274](https://github.com/getpaseo/paseo/pull/2274), follow-up к [#2147](https://github.com/getpaseo/paseo/pull/2147)):

| Control  | Поведение                                                                                |
| -------- | ---------------------------------------------------------------------------------------- |
| Thinking | reasoning-effort options                                                                 |
| Mode     | provider non-planning permission modes                                                   |
| Plan     | On/Off; `plan_mode` feature precedence; permission-mode planning excluded from Mode list |
| Fast     | On/Off; только когда available `fast_mode`                                               |

Все query-only contributions: default Actions/Workspaces/Agents palette не меняется. Labels `Setting › Value`; select current value = no-op. Работает для running agents и draft tabs.

## Mid-run agent fork

[PR #2638](https://github.com/getpaseo/paseo/pull/2638): fork раньше жил только в footer completed assistant turn. Пока `agentStatus === "running"`, `resolveAuxiliaryTurnFooter` возвращал `null` — fork button исчезал на всём run.

Теперь in-flight turn footer показывает fork рядом с progress loader / Stop. Targets:

- **Fork in a new tab**
- **Fork in a new workspace**

In-flight fork handler не требует boundary: `selectForkContextRows` проецирует entire timeline, когда boundary fields не заданы. Можно branch off mid-stream, не дожидаясь idle и не охотясь за старым turn footer.

## New Workspace → terminal launch

[PR #2941](https://github.com/getpaseo/paseo/pull/2941): New Workspace раньше стартовал только chat agent. Empty workspace существовал через empty composer submit (не advertised); terminal с этого screen запустить было нельзя.

Появляется launch chip на meta row: **Chat** vs **terminal profile**. Choice запоминается. Prompt передаётся в terminal profile, который его accepts; profile без prompt — visibly launch-only, не silently swallows typed text. Terminal profile не путается с chat agent того же имени. Generated workspace title/branch seed'ятся из typed content. Практический path: workspace, который сразу гоняет `claude` / `codex` / `opencode` / `pi` / plain shell в TTY, а не через Paseo chat.

## Chat outline: jump between prompts

[PR #2792](https://github.com/getpaseo/paseo/pull/2792) (closes #1395): quiet prompt index на left edge wide web/desktop chat panels.

- one outline marker per user prompt из daemon-owned complete prompt index;
- jumps: loaded / virtualized / unloaded / upward / downward с top inset и bottom clamping;
- fetched history pages retained in client timeline state — revisits не бьют daemon снова, live tail сохраняется;
- DOM windowing остаётся у existing virtualizer.

## HTML file preview

[PR #2712](https://github.com/getpaseo/paseo/pull/2712): `.html` / `.htm` в file pane получают тот же **Preview / Source** segmented control, что Markdown.

- landing state = Preview; Source = existing CodeMirror editor;
- `filePreviewRenderKind(path)` заменяет boolean `isRenderedMarkdownFile` — один decision point для renderable kinds;
- reuse keys `panels.file.editor.preview` / `.source`, без new copy/component.

Полезно, когда agent пишет self-contained HTML plan (diagrams, decision tables) — читать page, а не markup, в том числе с телефона.

## Claude workflows in the subagent track

[PR #2933](https://github.com/getpaseo/paseo/pull/2933): provider-owned workflow runs нормализуются в ordinary provider-subagent rows.

- row label `Workflow`, primary name = provider summary;
- live completion / failure / cancellation / usage / timeline через existing primitives;
- persisted nonterminal summary after runtime death → **failed**, never permanently-running resurrection;
- storage/protocol/UI остаются provider-agnostic: normalization на producer boundary declared/progress/terminal task protocol.

## Orchestration skills: choose what installs

[PR #2680](https://github.com/getpaseo/paseo/pull/2680): Settings → Integrations → **Orchestration skills** → **Choose skills** sheet.

Selection model:

```ts
type SkillSelection = { mode: "all" } | { mode: "custom"; skills: string[] };
```

- **All skills** читает bundle directory, не hardcoded name list — skill, добавленный в будущем release, ставится сам;
- Save converges `~/.agents`, `~/.claude`, `~/.codex`: chosen install/update, deselected remove;
- skills, которые вы добавили сами, не трогаются;
- remove deletes skill directory во всех трёх homes, включая local edits inside — Save confirms first;
- snapshot state: `not-installed` | `up-to-date` | `drift`; ops `add` / `update` / `delete`.

## ACP Auto Accept

[PR #2752](https://github.com/getpaseo/paseo/pull/2752): shared opt-in **Auto Accept** на каждом ACP provider, даже если у implementation нет native permission-bypass mode.

- feature toggle id: `auto_accept` (`type: "toggle"`, label «Auto Accept»);
- enabled → Paseo selects first allow option from ACP provider и **не** публикует permission card;
- no allow option → ordinary interactive flow;
- unattended agents enable Auto Accept unless explicitly disabled;
- docs: `docs/custom-providers.md`.

Это client-boundary solution: один path для Cursor ACP и остальных ACP implementations, без per-provider forks.

## Custom HTTP headers on direct connections

[PR #2922](https://github.com/getpaseo/paseo/pull/2922): Direct connection → Advanced → editable custom header name/value rows.

| Surface              | Behavior                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------- |
| iOS / native         | headers on WebSocket handshake                                                            |
| Electron desktop     | direct WS routed through main process Node transport (`WebSocketTransportTarget.headers`) |
| Ordinary browser web | controls **hidden** — browser WebSocket API cannot set arbitrary handshake headers        |

Validation: missing name, invalid name, invalid line break in value, duplicate names. Password auth precedence over custom `Authorization` header. Use case: direct endpoints behind gateways, needing tenant/routing/proxy headers.

## Worktree base: local branch vs origin counterpart

[PR #2328](https://github.com/getpaseo/paseo/pull/2328) (closes #2327): при создании worktree можно выбрать base как local branch (`main`) или origin counterpart (`origin/main`), с hints о divergence. Related improvement: new worktrees start from tracked upstream branch ([#2848](https://github.com/getpaseo/paseo/pull/2848)).

## Korean locale

[PR #2895](https://github.com/getpaseo/paseo/pull/2895): Paseo UI доступен на корейском (`README.ko.md` + i18n resources).

## Runtime / git / subagent improvements (выборка)

Не «улучшили производительность», а конкретные deltas:

| Change                                   | PR                                                                                                                                                             | Concrete effect                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Client provider cache                    | release notes                                                                                                                                                  | faster startup без повторного cold fetch catalog        |
| Recent chats live in background          | [#2842](https://github.com/getpaseo/paseo/pull/2842)                                                                                                           | switch back → current messages immediately              |
| Large-repo Git status                    | [#2979](https://github.com/getpaseo/paseo/pull/2979), [#2797](https://github.com/getpaseo/paseo/pull/2797)                                                     | responsive status, fewer git processes on busy machines |
| Partial assistant copy keeps formatting  | [#2808](https://github.com/getpaseo/paseo/pull/2808)/[#2930](https://github.com/getpaseo/paseo/pull/2930)/[#2935](https://github.com/getpaseo/paseo/pull/2935) | lists/links/formatting survive partial selection        |
| Native Claude subagent full conversation | [#2498](https://github.com/getpaseo/paseo/pull/2498)/[#2760](https://github.com/getpaseo/paseo/pull/2760)                                                      | full transcript, not truncated summary-only             |
| OpenCode subagent metadata               | [#2909](https://github.com/getpaseo/paseo/pull/2909)                                                                                                           | task, type, model, token usage                          |
| Pi delegated task lifecycle              | [#2891](https://github.com/getpaseo/paseo/pull/2891)                                                                                                           | lifecycle status visible                                |
| Claude model/thinking memory             | [#2912](https://github.com/getpaseo/paseo/pull/2912)                                                                                                           | new workspaces remember choices                         |
| OMP live context usage                   | [#2503](https://github.com/getpaseo/paseo/pull/2503)                                                                                                           | updates while turn running                              |
| OpenCode busy status                     | [#2696](https://github.com/getpaseo/paseo/pull/2696)                                                                                                           | background activity from provider-owned busy            |
| Desktop browser tab state                | [#2907](https://github.com/getpaseo/paseo/pull/2907)                                                                                                           | survives focus changes and automation                   |
| Relay access opt-in on pair              | [#2706](https://github.com/getpaseo/paseo/pull/2706)                                                                                                           | pairing no longer implies relay                         |
| Reconnect copy                           | [#2931](https://github.com/getpaseo/paseo/pull/2931)                                                                                                           | daemon restart vs network interruption distinguished    |
| Nix desktop                              | [#2550](https://github.com/getpaseo/paseo/pull/2550)/[#2506](https://github.com/getpaseo/paseo/pull/2506)/[#2556](https://github.com/getpaseo/paseo/pull/2556) | smaller package, correct icons, macOS flake build       |

## Notable fixes

- Pi **0.84** agents больше не crash-loop on every prompt ([#2978](https://github.com/getpaseo/paseo/pull/2978));
- workspace file watching больше не stalls the daemon ([#2858](https://github.com/getpaseo/paseo/pull/2858));
- messages не duplicate/out-of-order after reconnect/resume ([#2789](https://github.com/getpaseo/paseo/pull/2789), [#2718](https://github.com/getpaseo/paseo/pull/2718));
- git status/diffs pick up nested folder changes on every desktop OS ([#2775](https://github.com/getpaseo/paseo/pull/2775));
- Claude runtime failures report error instead of idle workspace ([#2910](https://github.com/getpaseo/paseo/pull/2910)); Claude replay не leaves stale running subagents ([#2876](https://github.com/getpaseo/paseo/pull/2876));
- Fast toggle appears for Claude Opus 5 ([#2939](https://github.com/getpaseo/paseo/pull/2939));
- agent stops with error when provider process exits ([#2757](https://github.com/getpaseo/paseo/pull/2757)); cancelling OpenCode turn no longer breaks the next ([#2662](https://github.com/getpaseo/paseo/pull/2662));
- ACP permission prompts no longer disappear mid-turn ([#2762](https://github.com/getpaseo/paseo/pull/2762)); workspace not idle while native subagents run ([#2777](https://github.com/getpaseo/paseo/pull/2777));
- terminal activity stops after interrupted turn ([#2942](https://github.com/getpaseo/paseo/pull/2942)); Windows deferred startup failures handled without crash;
- recreated folders no longer incorrectly archived ([#2987](https://github.com/getpaseo/paseo/pull/2987)); restoring merged workspace no longer inactive ([#2714](https://github.com/getpaseo/paseo/pull/2714));
- mobile: swipe/drag sidebar ([#2709](https://github.com/getpaseo/paseo/pull/2709)), dictated prompts no longer vanish on submit ([#2745](https://github.com/getpaseo/paseo/pull/2745)), composer above Android keyboard, IME composed text preserved;
- NixOS service agents no longer run in production mode ([#2697](https://github.com/getpaseo/paseo/pull/2697)).

## Кому обновляться

- **Mobile users / terminal-in-TTY workflow** — native terminal + New Workspace terminal launch;
- **multi-host / multi-project sidebars** — status badge, host colors/names, project icons;
- **long history** — daemon History search вместо scroll-and-eyeball;
- **Command Center power users** — git/workspace actions + thinking/mode/plan/fast без composer chrome;
- **long agent runs** — mid-run fork, chat outline jumps;
- **ACP providers without native yolo mode** — shared Auto Accept;
- **direct hosts behind gateways** — custom headers (native/Electron);
- **desktop skill hygiene** — choose which orchestration skills land in `~/.agents` / `~/.claude` / `~/.codex`.

Upgrade path: GitHub Release [`v0.3.0`](https://github.com/getpaseo/paseo/releases/tag/v0.3.0). Capability gates (`agentHistorySearch`, terminal input-mode replay / size ownership, ACP `auto_accept`) держат mixed-version clients/daemons: старый peer просто не видит field/control, а не ломает session parse.

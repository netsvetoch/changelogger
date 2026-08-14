---
author: Артём Нецветаев
pubDatetime: 2026-08-14T22:26:16.000Z
title: "Paseo 0.4.0: agent profiles, @getpaseo/client SDK и удаление paseo chat/loop"
slug: paseo-v0-4-0
featured: false
draft: false
tags:
  - release
  - paseo
  - ai-agents
  - typescript
  - sdk
  - cli
description: "Разбор Paseo v0.4.0: host-wide agent profiles вместо model favourites, supported @getpaseo/client, Cmd/Ctrl+P file search, live task progress, Mermaid в chat/preview, CLI provider diagnostic и workspace rename, breaking removal of paseo chat/loop."
---

[Paseo](https://github.com/getpaseo/paseo) выпустил минорный релиз [`v0.4.0`](https://github.com/getpaseo/paseo/releases/tag/v0.4.0) (13 августа 2026). Это плотный product/API-релиз: reusable agent profiles на хосте, публичный TypeScript SDK `@getpaseo/client`, file search в Command Center, live task progress, interactive Mermaid, новые CLI-команды — и breaking removal поверхностей `paseo chat` / `paseo loop` перед миграцией storage.

Основа статьи — GitHub Release [`v0.4.0`](https://github.com/getpaseo/paseo/releases/tag/v0.4.0), compare [`v0.3.0...v0.4.0`](https://github.com/getpaseo/paseo/compare/v0.3.0...v0.4.0) (106 commits, ~300 files) и исходные PR: [#3053](https://github.com/getpaseo/paseo/pull/3053), [#3208](https://github.com/getpaseo/paseo/pull/3208), [#3141](https://github.com/getpaseo/paseo/pull/3141), [#3059](https://github.com/getpaseo/paseo/pull/3059), [#3227](https://github.com/getpaseo/paseo/pull/3227), [#3215](https://github.com/getpaseo/paseo/pull/3215), [#2306](https://github.com/getpaseo/paseo/pull/2306), [#3027](https://github.com/getpaseo/paseo/pull/3027), [#3243](https://github.com/getpaseo/paseo/pull/3243), [#3209](https://github.com/getpaseo/paseo/pull/3209).

## Breaking: убраны `paseo chat` и `paseo loop`

[PR #3053](https://github.com/getpaseo/paseo/pull/3053) — первый шаг утверждённого плана миграции persistence на SQLite. Chat rooms и worker/verifier loops **не переносятся** в следующий backend: их удаляют end-to-end, чтобы последующий swap storage затрагивал только активные stores.

Что уходит из продукта:

- CLI: группы `paseo chat …` (`ls/create/inspect/post/read/wait/delete`) и `paseo loop …` (`run/ls/inspect/logs/stop`);
- daemon/server: `server/chat/`, `server/loop-service.ts`, записи `$PASEO_HOME/chat/rooms.json` и `$PASEO_HOME/loops/loops.json`;
- bundled skill `/paseo-loop` (aka Ralph loops) из README и skill-набора;
- docs/architecture/data-model references на rooms и loops.

Что **не** ломается осознанно:

- обычный agent conversation UI, chat outlines, focused chat targets, schedules и heartbeats остаются;
- legacy WebSocket schemas chat/loop остаются в protocol union под dated `COMPAT` tags: mixed-version peers ещё могут **парсить** старые сообщения, но новый daemon **больше не реализует** эти feature RPCs;
- provider-session и workspace-shaped storage переведены с `AgentStorage.list()` scans на named queries — подготовка к SQL, без смены backend в этом PR.

Если у вас были автоматизации на `paseo chat` / `paseo loop` или skill `/paseo-loop`, их нужно переписать на schedules, heartbeats, обычных agents и/или SDK до или сразу после апгрейда на 0.4.0.

## Agent profiles: reusable host-wide конфигурации

Раньше model favourites умели только pin пары provider/model и жили **per device**. [PR #3208](https://github.com/getpaseo/paseo/pull/3208) заменяет их host-wide **agent profiles**.

Профиль — именованный bundle:

- provider + model;
- mode, thinking, feature values;
- notes (текст для людей и orchestrating agents);
- Lucide icon + color identity из host palette.

Поведение:

- Settings → Host → Agents — CRUD профилей с concrete provider selection;
- picker показывает profiles на root и внутри provider; empty state — one-row creation;
- выбор профиля **materialize** значения в существующие composer controls через ordered apply RPC `agent.config.apply`: model → mode → thinking → features;
- apply **non-transactional**: rejected step останавливает последующие, уже применённые шаги остаются видны в streamed agent state;
- **нет** selected-profile state, default profile, dirty/drift tracking и profile name в composer trigger — профиль одноразово разворачивается в controls;
- нет system prompt field (running agents не могут безопасно его обновлять);
- `create_agent` **не** принимает profile parameter: orchestrating agents читают MCP tool `list_profiles` (read-only notes + configuration) и копируют значения сами;
- для running agents provider switching запрещён — несовместимые profiles в picker недоступны;
- legacy device-local model favourites мигрируют в host profiles один раз, когда connected daemon advertise capabilities `server_info.features.agentProfiles` и `.agentConfigApply`.

Дополнительно picker получил cross-provider model search без resize desktop popover и без mounting полного catalog.

## Supported TypeScript SDK: `@getpaseo/client`

[PR #3141](https://github.com/getpaseo/paseo/pull/3141) публикует high-level API из package root как **supported** surface. Раньше README прямо писал, что package public «so Paseo's published packages can depend on it», но «not a stable public SDK yet». В 0.4.0 контракт другой: root exports — supported SDK; `@getpaseo/client/internal/*` — unsupported implementation detail.

Установка и минимальный flow:

```bash
npm install @getpaseo/client
```

```ts
import { createPaseoClient } from "@getpaseo/client";

const client = createPaseoClient({ url: "ws://127.0.0.1:6767/ws" });
await client.connect();

const agent = await client.agents.create({
  config: { provider: "codex/gpt-5.5" },
  cwd: "/Users/me/dev/storefront",
  prompt: "Review the current diff and name the riskiest change.",
});

const result = await agent.waitForFinish();
console.log(result.status, result.lastMessage);

await client.close();
```

Ключевые контракты:

| API                                                                | Поведение                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `createPaseoClient({ url, password?, … })`                         | WebSocket URL обязан заканчиваться на `/ws`                                          |
| `client.agents.create({ config, cwd?, prompt?, title?, labels? })` | `provider` в форме `provider/model`; `prompt` вместо старого `initialPrompt`         |
| `agent.waitForFinish(ms?)`                                         | default **10 minutes** (`DEFAULT_WAIT_FOR_FINISH_MS`); timeout **не** отменяет agent |
| `agent.run(prompt)` / `agent.send(prompt)`                         | wait-for-outcome vs fire-and-forget                                                  |
| `client.agents.ref(id)`                                            | local handle без RPC; дальше `refresh()` / `run()`                                   |
| `client.agents.list({ filter: { labels } })`                       | daemon-side label matching                                                           |
| `client.workspaces.open(path)`                                     | reuse active workspace for exact directory                                           |
| `client.workspaces.create({ source, title })`                      | always new workspace; `source.kind: "directory" \| "worktree"`                       |
| `workspace.agents.create(…)`                                       | placement + cwd берутся из workspace handle                                          |
| `client.providers.waitForReady({ cwd })`                           | вместо bare `snapshot` для ready model selection                                     |

`waitForFinish()` статусы: `idle` | `permission` | `error` | `timeout`. Permission означает, что человеку нужно ответить в UI Paseo; timeout оставляет agent running на daemon.

Документация: [paseo.sh/docs/sdk](https://paseo.sh/docs/sdk) (quickstart, agents, workspaces, providers, events, recipes, API reference). Runnable examples в `packages/client/examples/` — issue→agent, parallel review, workspaces, events.

Новые optional daemon fields (`cwd` в provider snapshot, capability flags в server info) старые клиенты игнорируют; новый client на старом daemon отклоняет `waitForReady()` с update-host error, если snapshot identity неоднозначен.

## Command Center: workspace file search на Cmd/Ctrl+P

[PR #3059](https://github.com/getpaseo/paseo/pull/3059) подключает workspace-aware fuzzy file search к существующему Command Center.

- **Cmd/Ctrl+P** (rebindable) открывает palette со scoped **Files** pill;
- Backspace на пустом query или click по pill снимает scope;
- unscoped search тоже включает file matches после sync command/workspace/agent results;
- row: material icon + filename + path (одна truncating line);
- select открывает файл через established workspace file-tab path;
- desktop results viewport fixed height — async file loading не resize-ит palette (layout shift ≤ 0.001 в e2e).

Non-goals: content search внутри файлов, смена daemon protocol, замена Files/Changes explorer.

## Files / Changes: file manager context actions

[PR #3027](https://github.com/getpaseo/paseo/pull/3027) выравнивает Files и Changes на shared context actions:

- create, rename, duplicate, delete;
- recursively collapse folders;
- copy paths, reveal in desktop file manager;
- discard Git changes (path-scoped, с confirmation).

Tracked renames идут через `git mv`, untracked — filesystem ops; duplicate получает collision-free names. Новые RPCs capability-gated: старые app/daemon остаются совместимы.

## Live task progress над composer и в timeline

Agents уже публиковали structured task progress, но UI либо хоронил его в provider bookkeeping, либо показывал только historical snapshots. [PR #3227](https://github.com/getpaseo/paseo/pull/3227) (closes #3221) делает current tasks **reducer-owned state**:

- над composer — completed/total и current task (например `2/2 tasks`);
- timeline — semantic actions: grouped creation, added / started / completed / reopened;
- raw task bookkeeping calls **скрыты** из user-facing timeline;
- genuine Plan approval cards остаются отдельным product concept (не смешиваются с task progress);
- task state восстанавливается из authoritative timeline data, без scan stream во время React render.

Non-goals: edit/reorder/dismiss/complete tasks из Paseo UI и cross-agent task dashboard. Optional fields на timeline items backward-compatible.

## Metadata generation model из Settings

Paseo генерирует workspace titles, branch names, commit messages и PR drafts. Раньше ordered provider list для этого правился только в daemon config. [PR #3215](https://github.com/getpaseo/paseo/pull/3215) добавляет **Settings → Host → Metadata**:

- **Automatic** — Paseo picks a fast available model;
- **Manual** — model picker; выбранная модель становится **первой** записью `agents.metadataGeneration.providers`, остальные configured entries и built-in fallbacks сохраняются.

Полный custom fallback order по-прежнему в `~/.paseo/config.json`:

```json
{
  "agents": {
    "metadataGeneration": {
      "providers": [
        { "provider": "claude", "model": "claude-haiku-4-5" },
        { "provider": "codex", "model": "gpt-5.5" }
      ]
    }
  }
}
```

После прямой правки файла нужен restart daemon. UI editor полного fallback-list и per-project model selection — non-goals.

## Interactive Mermaid в chat и Markdown preview

[PR #2306](https://github.com/getpaseo/paseo/pull/2306) (closes #458, #1166) рендерит fenced ` ```mermaid ` блоки как диаграммы — и в assistant chat, и в `.md` file preview (shared markdown renderer).

- **Web/desktop**: lazy `import("mermaid")` split chunk (zero startup cost); pan drag, ctrl/cmd+wheel или pinch zoom about cursor (mouse notch = 1.25×), double-click reset; SVG cache cap 50;
- **iOS/Android**: self-contained WebView bundle (+~3.4 MB, без CDN), inline touch-shielded preview, tap → fullscreen viewer с platform pinch-zoom;
- source toggle: diagram ↔ highlighted source;
- streaming: broken mid-stream source → code block; last good SVG hold while newer chunks parse; single-flight queue с stale-task skip (mermaid mutate global state);
- security: reject resource-bearing source (`img:`/`icon:`, `url()`, `@import`, `themeCSS`, HTML кроме `<br>`, entity smuggling) **до** render; `securityLevel: "strict"`, `htmlLabels` off, extended `secure` list против `%%{init}%%` theme/CSS override. Exfiltration URL не уходит в network (проверено Playwright request log).

Raw `.mmd` files остаются source-only. Protocol/daemon changes нет.

## CLI: provider diagnostic и workspace rename

### `paseo provider diagnostic`

[PR #3243](https://github.com/getpaseo/paseo/pull/3243) — thin read-only adapter над существующим daemon RPC:

```bash
paseo provider diagnostic claude
paseo provider diagnostic codex --json
paseo provider diagnostic opencode --host devbox:6767
```

Human output включает provider identity, daemon `PATH`/shell, resolved path, version, model count, status — тот же diagnostic, что **Settings → Host → Providers → provider → Diagnostic**. Параллельно skill `paseo-help` учит support-агентов ходить в [paseo.sh/llms.txt](https://paseo.sh/llms.txt) и сначала устанавливать topology daemon (desktop-managed / standalone / Docker / local / remote).

### `paseo workspace rename`

[PR #3209](https://github.com/getpaseo/paseo/pull/3209):

```bash
paseo workspace rename <workspace-id> "Auth rework"
paseo workspace rename <workspace-id> --reset   # branch/directory-derived name
paseo workspace rename <workspace-id> "Auth rework" --json
```

`--reset` нельзя комбинировать с title. Unquoted multi-word title отклоняется (`allowExcessArguments(false)`), чтобы Commander не молча отрезал слова после первого. Канонический набор workspace CLI теперь: `create/ls/rename/archive`.

## UX и runtime improvements

| Изменение                                                      | PR                                                   | Суть                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Centered Markdown reading layout + formatted YAML front matter | [#3240](https://github.com/getpaseo/paseo/pull/3240) | preview ближе к doc-reader, front matter не сырой dump |
| Command Center sidebar grouping                                | [#3063](https://github.com/getpaseo/paseo/pull/3063) | группировка команд в sidebar                           |
| Theme shortcuts для всех built-in themes                       | [#3214](https://github.com/getpaseo/paseo/pull/3214) | hotkeys покрывают полный набор тем                     |
| No periodic Git polling for idle workspaces                    | [#3323](https://github.com/getpaseo/paseo/pull/3323) | idle workspaces не жгут polling                        |
| Provider catalog refresh deadline 2 min (configurable)         | [#3322](https://github.com/getpaseo/paseo/pull/3322) | catalog refresh больше не висит бесконечно             |

## Fixes, которые стоит знать

Релиз закрывает длинный хвост host/workspace/provider багов; наиболее практичные:

- terminal sessions больше не теряются после host sleep / daemon worker stalls ([#3235](https://github.com/getpaseo/paseo/pull/3235), [#3263](https://github.com/getpaseo/paseo/pull/3263));
- daemon hang на archive workspace ([#3107](https://github.com/getpaseo/paseo/pull/3107));
- Android: New Workspace crash при multi-host projects ([#3241](https://github.com/getpaseo/paseo/pull/3241)), provider cache exhaust local storage ([#3234](https://github.com/getpaseo/paseo/pull/3234));
- new workspaces не reuse existing worktree ([#3224](https://github.com/getpaseo/paseo/pull/3224)); new worktrees уважают setup command из Project Settings ([#3233](https://github.com/getpaseo/paseo/pull/3233)) и не становятся dirty из-за другого `paseo.json` на base ([#3311](https://github.com/getpaseo/paseo/pull/3311));
- removed hosts перестают получать push ([#3176](https://github.com/getpaseo/paseo/pull/3176)); delegated-agent notifications не обрываются после permission/workspace close ([#3177](https://github.com/getpaseo/paseo/pull/3177), [#3192](https://github.com/getpaseo/paseo/pull/3192));
- OMP agent startup при model catalogs > protocol-v1 frame limit ([#3184](https://github.com/getpaseo/paseo/pull/3184));
- OpenCode models снова могут вернуться к default variant ([#3281](https://github.com/getpaseo/paseo/pull/3281));
- Codex: completed subagents не остаются active ([#3188](https://github.com/getpaseo/paseo/pull/3188)), compaction не оставляет turns в working ([#3211](https://github.com/getpaseo/paseo/pull/3211));
- Cursor usage с актуальными Cursor logins ([#2704](https://github.com/getpaseo/paseo/pull/2704));
- Claude agents не ждут десять минут на Paseo MCP timeout ([#3315](https://github.com/getpaseo/paseo/pull/3315));
- profiles с modes, неподдерживаемыми selected provider, больше не ломают agent creation ([#3331](https://github.com/getpaseo/paseo/pull/3331));
- Copy resume command для Hermes agents ([#3300](https://github.com/getpaseo/paseo/pull/3300)).

Полный список — в [release notes](https://github.com/getpaseo/paseo/releases/tag/v0.4.0).

## Кому обновляться в первую очередь

1. **Интеграторы и automation** — можно опираться на supported `@getpaseo/client` и documented recipes вместо internal daemon client.
2. **Пользователи с повторяемыми agent setups** — host-wide profiles + `list_profiles` MCP вместо device-local favourites.
3. **Те, у кого scripts на `paseo chat` / `paseo loop`** — migration обязательна: команды удалены.
4. **CLI ops** — `provider diagnostic` и `workspace rename` закрывают ручные JSON-правки и «почему provider not found на remote host».
5. **Mobile/desktop daily drivers** — task progress, Mermaid, file actions, sleep/terminal и worktree fixes заметно чинят повседневный friction.

## Ссылки

- Release: [v0.4.0](https://github.com/getpaseo/paseo/releases/tag/v0.4.0)
- Compare: [v0.3.0...v0.4.0](https://github.com/getpaseo/paseo/compare/v0.3.0...v0.4.0)
- SDK docs: [paseo.sh/docs/sdk](https://paseo.sh/docs/sdk)
- CLI docs: [paseo.sh/docs/cli](https://paseo.sh/docs/cli)
- Metadata generation: [paseo.sh/docs/metadata-generation](https://paseo.sh/docs/metadata-generation)

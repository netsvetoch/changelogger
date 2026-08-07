---
author: Артём Нецветаев
pubDatetime: 2026-08-07T02:42:25.000Z
title: "OpenAI Codex rust-v0.147.0: Agent Plugins search, секции тредов и --approve-for-me"
slug: openai-codex-rust-v0-147-0
featured: false
draft: false
tags:
  - release
  - codex
  - openai
  - cli
  - app-server
  - plugins
  - mcp
description: "Разбор OpenAI Codex rust-v0.147.0: portable Agent Plugins и plugin/search, thread sections вместо isPinned, CLI --approve-for-me, import Cursor skills, MCP 2026-07-28, Bedrock web search/compaction и удаление codex exec --full-auto."
---

OpenAI выпустила [`rust-v0.147.0`](https://github.com/openai/codex/releases/tag/rust-v0.147.0) — minor-релиз Codex с упором на portable Agent Plugins, организацию длинных разговоров, автоматический review approvals и opt-in MCP protocol `2026-07-28`. Параллельно ужесточены trust/auth-границы, redaction секретов и runtime isolation плагинов.

Ниже — разбор GitHub Release, диапазона [`rust-v0.146.0...rust-v0.147.0`](https://github.com/openai/codex/compare/rust-v0.146.0...rust-v0.147.0) и связанных PR: [`#36544`](https://github.com/openai/codex/pull/36544), [`#36409`](https://github.com/openai/codex/pull/36409), [`#36919`](https://github.com/openai/codex/pull/36919), [`#35722`](https://github.com/openai/codex/pull/35722), [`#36007`](https://github.com/openai/codex/pull/36007), [`#36380`](https://github.com/openai/codex/pull/36380), [`#36373`](https://github.com/openai/codex/pull/36373), [`#36361`](https://github.com/openai/codex/pull/36361), [`#36356`](https://github.com/openai/codex/pull/36356), [`#35724`](https://github.com/openai/codex/pull/35724), [`#35725`](https://github.com/openai/codex/pull/35725), [`#36938`](https://github.com/openai/codex/pull/36938), [`#36981`](https://github.com/openai/codex/pull/36981), [`#36054`](https://github.com/openai/codex/pull/36054).

## Portable Agent Plugins: install path и `plugin/search`

В `0.146.0` Codex уже распознавал root `plugin.json` схемы Agent Plugins 1.0. В `0.147.0` PR [`#36544`](https://github.com/openai/codex/pull/36544) проводит этот формат через discovery, packing и installation:

- valid root Agent Plugin manifest обрабатывается отдельно от legacy path;
- допускаются безопасные dotted plugin names;
- отсутствующая version по умолчанию становится `1.0.0`, а directory-safe version выводится без переписывания portable manifest;
- для Agent Plugins пропускается legacy command migration;
- при копировании источников отклоняются symlink и другие unsupported file types.

Для MCP внутри таких плагинов PR [`#36796`](https://github.com/openai/codex/pull/36796) добавляет `parse_agent_plugin_mcp_config`: Agent Plugins v1 `mcp.json` переводится в Codex MCP config. Нормализуются `stdio` и streamable HTTP, раскрываются `PLUGIN_ROOT` / `PLUGIN_DATA`, пути удерживаются внутри plugin root, client-owned HTTP headers фильтруются, а ошибки парсинга возвращаются per-server — валидные соседние servers не отбрасываются из-за одного битого.

Ранее `plugin/search` отвечал `method_not_found`. PR [`#36409`](https://github.com/openai/codex/pull/36409) реализует поиск через remote plugin service **без catalog cache**:

- scopes: global, workspace, personal;
- page size по умолчанию `16`, upper bound `1_000`, cursors проходят passthrough;
- feature gates для remote plugins / plugin sharing учитываются;
- search terms и pagination tokens не попадают в transport errors и telemetry;
- результаты отдаются как uninstalled plugin summaries.

PR [`#36919`](https://github.com/openai/codex/pull/36919) дополняет первую remote-страницу до 100 ranked local matches из configured/repository marketplaces (по `cwds` запроса). Local match идёт по name/display name/keywords без case/punctuation sensitivity; remote global catalog авторитетнее local curated marketplace; при API-key auth и при выключенном `remote_plugin` local search остаётся доступен. В search results поле `enabled` всегда `false`: discovery ≠ activation.

Runtime isolation для Agent Plugins ужесточён в PR [`#37027`](https://github.com/openai/codex/pull/37027): только direct-child skills, без app/hook capabilities, изолированные MCP data, отказ от MCP config вне plugin root, bounds на model-visible instructions/schemas/tools и запрет MCP/OAuth redirects при configured/authorization headers.

## Thread sections вместо `isPinned`

В прошлом minor pin был boolean metadata. `0.147.0` заменяет его persistent sections.

PR [`#35722`](https://github.com/openai/codex/pull/35722):

- `isPinned` уходит из thread metadata/filters;
- появляется optional `section` / `sectionId`;
- добавляется пагинированный app-server method `threadSection/list` (секции видны даже без тредов);
- seed-ится стабильная секция `Pinned`;
- `thread/list` фильтрует по конкретной секции или по unsectioned (`sectionId: null`).

PR [`#36380`](https://github.com/openai/codex/pull/36380) добавляет CRUD:

- `threadSection/create`
- `threadSection/update`
- `threadSection/delete`

Секции живут в SQLite со stable UUIDv7 id; display name trim/validate; built-in `Pinned` нельзя переименовать или удалить. Удаление секции transactional: active/archived threads возвращаются в unsectioned list.

Ручной порядок — PR [`#36007`](https://github.com/openai/codex/pull/36007):

- `thread/section/move` атомарно кладёт тред в секцию, переставляет внутри неё или выносит наружу;
- insert before existing member или append;
- move внутри секции сохраняет `sectionEnteredAt`;
- `thread/list` получает sort key `section_position` (ascending по умолчанию);
- membership больше **не** меняется через `thread/metadata/update`.

```json
{
  "method": "threadSection/create",
  "id": 1,
  "params": { "name": "Инциденты" }
}
```

```json
{
  "method": "thread/section/move",
  "id": 2,
  "params": {
    "threadId": "thr_123",
    "sectionId": "sec_pinned_or_custom",
    "beforeThreadId": null
  }
}
```

```json
{
  "method": "thread/list",
  "id": 3,
  "params": {
    "sectionId": "sec_abc",
    "sortKey": "section_position"
  }
}
```

Для длинных transcript TUI больше не обязан грузить всю историю resume/fork. PR [`#36948`](https://github.com/openai/codex/pull/36948) / [`#36950`](https://github.com/openai/codex/pull/36950) гидратируют bounded initial page с учётом terminal reflow budget, догружают older items при scroll up / `Home`, показывают loading/partial/retry/complete overlay и fallback-ят на legacy history, если app-server не поддерживает pagination.

## CLI: `--approve-for-me` и удаление `--full-auto`

PR [`#36373`](https://github.com/openai/codex/pull/36373) добавляет shared flag:

```bash
codex --approve-for-me
codex exec --approve-for-me "summarize the diff"
# alias:
codex --not-so-yolo
```

Эффект подтверждён в shared options и exec tests:

- `approvals_reviewer="auto_review"`
- `approval_policy="on-request"`
- `sandbox_mode="workspace-write"`

Флаг проходит через root / `exec` / `resume` / `fork`, конфликтует с явным `--sandbox ...` и `--dangerously-bypass-approvals-and-sandbox`, а также с `--approval-policy` в interactive path. Поздние subcommand permission overrides сохраняются.

Breaking chore: PR [`#36054`](https://github.com/openai/codex/pull/36054) **полностью** убирает deprecated `codex exec --full-auto`. Раньше hidden flag ещё принимался и печатал warning; теперь callers должны явно писать:

```bash
# было
codex exec --full-auto "..."

# стало
codex exec --sandbox workspace-write "..."
```

## Import Cursor skills и sync внешних сессий

PR [`#36361`](https://github.com/openai/codex/pull/36361) расширяет Cursor migration:

- home scope: `skills` **и** `skills-cursor` (Cursor-managed);
- repository scope остаётся только `skills`;
- имена skills дедуплицируются при кандидатах из нескольких source dirs.

PR [`#35623`](https://github.com/openai/codex/pull/35623) разделяет parsers Claude и Cursor: у Cursor wrappers вроде `<cursor_commands>` / `<timestamp>` перед `<user_query>` больше не попадают в imported message и generated title.

PR [`#36356`](https://github.com/openai/codex/pull/36356) синхронизирует уже импортированные Claude/Cursor sessions без дублей: changed source session мапится на unique imported thread, дописывается только missing transcript suffix, ledger обновляется после verify. Если target active/archived/ambiguous/diverged — update defer-ится, а не создаёт второй thread.

## MCP `2026-07-28` opt-in и non-blocking startup

По умолчанию lifecycle остаётся legacy. Feature `Mcp20260728` переводит `protocol_mode` в `V20260728` (PR [`#35724`](https://github.com/openai/codex/pull/35724)):

- streamable HTTP negotiates modern discovery через `server/discover` с bounded responses, redirect protection и fallback только когда endpoint явно legacy-only;
- stdio servers opt-in через `CODEX_MCP_PROTOCOL_VERSION=2026-07-28`;
- modern mode потребляет paginated tool/resource/resource-template catalogs и rejects repeated cursors.

PR [`#35725`](https://github.com/openai/codex/pull/35725) закрывает multi-round client path: `tools/call` и `resources/read` проходят через `input_required`, сохраняя opaque request state и elicitation metadata на JSON/SSE/stdio. На modern protocol действует 8 MiB response limit.

Чтобы optional MCP не тормозил первый model turn, PR [`#35590`](https://github.com/openai/codex/pull/35590) публикует cached tools ещё до startup (со сброшенным stale read-only hint), а реальный tool call ждёт live binding. PR [`#35742`](https://github.com/openai/codex/pull/35742) даёт optional servers shared 1s startup grace, затем опускает still-pending servers из captured catalog — кроме случаев, когда turn явно требует server через plugin, skill dependency или `mcp://` mention.

Вместе с этим chores поднимают MCP SDK / rmcp до `3.0.0`, Ratatui до `0.30.2`, rusty_v8 до `150.4.0`.

## Amazon Bedrock: cached web search и remote compaction

PR [`#36938`](https://github.com/openai/codex/pull/36938): Bedrock advertises hosted text web search, но external live/indexed access unsupported. Live/indexed modes резолвятся в cached search (или tool disable, если managed requirements запрещают cached). Catalogs нормализуются в text-only payloads; multimodal `search_content_types` на Bedrock не уходит.

PR [`#36981`](https://github.com/openai/codex/pull/36981): provider-owned remote compaction. Bedrock помечен как v1-only и ходит в `/v1/responses/compact` даже при включённом v2 feature; OpenAI/Azure Responses сохраняют v2, unsupported providers — local compaction.

## Trust, auth, secrets и platform fixes

Несколько security/hardening изменений важны при обновлении:

- PR [`#36960`](https://github.com/openai/codex/pull/36960): TUI onboarding больше не auto-trust-ит local projects с unset trust. Нужен explicit trust (или quit); trust пишется на Git root при старте из subdirectory и config reload-ится до продолжения. Remote workspaces и projects с явным trust level prompt пропускают.
- PR [`#37132`](https://github.com/openai/codex/pull/37132): local `requirements.toml` allowlists для login methods и ChatGPT workspaces применяются **до** credential hydration/network. Cloud-provided requirements эти fields игнорируют; intersection с managed workspace allowlists fail-closed, если usable login method не остаётся.
- PR [`#36893`](https://github.com/openai/codex/pull/36893) / [`#36908`](https://github.com/openai/codex/pull/36908): secrets и complete bearer tokens redacted в displayed commands / replayed history; approval requests продолжают опираться на original executable command.
- PR [`#36037`](https://github.com/openai/codex/pull/36037): если allow amendment network policy fails — network access deny, а не silent open.

Из platform/TUI fixes release notes: preserve input при return of focus / MCP startup / Ghostty key handling; Japanese halfwidth sound marks, emoji, hyperlinks и viewport cursor positioning; Windows interrupt non-TTY processes и ASCII-case-insensitive path URI compares; stop publishing redundant Linux bundle archives — использовать `codex-package-<target>`.

## Итоги для обновления

1. **App-server UI тредов.** Переходите с `isPinned` на `section` / `sectionId`, `threadSection/*` и `thread/section/move`. Membership через `thread/metadata/update` больше не живёт; sort по `section_position` — отдельный путь для ordered section views.
2. **Плагины.** Portable Agent Plugins теперь end-to-end installable; `plugin/search` реален и смешивает remote+local. Не считайте search result `enabled: true`. Для Agent Plugins учитывайте no-symlink install, isolated MCP data и redirect restrictions.
3. **CLI automation.** Замените `codex exec --full-auto` на `--sandbox workspace-write`. Для auto-reviewed approvals используйте `--approve-for-me` / `--not-so-yolo` вместо самодельной тройки config overrides — но не комбинируйте его с bypass/sandbox flags.
4. **MCP.** Modern protocol — feature opt-in; stdio servers должны выставлять `CODEX_MCP_PROTOCOL_VERSION=2026-07-28`. Не рассчитывайте, что optional MCP startup заблокирует первый turn: cached tools могут появиться раньше live binding.
5. **Bedrock.** Ожидайте cached text web search и v1 remote compaction endpoint, а не full multimodal/live search или v2 compact path.
6. **Security UX.** Local project trust теперь explicit; managed auth restrictions режут credentials раньше, чем они уйдут в network.

Если интегрируете app-server или пишете marketplace plugins, `0.147.0` — релиз, где стоит обновить protocol bindings и migration scripts до того, как пользователи начнут опираться на sections и portable plugin install path.

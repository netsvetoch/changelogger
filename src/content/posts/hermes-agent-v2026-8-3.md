---
author: Артём Нецветаев
pubDatetime: 2026-08-03T17:07:02.000Z
title: "Hermes Agent 0.20.0: Herald — голос, A2A, webhooks и grounded research"
slug: hermes-agent-v2026-8-3
featured: false
draft: false
tags:
  - release
  - hermes-agent
  - ai-agents
  - cli
  - desktop
  - voice
  - automation
description: "Технический разбор Hermes Agent 0.20.0 (v2026.8.3): streaming TTS с barge-in и on-device wake words, A2A v1.0, signed outbound webhooks, grounded-citations, CLI !/init/diff/context/focus, tool self-recovery 90→500 и desktop artifacts/plugin SDK."
---

[`Hermes Agent`](https://github.com/NousResearch/hermes-agent) выпустил минорный релиз [`v2026.8.3`](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.3), соответствующий версии `0.20.0` и названный **The Herald Release**. По данным GitHub Release, с `v0.19.0` в окно вошли ~3 650 коммитов, ~1 400 смёрженных PR, ~5 200 затронутых файлов, ~1 200 закрытых issues и 650+ contributors. Релиз также документирует инфраструктурный patch-tag `v0.19.1`.

Источники: [GitHub Release](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.3), [compare `v2026.7.20...v2026.8.3`](https://github.com/NousResearch/hermes-agent/compare/v2026.7.20...v2026.8.3) и PR: [#69511](https://github.com/NousResearch/hermes-agent/pull/69511), [#70509](https://github.com/NousResearch/hermes-agent/pull/70509), [#71698](https://github.com/NousResearch/hermes-agent/pull/71698), [#69406](https://github.com/NousResearch/hermes-agent/pull/69406), [#77109](https://github.com/NousResearch/hermes-agent/pull/77109), [#72257](https://github.com/NousResearch/hermes-agent/pull/72257), [#72178](https://github.com/NousResearch/hermes-agent/pull/72178), [#72240](https://github.com/NousResearch/hermes-agent/pull/72240), [#72242](https://github.com/NousResearch/hermes-agent/pull/72242), [#72302](https://github.com/NousResearch/hermes-agent/pull/72302), [#72190](https://github.com/NousResearch/hermes-agent/pull/72190), [#72345](https://github.com/NousResearch/hermes-agent/pull/72345), [#61173](https://github.com/NousResearch/hermes-agent/pull/61173), [#77041](https://github.com/NousResearch/hermes-agent/pull/77041), [#72176](https://github.com/NousResearch/hermes-agent/pull/72176), [#70254](https://github.com/NousResearch/hermes-agent/pull/70254), [#76032](https://github.com/NousResearch/hermes-agent/pull/76032), [#71637](https://github.com/NousResearch/hermes-agent/pull/71637).

## Streaming voice: clause-by-clause TTS и barge-in

Раньше voice mode почти везде был batch-only: модель заканчивала весь ответ, полный текст уходил в TTS, возвращался один большой audio file, и только потом начиналось воспроизведение — на длинных репликах это давало десятки секунд «мёртвого» воздуха. [#69511](https://github.com/NousResearch/hermes-agent/pull/69511) вводит provider-agnostic streaming core в `tools/tts_streaming.py`:

- `StreamingTTSProvider` ABC + registry + `resolve_streaming_provider()`;
- ElevenLabs (`pcm_24000`) и OpenAI (`response_format=pcm`) стримят chunked PCM;
- остальные провайдеры сохраняют свой голос и получают per-sentence sync synthesis — silent swap провайдера нет;
- LLM deltas буферизуются, режутся на sentence boundaries, каждое предложение сразу уходит в TTS, один audio clock стыкует куски без щелчков.

Можно прервать речь голосом или вводом. Модель получает сигнал, что пользователь перебил ответ ([#69602](https://github.com/NousResearch/hermes-agent/pull/69602)). Full-duplex listener работает и во время generation, и во время playback ([#74223](https://github.com/NousResearch/hermes-agent/pull/74223)); busy-aware silence detection не даёт агенту говорить поверх пользователя ([#74000](https://github.com/NousResearch/hermes-agent/pull/74000)). Позже [#77355](https://github.com/NousResearch/hermes-agent/pull/77355) пипелайнит синтез следующего предложения, пока играет текущее.

Голосовые заметки принимаются на WhatsApp, Feishu, DingTalk, LINE, QQ, Photon и Weixin; auto-TTS отдаётся platform-aware (включая opus там, где платформа его ждёт). STT стал отдельной категорией в `hermes tools` с GUI/dashboard контролами; глобальный `stt.language` по умолчанию `en`, language resolution унифицирован, добавлен OpenAI `gpt-transcribe`. Единый spoken-text preprocessor чистит markdown, code и URL перед речью для всех TTS-провайдеров.

## On-device wake words и multi-profile routing

[#70509](https://github.com/NousResearch/hermes-agent/pull/70509) добавляет opt-in wake-word detection на CLI, TUI и desktop — **без отправки audio наружу**, пока фраза не распознана.

- Default engine — bundled openWakeWord (`tools/wakewords/`), фраза вроде «hey Hermes», без downloads и ключей; feature off by default.
- Open vocabulary: `provider: sherpa` (sherpa-onnx keyword spotting, ~13 MB one-time fetch) — любая настроенная `phrase` без training.
- Porcupine остаётся третьим engine при `PORCUPINE_ACCESS_KEY`.
- Multi-profile routing: sherpa-listener регистрирует каждый профиль с `wake_word.enabled: true` (phrase по умолчанию `hey <profile>`); desktop live-switch-ит профиль, открывает session и включает voice. CLI/TUI печатают hint `hermes -p <profile>`. Отключение: `wake_word.profile_routing: false`.
- Управление: desktop ear-button; CLI/TUI — `/wake on|off|status`; gateway RPC `wake.start/stop/pause/resume/status` и event `wake.detected`.
- Single-owner mic lease: sticky first-claimant + cross-process lock, чтобы concurrent surfaces не дрались за микрофон.
- «stop» hands-free завершает voice chat на всех поверхностях ([#73933](https://github.com/NousResearch/hermes-agent/pull/73933)).

Поведенческие knobs — в `config.yaml`; из env только credential Porcupine.

## Grounded citations: ledger, а не «звучит правдоподобно»

Skill `grounded-citations` ([#71698](https://github.com/NousResearch/hermes-agent/pull/71698), fact-check mode в [#77104](https://github.com/NousResearch/hermes-agent/pull/77104)) делает citations **проверяемыми**: id и URL приходят из retrieval ledger, а не из памяти модели.

Ledger: `$HERMES_HOME/cache/citations/ledger.json` (profile-aware). Скрипт `skills/research/grounded-citations/scripts/sources.py` — stdlib-only:

```bash
S=~/.hermes/skills/research/grounded-citations/scripts/sources.py

python3 "$S" reset
python3 "$S" add https://example.com/a --title "A"   # → [1]
python3 "$S" add https://example.com/b --title "B"   # → [2]
python3 "$S" list
python3 "$S" render                                  # Sources: block
python3 "$S" verify draft.md
```

`add` идемпотентен и URL-normalized; lockfile `O_EXCL` защищает parallel subagents. В fact-check mode verbatim quotes отклоняются, если строки нет в fetched page text; claims из «знаний модели» помечаются `[unverified]`; `verify --evidence` валит draft без evidence у cited sources. Работает с `web_search` / `web_extract` / browser / curl / local PDFs — не только с web toolset.

## Outbound webhooks: push lifecycle events с HMAC

До этого интеграция означала polling или inbound platform. [#69406](https://github.com/NousResearch/hermes-agent/pull/69406) добавляет `agent/outbound_webhooks.py`: notify-only callbacks на существующем plugin hook bus — dead endpoint **не** может stall tool call.

```yaml
hooks:
  outbound:
    - name: ci-notify
      url: https://ci.example.com/hermes-events
      events: [on_session_end, subagent_stop]
      secret_env: HERMES_OUTBOUND_WEBHOOK_SECRET
      timeout: 10

    - name: tool-monitor
      url: https://metrics.example.com/hooks/hermes
      events: [post_tool_call]
      matcher: "terminal|delegate_task"
```

Любой `VALID_HOOKS` event валиден (`on_session_start/end`, `pre/post_tool_call`, `subagent_stop`, …). Delivery: bounded queue + daemon worker; retries на conn/5xx один раз с backoff, 4xx не ретраятся; queue-full drop с warning; 3xx **не** follow (urllib иначе превратил бы signed POST в body-less GET). `HERMES_SAFE_MODE=1` пропускает registration. `hermes hooks list` показывает url/events/matcher/timeout и `signed`/`UNSIGNED`.

Wire shape зеркалит shell-hooks stdin JSON плюс `delivery_id` + `timestamp`. Headers:

| Header                   | Value                                              |
| ------------------------ | -------------------------------------------------- |
| `Content-Type`           | `application/json`                                 |
| `X-Hermes-Event`         | имя hook event                                     |
| `X-Hermes-Delivery`      | = `delivery_id` в body                             |
| `X-Hermes-Signature-256` | `sha256=<hex>` HMAC-SHA256 raw body (GitHub-style) |

```python
import hashlib, hmac

def verify(body: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)
```

Предпочтителен `secret_env` над inline `secret`. Receiver-side dedupe — по `delivery_id`; freshness — по signed `timestamp`. Callbacks всегда return `None`: outbound targets не блокируют tools и не inject-ят context.

## A2A v1.0: стандартный wire protocol для multi-agent

[#77109](https://github.com/NousResearch/hermes-agent/pull/77109) закрывает issue #514 bundled plugin-ом `plugins/platforms/a2a/` — **zero core edits**, conformance с A2A protocol v1.0, stdlib-only (без runtime dependency на `a2a-sdk`).

```yaml
gateway:
  platforms:
    a2a:
      enabled: true
      extra:
        port: 9900

a2a_agents:
  researcher:
    url: "http://localhost:9999"
    auth: { type: bearer, token: "sk-..." }
    timeout: 120
    capabilities: [web_search, research]
```

Outbound toolset (off by default): `a2a_discover`, `a2a_call`, `a2a_list`, `a2a_history`, `a2a_orchestrate` (fan-out по capability: `all` / `first` / `best`).

Inbound: Agent Card на `/.well-known/agent-card.json` (legacy `agent.json` сохранён), JSON-RPC `message/send`, `message/stream` (SSE), `tasks/*`, push-notification CRUD. Tasks входят в **live gateway session**. Security by default: без token bind только `127.0.0.1`; per-peer bearer (`A2A_PEER_TOKENS`); prompt-injection filter на inbound; outbound credential scrub; SSRF-guarded HMAC push (`X-A2A-Signature`); audit `~/.hermes/a2a_audit.jsonl`; anti-pingpong `A2A_MAX_PINGPONG_TURNS` (default 5, max 20).

## CLI power-user wave

| Команда                                  | Что делает                                                                                                       | Где                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `!command`                               | shell **без** model turn и **без** записи в history; тот же approval gate, что у terminal tool                   | CLI only ([#72257](https://github.com/NousResearch/hermes-agent/pull/72257))                |
| `/init [notes]`                          | scan проекта → generate/merge-update `AGENTS.md` как normal user turn (cache-safe)                               | CLI/gateway/TUI/desktop ([#72178](https://github.com/NousResearch/hermes-agent/pull/72178)) |
| `/diff` / `staged` / `all` / `session`   | working tree; session = files, которые трогал сам Hermes (checkpoint manager)                                    | cross-surface ([#72240](https://github.com/NousResearch/hermes-agent/pull/72240))           |
| `/context` / `/context all`              | render уже существующего `compute_session_context_breakdown()`; all — per-skill/toolset costs                    | CLI + gateway ([#72242](https://github.com/NousResearch/hermes-agent/pull/72242))           |
| `/focus on\|off\|status`                 | display-only: prompt + final reply; `⋯ N tool lines hidden`; status-bar indicator; model messages byte-identical | CLI + TUI ([#72302](https://github.com/NousResearch/hermes-agent/pull/72302))               |
| Ctrl+S                                   | stash half-written prompt                                                                                        | CLI                                                                                         |
| `hermes import-agent claude-code\|codex` | миграция setup (не API keys)                                                                                     | CLI ([#72190](https://github.com/NousResearch/hermes-agent/pull/72190))                     |

`hermes import-agent` mapping:

| Source                           | Destination                             |
| -------------------------------- | --------------------------------------- |
| global `CLAUDE.md` / `AGENTS.md` | context file under `HERMES_HOME`        |
| `permissions.allow`              | merge в `command_allowlist`             |
| MCP servers                      | Hermes MCP config                       |
| `skills/` с `SKILL.md`           | `HERMES_HOME/skills/`                   |
| Codex `memories/*.md`            | Hermes memory entries                   |
| API keys / auth                  | **никогда** — pointer на `hermes setup` |

Есть `--dry-run`. Mid-turn **redirects** ([#63104](https://github.com/NousResearch/hermes-agent/pull/63104)): correction во время работы не требует `/stop` — in-flight work и original prompt сохраняются, агент course-correct-ит.

## Tools that fix themselves + iteration budget 90 → 500

Self-recovery wave убирает «угадай, что сломалось» из tool loop:

- **terminal** ([#77041](https://github.com/NousResearch/hermes-agent/pull/77041)): при overflow full stream spill-ится в `~/.hermes/cache/terminal-output/`; result несёт `output_total_chars`, `full_output_path` и note читать spill через `search_files`/`read_file`, а не re-run. Hard cap 5 MB, cleanup 7 days.
- **patch** ([#76998](https://github.com/NousResearch/hermes-agent/pull/76998)): already-applied → success no-op; whitespace mismatch визуализируется; ambiguous matches перечисляются.
- **write_file** ([#77055](https://github.com/NousResearch/hermes-agent/pull/77055)): verify on-disk content после записи.
- **search** ([#77011](https://github.com/NousResearch/hermes-agent/pull/77011)): zero-match probes + multi-path recovery; auto-multiline для newline patterns.
- `read_file` default limit **500 → 2000** lines ([#77102](https://github.com/NousResearch/hermes-agent/pull/77102)).

Default tool-calling iteration limit: **90 → 500** ([#72176](https://github.com/NousResearch/hermes-agent/pull/72176)) — `AIAgent.max_iterations`, `agent.max_turns` в `DEFAULT_CONFIG`, CLI/gateway/cron/TUI fallbacks. Background-agent fallback 25 намеренно не трогали. Override по-прежнему через config / `--max-turns`.

## Compression: proactive prune, N-user tail, ghost skills

На 512K/1M окнах ratio-threshold ~0.50 почти не срабатывал, и старые tool dumps пересчитывались каждый turn. [#70254](https://github.com/NousResearch/hermes-agent/pull/70254) выносит Phase-1 prune на отдельный low trigger (default **off**):

```yaml
compression:
  proactive_prune_tokens: 0 # 0 = off. На 512K/1M попробуйте 48000
  proactive_prune_min_result_chars: 8000 # floor summarize pass (clamped ≥ 200)
  proactive_prune_min_reclaim_tokens: 4096 # commit только если reclaim ≥ этого
```

Gate `proactive_prune_min_reclaim_tokens` (default 4096) делает prune episodic: ниже порога input object возвращается unchanged → prompt cache intact. Также в релизе: per-turn micro-compaction; `compression.min_tail_user_messages` (гарантированный хвост user messages); `compression.threshold_tokens`; ghost-skill defense через markers `[SKILL_PRUNED]` ([#70275](https://github.com/NousResearch/hermes-agent/pull/70275)); progress-aware summarizer timeouts; ContextEngine ABC получает `select_context()` + `on_turn_complete()`.

## Desktop → platform: artifacts, plugin SDK, quick entry

**Artifacts** ([#72345](https://github.com/NousResearch/hermes-agent/pull/72345)): HTML documents, standalone SVG ≥ 2k chars и code fences ≥ 48 lines / 3k chars уходят из transcript в versioned card + right-rail viewer с sandboxed live preview и preview/source toggle. Detection в `lib/artifact-detect.ts`; registry с content-hash dedupe в `store/artifacts.ts` (localStorage, per-session/per-artifact caps). Мелкий prose/markdown/mermaid не промотируется.

**Plugin SDK** с founding plugin **Kanban** ([#61173](https://github.com/NousResearch/hermes-agent/pull/61173)): `defaultEnabled: false`, только `@hermes/plugin-sdk` + React, REST/socket через `ctx.*`, `ctx.download` для файлов пользователю. Widget-app SDK (state+reducer+render), floating panes, multiple GUI windows, global-hotkey quick-entry ([#72315](https://github.com/NousResearch/hermes-agent/pull/72315)), SSH remote-backend mode ([#68130](https://github.com/NousResearch/hermes-agent/pull/68130)).

60fps wave 2: streaming cost independent of transcript length; drag at 60fps с five streaming tabs; idle CPU near zero в background; shiki/mermaid off cold boot path.

## Performance и runtime

- Native Anthropic prompt caching теперь кэширует **tool schemas** без history loss ([#76032](https://github.com/NousResearch/hermes-agent/pull/76032)): cache plan = static-system-prefix + tools[-1] + last-2 completed-transaction endpoints. OpenRouter / third-party Anthropic-wire / chat_completions layout не меняется.
- `hermes -w` cold start ~**14 s → ~1.8 s** ([#71637](https://github.com/NousResearch/hermes-agent/pull/71637)): `_prune_stale_worktrees` распараллелен и закэширован — раньше git cherry probe на десятках worktrees съедал 90% startup.
- Readonly config loader, убиты per-turn deepcopies (telemetry gate ~54×), lazy heavy-SDK imports.
- Runtime: **Node 26** required; brew + pip/PyPI wheel channels retired — supported: shell installer / Docker / Nix ([#76459](https://github.com/NousResearch/hermes-agent/pull/76459)).

## Approvals, gateway, skills

- `hermes approvals suggest` строит allowlist proposals из history; operator-customizable `approvals.smart_policy`; consecutive-denial circuit breaker; approval gate на docker/podman daemon-redirect ([#72259](https://github.com/NousResearch/hermes-agent/pull/72259), [#71092](https://github.com/NousResearch/hermes-agent/pull/71092)).
- Gateway: Buzz (Block/Nostr) с native WebSocket + NIP-42; Relay phases 1–4 (media, interactive prompts, thread lifecycle, typing); HSP personal + org skill sync; Vercel AI Gateway + Vercel Sandbox terminal backend modernized; MCP lazy server startup from fingerprint-keyed on-disk tool-schema cache ([#77511](https://github.com/NousResearch/hermes-agent/pull/77511)).
- Office skills bundled (`docx`, `xlsx`, `pdf` + refreshed powerpoint); часть heavy skills ушла в optional-skills; iron-proxy egress firewall re-landed; DNS-pinned SSRF-safe fetches.

## Кому что смотреть первым

- **Голос/hands-free** — streaming TTS + `/wake` + platform voice notes.
- **Интеграции и multi-agent** — `hooks.outbound` и A2A plugin.
- **Research/writing** — `grounded-citations` + `verify`.
- **Daily CLI** — `!`, `/init`, `/diff`, `/context`, `/focus`, redirects, `hermes import-agent`.
- **Длинные autonomous runs** — max iterations 500, terminal spill, patch no-op, proactive prune knobs.
- **Desktop workbench** — artifacts, Kanban plugin SDK, quick-entry, SSH remote backend.

Полный список contributors и сотен fix PR — в [release body](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.3).

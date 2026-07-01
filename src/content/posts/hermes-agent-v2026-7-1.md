---
author: Артём Нецветаев
pubDatetime: 2026-07-01T20:51:15.000Z
title: "Hermes Agent 0.18.0: MoA как модель, доказуемое done и production gateway"
slug: hermes-agent-v2026-7-1
featured: false
draft: false
tags:
  - release
  - hermes-agent
  - ai-agents
  - desktop
  - automation
description: "Обзор минорного релиза Hermes Agent 0.18.0: Mixture-of-Agents как виртуальный provider, evidence-based /goal, /learn и /journey, фоновые fan-out subagents, Projects в desktop, scale-to-zero gateway, Vertex AI и security hardening."
---

[`Hermes Agent`](https://github.com/NousResearch/hermes-agent) выпустил минорный релиз [`v2026.7.1`](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.7.1), соответствующий версии `0.18.0`. Релиз называется «The Judgment Release» и закрывает окно изменений после `v0.17.0`: в GitHub Release указаны примерно 1 720 коммитов, 998 смёрженных PR, 2 215 изменённых файлов и 949 закрытых issues.

Источник для обзора — GitHub Release [`NousResearch/hermes-agent@v2026.7.1`](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.7.1), compare [`v2026.6.19...v2026.7.1`](https://github.com/NousResearch/hermes-agent/compare/v2026.6.19...v2026.7.1) и связанные PR, в том числе [#46081](https://github.com/NousResearch/hermes-agent/pull/46081), [#53561](https://github.com/NousResearch/hermes-agent/pull/53561), [#53793](https://github.com/NousResearch/hermes-agent/pull/53793), [#53855](https://github.com/NousResearch/hermes-agent/pull/53855), [#55625](https://github.com/NousResearch/hermes-agent/pull/55625), [#50501](https://github.com/NousResearch/hermes-agent/pull/50501), [#52285](https://github.com/NousResearch/hermes-agent/pull/52285), [#51506](https://github.com/NousResearch/hermes-agent/pull/51506), [#55555](https://github.com/NousResearch/hermes-agent/pull/55555), [#49734](https://github.com/NousResearch/hermes-agent/pull/49734), [#49037](https://github.com/NousResearch/hermes-agent/pull/49037), [#52243](https://github.com/NousResearch/hermes-agent/pull/52243), [#52937](https://github.com/NousResearch/hermes-agent/pull/52937), [#56363](https://github.com/NousResearch/hermes-agent/pull/56363), [#50476](https://github.com/NousResearch/hermes-agent/pull/50476), [#56196](https://github.com/NousResearch/hermes-agent/pull/56196), [#54166](https://github.com/NousResearch/hermes-agent/pull/54166) и [#56227](https://github.com/NousResearch/hermes-agent/pull/56227).

Отдельная headline-часть релиза — закрытие всех P0/P1. В release notes зафиксировано: 3 P0 issues и 493 P1 issues закрыты, 8 P0 PR и 188 P1 PR смёржены; открытый счётчик P0/P1 на момент sweep дошёл до нуля. Ниже — техническая часть: что именно поменялось для пользователей и операторов.

## Mixture-of-Agents теперь выбирается как обычная модель

Главное архитектурное изменение MoA — это не новый slash command, а перенос в модельную систему. В [#46081](https://github.com/NousResearch/hermes-agent/pull/46081) старый `mixture_of_agents` tool и `moa` toolset удалены из registry/setup/tool config, а вместо них появился виртуальный provider `moa`. Каждый именованный preset из `moa.presets` отображается как модель в provider row `Mixture of Agents`.

Практический эффект: preset вроде `review` или `my-council` выбирается там же, где Claude, GPT или Grok. Runtime-конфигурация выглядит как обычная пара provider/model:

```yaml
model:
  provider: moa
  model: review

moa:
  default_preset: review
  presets:
    review:
      enabled: true
      aggregator:
        provider: openrouter
        model: anthropic/claude-opus-4.8
      reference_models:
        - provider: openai-codex
          model: gpt-5.5
        - provider: openrouter
          model: deepseek/deepseek-v4-pro
      max_tokens: 4096
```

Внутри Hermes сначала вызывает reference models без tool schemas, добавляет их ответы как private context, а затем передаёт обычные сообщения и полный tool schema aggregator-модели. Aggregator становится «acting model»: именно он пишет финальный ответ или вызывает инструменты. В PR это покрыто тестами на `provider=moa`, передачу tools aggregator-у и mixed-provider preset.

[#53561](https://github.com/NousResearch/hermes-agent/pull/53561) довёл это до gateway picker: `/model` в Telegram/Discord теперь вызывает `list_picker_providers(include_moa=True)`, поэтому MoA-presets видны не только в CLI/dashboard/desktop, но и в messaging surfaces.

## MoA больше не выглядит как долгая пауза

До этого пользователь мог включить MoA и ждать, пока невидимый «совет моделей» закончит работу. В `0.18.0` процесс стал наблюдаемым.

[#53793](https://github.com/NousResearch/hermes-agent/pull/53793) добавил в `agent/moa_loop.py` события `moa.reference` и `moa.aggregating`: каждый reference model отдаёт labelled block с `index`, `count`, `label` и текстом ответа. CLI рендерит это как thinking-style блок до ответа aggregator-а. В том же PR добавлен turn-scoped reference cache: если tool loop делает несколько итераций в рамках одного user turn, identical advisory view не заставляет reference-модели заново спамить те же блоки.

[#53855](https://github.com/NousResearch/hermes-agent/pull/53855) подключил тот же seam к TUI и desktop: `tui_gateway/server.py` пересылает `moa.reference` / `moa.aggregating`, Ink-клиент записывает reference как committed thinking segment, а desktop `use-message-stream` добавляет labelled reasoning chunk.

Наконец, [#55625](https://github.com/NousResearch/hermes-agent/pull/55625) включил streaming для aggregator-а. `MoAChatCompletions.create(stream=True)` сначала собирает references, а затем возвращает raw token stream aggregator-модели; `conversation_loop` больше не отключает stream только потому, что provider равен `moa`. Поэтому длинный MoA-ответ теперь начинает печататься по мере генерации, а не появляется целиком после тишины.

Для отладки есть и более тяжёлый режим: [#56101](https://github.com/NousResearch/hermes-agent/pull/56101) добавил `moa.save_traces`. При включении каждый MoA-turn пишет JSONL в `<hermes_home>/moa-traces/<session_id>.jsonl`: входы/выходы reference-моделей, usage/cost, вход aggregator-а с injected reference context и его output.

## `/goal` получил completion contracts, а coding loop — ledger доказательств

Тема «done значит доказано» в этом релизе раскрыта двумя слоями.

В [#50501](https://github.com/NousResearch/hermes-agent/pull/50501) `/goal` получил completion contract: `outcome`, `verification`, `constraints`, `boundaries`, `stop_when`. Обычный `/goal <text>` остался совместимым, но теперь можно либо попросить Hermes набросать контракт через `/goal draft <objective>`, либо передать поля явно. Judge помечает standing goal как done только когда видит конкретное доказательство: вывод команды, excerpt файла, результат теста.

Пример такого goal уже не оставляет модели свободы объявить успех без проверки:

```text
/goal draft починить падение pnpm build в блоге
```

Идея итогового контракта:

```yaml
outcome: "pnpm build проходит в репозитории блога"
verification: "показать успешный вывод pnpm build после исправления"
constraints: "не трогать чужие незакоммиченные файлы"
boundaries: "не менять деплой-конфигурацию без необходимости"
stop_when: "build завершился с exit code 0"
```

[#52285](https://github.com/NousResearch/hermes-agent/pull/52285) добавил пассивный verification evidence ledger: foreground `terminal`-результаты для тестов, lint, typecheck и build записываются как scoped evidence (`full` или `targeted`, pass/fail), привязываются к `session_id` и workspace, устаревают после успешных `write_file` / `patch` в том же project root и чистятся по сроку/размеру. Это не «магическая гарантия», а журнал фактов, на который можно опираться в stop/judge logic.

[#55413](https://github.com/NousResearch/hermes-agent/pull/55413) добавил `pre_verify` hook. Плагин или shell hook может вернуть:

```json
{ "action": "continue", "message": "Запусти pnpm build и покажи результат" }
```

Claude-Code-style форма `{"decision":"block","reason":"..."}` тоже принимается. Hook получает `coding`, `attempt`, `final_response` и `changed_paths`, а количество nudges ограничено `agent.max_verify_nudges`.

Важно: [#53552](https://github.com/NousResearch/hermes-agent/pull/53552) одновременно сделал `agent.verify_on_stop` выключенным по умолчанию и добавил миграцию config version 30→31. Даже если verify-on-stop включён явно, doc-only edits (`.md`, `.mdx`, `.rst`, `CHANGELOG`, `LICENSE` и похожие файлы) больше не заставляют агента запускать бессмысленный verification ritual.

## `/learn` и `/journey`: обучение агента стало видимым и управляемым

[#51506](https://github.com/NousResearch/hermes-agent/pull/51506) добавил `/learn <anything>`. Это не отдельный ingestion engine и не новый model tool: команда строит standards-guided prompt и отдаёт его текущему агенту как обычный turn. Агент может читать директорию через `read_file`/`search_files`, достать URL через `web_extract`, использовать текущий разговор или pasted notes, а затем сохранить результат через `skill_manage`.

То есть обучение workflow стало выглядеть так:

```text
/learn как мы деплоим этот Astro-блог: смотри package.json, AGENTS.md и последние коммиты
```

[#52372](https://github.com/NousResearch/hermes-agent/pull/52372) усилил prompt для `/learn`: туда добавлены полные CONTRIBUTING.md skill standards, включая ограничение description до 60 символов с self-check, platforms gating для OS-bound команд, правила attribution и напоминание использовать Hermes wrapped tools (`read_file`, `search_files`, `patch`, `write_file`, `web_extract`) вместо shell-аналогов.

Вторая половина self-improvement — `/journey`. [#55555](https://github.com/NousResearch/hermes-agent/pull/55555) добавил CLI/TUI timeline изученных skills и memories на базе общего `agent/learning_graph_render.py`. В TUI это tree overlay с временными slices, nested memories/skills, selection row и detail view для memories. [#55859](https://github.com/NousResearch/hermes-agent/pull/55859) добавил редактирование и удаление: `hermes journey list|edit|delete <id>` в CLI, `e`/`d` в TUI overlay и context menu в desktop.

Desktop получил более визуальную версию раньше в [#55226](https://github.com/NousResearch/hermes-agent/pull/55226): Memory Graph в `apps/desktop/src/app/starmap/` — radial timeline, playable/scrubbable scrubber, dated rings, canvas rendering и backend path `/api/learning/graph`.

## `delegate_task` умеет fan-out в фоне и возвращает один consolidated result

В [#49734](https://github.com/NousResearch/hermes-agent/pull/49734) delegation перестала быть либо синхронной, либо набором отдельных фоновых шумов. Новый `tools/async_delegation.py` добавил `dispatch_async_delegation_batch` и `_finalize_batch`: один top-level `delegate_task` может породить несколько subagents, занять один async-pool slot и вернуть handle сразу, не блокируя основной chat.

Схема из PR такая:

```text
main agent calls delegate_task
  -> returns handle immediately
     -> subagent 1 || subagent 2 || subagent N
        -> join
           -> one consolidated summaries block re-enters conversation
```

В результате сценарии вроде «проверь три модуля параллельно» или «собери research по пяти конкурентам» не требуют держать основной разговор заложником. Когда все дети завершились, в conversation возвращается один self-contained блок с массивом `results`, а не пачка разрозненных сообщений.

## Desktop стал проектным cockpit для кода

[#49037](https://github.com/NousResearch/hermes-agent/pull/49037) — один из самых больших PR релиза: 162 файла и почти 19 тысяч добавлений. Он ввёл first-class Projects как профильную модель `project → repo → lane` и построил вокруг неё desktop coding surface.

На backend стороне появились:

- `tui_gateway/project_tree.py` — dependency-injected builder project tree со стабильными id;
- RPC `projects.tree`, `projects.project_sessions`, `projects.list`, `projects.record_repos`, `projects.for_cwd`;
- `hermes_state.py` поля `cwd`, `git_branch`, `git_repo_root` для сессий и backfill helpers.

На UI стороне это превращается в sidebar проектов, coding rail в composer, review pane с diff/source previews, git worktree management и agent-facing project tools. Главное отличие от «просто папки в чате»: агент и UI теперь знают, какой repo, branch/lane и cwd относятся к сессии.

[#54385](https://github.com/NousResearch/hermes-agent/pull/54385) закрыл важный remote-gateway edge case. Если desktop подключён к удалённому gateway, «Add folder» больше не открывает локальный Electron dialog вслепую: `pickProjectFolder()` идёт через `selectDesktopPaths`, а remote mode показывает in-app `RemoteFolderPicker` поверх `/api/fs/list`. Запись `IDEA.md` тоже стала remote-aware через `/api/fs/write-text`; FS/git REST calls получают `desktopFsProfile()`, чтобы попадать в правильный backend profile.

## Gateway: scale-to-zero, dormant mode и safe drain

Для hosted/relay-only установок в `0.18.0` появилась инфраструктура, которая делает Hermes похожим на нормальный production service.

[#52243](https://github.com/NousResearch/hermes-agent/pull/52243) добавил Phase 0 scale-to-zero. В relay transport появился `go_dormant()` — третий close mode, отличный от terminal `disconnect()` и unexpected close. Gateway отправляет `going_idle`, ждёт ack, закрывает socket, но сохраняет reconnect supervisor, чтобы wake path оставался вооружённым. `gateway/scale_to_zero.py` содержит unit-testable idle/arm logic: idle считается по отсутствию активных agent runs/processes и relay backlog, а suspend/wake остаётся задачей платформы вроде Fly/NAS, не vendor API внутри Hermes.

[#52937](https://github.com/NousResearch/hermes-agent/pull/52937) добавил external drain coordination. Перед restart/migration/auto-update controller может перевести gateway в draining: новые turns не принимаются, in-flight turns завершаются, а внешний процесс опрашивает `/api/status`, пока `active_agents == 0`. Для доступа есть route-agnostic bearer-token seam в `hermes_cli/dashboard_auth/token_auth.py` и drain auth plugin `plugins/dashboard_auth/drain/`.

[#54824](https://github.com/NousResearch/hermes-agent/pull/54824) убрал лишний шум при автоматических миграциях: drain marker получил `suppress_notification`, и если shutdown был заранее drain-нут и помечен как quiet, gateway не рассылает home-channel broadcast «Gateway shutting down». Per-active-session interrupt ping при настоящем interrupt остаётся.

## Vertex AI: Gemini через Google Cloud без ручной вставки токена

[#56363](https://github.com/NousResearch/hermes-agent/pull/56363) добавил first-class provider `vertex` для Gemini через Vertex AI OpenAI-compatible endpoint. Ключевая проблема Vertex — отсутствие статического API key: каждый запрос требует OAuth2 access token примерно на час. Поэтому обычный custom provider с pasted token ломался в середине сессии.

Новый `agent/vertex_adapter.py` берёт Application Default Credentials или service-account JSON, mint-ит OAuth2 token, обновляет его с пяти минутами запаса и умеет повторить запрос после `401`. Несеcretные параметры вынесены в `config.yaml`, а provider profile живёт в `plugins/model-providers/vertex/` с `auth_type="vertex"` и переиспользует Gemini `extra_body.google.thinking_config` translation.

Упрощённая форма настройки выглядит так:

```yaml
model_providers:
  vertex:
    project: my-gcp-project
    location: us-central1
    credentials_path: /secure/path/service-account.json
```

После этого Gemini через Vertex выбирается как обычный Hermes provider, а не как кастомный endpoint с истекающим bearer token.

## Security hardening: MCP persistence, cron exfil и redaction traps

Релиз закрыл несколько конкретных security footguns.

[#50476](https://github.com/NousResearch/hermes-agent/pull/50476) усилил защиту вокруг MCP-config persistence campaign. `--insecure` для dashboard больше не отключает auth gate на non-loopback bind: публичный bind всегда требует auth provider, например bundled basic password provider или OAuth. `hermes_cli/mcp_security.py` теперь отклоняет shell-interpreter payloads, которые пишут в persistence surfaces (`authorized_keys`, `.ssh`, `/etc/ssh`, `/etc/pam.d`, sudoers, cron/systemd/rc files), и содержит IOC blocklist для наблюдавшейся кампании. Проверки идут и на save time, и на spawn time, поэтому hand-edited `config.yaml` тоже фильтруется. API server поднял floor для network `API_SERVER_KEY` с 8 до 16 символов, а `hermes_cli/security_audit_startup.py` предупреждает про root, SSH password auth, ephemeral container state и unauthenticated network listeners.

[#56196](https://github.com/NousResearch/hermes-agent/pull/56196) закрыл credential exfil в cron. `cronjob(action="create"|"update")` принимал `provider` и `base_url`; при запуске scheduler мог взять stored key named provider-а и отправить его на attacker-controlled endpoint. Теперь `tools/cronjob_tools.py::_validate_cron_base_url` и scheduler-side guard fail-closed блокируют `provider=anthropic, base_url=https://evil.example/v1` и вариант `base_url` без provider, который наследовал бы default provider key.

[#54166](https://github.com/NousResearch/hermes-agent/pull/54166) исправил другой класс проблем: redaction больше не возвращает правдоподобный «обрезанный ключ» при чтении файлов. Prefix secrets в file reads заменяются на non-reusable sentinel вроде `«redacted:ghp_…»`, чтобы агент не мог случайно записать masked value обратно в `config.yaml` и сломать авторизацию.

[#56227](https://github.com/NousResearch/hermes-agent/pull/56227) добавил redaction Slack App-Level tokens `xapp-<num>-<hash>` и в agent path (`agent/redact.py`), и в gateway secret patterns (`gateway/run.py`). Regex якорится на `xapp-\d+-`, чтобы не матчить обычные строки вроде `xapp-store`.

## Что это меняет для пользователей

`0.18.0` выглядит как релиз про дисциплину агента. MoA перестал быть отдельным режимом и стал моделью, которую можно выбрать на любой поверхности. `/goal`, verification evidence и hooks двигают Hermes от «я думаю, что сделал» к «вот проверка, по которой done считается done». `/learn`, `/journey` и Memory Graph делают накопленное знание управляемым, а не скрытым побочным эффектом. Для операторов gateway появились dormant/drain primitives, а security changes закрывают реальные пути persistence и credential leakage.

Если вы используете Hermes как локальный CLI, первыми стоит попробовать MoA model picker, `/prompt`, `/learn` и `/journey`. Если вы держите gateway для команды или hosted-сценария, важнее проверить auth на dashboard/API server, cron jobs с custom `base_url`, новые drain/scale-to-zero настройки и, при работе через Google Cloud, provider `vertex` вместо самодельного custom endpoint.

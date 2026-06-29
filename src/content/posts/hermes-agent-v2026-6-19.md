---
author: Артём Нецветаев
pubDatetime: 2026-06-29T09:04:14.000Z
title: "Hermes Agent 0.17.0: iMessage, Raft, фоновые subagents и зрелый desktop"
slug: hermes-agent-v2026-6-19
featured: false
draft: false
tags:
  - release
  - hermes-agent
  - ai-agents
  - desktop
  - automation
description: "Обзор минорного релиза Hermes Agent 0.17.0: Photon Spectrum для iMessage без Mac-релея, Raft gateway channel, фоновые delegate_task subagents, image-to-image в image_generate, профильный dashboard, Skills Hub, Automation Blueprints и security hardening."
---

[`Hermes Agent`](https://github.com/NousResearch/hermes-agent) выпустил минорный релиз [`v2026.6.19`](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.6.19), соответствующий версии `0.17.0`. Это большой «reach release»: с момента `v0.16.0` в него вошло около 1 475 коммитов, примерно 800 смёрженных PR, 1 693 изменённых файла и больше 300 закрытых issues.

Источник для обзора — GitHub Release [`NousResearch/hermes-agent@v2026.6.19`](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.6.19) и связанные PR, в том числе [#32348](https://github.com/NousResearch/hermes-agent/pull/32348), [#42582](https://github.com/NousResearch/hermes-agent/pull/42582), [#44713](https://github.com/NousResearch/hermes-agent/pull/44713), [#48210](https://github.com/NousResearch/hermes-agent/pull/48210), [#40946](https://github.com/NousResearch/hermes-agent/pull/40946), [#46968](https://github.com/NousResearch/hermes-agent/pull/46968), [#48705](https://github.com/NousResearch/hermes-agent/pull/48705), [#39084](https://github.com/NousResearch/hermes-agent/pull/39084), [#44007](https://github.com/NousResearch/hermes-agent/pull/44007), [#40384](https://github.com/NousResearch/hermes-agent/pull/40384), [#41309](https://github.com/NousResearch/hermes-agent/pull/41309), [#45866](https://github.com/NousResearch/hermes-agent/pull/45866), [#40660](https://github.com/NousResearch/hermes-agent/pull/40660), [#47060](https://github.com/NousResearch/hermes-agent/pull/47060), [#46959](https://github.com/NousResearch/hermes-agent/pull/46959), [#43292](https://github.com/NousResearch/hermes-agent/pull/43292) и [#44596](https://github.com/NousResearch/hermes-agent/pull/44596).

## iMessage через Photon Spectrum: канал без Mac-релея и webhook URL

Главное расширение gateway — новый bundled platform plugin для iMessage через Photon Spectrum. В [#32348](https://github.com/NousResearch/hermes-agent/pull/32348) добавлены `plugins/platforms/photon/`, CLI-команды и документация. Базовый сценарий теперь выглядит так:

```bash
hermes photon login
hermes photon setup --phone +15551234567
```

`hermes photon login` использует device-code OAuth против `app.photon.codes`, а `hermes photon setup --phone ...` создаёт Spectrum project, вызывает Photon `create-user` с `type: shared`, чтобы free pool выделил iMessage line, и устанавливает npm-зависимости sidecar. В релизе это явно позиционируется как замена BlueBubbles-сценарию: не нужен Mac в шкафу, не нужен отдельный bridge, не нужно держать публичный webhook endpoint.

Следующий PR, [#42582](https://github.com/NousResearch/hermes-agent/pull/42582), убрал из Photon-адаптера aiohttp webhook server, HMAC-проверку и конфиги `PHOTON_WEBHOOK_*`: входящие и исходящие сообщения идут через persistent gRPC stream из `spectrum-ts` sidecar. [#44713](https://github.com/NousResearch/hermes-agent/pull/44713) довёл канал до бытового качества: markdown rendering, emoji tapback reactions, `unreact` в `tools/send_message_tool.py`, reaping orphan sidecar processes, завершение sidecar по stdin EOF, pin `spectrum-ts` 3.1.0 и telemetry opt-in toggle.

## Raft: Hermes как внешний агент в agent network

Второй новый gateway channel — Raft. [#48210](https://github.com/NousResearch/hermes-agent/pull/48210) добавил bundled plugin `plugins/platforms/raft/`, тесты `tests/gateway/test_raft_adapter.py` и документацию `website/docs/user-guide/messaging/raft.md`.

Архитектура не передаёт тела сообщений в wake payload. Адаптер поднимает loopback HTTP wake endpoint, запускает `raft agent bridge` и инжектит в Hermes content-free wake hints: metadata вроде event id и timestamp достаточно, чтобы разбудить агент, но не содержит содержимого переписки. На практике это даёт ещё одну поверхность, где Hermes может принимать работу, но сохраняет privacy-by-contract модель для wake-канала.

Минимальная конфигурационная идея из релиза:

```bash
export RAFT_PROFILE=my-hermes-profile
# далее запускается bridge, который может будить Hermes через Raft channel
```

## `delegate_task(background=true)`: subagents больше не блокируют основной turn

В [#40946](https://github.com/NousResearch/hermes-agent/pull/40946) `delegate_task` получил асинхронный режим:

```python
delegate_task(
    goal="Проверь миграцию и собери список регрессий",
    background=True,
)
```

При `background=true` инструмент возвращает handle сразу, а subagent продолжает работать через тот же completion-queue механизм, что и фоновые terminal-процессы с `notify_on_complete`. Когда subagent заканчивает, результат возвращается в разговор отдельным новым turn, а не вклеивается посередине agent loop. В self-contained блоке результата сохраняются original task source, goal, child session id и transcript path, так что основной агент может продолжить работу без потери provenance.

Важно, что [#46968](https://github.com/NousResearch/hermes-agent/pull/46968) исправил реальный chokepoint: `delegate_task` входит в `_AGENT_LOOP_TOOLS`, поэтому CLI, gateway, desktop/TUI проходят через `AIAgent._dispatch_delegate_task` в `run_agent.py`. До фикса флаг `background` терялся до вызова функции, и инструмент фактически продолжал работать синхронно. Теперь `delegate_task(background=true)` действительно возвращает `delegation_id`, а не sync results payload.

## `image_generate` научился редактировать исходные изображения

[#48705](https://github.com/NousResearch/hermes-agent/pull/48705) расширил `image_generate` с text-to-image до image-to-image/editing. Контракт один и тот же: если в вызове есть `image_url`, routing идёт в edit endpoint соответствующего backend.

Изменение прошло через общий ABC `agent/image_gen_provider.py`, tool surface `tools/image_generation_tool.py`, backends `plugins/image_gen/fal/`, `krea/`, `openai-codex/`, `openai/`, `xai/`, тесты `tests/tools/test_image_generation_image_to_image.py` и документацию. В релизе отдельно отмечено, что реализации проверялись по API каждого провайдера: FAL `/edit`, OpenAI `images.edit`, xAI `/v1/images/edits`, Krea reference-guided generation. Соседний [#45979](https://github.com/NousResearch/hermes-agent/pull/45979) добавил shrink до provider dimension limit, чтобы слишком большие изображения не ломали route.

Пример подтверждённого пользовательского сценария:

```text
Вызови image_generate с prompt="сделай фон зимним, сохрани объект" и image_url="..."
```

Для пользователя это меняет класс задачи: Hermes может не только создать новую картинку, но и трансформировать уже приложенную — через тот же инструмент и выбранный image backend.

## Desktop app стал daily driver, а не preview

`v0.16.0` принёс desktop app, а `0.17.0` заметно нарастил его рабочие поверхности.

В [#40660](https://github.com/NousResearch/hermes-agent/pull/40660) shortcuts переехали из разбросанных inline listeners в центральный registry + nanostore. В UI появился keyboard shortcuts panel, открываемый из titlebar-кнопки и через `⌘/` или `Ctrl+/`; действия сгруппированы, конфликтующие комбинации можно переназначать, а настройки сохраняются в store.

[#45866](https://github.com/NousResearch/hermes-agent/pull/45866) добавил настоящий native notification engine на Electron `Notification`. Это не прежний единственный hardcoded `message.complete` при `document.hidden`: теперь есть `store/native-notifications.ts`, localStorage-backed preferences `$nativeNotifyPrefs`, master toggle `enabled`, per-kind toggles и click routing к нужной сессии.

[#47060](https://github.com/NousResearch/hermes-agent/pull/47060) закрыл важную дыру в subagent watch windows. Окно дочернего агента уже могло получать `subagent.*` events, но не streamed reply text; поэтому окно открывалось пустым, пока subagent работал. Теперь reply stream зеркалится в native child-session stream events, а watch window показывает активность делегированного агента в отдельной панели.

[#46959](https://github.com/NousResearch/hermes-agent/pull/46959) перенёс model selector в composer: model pill рядом с mic открывает тот же dropdown, model list скрывает date-pinned snapshots, когда есть rolling alias, а reasoning effort / fast mode стали per-model presets в `localStorage`. В тот же блок вошли external-provider disconnect и синхронизация desktop picker с провайдерами из `hermes model`.

Наконец, [#43292](https://github.com/NousResearch/hermes-agent/pull/43292) разрешил ставить любую VS Code Marketplace theme прямо из desktop app. `Cmd-K → Choose theme → Install theme...` открывает live debounced Marketplace search; выбранная тема скачивается, устанавливается и активируется на месте, включая integrated terminal. [#44596](https://github.com/NousResearch/hermes-agent/pull/44596) добавил auto RTL/bidi для Arabic/Hebrew/Persian/Urdu через `unicode-bidi: plaintext` и `text-align: start` на chat surfaces.

## Dashboard: профильный builder, единая multi-profile поверхность и Skills Hub

[#39084](https://github.com/NousResearch/hermes-agent/pull/39084) заменил тонкую profile create modal на полноценный stepped profile builder. Из dashboard теперь можно создать профиль с выбором model/provider, built-in и hub skills, MCP servers, name и description. В PR подчёркнуто, что профиль — это полноценный `HERMES_HOME`, поэтому builder переиспользует уже существующие mature Models/Skills/MCP data paths, а не дублирует отдельную wizard-логику.

[#44007](https://github.com/NousResearch/hermes-agent/pull/44007) поднял dashboard на уровень machine-level management surface. Глобальный profile switcher переключает, с каким профилем работают config, API keys, MCPs, model, skills и Chat tab; `<profile> dashboard` больше не плодит отдельные per-profile servers, а маршрутизирует к единому dashboard.

Skills Hub тоже стал более проверяемым. [#40384](https://github.com/NousResearch/hermes-agent/pull/40384) превратил Browse hub tab из пустой search-box страницы в browser с connected hubs, featured skills, preview реального `SKILL.md` до установки и визуальным security scan тем же механизмом, что используется при install. [#43398](https://github.com/NousResearch/hermes-agent/pull/43398) добавил live per-source progress в `hermes skills browse`: вместо зависшего `Fetching skills...` status line показывает, какие источники уже вернули результаты, например `done: official (12)` → `+ github (4)` → `+ clawhub (500)`.

## Automation Blueprints и fleet-управление

[#41309](https://github.com/NousResearch/hermes-agent/pull/41309) добавил Automation Blueprints — параметризованные шаблоны автоматизаций для cron. Идея в том, что пользователь выбирает automation by name, Hermes спрашивает недостающие параметры, а не заставляет помнить cron syntax или писать `slot=value` вручную.

В PR это реализовано как один blueprint definition, который рендерится на разных поверхностях: dashboard form, CLI/TUI/messenger slash command, agent conversation и docs catalog. Все пути сходятся в один `cron.jobs.create_job`, то есть не появляется второго job engine. В дереве это видно по новым `cron/blueprint_catalog.py`, `cron/suggestion_catalog.py`, `hermes_cli/blueprint_cmd.py`, `tools/blueprints.py`, `web/src/components/AutomationBlueprints.tsx` и docs extraction scripts.

В той же области релиз добавил managed scope ([#49098](https://github.com/NousResearch/hermes-agent/pull/49098)): administrator-pinned, user-immutable config and secrets из root-owned `/etc/hermes`; opt-in multiplex всех profiles через один gateway process ([#48273](https://github.com/NousResearch/hermes-agent/pull/48273)); pluggable `CronScheduler` и Chronos managed-cron provider для scale-to-zero ([#48275](https://github.com/NousResearch/hermes-agent/pull/48275)). Это уже не только удобство single-user CLI, а элементы эксплуатации Hermes в команде или managed environment.

## Модели, MCP, skills и безопасность

Для xAI/Grok пользователей [#47908](https://github.com/NousResearch/hermes-agent/pull/47908) surfaced Composer 2.5 в `hermes model` для `xai-oauth`: модель была вызываема через `api.x.ai/v1`, но не попадала в picker, потому что `provider_model_ids("xai-oauth")` опирался на static list из models.dev cache и `_XAI_STATIC_FALLBACK`. [#47371](https://github.com/NousResearch/hermes-agent/pull/47371) поменял default model для xAI/Grok provider и xAI web-search backend с `grok-4.3` на `grok-build-0.1`.

MCP получил несколько эксплуатационных улучшений: official Unreal Engine 5.8 MCP server в catalog, elicitation handler для mid-tool-call confirmation на той поверхности, где живёт session, late-connecting MCP tools между turns без нарушения prompt cache, keepalive ping для short-TTL HTTP sessions, capability-gate `tools/list` для prompt-only servers, сохранение stdio argv passthrough и Windows env vars. Security-ветка релиза блокирует exfil-shaped/suspicious stdio configs перед probe, закрывает shell-escape denylist bypass, sanitizes env для cron job-script subprocesses и ограничивает объём TodoStore.

Отдельно стоит отметить изменение для памяти и skills: memory/skill write approval gate теперь выражен boolean `write_approval`, а не tri-state `write_mode` ([#38199](https://github.com/NousResearch/hermes-agent/pull/38199), [#43354](https://github.com/NousResearch/hermes-agent/pull/43354)). Для администраторов это проще проверять и объяснять: запись агентом в долговременные хранилища либо требует approval, либо нет.

## Итог

Hermes Agent `0.17.0` расширяет не один конкретный API, а радиус применения агента. iMessage через Photon и Raft добавляют новые каналы, desktop app получает функции, без которых его трудно использовать ежедневно, `delegate_task(background=true)` меняет ergonomics долгих задач, `image_generate` становится инструментом редактирования, dashboard превращается в профильный control plane, а Automation Blueprints и managed scope двигают Hermes к командной эксплуатации.

Для обновления ориентируйтесь на стандартный install/update путь Hermes и конкретные настройки нужной поверхности: `hermes photon login` для iMessage, `RAFT_PROFILE` и bridge для Raft, `hermes model` для xAI Composer/Grok Build, dashboard profile builder для multi-profile setup и `delegate_task(background=true)` для фоновых subagents.

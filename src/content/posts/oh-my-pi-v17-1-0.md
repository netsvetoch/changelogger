---
author: Артём Нецветаев
pubDatetime: 2026-08-14T12:40:00.000Z
title: "oh-my-pi 17.1.0: multi-root workspaces, голосовой /live, usage-aware fallback и prompt-cache контроль"
slug: oh-my-pi-v17-1-0
featured: false
draft: false
tags:
  - release
  - oh-my-pi
  - coding-agent
  - cli
  - voice
  - prompt-cache
  - oauth
description: "Разбор oh-my-pi v17.1.0: динамические multi-root workspaces (/add-dir, --add-dir), real-time голосовой интерфейс /live через Codex + WebRTC, usage-aware fallback для rationed coding plans, явный prompt-cache для GPT-5.6+ и Vercel AI Gateway, OAuth account pools, jj в статуслайне и blocked-статус задач."
---

[oh-my-pi](https://github.com/can1357/oh-my-pi) выпустил минорный релиз [`v17.1.0`](https://github.com/can1357/oh-my-pi/releases/tag/v17.1.0) (24 июля 2026). Тема версии — расширение поверхности сессии: несколько рабочих каталогов на лету, голосовой интерфейс, честный учёт квот и тонкий контроль prompt-кэша у OpenAI/Vercel/Google.

Источники: [GitHub Release v17.1.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.1.0), compare [`v17.0.9...v17.1.0`](https://github.com/can1357/oh-my-pi/compare/v17.0.9...v17.1.0), а также ключевые PR: [#2569](https://github.com/can1357/oh-my-pi/pull/2569) (multi-root), [#6382](https://github.com/can1357/oh-my-pi/pull/6382) (Anthropic extra usage), [#6386](https://github.com/can1357/oh-my-pi/pull/6386) (Meta Model API), [#4448](https://github.com/can1357/oh-my-pi/pull/4448) (blocked tasks), [#4450](https://github.com/can1357/oh-my-pi/pull/4450) (jj statusline), [#4455](https://github.com/can1357/oh-my-pi/pull/4455) (direnv), [#6119](https://github.com/can1357/oh-my-pi/pull/6119) (owner-routed delivery), [#6363](https://github.com/can1357/oh-my-pi/pull/6363) (bash approval rules), [#6408](https://github.com/can1357/oh-my-pi/pull/6408)–[#6413](https://github.com/can1357/oh-my-pi/pull/6413) (prompt cache), [#6416](https://github.com/can1357/oh-my-pi/pull/6416) (OAuth pools), [#6445](https://github.com/can1357/oh-my-pi/pull/6445) (service tiers API).

## Multi-root workspace контекст

Добавлена динамическая поддержка нескольких workspace-директорий: mid-session через слэш-команды `/add-dir`, `/remove-dir`, `/dirs` или на старте флагом `--add-dir` ([#2569](https://github.com/can1357/oh-my-pi/pull/2569)).

## /live — голосовой интерфейс через Codex

Новая команда `/live` — Codex-authenticated real-time голосовой режим: микрофон стримится по WebRTC, а coding-задачи маршрутизируются через активную agent-сессию.

## Usage-aware fallback и /usage

Для лимитированных coding-планов добавлен opt-in usage-aware model fallback: команда `/usage` показывает живые количественные данные по квотам, а fallback-цепочка обходится автоматически. В `pi-ai` появились model-scoped usage health tracking и same-provider reselection для нативных coding-plan credential pools; отчётность Anthropic extra-usage нормализована в USD-строку «Claude Extra Usage» с лимитом, остатком и статусом ([#6382](https://github.com/can1357/oh-my-pi/pull/6382)).

## Prompt cache: OpenAI, Vercel, Google, Cloudflare

- **OpenAI GPT-5.6+**: opt-in явные контролы prompt-кэша для Responses и Chat Completions — выбор стабильной границы, stateful Responses markers, поддержка будущих GPT-5.x/6.x ([#6412](https://github.com/can1357/oh-my-pi/pull/6412)). `statefulResponses` можно пробросить через `streamSimple`, чтобы диагностика явно отключала `previous_response_id` chaining.
- **Vercel AI Gateway**: opt-in автоматический prompt caching для OpenAI Chat Completions с cache anchors и cache lifetimes ([#6410](https://github.com/can1357/oh-my-pi/pull/6410)).
- **Google Generative AI / Vertex**: caller-owned `cachedContent` — можно передавать opaque cache resource names ([#6408](https://github.com/can1357/oh-my-pi/pull/6408)).
- **Cloudflare AI Gateway**: cache status (hit/miss/bypass/unknown) теперь трекается на chat spans ([#6411](https://github.com/can1357/oh-my-pi/pull/6411)).
- **`omp bench --cache`**: opt-in независимый cold/warm бенчмарк prompt-кэша со stable-prefix контролем ([#6413](https://github.com/can1357/oh-my-pi/pull/6413)).
- **AWS Bedrock**: cache checkpoints приведены к совместимости модели — fallback на provider-default 5-минутный кэш, explicit checkpoints для Nova-моделей (Lite, Micro, Pro, Premier, Nova 2 Lite), соблюдение настроенных максимумов.

## OAuth account pools и новые провайдеры

Process-scoped OAuth account pools для trusted auth-broker клиентов через `OMP_AUTH_BROKER_ACCOUNT_POOL_FILE` — фильтруют snapshots, updates, refreshes и usage-отчёты по выбранным OAuth-идентичностям ([#6416](https://github.com/can1357/oh-my-pi/pull/6416)). Добавлены нативный QwenCloud Token Plan (API-key логин, discovery моделей, опциональный console-Cookie prompt для квот), interactive Meta Model API key login (`MODEL_API_KEY`/`META_API_KEY`) и провайдер Meta Model API с Muse Spark 1.1 (Responses API reasoning replay, image input, reasoning-effort controls) ([#6386](https://github.com/can1357/oh-my-pi/pull/6386)).

## Вокруг сессии

- **Owner-routed async job delivery**: результаты background bash и задач инжектятся прямо владеющему сабагенту, а не в top-level сессию; сабагенты наследуют `async.enabled` и `bash.autoBackground.enabled` от родителя и ждут оседлания фоновых задач при завершении ([#6119](https://github.com/can1357/oh-my-pi/pull/6119)).
- **Background-on-steer**: входящее сообщение пользователя или пира немедленно уводит выполняющуюся команду в фон.
- **`bash.patterns`**: упорядоченные per-command approval-правила allow/prompt/deny ([#6363](https://github.com/can1357/oh-my-pi/pull/6363)).
- **`blocked` статус задач** с операциями `block`/`unblock` — ожидающие внешнего ввода задачи исключаются из incomplete-todo напоминаний ([#4448](https://github.com/can1357/oh-my-pi/pull/4448)).
- **Jujutsu (`jj`)** в statusline `git`-сегменте: ближайший bookmark или change ID и счётчики working-copy ([#4450](https://github.com/can1357/oh-my-pi/pull/4450)).
- **`error.notify`**: отдельные терминальные/desktop уведомления о failed model turns ([#4637](https://github.com/can1357/oh-my-pi/pull/4637)).
- **HTML-экспорт** с авто-following light/dark темами и `/export --themes` для бандла выбранных TUI-тем ([#6349](https://github.com/can1357/oh-my-pi/pull/6349)).
- **`friendlyName`** для скрытых секретов: model-visible плейсхолдеры несут санитизированные семантические метки, хэши и case hints ([#4636](https://github.com/can1357/oh-my-pi/pull/4636)).
- **`getServiceTiers()`/`setServiceTier()`** extension API для чтения и изменения live per-family service tier ([#6445](https://github.com/can1357/oh-my-pi/pull/6445)).
- **Toggle-list редактор** в `/settings` для array-of-enum настроек — тех самых новых `providers.webSearchOrder`/`providers.imageOrder` (breaking: одиночные `providers.webSearch`/`providers.image` заменены списками приоритетов, конфиги мигрируют автоматически) ([#6029](https://github.com/can1357/oh-my-pi/pull/6029)).
- **`tools.xdevDocs`** и **`tools.xdevInlineDevices`** — контроль того, какая документация смонтированных устройств инлайнится в системный промпт.

## Исправления

Из заметного: path traversal в blob reference resolution закрыт отклонением non-canonical хэшей в `parseBlobRef` ([#6427](https://github.com/can1357/oh-my-pi/pull/6427)); серия фиксов secret obfuscation/redaction engine (context-sensitive regexes, friendly-name forgery, границы матчей); race в `ArtifactManager` с дубликатами artifact ID ([#6426](https://github.com/can1357/oh-my-pi/pull/6426)); сериализация конкурентных записей `mcp.json` под per-file lock с atomic writes ([#6424](https://github.com/can1357/oh-my-pi/pull/6424)); компакшн с Anthropic больше не триггерит reasoning_extraction отказов; переключение Anthropic-compatible провайдеров не залипает на `400 Invalid signature in thinking block` ([#6380](https://github.com/can1357/oh-my-pi/pull/6380)); Google/Antigravity OAuth логин больше не висит на Cloud Code Assist provisioning ([#6433](https://github.com/can1357/oh-my-pi/pull/6433)); выход из TUI корректно сбрасывает DECCKM, возвращая стрелки родительскому шеллу ([#6398](https://github.com/can1357/oh-my-pi/pull/6398)).

## Как обновиться

```sh
curl -fsSL https://omp.sh/install | sh
```

или `npm i -g @oh-my-pi/pi-coding-agent`. Полный список изменений — в [GitHub Release v17.1.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.1.0).

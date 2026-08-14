---
author: Артём Нецветаев
pubDatetime: 2026-08-14T13:00:00.000Z
title: "oh-my-pi 17.3.0: per-agent advisors, новый /agents hub, Nix-сборки и GPT-5.6 Daybreak"
slug: oh-my-pi-v17-3-0
featured: false
draft: false
tags:
  - release
  - oh-my-pi
  - coding-agent
  - advisors
  - nix
  - gpt-5-6
  - lsp
description: "Разбор oh-my-pi v17.3.0: per-agent advisors через advisor frontmatter / task.agentAdvisor (глобальный advisor.subagents удалён), редизайн /agents в fullscreen hub, first-party Nix поддержка, модели OpenAI Daybreak Blue/Red и GPT-5.6 Cyber, rolling Anthropic prompt-cache breakpoints, Astral ty как fallback Python LSP."
---

[oh-my-pi](https://github.com/can1357/oh-my-pi) выпустил минорный релиз [`v17.3.0`](https://github.com/can1357/oh-my-pi/releases/tag/v17.3.0) (13 августа 2026). Темы версии: гранулярная настройка advisor'ов, переработанный интерфейс управления агентами, воспроизводимые Nix-сборки и свежие модели OpenAI с честным прайсингом.

Источники: [GitHub Release v17.3.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.3.0), compare [`v17.2.15...v17.3.0`](https://github.com/can1357/oh-my-pi/compare/v17.2.15...v17.3.0), PR [#8072](https://github.com/can1357/oh-my-pi/pull/8072), [#8080](https://github.com/can1357/oh-my-pi/pull/8080), [#8097](https://github.com/can1357/oh-my-pi/pull/8097), [#8101](https://github.com/can1357/oh-my-pi/pull/8101), [#8106](https://github.com/can1357/oh-my-pi/pull/8106), [#8122](https://github.com/can1357/oh-my-pi/pull/8122), [#8123](https://github.com/can1357/oh-my-pi/pull/8123), issues [#8334](https://github.com/can1357/oh-my-pi/issues/8334), [#8405](https://github.com/can1357/oh-my-pi/issues/8405), [#8315](https://github.com/can1357/oh-my-pi/issues/8315), [#8402](https://github.com/can1357/oh-my-pi/issues/8402).

## Per-agent advisors (breaking)

Глобальная настройка `advisor.subagents` удалена. Advisor'ы сабагентов теперь конфигурируются **per agent** — через поле `advisor` во frontmatter определения агента или настройку `task.agentAdvisor`, что позволяет разным агентам быть advised разными моделями. Существующие конфиги с `advisor.subagents: true` автоматически мигрируют в `task.agentAdvisor: { task: "on" }`.

## Редизайн /agents

Интерфейс `/agents` перестроен как fullscreen hub: scope-сайдбар, type-to-filter поиск, pinned detail pane, поддержка мыши и интерактивные property-chips для настройки параметров агента. (Заодно починено открытие Control Center, когда model overrides заданы YAML-массивами.)

## Модели: Daybreak и GPT-5.6 Cyber

В каталоге появились first-party **OpenAI Daybreak Blue, Daybreak Red и GPT-5.6 Cyber** — с полной поддержкой документированного API-прайсинга (включая long-context ставки выше 272K input), лимитов токенов, tools и reasoning effort controls (`off`/`low`/`medium`/`high`/`xhigh`/`max`). Добавлен `calculateUncachedInputCost()` для расчёта стоимости промпта против активных context-length тиров без prompt-кэша. Codex-discovered `gpt-daybreak-*` алиасы больше не считаются unknown-моделями.

Отдельно исправлен прайсинг Anthropic cache-write: mixed 5-минутный и 1-часовой TTL usage теперь тарифицируется честно, а не по 5-минутной ставке для всех записей. В `omp-stats` добавлен cost-weighted `cacheSavings` рядом с `cacheRate` — с учётом cache-read скидок и write premiums против эквивалентной uncached-стоимости промпта.

## Anthropic prompt cache: rolling breakpoints

Оптимизировано кэширование Anthropic: rolling 5-минутные breakpoints с idle-refresh держат префикс промпта тёплым. Advisor и side-channel запросы изолированы от общего refresh-таймера, так что они не сбрасывают чужой кэш.

## OpenCode Go по-настоящему

Интеграция OpenCode Go переведена на официальный usage endpoint: убраны hardcoded caps, включена real-time credential validation, multi-key пулы маршрутизируются по rolling и weekly headroom. `/usage`, `omp usage` и status line показывают авторитетное использование квоты в трёх окнах (5h, 7d, monthly) вместо оценочных сумм; legacy-машинерия локальной оценки стоимости запросов и её схемы БД удалены.

## Nix, LSP и экосистема

- **First-party Nix support**: воспроизводимые source-сборки для Linux и macOS, pinned dev shell, модули для NixOS и Home Manager, offline Bun dependencies.
- **Astral `ty`** добавлен как built-in fallback Python LSP-сервер (`ty server`), после `pyright`, `basedpyright` и `pylsp`.
- Серия LSP-фиксов: конкурентные сессии делили backend overlays, stale document overlays после workspace-правок, некорректные transactional edit advertisements, snippet placeholders в rust-analyzer, восстановление перезаписанных целей при failed renames; `diagnostics` больше не рапортует успех, когда все language servers упали.
- **Подготовка к npm-переименованию пакета**: `omp update` и startup version checks следуют указателю `omp.rename` в опубликованном манифесте.
- **DeepSeek reasoning effort**: Ollama Cloud DeepSeek V4 Flash и старшие reasoner'ы получили правильный контракт effort'ов (Flash → `low`/`high`/`max`, старшие → `high`/`max`) вместо generic лесенки ([#8334](https://github.com/can1357/oh-my-pi/issues/8334)); `low` tier открыт для DeepSeek V4 Pro на direct API ([#8405](https://github.com/can1357/oh-my-pi/issues/8405)). Thinking-loop guard переименован в `withThinkingLoopGuard` и покрывает Gemini, DeepSeek и Grok семейства (breaking: `OpenAICompat.enableGeminiThinkingLoopGuard` удалён).

## Исправления

Заметные: `/shake` больше не выбрасывает все tool results, а оставляет небольшой хвост недавних, чтобы агент не терял рабочий контекст; WSL2-старт больше не висит на wedged Windows interop pipe — probes `cmd.exe`/`wslpath` под 500ms hard timeout с fallback на Linux `$HOME` ([#8402](https://github.com/can1357/oh-my-pi/issues/8402)); retry-fallback selection не переключает на модель со слишком маленьким контекстным окном; shell-internal фоновые задачи (`yes >/dev/null &`) не переживают one-shot shell-сессию и не едят CPU вечно; `/skill:<name>` токены в `/plan` и `/vibe` снова исполняют скилл, а не трактуются как текст; OpenAI-compatible model discovery ограничен дефолтным таймаутом — зависший `/models` endpoint больше не вешает старт бесконечно ([#8315](https://github.com/can1357/oh-my-pi/issues/8315)); embedded dashboard archive в `omp-stats` стал byte-reproducible (сортировка записей, обнулённые tar/gzip timestamps).

## Кому стоит обновиться

Тем, кто настраивал advisor'ов глобально (миграция автоматическая, но проверьте результат), пользователям Nix/NixOS, и всем на Anthropic с включённым prompt-кэшом — rolling breakpoints должны заметно поднять hit rate на длинных сессиях.

## Как обновиться

```sh
curl -fsSL https://omp.sh/install | sh
```

или `npm i -g @oh-my-pi/pi-coding-agent`. Полный changelog — в [GitHub Release v17.3.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.3.0).

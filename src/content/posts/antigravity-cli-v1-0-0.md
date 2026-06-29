---
author: Артём Нецветаев
pubDatetime: 2026-06-29T10:40:20.000Z
title: "Antigravity CLI 1.0.0: терминальный интерфейс к агентам Google Antigravity"
slug: antigravity-cli-v1-0-0
featured: true
draft: false
tags:
  - release
  - antigravity-cli
  - ai-agents
  - cli
description: "Разбор первого major-релиза Antigravity CLI 1.0.0: TUI для агентного workflow, установка на macOS/Linux и Windows, общие настройки с Antigravity 2.0, SSH-сценарии, /logout и примеры кастомных statusline/title скриптов."
---

[`antigravity-cli`](https://github.com/google-antigravity/antigravity-cli) вышел в версии [`1.0.0`](https://github.com/google-antigravity/antigravity-cli/blob/main/CHANGELOG.md#100). Сам changelog формулирует релиз коротко — «Initial release of the Antigravity CLI», поэтому для конкретики здесь использованы GitHub API-данные из `CHANGELOG.md`, README и инициализирующий коммит [`d7bc2c7`](https://github.com/google-antigravity/antigravity-cli/commit/d7bc2c7d28654be4eb89379531a8816758e65602), который добавил `README.md`, `CHANGELOG.md` и demo GIF.

По README, Antigravity CLI — это terminal-first/TUI поверхность для Antigravity agents: она понимает кодовую базу, может редактировать файлы с разрешения пользователя и запускать команды прямо из терминала. В отличие от Antigravity 2.0 с полноценным GUI, первый релиз CLI сфокусирован на keyboard-first workflow, SSH/remote-сессиях и минимальном overhead.

## Что именно появилось в 1.0.0

Первый релиз не публикует длинный список новых флагов или migration notes: это исходная публичная точка для CLI. Но README фиксирует несколько конкретных пользовательских контрактов:

- интерфейс — Terminal User Interface, а не GUI-приложение;
- core capabilities совпадают с Antigravity 2.0: multi-step reasoning, multi-file editing, tool calling и persistent conversation history;
- CLI рассчитан на fast local iterations, SSH, headless и терминальные мультиплексоры;
- Antigravity CLI и Antigravity 2.0 используют общий agent engine;
- настройки и permissions синхронизируются между CLI и GUI;
- терминальную сессию можно экспортировать в Antigravity 2.0, если задачу удобнее продолжить в визуальном интерфейсе.

Иными словами, `1.0.0` — это не «тонкий npm-wrapper вокруг веб-сервиса», а отдельный TUI-клиент к тому же agent harness, который Google описывает для Antigravity 2.0.

## Установка: отдельные install-команды под macOS/Linux и Windows

README добавляет три подтверждённых способа установки. Для macOS и Linux:

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

Для Windows PowerShell:

```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

Для Windows CMD:

```cmd
curl -fsSL https://antigravity.google/cli/install.cmd -o install.cmd && install.cmd && del install.cmd
```

Это важная деталь для команд, которые хотят запускать агентный workflow не только локально в IDE, но и на удалённых машинах: в документации CLI прямо выделены SSH/remote sessions и terminal-first workflows.

## Авторизация: system keyring, browser fallback и `/logout`

Первый README описывает auth-модель без отдельной ручной настройки токенов в файлах проекта. CLI аутентифицируется через system keyring, а если активной сессии нет, падает обратно на Google Sign-In.

Поведение отличается для локального и удалённого запуска:

- локально CLI автоматически открывает default browser;
- в SSH-сессии он печатает authorization URL, чтобы пользователь завершил вход на своей машине;
- выход из аккаунта делается slash-командой:

```text
/logout
```

Для enterprise-доступа README отдельно упоминает onboarding через GCP project. Это не раскрыто в changelog 1.0.0 подробнее, поэтому практический вывод ограничен тем, что enterprise-подключение существует как часть первого запуска, а не как пост-релизная функция.

## CLI и Antigravity 2.0 делят engine, settings и permissions

Самая важная архитектурная граница 1.0.0 — Antigravity CLI не живёт отдельно от Antigravity 2.0. В README и официальном overview совпадают три интеграционные точки:

1. **Shared Agent Engine**: оба интерфейса запускают один и тот же core agent engine, поэтому улучшения reasoning/tool usage/code comprehension должны применяться к обеим поверхностям.
2. **Shared Settings**: preferences и permission rules синхронизируются между CLI и Antigravity 2.0.
3. **Session Export**: терминальную сессию можно перенести в GUI, если работа стала слишком визуальной или требует orchestration в desktop-интерфейсе.

Практический сценарий такой: можно начать задачу по SSH в TUI, дать агенту прочитать проект, внести изменения и выполнить команды, а затем экспортировать разговор в Antigravity 2.0 для более визуального review.

## Кастомизация терминального UI уже попала в репозиторий

В самом инициализирующем коммите были только README/changelog/demo GIF, но в репозитории к текущему `main` уже есть официальные примеры для кастомизации CLI-поверхности. Они полезны, потому что показывают, какой state CLI отдаёт внешним скриптам.

Пример `examples/statusline/statusline.sh` читает JSON из stdin и за один проход `jq` достаёт такие поля:

```bash
jq -r '
  (.agent_state // "idle"),
  (.context_window.used_percentage // 0),
  (.vcs.branch // ""),
  (.vcs.dirty // false),
  (.sandbox.enabled // false),
  (.artifact_count // 0),
  (if .subagents | type == "array" then (.subagents | length) else 0 end),
  (.task_count // 0),
  (.model.display_name // ""),
  (.terminal_width // 80)
'
```

На их основе скрипт рисует состояние агента (`idle`, `thinking`, `working`, `tool_use`), процент context window, ветку VCS с dirty-маркером, sandbox badge, количество artifacts/subagents/background tasks и имя модели. То есть statusline — это не статический prompt: CLI отдаёт достаточно состояния, чтобы собрать live-индикатор агентной работы.

Второй пример, `examples/title/title.sh`, читает из JSON `agent_state` и `workspace.current_dir`, после чего выставляет заголовок окна в форме:

```text
[Emoji] [State] | [Workspace]
```

Маппинг из примера: `initializing` → 🚀, `idle` → 😴, `thinking` → 🤔, `working` → 🏃, `tool_use` → 🛠️. Для терминального инструмента это важная мелочь: долгие агентные задачи можно отслеживать по заголовку окна или вкладки, не возвращаясь постоянно в сам TUI.

## Что учитывать перед использованием

В README первого релиза есть явное предупреждение о рисках AI coding agents: автономное выполнение кода, exfiltration, prompt injection и supply-chain risks. Поэтому разумная baseline-настройка для 1.0.0 такая:

- начинать в репозитории с чистым `git status`, чтобы проще ревьюить изменения агента;
- внимательно смотреть permission prompts перед запуском команд;
- использовать синхронизацию permissions с Antigravity 2.0, если одна и та же команда работает и в GUI, и в TUI;
- в SSH/headless сценариях заранее проверить, что browser login можно завершить по распечатанному authorization URL.

## Итог

Antigravity CLI 1.0.0 — первый публичный major-релиз терминального клиента к Google Antigravity agents. Его главный смысл не в отдельной библиотечной API, а в новой поверхности работы: TUI для multi-step reasoning, редактирования файлов, запуска команд, persistent history и переноса сессий в Antigravity 2.0. Для команд, которые живут в терминале, tmux и SSH, это делает Antigravity доступным без переключения в desktop IDE, но с тем же agent engine и общими настройками безопасности.

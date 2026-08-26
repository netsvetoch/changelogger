---
author: Артём Нецветаев
pubDatetime: 2026-08-26T11:25:40.000Z
title: "Kilo Code 7.5.0: Agent Manager учится отвечать на вопросы, показывать diff и инспектировать документы"
slug: kilocode-v7-5-0
featured: false
draft: false
tags:
  - release
  - kilocode
  - ai-agents
  - vscode
  - cli
description: "Разбор минорного релиза Kilo Code 7.5.0: action `answer` для managed-сессий, превью редактирований в боковой панели Agent Manager, центр использования провайдера в CLI и VS Code, document inspector для Markdown-файлов, а также история сессий по проектам и поддержка PowerShell 7."
---

[`Kilo Code`](https://github.com/Kilo-Org/kilocode) выпустил минорный релиз [`v7.5.0`](https://github.com/Kilo-Org/kilocode/releases/tag/v7.5.0). Основная тема релиза — Agent Manager: у оркестрирующих агентов появляется настоящий action для ответа на зависший вопрос, редакторские изменения открываются прямо в боковой панели, а Markdown-артефакты можно просматривать и ревьюить, не покидая сессию. Плюс общий для CLI и VS Code центр использования модельных планов.

Источники для разбора — GitHub Release [`Kilo-Org/kilocode@v7.5.0`](https://github.com/Kilo-Org/kilocode/releases/tag/v7.5.0), compare [`v7.4.0...v7.5.0`](https://github.com/Kilo-Org/kilocode/compare/v7.4.0...v7.5.0), PR [#13372](https://github.com/Kilo-Org/kilocode/pull/13372), [#13306](https://github.com/Kilo-Org/kilocode/pull/13306), [#11611](https://github.com/Kilo-Org/kilocode/pull/11611), [#13245](https://github.com/Kilo-Org/kilocode/pull/13245), [#13407](https://github.com/Kilo-Org/kilocode/pull/13407), [#13369](https://github.com/Kilo-Org/kilocode/pull/13369), [#13365](https://github.com/Kilo-Org/kilocode/pull/13365), [#13358](https://github.com/Kilo-Org/kilocode/pull/13358) и [#13393](https://github.com/Kilo-Org/kilocode/pull/13393). Это semver-boundary релиз `7.5.0`; статье соответствует именно minor-версия.

## Agent Manager может теперь отвечать на зависший вопрос

Главное для оркестрации изменение — [#13372](https://github.com/Kilo-Org/kilocode/pull/13372) `feat(agent-manager): answer pending questions`. Раньше Agent Manager умел только _распознавать_, что сессия ждёт пользовательского ввода, но не _резолвить_ этот ожидающий вопрос. Если оркестратор писал сообщение в такую сессию, он либо ждал idle timeout, либо вынужден был останавливать сессию.

В `7.5.0` добавлен action `answer`, который отвечает на pending question через существующий question reply route. Ключевое поведение из PR: заблокированный prompt теперь падает _немедленно_ и включает точные данные для follow-up — session ID, question ID, сам текст вопроса и labels опций. То есть оркестратор больше не гадает, в каком состоянии сессия и что ей можно ответить.

Мост проверяет владение сессией, владение вопросом и кардинальность ответа (не отправит дубль). Если вызвавший указал не ту сессию, ошибка перечисляет сессии, у которых действительно есть pending questions. Автор PR явно ограничивает область действия: action `answer` не открывает доступ к pending permission requests — они по-прежнему резолвятся только через UI.

Примерный контракт действия из описания: вместо «напиши в сессию и жди» оркестратор получает мгновенный ответ «сессия ждёт ввода» с именованным вопросом и теперь может целенаправленно ответить через `answer`:

```text
Prompt -> session waits on input
  -> error: pending question <questionId> "Выбрать план?" [Plan A, Plan B]
follow-up: answer <questionId> "Plan B"
```

## Превью edit/write/patch в боковой панели вместо новой вкладки

[#13306](https://github.com/Kilo-Org/kilocode/pull/13306) `feat(agent-manager): preview edits in side panel` меняет то, как открываются изменения из managed-сессии Agent Manager. Раньше результат `edit`, `write` и `apply_patch` открывался в отдельной вкладке редактора. Теперь он остаётся в боковой панели Agent Manager: клик по имени файла или инструмента разворачивает изменение inline, а отдельная кнопка open-diff показывает полный diff в панели.

Важные детали реализации: превью поддерживает multi-file `apply_patch` payload — каждый изменённый файл открывается отдельно и «сайзится» под свой diff; пустые и нераспарсенные patch-записи отфильтровываются. Панель переиспользует существующую настройку unified/split-вида из полноценного review. Вне Agent Manager старый standalone diff-tab flow остаётся как был.

Это убирает «прыжок» между Agent Manager и редактором при каждом редактировании: изменения видно в контексте сессии, а в сам редактор можно перейти осознанно.

## Центр использования провайдера в CLI и VS Code

[#11611](https://github.com/Kilo-Org/kilocode/pull/11611) `feat: add provider usage center` добавляет secret-free Provider Usage Center, общий для CLI (TUI), SDK и VS Code Profile. Core теперь владеет обнаружением провайдера, нормализацией, source-scoped кэшем, coalescing'ом в полёте, stale fallback'ом и изоляцией сбоев.

Покрываются два источника планов:

- managed MiniMax-подписки через Cloud tRPC с read-only `coding_plan` BYOK-записью — они помечаются **KILO GATEWAY** и поддерживают Plus, Max и Ultra;
- локально настроенные MiniMax Token Plan credentials — помечаются **DIRECT**.
- Kilo Pass остаётся на старом profile transport и показывается первым в «Plans & usage» вместе с платными и бесплатными бонусными кредитами.

Managed-карточка появляется только при активной read-only BYOK-записи `coding_plan`; при отсутствии, disabled, user-managed или недоступной routing-метаданной никакая managed-карточка и запрос квоты не создаются. Unified text/image квота MiniMax сохраняется, а неподдерживаемые video-only строки отбрасываются. Личный top-up показывается прямо под Balance, а не среди provider plans.

В публичном контракте это `GET usage` / `POST refresh` в HTTP API `packages/opencode`, secret-free schema в `packages/schema` и typed client в `packages/sdk`. В TUI план загружается при открытии и обновляется `Ctrl-R`; в VS Code Profile — при открытии с кнопкой Refresh.

## Document inspector: ревью Markdown-файлов внутри Agent Manager

[#13245](https://github.com/Kilo-Org/kilocode/pull/13245) `feat(vscode): add Agent Manager document inspector` позволяет открывать и ревьюить Markdown/text-артефакты, не выходя из вида сессии. Это делает сгенерированные планы и другие agent-produced документы удобнее для просмотра, обсуждения и отправки обратно агенту.

Что даёт inspector:

- ссылки на файлы плана и артефакты открываются в отдельной панели Documents;
- per-worktree вкладки документов со стандартными иконками file-type;
- отрендеренный Markdown и source-вид, плюс безопасная обработка text, image, binary и oversized-файлов;
- inline Markdown review comments: черновик, редактирование, удаление или отправка в активную сессию;
- preview-действия из изменённых Markdown-файлов в diff viewer;
- видимость тулбара документов привязана к текущему worktree, включая close-поток для пустой панели;
- локализованные labels для документов и планов.

UI документов живёт в `webview-ui/agent-manager/documents/`, а чтение файлов проходит через проверки containment и размера перед выдачей содержимого — это явная защита от чтения файлов вне допустимой области.

## История сессий по проектам вместо бокового списка

Один из самых заметных UI-патчей — [#13407](https://github.com/Kilo-Org/kilocode/pull/13407). Раньше в сайдбаре Agent Manager для каждого проекта рисовалась inline-секция SESSIONS, которая показывала только unassigned root-сессии, росла внутри сайдбара и выталкивала остальное содержимое проекта. Теперь сессии спрятаны за project-scoped кнопку истории.

В single-project режиме кнопка находится в заголовке WORKTREES; в multi-project — у каждого ряда проекта (включая collapsed). Открытие кнопки активирует проект и фильтрует вкладку Local history только по его сессиям. У строк сессий на hover появились прямые действия:

- кнопка branch — открывает сессию в недавно созданном worktree через существующий promote flow;
- кнопка local-computer — переносит сессию в корень проекта и открывает в локальных вкладках проекта.

Убранные строки сессий также исключены из клавиатурной навигации сайдбара, чтобы shortcuts не попадали в невидимые элементы; сами сессии остались доступны через project history и search palette.

С этим связаны несколько сопровождающих фиксов истории: [#13421](https://github.com/Kilo-Org/kilocode/pull/13421) (project-scoped history activation и размещение сессий), [#13428](https://github.com/Kilo-Org/kilocode/pull/13428) (перекрытие activation-ов не оставляет stale project-switch state), [#13448](https://github.com/Kilo-Org/kilocode/pull/13448) (ложные ошибки установки GitHub CLI при смене проектов), [#13304](https://github.com/Kilo-Org/kilocode/pull/13304) (корректная history при первом переключении worktree) и [#13429](https://github.com/Kilo-Org/kilocode/pull/13429) (сохранение позиции скролла сайдбара при удалении worktree).

## Ещё несколько заметных патчей

- **Отдельная настройка worktree в Kilo Settings**: [#13369](https://github.com/Kilo-Org/kilocode/pull/13369) переносит настройки worktree Agent Manager в редактор Kilo Settings и добавляет выбор проекта в multi-project workspaces. Это убирает рассеивание настроек по панелям.
- **PowerShell 7 по умолчанию**: [#13365](https://github.com/Kilo-Org/kilocode/pull/13365) теперь предпочитает PowerShell 7 вместо легаси Windows PowerShell 5.1 при запуске команд агента на Windows. `pwsh` ищется даже если его нет в PATH, setup и run-скрипты Agent Manager стартуют pwsh когда доступен, а явный `shell` в `kilo.json` по-прежнему переопределяет автоопределение.
- **Фоновые субагенты по умолчанию**: включены по умолчанию с автозавершением-уведомлениями и promotion'ом foreground → background. Работающие фоновые агенты появляются в collapsible полосе в хедере чата. [#13393](https://github.com/Kilo-Org/kilocode/pull/13393) позволяет каждому foreground-субагенту независимо продолжить в фоне, в том числе при параллельном запуске нескольких; [#13425](https://github.com/Kilo-Org/kilocode/pull/13425) убирает stale-карточки фонового promotion, а [#13450](https://github.com/Kilo-Org/kilocode/pull/13450) не даёт завершённым сессиям застревать в working-состоянии.
- **Превью review-комментариев в чате**: [#13358](https://github.com/Kilo-Org/kilocode/pull/13358) показывает текст комментария сразу в сообщении, без клика: каждая запись — ряда file+line с двухстрочным превью, разворачивается на месте, а длинные списки сворачиваются в «Show more». Открытие исходника из комментария использует нативный VS Code editor tab.
- **Модельный selector и провайдеры**: [#13309](https://github.com/Kilo-Org/kilocode/pull/13309) позволяет поиску по моделям матчить префикс провайдера в colon-раздельных именах моделей; [#13405](https://github.com/Kilo-Org/kilocode/pull/13405) убирает кнопку сброса модели из prompt-контролов.

## Кому стоит обновиться

`7.5.0` в первую очередь для тех, кто активно использует Agent Manager для оркестрации: action `answer` избавляет от «пиши в сессию и жди таймаута», а side-panel diff и document inspector убирают прыжки между Agent Manager и редактором при ревью изменений и планов. Пользователям CLI и VS Code с платными MiniMax/Kilo Pass стоит взглянуть на новый Plans & usage, а командам на Windows — на автоматический выбор PowerShell 7.

Это полноценный minor-релиз `7.5.0`, где все четыре minor-изменения сконцентрированы вокруг Agent Manager и единого центра использования провайдера; патчи в основном закрывают проблемы именно этого нового UI.

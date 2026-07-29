---
author: Артём Нецветаев
pubDatetime: 2026-07-29T05:42:09.000Z
title: "OpenChamber 1.17.0: Linux AppImage, control plane для агентов и новый context panel"
slug: openchamber-v1-17-0
featured: false
draft: false
tags:
  - release
  - openchamber
  - ai-agents
  - linux
  - cli
description: "Разбор OpenChamber 1.17.0: официальные Linux AppImage для x64/arm64, управляемые агентами сессии, worktree и расписания, composer на CodeMirror, surface rail с live PR checks и переработанный sidebar."
---

[OpenChamber](https://github.com/openchamber/openchamber) выпустил минорный релиз [`v1.17.0`](https://github.com/openchamber/openchamber/releases/tag/v1.17.0). В нём сразу несколько крупных пользовательских контуров: официальный Desktop для Linux, единая control plane для агентов и CLI, новый контекстный panel вместо набора несогласованных сайдбаров, а также composer на CodeMirror.

Основа статьи — GitHub Release [`v1.17.0`](https://github.com/openchamber/openchamber/releases/tag/v1.17.0), compare [`v1.16.0...v1.17.0`](https://github.com/openchamber/openchamber/compare/v1.16.0...v1.17.0) и исходные изменения: [Linux Desktop #2398](https://github.com/openchamber/openchamber/pull/2398), [agent/CLI control plane #2408](https://github.com/openchamber/openchamber/pull/2408), [composer #2419](https://github.com/openchamber/openchamber/pull/2419), [context panel #2418](https://github.com/openchamber/openchamber/pull/2418), [sidebar #2480](https://github.com/openchamber/openchamber/pull/2480) и [quota providers #2415](https://github.com/openchamber/openchamber/pull/2415).

## Linux Desktop: AppImage для x64 и arm64 — с обновлениями, tray и «Open in»

Релиз включает официальные AppImage для `x64` и `arm64`; release workflow теперь собирает и публикует Linux-артефакты, а финальная проверка релиза ждёт их публикации. Это не просто упаковка web-интерфейса: Linux-пакет получил нативные возможности, прежде доступные в основном на macOS/Windows.

- окно Electron на Linux стало frameless и использует встроенные кнопки управления окном;
- закрытие или сворачивание можно отправить в system tray, а запуск при входе в систему реализован через XDG autostart;
- поддержаны несколько нативных окон;
- `Open in` умеет находить приложения из `.desktop`-файлов в XDG application directories и открывать в них проекты и файлы;
- updater использует отдельные манифесты `latest-linux.yml` и `latest-linux-arm64.yml`.

Для AppImage есть важные практические условия, зафиксированные в документации релиза: приложение должно лежать на доступном для записи пути, иначе in-app update не сможет заменить файл. Для запуска обычно нужен FUSE (`libfuse.so.2`); при его отсутствии предусмотрен обходной запуск:

```bash
APPIMAGE_EXTRACT_AND_RUN=1 ./OpenChamber-*-linux-*.AppImage
```

Отдельно исправлено поведение до первой публикации Linux feed: HTTP 404 для отсутствующего `latest-linux*.yml` теперь означает «обновлений нет», а не ошибку обновления. Напротив, ошибки недоступного AppImage, загрузки или capability updater больше не теряются в bridge: UI может показать их в About и sidebar.

## Агент и CLI получили общий control plane

[PR #2408](https://github.com/openchamber/openchamber/pull/2408) добавляет не набор несвязанных команд, а общий сервис управления. CLI обращается к `/api/openchamber/control`, а встроенный инструмент агента — к `/api/openchamber/agent-tool`; оба адаптера вызывают одну server-side логику сессий, worktree и scheduler.

У управляемого локального OpenCode появляется один native tool `openchamber` с фиксированным allowlist. Он умеет выполнять действия `projects.list`, `models.list`, `session.list/create/send/fork/status/messages` и `schedule.list/create/run/delete/toggle`. Это значит, что агент может создать пользовательскую сессию, при явном запросе — подготовить изолированный worktree, отправить prompt и затем прочитать фактический статус или сообщения. У инструмента нет произвольного выполнения shell-команд и нет удаления сессий либо регистрации произвольных путей проектов.

CLI получил соответствующие группы:

```text
openchamber projects
openchamber models
openchamber session create|send|fork|list|status|messages
openchamber schedule status|list|create|run|delete|enable|disable
```

У `session` предусмотрены `--wait`, `--timeout` и `--last-assistant`; server-side логика не считает начальный `idle` признаком завершения после dispatch. Для `create`, `send` и `fork` доступен Goal Mode. При создании goal сервер сначала сохраняет objective, затем записывает активную goal-метаинформацию в сессию и только после этого отправляет prompt — такой порядок предотвращает старт хода без поставленной цели.

В настройках появился флажок **Agent control tool**. Он включён по умолчанию, но после Save + Reload его можно выключить: plugin тогда не инжектируется и не занимает контекст модели. Это существенно, потому что декларация инструмента добавляет примерно 1,5 тыс. токенов в managed-сессию.

В чат добавлен starter `/schedule-task`: он проводит пользователя через постановку scheduled task и предлагает создать её только после явного подтверждения. Для созданных через control plane сессий sidebar получает live event, а не ждёт появления записи в сохранённой истории.

## Context panel стал единой поверхностью для кода, Git, terminal и PR

В [#2418](https://github.com/openchamber/openchamber/pull/2418) старый right sidebar, нижний terminal dock и несколько overlay-механизмов заменены registry поверхностей и вертикальной surface rail справа от context panel. В одном месте теперь переключаются editor, Changes/Git, pull request, diff, terminal, plan, project notes, context breakdown, browser/preview и split chat. Порядок и ручная ширина поверхностей сохраняются; terminal остаётся keep-alive поверхностью, поэтому xterm не уничтожается при переключении.

Git-поверхность теперь начинается с changes и commit. Pull request вынесен в отдельную поверхность с вкладками **Overview**, **Checks** и **Comments**:

- Checks показывает агрегат, workflow, длительность, детали шагов и annotations упавших jobs; пока есть незавершённые runs, данные обновляются каждые 35 секунд;
- повторные check runs дедуплицируются по `(app, name)`, как на GitHub;
- Comments отображаются inline timeline и позволяют передать один комментарий агенту или добавить все;
- comment и failed check добавляются не как немедленный prompt, а как закреплённые chips контекста в composer — включая draft новой сессии.

Серверная часть добавляет `fetchedAt` к PR status/context и не позволяет старому ответу cache/poll перезаписать более свежий. Для снижения GitHub rate-limit используются conditional GET с ETag, 45-секундный кэш списка PR на репозиторий и 30-секундный кэш PR context. Если search fallback не находит PR для ветки, результат backoff'ится на десять минут, чтобы не сжигать ограниченную Search API квоту при каждом poll.

## Composer на CodeMirror: единая грамматика prompt и корректный mobile-ввод

До релиза composer строился из прозрачного textarea поверх зеркального div. Из-за этого подсветка не могла менять ширину глифов: реальный bold и italic ломали бы позицию caret, а на мобильных overlay вовсе отключался. [#2419](https://github.com/openchamber/openchamber/pull/2419) переносит редактор на CodeMirror: текст и caret живут в одном слое, а правила prompt собраны в модуль `composer/language/`.

Теперь непосредственно во время набора подсвечиваются и корректно разбираются:

- markdown `**bold**` и `*italic*`;
- строки внимания `!!! ...`;
- `@`-упоминания, `/`-команды и `#` snippets;
- file/agent mentions, attachment citations и `~path` (последний подсвечивается, но сам по себе не прикладывает файл).

Это не только визуальная переработка. Ветка устраняет расхождение прежних нескольких парсеров: токен больше не должен выглядеть как ссылка, но затем не разрешаться при отправке. File mention можно редактировать на месте. На мобильных composer растёт по содержимому вместо отдельного fullscreen-жеста, а переносы строк и soft keyboard больше не расходятся с caret.

## Sidebar и usage: меньше скрытых экранов, больше ясных данных

Sidebar получил зоны **Recent** и проектов, а sessions можно показывать в двух режимах: **By worktree** (по умолчанию) или **Flat list**. Первый сохраняет заголовки worktree, индикаторы ветки и PR badge, второй объединяет сессии проекта в список по активности. Scheduled tasks, archived sessions, multi-run и worktree management теперь открываются как полноценные страницы, а не спрятаны в маленьких диалогах и кнопках.

В usage dashboard появились CrofAI и NeuralWatt — и на web server, и в VS Code extension. CrofAI показывает доступный баланс `credits` как денежное значение без искусственно вычисленного процента. NeuralWatt умеет одновременно отобразить:

- подписку: использованные `kwh_used` из `kwh_included`, а `in_overage` трактуется как 100%;
- независимый allowance ключа: `spent_usd` от эффективного лимита `min(limit_usd, credits_remaining + spent_usd)`; `blocked` также показывает 100%;
- credits balance — только когда allowance отсутствует, чтобы не считать одни и те же кредиты дважды.

Все provider-запросы имеют 15-секундный timeout; 401, невалидный JSON и timeout превращаются в различимые состояния UI, а не в фиктивный нулевой usage.

## Что ещё исправлено

Среди заметных исправлений: GitHub Copilot Small Model теперь выбирает поддерживаемый endpoint вместо Chat Completions для неподдерживающих его моделей; Markdown code blocks перестали сдвигать строки и терять исходный текст при копировании; выбранный код сохраняет fences, язык и структуру блока при переносе в composer. Отправка сообщения при открытом permission prompt сначала отклоняет pending requests в сессии и subagents, затем ставит сообщение в очередь следующего хода. На Android terminal получает keyboard focus и корректно обрабатывает текст/backspace; Linux tray больше не вызывает intermittent freeze/crash во время streaming; iOS различает sandbox и production APNs endpoint, поэтому уведомления работают и в Xcode development builds.

`v1.17.0` особенно полезен тем, кто запускает OpenChamber локально на Linux, ведёт несколько worktree и хочет не только наблюдать за агентом, но и давать ему ограниченный, проверяемый интерфейс управления сессиями и расписаниями. Перед включением agent control tool стоит учитывать контекстную цену инструмента, а перед установкой Linux AppImage — обеспечить writable path и FUSE либо использовать `APPIMAGE_EXTRACT_AND_RUN=1`.

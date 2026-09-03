---
author: Артём Нецветаев
pubDatetime: 2026-09-03T02:32:13.000Z
title: "OpenAI Codex rust-v0.153.0: Vim undo/redo в композере, remote-маркетплейсы плагинов, авто-переподключение TUI и новый async-механизм вопросов"
slug: openai-codex-rust-v0-153-0
featured: false
draft: false
tags:
  - release
  - codex
  - openai
  - cli
  - vim
  - tui
  - plugin
  - mcp
description: "Разбор OpenAI Codex rust-v0.153.0: полный Vim undo/redo в композере с восстановлением черновиков, паст и вложений (u / Ctrl+R, vim_normal.redo), управление плагинами из remote-маркетплейсов через CLI, конфиг tui.auto_recap для отключения авто-рекапов, подробная история TUI с полными патчами и вводом в фоновые терминалы, авто-переподключение TUI после обрыва app-server, переходы Guardian под Full Access и User approval, скоуп MCP-approvals под аккаунт, request_user_input_async вместо send_user_message_async, tui.disable_paste_burst и экспериментальный features.context_management.experimental_mode."
---

OpenAI выпустила [`rust-v0.153.0`](https://github.com/openai/codex/releases/tag/rust-v0.153.0) — очередной minor-релиз Codex. Главные темы — Vim-композер добирается до полноценного undo/redo, TUI становится устойчивее к обрывам связи и к раскрытию истории, а плагинами можно управлять прямо из CLI, включая remote-маркетплейсы.

Ниже — разбор GitHub Release и связанных PR: [`#41941`](https://github.com/openai/codex/pull/41941), [`#42140`](https://github.com/openai/codex/pull/42140), [`#42150`](https://github.com/openai/codex/pull/42150), [`#42101`](https://github.com/openai/codex/pull/42101), [`#41893`](https://github.com/openai/codex/pull/41893), [`#42107`](https://github.com/openai/codex/pull/42107), [`#42142`](https://github.com/openai/codex/pull/42142), [`#41911`](https://github.com/openai/codex/pull/41911), [`#41916`](https://github.com/openai/codex/pull/41916), [`#41918`](https://github.com/openai/codex/pull/41918), [`#42147`](https://github.com/openai/codex/pull/42147), [`#42256`](https://github.com/openai/codex/pull/42256), [`#42039`](https://github.com/openai/codex/pull/42039), [`#42135`](https://github.com/openai/codex/pull/42135), [`#42133`](https://github.com/openai/codex/pull/42133), [`#42117`](https://github.com/openai/codex/pull/42117), [`#42151`](https://github.com/openai/codex/pull/42151), [`#42178`](https://github.com/openai/codex/pull/42178), [`#41976`](https://github.com/openai/codex/pull/41976), [`#42385`](https://github.com/openai/codex/pull/42385).

## Vim undo и redo в композере

PR [`#41941`](https://github.com/openai/codex/pull/41941) добавляет в Vim-режим композера ограниченную историю undo на уровне черновика: клавиша `u` (конфигурируемый дефолт в normal mode) возвращает состояние. Ключевой нюанс — черновик композера кроме видимого текста несёт вложения, mention-цели и отложенные paste-полезки, поэтому undo восстанавливает **всё** это состояние как единую правку. Полные Vim-команды и insert-сессии группируются в шаги undo, включая прямые изменения композера (пасты и вложения).

PR [`#42140`](https://github.com/openai/codex/pull/42140) добавляет redo: ограниченный стек redo восстанавливает полные черновики (включая paste-payloads и image-вложения), а `Ctrl+R` в Vim normal mode повторяет последнюю отменённую правку. Новые правки очищают устаревший redo-историю. В схему keymap добавлен конфигурируемый action `vim_normal.redo`:

```toml
[tui.keymap]
# пример переопределения redo доступен через палитру keymap
# vim_normal.redo = { keys = [...] }
```

Отдельно сохраняется состояние undo/repeat/поиска при отмене reverse-history превью, а при принятии нового промпта история начинается заново. Пэндящие снапшоты правок держатся вне общего byte-бюджета undo/redo, чтобы отменённые команды не вытесняли зафиксированную историю.

## Remote-маркетплейсы плагинов в CLI

PR [`#42150`](https://github.com/openai/codex/pull/42150) расширяет работу с плагинами с локального каталога до удалённых маркетплейсов через существующий CLI:

- `codex plugin list` теперь включает remote-записи каталога — с источником, версией, install-политикой и auth-политикой в JSON-выводе;
- добавление и удаление remote-плагинов поддерживается теми же командами, что и локальные;
- remote-каталоги кешируются по scope и collection: используются свежие кешированные результаты, а при промахе адд-запроса кеш перечитывается один раз;
- локальный curated-каталог сохраняется, если безусловный remote-list упал; ошибки всплывают только для явно выбранных remote-маркетплейсов.

Рядом [`#42114`](https://github.com/openai/codex/pull/42114) централизует remote-мутации плагинов в `PluginsManager`, а [`#42149`](https://github.com/openai/codex/pull/42149) апгрейдит Git-маркетплейсы из merged-конфигурации.

## История TUI: полные патчи, ввод в фоновые терминалы и отдельные команды

Два PR делают историю сессии заметно информативнее. [`#41893`](https://github.com/openai/codex/pull/41893) эмитит **отдельную ячейку истории на каждую завершённую команду** вместо свёртки нескольких подряд успешных команд в одно `Ran N commands`. Группировка `Explored` для связанных чтений файлов, поисков и листингов сохраняется, а при повторном воспроизведении каждая команда воспроизводится отдельной записью со своим выводом и статусом.

[`#42107`](https://github.com/openai/codex/pull/42107) рендерит прямо в ячейках истории **полные патчи** и весь ввод, отправленный в фоновые терминалы, убирая preview-строку и byte-лимиты (раньше у превью было ограничение ~12 строк) и соответствующие транскрипт-хинты — inline и транскрипт-виды теперь содержат одинаковый контент.

## Отключение авто-рекапов: `tui.auto_recap`

PR [`#42101`](https://github.com/openai/codex/pull/42101) добавляет настройку `tui.auto_recap` (по умолчанию включена). При отключении отменяются запланированные авто-рекапы, отклоняются автоматические запросы и отбрасываются pending-результаты без ретраев:

```toml
[tui]
auto_recap = false
```

Ручной `/recap` при этом остаётся доступен независимо от настройки.

## Ранние предупреждения о rate-limit для Plus и Team

PR [`#42142`](https://github.com/openai/codex/pull/42142) добавляет раннее предупреждение для пользователей тарифов Plus и Team: когда в примерно пятичасовом окне использования остаётся менее **50%**, пользователь получает уведомление. Существующие пороги 75%, 90% и 95% для других планов и других длин окон сохраняются, а предупреждения продолжают дедуплицироваться между катящимися обновлениями rate-limit.

## Авто-переподключение TUI после обрыва app-server

Серия PR делает TUI устойчивым к потере соединения с внешним app-server. [`#41911`](https://github.com/openai/codex/pull/41911) переводит сессию в offline-состояние при обрыве транспорта (на старте, во время event-streaming или submission): черновики диалога, очередь ввода, развёрнутые пасты, вложения и agent-overview-ввод остаются редактируемыми, но блокируются submission, remote-действия и авто-replay очереди. Показывается уведомление о потере соединения с призывом скопировать работу и перезапустить; работают `Ctrl-C` и `Ctrl-D` на пустом композере как quit-шорткаты. Stale-события после обрыва игнорируются.

[`#41916`](https://github.com/openai/codex/pull/41916) добавляет автоматическое переподключение out-of-process сессий: бутстрапится свежий клиент, активный тред возобновляется, а кешированные транскрипты, черновики, runtime-настройки, capabilities task-инструментов и маршрутизация live-уведомлений сохраняются через новое соединение. Востановленные или возможно отправленные входы остаются на паузе для ручного просмотра, а не пересылаются; сессии, которые нельзя возобновить, доступны как read-only кешированные виды. [`#41918`](https://github.com/openai/codex/pull/41918) восстанавливает навигацию агентов после переподключения.

## Guardian: Full Access и User approval

Два PR сокращают работу модели-охранника там, где она избыточна. [`#42147`](https://github.com/openai/codex/pull/42147): Full Access (уже `approvalPolicy: "never"` с неограниченными правами) **пропускает Guardian-ревью** для confirmation-only действий — без синхронного ревью, sampler-prewarm и background-scoring. Пендинг/упавшие/ограниченные окружения не считаются Full Access, а активное состояние прав переоценивается каждый turn, чтобы тред мог безопасно входить и выходить из Full Access.

[`#42256`](https://github.com/openai/codex/pull/42256): в режиме User approval (`approvalsReviewer: "user"`) пропускаются Guardian-преwarming и асинхронный scoring (включая смену ревьюера в ходе активного turn), обычные confirmation `node_repl.js` автоматически принимаются, а sensitive-action checks и запросы пользовательского ввода сохраняют прежнюю обработку.

## Guardian-история переживает компакцию и рестарты

[`#41879`](https://github.com/openai/codex/pull/41879) и [`#42065`](https://github.com/openai/codex/pull/42065) сохраняют историю Guardian-ревью через компакцию, перезапуски и пользовательские форки: evidence транскрипта переживает компакцию (shared transcript collection), а история — реконструкцию треда, уважая rollback-границы и изолируя историю субагентов.

## MCP: approvals скоупятся под аккаунт, macOS-запуск относительных путей

[`#42133`](https://github.com/openai/codex/pull/42133) исправляет утечку одобрений: запоминание app-tool approval только по коннектору и инструменту могло переиспользовать approval при вызове того же инструмента с другим выбранным аккаунтом. Теперь в ключ approval'а MCP-инструмента включается `link_id` приложения, и запомненный approval действует только на ту account-связку, что была одобрена. Вызовы под другой link или без link-selector запрашивают собственное одобрение.

[`#42117`](https://github.com/openai/codex/pull/42117) чинит запуск относительных путей MCP-исполняемых на macOS: из-за исторической проблемы `posix_spawnp` Rust откатывался на `fork` при комбинации относительного пути и рабочей директории. Теперь относительные macOS-исполняемые спавнятся напрямую через `posix_spawn`, сохраняя путь, `argv[0]`, рабочую директорию, окружение, stdio и process-group.

## Компакция rollout и форки от symlinked root

[`#42039`](https://github.com/openai/codex/pull/42039) распространяет компакцию холодных rollout-файлов на shared и forked-истории без отдельного режима. Параметр `local_thread_store_shared_compression` устаревает (всё ещё принимается в strict-конфигурации, но не меняет поведение), а `codex exec resume` читает сжатые rollout через compressed-rollout reader, когда выбирает тред по рабочей директории последнего turn. [`#42135`](https://github.com/openai/codex/pull/42135) позволяет форкать thread от symlinked `sessions` root: lineage rollout валидируется против canonical `sessions`/`archived_sessions`, symlinked-под root принимаются, а вложенные symlink'и, убегающие за root, отклоняются.

## App-server API: model-метаданные и `request_user_input_async`

[`#42151`](https://github.com/openai/codex/pull/42151) добавляет в shared `Thread`-объект и генерируемые схемы nullable-поля `model` и `reasoningEffort`. Текущие настройки отдаются для загруженных тредов, последние сохранённые — для незагруженных, по всем путям: read, list, start, resume, rollback, обновление метаданных и уведомления. Недоступные legacy/filesystem-only настройки остаются nullable, метаданные можно читать без загрузки треда и запуска queued-работы.

[`#42178`](https://github.com/openai/codex/pull/42178) заменяет `send_user_message_async` на структурированный `request_user_input_async`: принимает один или несколько вопросов с опциональными подсказанными ответами, позволяя turn'у продолжаться. Структурированная метаданных-вопросов цепляется к асинхронным агентским сообщениям с сохранением читаемого fallback-текста и пробрасывается через app-server события, thread history и схемы. Каталоги моделей, рекламирующие старое или новое имя инструмента, продолжают включать его.

## Конфигурация: `tui.disable_paste_burst` и context management

[`#41976`](https://github.com/openai/codex/pull/41976) переносит настройку отключения "paste burst" под секцию TUI. Предпочтительный ключ — `tui.disable_paste_burst`, верхнеуровневый `disable_paste_burst` остаётся как legacy-fallback; при наличии обоих приоритет у `[tui]`, с сохранением обычного приоритета слоёв конфигурации:

```toml
[tui]
disable_paste_burst = true
```

[`#42385`](https://github.com/openai/codex/pull/42385) добавляет выключенную по умолчанию конфигурацию `features.context_management.experimental_mode`. При включении для подходящих сессий ChatGPT Plus, Pro или Pro Lite на Codex-бэкенде активируются token-budget контекст, history-заметки и инструмент `new_context`:

```toml
[features.context_management]
experimental_mode = true
```

Область ограничена: API-key-сессии, кастомные провайдеры, credential-провайдеры, не-Codex эндпоинты и временные structured-треды остаются исключены.

## Итоги для обновления

1. **Vim.** В композере появился полноценный undo (`u`) и redo (`Ctrl+R`), восстанавливающие черновики целиком — с пастами и вложениями; redo настраивается через `vim_normal.redo` в keymap.
2. **Плагины.** CLI умеет list/install/remove плагинов из remote-маркетплейсов с кешированием каталогов по scope; local curated-каталог остаётся запасным при падении удалённого списка.
3. **TUI.** История показывает полные патчи, ввод в фоновые терминалы и отдельную запись на каждую команду; авто-рекапы отключаются через `tui.auto_recap = false`, сессии автоматически переподключаются после обрыва app-server, сохраняя черновики и транскрипты.
4. **Guardian.** Под Full Access и User approval ревью/скоринг пропускаются там, где это безопасно (Full Access — для confirmation-only действий; User approval — для background scoring), а история Guardian переживает компакцию и рестарты.
5. **MCP.** Запомненные approval'ы скоупятся под выбранный аккаунт (`link_id`), относительные MCP-исполняемые надёжнее стартуют на macOS.
6. **API/app-server.** В Thread-метаданных появились nullable `model`/`reasoningEffort`, а `request_user_input_async` пришёл на смену `send_user_message_async` для структурированных асинхронных вопросов.
7. **Конфигурация.** `tui.disable_paste_burst` стал предпочтительным ключом (top-level остаётся fallback'ом); появился выключенный по умолчанию `features.context_management.experimental_mode` для Plus/Pro/Pro Lite на Codex-бэкенде.

Релиз `0.153.0` заметно укрепляет повседневный сценарий: Vim-композер наконец поддерживает undo/redo, TUI переживает обрывы связи и показывает полную историю, а управление плагинами и approvals становится точнее — по маркетплейсам и по аккаунтам.

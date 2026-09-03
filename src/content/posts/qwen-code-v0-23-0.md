---
author: Артём Нецветаев
pubDatetime: 2026-09-03T11:47:44.000Z
title: "qwen-code v0.23.0: выходные стили с /output-style, бюджет токенов Goal, cross-session мессенджинг и OpenTUI-preview"
slug: qwen-code-v0-23-0
featured: false
draft: false
tags:
  - release
  - qwen-code
  - ai-agents
  - cli
  - web-shell
  - mcp
  - opentui
description: "Разбор qwen-code v0.23.0: выходные стили теперь выбираются из CLI (general.outputStyle, --output-style и /output-style) и переключаются на лету, добавлен настраиваемый бюджет токенов Goal (model.goalTokenBudget), cross-session мессенджинг получил отправку по имени, Channels — конкурентное управление именованными задачами, Workflow вынесен в daemon, а qwen serve открывает полный API на loopback и workspace-scoped MCP."
---

[`qwen-code`](https://github.com/QwenLM/qwen-code) выпустил минорную версию [`v0.23.0`](https://github.com/QwenLM/qwen-code/releases/tag/v0.23.0). Upstream не заявляет breaking changes. Это большой релиз (260 коммитов между `v0.22.3` и `v0.23.0`), главные темы которого: выходные стили наконец становятся выбираемыми и переключаемыми прямо из сессии, операторам дают жёсткий контроль над автономным окном Goal, а CLI учится становиться клиентом сам для себя — отправлять сообщения другим сессиям на той же машине, управлять Workflow и MCP через daemon, а также впервые открывает доступ к новому рендереру OpenTUI.

Источники: [GitHub Release](https://github.com/QwenLM/qwen-code/releases/tag/v0.23.0), [compare `v0.22.3...v0.23.0`](https://github.com/QwenLM/qwen-code/compare/v0.22.3...v0.23.0), а также ключевые PR: [#10283](https://github.com/QwenLM/qwen-code/pull/10283), [#10683](https://github.com/QwenLM/qwen-code/pull/10683), [#10543](https://github.com/QwenLM/qwen-code/pull/10543), [#10158](https://github.com/QwenLM/qwen-code/pull/10158), [#10411](https://github.com/QwenLM/qwen-code/pull/10411), [#10574](https://github.com/QwenLM/qwen-code/pull/10574), [#10420](https://github.com/QwenLM/qwen-code/pull/10420), [#10403](https://github.com/QwenLM/qwen-code/pull/10403), [#10679](https://github.com/QwenLM/qwen-code/pull/10679), [#9895](https://github.com/QwenLM/qwen-code/pull/9895), [#10514](https://github.com/QwenLM/qwen-code/pull/10514), [#10589](https://github.com/QwenLM/qwen-code/pull/10589) и [#10739](https://github.com/QwenLM/qwen-code/pull/10739).

## Выходные стили: от «недосягаемых» до смены на лету

В релизе `#9565` появились встроенные выходные стили, но способ выбрать один из них отсутствовал — управлять голосом агента можно было только через `--append-system-prompt` (разовая, неочевидная опция) или `QWEN_SYSTEM_MD` (полная замена системного промпта «всё или ничего»). `v0.23.0` закрывает эту дыру в три шага.

Во-первых, PR [#10283](https://github.com/QwenLM/qwen-code/pull/10283) добавляет выбор стиля при старте: настройку `general.outputStyle` и перекрывающий её CLI-флаг `--output-style <name>`. Имена резолвятся без учёта регистра к четырём встроенным стилям — `Concise` (результат первым, без воды), `Proactive`, `Explanatory`, `Learning` — поэтому `"outputStyle": "concise"` в `settings.json` и `--output-style Concise` на командной строке выбирают одно и то же:

```bash
qwen -p "Объясни, что делает этот репозиторий" --output-style Explanatory
```

Пустое значение или литерал `default` отключают стиль (`--output-style default` — способ снять стиль для одного запуска, если он задан в настройке). Неизвестное имя не фатально: CLI печатает `WARNING: Unknown output style "Verbose" (from general.outputStyle); using the default style. Available styles: Concise, Proactive, Explanatory, Learning.` и стартует со стилем по умолчанию, так что опечатка в общем `settings.json` не заблокирует запуск ни у кого в команде.

Во-вторых, PR [#10282](https://github.com/QwenLM/qwen-code/pull/10282) добавляет per-turn напоминание об активном стиле, чтобы при нестандартном стиле модель не раздувала ответы.

В-третьих, и это самое заметное, PR [#10683](https://github.com/QwenLM/qwen-code/pull/10683) добавляет команду `/output-style`, позволяющую смотреть и менять стиль прямо внутри запущенной сессии:

- голое `/output-style` открывает пикер со стилем по умолчанию и четырьмя встроенными, предвыбирая текущий действующий;
- `/output-style <name>` применяет стиль без учёта регистра;
- `/output-style default` очищает стиль;
- в неинтерактивных (`-p`) и ACP-сессиях голый вызов не открывает диалог, а сообщает текущий стиль и варианты.

Выбор сначала персистится (в trusted-воркспейс, если он владеет ключом `general.outputStyle`, иначе в пользовательские настройки), затем обновляет живой конфиг и пересобирает связанную системную инструкцию — следующая же реплика отвечает в новом стиле. Bare и safe-режимы изменения отклоняют, при ошибке персистенции живой стиль не меняется. Общая настройка `general.outputStyle` по-прежнему помечена как требующая рестарта — `/output-style` это отдельный путь живого обновления.

## Бюджет токенов Goal: настраиваемый и защищённый от опечаток

PR [#10543](https://github.com/QwenLM/qwen-code/pull/10543) делает автономное окно Goal, которое `#9891` включает на каждый новый Goal, настраиваемым для оператора. Новая настройка `model.goalTokenBudget` задаёт размер окна, измеряемого как суммарный `totalTokenCount` по вызовам модели в собственных turn-ах Goal:

```json
// settings.json
{
  "model": { "goalTokenBudget": 400000 } // 1 .. 300_000_000; -1 = без лимита
}
```

Положительное целое от 1 до 300 000 000 — это грант; `-1` означает без лимита; не задано — по-прежнему дефолт 30 000 000. `0`, значения выше потолка, другие отрицательные числа, дроби и не-числа отклоняются на старте (fail closed), а не молча расширяют бюджет. Когда Goal расходует окно, он получает один заключительный turn для передачи дел, затем останавливается до `resume`, которое вооружает новое окно. Side-query и проверки checkpoint-ов в замер не входят; Goal runtime сам не менялся. В PR приведено живое свидетельство: запуск с `model.goalTokenBudget: 400000` создал Goal c окном 400 000 токенов (`create ... tokenBudget=400000`) и завершился внутри него — до этого тот же запуск всегда нёс `tokenBudget=30000000`.

## Cross-session мессенджинг: теперь и отправка по имени

В `#9576` был добавлен приём сообщений между сессиями. PR [#10158](https://github.com/QwenLM/qwen-code/pull/10158) добивает отправку: сессия, у которой включён cross-session messaging, может обнаружить другие включённые сессии этой машины через `list_agents` и написать одной из них через `send_message` **по имени** — тому же имени, что печатает `qwen sessions ps`.

`list_agents` раскладывает достижимые сессии (зарегистрированные и отвечающие на сокете, с параллельным пробным запросом с капом 250 мс) под ключом `sessions`, каждая с `name`, коротким `ref` от session id, `cwd` и значением `to` — голое имя, если оно уникально, иначе `name [ref]`. Собственное имя/`ref` сессии отдаётся под `self`, чтобы модель узнавала саму себя в чужом сообщении и не пыталась писать себе. `send_message` получает третий маршрут (после `task_id` и in-process teammate): голое имя, точно совпадающее с одной живой сессией, доставляет; при двух сессиях с одним именем требуется `name [ref]`; неоднозначное голое имя отклоняется с кандидатами, а не угадывается — сообщение, инъецированное не в ту сессию, не отозвать.

Включение — по-прежнему `agents.crossSessionMessaging: true` в `settings.json`. Реализация настаивает на том, что сообщение другой сессии не несёт никакой авторитетности пользователя и не может быть использовано, чтобы та сессия выполнила действие, которое этой отказано. В PR есть живой tmux-транскрипт: сессия `alpha` в DEFAULT-режиме пишет `beta` в YOLO, та удерживает сообщение (HITL) и через `/peers accept` отпускает его; в `alpha` приходят отдельные рецепты `held`/`released`. Есть и новые статусы рецептов — `denied`, `expired`, `misaddressed` (адресат с другим session id, например из-за переиспользования PID).

## Channels: конкурентные именованные задачи и атомрибуция источника

PR [#10574](https://github.com/QwenLM/qwen-code/pull/10574) включает конкурентное управление именованными задачами в Channels — фоновые именованные задачи теперь могут выполняться, пока пользователь переключает контексты, и появляется поддержка `/session cancel`:

```bash
/session cancel <task-name>
```

Одновременно PR [#10420](https://github.com/QwenLM/qwen-code/pull/10420) добавляет метки атрибуции источника в вывод именованных Channel-задач — `[task]` или `[sender · task]` — чтобы при нескольких фоновых задачах и отправителях было видно, чей результат доставлен. В рамках конкурентных задач shared-контекст (рабочий каталог) по-прежнему общий, что отмечено как известное ограничение; изоляция по worktree на задачу — отдельная часть.

## Workflow: исполнение вынесено в daemon

PR [#10411](https://github.com/QwenLM/qwen-code/pull/10411) показывает исполнение Workflow через daemon как opt-in-расширение существующего контракта сессионных задач. Opt-in-клиенты видят живые и персистентные запуски с фазой, диспатчем, токенами, логами, одобрением, линиджем и терминальными состояниями; управляют активными запусками (cancel/pause/resume); перезапускают упавший или повторно запускают завершённый; удаляют историю и стартуют сохранённые определения.

Доступ через запрос с параметром:

```
GET /session/:id/tasks?includeWorkflows=true
```

(по умолчанию ответ содержит только прежние типы задач; opt-in добавляет Workflow-запуски). TypeScript SDK и общий WebUI daemon adapter получают отдельные Workflow-aware методы, сохраняя старые task-методы (agent/shell/monitor) без изменений. Вся поверхность Workflow гейтится одним правилом: функция включена, не bare-mode, trusted-воркспейс. `tools.workflowsEnabled` после `POST /workspace/reload` доставляется и живым сессиям. Формально breaking changes нет: legacy-эндпоинты и SDK-методы не трогаются.

## qwen serve: полный API на loopback, снятие public-only, workspace-scoped MCP

Три PR меняют поведение `qwen serve`.

PR [#10403](https://github.com/QwenLM/qwen-code/pull/10403) даёт **всю поверхность операторского API** локальным вызовам на loopback, когда слушатель привязан к loopback, bearer-токен не задан и `--require-auth` не включён. Раньше такой tokenless-режим отдавал часть API (нестрогие маршруты работали, строгие возвращали `token_required`, session shell не включался даже с флагом, часть Web Shell оставалась read-only). Теперь строгие mutation-маршруты, явно включённый session shell, pairing-материал Local Control и Channel-контролы Web Shell исполняются полностью. Внутренние контроли сохраняются: workspace trust, владение сессией и `X-Qwen-Client-Id`, permission-confirmation, feature flags, валидация ввода, лимиты ресурсов. Credential-auth отделён от deployment-authority: tokenless-локальные запросы не помечаются как bearer-аутентифицированные. Ужесточение на общих хостах и удалённых deployment-ах не меняется (non-loopback без токена, `--require-auth` без токена, wildcard CORS без токена — по-прежнему не стартуют/отклоняются).

PR [#10156](https://github.com/QwenLM/qwen-code/pull/10156) снимает ограничение **public-only** в extension-сетевой политике: `qwen serve` больше не требует, чтобы расширения тянулись только из публичных репозиториев — разрешена установка с приватных enterprise-Git-хостов.

PR [#10679](https://github.com/QwenLM/qwen-code/pull/10679) добавляет **workspace-scoped MCP management** в `qwen serve` — управление MCP-серверами теперь ограничено конкретным воркспейсом (добавление/изменение/удаление), а не глобально.

## Scoped workspace memory: явные границы между хранилищами

PR [#9895](https://github.com/QwenLM/qwen-code/pull/9895) добавляет необязательную цель `project` или `user` к sessionless managed-memory задачам `remember`/`forget` через workspace-qualified REST, ACP-extension-методы и TypeScript SDK. Выбранная цель жёстко исполняется на границе файловых прав скрытого агента: project-задача не может читать/писать user-память, user-задача — project-память, а scoped forget ищет только в запрошенном хранилище. Опущенная область сохраняет прежнюю автоматическую классификацию. Явный `remember` теперь завершается сразу после первой успешной записи managed-записи (раньше скрытый агент ждал ещё одного turn модели, из-за чего задача казалась зависшей после уже существующей записи). Новые capability-теги позволяют клиенту договориться о поддержке до показа контролов.

## Web Shell: standalone-чаты, панель Workspaces, чище сайдбар

PR [#10514](https://github.com/QwenLM/qwen-code/pull/10514) делает standalone-чаты полноценным продукт-контекстом WebShell: глобальный New task при доступной capability `standalone_sessions_v1` создаёт точную standalone-сессию (URL несёт `context=standalone` без workspace-параметра), появляется верхнеуровневый «Недавние» для standalone-сессий с активной/архивированной пагинацией и действиями rename/export/archive/unarchive/delete, deep-link-и валидируют точную standalone-сессию до монтирования провайдера. Поведение UI разделено: non-workspace-чаты не трогают project-only-навигацию, workspace-настройки, Git-состояние, split view, файловые ссылки, загрузки и Web Terminal, но прикреплённые standalone-сессии сохраняют daemon-поддержанные slash-команды, навыки, Shell и обычные инструменты. Старые daemon-ы без capability сохраняют legacy-поведение.

PR [#10589](https://github.com/QwenLM/qwen-code/pull/10589) добавляет панель **Workspaces overview**: список воркспейсов с количеством сессий, полными путями и детальными чипами для MCP-серверов, навыков, расширений и контекстных файлов. PR [#10606](https://github.com/QwenLM/qwen-code/pull/10606) разгружает воркспейс-сайдбар и добавляет loopback-действия открытия файлов/папок.

## OpenTUI: первый превью-ключ

Пришли первая активация нового TUI-рендерера за флагом. PR [#10739](https://github.com/QwenLM/qwen-code/pull/10739) включает OpenTUI-бэкенд за переменной окружения `QWEN_TUI_RENDERER`, а PR [#10814](https://github.com/QwenLM/qwen-code/pull/10814) добавляет отдельный gated-превью-флавор куда идущей сборки на bun. Это миграция TUI с ink на OpenTUI (design-doc и парт-логи в релизе помечены как таковые): пока превью, по умолчанию рендерер прежний.

```bash
QWEN_TUI_RENDERER=opentui qwen   # превью нового рендерера
```

Параллельно выполнена горячая перезагрузка провайдеров моделей: PR [#10582](https://github.com/QwenLM/qwen-code/pull/10582) позволяет `qwen serve` перезагружать `modelProviders` и обновлять реестры сессий без перезапуска и без смены текущей модели.

## Прочее из релиза

- **MCP в AUTO-классификаторе**: PR [#10352](https://github.com/QwenLM/qwen-code/pull/10352) пробрасывает ограниченные аргументы MCP-инструментов и server-аннотации в AUTO-классификатор, чтобы решение о доверенности выносилось по большему, чем просто имя инструмента.
- **send_message/компрессия**: PR [#9119](https://github.com/QwenLM/qwen-code/pull/9119) раздельно сообщает сбои API компрессии; модели, отклонённые с HTTP 413, автоматически проходят one-shot compaction и retry (`#10408`).
- **Review/Autofix**: PR [#10122](https://github.com/QwenLM/qwen-code/pull/10122) кладёт коды сходимости `rec` из `recommendations` (`root-cause-triage` / `batch-fixes` / `stem-surface`) в опубликованный ledger-маркер и добавляет circuit breaker: через `QWEN_AUTOFIX_CONVERGENCE_BREAK_ROUNDS` (дефолт 3) PR паркуется в конфликтном mold-е для человека; PR [#10423](https://github.com/QwenLM/qwen-code/pull/10423) пребилдит review-worktree до запуска агентов; [#10119](https://github.com/QwenLM/qwen-code/pull/10119) добавляет `qwen review emit-workflow`.
- **IP-безопасность**: PR [#10636](https://github.com/QwenLM/qwen-code/pull/10636) аутентифицирует cross-session inbox-соединения per-session-токенами, [#10764](https://github.com/QwenLM/qwen-code/pull/10764) даёт процессам сессии child-токен, который признаёт inbound gate.
- **Git UX**: branch-picker теперь показывает подсказки git-состояния (`↓3 · origin/main`, `Up to date`) у Update Project / Commit / Push (#10397); Update Project работает на грязном рабочем дереве через stash/discard (#10390); сессии, связанные с GitHub PR, показывают в тултипе закрытые этими PR issue и умеют искать по номеру issue (#10425); PR, созданные через `gh pr create` в session shell, привязываются к сессии (#9739).
- **DingTalk**: поддержан outbound-доставка файлов (#10893); репутационные промпты с конкретными деталями инструмента и скрытые внутренние ошибки в сообщениях о сбое (#10614).

## Итоги для обновления

1. **Выходные стили.** Выбираются на старте через `general.outputStyle` или `--output-style Concise|Proactive|Explanatory|Learning`, переключаются на лету командой `/output-style`. Миграция не требуется — стили по умолчанию выключены.
2. **Goal.** `model.goalTokenBudget` (1…300 000 000 или `-1` для безлимита) управляет автономным окном Goal; дефолт 30M, невалидные значения отклоняются на старте.
3. **Мессенджинг.** `agents.crossSessionMessaging: true` + `list_agents`/`send_message` по имени между сессиями одной машины; `/peers accept|deny` для удержанных сообщений.
4. **Channels.** Конкурентные именованные задачи + `/session cancel` + метки `[task]`/`[sender · task]`.
5. **serve/Workflow/MCP.** Полный операторский API на loopback без токена; снят public-only для расширений; workspace-scoped MCP; Workflow-контроль через daemon (`GET /session/:id/tasks?includeWorkflows=true`).
6. **Превью OpenTUI.** `QWEN_TUI_RENDERER=opentui` включает новый рендерер; по умолчанию — прежний ink.

`0.23.0` — минор без breaking changes: он делает «голос» агента управляемым изнутри CLI, даёт операторам жёсткий и защищённый бюджет автономии, замыкает первый рабочий контур межсессионного общения и раскрывает через daemon новые плоскости управления (Workflow, MCP) для быстрых локальных клиентов. Обновление безопасно, миграция конфигурации не требуется; самое заметное поведенческое добавление — новые команды, флаги и настройки, оставаясь при этом опциональными.

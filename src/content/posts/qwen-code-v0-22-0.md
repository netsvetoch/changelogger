---
author: Артём Нецветаев
pubDatetime: 2026-08-24T02:46:42.000Z
title: "qwen-code v0.22.0: ограничение памяти Web Shell, 11 неблокирующих slash-команд и привязка PR к сессиям"
slug: qwen-code-v0-22-0
featured: false
draft: false
tags:
  - release
  - qwen-code
  - ai-agents
  - cli
  - web-shell
  - mcp
description: "Разбор qwen-code v0.22.0: защита Web Shell от out-of-memory-крашей за счёт лимитирования transcript-истории, 11 неблокирующих slash-команд во время стриминга, привязка созданных GitHub PR к сессиям с бейджем и поиском, диагностика невылезающих review-циклов с машиночитаемыми кодами, growth-audit в Autofix, SDK-режим auto и opt-in для list_directory."
---

[`qwen-code`](https://github.com/QwenLM/qwen-code) выпустил минорную версию [`v0.22.0`](https://github.com/QwenLM/qwen-code/releases/tag/v0.22.0). Upstream не заявляет breaking changes. Релиз — по большей части про стабильность и веб-интерфейс: Web Shell учат не падать из-за памяти на длинных сессиях и быстрее стримить, review-циклы начинают объяснять «почему не сходится», а созданные из браузера PR привязываются к сессии, которая их сделала.

Источники: [GitHub Release](https://github.com/QwenLM/qwen-code/releases/tag/v0.22.0), [compare `v0.21.15...v0.22.0`](https://github.com/QwenLM/qwen-code/compare/v0.21.15...v0.22.0) (51 коммит / 50 PR), а также ключевые PR: [#9303](https://github.com/QwenLM/qwen-code/pull/9303), [#9495](https://github.com/QwenLM/qwen-code/pull/9495), [#9543](https://github.com/QwenLM/qwen-code/pull/9543), [#9461](https://github.com/QwenLM/qwen-code/pull/9461), [#9623](https://github.com/QwenLM/qwen-code/pull/9623), [#9262](https://github.com/QwenLM/qwen-code/pull/9262), [#9424](https://github.com/QwenLM/qwen-code/pull/9424), [#9003](https://github.com/QwenLM/qwen-code/pull/9003), [#9665](https://github.com/QwenLM/qwen-code/pull/9665) и [#9672](https://github.com/QwenLM/qwen-code/pull/9672).

## Web Shell: защита от out-of-memory-крашей и психологические лимиты истории

Главный по ощущениям фикс релиза — PR [#9303](https://github.com/QwenLM/qwen-code/pull/9303), который останавливает краши браузерного рендерера на перегруженных сессиях. Проблема была реальной: один 51-минутный turn, разветвившийся на сотни тысяч session-update событий, довёл Chrome-рендерер до ~5 GB RSS перед abort, и каждый перезапуск сессии заново переваривал безлимитный replay и снова вырастал до гигабайтов за считанные минуты.

Что меняется в удержании истории:

- replay-снимок, выкачиваемый при загрузке сессии, освобождается сразу после впрыска в transcript store;
- пересборка replay теперь работает под тем же лимитом block-ов, что и живой рост, и больше не может «раскачать» этот лимит выше настроенного — слишком большие replay обрезаются до самых свежих block-ов;
- диагностические block-и для нераспознанных типов session-update встраивают уже не весь payload, а урезанный фрагмент;
- панель detail subagent-а получила тот же лимит block-ов, что и остальной Web Shell;
- неявный дефолтный retention-окно provider-а опущено с 200k до 50k block-ов (все поверхности Web Shell и так передавали 50k явно).

В паре с ним идёт оптимизация стриминга [#9672](https://github.com/QwenLM/qwen-code/pull/9672): топ-уровневый хвостовой текст при стриминге обновляется по валидируемому summary изменения, не пересобирая весь retained transcript, а сверхбольшие простаивающие transcript-ы после 15 секунд тишины перезагружаются, удерживая свежее окно в 500 block-ов без тасовки trim/load.

Из UX-мелочей: PR [#9632](https://github.com/QwenLM/qwen-code/pull/9632) удерживает turn развёрнутым, пока его фоновый shell работает, и сворачивает только после завершения; индикатор загрузки (`#9631`) теперь опирается на живое состояние daemon-а `hasActivePrompt`, оставаясь видимым во время долгих tool-вызовов даже при простое стриминга; а [#9640](https://github.com/QwenLM/qwen-code/pull/9640) чинит скролл подсказок subagent-ов и немедленное сворачивание групп параллельных агентов.

## 11 slash-команд теперь работают во время стриминга

PR [#9495](https://github.com/QwenLM/qwen-code/pull/9495) расширяет «потокобезопасные» slash-команды (начинать их добавил [#8130](https://github.com/QwenLM/qwen-code/pull/8130), где были только `/about`, `/help`, `/settings`) ещё на одиннадцать встроенных. Пока модель стримит ответ, эти команды исполняются немедленно, не дожидаясь завершения текущего turn:

- только работают с UI-настройками: `/theme`, `/editor`, `/vim`, `/voice`, `/terminal-setup`;
- чисто read-only: `/tools`, `/lsp`, `/tasks`, `/hooks`, `/docs`, `/bug`.

То есть во время длинной генерации `/theme` мгновенно откроет выбор темы, а `/tools` — список инструментов, не трогая состояние занятого turn-а. Команды, которые читают/меняют состояние активного turn-а (`/context`, `/model`, `/stats`, `/copy`, `/diff`, `/export`), по-прежнему строго сериализованы и выполнятся только после завершения ответа. У каждой opt-in-команды есть unit-тест, фиксирующий `canRunDuringStreaming`.

## Созданные GitHub PR привязываются к сессии

PR [#9543](https://github.com/QwenLM/qwen-code/pull/9543) решает вопрос «какая сессия сделала этот PR» для пользователей Web Shell с десятками одновременных сессий. PR, созданный через Git-диалог Web Shell, привязывается к сессии:

- в сайдбаре рядом с названием сессии появляется бейдж с номером PR — `#9517` или `#9517 +2`, если их несколько (клик открывает PR);
- тап-тултип сессии перечисляет все привязанные PR (свежие первыми);
- поиск по сессиям теперь матчит номер PR (с `#` или без), имя ветки и slug worktree-а — по номеру PR за пару секунд находится нужная сессия, включая старые PR сессии, сделавшей несколько;
- одна сессия держит до 10 привязок (самые старые вытесняются), список сохраняется в per-session sidecar-файл и переживает рестарт daemon-а, архив и разархивирование сессии.

Протокольно привязка пишется через `PATCH /workspaces/:w/session/:id/metadata`:

```json
{ "pr": { "number": 9517, "url": "https://github.com/o/r/pull/9517" } }
```

URL строго ограничен http(s) (он рендерится как ссылка); невалидный payload (нецелочисленный `number`, отсутствующий URL, `javascript:`-URL, пустой body) возвращает `400 invalid_metadata`. Привязка работает только через Git-диалог — PR, созданные агентом через `gh pr create` в shell, автоматически не подхватываются.

## Review и Autofix: почему цикл не сходится, и что с этим делать

Два фича-PR доводят review-автоматику до предсказуемости.

PR [#9461](https://github.com/QwenLM/qwen-code/pull/9461): когда review-цикл перестаёт сходиться, он говорит об этом явно и объясняет, почему — одним абзацем для человека, который решает, что делать дальше. Срабатывают два сигнала, оба считаются по сравнению между собственными раундами PR, а не от фиксированного порога:

- **рецидив**: файл, у которого был finding в раннем раунде и теперь их больше (join по файлу, детерминированный);
- **не падающий объём**: с третьего раунда текущий раунд постит inline-комментариев не меньше предыдущего.

Абзац сначала констатирует измеренные факты, затем даёт чтение на уровне процесса (сначала разобрать общий корень; вынести независимый кластер в отдельный PR; добрать остаток батчем; либо опустить review «этого PR» до планки только Critical), но никогда не предписывает, как реструктурировать код.

PR [#9623](https://github.com/QwenLM/qwen-code/pull/9623) добавляет к этому машиночитаемую половину — `recommendations: [{code, basis}]` в результате compose-а. Это закрытый набор кодов, выводимых строго из фактов текущего раунда:

- `root-cause-triage` — файлы с finding-ами и раньше, и сейчас;
- `batch-fixes` / `stem-surface` — тренд, который не падает (вторая — только пока осталась нижняя «ступень» лимита);
- `land-and-defer` — раунд без Critical, значит цикл можно закрыть merge-ом.

Проза абзаца генерируется из той же деривации, что и коды, поэтому голос человека и код для машины не могут описать разные раунды. Плюс «механическое здоровье»: если пост-филинг распознал раунд как critical, а бэкстоп проглотил, или два раунда подряд удержали инкрементальный anchor — цикл теперь говорит об этом вслух, хотя и ничего не делает по сигналу.

PR [#9262](https://github.com/QwenLM/qwen-code/pull/9262) меняет смысл превышения growth-бюджета в takeover-раундах Autofix: вместо жёсткой остановки автоматизации происходит **growth-audit**. Агент аудитит подход самого PR по двум осям — KISS (назвать структурно более простое решение либо доказать, что каждый накопленный кусок «несущий») и minimal change (каждый изменённый hunk должен трассироваться к проблеме PR, принятому finding-у или падающей проверке) — и пишет машиночитаемый вердикт, который verification gate требует до любого push:

- `sound` — окно перезапускается на текущем размере, цикл продолжает решать;
- `drift` — сначала упростить, затем продолжить;
- `conflict` — единственный рост-путь, доходящий до человека; паркуется идемпотентно.

Репо-переменная `QWEN_AUTOFIX_GROWTH_DIVERGENCE_ROUNDS` при этом удалена из использования (становится инертной).

## SDK: единый `auto`-режим доверенности

PR [#9003](https://github.com/QwenLM/qwen-code/pull/9003) даёт Python и Java SDK единый с CLI и TypeScript SDK режим доверенности через LLM-классификатор:

```python
client = Qwen(permission_mode="auto")   # раньше: ValidationError
```

Раньше клиентская валидация Python SDK отклоняла `auto` до попадания в CLI (`Invalid permission_mode: 'auto'. Expected one of: default, plan, auto-edit, yolo.`) — запустить сессию в этом режиме было нельзя, а runtime-переключение работало только потому, что обходило локальную проверку. Теперь `permission_mode="auto"` принимается и передаётся в CLI как `--approval-mode auto`. В Java SDK в `PermissionMode` добавлена константа `AUTO` (с `getValue() == "auto"`), транспорт просто пробрасывает значение.

## `list_directory` теперь opt-in

PR [#9424](https://github.com/QwenLM/qwen-code/pull/9424) переводит встроенный инструмент `list_directory` в opt-in: по умолчанию он больше не регистрируется и не попадает в список инструментов/промпт модели, чтобы не тратить токены на почти дублирующий `glob`-инструмент. Включить можно двумя способами:

```json
// settings.json
{ "tools": { "listDirectory": { "enabled": true } } }
```

```bash
qwen --core-tools read_file,list_directory
```

Действующий allowlist `coreTools`, не содержащий инструмент, по-прежнему имеет приоритет над settings-флагом. Вызов без включения вернёт `Tool "list_directory" not found in registry`.

## `qwen serve`: восстановление HITL после рестарта

PR [#9665](https://github.com/QwenLM/qwen-code/pull/9665) добавляет opt-in-флаг daemon-а `qwen serve --restore-ask-user-question` (по умолчанию выключен). После перезапуска daemon-а `session/load` и `session/resume` теперь могут заново повесить висящий в хвосте неотвеченный `ask_user_question` как голосуемый HITL вместо того, чтобы закрывать его как упавший tool-результат: выдаётся новый `requestId`, а после голосования через `POST /session/:id/permission/:requestId` пишется реальный function response, и модель продолжает тот же turn.

## Что ещё в релизе

- **Безопасность и зависимости**: песочный образ теперь привязан к конкретному pulled-digest, чтобы переменные теги нельзя было подменить между resolve и consumption ([#9527](https://github.com/QwenLM/qwen-code/pull/9527)); подняты OpenTelemetry 0.221.x и markdown-it 15 ради высоких CVE, security gate стал жёстким блоком ([#9584](https://github.com/QwenLM/qwen-code/pull/9584)); бампнуты tar, protobufjs, dompurify и echarts на пропатченные версии без изменения кода ([#9703](https://github.com/QwenLM/qwen-code/pull/9703)).
- **Aone-интеграция**: фикс инкрементального review-кэша для AGit-Flow CR по diff между локальными head-ами вместо ancestry-тестов ([#9630](https://github.com/QwenLM/qwen-code/pull/9630)); presubmit на Aone для детекции self-MR и head-drift через a1 CLI ([#9629](https://github.com/QwenLM/qwen-code/pull/9629)); канонические PR-ссылки, роутинг test-plan и version floor ([#9624](https://github.com/QwenLM/qwen-code/pull/9624)).
- **Autofix/CI**: busy-PR-детекция теперь включает pending workflow-раны — меньше дублирующих диспатчей ([#9662](https://github.com/QwenLM/qwen-code/pull/9662)); `CI=true` возвращён в verification-gate-запуски ([#9649](https://github.com/QwenLM/qwen-code/pull/9649)); idle-watchdog-таймауты больше не считаются в суммарный лимит ([#9673](https://github.com/QwenLM/qwen-code/pull/9673)).
- **Прочее**: восстановление сессий через активную копию storage вместо гонок с архивом ([#9513](https://github.com/QwenLM/qwen-code/pull/9513)); перевод `Unset` во все девять CLI-языковых словарей ([#9714](https://github.com/QwenLM/qwen-code/pull/9714)); загрузка артефактов Office напрямую и развёртка каталогов в пофайловые артефакты ([#9395](https://github.com/QwenLM/qwen-code/pull/9395)).

## Итоги для обновления

1. **Web Shell.** Длинные сессии больше не крашат вкладку из-за памяти; история ограничивается 50k block-ов, сверхбольшие replay обрезаются до свежих block-ов, стриминг стал легче для основного потока.
2. **Slash-команды.** Во время стриминга мгновенно работают `/theme`, `/editor`, `/vim`, `/voice`, `/terminal-setup`, `/tools`, `/lsp`, `/tasks`, `/hooks`, `/docs` и `/bug`.
3. **GitHub PR.** Созданные из Git-диалога PR привязываются к сессии (бейдж `#N` / `#N +2`, поиск по номеру), до 10 на сессию.
4. **Review/Autofix.** Невылезающий цикл объясняет почему; `recommendations` в результатах review дают коды `root-cause-triage` / `batch-fixes` / `stem-surface` / `land-and-defer`; превышение growth-бюджета запускает growth-audit с вердиктами `sound` / `drift` / `conflict` вместо глухой остановки.
5. **SDK.** Python/Java принимают `permission_mode="auto"`; инструмент `list_directory` по умолчанию выключен (включается через `tools.listDirectory.enabled` или `--core-tools`); `qwen serve --restore-ask-user-question` восстанавливает HITL-вопросы после рестарта.

`0.22.0` — «гигиенический» минор без breaking changes: он делает веб-агента стабильнее под нагрузкой, снимает главные белые пятна в объяснимости review-автоматики и выравнивает доверенность через SDK. Обновление безопасно, миграция конфигурации не требуется (единственное поведенческое изменение по умолчанию — отключённый `list_directory`).

---
author: Артём Нецветаев
pubDatetime: 2026-07-24T14:34:27.000Z
title: "qwen-code v0.21.0: рабочие пространства Web Shell, живые background agents и image_gen"
slug: qwen-code-v0-21-0
featured: false
draft: false
tags:
  - release
  - qwen-code
  - ai-agents
  - cli
  - mcp
  - web-shell
description: "Разбор qwen-code v0.21.0: переключение и управление рабочими пространствами в Web Shell, ссылки на прошлые сессии через @, продолжение завершённых background agents без пересборки runtime, принудительный reconnect MCP и выделенные image-only модели."
---

[`qwen-code`](https://github.com/QwenLM/qwen-code) выпустил минорную версию [`v0.21.0`](https://github.com/QwenLM/qwen-code/releases/tag/v0.21.0). Upstream не заявляет breaking changes. Релиз заметно расширяет `qwen serve` и Web Shell: рабочие пространства теперь можно выбирать и обслуживать из браузера, завершённые background agents могут продолжать работу на прежнем runtime, а для MCP и генерации изображений появились отдельные, более управляемые контракты.

Источники: [GitHub Release](https://github.com/QwenLM/qwen-code/releases/tag/v0.21.0), [compare `v0.20.1...v0.21.0`](https://github.com/QwenLM/qwen-code/compare/v0.20.1...v0.21.0) (136 коммитов), а также PR [#7390](https://github.com/QwenLM/qwen-code/pull/7390), [#7302](https://github.com/QwenLM/qwen-code/pull/7302), [#7426](https://github.com/QwenLM/qwen-code/pull/7426), [#7488](https://github.com/QwenLM/qwen-code/pull/7488), [#7395](https://github.com/QwenLM/qwen-code/pull/7395), [#7607](https://github.com/QwenLM/qwen-code/pull/7607), [#7380](https://github.com/QwenLM/qwen-code/pull/7380), [#7467](https://github.com/QwenLM/qwen-code/pull/7467), [#7552](https://github.com/QwenLM/qwen-code/pull/7552) и [#7572](https://github.com/QwenLM/qwen-code/pull/7572).

## Web Shell: рабочее пространство выбирается до создания сессии

В PR [#7390](https://github.com/QwenLM/qwen-code/pull/7390) в composer Web Shell добавлен selector workspace. Из него можно выбрать уже зарегистрированное рабочее пространство, зарегистрировать существующую директорию на хосте daemon-а или создать новую пустую scratch-директорию, которой управляет daemon.

Переключение не переносит текущую беседу: в целевом workspace открывается новая сессия, а прежние сессии остаются на месте. Это важная граница для пользователей одного `qwen serve`, которые держат несколько проектов: контекст, runtime и история не смешиваются между каталогами. Scratch workspace доверен и готов к работе, но не переживает перезапуск daemon-а; при удалении его runtime сама директория с файлами намеренно сохраняется, чтобы не удалить пользовательские данные.

Изменение также повышает default timeout для инициализации ACP child и создания сессии с 10 до 30 секунд. Поэтому медленный cold start длительностью, например, 20 секунд больше не должен завершаться преждевременной ошибкой `POST /session`.

## Вспомнить прошлую сессию, не возобновляя её

PR [#7302](https://github.com/QwenLM/qwen-code/pull/7302) добавляет в интерактивный `@` completion отдельную категорию **Sessions**. При выборе сохранённой сессии в prompt вставляется ссылка вида `@session:<id>`. Qwen Code подставляет не живую сессию и не её полный JSONL, а детерминированный read-only summary: видимый текст пользователя и ассистента сохраняется, результаты инструментов превращаются в однострочные статусы, а самый новый контент получает приоритет в лимите примерно 8k токенов.

Это отличается от resume/fork: текущая беседа остаётся самостоятельной, но может сослаться на контекст уже завершённой работы. Список completion теперь разбит на **All**, **Files**, **Sessions**, **MCP** и **Extensions**; стрелки влево/вправо переключают категории только когда их несколько, не меняя обычное поведение курсора в остальных случаях. Неразрешимая или неоднозначная ссылка не исчезает из prompt — интерфейс показывает карточку с причиной ошибки.

## Завершённый background agent теперь можно продолжить «горячо»

До v0.21.0 повторный `send_message` завершённому background agent восстанавливал его из JSONL: заново создавались chat, подготовленные tools, process-local registries и provider cache. PR [#7426](https://github.com/QwenLM/qwen-code/pull/7426) оставляет runtime совместимого обычного background agent в памяти родительской сессии. Следующий вызов с тем же `task_id` использует прежние task row, task ID, launch model, chat и набор инструментов, затем задача снова проходит цикл `running → completed`.

Резидентность не означает бесконечное хранение. Она ограничена существующим лимитом terminal tasks; runtime освобождается при ошибке, отмене, reset, замене или вытеснении terminal entry, смене working directory, успешном branch, закрытии ACP session и удалении parent session. Агент с `isolation: "worktree"`, frontmatter hooks или child-only AUTO permission lease в этот путь не попадает: для него сохраняется прежний fallback с восстановлением transcript.

Исправлена и гонка в момент завершения. Сообщение, пришедшее после последнего drain, но до публикации `completed`, теперь забирается тем же runtime до перехода задачи в terminal state; оно не может остаться подтверждённым как queued, но не выполненным.

## MCP после внешней OAuth-авторизации можно переподключить явно

Обычный reload MCP-настроек не обязан пересоздавать транспорт, когда другой процесс Qwen Code только что записал OAuth token: настройки формально не изменились. PR [#7488](https://github.com/QwenLM/qwen-code/pull/7488) добавляет для daemon-а `POST /workspace/mcp/reload` два взаимоисключающих поля:

```json
{ "forceReconnectWhich": ["server-name"] }
```

```json
{ "forceReconnectAll": true }
```

Первый вариант пересоединяет названные MCP server-ы, второй — все подходящие серверы workspace. Новое соединение заново читает сохранённые credentials и обнаруживает инструменты, поэтому уже существующая сессия может начать использовать OAuth-доступ без правки MCP-конфига. Передавать оба поля вместе нельзя; `forceReconnectAll` обязан быть boolean, а элементы `forceReconnectWhich` — строками, иначе route отвечает `400`. Во время reconnect конкретный transport ненадолго недоступен.

## Общие skills, частичная замена identity и отдельный image route

В PR [#7395](https://github.com/QwenLM/qwen-code/pull/7395) появился массив `skills.directories` в settings. Пути разворачивают `~`, сканируются на `SKILL.md` на user level после стандартного `~/.qwen/skills/`; одноимённый skill из default-директорий сохраняет приоритет. Relative paths разрешаются от working directory, а настройка отключена в `--safe-mode` и `--bare`.

```json
{
  "skills": {
    "directories": [
      "~/.agent/skills",
      "~/.claude/skills",
      "/shared/team-skills"
    ]
  }
}
```

Это позволяет делить проверенные инструкции между Qwen Code, Claude Code и Codex, но такие каталоги должны быть доверенными: skills способны определять hooks и команды. Изменение требует restart.

PR [#7478](https://github.com/QwenLM/qwen-code/pull/7478) добавляет `QWEN_SYSTEM_IDENTITY_MD`: это путь к файлу, который заменяет только первое identity-предложение стандартного core system prompt. Полный override `QWEN_SYSTEM_MD` всё ещё имеет более высокий приоритет — в том числе если его файл пустой и очищает prompt. Пустой файл identity и значения-переключатели вроде `0`, `1`, `true` или `false` не включают новый override.

Наконец, [#7607](https://github.com/QwenLM/qwen-code/pull/7607) отделяет генерацию изображений от основного chat model. Пользователь настраивает image-only provider route и выбирает его через `/model --image`; встроенный `image_gen` требует approval, сохраняет проверенный PNG как workspace artifact в `.qwen/generated-images/<session>/` и не допускает этот route в primary, fast, voice, vision, ACP, fallback, subagent, non-interactive и Arena selection paths. Загрузка результата проверяет HTTPS/public-network policy, фиксирует DNS на redirect-цепочке, ограничивает размер и проверяет PNG signature до атомарной записи в пределах workspace.

## Web Shell: детали subagents, preview и управление agents

Несколько изменений делают browser-интерфейс менее перегруженным. [#7380](https://github.com/QwenLM/qwen-code/pull/7380) оставляет в основном transcript только status и summary subagent-а; полный transcript открывается отдельно — в side panel на широком экране или в drawer на узком — и продолжает приходить по независимому SSE. Каждый активный subagent можно отменить из этого detail surface, не останавливая parent session.

В review panel PR [#7467](https://github.com/QwenLM/qwen-code/pull/7467) добавляет постоянную кнопку Preview для HTML и Markdown. HTML остаётся внутри sandboxed iframe, Markdown использует существующий renderer; preview открывается в правом tab и сохраняет workspace ownership split-pane review. Файловое дерево теперь по умолчанию закрыто, а Markdown artifacts открываются сразу в rendered-виде, а не как исходный текст.

Для сценариев без активной chat session в [#7552](https://github.com/QwenLM/qwen-code/pull/7552) появился capability-advertised `POST /workspace/generate`: stateless, tool-free SSE generation внутри primary workspace ACP runtime. Поток содержит `started`, опциональные `thinking` и `delta`, затем ровно один `done`; закрытие HTTP-клиента отменяет запрос и возвращает workspace channel в обычный idle lifecycle.

На этой основе [#7572](https://github.com/QwenLM/qwen-code/pull/7572) добавляет отдельные страницы управления global и workspace agents: список, просмотр, создание, редактирование и удаление. Для mutable agent доступны description, system prompt, tools, MCP servers, hooks, approval mode, model, color и maximum turns; описание и system prompt можно сгенерировать независимо. В CLI `/agents create` открывает страницу создания, а built-in и extension agents остаются read-only.

v0.21.0 полезен прежде всего тем, кто запускает `qwen serve` как общий daemon для нескольких проектов или строит интеграции поверх Web Shell и SDK. Обновление даёт более чёткие workspace-границы, управляемое обновление OAuth-MCP транспорта и снижает стоимость итераций с уже завершёнными background agents без заявленной миграции конфигурации.

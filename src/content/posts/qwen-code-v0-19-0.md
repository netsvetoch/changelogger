---
author: Артём Нецветаев
pubDatetime: 2026-06-29T11:12:32.000Z
title: "qwen-code v0.19.0: голосовой ввод, Artifacts и возобновляемые sub-agents"
slug: qwen-code-v0-19-0
featured: false
draft: false
tags:
  - release
  - qwen-code
  - ai-agents
  - cli
description: "Разбор минорного релиза qwen-code v0.19.0: /voice и модель транскрибации, установка extensions из zip/tar.gz, возобновление завершённых background sub-agents, Artifact tool, workflow snapshots и branching в Web Shell."
---

[`qwen-code`](https://github.com/QwenLM/qwen-code) выпустил минорный релиз [`v0.19.0`](https://github.com/QwenLM/qwen-code/releases/tag/v0.19.0). Это не только набор UI-фиксов: в релиз попали новые рабочие сценарии для агентного CLI — голосовой ввод в prompt, публикация интерактивных HTML Artifacts, возобновляемые background sub-agents, сохранённые workflows и branching/fork в Web Shell.

Источник для разбора — GitHub Release [`QwenLM/qwen-code@v0.19.0`](https://github.com/QwenLM/qwen-code/releases/tag/v0.19.0), compare [`v0.18.5...v0.19.0`](https://github.com/QwenLM/qwen-code/compare/v0.18.5...v0.19.0) и связанные PR, включая [#5502](https://github.com/QwenLM/qwen-code/pull/5502), [#4909](https://github.com/QwenLM/qwen-code/pull/4909), [#5556](https://github.com/QwenLM/qwen-code/pull/5556), [#5557](https://github.com/QwenLM/qwen-code/pull/5557), [#5600](https://github.com/QwenLM/qwen-code/pull/5600), [#5613](https://github.com/QwenLM/qwen-code/pull/5613), [#5564](https://github.com/QwenLM/qwen-code/pull/5564) и [#5573](https://github.com/QwenLM/qwen-code/pull/5573).

## Голосовой ввод: `/voice`, `/model --voice` и native audio capture

Самая пользовательская новая функция пришла из PR [#5502](https://github.com/QwenLM/qwen-code/pull/5502): prompt input получил voice dictation. Управление вынесено в slash-команду:

```text
/voice [hold|tap|off|status]
/model --voice <model-id>
```

В настройках появились `general.voice.enabled`, `general.voice.mode`, `general.voice.language` и отдельный `voiceModel`. В `hold`-режиме пользователь держит Space, чтобы говорить; в `tap`-режиме Space запускает запись, а повторное нажатие или пауза по silence detection останавливает запись и отправляет текст.

Под капотом добавлен пакет `@qwen-code/audio-capture` — N-API addon на miniaudio. Он экспортирует native backend с методами `startRecording`, `stopRecording`, `isRecording`, опциональными `drainAudio` и `audioLevel`. Для платформ выбраны backend names `coreaudio` на macOS, `alsa-pulse` на Linux и `wasapi` на Windows. В install script отдельно зафиксировано, что падение native-сборки не должно ломать установку CLI: voice input должен откатиться на SoX/`arecord`.

Транскрибация зависит от выбранной модели. Для `qwen3-asr-flash` PR описывает batch-путь через OpenAI-compatible `chat/completions` с `input_audio`; realtime-модели вроде `qwen3-asr-flash-realtime`, `fun-asr-realtime` и `paraformer-realtime-v2` идут через WebSocket и показывают partial transcript. В prompt UI добавлен `VoiceIndicator`: он показывает recording/transcribing state, input-level meter и live partial transcript.

Практический минимум настройки выглядит так:

```json
{
  "general": {
    "voice": {
      "enabled": true,
      "mode": "hold",
      "language": "russian"
    }
  },
  "voiceModel": "qwen3-asr-flash"
}
```

Затем в CLI можно переключить модель транскрибации командой:

```text
/model --voice qwen3-asr-flash
/voice hold
```

## Extensions теперь ставятся из `.zip` и `.tar.gz`

PR [#4909](https://github.com/QwenLM/qwen-code/pull/4909) расширил `qwen extensions install`: теперь source может быть не только git URL, local path, npm package или marketplace, но и локальный архив либо URL архива. Документация добавила подтверждённые формы:

```bash
qwen extensions install /path/to/your/extension.zip
qwen extensions install /path/to/your/extension.tar.gz
qwen extensions install https://example.com/your/extension.zip
qwen extensions install https://example.com/your/extension.tar.gz
```

Архив должен содержать полноценное extension-пакетирование либо в корне, либо внутри единственной top-level директории. Проверяемые manifests вынесены в общий список: `qwen-extension.json`, `gemini-extension.json`, `.claude-plugin/marketplace.json` и `.claude-plugin/plugin.json`. Это важно не только для Qwen-native extensions: архивы Gemini extensions и Claude plugins проходят через уже существующие converters.

Для удалённых архивов добавлен новый тип install metadata:

```ts
export type ExtensionInstallMetadata = {
  type: "git" | "local" | "link" | "github-release" | "npm" | "archive-url";
  source: string;
};
```

`archive-url` хранит исходный URL, поэтому `qwen extensions update <name>` может переиграть загрузку, если URL указывает на новый архив той же extension. При этом `--ref` явно запрещён для archive URL: в CLI появляется отдельная ошибка `--ref is not applicable for archive URL extensions.`

## Завершённые background sub-agents можно оживить через `send_message`

До v0.19.0 завершённый background agent был терминальным: `send_message` возвращал ошибку вида `Cannot send messages to stopped tasks`. PR [#5556](https://github.com/QwenLM/qwen-code/pull/5556) меняет этот контракт. Если task имеет `status === 'completed'`, `send_message` теперь вызывает `reviveCompletedBackgroundAgent(task_id, message)`.

Новый revive path проверяет, что entry всё ещё есть в registry, был backgrounded, имеет `metaPath` и `outputFile`, а transcript JSONL существует и не пустой. Затем finished entry переводится обратно в resumable `paused` state, очищает result/stats, сбрасывает `notified`, добавляет новое сообщение как continuation instruction и запускается через существующий resume engine.

С точки зрения инструмента это теперь валидный сценарий:

```json
{
  "task_id": "agent-123",
  "message": "Продолжи с того места, где остановился, и проверь новый failing test."
}
```

Если revive успешен, LLM получает ответ: background task был completed, но revived with your message as the next instruction. Если transcript удалён, metadata не читается или concurrency cap уже заполнен, tool возвращает `SEND_MESSAGE_NOT_RUNNING` с сообщением `Task could not be revived`.

В том же PR cleanup-настройка получила новый охват. `cleanupPeriodDays` теперь относится не только к `~/.qwen/file-history/` для `/rewind`, но и к transcript-директориям sub-agents под `<projectDir>/subagents/`. Активная сессия защищена, а старые inactive session dirs удаляются housekeeping-проходом.

## Artifact tool публикует self-contained HTML

PR [#5557](https://github.com/QwenLM/qwen-code/pull/5557) добавил экспериментальный tool `artifact`: модель может взять body-only HTML fragment, опубликовать его как интерактивную страницу и вернуть ссылку. Фича opt-in: включается через `experimental.artifact` или `QWEN_CODE_ENABLE_ARTIFACT=1`, выключается через `QWEN_DISABLE_ARTIFACT=1`, и по умолчанию недоступна в non-interactive и SDK sessions.

Поддержаны три publisher backend:

- `local` — default: пишет в `~/.qwen/artifacts/{id}/index.html` и открывает `file://` URL;
- `host` — запускает настроенную команду upload через `execFile`, подставляя `{file}` и `{key}`;
- `oss` — загружает в Aliyun OSS через встроенный `fetch`, credentials читаются из env.

Настройки появились в `artifact.publisher`, `artifact.host.uploadCommand`, `artifact.host.urlTemplate`, `artifact.host.keyPrefix`, а также `artifact.oss.bucket`, `artifact.oss.endpoint`, `artifact.oss.keyPrefix`, `artifact.oss.acl` и `artifact.oss.publicBaseUrl`.

Минимальная конфигурация для локального publisher:

```json
{
  "experimental": {
    "artifact": true
  },
  "artifact": {
    "publisher": "local"
  }
}
```

Tool намеренно принимает не полный HTML-документ, а body fragment. Реализация оборачивает fragment в document shell, применяет минимальный reset, проверяет self-contained content, отклоняет внешние ресурсы и full-document wrappers, ограничивает размер 16 MB и key-ит artifact identity по source file path — повторная публикация того же файла обновляет тот же artifact.

В follow-up PR [#5617](https://github.com/QwenLM/qwen-code/pull/5617) добавлена настройка `artifact.autoOpen`. Если поставить `false`, artifact всё равно публикуется, но браузер не запускается. Env override `QWEN_ARTIFACT_NO_AUTO_OPEN=1` имеет приоритет:

```json
{
  "experimental": {
    "artifact": true
  },
  "artifact": {
    "publisher": "local",
    "autoOpen": false
  }
}
```

## Dynamic Workflows: saved scripts, snapshots, resume и keyword trigger

Большой PR [#5600](https://github.com/QwenLM/qwen-code/pull/5600) завершает перенос Dynamic Workflows. Здесь важны не маркетинговые слова, а конкретные интерфейсы.

Во-первых, сохранённые workflow scripts теперь лежат в двух местах:

```text
.qwen/workflows/<name>.js
~/.qwen/workflows/<name>.js
```

Новый `SavedWorkflowLoader` обнаруживает эти файлы и превращает каждый в slash-команду `/<name>`. Команда dispatch-ит tool `workflow` с `scriptPath`, а файл читается заново при каждом запуске — правки workflow подхватываются на следующем invocation. Если пользователь передал аргументы, loader пытается распарсить их как JSON; если не получилось, передаёт raw string в `args`.

Во-вторых, `/workflows` теперь показывает не только live registry текущего процесса. Terminal runs сохраняются как snapshots под `<projectDir>/workflows/<runId>.json`; команда `/workflows <runId>` может открыть terminal snapshot даже после рестарта CLI. В detail view добавлен save overlay: клавиша `s` сохраняет completed run script в `.qwen/workflows/<name>.js` или user-scope `~/.qwen/workflows/<name>.js`, с проверкой имени и overwrite confirmation.

В-третьих, workflow engine получил resume-by-journal: `resumeFromRunId` переигрывает JSONL journal с rolling prefix-hash chain, а `agent()` calls с теми же `(prompt, opts)` обслуживаются из cache для самого длинного неизменённого префикса. С первого miss run снова становится live.

Для UX добавлен мягкий keyword trigger: если prompt упоминает слово `workflow`, CLI может steer-ить turn к Workflow tool и показывать footer-индикатор `workflow active`. Это можно отключить настройкой:

```json
{
  "ui": {
    "disableWorkflowKeywordTrigger": true
  }
}
```

## Web Shell получил `/branch` и `/fork`

PR [#5613](https://github.com/QwenLM/qwen-code/pull/5613) переносит session workflow primitives в daemon-backed Web Shell. В browser-клиенте появились local commands:

```text
/branch [name]
/fork <directive>
```

`/branch` вызывает `sessionActions.branchSession(name)`: текущая conversation копируется в новую daemon session, сохраняется stable client id, Web Shell переключается на новую session, а transcript получает status block с `source: 'session_branched'`, `sourceSessionId`, `newSessionId` и `displayName`.

На уровне storage `SessionService.forkSession` теперь копирует не raw JSONL целиком, а active branch: сначала reconstructs history, затем переписывает `sessionId`, проставляет `cwd`, перестраивает `parentUuid` chain и добавляет `forkedFrom: { sessionId, messageUuid }` на каждую запись. Это важно после rewind: abandoned JSONL branches не воскресают в новой сессии.

`/fork <directive>` запускает background agent из текущей conversation. TypeScript SDK получил `DaemonClient.forkSession(sessionId, {directive}, clientId)` и `DaemonSessionClient.fork(directive)`, а result типизирован как:

```ts
export interface DaemonForkSessionResult {
  sessionId: string;
  description: string;
  launched: boolean;
}
```

Web Shell не показывает success toast, если `launched: false`, и обновляет список background tasks после успешного старта. В этом же PR daemon UI normalizer научился отдавать structured events `session.rewound` и `session.branched`, а transcript reducer — применять rewind к in-memory transcript и отображать branching как status block.

## Loop detection стал строже для автоматизации

Два fix-PR меняют поведение в CI-like сценариях. PR [#5564](https://github.com/QwenLM/qwen-code/pull/5564) делает loop detection failure для non-interactive runs: если stream отдаёт `LoopDetected`, CLI пропускает pending tool calls, печатает `Loop detection halted the run...`, возвращает exit code `1`, а JSON output получает `isError: true` / `is_error: true`.

PR [#5573](https://github.com/QwenLM/qwen-code/pull/5573) переносит guard на consecutive identical tool calls в always-on tier. Раньше он был за `model.skipLoopDetection`; теперь этот setting отключает только heuristic detectors — content/thought repetition, read-file/action stagnation, global-duplicate и alternating tool-call patterns. Точный guard «тот же tool name + byte-identical args» срабатывает независимо от default `skipLoopDetection: true`, потому что повтор идентичного вызова возвращает идентичный результат и часто приводит к DashScope ошибке `Repetitive tool calls detected` раньше, чем общий per-turn cap.

Сообщение пользователю теперь различает эти случаи: для consecutive-identical halt и per-turn cap не предлагается выключать `model.skipLoopDetection`, потому что это always-on guards. Для heuristic loop types подсказка про `model.skipLoopDetection` остаётся.

Отдельный маленький fix [#5569](https://github.com/QwenLM/qwen-code/pull/5569) закрывает boundary case в OpenAI logger: `getLogFiles(0)` теперь возвращает `[]`, а не все файлы. Старый код проверял `limit ? logFiles.slice(0, limit) : logFiles`; новый проверяет `limit === undefined` и тем самым сохраняет unlimited behavior только для отсутствующего аргумента.

## Что учитывать при обновлении

Если вы используете `qwen-code` как интерактивный CLI, v0.19.0 стоит смотреть в первую очередь ради voice dictation, Artifacts и extensions из архивов. Для voice нужен OpenAI-compatible ASR model, выбранный через `/model --voice`; без него `/voice` включать нечего.

Если у вас есть automation вокруг non-interactive mode, проверьте обработку exit code: loop detection теперь означает failed run, а не успешное завершение с предупреждением. Если вы раньше полагались на `model.skipLoopDetection` как полный выключатель, обновите mental model: он больше не отключает always-on consecutive-identical guard и per-turn cap.

Для команд, которые активно используют background agents и workflows, релиз снимает два болезненных ограничения: completed sub-agent можно продолжить через `send_message`, а удачный workflow run можно сохранить как обычную slash-команду и запускать повторно из `.qwen/workflows/` или `~/.qwen/workflows/`.

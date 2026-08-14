---
author: Артём Нецветаев
pubDatetime: 2026-08-14T12:50:00.000Z
title: "oh-my-pi 17.2.0: hashline CUT/PASTE, полный Cursor exec-мост и MCP-нотификации для расширений"
slug: oh-my-pi-v17-2-0
featured: false
draft: false
tags:
  - release
  - oh-my-pi
  - coding-agent
  - hashline
  - cursor
  - mcp
description: "Разбор oh-my-pi v17.2.0: в hashline появились CUT/PASTE с персистентным clipboard-регистром (DEL/COPY удалены), Cursor exec bridge теперь end-to-end обслуживает современный wire protocol с семью Pi-фреймами, MCP server-нотификации доходят до расширений, импорт сессий из Claude/Codex и sticky OAuth account pinning для тёплого prompt-кэша."
---

[oh-my-pi](https://github.com/can1357/oh-my-pi) выпустил минорный релиз [`v17.2.0`](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.0) (30 июля 2026) — самый объёмный из четырёх в этой серии. Два стержня: hashline-редактирование научилось перемещать код через clipboard-регистр, а мост к Cursor CLI переписан под современный exec wire protocol — с длинным хвостом фиксов корректности, безопасности и точности транскриптов.

Источники: [GitHub Release v17.2.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.0), compare [`v17.1.8...v17.2.0`](https://github.com/can1357/oh-my-pi/compare/v17.1.8...v17.2.0), PR [#6454](https://github.com/can1357/oh-my-pi/pull/6454), [#6535](https://github.com/can1357/oh-my-pi/pull/6535), [#6647](https://github.com/can1357/oh-my-pi/pull/6647), [#6652](https://github.com/can1357/oh-my-pi/pull/6652), [#6680](https://github.com/can1357/oh-my-pi/pull/6680), [#6858](https://github.com/can1357/oh-my-pi/pull/6858), [#6883](https://github.com/can1357/oh-my-pi/pull/6883), [#6938](https://github.com/can1357/oh-my-pi/pull/6938), [#7007](https://github.com/can1357/oh-my-pi/pull/7007), [#7028](https://github.com/can1357/oh-my-pi/pull/7028), [#7036](https://github.com/can1357/oh-my-pi/pull/7036), [#4484](https://github.com/can1357/oh-my-pi/pull/4484).

## Hashline: CUT/PASTE вместо DEL/COPY

В `@oh-my-pi/hashline` (компактный line-anchored patch language, где каждый hunk привязан к хэшу содержимого файла) язык получил clipboard-операции — breaking: `DEL`, `DEL.BLK`, `COPY`, `COPY.BLK` удалены.

- `CUT N.=M` (и блочные `.BLK` формы) захватывает строки в clipboard-регистр и удаляет их; `PASTE` вставляет захваченное — без перепечатывания кода.
- Регистр течёт сверху вниз по секциям патча, поэтому содержимое движется **между файлами в одном патче** (cross-file moves); `PASTE` регистр не потребляет, last capture wins.
- `PatcherOptions.clipboard` — host-owned регистр, персистентный между батчами `Patcher.apply`. Батчи работают на fork'е (`forkClipboard`), публикуемом по приземлившейся секции (`commitClipboard`): failed batch не отравляет регистр, а сбой записи посреди батча сохраняет уже срезанное с диска.
- Safety guards: `PASTE` по пустому регистру, capture поверх не-вставленного `CUT` и clipboard-операции в same-path секциях, переплетённых чужим файлом, отклоняются с прицельной диагностикой; `CUT`-диапазоны участвуют в overlap-валидации, seen-lines guard и drift recovery (каждая захваченная строка обязана remap'нуться).

Дополнительно: streaming previews защищены от CPU/memory exhaustion отклонением якорей выше `Number.MAX_SAFE_INTEGER` и диапазонов свыше 100 000 строк; `Patcher.commit` теперь ключует возвращаемый хэш и снапшот по **фактически записанному** на диск содержимому (раньше auto-format-on-save рассинхронизировал теги и последующие edit'ы переформатировали непричастные части файла).

## Cursor exec-мост: современный протокол end to end

`agent.proto` теперь моделирует фреймы, которые эмитят текущие сборки Cursor CLI: семь Pi tool frames (`ExecServerMessage` 45–51), hooks, subagents, allowlist prechecks, MCP state, smart-mode classification, canvas diagnostics, conversation search, agent-store conflicts и git diff — и каждый получает типизированный ответ. Маппинг: `pi_read`/`pi_ls` → `read`, `pi_bash` → `bash`, `pi_edit` → `edit`, `pi_write` → `write`, `pi_grep` → `grep`, `pi_find` → `glob`. Фреймы, которые сборка не может назвать, поднимают `ExecClientControlMessage.throw` с `unknown_exec_variant`; распознанные, но не имеющие честного ответа (например `git_diff_request`) — `exec_variant_unsupported` вместо молчаливого ack, оставляющего сервер ждать. `lsp` снова рекламируется в MCP-каталоге: нативный `diagnostics` фрейм покрывает лишь одно из ~10 действий LSP.

Дальше — внушительная серия фиксов корректности, перечислю самые показательные:

- **Interleaved tool calls больше не портят друг друга**: декодер стрима вёл единственный «current» блок и сеттлил его по любому `toolCallCompleted`, игнорируя `call_id` — completion одного вызова закрывал чужой блок и пи́рил его не с тем результатом, а `start A, start B` вообще осиротевал A, что вырезало всё взаимодействие из rebuilt-транскриптов. Открытые блоки теперь хранятся per envelope `call_id`, а end-of-stream закрывает все.
- **proto3 oneof**: четыре фрейма отвечали результатом, у которого oneof так и не был установлен — сервер читал это как «инструмент отработал и ничего не произвёл», неотличимо от настоящего успеха. Теперь уходят явные `ListMcpResourcesSuccess{resources: []}`, `ReadMcpResourceNotFound{uri}`, `RecordScreenFailure`, `ComputerUseError`.
- **Ranged reads**: `pi_read` с `offset`/`limit` раньше компоновал plain `:N+K` селектор, который локальный `read` расширяет одной строкой сверху и тремя снизу — фрейм «offset 5/limit 20» получал строки 4–27. Теперь компонуется `:raw:N+K`, нарезающий ровно запрошенное; `limit: 0` (proto `optional int32`) честно отвечает пустым выводом, а не всем файлом.
- **Approval-дыры закрыты**: advisor- и bridge-инстансы `pi_edit`/`pi_grep` строились вне обёртки approval и резолвились как `yolo`; native `delete` и download-mode `read_mcp_resource` мутировали файлы мимо registry-инструментов. Теперь оба делят один grant `allowDirectFileMutation` и `write`-tier policy check, а download до чтения отказывает — заблокированный вызов даже не фетчит ресурс. Сам download заперт в workspace: `O_NOFOLLOW`, отказ symlink'ам и hard-linked файлам.
- **Anthropic prompt-cache cold misses на resume с несколькими OAuth-аккаунтами**: обслуживший сессию аккаунт записывается в session-файл как PII-free `credential_pin` (sha-256 аккаунта + org/project scope) и перепинится на resume с effective last-use временем — свежий процесс больше не re-ранжирует аккаунты по usage headroom, систематически уводя от только что использованного и холодно промахиваясь мимо всего account-scoped cache prefix.
- **`pi_bash` с `timeout: 0`**: truthiness-check сворачивал явный ноль в unset и применял дефолтные 300с; явный `0` («без дедлайна») теперь проходит.

## MCP-нотификации для расширений

Новый extension event `mcp_notification` и multi-listener API `MCPManager.addNotificationListener`: JSON-RPC нотификации серверов (включая custom-методы) доставляются как `{server, method, params}`. Для известных list-change методов внутренний refresh await'ится до fanout, так что слушатель `tools/list_changed` видит свежий `getTools()`. Нотификации до появления первого слушателя буферизуются (bounded FIFO, cap 100, drop-oldest). Однослотовый `MCPManager.setOnNotification` удалён.

## Сессии, сабагенты, прочее

- **Импорт сессий**: `--from-claude` и `--from-codex` (для Codex — включая compaction state), также через `/resume @claude` и `/resume @codex`.
- **`providers.autoThinkingMaxEffort`** (`xhigh` | `max`, дефолт `xhigh`) поднимает потолок `auto` thinking-классификатора: `max` стал first-class tier после написания промпта классификатора, и `auto` никогда не мог до него добраться ([#6680](https://github.com/can1357/oh-my-pi/pull/6680)).
- **Subagent-доступ** к `checkpoint`, `rewind`, `learn`, `manage_skill` — opt-in через `tools:` frontmatter определения агента ([#6938](https://github.com/can1357/oh-my-pi/pull/6938)).
- **`browser.cdpUrl`** — дефолтный endpoint для browser automation ([#7007](https://github.com/can1357/oh-my-pi/pull/7007)); **RPC `set_fast_mode`** и tokens-per-second в `get_state` ([#7036](https://github.com/can1357/oh-my-pi/pull/7036)).
- **`startup.changelogMode`** (`summary` | `expanded` | `hidden`) — release notes при старте теперь компактный summary по умолчанию ([#6771](https://github.com/can1357/oh-my-pi/issues/6771)).
- **Codex SSE** к официальному endpoint — zstd-сжатые тела по умолчанию (отключается `PI_CODEX_ZSTD=0`); **`parentTurnId`** для вложенных Codex-запросов; интерактивные логины **Exa** (`/login exa`, [#6652](https://github.com/can1357/oh-my-pi/pull/6652)) и **xAI** ([#6647](https://github.com/can1357/oh-my-pi/pull/6647)); Umans usage provider с rolling 5h window ([#4484](https://github.com/can1357/oh-my-pi/pull/4484)).
- **pi-natives**: voice-движок (miniaudio, WebRTC, Opus) вынесен в napi-free `pi-voice` rlib — граф webrtc/opus/miniaudio компилируется один раз и больше не пересобирается с каждым релизом; релизные бинарники строятся параллельно с test fan-out, что срезало wall time пайплайна.

## Кому стоит обновиться

Всем, кто живёт на Cursor-провайдере (мост перестал терять аргументы, пагинацию и truncation-флаги), тем, у кого несколько Anthropic OAuth-аккаунтов (resume наконец попадает в тёплый кэш), и пользователям hashline: проверьте патчи на предмет удалённых `DEL`/`COPY` — замена на `CUT`.

## Как обновиться

```sh
curl -fsSL https://omp.sh/install | sh
```

или `npm i -g @oh-my-pi/pi-coding-agent`. Полный changelog — в [GitHub Release v17.2.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.0).

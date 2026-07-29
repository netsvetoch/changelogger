---
author: Артём Нецветаев
pubDatetime: 2026-07-29T05:32:11.000Z
title: "OpenAI Codex rust-v0.146.0: именованные сессии, Agent Plugins и удалённый Code Mode"
slug: openai-codex-rust-v0-146-0
featured: false
draft: false
tags:
  - release
  - codex
  - openai
  - cli
  - app-server
  - plugins
  - mcp
description: "Разбор OpenAI Codex rust-v0.146.0: имена и закрепление тредов, манифесты Agent Plugins, fork для пагинированной истории, WebSocket-транспорт Code Mode, standalone web search у custom providers и безопасное чтение executor skills."
---

OpenAI выпустила [`rust-v0.146.0`](https://github.com/openai/codex/releases/tag/rust-v0.146.0) — minor-релиз Codex, заметно расширяющий app-server и инфраструктуру плагинов. В нём появились именование и закрепление разговоров, fork для пагинированной истории, поддержка переносимых Agent Plugins и удалённых Code Mode hosts по WebSocket.

Ниже — разбор GitHub Release, диапазона [`rust-v0.145.0...rust-v0.146.0`](https://github.com/openai/codex/compare/rust-v0.145.0...rust-v0.146.0) и связанных PR: [`#34605`](https://github.com/openai/codex/pull/34605), [`#34840`](https://github.com/openai/codex/pull/34840), [`#35105`](https://github.com/openai/codex/pull/35105), [`#35220`](https://github.com/openai/codex/pull/35220), [`#35078`](https://github.com/openai/codex/pull/35078), [`#35098`](https://github.com/openai/codex/pull/35098), [`#34846`](https://github.com/openai/codex/pull/34846) и [`#35184`](https://github.com/openai/codex/pull/35184).

## Сессии: имя через `/new`, pin в API и переключение side conversation

В TUI после `/new` и `/clear` можно передать имя следующей сессии. PR [`#34605`](https://github.com/openai/codex/pull/34605) подтверждает, что имя устанавливается через app-server при создании треда и сохраняется для подключённой сессии; если запись имени не удалась, новый тред всё равно подключается, а ошибка показывается в чате. Это устраняет отдельный шаг переименования для рабочих веток разговора.

```text
/new Проверить миграцию базы
/clear Новый разбор инцидента
```

Для интеграций появился persistent pin. В ответах о тредах есть `isPinned`, а `thread/metadata/update` принимает его как patch-поле; пропуск поля оставляет прежнее значение, `null` тоже не меняет сохранённый pin. `thread/list` получил одноимённый фильтр и поддерживает его вместе с cursor pagination и relationship filters. Состояние лежит в SQLite, переживает reconciliation, archive и unarchive, а старые треды по умолчанию не закреплены.

```json
{
  "method": "thread/metadata/update",
  "id": 7,
  "params": { "threadId": "thr_123", "isPinned": true }
}
```

В side conversation добавлено действие `toggle_side_conversation`, по умолчанию привязанное к `Ctrl-/`. Оно переключает между parent и side thread, не закрывая ни один из них; `Ctrl-C` остаётся отдельным действием закрытия. Привязку можно переназначить, а при запуске replacement side conversation прежняя очищается только после успешной замены — при ошибке она сохраняется.

## Переносимые Agent Plugins и capability публикации в workspace

Codex распознаёт root-файл `plugin.json` по схеме Agent Plugins 1.0 (PR [`#35105`](https://github.com/openai/codex/pull/35105)). Из него в собственный manifest переносятся portable metadata, `skills/` и `mcp.json`; Codex-специфичные apps, hooks и interface settings берутся из inline-расширения `com.openai`. Если нужно, `.codex-plugin/plugin.json` работает как fallback overlay.

Это не безусловная смена формата: если root `plugin.json` не относится к Agent Plugins, Codex сохраняет прежний приоритет legacy manifest; неподдерживаемая версия схемы отклоняется. Discovery skills в этом режиме ограничен прямыми дочерними каталогами и не принимает путь, который после resolution выходит за root плагина — существенная граница для плагинов из внешних marketplace.

Для клиентов app-server в контексте share и ответе `plugin/share/save` появилось nullable-поле `canPublishToWorkspace` (PR [`#35254`](https://github.com/openai/codex/pull/35254)). Оно проходит из remote catalog до протокольного ответа. Когда значение отсутствует, клиенту предписано fail closed: не предлагать публикацию в workspace directory, а не считать её разрешённой.

Marketplace тоже выбирается конкретнее: для Amazon Bedrock используется `openai-api-curated`, даже если отсутствует `auth.json` — сигналом служит resolved model provider (PR [`#34931`](https://github.com/openai/codex/pull/34931)). В мигрированных включённых плагинах из `claude-code-plugins` Codex выводит источник `anthropics/claude-code`, но не затирает уже явно обнаруженный marketplace (PR [`#34979`](https://github.com/openai/codex/pull/34979)).

## Fork теперь работает с пагинированной историей

В прошлом minor-релизе `historyMode: "paginated"` разделил durable history и live-сеанс, но `thread/fork` для такого треда был недоступен. PR [`#35220`](https://github.com/openai/codex/pull/35220) снимает ограничение: fork фиксирует выбранный префикс source history и создаёт rollout только для child-owned записей. Поддерживаются границы latest, `lastTurnId` и `beforeTurnId`; чтение и поиск нового треда проходят по унаследованной истории, но не захватывают записи источника, появившиеся после fork.

Реализация также координирует подготовку fork с archive/delete и materialize-ит compressed rollouts до превращения их в references. Поэтому это не просто снятая проверка: fork сохраняет корректный model context, interruption markers и approvals reviewer из выбранной границы истории.

Есть отдельный ephemeral-вариант (PR [`#35251`](https://github.com/openai/codex/pull/35251)): для paginated thread он возможен лишь при `excludeTurns: true`. Такой fork сохраняет выбранную историю для preview и model input, но не получает rollout path и не появляется в `thread/list`. В противном случае app-server возвращает invalid-request, так что UI не должен обещать временную ветку с полной materialized history.

## Удалённый Code Mode host по WebSocket

`code-mode-host` теперь умеет слушать не только stdio, но и `ws://IP:PORT` через `--listen` (PR [`#35078`](https://github.com/openai/codex/pull/35078)). Существующий length-prefixed протокол передаётся binary WebSocket frames; соединения изолированы, но разделяют лимиты host. Endpoint `/readyz` показывает готовность listener, а handshake с браузерским `Origin` отклоняется; malformed frame ломает только затронутое соединение.

App-server может подключаться к такому хосту вместо запуска локального (PR [`#35098`](https://github.com/openai/codex/pull/35098)). Для этого feature `code_mode_host` должен быть включён, а URL передают через CLI:

```bash
# На машине с Code Mode host
codex code-mode-host --listen ws://0.0.0.0:8787

# В app-server-клиенте
codex app-server --code-mode-host ws://code-mode.internal:8787
```

Поддерживаются `ws://` и `wss://`; при отсутствии флага сохраняется прежний local-host путь. Одно outbound WebSocket-соединение разделяется всеми тредами процесса, использует policy HTTP-клиента для proxy/TLS и закрывается корректно. В частности, app-server ограничивает число pending delegate calls на соединение 1 024: превышение возвращает ошибку без disconnect, так что клиент может восстановиться после освобождения capacity.

## Standalone web search для совместимых custom provider

В model provider config добавлен `supports_standalone_web_search` с default `false` (PR [`#34846`](https://github.com/openai/codex/pull/34846)). Если custom Responses provider явно opt-in, web search включён и runtime его поддерживает, Codex разрешает standalone `web.run`; запрос уходит в endpoint и с auth именно выбранного custom provider. Без opt-in, при выключенном web search или несовместимом runtime инструмент не включается.

Это важная разница с неявным fallback: у стороннего OpenAI-compatible endpoint одного совпадения формата API недостаточно. Владелец provider должен подтвердить способность обслужить standalone search в конфигурации, иначе поведение остаётся прежним и безопасным.

## Executor skills: discovery, resource access и границы пакета

PR [`#35184`](https://github.com/openai/codex/pull/35184) добавляет executor authority в `skills.list` и `skills.read` для skills из выбранных capability roots. `skills.read` может читать основной `SKILL.md` и package-relative resource, на который ссылается skill, но только внутри выбранного пакета. Список skills и содержимое ресурсов пагинируются, размер ответов ограничен, а устаревший cursor отклоняется.

Для explicitly selected skills, которые намеренно отсутствуют в `skills.list`, PR [`#35198`](https://github.com/openai/codex/pull/35198) добавляет metadata `resource_access` в injected instructions. Эту метаинформацию можно передать в `skills.read` наравне с authority/package из `skills.list`; discoverable skills при этом не меняют формат инструкций. Таким образом, явный выбор не становится обходом package boundary, а даёт ровно необходимые данные для чтения заявленного ресурса.

## Что исправили при обновлении

Релиз проводит configured proxy policy через login, загрузку плагинов, MCP authorization, remote execution, WebSocket, redirects и LM Studio. Он также обновляет MCP runtime при смене auth/config, переиспользует здоровые соединения и заменяет закрытые без рестарта остальных. Для долгих и прерванных сессий исправлены сохранение submitted messages, final responses, failed-turn errors, imported timestamps и approval settings; Windows получает корректные navigation keys и завершение sandboxed process trees через job objects.

В TUI отдельно улучшены nonblocking interrupts, обработка клавиш, узкие layout, OSC 8 hyperlinks и обновление mention results. При ограниченном context budget Codex сначала отбрасывает описания skills, а не сами записи, и предупреждает о фактическом truncation catalog.

## Итоги для обновления

Потребителям app-server стоит обновить UI тредов: отрисовывать `isPinned`, посылать его через `thread/metadata/update` и не предполагать, что ephemeral fork будет виден в `thread/list`. Авторам плагинов можно переходить на Agent Plugins 1.0, но нужно сохранить root-boundary для skills и воспринимать отсутствующий `canPublishToWorkspace` как запрет публикации.

Для распределённого Code Mode разделите host и app-server через `--listen ws://...` и `--code-mode-host ws(s)://...`, учитывая experimental-статус WebSocket listener и лимит delegate calls. Владельцам custom provider не следует включать search «по умолчанию»: `supports_standalone_web_search` — намеренный opt-in, от которого зависит появление `web.run`.

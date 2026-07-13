---
author: Артём Нецветаев
pubDatetime: 2026-07-13T09:32:42.000Z
title: "OpenAI Codex rust-v0.144.0: approval mode writes, MCP-аутентификация и прокси для WebSocket"
slug: openai-codex-rust-v0-144-0
featured: false
draft: false
tags:
  - release
  - codex
  - openai
  - cli
  - mcp
description: "Разбор OpenAI Codex rust-v0.144.0: новый режим подтверждений writes, интерактивная MCP-аутентификация без opt-in, runtime-аутентификация app-server, pnpm-диагностика, восстановление старых ChatGPT-тредов и proxy-aware Responses WebSockets."
---

OpenAI выпустила [`rust-v0.144.0`](https://github.com/openai/codex/releases/tag/rust-v0.144.0) — minor-релиз Codex с изменениями в TUI, app-server, MCP и сетевом транспорте. Главные пользовательские нововведения — промежуточный режим подтверждений `writes`, интерактивная аутентификация MCP без экспериментального флага и возможность передавать аутентификацию app-server во время работы.

Ниже — разбор GitHub Release и связанных PR: [`#30482`](https://github.com/openai/codex/pull/30482), [`#28772`](https://github.com/openai/codex/pull/28772), [`#28745`](https://github.com/openai/codex/pull/28745), [`#31274`](https://github.com/openai/codex/pull/31274), [`#31503`](https://github.com/openai/codex/pull/31503), [`#30319`](https://github.com/openai/codex/pull/30319), [`#31486`](https://github.com/openai/codex/pull/31486), [`#31441`](https://github.com/openai/codex/pull/31441) и [`#31622`](https://github.com/openai/codex/pull/31622). Полный диапазон изменений — [rust-v0.143.0...rust-v0.144.0](https://github.com/openai/codex/compare/rust-v0.143.0...rust-v0.144.0).

## `writes`: читать автоматически, подтверждать запись

PR [`#30482`](https://github.com/openai/codex/pull/30482) добавляет значение `writes` в `AppToolApproval`. Режим закрывает промежуток между `auto` и `prompt`:

- инструмент с `readOnlyHint = true` выполняется без подтверждения;
- остальные инструменты требуют подтверждения, включая инструменты без аннотаций и операции, которые не помечены как destructive;
- выбор `session` или постоянного одобрения в этом режиме не сохраняется, поэтому последующая запись снова остановит выполнение.

Значение доступно в Rust enum, JSON Schema и TypeScript-типе `AppToolApproval`. Для app-server его можно задать глобально для приложений:

```toml
[apps._default]
default_tools_approval_mode = "writes"
```

Приоритет настроек сохраняется: `approval_mode` конкретного инструмента выше режима приложения, а режим приложения выше `[apps._default]`. По умолчанию по-прежнему используется `auto`.

## MCP-аутентификация теперь запрашивается интерактивно

PR [`#28772`](https://github.com/openai/codex/pull/28772) переводит `auth_elicitation` в stable и включает его по умолчанию. MCP-сервер теперь может сообщить Codex, что инструменту нужна повторная аутентификация, а клиент запрашивает её через стандартный lifecycle elicitation — без отдельного экспериментального opt-in.

Изменение покрывает как form-, так и URL-elicitation capabilities. В коде это означает, что `ElicitationCapability` по умолчанию содержит обе возможности; отключить поведение всё ещё можно через feature configuration. Для пользователей MCP это прежде всего убирает необходимость вручную включать экспериментальную возможность перед первым интерактивным login flow.

## App-server: auth snapshot из runtime и hosted success page

Два связанных изменения расширяют сценарии встраивания Codex.

PR [`#31274`](https://github.com/openai/codex/pull/31274) добавляет `AuthMode::Headers` и `CodexAuth::Headers`. Host может установить внешний auth provider в памяти через существующий `ExternalAuth` path: provider реализует `resolve()` и `refresh()`, а `AuthManager` получает актуальный `CodexAuth` snapshot во время работы. Такой режим не читается из auth storage — это намеренное ограничение runtime-поставляемой аутентификации.

В протоколе app-server новый режим виден как `"headers"` в `AuthMode`. Он позволяет host-приложению передать Codex уже известные request headers, не записывая их в локальный `auth.json` и не заставляя CLI самостоятельно восстанавливать этот тип credentials.

PR [`#28745`](https://github.com/openai/codex/pull/28745) добавляет в `account/login/start` для ChatGPT два необязательных поля:

```json
{
  "type": "chatgpt",
  "useHostedLoginSuccessPage": true,
  "appBrand": "chatgpt"
}
```

`useHostedLoginSuccessPage` переключает успешный callback на hosted страницу; старое localhost-поведение остаётся дефолтом. `appBrand` принимает `"codex"` или `"chatgpt"` и выбирает оформление страницы, а пропущенное или `null` значение означает `"codex"`. Credentials сохраняются до redirect. Device-code login, CLI login и сценарии с настройкой организации продолжают использовать локальную success page.

## Usage-limit reset credits теперь выбираются явно

PR [`#30488`](https://github.com/openai/codex/pull/30488) переделывает TUI-пикер **Redeem usage limit reset**. При открытии меню Codex использует существующий `account/rateLimits/read`, показывает доступные credits с типом и сроком действия и сортирует их по expiration. Если backend не прислал title, интерфейс строит fallback label по scope.

Главное поведенческое изменение — redeem отправляет `credit_id` именно выбранного элемента. Его idempotency key сохраняется при retry. Для старого ответа, где backend вернул только положительное количество credits без строк с деталями, сохраняется прежний generic reset action; неизвестные типы reset тоже получают совместимый scope-based label.

## Установки через pnpm корректно видны в doctor и update

Раньше JavaScript shim различал npm и Bun, а глобальная установка через pnpm могла ошибочно считаться npm-установкой. В PR [`#31503`](https://github.com/openai/codex/pull/31503) launcher ищет `node_modules/.modules.yaml` от pnpm, найденный относительно запущенного entrypoint, и передаёт в native CLI взаимоисключающий маркер `CODEX_MANAGED_BY_PNPM`.

Дальше pnpm проходит через `InstallContext`, `codex doctor`, проверку версии и TUI update action. Для такой установки диагностика и подсказка обновления теперь предлагают:

```bash
pnpm add -g @openai/codex
```

Это надёжнее, чем проверять только `PNPM_HOME`: у pnpm глобальные каталог пакетов и bin могут находиться отдельно.

## Ultra предупреждает о дорогом multi-agent concurrency

PR [`#31621`](https://github.com/openai/codex/pull/31621) добавляет предупреждение после явного выбора reasoning effort `Ultra`, если `features.multi_agent_v2.max_concurrent_threads_per_session >= 8`.

В history cell показываются настроенный лимит потоков и максимальное число subagents (`N - 1`). Предупреждение работает одинаково в model picker, reasoning picker, Plan-mode scope selection и reasoning shortcuts. Для других reasoning levels, лимитов ниже 8 и стартовой инициализации поведение не меняется.

## Восстановление старых ChatGPT-тредов после retirement модели

В resumed ChatGPT thread предварительная compaction может использовать модель предыдущего хода. Если её slug больше не поддерживается backend, запрос `/responses/compact` или Compaction V2 завершался `InvalidRequest` до того, как могло начаться выполнение на выбранной пользователем модели.

PR [`#30319`](https://github.com/openai/codex/pull/30319) добавляет ограниченный fallback: только для ChatGPT auth с OpenAI provider Codex один раз повторяет compaction с текущей выбранной моделью. Историю, lifecycle events и token accounting завершает контекст модели, на которой retry действительно прошёл. API-key auth, custom providers, same-model turns и ошибки, отличные от `InvalidRequest`, остаются на прежнем пути; если fallback тоже не удался, наружу возвращается исходная ошибка предыдущей модели.

## Windows sandbox и TUI стали устойчивее

В Windows sandbox writable roots получили наследуемое право `DELETE`, но без `FILE_DELETE_CHILD`. Это позволяет удалять уже существующие файлы в workspace, `TEMP` и `TMP`, не открывая удаление защищённых дочерних путей вроде `.git`. Устаревшие ACL с небезопасным `FILE_DELETE_CHILD` теперь обнаруживаются и обновляются (PR [`#31138`](https://github.com/openai/codex/pull/31138)).

Отдельно sandbox ACL refresh теперь включает `%USERPROFILE%\\.cache\\codex-runtimes`, где Codex Desktop хранит managed primary runtime. Добавлено только read/execute-доступ, поэтому sandbox может запускать bundled Python, Node и native tools, не получая запись во весь профиль пользователя (PR [`#31574`](https://github.com/openai/codex/pull/31574)).

PR [`#31494`](https://github.com/openai/codex/pull/31494) фильтрует CSI sequences и прочие control characters, кроме whitespace, при вставке текста в composer. Та же очистка выполняется перед rich/raw rendering `UserHistoryCell`, поэтому уже сохранённая повреждённая история отображается безопасно без изменения содержимого на диске.

## Responses WebSocket больше не обходят proxy policy

PR [`#31622`](https://github.com/openai/codex/pull/31622) выделяет новый workspace crate `codex-websocket-client`. Его `WebSocketConnector` строится из эффективного `HttpClientFactory`, разрешает маршрут назначения до подключения и поддерживает direct route, HTTP proxy и TLS-encrypted HTTPS proxy. В транспорт перенесены custom CA для proxy и target TLS, а также Happy Eyeballs fallback.

PR [`#31441`](https://github.com/openai/codex/pull/31441) подключает этот transport к Responses API. WebSocket остаётся низколатентным путём, но теперь учитывает `features.respect_system_proxy`, системный proxy и custom certificate authorities. Существующий protocol pump, ping/pong и session-scoped HTTP fallback не меняются.

## Аутентификация hosted connectors обновляется в долгих сессиях

В hosted `codex_apps` connector HTTP auth больше не фиксируется один раз при старте MCP runtime. PR [`#31486`](https://github.com/openai/codex/pull/31486) добавляет `AuthManager`-backed request-header provider: перед каждым `/ps/mcp` запросом он читает `auth_cached()`, поэтому после обычного refresh Responses следующий вызов connector получает новый bearer token.

Провайдер ограничен исходным account, ChatGPT user и workspace identity. При смене аккаунта он не начинает автоматически использовать чужой token: MCP state сначала должен быть пересобран.

## Прочие заметные изменения

- `/review` получает ветки через `git for-each-ref --format=%(refname:short) refs/heads`, а не через более общий `git branch`; remote-tracking refs и detached-HEAD rows исключаются (PR [`#31464`](https://github.com/openai/codex/pull/31464)).
- Автоматический review теперь получает только `exec_tool` и `view_image`, а отдельное permissions-инструктажное сообщение удалено из reviewer session (PR [`#31480`](https://github.com/openai/codex/pull/31480)).
- В каталоге Amazon Bedrock модели отображаются как `GPT-5.6 Sol`, `GPT-5.6 Terra` и `GPT-5.6 Luna`; model IDs, порядок, priority и default selection не менялись (PR [`#31636`](https://github.com/openai/codex/pull/31636)).
- Device-code login warning дополнен признаками phishing и инструкциями, как остановить подозрительный flow (PR [`#31648`](https://github.com/openai/codex/pull/31648)).
- Загрузка plugin skills на remote executors ускорена: namespace для root разрешается один раз и переиспользуется при разборе skill files; в PR заявлено снижение измеренного среднего времени для 66 skills примерно на 71% (PR [`#31348`](https://github.com/openai/codex/pull/31348)).

## Итоги для обновления

Если Codex встроен в приложение через app-server, проверьте схемы `AppToolApproval`, `LoginAccountParams` и `AuthMode`: в `rust-v0.144.0` появились `writes`, `useHostedLoginSuccessPage`, `appBrand` и `headers`. Владельцам MCP стоит убрать ручной experimental opt-in для auth elicitation и проверить, что read-only инструменты действительно публикуют `readOnlyHint = true`, если они должны проходить без подтверждения в режиме `writes`.

При обновлении CLI полезно один раз выполнить `codex doctor`: для pnpm-установок команды диагностики и обновления теперь должны соответствовать реальному менеджеру пакетов. А если вы используете Ultra вместе с восемью и более concurrent threads, новое предупреждение показывает стоимость этой конфигурации прямо при выборе режима.

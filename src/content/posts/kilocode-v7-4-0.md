---
author: Артём Нецветаев
pubDatetime: 2026-07-03T16:12:29.000Z
title: "Kilo Code 7.4.0: Agent Manager сам называет ветки по задаче"
slug: kilocode-v7-4-0
featured: false
draft: false
tags:
  - release
  - kilocode
  - ai-agents
  - vscode
  - cli
description: "Разбор минорного релиза Kilo Code 7.4.0: автоматические task-focused имена веток в Agent Manager, защита read-only bash allowlist, ускорение открытия сессий, фиксы Plan mode, Bedrock через AWS SSO и очистка черновиков удалённых VS Code-сессий."
---

[`Kilo Code`](https://github.com/Kilo-Org/kilocode) выпустил минорный релиз [`v7.4.0`](https://github.com/Kilo-Org/kilocode/releases/tag/v7.4.0). В отличие от `7.3.0`, где GitHub Release почти не объяснял изменения, у `7.4.0` есть полноценный release body: главный minor-пункт — автоматическое переименование веток Agent Manager после того, как диалог становится похож на конкретную инженерную задачу.

Источники для разбора — GitHub Release [`Kilo-Org/kilocode@v7.4.0`](https://github.com/Kilo-Org/kilocode/releases/tag/v7.4.0), compare [`v7.3.0...v7.4.0`](https://github.com/Kilo-Org/kilocode/compare/v7.3.0...v7.4.0), PR [#11741](https://github.com/Kilo-Org/kilocode/pull/11741), [#11890](https://github.com/Kilo-Org/kilocode/pull/11890), [#11893](https://github.com/Kilo-Org/kilocode/pull/11893), [#11442](https://github.com/Kilo-Org/kilocode/pull/11442), [#11572](https://github.com/Kilo-Org/kilocode/pull/11572), [#11896](https://github.com/Kilo-Org/kilocode/pull/11896), [#11808](https://github.com/Kilo-Org/kilocode/pull/11808), [#11843](https://github.com/Kilo-Org/kilocode/pull/11843), [#11832](https://github.com/Kilo-Org/kilocode/pull/11832) и [#11838](https://github.com/Kilo-Org/kilocode/pull/11838). Это именно semver-boundary релиз `7.4.0`; patch-релизы `7.3.x` не были отдельной целью статьи.

## Agent Manager: ветка сначала случайная, потом осмысленная

Главное изменение [#11741](https://github.com/Kilo-Org/kilocode/pull/11741) меняет жизненный цикл веток Agent Manager. Раньше новая worktree-ветка получала friendly-random имя сразу при создании, например в стиле `ambitious-keyboard`. Это быстро, но через несколько активных задач такие ветки трудно сопоставить с реальным workstream. Называть ветку по первому сообщению тоже ненадёжно: разговор может начаться с приветствия, уточнения возможностей или короткого выбора.

В `7.4.0` Agent Manager оставляет быстрый placeholder, но ставит worktree в режим `autoNameSessionId`. Когда пользовательские сообщения наконец описывают устойчивую инженерную задачу, новый `BranchNamingController` вызывает backend-метод `branchName.generate`, получает slug и переименовывает ветку без перемещения директории worktree.

Ключевой client-side контур находится в `packages/kilo-vscode/src/agent-manager/branch-naming.ts`:

```ts
this.naming = new BranchNamingController({
  state: () => this.getStateManager(),
  manager: () => this.getWorktreeManager(),
  client: dir => this.connectionService.getClientAsync(dir),
  settings: () => this.host.autoBranchNaming(),
  push: () => this.pushState(),
  log: msg => this.log(msg),
});
```

Контроллер не пытается переименовывать всё подряд. Он выходит без действий, если worktree уже не принадлежит одной стартовой сессии, если у неё есть PR, если автоматическое именование выключено, если ветка не была создана самим Agent Manager или если пользователь уже сделал branch identity явной. После успешного semantic rename автоматическое именование очищается, чтобы поздние повороты разговора не меняли уже опубликованную идентичность.

На стороне Git `WorktreeManager.renameBranch()` добавляет защитные проверки перед `git branch -m`: worktree должен быть управляемым Agent Manager, текущая ветка должна совпадать с ожидаемой, ветка не должна иметь upstream и не должна уже существовать на remote. Если сгенерированный slug конфликтует с локальной или remote-веткой, менеджер добавляет суффикс вместо перезаписи чужой ветки.

## Какие настройки появились

В VS Code extension добавлены две application-level настройки в `packages/kilo-vscode/package.json`:

```json
{
  "kilo-code.new.agentManager.autoBranchNaming": {
    "type": "boolean",
    "default": true
  },
  "kilo-code.new.agentManager.branchPrefix": {
    "type": "string",
    "default": ""
  }
}
```

`autoBranchNaming` включает или выключает поведение целиком. `branchPrefix` добавляет prefix только к автоматически созданным semantic names — например `feature/` или `marius/`. В `vscode-host.ts` эти значения читаются из `kilo-code.new.agentManager`:

```ts
autoBranchNaming(): { enabled: boolean; prefix: string } {
  const cfg = vscode.workspace.getConfiguration("kilo-code.new.agentManager")
  return {
    enabled: cfg.get("autoBranchNaming", true),
    prefix: cfg.get("branchPrefix", ""),
  }
}
```

Санитайзер в `branch-name.ts` приводит prefix и название к безопасному git-формату: lowercase, alphanumeric и дефисы, без пустых сегментов и лишних слэшей. Поэтому `"Feature / Payment Fix"` превращается в ветку вроде `feature/payment-fix`, а не в строку, которую `git check-ref-format` отвергнет.

## Backend-генератор имени: small model, последние сообщения и `null`

Для генерации добавлен backend-модуль `packages/opencode/src/kilocode/branch-name.ts` и HTTP API group `branch-name`. Он берёт до четырёх последних user-сообщений, обрезает каждое до 1000 символов и просит small model вернуть ровно одну строку: kebab-case slug или `null`.

Системная инструкция важна не меньше самого API. Она явно запрещает давать имена для приветствий, acknowledgements, вопросов о возможностях, casual conversation, vague requests и нерешённого brainstorming. Валидным workstream считается конкретная implementation, investigation, planning, documentation или research task. Результат парсится строго: удаляются `<think>`, markdown fences, кавычки, всё приводится к lowercase и небуквенно-цифровые последовательности заменяются дефисами.

Минимальный пример ожидаемой семантики:

```text
Пользователь: "привет"
branchName.generate -> null

Пользователь: "исправь race condition при refresh token и добавь регрессионный тест"
branchName.generate -> fix-token-refresh-race
```

Если модель вернула `null`, placeholder остаётся на месте, а следующий более конкретный prompt может повторить попытку. API также ограничен timeout в 10 секунд и при ошибке возвращает `null`, чтобы naming не блокировал обычный Agent Manager flow.

## Защита read-only bash allowlist от exec-via-flag обходов

Самый важный security patch в релизе — [#11890](https://github.com/Kilo-Org/kilocode/pull/11890). У ask/plan/explore agents есть `readOnlyBash` allowlist: команды вроде `sort`, `rg`, `ag`, `man` выглядят read-only, но некоторые флаги могут запускать произвольную программу.

В `packages/opencode/src/kilocode/agent/index.ts` добавлены deny-правила для конкретных escape-векторов:

```ts
"sort *--compress-program*": "deny",
"sort *--files0-from*": "deny",
"rg *--pre *": "deny",
"rg *--pre=*": "deny",
"rg *--hostname-bin*": "deny",
"ag *--pager*": "deny",
"man -P *": "deny",
"man -P*": "deny",
"man *--pager*": "deny",
"man *-H*": "deny",
```

Это закрывает, например, `sort --compress-program sh`, `rg --pre=sh`, `ag --pager sh`, `man -Psh` и `man --pager=sh`. В PR прямо отмечено ограничение такого подхода: это defense-in-depth поверх string-matching allowlist, а не полноценный sandbox; более прочная граница — OS-level sandboxing. Но для текущего allowlist это убирает класс обходов, где «разрешённая для чтения» команда становится launcher для произвольного процесса.

Регрессионные случаи добавлены в `packages/opencode/test/kilocode/ask-agent-permissions.test.ts`, включая glued short form `man -Psh`.

## Открытие больших сессий больше не сканирует всю историю

[#11893](https://github.com/Kilo-Org/kilocode/pull/11893) исправляет задержку при открытии или переключении больших сессий в VS Code sidebar и Agent Manager. Причина была не в загрузке transcript как таковой, а в per-model token usage breakdown для session header.

Старый SQL заново вычислял family сессий внутри aggregation query через recursive CTE и затем join-ил `part`. На больших базах SQLite выбирал план с full scan всей таблицы `part` и `json_extract` по каждой строке. В описании PR приведён реальный масштаб: около 1,2 секунды на базе 3 ГБ с 425k строк, причём single-threaded server в это время блокировал быстрый запрос сообщений.

В `packages/opencode/src/kilocode/session/model-usage.ts` family IDs теперь вычисляются отдельно, а aggregation получает конкретный `IN (...)`:

```ts
const usageSql = (placeholders: string) => `
  WITH step AS (
    SELECT ...
    FROM part
    JOIN message ON message.id = part.message_id
      AND message.session_id = part.session_id
    WHERE part.session_id IN (${placeholders})
      AND json_extract(part.data, '$.type') = 'step-finish'
  )
  ...`;
```

Так SQLite может использовать `part_session_idx` и читать только `part` текущего session tree. Вывод usage не меняется, но стоимость запроса становится пропорциональна открываемой семье сессий, а не всему накопленному history-файлу.

## Удалённые VS Code-сессии больше не держат черновики и картинки в памяти

[#11442](https://github.com/Kilo-Org/kilocode/pull/11442) чинит утечку в webview state. `PromptInput.tsx` хранил unsent prompt text, pending review comments и pending image attachments в module-level `Map`. Когда сессия удалялась, `handleSessionDeleted` чистил transcript, parts, todos и прочий store, но не эти draft maps. Если пользователь прикреплял screenshots, удалял сессию и продолжал работать, base64 attachments оставались в памяти webview.

В релизе появился `webview-ui/src/utils/draft-store.ts` с shared maps и helper `deleteDraftsForSession(id)`. Он удаляет ключи, заканчивающиеся на `:session:<id>` или `:pending:<id>`, то есть совпадающие с форматом `scopeDraftKey(sessionDraftKey(...))` и `scopeDraftKey(pendingDraftKey(...))`. Очистка привязана именно к событию `sessionDeleted`, поэтому обычное переключение A → B → A по-прежнему сохраняет черновик.

В том же PR усилен delete-path для внешних и cascaded удалений: `session.deleted` теперь пропускается в webview даже для сессий, которые не были явно tracked, а connection service удаляет deleted id из focused/opened sets и вызывает `flushViewed()`. Это не даёт следующему send попасть в уже удалённую backend-сессию.

## AWS Bedrock через SSO и credential chain снова работает в extension build

[#11572](https://github.com/Kilo-Org/kilocode/pull/11572) исправляет runtime crash в VS Code extension при использовании AWS Bedrock через SSO или AWS credential chain. Симптом из PR: `AWS credential provider failed: J_ is not a function. (In 'J_(A)', 'J_' is a Symbol)`. Короткое имя менялось между сборками, но причина была стабильной.

Корень проблемы — production build extension на esbuild с полным `minify: true`. В CJS bundle для `@aws-sdk/credential-providers` identifier minification мог сманглить provider function и internal `Symbol` в одно короткое имя. Исправление точечное и касается только Node.js extension bundle в `packages/kilo-vscode/esbuild.js`:

```diff
- minify: production,
+ minifyIdentifiers: false,
+ minifySyntax: production,
+ minifyWhitespace: production,
```

Syntax и whitespace minification остаются включёнными, webview IIFE bundles не меняются. Отключается только identifier mangling, который ломал re-export цепочки AWS SDK.

## Plan mode: реальный файл плана и панель Keep refining

В Plan mode вошли два связанных улучшения.

[#11896](https://github.com/Kilo-Org/kilocode/pull/11896) перестал доверять угаданному имени файла при `plan_exit`. После более раннего перехода на agent-chosen descriptive filenames tool мог сообщить пользователю ссылку на файл, который на самом деле не был записан. Теперь `PlanFile.locate()` ищет реальный plan file в несколько этапов: exact target, затем newest sibling с session-generated pattern, затем последний markdown-файл, записанный plan/architect agent tool call. Если файл не найден, `plan_exit` падает с понятной ошибкой: нужно сначала записать план или передать точный path.

[#11808](https://github.com/Kilo-Org/kilocode/pull/11808) переносит решение «начать реализацию или продолжить уточнение» из model-written chat text в deterministic follow-up panel после `plan_exit`. В `packages/opencode/src/kilocode/plan-followup.ts` появилась третья опция:

```ts
export const ANSWER_KEEP_REFINING = "Keep refining";
```

При выборе `Keep refining` telemetry получает `keep_refining`, в текущую сессию inject-ится сообщение `Continue refining the plan. Do not implement yet.`, а prompt queue ретаргетится обратно на plan agent. Для пользователя это означает, что быстрым или слабым моделям больше не нужно самим правильно напечатать numbered choice в чате: interactive panel работает одинаково для CLI, VS Code и JetBrains.

## Ещё несколько пользовательских фиксов

- [#11843](https://github.com/Kilo-Org/kilocode/pull/11843): `selectSession` в webview теперь синхронно обновляет `currentSessionID` и `draftSessionID` даже при кратком disconnect backend. Только загрузка сообщений откладывается до reconnect, поэтому side diff и chat больше не расходятся при переключении Agent Manager sessions.
- [#11838](https://github.com/Kilo-Org/kilocode/pull/11838): sandbox toggle сохраняется при fork сессии или переносе в worktree. Fork-route теперь уважает явный target directory из query или `x-kilo-directory`, а `Session.fork` переносит snapshot sandbox policy из исходной директории.
- [#11832](https://github.com/Kilo-Org/kilocode/pull/11832): в Auto-Approve settings появился opt-in `kilo-code.new.maxCost` — whole-dollar Session Cost Alert. Когда session spend превышает лимит, VS Code показывает предупреждение с вариантами Continue и Stop; значение `0` оставляет поведение выключенным.
- [#11824](https://github.com/Kilo-Org/kilocode/pull/11824) и [#11910](https://github.com/Kilo-Org/kilocode/pull/11910): model picker запоминает expand/collapse состояние preview panel и синхронизирует этот выбор между sidebar и Agent Manager.
- [#11881](https://github.com/Kilo-Org/kilocode/pull/11881): `Show more providers` поднят в заметную строку Popular providers, а Disabled Providers по умолчанию свернуты.
- [#11915](https://github.com/Kilo-Org/kilocode/pull/11915): из session header убран balance chip; при этом соседний [#11803](https://github.com/Kilo-Org/kilocode/pull/11803) показывает balance в account switcher и детали Kilo Pass на profile page.

## Кому стоит обновиться

`7.4.0` особенно заметен пользователям Agent Manager: новые worktree-ветки должны перестать выглядеть как случайные пары слов после того, как задача стала понятной, а explicit names, published branches и PR-ветки защищены от автоматического переименования. Для команд, которые полагаются на ask/plan/explore агентов, важен security patch read-only bash allowlist. Для пользователей с большими историями сессий практический выигрыш — более быстрое открытие transcript из-за исправленного model usage SQL.

Если вы используете VS Code extension с AWS Bedrock через SSO, `7.4.0` также закрывает production-build crash в credential provider. А если активно работаете в Plan mode, релиз делает две вещи одновременно: ссылки `Plan is ready` должны вести на реально сохранённый файл, а «продолжить уточнение» становится кнопкой в follow-up panel, а не просьбой к модели напечатать правильный numbered choice.

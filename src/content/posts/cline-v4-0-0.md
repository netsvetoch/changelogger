---
author: Артём Нецветаев
pubDatetime: 2026-06-29T09:52:42.000Z
title: "Cline 4.0.0: SDK-runtime, ClinePass и Customize marketplace"
slug: cline-v4-0-0
featured: true
draft: false
tags:
  - release
  - cline
  - ai-agents
description: "Разбор major-релиза Cline 4.0.0: переход VS Code extension на общий Cline SDK session layer, ClinePass в onboarding и настройках, новая Customize marketplace для Skills/MCP/Plugins, queued prompts, edit-and-regenerate, Bun-сборка extension и миграция provider/MCP/task runtime."
---

[`cline`](https://github.com/cline/cline) выпустил major-релиз [`v4.0.0`](https://github.com/cline/cline/releases/tag/v4.0.0). Это не просто набор UI-обновлений: VS Code extension переехал с legacy task implementation на общий Cline SDK session layer. Через него теперь проходят agent turns, tools, Plan/Act coordination, MCP, checkpoints, telemetry, provider changes, compaction, mistake limits и task history.

Источник для обзора — GitHub Release [`cline/cline@v4.0.0`](https://github.com/cline/cline/releases/tag/v4.0.0), root `CHANGELOG.md`, compare [`v3.89.2...v4.0.0`](https://github.com/cline/cline/compare/v3.89.2...v4.0.0) и связанные PR/коммиты, включая [#11632](https://github.com/cline/cline/pull/11632), [#11816](https://github.com/cline/cline/pull/11816), [#11529](https://github.com/cline/cline/pull/11529), [#11556](https://github.com/cline/cline/pull/11556), [#11590](https://github.com/cline/cline/pull/11590), [#11703](https://github.com/cline/cline/pull/11703), [#11705](https://github.com/cline/cline/pull/11705), [#11710](https://github.com/cline/cline/pull/11710), [#11691](https://github.com/cline/cline/pull/11691), [#11813](https://github.com/cline/cline/pull/11813), [#11764](https://github.com/cline/cline/pull/11764), [#11808](https://github.com/cline/cline/pull/11808), [#11814](https://github.com/cline/cline/pull/11814), [#11817](https://github.com/cline/cline/pull/11817), [#11789](https://github.com/cline/cline/pull/11789), [#11401](https://github.com/cline/cline/pull/11401) и [#11278](https://github.com/cline/cline/pull/11278).

## VS Code extension теперь живёт поверх Cline SDK

Главная архитектурная граница 4.0.0 — SDK-backed runtime для VS Code extension. В changelog это сформулировано широко, но compare показывает конкретные зоны переноса: extension task path, tool execution, Plan/Act transitions, MCP, checkpoints, compaction, mistake limit handling, provider/session config и история задач больше не являются отдельной параллельной реализацией, расходящейся с CLI.

Это заметно по нескольким пользовательским сценариям:

- переход из Plan в Act больше не останавливает задачу на «API Request Cancelled»: [#11401](https://github.com/cline/cline/pull/11401) после `switch_to_act_mode` или клика по toggle сразу продолжает выполнение утверждённого плана;
- смена provider в активной беседе теперь пересобирает SDK session, а не только обновляет сохранённые `planModeApiProvider` / `actModeApiProvider` настройки: это исправлено в [#11507](https://github.com/cline/cline/pull/11507);
- кнопка Compact и команды `/compact` / `/smol` больше не отправляют текст `/compact` модели как обычный prompt: [#11764](https://github.com/cline/cline/pull/11764) вызывает SDK compaction path через `compactSessionMessages()`;
- consecutive tool failures обрабатываются SDK-лимитом ошибок, а не отдельным VS Code счётчиком, который мог прерывать задачу до показа recovery prompt: [#11808](https://github.com/cline/cline/pull/11808).

Для пользователя это означает меньшую разницу между CLI и VS Code extension: логика агентного цикла и recovery теперь находится в одном SDK-слое, а extension в основном адаптирует её к webview и VS Code APIs.

## Extension build/package workflow переехал на Bun, но runtime остался Node

[#11632](https://github.com/cline/cline/pull/11632) переносит `apps/vscode` из отдельного npm/node workflow в общий Bun workspace. Важная деталь из PR: Node остаётся runtime для VS Code extension host, standalone `cline-core`, `esbuild platform: "node"` и ABI-целей `prebuild-install`. Bun заменяет npm как package manager/task runner и старый mocha unit runner, но не превращает сам extension host в Bun runtime.

Практический эффект для разработки Cline: `apps/vscode` больше не исключён из workspace, а `@cline/*` SDK-пакеты потребляются через локальные workspace symlinks вместо цикла «опубликовать SDK → завендорить опубликованную версию → вручную поддерживать mocks». Это важно именно для SDK migration: extension теперь может тестировать текущие SDK-пакеты из monorepo без промежуточной публикации.

## ClinePass добрался до VS Code extension

В 4.0.0 ClinePass перестал быть CLI-only историей. По release notes и PR видно несколько отдельных частей:

- [#11556](https://github.com/cline/cline/pull/11556) добавляет ClinePass в extension provider selection;
- [#11590](https://github.com/cline/cline/pull/11590) добавляет ClinePass option в onboarding flow;
- [#11609](https://github.com/cline/cline/pull/11609) подключает ClinePass к signup flow;
- [#11606](https://github.com/cline/cline/pull/11606), [#11637](https://github.com/cline/cline/pull/11637), [#11738](https://github.com/cline/cline/pull/11738) и [#11807](https://github.com/cline/cline/pull/11807) дорабатывают entitlement, organization и auth/error states;
- [#11792](https://github.com/cline/cline/pull/11792) обновляет список ClinePass-моделей live, потому что этот список не берётся из `models.dev`.

В результате пользователь VS Code extension получает ClinePass уже в первом запуске и в provider picker: onboarding, выбор provider, signup/subscription handoff, out-of-credit prompts и organization error state теперь встроены в тот же UI, а не требуют перехода в CLI или ручной настройки отдельного провайдера.

## Customize marketplace объединил Skills, MCP servers и Plugins

Самое заметное UI-изменение — новая Customize marketplace. [#11816](https://github.com/cline/cline/pull/11816) описывает её как consolidated Customize view для трёх типов Cline primitives: Skills, MCP servers и Plugins. В extension появились installed/marketplace tabs, marketplace catalog, search, tag filters, install/uninstall flows, enable/disable controls и compact icon-only install actions.

Технически это не просто новая вкладка. PR добавляет `MarketplaceService` ProtoBus API: extension получает catalog entries, сообщает installed marketplace entries, перечисляет локальные installed primitives, устанавливает catalog entries и включает/выключает local skills/plugins. Поэтому marketplace install/uninstall используется как общий plumbing для MCP, Skills и Plugins, а не как отдельный экран с hardcoded списком.

Отдельная практическая деталь для Skills: [#11294](https://github.com/cline/cline/pull/11294) исправил toggle disable. Раньше выключение skill меняло только extension state (`globalSkillsToggles` / `localSkillsToggles`), но SDK строил список skills из frontmatter `disabled` в `SKILL.md`; модель всё равно могла видеть отключённый skill. Теперь extension пишет disabled-state в frontmatter, то есть UI-toggle влияет на тот список, который реально получает SDK.

## Plugins стали первым классом расширения Cline

Release notes отдельно выделяют Cline Plugins: их можно ставить из Customize marketplace, чтобы добавлять custom tools, workflows, skills и MCP-powered capabilities. В compare это связано не только с VS Code, но и с CLI/Hub работой: появились hub primitive catalogs ([#11624](https://github.com/cline/cline/pull/11624)), dashboard/customization разделение ([#11631](https://github.com/cline/cline/pull/11631)), refined marketplace primitive rows ([#11659](https://github.com/cline/cline/pull/11659)) и shared catalog/configure path ([#11730](https://github.com/cline/cline/pull/11730)).

В VS Code это проявляется через ту же Customize поверхность: plugin-bundled skills показываются пользователю, plugins можно enable/disable, а MCP support для plugins использует shared marketplace install/uninstall plumbing. Для команд это важнее, чем «ещё один магазин»: reusable automation теперь можно упаковывать и устанавливать как primitive Cline, а не копировать вручную в проектные правила или локальные настройки.

## MCP настройки стали общими и безопаснее записываются

MCP часть релиза закрывает болезненную проблему совместимости CLI, extension и нескольких окон extension. [#11529](https://github.com/cline/cline/pull/11529) переносит MCP OAuth state в общий файл `~/.cline/data/settings/cline_mcp_settings.json` — под `oauth` каждого server — в формате, который использует `@cline/core`. Extension и CLI теперь читают один формат, а авторизация сервера в одном клиенте подхватывается другими без перезапуска.

Тот же PR меняет callback flow: вместо прежнего `vscode://` URI callback используется HTTP-based token collection через local loopback callback server из `@cline/core`, как в CLI. Записи настроек защищены lock files, temp-file + rename и повторным чтением перед записью, чтобы параллельные writers не затирали друг друга.

Release notes также фиксируют UX-изменение после marketplace installs: MCP hub автоматически refresh'ится, поэтому только что установленный server появляется без ручного restart. При этом MCP Marketplace tab можно отключить remote config'ом, не скрывая уже установленные MCP servers.

## Провайдеры и модели переехали к catalog-backed настройкам

Миграция на SDK вынесла provider/model config к `providers.json`, model catalog и SDK session config. Это видно по набору provider PR в релизе:

- [#11703](https://github.com/cline/cline/pull/11703) открывает в VS Code provider picker SDK-backed providers, которые уже были в SDK/catalog, но не были доступны из статического списка extension: Z.AI Coding Plan, Poolside, Vercel v0 и Xiaomi;
- [#11705](https://github.com/cline/cline/pull/11705) переводит LiteLLM model-info fetching в SDK path, чтобы старый `refreshLiteLlmModelsRpc` не обходил catalog и не давал слабые diagnostics;
- [#11710](https://github.com/cline/cline/pull/11710) чинит OpenAI-compatible settings: reasoning effort selector всегда доступен там, где model options показаны, а custom model limits (`contextWindow`, `maxTokens`) мостятся в SDK `knownModels` при создании session;
- [#11691](https://github.com/cline/cline/pull/11691) убирает ошибочную трактовку `openai-codex` как OpenAI Native API-key provider. Codex OAuth credentials теперь идут через общий OAuth/provider settings path и не требуют `OPENAI_API_KEY`;
- [#11745](https://github.com/cline/cline/pull/11745), [#11756](https://github.com/cline/cline/pull/11756), [#11759](https://github.com/cline/cline/pull/11759) и [#11796](https://github.com/cline/cline/pull/11796) доводят SAP AI Core wiring и auth/config forwarding.

Пользовательский результат: настройки лучше переживают переключение провайдеров, custom model metadata не теряется, а active SDK session может быть перезапущена, когда меняется выбранный provider.

## Chat UX: queued prompts и edit-and-regenerate

В 4.0.0 сообщения, отправленные пока Cline уже работает, больше не теряются и не конкурируют с текущим turn. Release notes фиксируют queued prompts: они показываются во время streaming текущего turn и могут быть отменены до запуска. В соседнем блоке [#11817](https://github.com/cline/cline/pull/11817) убирает «двухсекундную» паузу при первом сообщении в новой VS Code chat: webview генерирует session id, ставит task proxy и сразу показывает initial `say: "task"`, пока SDK session startup остаётся источником истины.

Edit-and-regenerate для прошлых user messages тоже стал безопаснее: релиз отдельно отмечает clearer Reset Chat и Reset Code actions, а changelog указывает fix, где Escape отменяет локальное редактирование без побочных действий. Это маленькая UI-деталь, но в agent IDE она важна: пользователь может исправить более раннюю инструкцию и перегенерировать продолжение, не создавая новый task вручную.

## Terminal execution и auto-approval стали честнее

[#11789](https://github.com/cline/cline/pull/11789) упрощает VS Code terminal execution и переводит foreground/background terminals на SDK defaults для truncation, timeouts и descriptions. В PR отдельно сказано, что SDK API между shell tool и executors стал более composable, а названия ушли от `bash` к `shell`, потому что Windows/PowerShell и другие оболочки не являются bash. В release notes это проявляется как «clearer non-interactive command guidance» и safer structured command formatting.

Auto-approval тоже стал более консервативным. Для новых и reset configurations command auto-approval теперь выключен по умолчанию. [#11814](https://github.com/cline/cline/pull/11814) убирает misleading подпункты вроде «Execute safe commands» vs «Execute all commands» и «Read project files» vs «Read all files», потому что backend не различал такие уровни. Меню теперь честно показывает категории, которые действительно enforce'ятся: Read, Edit, Commands, Web Fetch и MCP.

## Checkpoints, task history и удаление legacy Explain Changes

[#11813](https://github.com/cline/cline/pull/11813) переносит VS Code checkpoints на SDK-owned checkpoint data. Checkpoint rows в chat умеют restore task history, restore workspace files, restore both и compare выбранный checkpoint с текущим workspace через `compareCheckpointToWorkspace(...)` / публичный `ClineCore.compareCheckpoint(...)`, а не через старый VS Code shadow-git manager.

Task history тоже адаптирована к SDK migration: changelog отдельно упоминает видимость legacy task history, сохранение metadata при resume и исправленное deletion behavior. Это важно при обновлении с 3.x: старые задачи не должны исчезнуть только потому, что новая runtime-модель хранит больше состояния внутри SDK.

Наконец, из extension удалён legacy Explain Changes. [#11278](https://github.com/cline/cline/pull/11278) убирает extension entry points, slash command metadata, task RPC, default tool surface, webview status UI и docs entry для Explain Changes, а также callback API reply-to-Cline в generated review comments. В 4.0.0 это выглядит как cleanup после переноса на SDK-backed experience: команда не поддерживает два параллельных пути для функции, которую не стабилизировали в новом runtime.

## Что учитывать при обновлении

Cline 4.0.0 — major именно из-за runtime-переезда, а не из-за одного breaking API для конечных пользователей. Основные practical notes такие:

- если вы используете VS Code extension, ожидайте более близкое поведение к CLI в Plan/Act, compaction, checkpoints, provider changes и mistake recovery;
- если у вас настроены MCP servers/OAuth, проверьте общий файл `~/.cline/data/settings/cline_mcp_settings.json`: после релиза он становится точкой совместимости CLI и extension;
- если вы полагались на command auto-approval после reset/new config, перепроверьте настройку: commands теперь не автоодобряются по умолчанию;
- если вы использовали Explain Changes, эта поверхность удалена в рамках SDK migration cleanup;
- subagents в VS Code extension временно отключены, пока SDK-backed experience стабилизируется.

Главный смысл 4.0.0: Cline собирает VS Code extension, CLI, Hub, marketplace, providers и MCP вокруг общего SDK runtime. Это должно уменьшить расхождения между интерфейсами и сделать новые primitives — Skills, MCP servers и Plugins — устанавливаемыми и управляемыми из одного Customize entry point.

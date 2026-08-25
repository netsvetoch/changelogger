---
author: Артём Нецветаев
pubDatetime: 2026-08-25T15:05:00.000Z
title: "Paseo 0.6.0: Explorer как полноценный pane-хост, on-the-side контент и стабильные OpenCode-turns"
slug: paseo-v0-6-0
featured: false
draft: false
tags:
  - release
  - paseo
  - ai-agents
  - ui
  - cli
  - typescript
description: "Разбор Paseo v0.6.0: возвращение выделенной Explorer sidebar с Files и Changes, обычные закрываемые workspace-панели вместо Side panel, per-action настройки open in main / open to the side, standalone Diff tabs, кастомные window controls на Windows/Linux и починка стартовых OpenCode-turns."
---

[Paseo](https://github.com/getpaseo/paseo) выпустил минорный релиз [`v0.6.0`](https://github.com/getpaseo/paseo/releases/tag/v0.6.0) (25 августа 2026). Это сфокусированный релиз интерфейса: после эксперимента с пустой user-directed **Side panel** в 0.5.0 навигация возвращается к выделенной **Explorer sidebar**, а контент открывается в обычных workspace-панелях. Плюс два целевых фикса надёжности OpenCode на старте.

Основа статьи — GitHub Release [`v0.6.0`](https://github.com/getpaseo/paseo/releases/tag/v0.6.0), compare [`v0.5.0...v0.6.0`](https://github.com/getpaseo/paseo/compare/v0.5.0...v0.6.0) (21 commit) и исходные PR.

## Explorer возвращается как выделенный sidebar

Главный PR релиза — [#3826](https://github.com/getpaseo/paseo/pull/3826) «Make Explorer a first-class pane host». В 0.5.0 правый вспомогательный pane стал универсальным хостом вкладок, а Side panel открывалась пустой и ждала явного выбора. Это смешивало две ответственности — стабильную навигацию и основной split tree, из-за чего routing, drag/drop, resize, window chrome и клавиатура зависели от shell-специфичных веток.

В 0.6.0 эта поверхность заменена:

- `Cmd/Ctrl+E` теперь переключает **выделенный Explorer sidebar** с **Files** и **Changes** по умолчанию;
- пустое legacy-состояние Explorer нормализуется к Files/Changes, а не к launcher'у New Tab;
- Explorer держится **вне обычного split tree**, сохраняя своё состояние вкладок и ширину;
- десктопный Explorer не берёт на себя desktop-split и drag-систему;
- на планшетах восстановлен resizable combined Explorer dock.

## Контент on-the-side — обычные workspace-панели

Ключевое изменение механики: контент, открытый в сторону, больше не использует Explorer sidebar. Вместо этого файлы, диффы, pull requests, терминалы и агенты открываются в **обычных закрываемых workspace-панелях**, следуя своему manifest'у и source-specific layout preference. Совмещены pane-host контракты, tab manifests, resize-поведение, header-контролы и toolbar chrome.

Routing выбора дерева идёт в main- или side-панели **без утечки Explorer identity в панели**. Состояние смонтированного контента сохраняется при создании side-панели, замене вкладки и максимизации панели.

## Per-action настройки открытия и standalone Diff tabs

Поскольку выбор «куда открывать» стал осмысленным, Paseo добавляет **per-action настройки** для открытия файлов, changes, сабагентов и pull requests — в main panel или on the side — плюс явные действия «Open to the Side».

В Explorer появляется поддержка **New tab и drag** для совместимых файлов, диффов, агентов, терминалов, pull requests и plugin panels. А в Changes/диффах добавлены **standalone Diff tabs** при сохранении опционального persisted inline-diff режима.

## Custom window controls на Windows и Linux

Один explicit chrome mode управляет нативной отрисовкой десктопных window controls на macOS/**Windows**/**Linux**, включая development override ([#3826](https://github.com/getpaseo/paseo/pull/3826)). PR объединяет то, что раньше разносилось по отдельным попыткам: window controls идут через общий desktop chrome mode и владение header ([#3567](https://github.com/getpaseo/paseo/pull/3567) superseded), native control space решается тем же контрактом презентации, а не отдельным measurement-путём ([#3536](https://github.com/getpaseo/paseo/pull/3536) superseded), а выравнивание macOS traffic lights и drag-region включены в единую titlebar-реализацию ([#3393](https://github.com/getpaseo/paseo/pull/3393) superseded).

## Стабильные OpenCode turns на старте

Два фикса закрывают сценарии стартовых сбоев OpenCode:

- [#3814](https://github.com/getpaseo/paseo/pull/3814) — раньше turn-dispatch ждал **первый record** SSE-стрима ровно 30 секунд, и падал ровно на границе, где общий event-consumer начинает восстановление после 30 секунд без record: промпт не отправлялся, даже если следующее соединение мгновенно успешно. Теперь dispatch остаётся gated на наблюдаемом стриме, но даёт существующему ретраю потребителя **15 секунд** чтобы «приземлиться» (failure всплывает после 45 секунд вместо 30), а фаза/attempt/elapsed/previous outcome консьюмера и SDK SSE-ошибка попадают в логи и в видимый в чате timeout.
- [#3821](https://github.com/getpaseo/paseo/pull/3821) — readiness больше не определяется **любым** первым stream record. Программные промпты ждут **авторитетного события `server.connected`** от upstream-сервера; случайный трафик не освобождает первый промпт. Поздние `server.connected`-frames напрямую запускают post-gap reconciliation, убран параллельный синтетический reconnection contract, а порядок событий/backoff/watchdog не меняются.

Оба фикса покрыты детерминированными regression/unit-тестами и real-provider проверками без изменений протокола и клиента.

## Fixes, которые стоит знать

- OpenCode turns падали, когда первый event-stream connection застревал при старте ([#3814](https://github.com/getpaseo/paseo/pull/3814));
- OpenCode промпты могли стартовать до того, как provider сообщит о готовом соединении ([#3821](https://github.com/getpaseo/paseo/pull/3821));
- Вместо пустой Side panel из 0.5.0 — стабильная Explorer sidebar и отдельные workspace-панели ([#3826](https://github.com/getpaseo/paseo/pull/3826)).

Полный список — в [release notes](https://github.com/getpaseo/paseo/releases/tag/v0.6.0).

## Кому обновляться в первую очередь

1. **Десктопным и планшетным пользователям** — вернулась привычная Explorer sidebar (Files/Changes), а контент открывается в обычных панелях; на планшетах снова работает resizable combined Explorer dock.
2. **Пользователям Windows/Linux** — единые custom window controls вместо shell-специфичных веток.
3. **Интерактивным пользователям OpenCode** — стартовые turns перестают «теряться» на границе таймаута event stream; готовность привязана к реальному `server.connected`.

## Ссылки

- Release: [v0.6.0](https://github.com/getpaseo/paseo/releases/tag/v0.6.0)
- Compare: [v0.5.0...v0.6.0](https://github.com/getpaseo/paseo/compare/v0.5.0...v0.6.0)
- PR: [Explorer как first-class pane host #3826](https://github.com/getpaseo/paseo/pull/3826)
- PR: [Recover OpenCode turns after a stalled event stream #3814](https://github.com/getpaseo/paseo/pull/3814)
- PR: [Wait for authoritative provider readiness before prompting #3821](https://github.com/getpaseo/paseo/pull/3821)

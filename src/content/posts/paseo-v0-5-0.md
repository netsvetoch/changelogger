---
author: Артём Нецветаев
pubDatetime: 2026-08-23T14:12:18.000Z
title: "Paseo 0.5.0: trusted local plugins, active-turn steering и пользовательская Side panel"
slug: paseo-v0-5-0
featured: false
draft: false
tags:
  - release
  - paseo
  - ai-agents
  - plugins
  - cli
  - typescript
description: "Разбор Paseo v0.5.0: managed local plugins (paseo plugin, панели, темы через plugin.addTheme), три active-turn поведения Interrupt/Steer/Queue для Claude/Codex/OpenCode, пользовательская Side panel с независимыми вкладками и New tabs, новые CLI-команды paseo project и paseo reload, per-host skill management."
---

[Paseo](https://github.com/getpaseo/paseo) выпустил минорный релиз [`v0.5.0`](https://github.com/getpaseo/paseo/releases/tag/v0.5.0) (23 августа 2026). Это большой product-релиз: первый поддерживаемый механизм **trusted local plugins**, переработанный workspace-интерфейс (пользовательская **Side panel** и browser-style **New tabs**), **active-turn steering** на равных для Claude/Codex/OpenCode и пара новых CLI-команд для повседневных операций.

Основа статьи — GitHub Release [`v0.5.0`](https://github.com/getpaseo/paseo/releases/tag/v0.5.0), compare [`v0.4.0...v0.5.0`](https://github.com/getpaseo/paseo/compare/v0.4.0...v0.5.0) (206 commits) и исходные PR.

## Trusted local plugins

Центральная механика релиза — плагины, которыми **управляет daemon**, а не клиент. [PR #3222](https://github.com/getpaseo/paseo/pull/3222) добавляет daemon-owned жизненный цикл: install, reload, enable, disable, remove, status и подпроцессный lifecycle. Модель доверия честная: плагины — это **trusted код**, который рендерится в общем React-дереве; Paseo «сдерживает» render-сбои и даёт daemon-side disable/removal для восстановления, но **не заявляет sandboxing и изоляцию нативных крашей**. Если сомневаетесь в коде — не ставьте его.

Полный набор API через CLI и бандл-скилл `/paseo-plugin` для авторов:

```bash
paseo plugin create    # init-скаффолдинг со strict TSX typechecking
paseo plugin install <plugin>
paseo plugin reload <plugin>
paseo plugin enable|disable <plugin>
paseo plugin status
paseo plugin remove <plugin>
```

Identity: config-ключ — это **runtime plugin ID**; обязательный manifest ID — только default на установке и может быть переопределён. Reload работает по strict stop-before-start без overlap, rollback и без введения generation/revision identity.

Плагины — это не только обработчики. [PR #3465](https://github.com/getpaseo/paseo/pull/3465) позволяет им регистрировать **workspace- и agent-scoped панели** рядом с существующими workspace tools и пункты **Command Center** (global / workspace / agent). Панели получают стабильные context ID и используют селекторные хуки `useWorkspace(id, selector)` / `useAgent(id, selector)` над кэшированным состоянием клиента, поэтому несвязанные обновления workspace не перерисовывают плагин. Транспорт собранных контрибуций остаётся на daemon, а placement/navigation/callbacks — на клиенте.

## Темы приложений из плагинов

[PR #3602](https://github.com/getpaseo/paseo/pull/3602) заменяет «импорт произвольного theme JSON в настройки» каноническим путём: **кастомные темы живут в trusted local plugins** через contribution point `plugin.addTheme`:

```ts
import { definePlugin } from "paseo/plugin";
import { Latte } from "./catppuccin-latte";
import { Mocha } from "./catppuccin-mocha";

export default definePlugin({
  contributions: plugin => {
    plugin.addTheme({
      id: "catppuccin.latte",
      name: "Catppuccin Latte",
      appearance: "light",
      colors: Latte, // background, foreground, raised/control surfaces,
      // borders, accent, muted foreground, focus ring
    });
    plugin.addTheme({
      id: "catppuccin.mocha",
      name: "Catppuccin Mocha",
      appearance: "dark",
      colors: Mocha,
    });
  },
});
```

Важно: плагин отдаёт **компактную палитру**, а не полный semantic token set — Paseo сам выводит из неё все application tokens (панели, меню, диффы, статус-цвета, terminal-поверхности). Это держит семантическую структуру, spacing, типографику и поведение компонентов под контролем ядра. Поскольку Unistyles требует имена тем на `StyleSheet.configure` до загрузки плагинов, Paseo резервирует **по одному** светлому и тёмному plugin-слоту, а тем может регистрироваться сколько угодно. Выбор персистится и откатывается к default, если плагин отключён/удалён/не отдаёт тему. Рабочий пример — `plugin-examples/catppuccin`.

## Active-turn steering: Interrupt / Steer / Queue

[PR #3394](https://github.com/getpaseo/paseo/pull/3394) даёт клиенту три конфигурируемых поведения для промпта, отправленного пока агент занят:

- **Interrupt** — прервать текущий turn и начать новый;
- **Steer** — «довернуть» ровно текущий turn, не запуская замещающий;
- **Queue** — подождать в клиентской очереди, которая дренируется, когда агент станет idle.

Admission, доставка в provider и fallback живут **в daemon**: клиент декларирует намерение, daemon владеет допуском в конкретный turn и безопасным fallback. Поддержка per-provider: #3580 добавляет настоящий steer для OpenCode без прерывания (adapter ждёт busy, коррелирует user-message echo с клиентским сообщением, admitt'ит стеер до отказа в permission и делает interrupt-and-replace только при однозначном отсутствии/неактивности сессии). Для Claude и Codex работал приоритетно, но единый механизм завязан на наличие у provider «released, verifiable same-turn API»: если стеер недоступен, происходит однократный fallback на interrupt-and-replace; неоднозначные сбои доставки — ошибка, без авто-ретрая.

## Workspace: пользовательская Side panel и browser-style New tabs

Правый вспомогательный pane становится полноценным хостом вкладок. [PR #3287](https://github.com/getpaseo/paseo/pull/3287) даёт main и right панелям одинаковый язык компактных draggable tab-чипов и общий `+`-меню; правая панель продолжает монтироваться даже скрытой, освобождая место, и восстанавливает ширину при фокусе своей вкладки. Рядом с Changes появляются панели **Files** и **Pull Request** (с empty state и одноразовым авто-открытием при первом детекте PR). Assistant file-link'и и file-edit tool routes открывают автономные file-вкладки в правой панели без дублирования канонических.

[PR #3605](https://github.com/getpaseo/paseo/pull/3605) делает поведение **user-directed**: Side panel открывается пустой, обычные пустые панели предлагают launcher (Changes / Pull request / Files / Agent / Terminal). Явные New-actions создают независимые вкладки Changes и Pull request, а состояние файлов/Changes принадлежит каждой вкладке, а не лейауту. Поддерживающий контент по умолчанию уходит в Side panel (настраивается).

[PR #3715](https://github.com/getpaseo/paseo/pull/3715) добавляет каждой панели **browser-style New tab**: у любого pane есть реальная независимо идентифицируемая вкладка New, `+` и **Cmd/Ctrl+T** открывают её, выбор элемента заменяет New tab на месте. Workspaces с агентами при старте не мигают New-tab'ом, а компактный composer diff-control открывает explorer overlay вместо desktop-вкладки. Non-final split при закрытии последней New-вкладки удаляется, финальная видимая панель сохраняется.

## Workspace labels и live change counts

[PR #3510](https://github.com/getpaseo/paseo/pull/3510) добавляет host-local **workspace labels**: persist-определения и назначения на хосте, синхронизация на подключённые клиенты, create/edit/assign из workspace-поверхностей, бейджи на рядах и include-only фильтр сайдбара. Non-goals: сохранённые вью, группировка и command-center интеграция. [PR #3341](https://github.com/getpaseo/paseo/pull/3341) делает **pinned workspaces сортируемыми** drag-and-drop (один локальный порядок поверх режимов project/status grouping).

Над активными composer'ами появятся **живые change counts**: [PR #3682](https://github.com/getpaseo/paseo/pull/3682) показывает additions/deletions текущего workspace-диффа поверх композера рядом с задачами и сабагентами (числовые обновления изолированы в пиле, без перерисовки панели агента). [PR #3685](https://github.com/getpaseo/paseo/pull/3685) добавляет workspace panel/tab/pane actions в **Command Center**: Changes, Files, Pull request, current-tab, pane и Side panel, с фокусом открываемой панели и keyboard-навигацией пустого pane launcher.

## CLI: `paseo project` и `paseo reload`

Две команды убирают ручной JSON-дёрганье и рестарт daemon.

[PR #3460](https://github.com/getpaseo/paseo/pull/3460) — тонкая обёртка над существующими project RPC (без protocol/daemon-изменений):

```bash
paseo project create [dir]        # по умолчанию текущая директория
paseo project ls                  # table или структурный вывод
paseo project rename <id> "Name"
paseo project rename <id> --reset # сброс кастомного имени
paseo project delete <id>         # отчитывается списком удалённых workspace ID
```

Пути для default local-подключения резолвятся на машине CLI; явный `--host` требует указать путь и оставляет его интерпретацию удалённому daemon (без интерактивных промптов).

[PR #3365](https://github.com/getpaseo/paseo/pull/3365) — применять runtime-safe изменения `config.json` **без рестарта daemon**:

```bash
paseo reload
paseo daemon reload      # эквивалентный spelling
paseo daemon reload --json
```

Daemon валидирует **полный** файл (невалидное ничего не применяет), атомарно применяет runtime-safe настройки, а точка-в-стартапе изменения (auth, логирование, speech/voice, worktree allocation и т.п.) перечисляет с точными restart-required путями. Классификация и применение живут в daemon, CLI не делает filesystem-предположений. Capability-gated RPC сохраняет обратную совместимость протокола.

## Per-host skill management

[PR #3451](https://github.com/getpaseo/paseo/pull/3451) переносит управление orchestration skills из Electron-процесса в **daemon**: настройка теперь осмысленна для remote hosts и не-desktop клиентов. Каталог, выбор (all/custom) и безопасная установка/удаление живут в daemon и обёрнуты в capability-gated RPC (`server_info.features.skillManagement`); UI доступен под **Host → Agents** для выбранного хоста. Desktop сохраняет one-time compatibility reader, чтобы существующий локальный выбор доехал до локального daemon без тихой смены. Non-goals: не меняются ни набор поставляемых скиллов, ни их поведение, ни target-директории (`~/.agents`, `~/.claude`, `~/.codex`).

## Guided Hub setup

[PR #3651](https://github.com/getpaseo/paseo/pull/3651) — zero-friction onboarding: `paseo hub login` в интерактивном режиме может подключить daemon **и** проверить starter workflow одним проходом, а стартовый агент выбирается на основе capability snapshot подключённого daemon (staged provider → model → mode, без большого Cartesian-меню). Сгенерированный `.paseo/hub.yml` сохраняет provider/model/mode. JSON и non-TTY логин остаются login-only и prompt-free; Hub без setup resources получает actionable guidance. Slack/Discord-фильтры пишут provider-native team/guild + явно введённые member/user ID, а не hub connection slug.

## Performance и UX runtime improvements

| Изменение                                              | PR                                                                                                         | Суть                                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Восстановление кэша при reconnect                      | [#3259](https://github.com/getpaseo/paseo/pull/3259), [#3329](https://github.com/getpaseo/paseo/pull/3329) | cached projects/workspaces/agents/timelines возвращаются немедленно, пока хосты переподключаются |
| Меньше stall при переключении workspace                | [#3447](https://github.com/getpaseo/paseo/pull/3447), [#3610](https://github.com/getpaseo/paseo/pull/3610) | длинные чаты на desktop/Android                                                                  |
| Composer typing в frame budget                         | [#3450](https://github.com/getpaseo/paseo/pull/3450)                                                       | web и desktop                                                                                    |
| Большие диффы остаются отзывчивыми                     | [#3422](https://github.com/getpaseo/paseo/pull/3422)                                                       | expand/scroll/comment                                                                            |
| Bounded rendering read-only preview                    | [#3665](https://github.com/getpaseo/paseo/pull/3665)                                                       | большие исходники не вешают preview                                                              |
| Без полных перезаписей transcript на диск              | [#3647](https://github.com/getpaseo/paseo/pull/3647)                                                       | long-running agent timelines                                                                     |
| Outcome summaries + failure-first grouping PR-проверок | [#3483](https://github.com/getpaseo/paseo/pull/3483)                                                       | статусы PR удобнее читать                                                                        |
| Subagent/task trackers — плавающие пиллы над composer  | [#3482](https://github.com/getpaseo/paseo/pull/3482)                                                       | вместо привязанных к строке                                                                      |
| One options sheet mobile agent config                  | [#3424](https://github.com/getpaseo/paseo/pull/3424)                                                       | мобильная конфигурация агента в одном листе                                                      |
| Отдельный Content text sizing                          | [#3637](https://github.com/getpaseo/paseo/pull/3637)                                                       | размер шрифта текста для chat/composer/Markdown/review по отдельности                            |
| Pi usage/context метры при активных turns              | [#3532](https://github.com/getpaseo/paseo/pull/3532)                                                       | обновление в рантайме                                                                            |
| Default send — dropdown в настройках                   | [#3644](https://github.com/getpaseo/paseo/pull/3644)                                                       | вместо фиксированного поведения                                                                  |
| Предупреждение о pairing links                         | [#3734](https://github.com/getpaseo/paseo/pull/3734)                                                       | ссылки-пайринги на desktop и CLI дают доступ к daemon — явный предупреждающий эквивалент пароля  |

## Fixes, которые стоит знать

- Отмена CJK IME-композиции в текстовых полях и мобильных терминалах — долгий хвост PR ([#2811](https://github.com/getpaseo/paseo/pull/2811), [#3343](https://github.com/getpaseo/paseo/pull/3343), [#3391](https://github.com/getpaseo/paseo/pull/3391), [#3462](https://github.com/getpaseo/paseo/pull/3462), [#3517](https://github.com/getpaseo/paseo/pull/3517));
- OpenCode turns падали при обрыве event stream ([#3395](https://github.com/getpaseo/paseo/pull/3395)) и таймаутили при медленном/плагинозагруженном старте ([#3578](https://github.com/getpaseo/paseo/pull/3578), [#3621](https://github.com/getpaseo/paseo/pull/3621));
- merged PR больше не архивирует ws ([#3425](https://github.com/getpaseo/paseo/pull/3425)); pull request checkout при `upstream` ремоуте ([#2997](https://github.com/getpaseo/paseo/pull/2997));
- Annotate/Screenshot элементы ничего не делали на загруженных desktop-страницах ([#3187](https://github.com/getpaseo/paseo/pull/3187));
- Повторные copy/fork футеры после heartbeat runs ([#3484](https://github.com/getpaseo/paseo/pull/3484));
- Cursor plan usage на хостах, залогиненных только через `cursor-agent` ([#3486](https://github.com/getpaseo/paseo/pull/3486));
- Мобильные и многострочные composer'ы держали устаревший текст/высоты ([#3564](https://github.com/getpaseo/paseo/pull/3564), [#3681](https://github.com/getpaseo/paseo/pull/3681), [#3740](https://github.com/getpaseo/paseo/pull/3740));
- Claude usage «недоступен» при нескольких credential items в macOS Keychain ([#3597](https://github.com/getpaseo/paseo/pull/3597)); provider usage checks перезаписывали Claude/Codex credential files ([#3442](https://github.com/getpaseo/paseo/pull/3442));
- Active Codex agents не открывались после архивации native thread вне Paseo ([#3334](https://github.com/getpaseo/paseo/pull/3334)); агентов нельзя было остановить после завершения turn провайдером ([#3742](https://github.com/getpaseo/paseo/pull/3742));
- Worktree creation отклонял Git-валидные branch names с верхним регистром/`_`/`.` ([#3591](https://github.com/getpaseo/paseo/pull/3591));
- Malformed SVG project icons роняли iOS app ([#3711](https://github.com/getpaseo/paseo/pull/3711)); stale project icons в New Workspace ([#3600](https://github.com/getpaseo/paseo/pull/3600));
- Fresh installs резолвили provider SDK версии, не валидированные с релизом ([#3678](https://github.com/getpaseo/paseo/pull/3678));
- Исправлены русские переводы и терминология UI ([#3586](https://github.com/getpaseo/paseo/pull/3586)).

Полный список — в [release notes](https://github.com/getpaseo/paseo/releases/tag/v0.5.0).

## Кому обновляться в первую очередь

1. **Авторам расширений** — появился полноценный supported путь: `paseo plugin` + бандл-скилл `/paseo-plugin`, панели, Command Center items и contribution point `plugin.addTheme` для тем приложений.
2. **Тем, кто управляет хаотичными workspace'ами** — labels + сортируемые pinned workspace'ы и фильтр сайдбара.
3. **Интерактивным пользователям Claude/Codex/OpenCode** — Steer доворачивает живой turn без прерывания; Queue даёт неблокирующий сценарий.
4. **CLI ops** — `paseo project` и `paseo reload` убирают ручные правки и рестарты.
5. **Мультихостовым настройкам** — skill management теперь осмыслен для remote hosts через Host → Agents.

## Ссылки

- Release: [v0.5.0](https://github.com/getpaseo/paseo/releases/tag/v0.5.0)
- Compare: [v0.4.0...v0.5.0](https://github.com/getpaseo/paseo/compare/v0.4.0...v0.5.0)
- SDK docs: [paseo.sh/docs/sdk](https://paseo.sh/docs/sdk)
- CLI docs: [paseo.sh/docs/cli](https://paseo.sh/docs/cli)
- Plugins (пример Catppuccin): [`plugin-examples/catppuccin`](https://github.com/getpaseo/paseo/tree/v0.5.0/apps/plugin-examples/catppuccin)

---
author: Артём Нецветаев
pubDatetime: 2026-08-15T19:06:00.000Z
title: "ompweb 0.3.0: Interrupt & reply, host-tool/URI мосты и runtime-режимы OMP"
slug: ompweb-v0-3-0
featured: false
draft: false
tags:
  - release
  - ompweb
  - oh-my-pi
  - coding-agent
  - rpc
  - web-ui
description: "Разбор ompweb v0.3.0: abort_and_prompt в композере, host-tools open_url/notify/open_file, pi-web://clipboard, queue delivery modes, cycle_model/thinking, retry settings, отказ от in-app self-update."
---

[ompweb](https://github.com/kahme247/ompweb) — локальный веб-UI для [oh-my-pi (omp)](https://github.com/can1357/oh-my-pi) — выпустил минор [`v0.3.0`](https://github.com/kahme247/ompweb/releases/tag/v0.3.0) (13 августа 2026). Это не косметический релиз: веб-клиент догоняет RPC-поверхность агента. Композер умеет прервать ход и сразу отправить новый промпт, агент может открыть URL/файл и трогать буфер обмена через хост, а live-сессия получает те же runtime-режимы, что и TUI.

Источники: [GitHub Release v0.3.0](https://github.com/kahme247/ompweb/releases/tag/v0.3.0), compare [`v0.2.9...v0.3.0`](https://github.com/kahme247/ompweb/compare/v0.2.9...v0.3.0) (19 коммитов). Патч [`v0.3.1`](https://github.com/kahme247/ompweb/releases/tag/v0.3.1) уже вышел на следующий день — статья про границу `0.3.0`, не про патч.

## Interrupt & reply: `abort_and_prompt`

Пока агент стримит, в композере появляется кнопка **Interrupt & reply**. Она не кладёт сообщение в очередь steering/follow-up и не делает обычный abort: `useAgentSession.handleInterruptAndReply` шлёт RPC `abort_and_prompt` с текущим черновиком (текст + base64-картинки).

Чтобы терминальный `agent_end` старого хода не снёс только что стартовавший run, хук ставит `interruptReplyPendingRef`. Пока флаг жив, `agent_end` глотается; снимается на `agent_start` нового хода. Если агент не бежит или черновик пуст — команда не уходит.

Это mid-run only: без живой сессии кнопки нет.

## Host-tool bridge: агент зовёт браузер

`set_host_tools` / `host_tool_call` / `host_tool_result` теперь не заглушка. UI регистрирует три инструмента при старте run и на SSE-reconnect (`set_host_tools` живёт на wrapper, в сессию не пишется):

| Tool        | Что делает                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `open_url`  | `window.open(url, "_blank", "noopener,noreferrer")`                                               |
| `notify`    | `Notification` API; если permission `default` — запрашивает, при блоке всё равно отвечает успехом |
| `open_file` | открывает путь в workspace file viewer через `onOpenFile`                                         |

`ask_user` в этот список не входит: вопросы пользователю уже идут через extension UI protocol. Незарегистрированный tool или отвалившийся UI сразу получают `host_tool_result` с `isError: true`, чтобы ход агента не завис.

## Host-URI: `pi-web://clipboard`

Параллельный мост `set_host_uri_schemes` / `host_uri_request` / `host_uri_result`. ompweb регистрирует одну схему:

```ts
{
  scheme: "pi-web",
  description: "Browser-integrated resources: pi-web://clipboard …",
  writable: true,
}
```

`read`/`write` `pi-web://clipboard` идут в `navigator.clipboard`. Нет API, отказ permission или потеря фокуса окна — ошибка вида «Click into the omp-web window and try again». Неизвестная схема и write в non-writable scheme режутся ещё в `rpc-manager`, до браузера.

На старых сборках omp оба моста молча no-op.

## Runtime-режимы сессии

Команды уже были в passthrough RPC; в 0.3.0 у них появился UI и синхронизация из `get_state`.

**Interrupt / Auto-Compact** (пилюли в композере, только для существующей сессии):

- `set_interrupt_mode` — `immediate` («Now»: steering рвёт агента сразу) или `wait` (после текущего шага);
- `set_auto_compaction` — per-session автокомпакция контекста.

**Очередь сообщений** — два селекта рядом с queued panel:

- `set_steering_mode`: `Steer: one` (`one-at-a-time`) / `Steer: all`;
- `set_follow_up_mode`: то же для follow-up.

Значения оптимистично пишутся в стейт и перечитываются из каждого `get_state` (load / reconcile / model refresh). Ошибка RPC всплывает notice.

**Retry** переехал в Settings → Native:

- `retry.enabled` — автоповтор упавшего хода (дефолт включён);
- `retry.maxRetries` — 0…5 в селекте, валидатор конфига принимает 0…20;
- `retry.modelFallback` — смена модели, когда ретраи кончились.

Пишется в allow-listed `~/.omp/agent/config.yml`. Живой override — кнопка **Abort retry** на баннере композера (`abort_retry`): останавливает текущий цикл и оставляет failed turn как есть.

**External Thinking** (нужен omp ≥ 17.2.14): тумблер рядом с Thinking Blocks. `externalThinking: true` включает private scratchpad через tool `think` и выключает native reasoning GPT/Claude/Gemini. Поле читается/валидируется/пишется тем же `settings-config`.

## Клавиатура: модель и thinking без дропдауна

Глобальный `keydown` на окне сессии (не в поле ввода, чтобы не пересекаться с набором):

- `⌘/Ctrl+Alt+M` → `cycle_model`;
- `⌘/Ctrl+Alt+T` → `cycle_thinking_level`.

После каждой команды `refreshLiveModelState`: дропдауны композера, Fast mode и runtime-пилюли перечитываются. Сбой — notice, не тихий no-op.

На узком десктопе ряд контролов (Interrupt, Auto-Compact, Fast, thinking, tools, compact, sound) получил `flex-wrap`, чтобы пилюли не вылезали за край.

## Self-update больше не ставит пакеты сам

In-app установка omp/ompweb снята целиком: удалены `bin/omp-web-update.js`, `lib/update-backups.ts` и `action: "update"` на `/api/omp-update` и `/api/app-update`. Check остаётся, toast/Settings показывают команду:

- OMP: `omp update`;
- ompweb: `npm install -g @kahme247/ompweb` или `bun add -g @kahme247/ompweb` — в зависимости от `detectInstallMethod`.

Restart живых RPC-сессий после ручного апдейта по-прежнему есть. Автоматический мутатор глобального install, который в 0.2.7 пытались страховать snapshot/rollback, больше не запускается из UI.

## Надёжность live-сессии

Не фичи, но они чинят то, на чём UI падал mid-run:

- **Turbopack chunk race** в `lib/syntax-highlight.ts`: lazy `import()` refractor-грамматик (c, rust, go, …) периодически ронял страницу (`module factory is not available`). Все ~30 грамматик теперь static import в основной client chunk; `ensureLanguageRegistered` оставлен как no-op ради совместимости.
- **SSE reconnect** больше не orphan'ится: таймер в ref, отмена на unmount/смене сессии, reconnect только если `sessionIdRef` всё ещё тот же.
- **Navigate fence**: `contextRequestSeqRef` отбрасывает устаревший `/context`, чтобы быстрый клик по ветке не затирал более новый ответ.
- **Compact**: `isCompactingRef` переживает batched render — два клика в одном тике больше не шлют две команды.
- **RPC dispose**: `destroyPromise` + `startRpcSession` ждёт exit старого `omp --mode rpc-ui` перед новым spawn, иначе два ребёнка гоняются за одним `.jsonl`.
- **Windows paths**: `comparablePath` (resolve + case-fold) для worktree remove и prefix-match файловых API — `C:\Repo` и `c:/repo` больше не дают ложный `not_a_worktree`.
- `ChatInput` обёрнут в `memo`; toast description рендерится как `div`, не `p` (внутри уже блочная разметка).

## Кому стоит обновиться

Всем, кто водит omp из браузера, а не из TUI: без 0.3.0 нет Interrupt & reply, host-tools, clipboard URI и queue delivery modes. Особенно заметно, если агент должен открыть ссылку/файл или вы читаете/пишете буфер обмена из tool-вызова.

Если полагались на кнопку «Update now» внутри Settings — её больше нет: обновляйте из терминала, потом Restart sessions.

Нужен omp с соответствующими RPC (`abort_and_prompt`, `set_host_tools`, `set_host_uri_schemes`, `cycle_model`, queue modes). На более старом бинаре мосты просто не регистрируются.

## Как обновиться

```sh
npm install -g @kahme247/ompweb@0.3.0
# или уже патч линейки:
# npm install -g @kahme247/ompweb@0.3.1
```

Запуск без установки: `npx @kahme247/ompweb@0.3.0`. Нужны Node ≥ 22.19.0 и `omp` в `PATH` (или `OMP_WEB_OMP_BIN`). По умолчанию UI слушает `http://127.0.0.1:30177`.

Полный changelog — [v0.3.0](https://github.com/kahme247/ompweb/releases/tag/v0.3.0), diff — [`v0.2.9...v0.3.0`](https://github.com/kahme247/ompweb/compare/v0.2.9...v0.3.0).

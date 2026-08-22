---
author: Артём Нецветаев
pubDatetime: 2026-08-22T21:55:03.000Z
title: "OpenAI Codex rust-v0.149.0: codex agents дашборд, codex queue, /cd и Vim-изменения"
slug: openai-codex-rust-v0-149-0
featured: false
draft: false
tags:
  - release
  - codex
  - openai
  - cli
  - tui
  - vim
  - sdk
description: "Разбор OpenAI Codex rust-v0.149.0: интерактивный дашборд tasks через codex agents, codex queue для отправки сообщений в существующие сессии, команды /cd /pwd /cwd в TUI, расширение Vim-редактирования, новые диагностики codex doctor и raw config overrides + reasoning max/ultra в SDK."
---

OpenAI выпустила [`rust-v0.149.0`](https://github.com/openai/codex/releases/tag/rust-v0.149.0) — minor-релиз Codex, в котором появился отдельный интерактивный дашборд агентов, новая команда для отправки сообщений в уже запущенные сессии и управление рабочей директорией прямо из TUI.

Ниже — разбор GitHub Release и связанных PR: [`#39114`](https://github.com/openai/codex/pull/39114), [`#39112`](https://github.com/openai/codex/pull/39112), [`#39142`](https://github.com/openai/codex/pull/39142), [`#39092`](https://github.com/openai/codex/pull/39092), [`#38894`](https://github.com/openai/codex/pull/38894), [`#39661`](https://github.com/openai/codex/pull/39661), [`#38817`](https://github.com/openai/codex/pull/38817), [`#39662`](https://github.com/openai/codex/pull/39662), [`#38827`](https://github.com/openai/codex/pull/38827), [`#38918`](https://github.com/openai/codex/pull/38918), [`#39060`](https://github.com/openai/codex/pull/39060), [`#39074`](https://github.com/openai/codex/pull/39074).

## `codex agents`: интерактивный дашборд задач

Релиз добавляет выделенную команду `codex agents` ([`#39114`](https://github.com/openai/codex/pull/39114)) — общий вид всех агентов без создания новой сессии. На Unix она автоматически поднимает локальный фоновый app-server либо подключается к серверу через `--remote`.

```bash
codex agents                 # открыть общий дашборд
codex agents --remote <url>  # подключиться к указанному app-server
```

Сам обзор стал интерактивным ([`#39112`](https://github.com/openai/codex/pull/39112)): из него можно запускать новые задачи, открывать корневые сессии, переименовывать задачи и останавливать активную работу. На широких терминалах у выбранной задачи выводится подробности, а сам обзор ограничен корневыми сессиями, при этом фоновая активность субагентов всё равно отражается. При переключении между сессиями сохраняются черновик ввода и pending-запросы к серверу, диспетчеризация из проектной группировки применяет рабочую директорию выбранного проекта (включая remote-воркспейсы).

Горячие клавиши панели конфигурируются ([`#39142`](https://github.com/openai/codex/pull/39142)): ключ `tui.keymap.global.open_agents` по умолчанию привязан к `alt-a`, есть отдельный keymap-контекст `agents` (поиск, новая задача, переименование, стоп, группировка). Конфликт с существующим кастомным `alt-a` автоматически отключает новый дефолт:

```toml
[tui.keymap.global]
open_agents = "alt-a"   # открыть обзор агентов
```

## Управление рабочей директорией в TUI: `/cd`, `/pwd`, `/cwd`

PR [`#38894`](https://github.com/openai/codex/pull/38894) добавляет команды для смены и просмотра рабочей директории сессии прямо в TUI, не теряя историю разговора.

```text
/cd            # перейти в ~ (путь по умолчанию)
/cd ../src     # относительный путь резолвится от текущей директории
/pwd           # показать текущую рабочую директорию
/cwd           # алиас для /pwd
```

Перед заменой активной сессии Codex перечитывает конфигурацию проекта, инструкции, permissions, keybindings, поиск по файлам и хуки для новой директории. Опасные переходы отклоняются: активная или поставленная в очередь работа, фоновые терминалы, remote-окружения, непроверенные директории и несовместимые permission-профили. `/pwd` дополнительно отбрасывает асинхронные результаты, оставшиеся от предыдущей директории.

## `codex queue`: отправка сообщений в существующие сессии

PR [`#39092`](https://github.com/openai/codex/pull/39092) добавляет команду `codex queue` для отправки текстового сообщения в уже запущенную сессию (интерактивную, exec или custom) через app-server API `thread/queue/add`.

```bash
codex queue --thread <UUID|name> --message "звонок: обнови README"
```

Сессия разрешается по UUID или точному имени; неоднозначные имена отклоняются, как и пустые сообщения и вложения-картинки. Работает и с локальным, и с явным remote app-server — несовместимый сервер или конфигурационные override сообщаются вместо того, чтобы молча поменять цель.

Связанные исправления доводят механику очередей до рабочего состояния ([`#39034`](https://github.com/openai/codex/pull/39034), [`#39385`](https://github.com/openai/codex/pull/39385), [`#39604`](https://github.com/openai/codex/pull/39604)): простаивающие треды теперь будятся, когда очередь пополнилась из другого процесса (через отслеживание durable revision в SQLite), при name-based выборе предпочитается самая свежая сессия, а вставленный/отложенный ввод сохраняет свою семантику.

## Vim: замена символа и change-движения

PR [`#39661`](https://github.com/openai/codex/pull/39661) расширяет Vim-редактирование в композере TUI. Появляется действие `vim_normal.replace_char` (по умолчанию `r`) — замена графемы под курсором без выхода из normal mode:

```text
r<char>   # заменить символ под курсором на <char>
cw        # изменить слово
c$        # изменить до конца строки
cj / ck   # изменить текущую и следующую/предыдущую строку
cc        # изменить текущую строку
```

`Esc` отменяет pending-замену, а существующие кастомные Vim-биндинги и префиксы аккордов сохраняются при вводе новых дефолтов.

## `codex doctor`: endpoint protection, сеть, desktop-приложение и обновления

Набор диагностик `codex doctor` расширился сразу в четырёх направлениях.

- **Endpoint protection** ([`#38827`](https://github.com/openai/codex/pull/38827)) — обнаружение продуктов вроде CrowdStrike Falcon, BeyondTrust Privilege Management, Microsoft Defender, SentinelOne и Jamf Protect на macOS/Windows и предупреждение, если их исключения для Codex не проверены, с продуктово-специфичными рекомендациями.
- **Сеть** ([`#38918`](https://github.com/openai/codex/pull/38918)) — пробинг endpoints inference по route-aware HTTP-клиенту с учётом прокси и кастомного CA; ошибки TLS, аутентификации/конфигурации прокси, резолвинга и таймаутов классифицируются в разборные подсказки. На macOS предлагается включить `respect_system_proxy`, если настроенный прокси иначе не используется.
- **Desktop-приложение** ([`#39060`](https://github.com/openai/codex/pull/39060)) — базовый раздел про версию, состояние запуска и заредкченный путь к логам установленного desktop-приложения, плюс результат последнего local handshake с app-server.
- **Обновления** ([`#39074`](https://github.com/openai/codex/pull/39074)) — проверка доступности update-CDN, репорт Windows Store-сборок и подготовленных Sparkle-обновлений на macOS, валидация Windows update-манифестов.

```bash
codex doctor   # теперь включает разделы Endpoint Protection, Network, Desktop App и Updates
```

## SDK: raw config overrides и reasoning `max`/`ultra`

В TypeScript SDK ([`#38817`](https://github.com/openai/codex/pull/38817)) появился `CodexOptions.configOverrides` — передача точных CLI-аргументов `--config key=value` без изменений. Это нужно там, где структурированный dotted-key config не может безопасно представить TOML вроде permission-мап со строковыми ключами-путями. Raw-оверрайды применяются после структурированного `config`, сохраняя приоритет SDK-managed и thread-specific настроек.

```ts
const codex = new Codex({
  configOverrides: [
    "--config",
    'permissions.allow=["/home/user/work/**"]',
  ],
});
// …

// reasoning effort: новые значения в типе ModelReasoningEffort
model: { provider: "openai", id: "gpt-5.6", reasoningEffort: "max" }
```

Сами усилия рассуждения ([`#39662`](https://github.com/openai/codex/pull/39662)) пополнились уровнями `max` и `ultra` — они добавлены и в TypeScript `ModelReasoningEffort`, и в Python `ReasoningEffort` (примеры выбора модели обновлены на новые уровни).

## Что ещё в релизе

- [`#39153`](https://github.com/openai/codex/pull/39153): при resume и fork треда восстанавливается активный permission-профиль (последняя approval policy, approvals reviewer и ID профиля) вместо молчаливого отката на текущий дефолт.
- [`#39257`](https://github.com/openai/codex/pull/39257): WebRTC sideband-подключения realtime пересоздаются после обрыва транспорта без потери pending-вывода.
- [`#39049`](https://github.com/openai/codex/pull/39049) / [`#39088`](https://github.com/openai/codex/pull/39088): убран дублирующий вывод активности субагентов в TUI и ужесточена маршрутизация их уведомлений и approvals.
- [`#39081`](https://github.com/openai/codex/pull/39081): replay-буферы неактивных тредов ограничены по размеру изменений (delta), чтобы не копить избыточный потоковый вывод.
- [`#39619`](https://github.com/openai/codex/pull/39619): inline-история TUI остаётся доступной в scrollback Windows Terminal.

## Итоги для обновления

1. **Обзор агентов.** Запустите `codex agents` (горячая клавиша по умолчанию `alt-a`) для поиска, старта, переименования и остановки задач; биндинги меняются в `tui.keymap.global.open_agents`.
2. **Рабочая директория.** В TUI используйте `/cd [path]` (с перезагрузкой конфигурации проекта) и `/pwd` / `/cwd` для просмотра текущей директории.
3. **Асинхронные сообщения.** Отправляйте сообщения в уже запущенные сессии через `codex queue --thread <id|name> --message "…"`; простаивающие сессии отныне будятся надёжно.
4. **Vim.** Доступны замена символа (`r`), change-движения `cw`, `c$`, `cj`, `ck` и повторённая `cc`.
5. **Диагностика.** `codex doctor` теперь покрывает endpoint protection, сеть/прокси, состояние desktop-приложения и канал обновлений.
6. **SDK.** Для точных TOML-настроек используйте `CodexOptions.configOverrides`, а для более глубокого рассуждения — `reasoningEffort: "max"` / `"ultra"` (TypeScript и Python).

Минорный релиз `0.149.0` заметно расширяет управление долго живущими сессиями «извне»: интерактивная панель агентов, асинхронная отправка сообщений и перенос рабочей директории, плюс приятный шаг вперёд для Vim-пользователей и диагностики установки.

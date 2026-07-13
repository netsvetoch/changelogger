---
author: Артём Нецветаев
pubDatetime: 2026-07-13T10:33:48.000Z
title: "OpenChamber 1.16.0: серверные Session Goals, быстрый relay и продолжение работы сессий"
slug: openchamber-v1-16-0
featured: false
draft: false
tags:
  - release
  - openchamber
  - ai
  - remote-access
description: "Разбор OpenChamber 1.16.0: серверный цикл Session Goals с независимым аудитом, сохранение auto-accept после перезапуска, быстрый relay-доступ, OpenCode Go usage и управление subagent-сессиями."
---

OpenChamber выпустил минорную версию [`v1.16.0`](https://github.com/openchamber/openchamber/releases/tag/v1.16.0). Главная функция релиза — **Session Goals**: теперь сообщение можно превратить не просто в один запрос к агенту, а в цель, которую сервер будет доводить до проверяемого результата. Релиз также заметно меняет remote access, хранение разрешений и работу с subagent-сессиями.

Ниже — не только пункты release notes, но и детали из исходников релиза [`v1.16.0`](https://github.com/openchamber/openchamber/releases/tag/v1.16.0), compare [`v1.15.0...v1.16.0`](https://github.com/openchamber/openchamber/compare/v1.15.0...v1.16.0) и ключевых коммитов: [`56cf5e2`](https://github.com/openchamber/openchamber/commit/56cf5e29fa063ffaf8aae7ed72d37db14bfce374), [`af34f22`](https://github.com/openchamber/openchamber/commit/af34f22269eb4e9537d2ff6a110e18c09598d414), [`79e4592`](https://github.com/openchamber/openchamber/commit/79e4592cad35554ba126883f0ebe84164507fa9b), [`6231375`](https://github.com/openchamber/openchamber/commit/6231375baf905422722fc0a9542084e6553bab0e) и [`1cb7787`](https://github.com/openchamber/openchamber/commit/1cb77872d62ec0657424ceec0c4c8874d91a4f03).

## Session Goals: цель вместо ручного «продолжай»

В composer появилась кнопка с иконкой мишени. Если включить её перед отправкой сообщения, следующий prompt становится objective цели. Для новой сессии это работает ещё на draft: цель создаётся вместе с первой отправкой, а не только после появления первого сообщения.

Сервер хранит состояние цели в `metadata.openchamber.goal`. В payload входят конкретные поля:

- `status`: `active`, `paused`, `blocked`, `budgetLimited` или `complete`;
- `objective` либо флаг `objectiveFile` для текста, сохранённого в файле сервера;
- `tokenBudget`, `tokensUsed`, `turnsUsed` и счётчики аудита;
- `note` — последняя заметка аудитора, `statusReason` и курсор `lastAccountedMessageID`.

Пример минимального состояния, которое OpenChamber добавляет к сессии:

```json
{
  "metadata": {
    "openchamber": {
      "goal": {
        "id": "goal-id",
        "objective": "Добавь тесты для export-модуля и добейся зелёного test suite",
        "status": "active",
        "tokenBudget": 200000,
        "tokensUsed": 0,
        "turnsUsed": 0
      }
    }
  }
}
```

Цикл работает в `packages/web/server/lib/session-goal/runtime.js`, а не в браузере. После завершения хода и короткого quiet window сервер передаёт независимой небольшой модели только objective и последний ответ агента. Аудитор возвращает один из вердиктов `continue`, `complete` или `blocked`:

1. `continue` запускает следующий `prompt_async` с тем же provider/model, что и последний ответ;
2. `complete` завершает цель и отправляет итоговое уведомление;
3. `blocked` учитывается как последовательная неудача — цель останавливается только после трёх blocked-вердиктов подряд.

Это важно для поведения при закрытом приложении: цикл подписан на серверную SSE-шину и переживает отключение UI и перезапуск клиента. Во время активной цели обычные уведомления «агент готов» подавляются, чтобы не приходить после каждого автоматического хода; вместо них приходит одно уведомление при `complete`, `blocked` или достижении бюджета. Ошибки, вопросы и запросы разрешений продолжают уведомляться отдельно.

Есть и жёсткие ограничители: ошибка хода переводит цель в `blocked`, заданный `tokenBudget` — в `budgetLimited`, а автоматические продолжения ограничены 20 ходами. Для контекстной компрессии добавлен отдельный учёт сегментов: стоимость последнего завершённого assistant-сообщения считается как `input + cache.read + output`, а после compaction начинается новый сегмент. Поэтому цикл не должен бесконечно продолжаться из-за того, что агент упёрся в окно контекста.

Запустить цель можно не только мишенью в composer:

- в диалоге запуска новой сессии из ответа агента включить **Run as goal**;
- при реализации сохранённого плана включить **Run as goal** — аудит получает содержимое плана, а не только короткую команду «реализуй его»;
- в scheduled task включить **Run as goal**;
- использовать новый starter **Craft a Goal** или команду `/craft-goal`.

Для длинных целей текст хранится в `<data-dir>/goals/<sessionId>.md`, а metadata содержит только `objectiveFile: true`. Серверные маршруты для этого — `PUT/GET/DELETE /api/goals/objective/:sessionId`; размер objective ограничен 5000 символами. Если запись файла недоступна, UI оставляет inline fallback.

Управлять целью можно в полосе над composer или в диалоге: там показываются статус, последняя заметка аудитора, использованные токены и кнопка pause/resume. Pause одновременно вызывает `abortCurrentOperation`, а Resume снова вооружает цикл; если сессия уже idle, продолжение отправляется примерно через 250 мс.

## Auto-accept теперь переживает закрытие приложения

Раньше настройка автоматического принятия tool calls была в клиентском состоянии. В коммите [`6231375`](https://github.com/openchamber/openchamber/commit/6231375baf905422722fc0a9542084e6553bab0e) она перенесена в серверный runtime `packages/web/server/lib/permission-auto-accept/runtime.js` и синхронизируется через metadata сессии.

Практический результат: auto-accept продолжает работать, когда окно закрыто, после перезапуска сервера и в subagent-сессиях. Настройку можно включить ещё до первого сообщения в draft — это отдельно исправлено в [`893d7a1`](https://github.com/openchamber/openchamber/commit/893d7a1e64bf4b7dc5194f56fe6039aa9063bdcf).

## Remote access: relay быстрее и без случайного выбора процесса

В [`07ddaec`](https://github.com/openchamber/openchamber/commit/07ddaecd224f1087beea67357223badb28a6354d) подключение с телефона перестаёт сначала ждать таймаут устаревшего локального адреса. Если локальный endpoint не отвечает, приложение быстрее переходит к relay; раньше это могло занимать около 20 секунд вне домашней сети. На launch screen мобильное приложение теперь показывает, к какому устройству оно подключается.

Коммит [`af34f22`](https://github.com/openchamber/openchamber/commit/af34f22269eb4e9537d2ff6a110e18c09598d414) добавляет обновление connection candidates: когда компьютер получает новый локальный IP, сопряжённое устройство узнаёт адрес через relay и может вернуться на локальную сеть без повторного pairing. В том же наборе изменений relay identity получает дополнительную проверку, а spoofing запросов, которые подделывают local host headers под same-machine traffic, отклоняется.

Отдельная проблема была в запуске нескольких OpenChamber на одном компьютере. Коммит [`79e4592`](https://github.com/openchamber/openchamber/commit/79e4592cad35554ba126883f0ebe84164507fa9b) добавляет cooperative claim lock в `packages/web/server/lib/relay/host-lock.js`: relay обслуживает только один процесс на машину. Поэтому paired device больше не попадает случайно в другой экземпляр и не получает intermittent `Unable to reach server`.

## Usage: OpenCode Go и корректные окна Codex

В Settings появился провайдер OpenCode Go. Серверный `packages/web/server/lib/quota/providers/opencode-go.js` читает workspace dashboard `https://opencode.ai/workspace/<workspaceId>/go`, извлекает окна `5h`, `weekly` и `monthly`, а для каждого сохраняет процент использования и время сброса через `resetInSec`.

Для Codex исправлена нормализация `primary_window` и `secondary_window` из `https://chatgpt.com/backend-api/wham/usage`: теперь `limit_window_seconds` преобразуется в корректную подпись окна, а `reset_at` используется как фактическое время сброса. Это устраняет прежние неверные reset times в quota UI.

## Subagent-сессии можно продолжать напрямую

Опциональная возможность из [`1cb7787`](https://github.com/openchamber/openchamber/commit/1cb77872d62ec0657424ceec0c4c8874d91a4f03) добавляет prompting для subagent-сессий. Откройте subagent из context panel и отправьте follow-up, не создавая новую обычную сессию. Функция выключена по умолчанию и включается в настройках.

Это дополняют исправления чата: queued message теперь отправляется, когда сессия уже idle; ожидающий вопрос агента сохраняется answerable после рестарта; переименование сессии больше не откатывается к старому заголовку. Для tool output добавлена runtime-защита от объектов там, где SDK обещает строку: иначе структурированный результат TODO или вопроса мог привести к React error #31 и белому экрану.

## Остальные заметные изменения

- В file viewer появился переключатель markdown preview.
- Проекты можно сортировать разными режимами с переключением направления; pinned sessions переживают refresh, а раскрытые каталоги file tree не схлопываются при обновлении.
- Command palette теперь индексирует проекты вместе с sessions, files, settings и commands. Выбор проекта открывает новый session draft с уже выбранным проектом.
- В Settings → Appearance добавлен `editorFontSize`: число от 9 до 32, по умолчанию 13. Оно применяется к chat input и CodeMirror; для line height использовано unitless `1.5`, чтобы крупный шрифт не приводил к наложению строк.
- Контекст GitHub PR/issue в fork workflow теперь получает `sourceRepo`, поэтому downstream-вызовы не ищут PR в origin-репозитории и не возвращают ошибочный 404.
- Сохранение agent settings больше не удаляет неизвестные поля YAML frontmatter.
- `Open in` распознаёт VS Code Insiders.
- На Windows сравнение путей нормализует регистр буквы диска, чтобы один проект не появлялся как два.
- На мобильных устройствах sessions sidebar открывается быстрее; переименование сохранённого instance больше не теряет access token; на Android 15 UI учитывает safe area под status bar.

Таким образом, `v1.16.0` — это прежде всего переход от клиентского помощника к серверному циклу выполнения целей. Если OpenChamber используется для длинных задач, важнее всего включить Session Goals: objective, независимый audit, token budget и остановка после проверяемого результата теперь являются частью самой сессии, а не ручного процесса пользователя.

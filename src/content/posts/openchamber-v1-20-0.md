---
author: Артём Нецветаев
pubDatetime: 2026-08-22T23:41:06.000Z
title: "OpenChamber 1.20.0: /btw — вопросы на полях, чаты без проекта и каталог навыков"
slug: openchamber-v1-20-0
featured: false
draft: false
tags:
  - release
  - openchamber
  - ai-agents
  - chat
  - remote-desktop
description: "Разбор OpenChamber 1.20.0: команда /btw для побочных вопросов во временной ветке диалога, управляемые чаты без проекта, ремонт Remote/Desktop подключений по SSH, новый каталог навыков GitHub, diff по базовой ветке и настраиваемые провайдеры с выбором протокола API."
---

[OpenChamber](https://github.com/openchamber/openchamber) выпустил минорный релиз [`v1.20.0`](https://github.com/openchamber/openchamber/releases/tag/v1.20.0). Главное нововведение — команда **`/btw`** для «вопросов на полях» во временной ответвлённой сессии, которая не трогает основной чат. Вокруг неё — отдельный раздел **Chats** для диалогов без привязки к проекту, переделка SSH-подключений к удалённым машинам, новый карточный каталог навыков GitHub и ещё несколько заметных настроек.

Основа статьи — GitHub Release [`v1.20.0`](https://github.com/openchamber/openchamber/releases/tag/v1.20.0), compare [`v1.19.0...v1.20.0`](https://github.com/openchamber/openchamber/compare/v1.19.0...v1.20.0) (68 коммитов) и ключевые PR: [«/btw side questions» #2796](https://github.com/openchamber/openchamber/pull/2796), [skills catalog redesign #3016](https://github.com/openchamber/openchamber/pull/3016), [app deep links #2932](https://github.com/openchamber/openchamber/pull/2932), [files outside-workspace grants #3078](https://github.com/openchamber/openchamber/pull/3078).

## `/btw` — побочный вопрос во временной сессии

Команда [`/btw`](https://github.com/openchamber/openchamber/pull/2796) позволяет задать off-topic вопрос, не отвлекая основной диалог. `btw.ts` явно описывает механику: вопросом **создаётся форк** (`/btw <question> <context>`) основного чата, а не пустой дочерний диалог — поэтому агент получает всю уже накопленную переписку как контекст окна. Форк создаётся напрямую через SDK, `currentSessionId` основного чата не переключается, а промпт маршрутизируется в форк через `SendMessageOptions.sessionId`.

```
> /btw какой формат у переменной OPENCHAMBER_MEMORY_ENABLE
```

Пока панель открыта, расширение ведёт диалог со временной сессией, которая живёт **вне сайдбара и списков сессий** — в родительской сессии хранится только метаданные `openchamber.btwSessionID`, поэтому панель «принадлежит» той сессии, из которой её открыли, переживает перезагрузку (см. `sessionBtwMetadata`) и следует за пользователем между сессиями. Панель можно свернуть в узкую полосу заголовка, превратить в полноценную сессию через «keep» или просто закрыть. Спасибо @jaygupta17.

## Чаты без проекта: раздел Chats

Раньше каждый чат создавался внутри проекта и наследовал его репозиторий и worktree-контекст. Теперь (см. `feat(chats): add managed projectless chat sessions`, [PR #2930](https://github.com/openchamber/openchamber/pull/2930) для внешних сессий в сайдбаре) можно начать разговор без выбора проекта — такие чаты попадают в собственный раздел **Chats** отдельно от проектных. Для project-less чатов ввели выделенное пустое сообщение, у них скрыт work status проекта, а карточка статуса работы уступает место панели контекста, когда та открыта. Созданные за пределами самого OpenChamber сессии теперь тоже появляются в сайдбаре и списке Recent без обновления страницы.

## Desktop/Remote: переработка SSH-подключений

`feat(ssh): rework remote instance setup and fix remote installs` заметно меняет [ssh-manager](https://github.com/openchamber/openchamber/blob/v1.20.0/packages/electron/ssh-manager.mjs) (+133/−44 строки) и добавленные тесты `ssh-manager.test.mjs`:

- новый SSH-коннектор стартует **из хостов, уже описанных в `~/.ssh/config`,** вместо пустого поля команды; порты, метод установки и пароли убраны за **Advanced settings**, у каждого подключения есть статус **Connected / Connecting / Needs attention** с текстом ошибки и кнопкой её разрешения;
- подключение к удалённой машине работает, когда `bun`, `OpenChamber` или CLI `opencode` лежат **в домашней директории**, а не только на системном пути — установка больше не падает с permission error, а отсутствующий CLI `opencode` сообщается **до** старта подключения вместо stack trace;
- управляемый удалённый сервер можно опубликовать **в локальную сеть** самой удалённой машины (требует UI-пароль; иначе остаётся приватным за SSH-туннелем);
- отключение от подключения с настройкой «не держать сервер запущенным» теперь реально останавливает удалённый сервер.

## Каталог навыков: карточки из GitHub-коллекций

[PR #3016](https://github.com/openchamber/openchamber/pull/3016) переделывает **Skills Catalog**: вместо простого списка — карточная витрина курируемых GitHub-коллекций навыков с кросс-источниковым поиском, счётчиком навыков, звёздами, датами обновлений и ссылками на репозиторий каждого скилла. Источник навыков [уточняется на ClawHub](https://github.com/openchamber/openchamber/blob/v1.20.0/packages/ui/src/stores/useSkillsCatalogStore.ts) (@makeittech).

## Diff по базовой ветке

В контекстную панель добавлен **Branch-scope** diff ([`branchDiffScope`](https://github.com/openchamber/openchamber/blob/v1.20.0/packages/ui/src/components/views/branchDiffScope.ts) был вынесен в чистые хелперы и покрыт тестами). Scope «все изменения ветки против базовой» доступен только когда Git знает базовую ветку: `isBranchScopeAvailable` требует известного `repositoryDefaultBranch`, отличного от текущей ветки. Если база неизвестна — OpenChamber один раз спрашивает её, а пока метаданные загружаются, опция не показывается, чтобы не мигать догадкой.

```ts
export const isBranchScopeAvailable = (
  currentBranch,
  repositoryDefaultBranch
) =>
  Boolean(currentBranch) &&
  repositoryDefaultBranch !== null &&
  currentBranch !== repositoryDefaultBranch;
```

## Диктовка: транскрибация после записи

[`Dictation`](https://github.com/openchamber/openchamber/blob/v1.20.0/packages/ui/src/components/dictation/DictationWaveform.tsx) больше не распознаёт речь в реальном времени: речь транскрибируется **после остановки записи**, в композере появляются живой waveform и таймер, а длинные записи разбиваются на части по паузам (новый `DictationWaveform.tsx`, до +130 строк), не обрезая слова.

## Провайдеры: настраиваемые + выбор протокола API

Расширена поддержка **custom providers** ([`feat(providers): support custom API protocols`](https://github.com/openchamber/openchamber/commit/1d853a9)). Кастомный провайдер теперь задаёт явный **протокол API**, которому сопоставляется нужный `@ai-sdk`-пакет:

```ts
export const CUSTOM_PROVIDER_PROTOCOLS = {
  "openai-chat": "@ai-sdk/openai-compatible",
  "openai-responses": "@ai-sdk/openai",
  "anthropic-messages": "@ai-sdk/anthropic",
};
```

Серверная проверка подтверждает: «Custom providers must use @ai-sdk/openai-compatible, @ai-sdk/openai, or @ai-sdk/anthropic». Для config-defined кастомных провайдеров пропускается требование авторизации ([`fix: skip auth requirement for config-defined custom providers`](https://github.com/openchamber/openchamber/commit/ddd4b5e)). **Small Model** (summaries, goal audits, commit messages, walkthroughs) теперь поддерживает больше провайдеров, а plugin-registered провайдеры резолвятся от запущенного OpenCode.

## Привязка thinking level к проекту

`feat(projects): pin a thinking level next to a project's model` ([commit 5bce474](https://github.com/openchamber/openchamber/commit/5bce474)) — для моделей с уровнями рассуждения проект может **закрепить thinking level** рядом с моделью. Оба значения лежат в одной группе **Defaults for new chats**, выложенной как Defaults сессий (`packages/ui/src/lib/modelVariants.ts`).

## Git: генерация под стиль репозитория

[Commit f708345](https://github.com/openchamber/openchamber/commit/f708345) учит генерацию адаптироваться к репозиторию:

- **commit messages** — выборка последних 10 тем коммитов, модель инструктируется совпадать с их языком, префиксной конвенцией и длиной; Conventional Commits используется как fallback только когда история не демонстрирует стабильного стиля;
- **pull request description** — подхватывается собственный PR-шаблон репозитория (проверяются стандартные расположения), и черновик возвращается с родными секциями и чеклистами проекта вместо встроенных Summary/Why/Testing.

## Ещё изменения этого релиза

- **Настройки:** селектор проекта на страницах Providers, Agents, MCP, Commands и Skills теперь меняет только содержимое этих страниц, а не переключает всё приложение с чатом, списком сессий и деревом файлов. Выбранный провайдер больше не «перепрыгивает» сам собой при смене модели/агента чата или фоновом обновлении. Изменение default модели/варианта/агента не перенацеливает открытый чат с уже выбранной моделью — чаты, следящие за дефолтом, всё ещё переключаются сразу.
- **Апп-ссылки:** `spotify://` и подобные переходят в подтверждение перед открытием другого приложения; доверенные типы ссылок управляются в Settings ([PR #2932](https://github.com/openchamber/openchamber/pull/2932)).
- **Files/Desktop:** файлы вне workspace остаются читаемыми после истечения временного доступа, а не теряются до повторного открытия ([PR #3078](https://github.com/openchamber/openchamber/pull/3078)).
- **Settings/Integrations:** экспериментальная страница показывает только устанавливаемые интеграции; «недоступные» и «Coming soon» убраны.
- **Chat:** inline-комментарий к diff открывает чат и фокусирует композер; в расширенном композере Enter теперь переносит строку, а отправка — на Cmd/Ctrl+Enter; путь к файлу в сообщении открывается из проекта сессии, даже если до этого просматривались файлы другого проекта (@tomzx); при рестарте OpenCode во время ответа чат останавливается в состоянии _interrupted_ с уведомлением о продолжении, а не молчит (@sum117).
- **Sidebar:** переключатель между полным списком проектов и фокусом на один проект; счётчик активности остаётся синхронным.
- **Usage:** лимиты кредитов Z.ai показываются вместе с другими окнами квот.
- **UI/Desktop:** кнопка закрытия диалога стала крупнее для клика/тапа (@rockinrimmer); кнопка закрытия окна на Windows выровнена с остальным хромом. Исчезновения мигания новых сообщений и подсвеченных блоков кода (bash-вывод может расти с содержимым), длинные сообщения раскрываются даже когда финальная раскладка приходит позже.

Как и раньше, OpenChamber работает поверх OpenCode и поставляется как open-source web/desktop-интерфейс к нему. Полный список изменений — в [release notes v1.20.0](https://github.com/openchamber/openchamber/releases/tag/v1.20.0).

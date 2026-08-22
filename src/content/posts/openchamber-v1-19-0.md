---
author: Артём Нецветаев
pubDatetime: 2026-08-22T20:05:00.000Z
title: "OpenChamber 1.19.0: страница Integrations, Project knowledge и reuse соединений прокси"
slug: openchamber-v1-19-0
featured: false
draft: false
tags:
  - release
  - openchamber
  - ai-agents
  - settings
  - performance
description: "Разбор OpenChamber 1.19.0: страница Integrations для установки плагинов Claude Code/Command Code/Cursor, переработка Project notes в Project knowledge с agent memory, reuse соединений прокси (чтобы не исчерпывались сетевые порты), починка конфига OpenCode и лимитов Claude через вход Claude Code."
---

[OpenChamber](https://github.com/openchamber/openchamber) выпустил минорный релиз [`v1.19.0`](https://github.com/openchamber/openchamber/releases/tag/v1.19.0). Ключевые контуры — новая страница Integrations для управления сторонними плагинами OpenCode в одном месте, перестройка панели Project notes в **Project knowledge** с собственной серверной памятью агента, а также крупная починка прокси: локальный сервер теперь переиспользует соединения к OpenCode, тогда как раньше под нагрузкой мог исчерпать все исходящие сетевые порты машины.

Основа статьи — GitHub Release [`v1.19.0`](https://github.com/openchamber/openchamber/releases/tag/v1.19.0), compare [`v1.18.0...v1.19.0`](https://github.com/openchamber/openchamber/compare/v1.18.0...v1.19.0) (~290 коммитов) и связанные PR: [Integrations #2910](https://github.com/openchamber/openchamber/pull/2910), [Project knowledge #2973](https://github.com/openchamber/openchamber/pull/2973), [reuse соединений #2916](https://github.com/openchamber/openchamber/pull/2916).

## Settings → Integrations: установка плагинов OpenCode из одного места

Новая страница **Integrations** в Settings ([PR #2910](https://github.com/openchamber/openchamber/pull/2910)) собирает в одном аккордеоне управление дочерними проектами Claude Code, Command Code и Cursor, плюс заглушки Discord и Telegram.

Для каждого плагина из каталога доступны действия **Install / Update / Setup / Docs / Remove** — все они прокидываются через существующий plugins store (persisted user-scope plugin entries) и используют общий UI Settings, поэтому страница работает одинаково в web, desktop, VS Code и mobile-рантаймах. Статусные бейджи показывают состояние (не установлен / установлен / есть обновление / требуется перезапуск), а после успешного действия появляется restart-aware тост, напоминающий о необходимости перезапуска.

Non-goals PR (явно зафиксированы в описании): заглушки мессенджеров — только визуальные placeholders, без живых Discord/Telegram-ботов; страница не заменяет Settings → Plugins для произвольного управления плагинами; Setup открывает существующий provider setup, не меняя flow авторизации провайдеров. Каталог указывает на OpenChamber-принадлежащие npm/GitHub-пакеты.

## Project notes → Project knowledge: серверное хранилище + agent memory

Панель Project notes переработана в **Project knowledge** ([PR #2973](https://github.com/openchamber/openchamber/pull/2973)). Раньше notes, todos и plans хранились в одном общем JSON-файле, в который писали ещё шесть несвязанных доменов, синхронизация шла через `window` CustomEvents, а панель умела только читать plans. Теперь это сервер-ориентированное хранилище с явными routes, настоящим store, секционной боковой панелью, поиском по notes/todos/plans, а планы открываются и редактируются прямо в панели, а не в отдельной вкладке. Notes — это карточки, раскрывающиеся по клику в любом месте; notes и plans можно закреплять как контекст (`pins` scoped to sessions).

Поверх этого PR добавляет **agent memory** — хранилище, которое агент пишет для себя, отдельное от notes пользователя, а инъекция постоянного проектного контекста переехала на сервер, чтобы достигать сессий без UI и переживать compaction.

Agent memory поставляется **выключенной** (`ships dark`): существование в процессе контролирует переменная окружения. Пока она не задана — нет ни инструмента, ни routes, ни session index, ни строки в настройках и ни вкладки панели:

```bash
OPENCHAMBER_MEMORY_ENABLE=1 openchamber
```

Судьбу этой фичи (демонстрация и тестирование) авторы обсуждают в рамках того же PR, прежде чем включать по умолчанию.

## Стабильность: прокси переиспользует соединения к OpenCode

[PR #2916](https://github.com/openchamber/openchamber/pull/2916) правит локальный прокси. `createProxyMiddleware` создавался без `agent`, из-за чего `http-proxy` откатывался к `agent: false`: это отключает пул соединений и принудительно ставит `Connection: close` на каждый проксируемый запрос:

```js
outgoing.agent = options.agent || false;   // -> false
...
if (!outgoing.agent) {
  if (typeof outgoing.headers.connection !== 'string' || !upgradeHeader.test(outgoing.headers.connection)) {
    outgoing.headers.connection = 'close'; // -> принудительно
  }
}
```

Итог — один TCP-connection и один эфемерный порт на каждый API-запрос. В простое это незаметно, но при стабильной нагрузке сервер проходил весь пул эфемерных портов хоста вниз — и в этот момент уже ничто на компьютере не могло открыть новое соединение, пока трафик не прекращался и порты не освобождались. Теперь соединения к OpenCode переиспользуются между запросами, порты не расходуются. Спасибо @alohaninja.

## Конфиг OpenCode больше не затирается пустой заглушкой

Исправление, важное для тех, кто держит в `openchamber`/`opencode` конфиг с JSON5-стилем (незакавыченные ключи). Раньше при изменении настроек OpenChamber подменял полный конфиг OpenCode пустой обёрткой только с `$schema`, затирая plugins, MCP-серверы и провайдеры. Теперь такая запись не происходит, а изменения настроек **падают с ошибкой**, ничего не стирая. Спасибо @makeittech.

## Ещё изменения этого релиза

- **Chat (производительность):** открытый разговор больше не перекрашивает одни и те же code blocks в фоне — при открытом чате просмотр файлов перестал нагружать один CPU-core и раскручивать вентиляторы (@makeittech).
- **Usage/Claude:** лимиты Claude-плана работают при входе через Claude Code без отдельного входа в Anthropic внутри OpenChamber — аккаунт читается из собственного логина Claude Code на macOS, Linux и WSL. Страница снова показывает session и weekly limits, добавляет per-model weekly limits и extra usage spending и имя плана; лимиты остаются на экране, когда Anthropic временно блокирует обновления.
- **Usage/Command Code:** лимиты плана Command Code появились в Usage page и work status panel.
- **Git:** панель pull request следует за текущим open-PR ветки; открытый PR всегда побеждает более старый merged/closed. После merge/close панель продолжает показывать его как последний PR ветки и предлагает создание следующего сразу под ним (@makeittech).
- **Git/Worktrees:** создание worktree из PR падает в fallback на GitHub pull-request reference, когда исходный fork удалён или недоступен, вместо ошибки до создания worktree (@makeittech).
- **Files:** файлы, достигнутые через symlink внутри workspace, снова открываются, а не отклоняются как «вне workspace»; drag-загрузка файлов на Files sidebar загружает их в проект или конкретную папку, существующие файлы требуют подтверждения перезаписи, а открытые превью обновляются после загрузки (@makeittech, @alanzchen).
- **Chat (IME):** ввод с китайскими, японскими и корейскими раскладками не прерывает композицию и не прыгает курсором в конец композера (@makeittech).
- **Chat/Worktrees:** новые чаты больше не стартуют против удалённой последней worktree-директории — они откатываются на активный проект, вместо «сохранить первое сообщение и не стартовать».
- **Context panel:** открытие занятого subagent показывает его историю, а не только строку рабочего статуса; сохранённые чаты снова открываются вместо пустого экрана.
- **Context meter:** больше не залезает за 100% (раньше доходило до 330%) после ходов с множеством tool calls и не прыгает при переоткрытии старой сессии; значение честное везде — header, context sidebar, work status panel, mini chat и mobile (@pocharlies).
- **Chat/Attachments:** извлечённый контент Office/OpenDocument теперь ограничивается по объёму и показывается компактнее, чтобы крупные документы и их изображения не перегружали контекст сообщения.
- **Projects:** имена проектов совпадают с именем папки точно — `.ssh` и `opencode-claude` больше не показываются как `.Ssh` и `Opencode Claude` в сайдбаре, заголовке окна, настройках и уведомлениях; переименованные вручную имена сохраняются.
- **Settings:** выбранное действие файла сессии (session retention) теперь сохраняется, а не теряется (@Gautam0507).
- **Mobile:** подключение через ngrok-адрес обходит предупреждающую страницу ngrok вместо провала проверки сервера; на iOS выделение текста в композере использует нативные CodeMirror selection handles.
- **Desktop:** страницы браузера, отдаваемые с self-signed loopback HTTPS-адреса, загружаются вместо блокировки по предупреждению о сертификате.
- **Browser:** ввод комментария на странице больше не триггерит ярлыки приложения.
- **Skills Catalog:** источник теперь называется ClawHub, а не «ClawdHub» (@makeittech).

Как и раньше, OpenChamber работает поверх OpenCode и продолжает поставляться как open-source web/desktop-интерфейс к нему. Полный список изменений — в [release notes v1.19.0](https://github.com/openchamber/openchamber/releases/tag/v1.19.0).

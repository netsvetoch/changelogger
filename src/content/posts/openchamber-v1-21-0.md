---
author: Артём Нецветаев
pubDatetime: 2026-08-26T21:01:15.000Z
title: "OpenChamber 1.21.0: пересборка скролла чата, новые горячие клавиши, вкладки сессий и комментарии к ответам"
slug: openchamber-v1-21-0
featured: false
draft: false
tags:
  - release
  - openchamber
  - ai-agents
  - chat
  - shortcuts
description: "Разбор OpenChamber 1.21.0: скролл чата перестроен вокруг вашего сообщения с плавным потоковым раскрытием и опцией авто-следования, горячие клавиши переработаны на центральном реестре с лидером Cmd/Ctrl+K, вкладки открытых сессий, контекстные карточки вместо стен текста, комментарии к ответам и diff-ревью, настраиваемая панель контекста и единый алгоритм поиска."
---

[OpenChamber](https://github.com/openchamber/openchamber) выпустил минорный релиз [`v1.21.0`](https://github.com/openchamber/openchamber/releases/tag/v1.21.0) — большой релиз про UX чата, клавиатуру и комментарии. Главное — **скролл чата перестроен вокруг вашего сообщения**, горячие клавиши полностью переработаны на новом центральном реестре с «лидером» `Cmd/Ctrl+K`, а в разговор можно комментировать как обычные ответы, так и куски diff-ревью.

Основа статьи — GitHub Release [`v1.21.0`](https://github.com/openchamber/openchamber/releases/tag/v1.21.0), compare [`v1.20.0...v1.21.0`](https://github.com/openchamber/openchamber/compare/v1.20.0...v1.21.0) (177 коммитов) и ключевые PR/коммиты: реестр горячих клавиш [#2532](https://github.com/openchamber/openchamber/pull/2532), единый алгоритм поиска [`rankByQuery`](https://github.com/openchamber/openchamber/commit/9ef8387), cycle-thinking-варианты [#2848](https://github.com/openchamber/openchamber/pull/2848).

## Скролл чата перестроен вокруг вашего сообщения

Самая заметная часть релиза — новый скролл-механик. Отправка «паркует» ваше сообщение у верха экрана, а ответ «течёт» ниже него, раскрываясь плавно по абзацу за раз ([`feat(chat): block-level streaming reveal with a gliding follow`](https://github.com/openchamber/openchamber/commit/ca216cf)). Движок скролла заменён на **anchored-turn LegendList** ([`feat(chat): upgrade @legendapp/list to 3.3.8 and let it own end following`](https://github.com/openchamber/openchamber/commit/fb01697)) — список следует за «живым краем» прямыми записями в scroll, без покадровых прыжков.

Ключевая перемена в том, кто управляет прокруткой:

- как только вы скроллите вверх, управление сразу переходит к вам — список перестаёт «приклеиваться» к концу;
- **кругляшка scroll-to-bottom** теперь отдельная гладкая плашка ([`feat(chat): glass scroll-to-bottom pill on the left carries the streaming signal`](https://github.com/openchamber/openchamber/commit/4f4089b)): она отображает рабочий статус модели, пока вы находитесь в «старой» части разговора;
- share-слот один: статусная строка и плашка скролла живут в одном anchored-слоте и не «смешиваются» между собой ([`fix(chat): status row and scroll pill share one anchored slot`](https://github.com/openchamber/openchamber/commit/7bcaad2)).

В дополнение появился переключатель **«Follow new content while streaming»** (Settings → Chat → Streaming, включён по умолчанию; commit [`feat(settings): add streaming auto-follow toggle`](https://github.com/openchamber/openchamber/commit/6b1b7e4)). Он отключает автоматическое следование за новым контентом целиком — при выключенном авто-следовании плашка scroll-to-bottom появляется, как только ответ выходит за видимую область. Пара настроек дополняется фиксами паракскролла: скролл во время стрима снова работает на мобильных, а при изменении ширины окна читатель внизу не «соскакивает» с позиции.

## Горячие клавиши переработаны на центральном реестре

Весь набор горячих клавиш переехал на **единый реестр** и новый диспетчер последовательностей ([`feat(ui): add shortcut registry and sequence dispatcher`, #2532](https://github.com/openchamber/openchamber/pull/2532)). Раньше шорткаты регистрировались разрозненно по компонентам; теперь они централизованы (`refactor(ui): register application shortcuts centrally`) и подчиняются общим правилам конфликтов (`fix(ui): enforce shortcut conflict rules`).

Новая раскладка по умолчанию:

- **одиночные аккорды** для повседневных действий;
- **лидер `Cmd/Ctrl+K`** для двухшаговых «открыть/перейти» действий ([`feat(ui): redesign the default shortcut layout around a mod+k leader`](https://github.com/openchamber/openchamber/commit/0c64009));
- удержание **`Cmd/Ctrl+digit`** — вкладки сессий, **`Cmd/Ctrl+Option+digit`** — панельные поверхности.

Важные свойства новой системы:

- шорткаты теперь работают **на неанглийских раскладках клавиатуры** — это отдельный фикс с обработкой IME-префиксов ([`fix(ui): handle IME prefixes and select shortcut conflicts`](https://github.com/openchamber/openchamber/commit/f1adf6f));
- **тултипы показывают биндинг, который у вас реально установлен** ([`feat(ui): show platform-specific shortcut labels`](https://github.com/openchamber/openchamber/commit/b9627e8));
- **старые кастомные биндинги сбрасываются один раз** при переезде на новую схему;
- полная карта живёт в **Settings → Shortcuts** (реестр в том числе от ревью @ChangeHow).

Заодно добавлены шорткаты из новых возможностей релиза:

- `Cmd/Ctrl+Enter` в поле сообщения коммита — закоммитить; `Alt+Down/Up` в diff-ревью — переход между изменёнными файлами (с разворачиванием свёрнутого по прибытии);
- `Cmd/Ctrl+Shift+T` — теперь **цикл по всем уровням рассуждения** текущей модели, а не «перескок» после достижения конца ([#2848](https://github.com/openchamber/openchamber/pull/2848) + фикс возврата к дефолту [#3153](https://github.com/openchamber/openchamber/pull/3153));
- `Cmd/Ctrl+Tab`... точнее `Cmd/Ctrl+Alt+Left/Right` — шаг назад/вперёд по сессиям, открытым в этом окне (в стиле истории браузера);
- **карточки разрешений** отвечают клавишам: `Alt+Enter` — разрешить один раз, `Alt+Shift+Enter` — разрешить всегда, `Alt+Backspace` — запретить (клавиши напечатаны прямо на кнопках). Авто-принятие получило `Cmd/Ctrl+K, A`.

## Контекстные вложения — компактные карточки контекста

Разные вложения — комментарии к diff, выделения в терминале, аннотации в браузере, связанные issues/PR и прочее — больше не падают в диалог «стеной» сырого текста. Теперь они появляются как **компактные контекстные карточки**. Под капотом это цепочка изменений: `structured context attachments with metadata round-trip` ([commit 03a8e6e](https://github.com/openchamber/openchamber/commit/03a8e6e)) заводит метаданные вложений, а [`feat(chat): messenger-style context cards with message-level collapse`](https://github.com/openchamber/openchamber/commit/3802b1e) превращает их в «мессенджерские» карточки с раскрытием/сворачиванием на уровне сообщения.

В композере клик по контекстной чипу открывает **стек-превью всего прикреплённого** ([`feat(composer): context chip previews with inline comment editing`](https://github.com/openchamber/openchamber/commit/24c0caf)): там комментарий можно отредактировать на месте, а вложение — убрать до отправки.

## Комментарии к ответам и к diff-ревью

В чате появилась возможность оставлять комментарии к отдельному ответу: выделите текст в сообщении (или в отрендеренном markdown-превью в Files) и выберите **Comment** — прикрепится ровно выделенная цитата, добавятся исходные диапазон строк, когда его можно определить, и ваш текст. Выделение остаётся подсвеченным, пока вы печатаете ([`feat(files): comment on selection in read-only markdown previews`](https://github.com/openchamber/openchamber/commit/fbcf39a)).

Diff обзавёлся **комментированием в стиле ревью**: при наведении на строку в gutter появляется `+`; клик или перетаскивание через строки открывает редактор комментария для этого диапазона — по стилю такой же, как комментарии чата ([`feat(diff): unified comment UI with gutter plus and content-drag selection`](https://github.com/openchamber/openchamber/commit/a06fc19)).

На мобильных поле ввода комментария в чате накладывается на композер, повторяя его поведение, и едет вместе с клавиатурой; там `Enter` переносит строку, а прикрепление — на кнопке.

## Вкладки сессий (opt-in)

Шапка web/desktop теперь может показывать открытые сессии в виде **вкладок браузера** ([`feat(header): session tabs — a horizontal working set of open sessions`](https://github.com/openchamber/openchamber/commit/23d88cc)). Включается это в **Settings → General → Navigation**. Особенности:

- вкладка переключает всё рабочее пространство, а **закрытие вкладки никогда не трогает саму сессию**;
- тумблер **Session tabs** именно opt-in ([`feat(header): session tabs are opt-in`](https://github.com/openchamber/openchamber/commit/5a9e6e7));
- вкладки следуют дизайн-языку таб-бара заголовка (`style(header): session tabs follow the titlebar tab design language`), есть тултипы, индикаторы статуса и контекстное меню;
- лимит вкладок зарежён по производительности: максимум **20 вкладок**, тултипы грузятся только по наведению ([`perf(header): cap session tabs at 20`](https://github.com/openchamber/openchamber/commit/c749173));
- `Alt+W` закрывает активную вкладку (настраивается в Settings) — и заодно служит одной из целей нового реестра шорткатов.

С включёнными вкладками горячие `Cmd/Ctrl+Alt+Left/Right` переключают соседние вкладки, а не «историю» сессий.

## Переключение сессий и сайдбар стали быстрее

Работа с большими библиотеками сессий заметно ускорена: сайдбар **больше не пересобирается** при переключении ([`perf(ui): streamline session sidebar state`](https://github.com/openchamber/openchamber/commit/c92daad)), а недавно просмотренные сессии **восстанавливают отрендеренные сообщения** — сквозное время переключения при тысячах загруженных сессий сократилось примерно вдвое. Серия из десятка `perf(ui)`-коммитов догружает детали: кэш markdown-блоков, «тёплые» DOM-превью, батчинг обновлений сессий, изоляцию эффектов скролл-теней. Спасибо @c-w-xiaohei. Есть и фикс регрессий после этой перф-ребазы (`fix(ui): preserve upstream sidebar and selection behavior`).

## Настраиваемая панель контекста

У контекстного рельса появилась кнопка **конфигурации** ([`feat(ui): let users hide context rail surfaces`](https://github.com/openchamber/openchamber/commit/e469377)): диалог выбирает, какие панели рельс показывает. Скрытые панели **сохраняют свои данные**, остаются доступными из командной палитры и не сдвигают цифровой переключатель — цифры всегда соответствуют видимым иконкам. Раньше набор панелей рельса был фиксированным и скрыть ненужные было нельзя.

## Единый алгоритм поиска

Все поисковые выпадашки теперь работают на **одном матчере** [`rankByQuery`](https://github.com/openchamber/openchamber/commit/9ef8387) ([`refactor(search): unify dropdown filtering on the shared ranked matcher`](https://github.com/openchamber/openchamber/commit/b8d03c6)). Модель ранжирования единая: среди результатов сначала лучшие совпадения, многословные запросы находятся в любом порядке слов, пунктуация игнорируется — поэтому `"gpt4o"` находит `gpt-4o`. `Ctrl/Cmd+P` теперь сопоставляет **полные пути файлов** ([`fix(command-palette): match file results against the full relative path`](https://github.com/openchamber/openchamber/commit/1a285ba)), а упоминания файлов через `@` ранжируют файлы и директории вместе по качеству совпадения — и при длинных путях папка остаётся видимой рядом с именем файла ([`feat(chat): rank @-mentions files and directories together by match quality`](https://github.com/openchamber/openchamber/commit/f74a544)).

## Ещё изменения этого релиза

- **Терминал:** вкладки и устройства больше не «исчезают за спиной» — показываются уже запущенные на сервере терминалы, а фоновые вкладки переживают idle-очистку; мобильные клавиатуры больше не делают заглавной первую букву каждой команды.
- **Auth:** истёкший логин OpenChamber анонсируется баннером с кнопкой **Log in** в течение секунд, а не обнаруживается через падающие действия; отправка приостанавливается до входа, а не загрузившийся диалог перезагружается сам.
- **Desktop:** два окна на разных проектах перестали «перехватывать» друг друга — переключение сессии в одном окне больше не подхватывает проект в другом; клики по уведомлениям и `openchamber://` открываются в одном окне, а не во всех. Свежеустановленная/обновлённая сборка не грузит интерфейс предыдущей версии из кэша. Relay-дефолтный хост с парой больше не встречает каждый рестарт экраном «Remote Server Unreachable».
- **Git:** бейдж PR ветки больше не подхватывает чужой pull request (вклад форка с тем же именем ветки больше не показывается на локальной ветке); `Cmd/Ctrl+Enter` в поле commit-сообщения — закоммитить.
- **Files:** превью файлов больше лимита редактирования виртуализированы — огромные файлы больше не замораживают приложение (@gaojunran).
- **Browser:** открытие страницы агентом с инструментом browser больше не выпрыгивает панель браузера и не переключает поверхность — страница грузится в фоне, смотреть её можно на рельсе.
- **Usage:** плитка Command Code убрана — у официального API этих данных нет, и плитка могла только ошибаться.
- **Chat:** неудачная отправка возвращает ваш промпт в поле ввода (вместо потери в error-toast), переключение сессии в середине отправки укладывает его в черновик этой сессии; streamed-блоки кода подсвечиваются во время стрима, а готовое сообщение не «прыгает», когда заполняются номера строк; `Cmd/Ctrl+Shift+T` циклит по всем уровням рассуждения.
- **VSCode:** чат-вью не висит на loading-экране на медленных/удалённых подключениях (@VinciYan).
- **Фиксы утечек состояний:** выбранный проект/сессия не перепрыгивает при приходе настроек не по порядку; сессии не застревают в «loading sessions» при полуоткрытом соединении с OpenCode — зависшие чтения таймаутятся и переходят к ретраю (@herjarsa); ссылки на файлы в сообщениях больше не проверяются дважды и не против неправильной директории проекта.

Как и раньше, OpenChamber работает поверх OpenCode и поставляется как open-source web/desktop-интерфейс к нему. Полный список изменений — в [release notes v1.21.0](https://github.com/openchamber/openchamber/releases/tag/v1.21.0).

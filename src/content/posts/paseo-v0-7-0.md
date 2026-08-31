---
author: Артём Нецветаев
pubDatetime: 2026-08-31T18:00:00.000Z
title: "Paseo 0.7.0: плагины прямо из Git, timeline-трансформации, SSH к удалённым daemon и Apache-2.0"
slug: paseo-v0-7-0
featured: false
draft: false
tags:
  - release
  - paseo
  - ai-agents
  - plugins
  - sdk
  - cli
  - typescript
description: "Разбор Paseo v0.7.0: установка и обновление плагинов напрямую из Git-репозиториев, plugin-трансформации и рендер timeline-элементов, SSH-подключения к существующим удалённым daemon, девять новых workspace-действий в Command Center, расширение публичного SDK (Modal/Icon/useToast, навигация, семантические цвета, paseo.projects.list) и переход лицензии проекта на Apache-2.0."
---

[Paseo](https://github.com/getpaseo/paseo) выпустил минорный релиз [`v0.7.0`](https://github.com/getpaseo/paseo/releases/tag/v0.7.0) (31 августа 2026). Это большой product-релиз с фокусом на платформу расширений: плагины теперь устанавливаются и обновляются напрямую из Git-репозиториев, получают право трансформировать и рендерить элементы timeline, а также новый пул UI-примитивов в публичном SDK. Параллельно CLI и Desktop научились подключаться к уже существующим удалённым daemon по SSH, а проект начал переводиться на **Apache-2.0**.

Основа статьи — GitHub Release [`v0.7.0`](https://github.com/getpaseo/paseo/releases/tag/v0.7.0), compare [`v0.6.0...v0.7.0`](https://github.com/getpaseo/paseo/compare/v0.6.0...v0.7.0) и исходные PR.

## Проект лицензируется по Apache-2.0

[PR #3944](https://github.com/getpaseo/paseo/pull/3944) переводит лицензию проекта с AGPL на **Apache-2.0**. Изменение затрагивает репозиторий, package metadata, документацию и затрагиваемые runtime-границы — оно приведено в соответствие с новым лицензионным режимом Paseo.

Важные нюансы из PR:

- новая лицензия применяется к **будущим** релизам; исторические релизы не перелицензируются;
- пользовательских workflow и product-поведение не меняются;
- из tracked source и документации убраны все устаревшие упоминания AGPL.

Для тех, кто распространяет или переупаковывает Paseo, это ключевое лицензионное изменение релиза.

## Плагины устанавливаются и обновляются прямо из Git

Установка расширений до сих пор требовала вручную склонировать или скачать исходники и установить локальную директорию. [PR #3920](https://github.com/getpaseo/paseo/pull/3920) убирает этот шаг: Git становится транспортом дистрибуции, так что любой репозиторий с исходным кодом плагина дистрибутируется напрямую — без реестра, пакетного менеджера или каталога.

Из описания PR — что именно умеет новая механика:

- принимает **repo shorthand**, Git URL, ветки, теги, коммиты и поддиректории monorepo;
- отслеживает default и явные ветки, оставляя теги и коммиты _запиннеными_;
- `plugin status` сообщает об установленном и доступном коммитах;
- обновление одного или всех managed-плагинов идёт через staged validation и activation, а при сбое запуска кандидата восстанавливается предыдущая работающая версия;
- существующие directory-инсталляции продолжают работать без изменений.

```bash
paseo plugin install https://github.com/user/my-plugin.git       # Git URL
paseo plugin install github:user/my-plugin                       # repo shorthand
paseo plugin install user/my-plugin#v1.2.0                       # тег запинен
paseo plugin update my-plugin                                    # к новому коммиту
paseo plugin update --all                                        # все managed-плагины
paseo plugin status                                              # installed vs available commit
```

Архитектурно важно: Git-метаданные хранятся отдельно от `config.json`, а runtime продолжает видеть directory-source. Managed-чекауты живут под `$PASEO_HOME/plugins`; активация новой версии компилирует её **до** остановки текущей, а удаление затрагивает только Paseo-owned чекауты. Новые wire-сообщения гейтированы capability `pluginGitManagement` и protocol-совместимы. Non-goals PR: каталог/реестр плагинов, ранжирование, отзывы, телеметрия установки и исполнение install-скриптов пакетного менеджера.

## Плагины трансформируют и рендерят timeline

[PR #3940](https://github.com/getpaseo/paseo/pull/3940) добавляет **client-owned projection seam**: плагин выбирает публичный тип timeline-элемента, инспектирует типизированный элемент и возвращает обычные versioned plugin items, а рендерит их schema-валидированный React Native-компонент.

Механика в деталях:

- coarse-запрос идёт через `query.itemType`, а детальное распознавание живёт внутри типизированного callback;
- каноническая daemon-история и wire-протокол **не меняются**;
- живые матчи пересчитывают authoritative projected tail перед заменой, так что дельты provider-lifecycle сворачиваются существующей проекцией;
- элементы рендерятся через существующий plugin runtime, темы и error boundary — падающая строка плагина показывает fallback, не роняя соседний чат;
- плагины не могут мутировать или эмитить built-in типы timeline.

Пример-плагин из PR поддерживает два task-extension payload из дискуссии [#3751](https://github.com/getpaseo/paseo/pull/3751). Этот путь не заменяет ребьюсер-собственную пиллу Tasks над composer — он даёт плагинам собственный путь рендера.

## SSH-подключения к существующим удалённым daemon

[PR #3989](https://github.com/getpaseo/paseo/pull/3989) позволяет CLI и Paseo Desktop подключаться к уже установленному и запущенному daemon через пользовательскую OpenSSH-конфигурацию — без открытия порта или relay. Транспорт владеет только связностью: открывает non-interactive stdio-канал к loopback-порту daemon.

```bash
paseo ls -a --host 'ssh://user@flights' --json
paseo ls -a --host 'ssh://10.0.0.5?daemonPort=6768'
```

Ключевые детали:

- `ssh://user@host` принимается через существующую опцию CLI `--host`; тот же workflow добавлен в Desktop (Settings → Switch host → Add host, метод **Remote SSH**);
- remote daemon endpoint по умолчанию — `127.0.0.1:6767`, есть явные overrides для SSH-порта и daemon-порта;
- используется системный `ssh` и существующий OpenSSH config (приватные ключи, host keys), без второй модели конфигурации SSH;
- мышка не предлагается: пароль и host-key промпты внутри Paseo не поддерживаются — настройка аутентификации остаётся за OpenSSH.

Покрытие: CLI, Desktop, Linux/Xvfb smoke-тест с изолированным host-pinned окружением подтвердили `Remote SSH` online-статус и понятную ошибку `Host key verification failed`. Мобильный и браузерный SSH-транспорт — не цель этого PR.

## Девять workspace-действий в Command Center

[PR #3013](https://github.com/getpaseo/paseo/pull/3013) добавляет в **Command Center** (Cmd+K) действия, раньше доступные только через меню-ищейку или горячие клавиши:

| Действие                  | Раньше доступно                   |
| ------------------------- | --------------------------------- |
| Rename workspace          | только меню в sidebar             |
| Copy workspace path       | меню в sidebar / workspace header |
| Copy branch name          | меню в sidebar / workspace header |
| Pin / Unpin workspace     | меню в sidebar, Cmd+Shift+P       |
| Toggle left sidebar       | Cmd+B                             |
| Toggle Explorer sidebar   | Cmd+E                             |
| Toggle focus mode         | Cmd+Shift+F                       |
| Show setup                | только workspace header           |
| Label / unlabel workspace | меню в sidebar, submenu Labels    |

Особенно важен **Rename**: его диалог живёт внутри компонента строки sidebar и исчезал, когда строка не отрендерена (свёрнутая группа project/status, свёрнутая секция Pinned, focus mode). Теперь rename происходит через глобальный host на активном workspace — состояние, где раньше диалога достичь было невозможно. Каждый пункт переиспользует handler существующего пункта меню, поэтому поведение совпадает один-в-один; неактивные пункты пропускаются (Copy branch name без ветки, Pin без `workspacePinning`, Show setup нечего показывать, группа Labels пока каталог лейблов не загружен). Labels работают как multi-select — повторный выбор снимает лейбл.

## Рост публичного SDK для плагинов

Релиз заметно расширяет поверхность SDK для клиентских плагинов.

**Host UI-примитивы.** [PR #3967](https://github.com/getpaseo/paseo/pull/3967) добавляет подпуть `@getpaseo/plugin/react-native` с тремя plugin-scoped экспортами:

- `Modal` — controlled compound-компонент: центрированный диалог на некомпактных лейаутах, sheet на компактных; через обязательный `title` и опциональный `icon` владеет стабильной презентационной метаданкой;
- `Icon` — рендерер плагинных иконок Paseo;
- `useToast` — host toast API.

`Modal.Content` владеет только телом под host-отрисованным header, чтобы future compound-регионы не требовали переписывания плагинов. Контексты (Paseo, RPC, workspace, agent, query, toast) сохраняются при проходе через sheet-portal.

**Навигация из поверхностей плагина.** [PR #3901](https://github.com/getpaseo/paseo/pull/3901) добавляет опциональную navigation-способность в props surface и workspace-panel. Присутствие — compatibility gate, поэтому плагины могут прятать зависимые действия на старых клиентах:

```ts
navigation?: {
  openAgent(input: { agentId: string }): void;
  openWorkspace(input: { workspaceId: string }): void;
}
```

**Host-рендеренный `Icon`.** [PR #3903](https://github.com/getpaseo/paseo/pull/3903) добавляет в существующий `@getpaseo/plugin` client-модуль `Icon({ name, size?, color? })`: приложение инжектит реализацию и резолвит имена против своего набора `lucide-react-native`; неизвестные имена рендерят ничего вместо throw внутри plugin surface. Никакого нового module specifier или bundler allow-list.

**Семантические цвета тем.** [PR #3898](https://github.com/getpaseo/paseo/pull/3898) расширяет `PluginTheme.colors` аддитивными полями root/raised/control поверхности и статусных состояний:

```ts
// новые поля PluginTheme.colors (additive)
surface1: string; // основная поверхность
surface2: string; // raised / control поверхность
border: string; // рамки
statusSuccess: string; // успех
statusWarning: string; // предупреждение
```

Существующие токены не меняются, старые плагины продолжают работать, новые могут опционально использовать семантические цвета вместо реконструкции host-вариантов темы.

**Регистрированные проекты в SDK.** [PR #3899](https://github.com/getpaseo/paseo/pull/3899) экпспонирует `paseo.projects.list()` через публичный SDK — раньше плагины могли только инферить проекты из активных workspace и «теряли» регистрированные проекты без активных workspace. Это чистая поверхность существующего RPC `project.list`, без новых сообщений протокола.

**Команды сессии на agent handle.** [PR #3719](https://github.com/getpaseo/paseo/pull/3719) закрывает пробел `PaseoAgentHandle`: SDK-авторы не имели доступа к загруженным slash-командам и скиллам сессии (daemon всегда умел это через `list_commands_request` у claude/codex/opencode/acp/omp/pi, но `createPaseoApi` строил плоский объект без маршрута к `DaemonClient`). Теперь handle сессии экспонирует её команды и полный snapshot, иначе рискуя продублировать ~eighteen bundled-скиллов, существующих в сессии, сканированием файловой системы.

**Контекстные composer-pills.** [PR #3956](https://github.com/getpaseo/paseo/pull/3956) добавляет `plugin.addClientSide(...)` — один явный client-only lifecycle на установку. Headless client entrypoint может слушать agent-апдейты, вызывать обычные Paseo API или typed RPC и динамически добавлять/удалять composer-pill для конкретного workspace/агента (рядом с Tasks и Subagents) без монтажа поверхности:

```ts
plugin.addClientSide(async ({ paseo }) => {
  const off = paseo.onAgentUpdate(() => {
    pill.add({ title: "...", icon: <Icon name="sparkles" /> });
    // ...
    pill.remove();
  });
  return off;
});
```

Paseo владеет track-bar placement, общим chrome, pending-состоянием, ошибками и teardown; плагин — жизненным циклом пиллы, React-контентом и client-side callback. При teardown плагина или host все висящие пиллы автоматически удаляются.

## Читабельные вызовы инструментов Paseo

[PR #4066](https://github.com/getpaseo/paseo/pull/4066) меняет презентацию Paseo-owned tool calls: вместо сырого JSON — читаемые промпты, упорядоченные детали и сфокусированные результаты. Протокол теперь владеет одним provider-neutral presentation mapping, а React только рендерит его прозу и field-секции. Затронуты промпты агентов, workspace-операции, расписания и heartbeats. Генерируемые labels tool/field следуют sentence-case дизайн-языку приложения; для non-Paseo инструментов сохранён прежний raw-detail рендер (это осознанный non-goal).

## Подсветка синтаксиса Astro

[PR #3997](https://github.com/getpaseo/paseo/pull/3997) регистрирует pure mixed-language parser для `.astro` в общем пакете подсветки. Файлы Astro получают подсветку TypeScript frontmatter, HTML-разметки, Astro-выражений, скриптов и стилей во **всех** существующих потребителях — file views, CodeMirror-редакторе и server-rendered диффах. Раньше `.astro`-файлы падали в неоформленный текст. Общий language registry работает и на daemon, без тянки browser-only editor-модулей. Completion, diagnostics и прочие language-server фичи — не цель.

## Улучшения производительности и UX

| Изменение                                                   | PR                                                   | Суть                                                                                                                                                                                  |
| ----------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Равномерный стриминг текста ассистента                      | [#3612](https://github.com/getpaseo/paseo/pull/3612) | текст ревилится со скоростью, выводимой из бэклога, а не из времени прихода — burst «догоняет», но не прыгает; окно coalescer — 60ms, reducer-коммиты — по кадру                      |
| Переиспользование OpenCode-хелпера                          | [#4009](https://github.com/getpaseo/paseo/pull/4009) | обычные create/resume reuse одна helper вместо свежего server process на каждый агент; точные `PASEO_AGENT_ID`/`PASEO_AGENT_CWD` и caller-scoped tool catalog сохраняются per session |
| Бапчатый polling pull requests                              | [#3825](https://github.com/getpaseo/paseo/pull/3825) | GitHub PR-проверки группируются в пределах зарезервированного API-бюджета                                                                                                             |
| Статусы Manual / Action-required / Warning в GitLab и Gitea | [#2337](https://github.com/getpaseo/paseo/pull/2337) | новые состояния проверок у non-GitHub провайдеров                                                                                                                                     |
| Cold-start PR-check на общем GitHub batch path              | [#4025](https://github.com/getpaseo/paseo/pull/4025) | холодные проверки статуса PR остаются на общем батче вместо отдельных путей                                                                                                           |
| Крашенный кэш конверсаций до восстановления                 | [#3907](https://github.com/getpaseo/paseo/pull/3907) | кэшированные разговоры отрисовываются раньше чем приходят сетевые данные                                                                                                              |

## Изменения интерфейса

- **Cmd/Ctrl+E теперь чистый toggle видимости Explorer** ([#3896](https://github.com/getpaseo/paseo/pull/3896)). В 0.6.0 этот шорткат переключал Explorer и одновременно выбирал вью; теперь семантические владельцы действий разведены — вызов «open composer changes» или «open pull request» резолвит shell и destination для desktop/compact сам, а сам Cmd+E меняет **только видимость** Explorer. Полноценные PR-входы по умолчанию идут в Explorer, а compose-диффы — тоже через Explorer-first flow (дальнейшие нажатия ведут в рабочий дифф).
- **Мобильный размер контента 15px → 16px** ([#4111](https://github.com/getpaseo/paseo/pull/4111)). Mobile interface chrome остаётся 15px, но primary readable content теперь по умолчанию 16px. Существующие мобильные установки мигрируются один раз (ключ `uiBaseFontSize: 15`/`contentFontSize: 15` → `15|16`); осознанный выбор 15px после миграции сохраняется. Web и desktop по умолчанию не меняются.

## Fixes, которые стоит знать

- Daemon падал, когда процесс Claude/OMP JSONL закрывался во время записи ([#4048](https://github.com/getpaseo/paseo/pull/4048));
- Android: первый submit падал при рестарте клавиатуры во время teardown composer; длинные мобильные черновики прятали composer-контролы под клавиатуру ([#4044](https://github.com/getpaseo/paseo/pull/4044), [#4051](https://github.com/getpaseo/paseo/pull/4051));
- Web и Electron composer теряли фокус после submit ([#4067](https://github.com/getpaseo/paseo/pull/4067));
- Android dictation оставлял Bluetooth-аудио в call-quality routing после capture; retries таймаутили после abandoned partial transcript; немедленные submissions теряли новейший speech-сегмент ([#4069](https://github.com/getpaseo/paseo/pull/4069), [#4065](https://github.com/getpaseo/paseo/pull/4065), [#3968](https://github.com/getpaseo/paseo/pull/3968));
- Model selector падал в iPad desktop layout (by @yzim, [#3992](https://github.com/getpaseo/paseo/pull/3992));
- Commits и squash merges обходили настроенный Git signing ([#3976](https://github.com/getpaseo/paseo/pull/3976));
- Markdown literal-символы заменялись типографскими ([#3253](https://github.com/getpaseo/paseo/pull/3253));
- Grok unified-billing аккаунты показывали ноль кредитов вместо недельного usage ([#4029](https://github.com/getpaseo/paseo/pull/4029));
- Geriri: restored workspace tabs входили в reconciliation loop; archived workspaces возвращались из durable cache ([#3987](https://github.com/getpaseo/paseo/pull/3987), [#3975](https://github.com/getpaseo/paseo/pull/3975)).

Полный список — в [release notes](https://github.com/getpaseo/paseo/releases/tag/v0.7.0).

## Кому обновляться в первую очередь

1. **Авторам плагинов** — самый большой прирост SDK за релиз: Git-дистрибуция, timeline-трансформации, `Modal`/`Icon`/`useToast`, навигация, семантические цвета, `paseo.projects.list()` и команды сессии на agent handle.
2. **Тем, кто запускает Paseo на удалённых серверах** — нативный SSH-транспорт к существующему daemon без открытия порта и без relay.
3. **Всем, кто распространяет/переупаковывает проект** — лицензия будущих релизов меняется на Apache-2.0.
4. **Пользователям многих workspace** — workspace-management и layout-действия стали доступны из Command Center, включая rename даже когда sidebar-строка свёрнута.
5. **Мобильным пользователям** — читаемый контент по умолчанию вырос с 15px до 16px (с миграцией).

## Ссылки

- Release: [v0.7.0](https://github.com/getpaseo/paseo/releases/tag/v0.7.0)
- Compare: [v0.6.0...v0.7.0](https://github.com/getpaseo/paseo/compare/v0.6.0...v0.7.0)
- PR: [Update project licensing #3944](https://github.com/getpaseo/paseo/pull/3944)
- PR: [Install and update plugins directly from Git repositories #3920](https://github.com/getpaseo/paseo/pull/3920)
- PR: [Let plugins transform and render timeline items #3940](https://github.com/getpaseo/paseo/pull/3940)
- PR: [Connect to remote daemons over SSH #3989](https://github.com/getpaseo/paseo/pull/3989)
- PR: [Let plugins use Paseo modals, icons, and toasts #3967](https://github.com/getpaseo/paseo/pull/3967)
- PR: [Add workspace actions to the command center #3013](https://github.com/getpaseo/paseo/pull/3013)

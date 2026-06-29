---
author: Артём Нецветаев
pubDatetime: 2026-06-29T10:23:51.000Z
title: "Claude Code 2.1.0: hot-reload skills, forked context и новые hooks"
slug: claude-code-v2-1-0
featured: false
draft: false
tags:
  - release
  - claude-code
  - ai-agents
  - cli
description: "Разбор минорного релиза Claude Code 2.1.0: автоматическая перезагрузка skills, context: fork для skills и slash-команд, agent в frontmatter, language setting, respectGitignore, wildcard Bash permissions, hooks в agents/skills/commands и MCP list_changed."
---

[`Claude Code`](https://github.com/anthropics/claude-code) получил минорное обновление [`2.1.0`](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md#210). Это большой CLI-релиз вокруг расширяемости: skills больше не требуют перезапуска после изменения, skills и slash-команды можно запускать в forked sub-agent context, agents/skills/commands получили собственные hooks, а permissions стали точнее за счёт wildcard-шаблонов для Bash.

Источник для обзора — секция [`2.1.0` в `CHANGELOG.md`](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md#210), полученная через GitHub API из `anthropics/claude-code`, и история изменения changelog: коммит [`01f1617`](https://github.com/anthropics/claude-code/commit/01f1617f14452ac78bf319cef2236d87c0fe05cb) (`chore: Update CHANGELOG.md and feed.xml`, 2026-06-26). У этого релиза в очереди источником был changelog, а не GitHub Release с отдельным release body.

## Skills теперь подхватываются без перезапуска

Самое заметное изменение для пользователей, которые пишут собственные навыки: Claude Code 2.1.0 автоматически перечитывает skills, созданные или изменённые в двух местах:

```text
~/.claude/skills
.claude/skills
```

Раньше после добавления или правки skill обычно приходилось перезапускать сессию, чтобы он появился в доступном контексте. В 2.1.0 changelog явно фиксирует новую семантику: созданные или изменённые skills становятся доступны сразу, без restart session. Это особенно важно для команд, которые хранят project-local skills в `.claude/skills` и итеративно дописывают инструкции во время работы над репозиторием.

Отдельно релиз чинит сценарий resume: файлы и skills снова корректно обнаруживаются при продолжении сессии через `-c` или `--resume`. То есть hot-reload закрывает live-сценарий, а фикс resume — восстановление уже начатой сессии.

## `context: fork` запускает skills и slash-команды в изолированном sub-agent context

В frontmatter skills и slash-команд появился новый способ выбрать контекст исполнения:

```yaml
---
context: fork
---
```

По описанию changelog, `context: fork` запускает skill или slash command в forked sub-agent context. Практический смысл: команду можно вынести из основного потока диалога в дочерний агентский контекст, когда ей нужно выполнить автономный проход, не смешивая все промежуточные шаги с основной нитью разговора.

С этим связано ещё одно новое поле в skills:

```yaml
---
agent: code-reviewer
context: fork
---
```

`agent` позволяет указать тип агента для исполнения skill. Changelog не раскрывает полный список допустимых agent types, поэтому безопасный вывод только такой: в 2.1.0 frontmatter skill может явно привязать выполнение к агенту, а не полагаться только на поведение по умолчанию.

## Hooks стали ближе к agents, skills и slash-командам

Релиз расширяет hooks сразу в нескольких местах. Agent frontmatter теперь может определять lifecycle-scoped hooks:

```yaml
---
hooks:
  PreToolUse:
    - command: ./validate-before-tool.sh
  PostToolUse:
    - command: ./record-tool-result.sh
  Stop:
    - command: ./cleanup-agent.sh
---
```

Changelog называет поддержанные типы для agent frontmatter: `PreToolUse`, `PostToolUse` и `Stop`. Эти hooks ограничены жизненным циклом агента, а не обязательно всей пользовательской сессией.

Похожая поддержка появилась для skill и slash command frontmatter. Дополнительно 2.1.0 добавляет hook-типы из plugins не только для commands: раньше поддерживались command hooks, теперь в changelog отдельно указаны prompt and agent hook types from plugins.

Есть и точечное изменение в middleware-сценарии: `PreToolUse` hooks теперь могут возвращать `updatedInput` даже вместе с permission decision `ask`. Это важно для hooks, которые хотят изменить аргументы tool call, но всё равно запросить согласие пользователя перед выполнением.

Ещё одна новая настройка — одноразовые hooks:

```yaml
---
hooks:
  Stop:
    - command: ./run-once.sh
      once: true
---
```

`once: true` теперь поддерживается в hook config, то есть hook можно настроить так, чтобы он сработал один раз, а не на каждом подходящем событии.

## Permissions: wildcard для Bash и отключение конкретных agents

Правила Bash permissions получили wildcard `*` в любой позиции. Changelog приводит три подтверждённых шаблона:

```json
{
  "permissions": {
    "allow": ["Bash(npm *)", "Bash(* install)", "Bash(git * main)"]
  }
}
```

Это не просто косметика синтаксиса. Раньше такие правила приходилось описывать более грубо или отвечать на дополнительные permission prompts. Теперь можно разрешить семейство команд с конкретной формой: например, все `npm ...`, любые команды, заканчивающиеся на `install`, или git-команды, где дальше встречается `main`.

Для agent-level контроля появился обратный механизм: конкретных agents можно отключать через синтаксис `Task(AgentName)` в `settings.json` permissions или через CLI-флаг `--disallowedTools`:

```json
{
  "permissions": {
    "deny": ["Task(ResearchAgent)"]
  }
}
```

```bash
claude --disallowedTools 'Task(ResearchAgent)'
```

Это полезно для окружений, где основной Claude Code разрешён, но определённые агентские профили нельзя запускать в проекте или в CI-like сессии.

## Новые настройки для языка, file picker и приватных демонстраций

В `settings.json` появился `language` — настройка языка ответа Claude. Changelog даёт пример `language: "japanese"`; для русскоязычной команды это выглядит так:

```json
{
  "language": "russian"
}
```

Важно не переинтерпретировать это как настройку локали интерфейса: в changelog сказано именно "configure Claude's response language".

Для file picker при `@`-mentions добавлен per-project контроль `respectGitignore`:

```json
{
  "respectGitignore": true
}
```

Релиз описывает это как управление поведением `@`-mention file picker. Поэтому команда может на уровне проекта решить, должен ли picker учитывать `.gitignore`, когда предлагает файлы для упоминания в промпте.

Для стримов и записей появился environment variable `IS_DEMO`: он скрывает email и organization из UI.

```bash
IS_DEMO=1 claude
```

Это точечная, но практичная защита от случайного раскрытия рабочих данных на демо. В ту же категорию безопасности попал фикс debug logs: релиз закрывает проблему, при которой sensitive data — OAuth tokens, API keys и passwords — могли оказаться в debug-логах.

## MCP и фоновые задачи стали динамичнее

Claude Code 2.1.0 добавляет поддержку MCP `list_changed` notifications. Это значит, что MCP servers могут динамически обновлять доступные tools, prompts и resources без переподключения клиента. Для MCP-серверов, у которых набор tools зависит от workspace, feature flags или авторизации, это снимает старое ограничение: не нужно пересоздавать соединение только ради обновления каталога capabilities.

Фоновые задачи тоже получили заметные изменения:

- `Ctrl+B` теперь единообразно background'ит и bash-команды, и agents; если одновременно работают foreground tasks, сочетание переводит их в фон все сразу.
- В details dialog для background bash task теперь показывается filepath к полному output.
- При больших выводах background tasks API context overflow чинится truncation до `30K` символов с ссылкой на file path.
- Completion notifications для background tasks стали proactive и выводятся как clean completion message, без сырого noisy output.

Это важный блок для длинных агентских задач: пользователь может убрать активные процессы в фон, не теряя путь к полному выводу и не забивая контекст модели огромным stdout.

## Терминальный ввод, Vim mode и slash-команды

Ввод в терминале получил серию исправлений и новых shortcuts. Shift+Enter теперь работает из коробки в iTerm2, WezTerm, Ghostty и Kitty без ручной правки terminal configs. Для iTerm2, Ghostty, Kitty и WezTerm также исправлен сброс terminal keyboard mode на выходе, а `Alt+B`/`Alt+F` снова работают как word navigation.

Vim mode стал заметно полнее. В changelog перечислены новые motions и operators:

```text
; ,              repeat f/F/t/T motions
y, yy, Y         yank
p, P             paste
iw, aw, iW, aW   word text objects
i", a", i', a'   quote text objects
i(, a(, i[, a[   bracket text objects
i{, a{           brace text objects
>>, <<           indent / dedent
J                join lines
```

Slash-команды теперь автодополняются, когда `/` встречается в любом месте input, а не только в начале строки. Появился shortcut `/plan`, который включает plan mode прямо из prompt; отдельный permission prompt при входе в plan mode удалён. Также исправлены два неприятных сценария: slash-команды, переданные CLI-аргументом вроде `claude /context`, теперь исполняются корректно, а Enter после Tab-completion больше не выбирает другую команду вместо отправки уже дополненной.

## Интерактивный режим можно ограничить `--tools`

Ещё одно CLI-изменение — поддержка `--tools` в interactive mode. Теперь можно запускать интерактивную сессию с ограниченным набором built-in tools:

```bash
claude --tools Read,Edit,Bash
```

Changelog не уточняет полный синтаксис списка, но фиксирует назначение флага: ограничить, какие built-in tools Claude может использовать во время interactive sessions. Для организаций это удобный промежуточный слой между полностью открытой локальной сессией и жёстким deny через permissions.

Рядом появился environment override для лимита чтения файлов:

```bash
CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS=60000 claude
```

`CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` переопределяет default file read token limit. Это полезно для больших generated files, notebooks или монолитных конфигов, где стандартный лимит слишком рано обрезает содержимое.

## Что ещё стоит заметить

В 2.1.0 много исправлений, но несколько из них особенно важны для повседневной работы:

- complex bash commands вызывают меньше permission prompts, а парсер Bash лучше обрабатывает `$()` command substitution, multiline backslash continuations и команды с global options вроде `git -C /path log`;
- plugin path resolution исправлен для file-based marketplace sources, а `${CLAUDE_PLUGIN_ROOT}` теперь подставляется в plugin `allowed-tools` frontmatter;
- LSP tool больше не включается, если LSP servers не настроены, а race condition при старте LSP больше не приводит к `no server available`;
- Write tool теперь создаёт файлы с учётом system umask вместо захардкоженного `0o600`;
- AWS Bedrock subagents наследуют EU/APAC cross-region inference model configuration, что чинит 403 при IAM permissions, ограниченных конкретными регионами;
- Claude in Chrome получил поддержку WSL environments;
- CLI help сортирует options и subcommands по алфавиту.

## Стоит ли обновляться

Да, если вы используете Claude Code как расширяемую среду, а не только как одноразовый CLI. 2.1.0 делает skills и slash-команды более живыми за счёт hot-reload и `context: fork`, переносит hooks ближе к agents/skills/plugins, добавляет более точные Bash permissions и закрывает важную утечку sensitive data в debug logs.

Для командного использования после обновления стоит проверить три места: локальные `.claude/skills` на предмет нового `context: fork`/`agent`, `settings.json` permissions на wildcard `Bash(...)` и deny правил `Task(AgentName)`, а также демонстрационные/стриминговые профили запуска, где теперь можно выставить `IS_DEMO=1`.

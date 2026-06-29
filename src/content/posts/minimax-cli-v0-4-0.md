---
author: Артём Нецветаев
pubDatetime: 2026-06-29T12:16:17.000Z
title: "minimax-cli v0.4.0: брендированный status bar, quota HUD, короткие команды и исправленный URL-режим аудио"
slug: minimax-cli-v0-4-0
featured: false
draft: false
tags:
  - release
  - minimax-cli
  - cli
  - ai-agents
description: "Разбор minimax-cli v0.4.0: true-color status bar MINIMAX, новый quota HUD с корректной семантикой remaining/used, schema-driven parsing флагов, короткие формы minimax image/search/vision/quota, welcome screen без аргументов, README_CN и фикс URL-режима speech/music без --out."
---

[`minimax-cli`](https://github.com/MiniMax-AI/cli) выпустил минорный релиз [`v0.4.0`](https://github.com/MiniMax-AI/cli/releases/tag/v0.4.0). Release body перечисляет PR из `MiniMax-AI-Dev/cli`, поэтому я проверял не только GitHub Release, но и compare [`v0.3.1...v0.4.0`](https://github.com/MiniMax-AI-Dev/cli/compare/v0.3.1...v0.4.0), а также PR [#6](https://github.com/MiniMax-AI/cli/pull/6), [#7](https://github.com/MiniMax-AI/cli/pull/7), [#8](https://github.com/MiniMax-AI/cli/pull/8), [#12](https://github.com/MiniMax-AI/cli/pull/12), [#13](https://github.com/MiniMax-AI/cli/pull/13), [#14](https://github.com/MiniMax-AI/cli/pull/14), [#15](https://github.com/MiniMax-AI/cli/pull/15), [#16](https://github.com/MiniMax-AI/cli/pull/16) и [#17](https://github.com/MiniMax-AI/cli/pull/17).

Главная тема релиза — сделать CLI пригоднее для интерактивной и агентной работы: человеческий UI уходит в TTY/stderr, машинные режимы остаются чистыми, а часто используемые команды получают короткие формы.

## HTTP-запросы показывают один брендированный status bar вместо разрозненного model output

В PR #6 HTTP-клиент начал печатать в stderr true-color строку состояния MiniMax. Она появляется только когда `stderr` является TTY и не включён `--quiet`, поэтому pipe-friendly сценарии не должны получать ANSI-мусор в stdout.

Подтверждённый формат строки:

```text
MINIMAX Region: CN | Key: sk-c...nI7s | Model: MiniMax-M2.7
```

Цвета в реализации заданы 24-битными ANSI-кодами: `#2B52FF` для `MINIMAX`, `#9333EA` для модели, `#06B8D4` для региона и `#EC4899` для замаскированного ключа. Регион определяется по `config.baseUrl`: `minimaxi.com` превращается в `CN`, остальные base URL — в `Global`. Ключ маскируется как первые четыре и последние четыре символа, а модель берётся из `opts.body.model`, если тело запроса является объектом.

В #8 это поведение было ужесточено: появился module-level флаг, чтобы status bar печатался один раз за процесс, а не на каждый HTTP-запрос. В #12 рендеринг вынесли из `src/client/http.ts` в `src/output/status-bar.ts` как `maybeShowStatusBar(config, token, model)`, так что транспортный слой больше не содержит UI-разметку.

Практический эффект для `text chat`: старые отдельные строки вида `[Model: ...]` были удалены, а модель теперь показывается общей status bar-строкой:

```bash
minimax text chat --message "What is MiniMax?"
```

В `--quiet` или при перенаправлении stderr эта декоративная строка не должна мешать скриптам.

## `quota show` стал HUD-панелью и исправил семантику usage fields

PR #7 полностью переписал вывод `minimax quota show`. Вместо простой таблицы команда строит box-drawing HUD с заголовком `MINIMAX Quota Dashboard` или `MINIMAX 配额面板`, строкой недели и строками моделей с usage bar.

Самая важная техническая деталь — исправлена трактовка API-поля `current_interval_usage_count`. В PR прямо указано, что это поле на практике означает remaining count, а не consumed count. Поэтому новый расчёт такой:

```ts
const remaining = m.current_interval_usage_count;
const limit = m.current_interval_total_count;
const used = Math.max(0, limit - remaining);
const usedPct = limit > 0 ? Math.round((used / limit) * 100) : 0;
```

Та же логика применена к weekly quota: `current_weekly_usage_count` читается как оставшийся недельный лимит, а displayed `weekUsed` считается как `weekLimit - weekRemaining`.

Новый progress bar показывает именно потреблённую часть квоты: заполненные блоки — used portion, тёмная дорожка — оставшаяся capacity. Пороговые цвета тоже завязаны на `usedPct`: меньше 50% — зелёный, 50–80% — жёлтый, выше 80% — красный.

```text
[████............]  25%
```

Для локализации добавлены два набора labels. Если `config.region === 'cn'`, интерфейс использует китайские подписи (`配额面板`, `周期`, `每周`, `重置于`, `暂无配额数据`), иначе английские (`Quota Dashboard`, `Week`, `Weekly`, `Resets in`, `No quota data available.`). Чтобы китайские символы не ломали рамки, в `show.ts` появился helper `displayWidth()`, который считает CJK-символы как две terminal columns.

PR #8 исправил два edge case вокруг этого HUD:

- в no-color режиме bar вида `[███....]` шире цветного варианта на скобки, поэтому ширина box теперь учитывает отдельный `barVisLen`;
- `quota show` больше не берёт `config.output` из глобального `config.yaml` как default, а смотрит только явный `flags.output`, чтобы пользователь с `output: json` в конфиге всё равно видел rich HUD в TTY.

Машинные режимы при этом сохранены: `--output json`/`yaml` отдаёт response как есть, а `--quiet` печатает TSV-строки по моделям.

## Парсер флагов стал schema-driven, а UI status bar отделили от HTTP client

PR #12 — не пользовательская «косметика», а архитектурная правка парсинга CLI. До неё parser держал списки boolean/number/array flags внутри `src/args.ts`. После релиза тип флага выводится из `OptionDef[]`:

```ts
export function parseFlags(argv: string[], options: OptionDef[]): GlobalFlags {
  const schema = buildSchema(options);
  // schema.booleans / schema.numbers / schema.arrays
}
```

`command.ts` теперь экспортирует `GLOBAL_OPTIONS` как единый источник правды для глобальных флагов: `--api-key`, `--region`, `--base-url`, `--output`, `--timeout`, `--quiet`, `--verbose`, `--no-color`, `--dry-run`, `--non-interactive`, `--help`, `--version` и другие. `main.ts` сначала быстро собирает command path через `scanCommandPath(argv)`, затем resolve-ит команду и вызывает `parseFlags(argv, [...GLOBAL_OPTIONS, ...(command.options ?? [])])`.

Это важно для сопровождаемости: чтобы добавить повторяемый или числовой flag в конкретную команду, теперь достаточно указать `type: 'array'` или `type: 'number'` в её `options`, а не править общий parser. В этом же PR такие типы были проставлены для `text chat`, `speech synthesize`, `music generate`, `video generate` и `image generate`.

Релиз также добавил `build:dev`:

```json
"build:dev": "bun build src/main.ts --compile --minify --outfile dist/minimax --define \"process.env.CLI_VERSION='$(node -p \"require('./package.json').version\")'\""
```

Это отдельный single-platform standalone binary для разработки; стандартный npm build script при этом остался `build:npm`.

## Короткие формы команд: `minimax image`, `search`, `vision`, `quota`

PR #14 переписал README вокруг коротких примеров, а PR #17 добавил часть механики в код. В `registry.resolve()` появилась auto-forward логика: если группа содержит ровно одну leaf-команду, ввод группы исполняет её напрямую.

Подтверждённые примеры из README и diff:

```bash
minimax quota                       # → quota show
minimax image "A cat in a spacesuit" # → image generate --prompt ...
minimax search "MiniMax AI"          # → search query --q ...
minimax vision photo.jpg             # → vision describe --image ...
```

Для этого отдельные команды начали читать первый positional argument как fallback для основного flag:

```ts
let prompt = (flags.prompt ??
  (flags._positional as string[] | undefined)?.[0]) as string | undefined;
const query = (flags.q ?? (flags._positional as string[] | undefined)?.[0]) as
  string | undefined;
let image = (flags.image ??
  (flags._positional as string[] | undefined)?.[0]) as string | undefined;
```

То есть старые полные формы не исчезли:

```bash
minimax image generate --prompt "A cat" --n 3 --aspect-ratio 16:9
minimax search query --q "latest news" --output json
minimax vision describe --image https://example.com/img.jpg --prompt "What breed?"
```

Но для интерактивного использования теперь не нужно каждый раз печатать имя единственной подкоманды.

## Вызов `minimax` без аргументов теперь показывает help и quota/login hint

PR #15 изменил поведение пустого запуска. Теперь `minimax` без command path сначала печатает общий help, затем проверяет credentials:

- если найден API key из config/env/file или OAuth credentials — запускает `quota show`;
- если пользователь не залогинен — печатает подсказку `minimax auth login --api-key sk-xxxxx`.

Псевдоповедение из PR:

```text
$ minimax
[help text]
[quota HUD]        # если есть credentials

$ minimax
[help text]
  Not logged in.
  minimax auth login --api-key sk-xxxxx
```

В этом же PR глобальные флаги были «подрезаны»: `--yes` больше не глобальный, а принадлежит `auth logout`, а `--async` оставлен на уровне `video generate`. Это снижает шум в общем help и уменьшает риск, что команда будет принимать нерелевантный flag.

## `speech synthesize` и `music generate` снова печатают URL без `--out`

PR #13 исправил регрессию URL-режима для аудио. Root cause в PR описан конкретно: когда запрос уходит с `output_format: 'url'`, MiniMax API кладёт URL в `data.audio`, а старый код проверял только `data.audio_url`. В результате команды без `--out` могли молча ничего не вывести.

Новая логика использует наличие `outPath` как источник истины для режима:

```ts
if (outPath) {
  const audioBuffer = Buffer.from(response.data.audio!, "hex");
  writeFileSync(outPath, audioBuffer);
} else {
  const audioUrl = response.data.audio_url ?? response.data.audio;
  console.log(audioUrl);
}
```

Это затрагивает обе команды:

```bash
minimax speech synthesize --text "Hello" --quiet       # печатает URL
minimax speech synthesize --text "Hello" --out a.mp3   # сохраняет hex как файл
minimax music generate --prompt "Jazz" --quiet         # печатает URL
minimax music generate --prompt "Jazz" --out song.mp3  # сохраняет файл
```

PR #17 дополнительно добавил positional fallback для `speech synthesize`, так что текст можно передавать первым позиционным аргументом, если команда до него маршрутизирована.

## Документация стала двуязычной и убрала неподдерживаемую установку через npm/bun

PR #14 заменил старую README-структуру на набор command examples и добавил `README_CN.md`. В английском README появился cross-link на китайскую версию, а в китайском — обратная ссылка на English.

Важное изменение для установки: PR #16 удалил блок npm/bun install из README и README_CN. В релизной версии документации оставлен только binary install через скрипт:

```bash
curl -fsSL https://raw.githubusercontent.com/MiniMax-AI-Dev/cli/main/install.sh | sh
```

Это согласуется с текстом PR #16: npm publishing не поддерживается, поэтому документация больше не обещает `npm install -g minimax-cli` или bun-вариант как официальный путь.

## Что проверить после обновления

1. Если вы парсите вывод CLI, продолжайте использовать `--quiet` или `--output json`: status bar и quota HUD рассчитаны на TTY/stderr, но explicit machine modes остались.
2. Если у вас был `output: json` в config, проверьте `minimax quota show` в терминале: после #8 rich HUD должен показываться по умолчанию, а JSON включается явным `--output json`.
3. Если вы вызывали speech/music без `--out` и ожидали URL, обновление критично: релиз исправляет пустой stdout из-за поля `data.audio`.
4. Если вы документировали установку через npm/bun, README релиза больше этого не подтверждает; официальный пример — `install.sh` из `MiniMax-AI-Dev/cli`.

В сумме `v0.4.0` делает `minimax-cli` менее «сырым» для повседневной shell-работы: запуск без аргументов теперь помогает войти или посмотреть квоту, короткие формы уменьшают длину команд, а UI-полировка не должна ломать stdout-контракты для агентов и CI.

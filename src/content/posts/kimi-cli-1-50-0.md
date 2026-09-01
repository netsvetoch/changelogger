---
author: Артём Нецветаев
pubDatetime: 2026-09-01T17:28:00.000Z
title: "kimi-cli 1.50.0: deprecation-aware update flow с миграцией в Kimi Code одним ключом и фикс пустого anthropic-beta в kosong"
slug: kimi-cli-1-50-0
featured: false
draft: false
tags:
  - release
  - kimi-cli
  - ai-agents
  - cli
description: "Разбор kimi-cli 1.50.0 и kosong 0.56.0: CLI получает красную панель «kimi-cli is no longer maintained» с one-key миграцией в новый Kimi Code (прямой download, sha256, install-script fallback), а kosong больше не отправляет пустой заголовок anthropic-beta."
---

[`kimi-cli`](https://github.com/MoonshotAI/kimi-cli) выпустил минорную версию [`1.50.0`](https://github.com/MoonshotAI/kimi-cli/releases/tag/1.50.0), одновременно подняв библиотеку `kosong` до `0.56.0`. В compare [`1.49.0...1.50.0`](https://github.com/MoonshotAI/kimi-cli/compare/1.49.0...1.50.0) всего четыре коммита, и суть релиза сосредоточена в одном крупном под-пункте: kimi-cli начинает вести пользователя к новому Kimi Code.

Источник разбора — GitHub Release [`MoonshotAI/kimi-cli@1.50.0`](https://github.com/MoonshotAI/kimi-cli/releases/tag/1.50.0), compare [`1.49.0...1.50.0`](https://github.com/MoonshotAI/kimi-cli/compare/1.49.0...1.50.0) и PR [#2580](https://github.com/MoonshotAI/kimi-cli/pull/2580), [#2630](https://github.com/MoonshotAI/kimi-cli/pull/2630).

## Обновлённый startup-флоу: deprecation-панель и миграция в Kimi Code одним клавишей

Главное изменение релиза — PR [#2630](https://github.com/MoonshotAI/kimi-cli/pull/2630): kimi-cli научился получать с CDN уведомление о прекращении поддержки и предлагать одношаговую миграцию на новый Python-аналог **Kimi Code (TS)**.

Уведомление читается с `https://cdn.kimi.com/kimi-code-tips/kimi_cli/migration.json` и кэшируется в share-директорию. Распарсенный payload — это `KimiCodeTips` с полями:

```text
enabled           — kill switch удалённо
message           — локализованный текст (ключи zh / en)
migration_version — целевая версия Kimi Code
min_cli_version   — минимальная версия kimi-cli, для которой показывается панель
platforms         — карта "<arch>-<os>" → {url, sha256}
install_sh/ps1    — fallback-команды установщика (переопределяются payload-ом)
links             — произвольные ссылки (локализованные)
```

### Поведение startup-гейта

`check_update_gate()` стал асинхронным и поменял логику приоритетов. Раньше он блокировал старт, только если в кэше обнаруживалась более новая Python-версия. Теперь:

1. **Pending-обновление Python-версии имеет приоритет** — показывается классический update gate.
2. Иначе, если deprecation-notice `enabled`, версия пользователя >= `min_cli_version`, а новый Kimi Code ещё не установлен (`kimi_code_installed()`), запуск блокируется красной панелью **«kimi-cli is no longer maintained»**.

Важный нюанс: **пропуск Python-обновления не скрывает миграционную панель** — эти ветки независимы. Если пользователь уже перенёсся, панель не показывается (никакого навязывания).

Панель появляется при **каждом** запуске — ветки «skip» у неё нет:

```text
kimi-cli is no longer maintained
  <локализованное message>
  Current version   1.50.0
  Details: <ссылка>

  [Enter]  Migrate now (downloads & installs the new Kimi Code)
  [q]      Continue with this unmaintained version
```

`[Enter]` запускает миграцию, `[q]` продолжает старт со старой версией, `Ctrl-C`/`Esc` выходят (exit 0).

### Механика миграции

`_migrate_to_kimi_code` работает по двум путям:

1. **Прямой платформенный download**: по `_detect_target()` ищется запись в `platforms` (ключ вида `<arch>-<os>`), архив `.tar.gz` скачивается (таймауты: total 600s / sock_read 60s / sock_connect 15s), при наличии `sha256` проверяется контрольная сумма, бинарь кладётся в `~/.kimi-code/bin/kimi`, а поверх создаётся PATH-shim-симлинк `~/.local/bin/kimi → ~/.kimi-code/bin/kimi`.
2. **Fallback на install script** — если прямого дистрибутива для платформы нет (или download упал): `bash -c install.sh` / `powershell -NoProfile ... install.ps1`. Дефолты можно переопределить из payload:

```sh
curl -fsSL https://code.kimi.com/kimi-code/install.sh | bash
# PowerShell:
irm https://code.kimi.com/kimi-code/install.ps1 | iex
```

При успехе: `Migration complete! Open a new terminal and run kimi to start the new Kimi Code.` — и процесс завершается. При неудаче выводится команда установщика для ручного повтора и возвращается exit 1.

### Welcome-панель и телеметрия

Если update gate не сработал, закэшированный notice дополнительно отображается инлайн под welcome-инфо (строка `⚠ kimi-cli is no longer maintained. <message>`), а gate `KIMI_CLI_NO_AUTO_UPDATE` теперь целиком выносится в отдельное условие. Оба пути — и стартовая панель, и инлайн-строка — отправляют telemetry-событие `migration_prompted` с полями `current` и `target`.

### Дистанционное управление

Обратите внимание на возможности remote control из payload: `enabled: false` полностью отключает notice, `min_cli_version` ограничивает аудиторию, `message`/`links` локализуются по `LC_ALL`/`LC_MESSAGES`/`LANG` (zh-локаль получает китайский текст). Если запрос к CDN падает с ошибкой, используется предыдущий кэш — то есть уже выключенный notice останется выключенным, а включённый закешированный — продолжит показываться.

Это самый важный пункт релиза для всех текущих пользователей kimi-cli: при следующем запуске CLI может встретить вас deprecation-панелью. Ожидается, что это часть плана переноса пользователей на новый Kimi Code.

## kosong 0.56.0: пустой `anthropic-beta` больше не отправляется

PR [#2580](https://github.com/MoonshotAI/kimi-cli/pull/2580) закрывает баг Anthropic-провайдера в `kosong`: `_streamed_request` всегда собирал заголовок `anthropic-beta`, даже когда betas-список пуст:

```python
extra_headers = {
    **{"anthropic-beta": ",".join(str(e) for e in betas)},
    **(generation_kwargs.pop("extra_headers", {})),
}
```

Когда adaptive thinking убирает beta `interleaved-thinking-2025-05-14` (ветки Opus 4.6+/Sonnet 4.6+ в `with_thinking`), `betas` становится `[]`, и запрос уходит с `anthropic-beta: ""`. Пустой header-значение некоторые бэкенды/шлюзы отклоняют или интерпретируют неверно.

Исправление (`packages/kosong/src/kosong/contrib/chat_provider/anthropic.py`) — заголовок ставится только при непустом `betas`:

```python
extra_headers = generation_kwargs.pop("extra_headers", {})
if betas:
    extra_headers["anthropic-beta"] = ",".join(str(e) for e in betas)
```

Приоритеты слияния не изменились: пользовательские `extra_headers` по-прежнему перекрывают сгенерированный заголовок, а явно переданный `anthropic-beta` в `extra_headers` отправляется даже при пустом `betas`. Бонус: явный `beta_features=None` больше не роняет `str.join`. Тесты обновлены — `test_anthropic_opus_46_adaptive_thinking` теперь проверяет полное отсутствие заголовка, добавлен `test_anthropic_beta_header_omitted_when_empty`.

## Версии пакетов и обновление

Релизный PR [#2632](https://github.com/MoonshotAI/kimi-cli/pull/2632) поднимает `kimi-cli` до `1.50.0`, PR [#2581](https://github.com/MoonshotAI/kimi-cli/pull/2581) — `kosong` до `0.56.0`.

Обновляться стоит тем, кто использует Anthropic-провайдер `kosong` с adaptive thinking (исчезают пустые `anthropic-beta` header-ы), а появление миграционной панели — ожидаемое поведение: это штатный механизм перехода на Kimi Code. Если вы уже установили новый Kimi Code, `kimi_code_installed()` подавит панель.

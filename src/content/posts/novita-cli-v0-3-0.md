---
author: Артём Нецветаев
pubDatetime: 2026-07-22T00:39:47.000Z
title: "novita-cli v0.3.0: breaking-переезд из cli_anything.novita в cnovita"
slug: novita-cli-v0-3-0
featured: false
draft: false
tags:
  - release
  - novita-cli
  - python
  - cli
  - migration
description: "Разбор novita-cli v0.3.0: исторический breaking-переезд Python namespace с cli_anything.novita на cnovita, замена find_namespace_packages на find_packages, новые console scripts novita и cnovita, обновление pytest testpaths и установки skill из корня репозитория."
---

[`novita-cli`](https://github.com/novitalabs/novita-cli) версии [`0.3.0`](https://github.com/novitalabs/novita-cli/commit/4000006a1ca340b164d46d33e0562c83c8f91f6d) — это migration-релиз, а не расширение Novita API. Его ключевой коммит [`9939bb2`](https://github.com/novitalabs/novita-cli/commit/9939bb2e68cd438d6bb58a3f50b60d764f65b53a) переносит исходники из `cli_anything/novita/` в корневой пакет `cnovita/`, меняет импортный namespace, упаковку и точки входа.

В актуальном `CHANGELOG.md` эта историческая запись позднее была переписана под последующее имя `novita_cli`. Для состояния именно v0.3.0 первоисточник — commit реализации и commit, добавивший секцию changelog: в них package называется **`cnovita`**, а не `novita_cli`. Поэтому примеры ниже намеренно используют исторический контракт 0.3.0, а не современный namespace репозитория.

## Breaking change: `cli_anything.novita` больше не импортируется

До обновления клиент жил в namespace-пакете:

```python
from cli_anything.novita.core.client import NovitaClient
```

После v0.3.0 каталог `cli_anything/novita/` был переименован в `cnovita/`; все импорты CLI, unit-тестов и E2E-тестов переписаны на новый путь:

```python
from cnovita.core.client import NovitaClient
from cnovita.core.client import NovitaError
```

Это действительно breaking change для любого Python-кода и test doubles. Например, патчи в unit-тестах должны были сменить target:

```diff
-@patch("cli_anything.novita.novita_cli.NovitaClient")
+@patch("cnovita.novita_cli.NovitaClient")
```

Если приложение запускало модуль напрямую, меняется и `-m`-путь:

```diff
-python -m cli_anything.novita.novita_cli
+python -m cnovita.novita_cli
```

Сам HTTP-клиент в этом релизе не получил новых endpoint-методов: `NovitaClient`, URL API и интерфейс команд были перенесены вместе с кодом. Цель изменения — убрать зависимость от структуры `agent-harness`/`cli-anything`, а не изменить контракт Novita AI API.

## Установка и packaging: обычный пакет вместо namespace package

В `setup.py` проект заменил `find_namespace_packages(include=["cli_anything.*"])` на `find_packages(include=["cnovita", "cnovita.*"])`. То есть пакет больше не ожидает родительский namespace `cli_anything`; при сборке должны попадать `cnovita` и его подпакеты.

Одновременно pytest получил явный корень тестов:

```toml
[tool.pytest.ini_options]
testpaths = ["cnovita/tests"]
```

Практическая миграция для checkout-версии 0.3.0 выглядела так:

```bash
pip install -e .
pytest
```

В документации skill также изменён путь editable-установки: вместо `pip install -e agent-harness/` указан `pip install -e .`. Это согласует инструкцию с тем, что Python-пакет и `setup.py` теперь находятся в корне репозитория.

## CLI: legacy alias удалён, доступны `novita` и `cnovita`

До реструктуризации `setup.py` публиковал два console script, один из которых был legacy-именем:

```toml
novita=cli_anything.novita.novita_cli:main
cnovita=cli_anything.novita.novita_cli:main
```

В 0.3.0 оба entry point направлены на новый модуль, а `cli-anything-novita` больше не фигурирует в тестовом fallback-пути:

```toml
[console_scripts]
novita=cnovita.novita_cli:main
cnovita=cnovita.novita_cli:main
```

Для shell-скриптов это означает заменить legacy-команду на основной бинарь `novita` (либо на дополнительный alias `cnovita`). Проверка установленного CLI в тестах также была переключена с `cli-anything-novita` на `novita`.

```diff
-cli-anything-novita models list
+novita models list
```

Важно не путать это с более поздней историей проекта: текущий репозиторий уже использует `novita_cli` и оставляет только `novita`. Это не тот контракт, который зафиксирован коммитом v0.3.0.

## Skill и справочник: меняется путь установки, а не набор команд

Release commit упоминает decision guide, common workflows, troubleshooting и вынесенные references. Проверка содержимого v0.3.0 показывает, что `cnovita/skills/SKILL.md` уже содержит эти разделы и ссылки `references/commands.md`/`references/endpoints.md`; в самом migration diff изменена конкретно директива установки и путь файла при переносе:

```diff
-install: pip install -e agent-harness/
+install: pip install -e .
```

Поэтому обновление не требует переписывать вызовы вроде `novita image`, `novita gpu` или `novita serverless`: их реализация перенесена в `cnovita/novita_cli.py` без изменения групп команд. Для пользователя skill важен только новый независимый checkout и установка из его корня.

## Чек-лист обновления

1. Пересоберите или переустановите пакет из корня репозитория: `pip install -e .`.
2. Замените все Python-импорты `cli_anything.novita...` на `cnovita...`.
3. Исправьте monkeypatch/mock targets и вызовы `python -m`.
4. Уберите из automation legacy-команду `cli-anything-novita`; используйте `novita` или `cnovita`.
5. Если CI запускает pytest без пути, проверьте, что он подхватывает `cnovita/tests` из нового `pyproject.toml`.

Итого, v0.3.0 переносит CLI из общего agent-harness namespace в самостоятельный Python-пакет. Функции Novita — LLM, image/video/audio, GPU и serverless — не меняют команды или HTTP-маршруты в этом diff; обязательная работа при обновлении сосредоточена на import path, packaging и entry points.

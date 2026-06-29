---
author: Артём Нецветаев
pubDatetime: 2026-06-29T12:00:19.000Z
title: "novita-cli v0.1.0: PyPI-пакет novita и один CLI для LLM, медиа, GPU runtime и serverless"
slug: novita-cli-v0-1-0
featured: false
draft: false
tags:
  - release
  - novita-cli
  - cli
  - ai-infrastructure
description: "Разбор релиза novita-cli v0.1.0: дистрибутив novita для PyPI, entry point novita, NOVITA_API_KEY и --json-output, OpenAI-compatible text endpoints, image/video/audio команды, batch/files, GPU sandbox runtimes, templates, network storage, serverless endpoints и CI-публикация через GitHub Actions."
---

[`novita-cli`](https://github.com/novitalabs/novita-cli) выпустил [`v0.1.0`](https://github.com/novitalabs/novita-cli/releases/tag/v0.1.0) как первый PyPI-релиз дистрибутива `novita`. GitHub Release перечисляет высокоуровневые блоки — text, image, video, audio, files/batch, GPU sandbox runtimes, serverless endpoints, templates, storage, account и billing, — поэтому ниже я опираюсь на сам тег `v0.1.0`: `pyproject.toml`, `CHANGELOG.md`, `README.md`, `novita_cli/novita_cli.py`, `novita_cli/core/client.py` и GitHub Actions workflow.

Это не «обычный» минор с диффом относительно предыдущего публичного PyPI-пакета: релиз фиксирует новый пакетный контракт. В `pyproject.toml` имя публикации — `novita`, Python-пакет для импортов — `novita_cli`, а единственный console script — `novita = "novita_cli.novita_cli:main"`.

## Установка: `pip install novita`, Python 3.9+ и только entry point `novita`

Главное пользовательское изменение — пакет ставится из PyPI как `novita`, а не под старым именем. Метаданные релиза задают Python `>=3.9`, зависимости `click>=8.0` и `requests>=2.28`, MIT-лицензию и classifiers до Python 3.13 включительно:

```toml
[project]
name = "novita"
version = "0.1.0"
requires-python = ">=3.9"
dependencies = [
    "click>=8.0",
    "requests>=2.28",
]

[project.scripts]
novita = "novita_cli.novita_cli:main"
```

Практический onboarding теперь выглядит так:

```bash
pip install novita
export NOVITA_API_KEY="sk_..."
novita chat "What is Novita AI?" -m deepseek/deepseek-v3-0324
```

`CHANGELOG.md` дополнительно фиксирует миграционные границы этого релиза: PyPI-дистрибутив переименован в `novita`, Python imports идут через `novita_cli`, CLI entry point оставлен только `novita`, старый альтернативный alias удалён, а `setup.py` превращён в совместимый shim поверх `pyproject.toml`.

## Общий CLI-контракт: ключ через env/flag и машинный JSON-вывод

Корневой Click-group принимает два глобальных параметра:

```python
@click.option("--api-key", envvar="NOVITA_API_KEY", help="Novita AI API key")
@click.option("--json-output", "json_mode", is_flag=True, help="Output as JSON")
```

В клиенте это превращается в обязательную авторизацию Bearer-токеном. Если ключ не передан ни через `--api-key`, ни через `NOVITA_API_KEY`, CLI падает с явным сообщением `API key required. Set NOVITA_API_KEY env var or pass --api-key.`

Для агентных сценариев важен `--json-output`: README показывает его на chat, model lookup и balance, а в командах он действительно переключает pretty/table output на JSON:

```bash
novita --json-output chat "Hello" --no-stream
novita --json-output models list
novita --json-output account balance
```

## Text API: chat/completions, embeddings, rerank и модели через OpenAI-compatible endpoints

Текстовые команды в `novita_cli.py` не являются просто README-примерами: они мапятся на OpenAI-compatible методы клиента:

- `novita chat` → `POST /chat/completions`;
- `novita complete` → `POST /completions`;
- `novita embed` → `POST /embeddings`;
- `novita rerank` → `POST /rerank`;
- `novita models list` → `GET /models`;
- `novita models get <model_id>` → `GET /models/{model_id}`.

У `chat` уже есть параметры, которые обычно нужны для автоматизации: модель по умолчанию `deepseek/deepseek-v3-0324`, `--system`, `--max-tokens`, `--temperature`, `--top-p`, `--stream/--no-stream` и `--json-schema` для structured output:

```bash
novita chat "Write a concise launch checklist" \
  --system "You are a pragmatic engineering lead" \
  --max-tokens 300 \
  --temperature 0.7

novita --json-output chat "Return a JSON object with three startup ideas" --no-stream
novita embed "agent sandbox runtime"
novita rerank "best runtime for agents" -d "GPU instance" -d "serverless endpoint"
```

## Media-команды: image, video и audio закрывают sync и async workflows

В первом PyPI-релизе CLI уже охватывает несколько поколений медиа API.

Для изображений доступны генерация и редактирование: `image generate`, `image flux`, `image upscale`, `image remove-bg`, `image img2img`, `image inpainting`, `image replace-bg`, `image reimagine`, `image cleanup`, `image outpainting`, `image remove-text`, `image to-prompt`, `image merge-face`. В клиенте часть операций возвращает `task_id` через async endpoints вроде `/v3/async/txt2img`, а sync-утилиты сразу печатают или скачивают результат.

```bash
novita image flux "a glassmorphism command-line dashboard" -W 1024 -H 1024
novita image generate "a product photo of a tiny AI server" --steps 30 -W 768 -H 768
novita image inpainting scene.png mask.png "replace the chair with a GPU workstation"
novita image remove-bg photo.jpg -o transparent.png
novita image to-prompt photo.jpg
```

Видео-блок покрывает `video generate`, `video from-image` и `video hunyuan`. Для долгих задач предусмотрен общий task workflow: можно отправить работу с `--no-wait`, затем проверить статус или дождаться результата с выгрузкой файлов в каталог:

```bash
novita video generate "a robot typing in a terminal" --no-wait
novita task status <task_id>
novita task wait <task_id> --timeout 600 -o ./outputs
```

Аудио-блок включает MiniMax TTS, GLM TTS, GLM ASR и voice cloning:

```bash
novita audio tts "Ship it when the tests are green." --voice Calm_Woman -o ship-it.mp3
novita audio glm-tts "Welcome to the runtime console." -o welcome.wav
novita audio asr meeting.wav
novita audio voice-clone https://example.com/sample.wav "This is a cloned voice sample."
```

## Files и batch: JSONL upload, batch jobs и скачивание результата

Для batch processing в релизе есть две отдельные группы команд. `files` управляет uploaded files: `upload`, `list`, `get`, `delete`, `content`. `batch` создаёт и обслуживает batch jobs: `create`, `list`, `get`, `cancel`.

Минимальный pipeline из README и CLI-кода:

```bash
novita files upload requests.jsonl
novita batch create <file_id>
novita batch list
novita batch get <batch_id>
novita files content <file_id> -o output.jsonl
```

Это полезно для агентов и offline workflows: входные JSONL-запросы можно загрузить один раз, создать batch на стороне Novita и дальше проверять состояние без удержания локального процесса.

## GPU sandbox runtimes: продукты, инстансы, порты, env и billing mode

Самый широкий инфраструктурный блок релиза — группа `gpu`. CLI умеет смотреть продукты и кластеры, создавать containerized runtime, читать метрики и управлять lifecycle инстанса:

```bash
novita gpu products --gpu-num 1
novita gpu cpu-products
novita gpu clusters

novita gpu create \
  --product-id 4090.16c125g \
  --image pytorch/pytorch:latest \
  --gpu-num 1 \
  --ports 8888/http \
  --env JUPYTER_TOKEN=dev

novita gpu list --status running
novita gpu get <instance_id>
novita gpu metrics <instance_id>
novita gpu stop <instance_id>
novita gpu delete <instance_id>
```

По коду `gpu create` формирует payload с `productId`, `gpuNum`, `imageUrl`, `rootfsSize`, `kind` и `billingMode`. Дополнительно можно передать `--name`, `--ports`, `--command` и несколько `--env KEY=VALUE`. Для billing mode Click ограничивает значения `onDemand`, `monthly`, `spot`, а `--kind` ограничен `gpu` или `cpu`.

## Templates, storage и serverless endpoints для повторяемых runtime-сценариев

Вокруг GPU runtime есть ещё три группы команд.

`template` управляет reusable runtime templates: `list`, `get`, `create`, `edit`, `delete`. В `template create` подтверждены параметры `--name`, `--image`, `--rootfs`, `--command`, `--cuda` и `--env`, то есть шаблон можно собрать не только как имя образа, но и как воспроизводимую конфигурацию запуска.

`storage` работает с network storage: `list`, `create`, `delete`. Создание принимает `--cluster-id`, `--name` и `--size`, а клиент отправляет это в `/networkstorage/create` как `clusterId`, `storageName`, `storageSize`.

`serverless` создаёт и обслуживает containerized inference endpoints:

```bash
novita serverless create \
  --name my-endpoint \
  --image myimage:latest \
  --port 8080 \
  --product-id <product_id> \
  --gpu-num 1 \
  --min-workers 0 \
  --max-workers 3 \
  --timeout 300 \
  --health-path /health

novita serverless update <endpoint_id> --max-workers 3
novita serverless get <endpoint_id>
novita serverless delete <endpoint_id>
```

Код `serverless create` показывает важные defaults: `rootfsSize: 100`, local volume mount `/workspace` размером 30, queue policy `{type: "queue", value: 1}`, `maxConcurrent: 1`, health check path по умолчанию `/health` и worker config с `minNum`, `maxNum`, `freeTimeout`, `gpuNum`.

## Account и billing: balance, monthly bill, usage и fixed-term

Для финансовой части в релиз вошли четыре команды:

```bash
novita account balance
novita account billing
novita account usage-billing
novita account fixed-billing
```

Это не просто «account tools» из release body: в клиенте они разведены на отдельные методы `get_balance`, `get_monthly_bill`, `get_usage_billing` и `get_fixed_billing`, а `--json-output` позволяет использовать их в скриптах мониторинга расходов.

## CI и публикация: pytest/build/twine check на Python 3.9, 3.11, 3.13

Release body говорит, что CI прошёл на Python 3.9, 3.11 и 3.13, а build и `twine check` прошли перед публикацией. Workflow в теге подтверждает это буквально: job `test-build` ставит пакет editable, ставит `pytest build twine`, запускает `pytest -k "not e2e"`, затем `python -m build` и `twine check dist/*` на matrix `3.9`, `3.11`, `3.13`.

Публикация в PyPI вынесена в отдельный workflow на tags `v*`: Python 3.11, `python -m build`, `twine check dist/*`, затем `twine upload dist/*` с `TWINE_USERNAME` и `TWINE_PASSWORD` из secrets. Это объясняет формулировку release body «Publishes from GitHub Actions using the `v0.1.0` tag»: тег `v0.1.0` указывает на commit `cec096c`, а annotated tag создан 2026-04-29.

## Что это значит для пользователей Novita

`novita-cli v0.1.0` фиксирует стабильную точку входа для автоматизации Novita AI из терминала: один PyPI-пакет `novita`, один бинарь `novita`, авторизация через `NOVITA_API_KEY` или `--api-key`, JSON-режим для машинного чтения и широкий набор команд от OpenAI-compatible text endpoints до GPU/serverless runtime management.

Если вы уже писали обёртки вокруг Novita API, этот релиз особенно полезен для трёх случаев: быстрые LLM/media вызовы из shell, batch/file workflows с JSONL и управление compute-инфраструктурой (`gpu`, `template`, `storage`, `serverless`) без отдельного SDK-кода.

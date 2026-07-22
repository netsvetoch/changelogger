---
author: Артём Нецветаев
pubDatetime: 2026-07-22T00:24:36.000Z
title: "novita-cli v0.2.0: 26 CLI-команд для редактирования изображений, Files API и GPU-инфраструктуры"
slug: novita-cli-v0-2-0
featured: false
draft: false
tags:
  - release
  - novita-cli
  - cli
  - ai
  - gpu
description: "Разбор novita-cli v0.2.0: девять команд редактирования изображений, Files API для JSONL batch-задач, GLM TTS и MiniMax voice cloning, billing, перезапуск GPU, кластеры, network storage и редактирование шаблонов."
---

[`novita-cli`](https://github.com/novitalabs/novita-cli) в версии [`0.2.0`](https://github.com/novitalabs/novita-cli/blob/main/CHANGELOG.md#020---2026-03-24) добавил 26 команд. Это не только пополнение списка: коммит [`80ad480`](https://github.com/novitalabs/novita-cli/commit/80ad480d5e43e7c8007c279630365fa685f87b04) показывает, какие HTTP-эндпоинты вызывает CLI, как устроены синхронные и асинхронные операции и что было проверено E2E-тестами с реальным API.

Ниже речь именно о состоянии v0.2.0: тогда пакет и исходный namespace ещё назывались `cnovita` / `cli_anything.novita`; позднее репозиторий был переименован и перестроен. Пользовательский бинарь в примерах релиза уже был `novita`.

## Девять операций над изображениями: где нужен polling, а где ответ приходит сразу

В релизе появились девять подкоманд `novita image`. Пять из них работают асинхронно: CLI получает `task_id`, а без `--no-wait` сам опрашивает задачу через общий механизм `poll_task`. Четыре операции редактирования, а также извлечение промпта, возвращают ответ сразу.

| Команда             | Режим | Что передаётся                               |
| ------------------- | ----- | -------------------------------------------- |
| `image img2img`     | async | исходное изображение и prompt                |
| `image inpainting`  | async | изображение, mask и prompt                   |
| `image replace-bg`  | async | изображение и описание нового фона           |
| `image reimagine`   | sync  | изображение                                  |
| `image cleanup`     | sync  | изображение и mask                           |
| `image outpainting` | sync  | изображение, prompt, целевые ширина и высота |
| `image remove-text` | sync  | изображение                                  |
| `image to-prompt`   | sync  | изображение                                  |
| `image merge-face`  | sync  | изображение лица и целевое изображение       |

Для `img2img` CLI кодирует файл в base64 и передаёт в `/v3/async/img2img` вместе с `model_name`, `width`, `height`, `image_num`, `steps`, `guidance_scale`, `sampler_name`, `strength` и `seed`. Значение `--strength` по умолчанию — `0.7`; его можно понизить, когда нужно сильнее сохранить исходное изображение:

```bash
novita image img2img portrait.jpg "акварельный портрет" \
  --strength 0.5 -W 1024 -H 1024 --no-wait
# Task ID: ...

novita task wait <task_id> -o ./outputs
```

`inpainting` принимает отдельную маску и вызывает `/v3/async/inpainting`; `replace-bg` отправляет base64-изображение и prompt в `/v3/async/replace-background`. Это важно для автоматизации: эти три команды не отдают готовый файл немедленно, в отличие от `reimagine`, `cleanup`, `outpainting`, `remove-text` и `merge-face`.

Синхронные команды декодируют поле `image_file` из ответа и записывают файл на диск. Например, `outpainting` позволяет задать итоговый холст до 4096 пикселей по каждой стороне и положение исходного кадра через `--center-x` и `--center-y`:

```bash
novita image outpainting product.png "продолжить сцену как студийный стол" \
  -W 1536 -H 1024 --center-x 512 --center-y 512 -o expanded.png

novita image cleanup photo.jpg mask.png -o cleaned.png
novita image remove-text screenshot.png -o without-text.png
novita image merge-face face.jpg target.jpg -o merged.png
```

`image to-prompt` вызывает `/v3/img2prompt` и выводит поле `prompt`, а не создаёт новый графический файл:

```bash
novita image to-prompt reference.png
```

E2E-набор релиза проверял на настоящем API цепочку FLUX → `to-prompt`, `reimagine` и `remove-text`; для двух последних тесты дополнительно убеждались, что выходной файл был создан.

## Files API: JSONL можно загрузить, проверить и удалить из CLI

В v0.1.0 batch-команды уже существовали, но в v0.2.0 появился полный набор управления входными файлами:

```bash
novita files upload requests.jsonl
novita files list
novita files get <file_id>
novita files content <file_id> -o result.jsonl
novita files delete <file_id>
```

Подкоманды работают с OpenAI-совместимым маршрутом `/openai/v1/files`: `list` делает `GET /files`, `get` — `GET /files/{id}`, `delete` — `DELETE /files/{id}`, а `content` получает `GET /files/{id}/content`. При `files content -o ...` CLI пишет текст ответа в указанный файл; без `-o` печатает его в stdout.

Практический сценарий для batch-процесса стал целостным: загрузить JSONL, взять возвращённый ID, передать его в уже имевшийся `novita batch create <file_id>`, а затем при необходимости забрать содержимое или удалить файл. E2E-тест релиза создавал временный JSONL, загружал его через CLI, проверял `files get` и удалял через `files delete`.

## Аудио: GLM TTS пишет WAV/PCM, MiniMax клонирует голос по URL

Команда `novita audio glm-tts <text>` поддерживает семь фиксированных голосов: `tongtong`, `chuichui`, `xiaochen`, `jam`, `kazi`, `douji` и `luodo`. Реализация учитывает особенность `/v3/glm-tts`: в отличие от обычных JSON API он может ответить бинарным аудио. Клиент смотрит на `Content-Type`, сохраняет bytes и CLI записывает их в WAV либо PCM.

```bash
novita audio glm-tts "Добро пожаловать" --voice jam -o greeting.wav
```

Вторая команда — `novita audio voice-clone <audio_url>` — передаёт URL образца в `/v3/minimax-voice-cloning`. То есть на входе требуется доступная API ссылка на аудиофайл, а не локальный путь. В релизе также добавлен E2E-тест `glm-tts` с голосом `jam`.

## Новая информация о счетах и операции с инфраструктурой

Для аккаунта появились два независимых запроса:

```bash
novita account usage-billing
novita account fixed-billing
```

Они обращаются соответственно к `/v3/user/usage-based-billing` и `/v3/user/fixed-term-billing`. Это не псевдонимы старой месячной сводки `account billing`: CLI выводит отдельные ответы для usage-based и fixed-term тарификации. В тестах команда допускает код возврата `0` или `1`, поскольку доступность данных зависит от типа аккаунта.

На стороне GPU и storage добавлены:

```bash
novita gpu restart <instance_id>
novita gpu clusters

novita storage list
novita storage create --cluster-id <cluster_id> --name datasets --size 100
novita storage delete <storage_id>
```

`gpu restart` отправляет `instanceId` в `/gpu-instance/openapi/v1/gpu/instance/restart`, а `gpu clusters` получает список дата-центров через `/gpu-instance/openapi/v1/clusters`. У storage есть отдельные маршруты для списка, создания и удаления; при создании CLI требует `--cluster-id`, `--name` и размер в гигабайтах через `--size`. Поэтому сначала имеет смысл выбрать кластер, а затем создавать том в нём.

Наконец, `novita template edit <template_id>` не отправляет только изменённое поле. Он сначала читает шаблон, собирает объект с текущими `name`, `image`, `rootfsSize`, `type`, `channel` и `startCommand`, подменяет переданные `--name`, `--image`, `--rootfs` или `--command`, после чего вызывает update API. Это снижает риск затереть обязательные параметры при частичном редактировании:

```bash
novita template edit <template_id> \
  --name "pytorch-production" --rootfs 80 --command "python serve.py"
```

E2E-проверка релиза создавала private template, меняла имя через CLI, читала шаблон обратно и сравнивала новое имя, затем удаляла ресурс.

## Что обновить в автоматизации

Если скрипт использовал только генерацию изображений, v0.2.0 добавляет два разных паттерна работы: async-команды с `task_id` (`img2img`, `inpainting`, `replace-bg`) и sync-команды, которые сразу создают файл. Для batch-пайплайна больше не нужен отдельный HTTP-клиент вокруг файлов: JSONL можно вести командами `novita files`. А инфраструктурные сценарии получили недостающий цикл «узнать кластер → создать storage → перезапустить GPU → изменить template».

По данным changelog и коммита реализации, проект увеличил набор с 77 до 95 тестов: 34 unit и 61 E2E. Важная оговорка автора релиза: E2E выполнялись против реального API без mocks; это подтверждает покрытие описанных маршрутов, но операции с GPU, storage и template всё равно могут создавать или изменять облачные ресурсы, поэтому их стоит запускать осознанно.

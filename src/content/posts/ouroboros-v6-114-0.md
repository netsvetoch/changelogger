---
author: Артём Нецветаев
pubDatetime: 2026-09-01T21:30:00.000Z
title: "Ouroboros 6.114.0: capability preservation как инвариант, shape-first failover OpenRouter и ultra-tier"
slug: ouroboros-v6-114-0
featured: false
draft: false
tags:
  - release
  - ouroboros
  - ai-agents
description: "Разбор минорного релиза Ouroboros 6.114.0: capability preservation как first-class-инвариант иммунной системы, shape-first фейловер OpenRouter вместо хардкода семейств моделей, тир reasoning `ultra` выше `max`, execution-probed лестница для node/npm, O(delta) чтение usage-лежджера и guard torn-tail, rich chat stack и конструкция правды делегирования/чата."
---

[`ouroboros`](https://github.com/razzant/ouroboros) выпустил минорную версию [`6.114.0`](https://github.com/razzant/ouroboros/releases/tag/v6.114.0) — compare [`v6.113.4...v6.114.0`](https://github.com/razzant/ouroboros/compare/v6.113.4...v6.114.0) насчитывает 243 коммита. Два лейтмотива релиза — сохраняемость возможностей как отдельный инвариант «иммунной системы» агента и вывод политики фейловера OpenRouter из формы reasoning-артефакта, а не из ростра семейств моделей. Тег собран из коммита [`b9bcc2da71e0`](https://github.com/razzant/ouroboros/commit/b9bcc2da71e0bd51b6f5f906890b3b80265defed), прошёл полный тестовый матрикс, UI/Docker/skill-смоуки и смоуки упакованных артефактов; проверять можно через `gh attestation verify <файл> --repo razzant/ouroboros --signer-workflow razzant/ouroboros/.github/workflows/ci.yml --source-digest b9bcc2da71e0 ...`.

Релиз также несёт в себе нетегированный `6.113.5` — fixes по аудиту [#440](https://github.com/razzant/ouroboros/issues/440) (generation-safe сборка Playwright после timeout-нутых браузерных тулов).

## Capability preservation — первый инвариант иммунной системы

Центральная тема релиза выросла из исследовательского issue [#447](https://github.com/razzant/ouroboros/issues/447). Кратко его суть: «Safety Off» отключает лишь один супервизорный слой, а множество независимых ограничений в path-handling, authority задач, shell-классификации, захвате делегирования, review и рендеринге результатов остаются активными. Результат — класс поведения, где авторизованная работа отказывается из-за имени директории/аргумента, а операция докладывает успех, молча отбрасывая вход/выход/состояние.

Ключевая проблема по аудиту №447 — «capability часто выводится из страшного текста, а не из фактической authority». Конкретные воспроизведённые примеры:

- `src/auth/login.py` и `src/tokens/parser.py` отклоняются политикой дочерних файлов как «credential-каталоги», при том что `src/security/password_rules.py` проходит — политика смотрит на имена компонентов пути, а не на содержимое;
- скрипт, содержащий `os.environ.get("LANG")`, матчит raw-ограничение `.env`; имя файла `test_id_ed25519_parser.py` матчит ограничение на ключи;
- литеральный `sudo` в данных трактуется как попытка эскалации — валидатор сканирует каждый argv-токен, а не позицию команды: `["rg","sudo","README.md"]` → violation, а `["sudo","-n","true"]` → allowed;
- валидный JSON `{"content":"hello","role":"assistant"}` отклоняется как «выдуманный сериализованный результат тула», если первым идёт контент-поле, тогда как тот же объект в обратном порядке проходит.

В 6.114.0 «сохранение возможностей» попадает в разряд first-class-инвариантов наравне с иммунной системой. Релиз делит работу на стадии 1-3: золотой набор capability-сюитa, seam-pinы, которые реально различают пути, исполняемые item-21-триггеры, и оценка бинарей по magic bytes (а не по имени файла). Конструктивно это означает: новый guard или sandbox обязан предъявить позитивный capability-сценарий, а повторяющиеся находки reviewer'а трактуются как гипотезы, а не как готовый продукт-политику.

## Фейловер OpenRouter теперь зависит от формы reasoning, а не от семейства модели

Issue [#468](https://github.com/razzant/ouroboros/issues/468) описал реальный инцидент: в 64-lane прогоне на `deepseek/deepseek-v4-flash-0731` применённая политика `{"allow_fallbacks":true,"require_parameters":true}` не мешала, но каждая задача завершилась `provider_unavailable` после upstream-429. DeepSeek не входил в хардкоженный набор «переносимых семейств», поэтому при переписывании reasoning-артефакта seam вставлял `provider.allow_fallbacks=false`. Артефакт был обычным читаемым текстом — `reasoning`-строка плюс одна запись `type: "reasoning.text"` — и переигрывался переносимо: принудительный Relace→Baidu и Relace→DeepInfra реплей возвращали HTTP 200.

Подход «добавить DeepSeek в ещё одну таблицу» в релизе отвергнут как раз из-за того, что таблицы семейств стареют и смешивают читаемый текст с непрозрачной транспортной custody. Вместо этого continuity-требование теперь выводится из фактической формы артефакта:

- читаемые text/summary-артефакты остаются failover-eligible для любого семейства;
- голый `response_id` больше не «пинит» перезапрос к провайдеру;
- запечатанные артефакты (encrypted/signed/redacted, не порученные roster-у `anthropic`/`gemini`) сохраняют continuity-пин на обоих путях — dispatch и reroute;
- причина пина и отказавший upstream-провайдер доходят до durable-телеметрии, так что при исчерпании фейловера видно, какие провайдеры пробовались.

Полевое свидетельство 2026-07 исключило `openai/` из roster-а запечатанных. Итог — политика фейловера больше не зависит от хардкода портируемости семейств.

## Новый `ultra`-тир reasoning-effort

В 6.114.0 появился тир `ultra` выше `max`. По `ouroboros/config.py` на теге `v6.114.0` упорядоченный SSOT теперь выглядит так:

```python
EFFORT_SCALE: tuple[str, ...] = ("none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra")
```

`ultra` — это тир vendor-лестницы Codex CLI (в `EFFORT_SCALE` он один тир выше `max`); Claude Code 2.1.221 остаётся с верхним потолком `max` (его `ultra_effort_*` — это keyword-телеметрия, а не reasoning-тир), поэтому делегированная claude-семейство продолжает адаптировать запрос на своём потолке и подхватит тир, когда vendor его пришлёт.

Изменение не сводится к добавлению строки: все потребители шкалы переведены на единый `EFFORT_SCALE`. `switch_model` больше не держит хардкод-копию — enum выводится из `EFFORT_SCALE`, а неизвестный `effort` вместо тихой коэрции в `medium` честно отказывает с тем же типом сообщения, что и неизвестная модель. Reviewer-слоты, Available-subagent-строки, `--review-effort` в `terminal_bench` и владельческие effort-lane соответствуют реальной шкале.

## node/npm запускаются через execution-probed лестницу

`shutil.which` доказывает существование, но не раннабельность процесса. На macOS generic-поверхности (`run_command`, `run_script`, `start_service`, `verify_and_record`) могли резолвить bare `node`/`npm` через host PATH — на Homebrew-node, который ядро SIGKILL'ит на запуске (~9ms, CODESIGNING), хотя рабочий подписанный node уже вшит в приложение.

Модуль переименован из `python_interpreter.py` в `process_interpreters.py` и получил node-ветку резолвера с общим `InterpreterResolutionTrace` (python-события байт-в-байт совпадают). Логика лестницы:

- сначала `bootstrap_process_path`, нелокальные executor-бэкенды пропускаются;
- здоровый PATH-node — это no-op без изменения argv/env/рендер-текста/receipt'ов;
- отсутствующий или probe-мёртвый PATH-node падает на bundled-рантайм (argv-переписывание только для bare `node`/`nodejs`; для npm-семейства и `sh/bash/zsh/dash`-тел — prepend PATH в attested child-env);
- если пригодного node нет, код исполняется «как написан» с раскрытием фактических probe-фактов, никогда не пре-блокируется.

Здоровье кэшируется в `ouroboros/node_runtime.py` по ключу `(path, mtime, size)`; отсутствующий node никогда не кэшируется (положим, mid-session-установка заметна). Начальный health-проба — единственное исполнение, поэтому она обязана сидеть ниже лёгкого fence, shell-guard'ов и safety-refusal; тест `test_light_fence_refuses_before_the_node_probe_can_execute` пинит, что payload подставленного PATH-shim не может выполниться по отклонённому вызову.

## Правда делегирования и чата сходится

Несколько изменений объединяют поверхность «по-настоящему произошло» между делегированными ранами и чатом владельца:

- Вопросы делегированных ранов поехали по escalation-иерархии ([#204](https://github.com/razzant/ouroboros/issues/204)): раньше «owner-ответ» был notify-and-wait-out-движкового таймаута; теперь есть типизированные карточки-квизы владельца и escalation-канал (Q-2a/Q-2b).
- Routing-picker стал настоящим селектором ([#198](https://github.com/razzant/ouroboros/issues/198)): `needs_manual_target` раньше рисовал выдуманный «chooser» — неинтерактивный `div` с join'ом через `/` всего инвентаря Projects одной строкой, в котором ничего нельзя было выбрать, и хост при этом приложил все 12 активных проектов. Теперь доступный picker хост-валидированных таргетов, один dispatch выбранного target'а с token-bound idempotency и stale-target revalidation, и никакого роутинга до принятия выбора.
- Review-находки переехали в чекпоинт Reviews на карточке задачи: plan-попытки теперь рендерят строки findings (class, summary, broken spec id, locator, recommendation, slot/model) с диспозицией агента; те, что не имеют parseable-вердикта, — отдельной строкой, плюс honest counts и observability-указатели вместо тихого `[-10:]`.
- Live-first доставки владельцу, честные chat-activity-выводы с resume после budget-pause, persistent stable-target регистрации.
- Nanny-раунд, умерший с `provider_outcome_unknown`, больше не даёт причинно-слепому terminal-клинингу отменить живой делегированный лист: round gate латчит durable hold, следующий round top паркует задачу в supervised-wait, а лус-дроп закрывается в no-call-терминал, никогда не в paid-dial.

## O(delta) чтение usage-лежджера и guard torn-tail

Учёт использования держит `state/usage_attempts.jsonl` под 45-секундным денежным flock. `reserve_attempt` / `settle_attempt` / `_transition` / `release_attempt` / `_ensure_legacy_imported_locked` до этого делали полный parse+validate всего файла на каждый metered-попытке. Комментарий в `_locked` давно называл «~0.5s hold at 20MB»; врачущийся леджер на живом инсталле уже 40MB+ и не ограничен.

Теперь добавлен per-process per-drive-root warm cache последнего валидированного чтения: следующее чтение внутри лока переиспользует его и парсит+валидирует только байты, добавленные после (через существующий `_read_new_records_locked`, который при ЛЮБОМ сомнении — inode change, shrink, rewrite, torn-хвост — возвращает None, так что стейл-кэш не может быть отдан). `OrderedDict` ограничен 8 корнями (LRU-эвикция); полный `_read_records_locked` остаётся авторитетом, quarantine там же. Денежная математика видит байт-в-байт те же строки — меняется только стоимость чтения.

Отдельный guard для torn-tail: `_append_rows_locked` писал `O_APPEND` прямо после того, что лежит на диске; writer, убитый во время append, мог оставить JSON-похожий, но без переноса строки partial-ряд, и следующий append «сваривал» с ним первый ряд в одну непередающуюся строку, а читатель карантинил ОБА ряда. Перед append проверяется последний байт файла и при отсутствии переноса строки вставляется `'\n'`, так что tear стоит как максимум самого себя.

## Rich chat stack и прочее

Основная чат-поверхность стала богаче (markdown, медиа, галереи, ссылки), вместе со стабильностью viewport чата, консистентной one-verdict action-поверхностью Dashboard/Updates, честностью Settings-эффектов, affordance «Repair» для skill после проваленного preflight и CRLF-safe web source-pin'ами на Windows. Claudexor-рантайм запенен к 3.9.5 с delayed-startup-реконсиляцией, foreground quota-refresh bridge, сохранением делегированных текстовых фрагментов; restart-состояние Updates выживает после same-SHA reconnect. CI: serial service-log сюиты больше не гоняются с детским процессом, size-ratchet-манифест точен.

## Итог

Ouroboros 6.114.0 — заметный минор в трёх направлениях. Во-первых, сохранение возможностей перестаёт быть попутным бонусом и становится инвариантом иммунной системы №447 со стадиями 1-3 и magic-byte-оценкой бинарей. Во-вторых, фейловер OpenRouter переводится с хардкоженных семейств на форму reasoning-артефакта (#468) — читаемый текст остаётся переносимым, запечатанные артефакты держат continuity-пин, а решение объяснимо в durable-телеметрии. В-третьих, добавлен reasoning-тир `ultra` с переводом всех потребителей шкалы на единый `EFFORT_SCALE`, execution-probed лестница для node/npm и O(delta) чтение usage-лежджера с guard-ом torn-tail. Плюс конвергенция правды делегирования и чата: настоящий routing-picker, review-находки в чекпоинте Reviews и защита живого листа делегации от слепого cancel'а.

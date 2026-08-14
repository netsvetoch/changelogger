---
author: Артём Нецветаев
pubDatetime: 2026-08-14T12:00:00.000Z
title: "Ouroboros 6.100.0: делегированные запуски в приватных снапшотах — изоляция, capture и GC с одной честной истиной"
slug: ouroboros-v6-100-0
featured: false
draft: false
tags:
  - release
  - ouroboros
  - ai-agents
  - delegated-runs
  - git
  - self-evolving
description: "Разбор Ouroboros v6.100.0: мутирующие delegated runs больше не трогают общее дерево — baseline-снапшот в refs/ouroboros/delegated/ с veto секретов ДО хэширования, typed binding в durable custody, capture-at-disposition с typed refusal INTEGRATE_DELEGATED_CAPTURE_FAILED, NUL-safe numstat в обе стороны, accounted_upper_bound_usd вместо cost_usd и --prompt-file для длинных промптов."
---

[Ouroboros](https://github.com/razzant/ouroboros) — open-source self-creating AI-агент (родился 16 февраля 2026, по собственному описанию), который работает над внешними проектами, координирует рой специализированных саб-агентов и умеет переписывать собственную реализацию. 12 августа 2026 вышел минорный релиз [`v6.100.0`](https://github.com/razzant/ouroboros/releases/tag/v6.100.0) — «sprint phase C», целиком посвящённый одной теме: **мутирующий делегированный запуск больше никогда не редактирует общее дерево напрямую**. Вся работа уходит в приватный git-снапшот, а в общее дерево изменения попадают только через явный apply/reject владельца.

Источники: [GitHub Release v6.100.0](https://github.com/razzant/ouroboros/releases/tag/v6.100.0), compare [`v6.99.0...v6.100.0`](https://github.com/razzant/ouroboros/compare/v6.99.0...v6.100.0) (4 коммита, 77 файлов), коммит [`f72d6be25f`](https://github.com/razzant/ouroboros/commit/f72d6be25f) (основной) и итоговый [`944ad98992`](https://github.com/razzant/ouroboros/commit/944ad989921213dc8394ad09f7dc836e3eed36e3), из которого собран релиз.

## Проблема: секреты в object database и «слепые» делегированные запуски

До этой версии при старте мутирующего delegated run снапшот строился через `git add -A`. Проблема, которую честно называют в коде (`ouroboros/subagent_worktrees.py`): `git add -A` пишет blob для **каждого** untracked-файла в object database целевого репозитория — включая `.env` и `credentials.json`. Удаление записи из индекса после этого не отменяет запись объекта: execution worktree разделяет тот же ODB, и отклонённый секрет оставался читаем по хэшу.

Вторая проблема — орфанные запуски: если хост падал между стартом делегированного run и его завершением, снапшот с единственной копией работы ребёнка мог быть собран startup GC, а «осиротевший» патч нигде не отображался как ожидающее обязательство.

## Как теперь строится baseline: eligibility решается ДО хэширования

В v6.100.0 при `delegate_start` хост снапшотит **реальное текущее состояние** authority target (tracked + staged + eligible untracked) в baseline-коммит, закреплённый ref'ом `refs/ouroboros/delegated/<snapshot_id>`, и чекаутит detached приватный worktree — запуск живёт только там.

Ключевое изменение в `ouroboros/subagent_worktrees.py` — порядок операций. Сначала вычисляется staged set: tracked/staged пути из реального индекса плюс **только eligible untracked** — каждый untracked-файл проходит предикат `untracked_capture_veto_reason` (sensitive/credential-shaped, junk, oversized binary) **до того, как что-либо попадёт в object database**:

```python
for rel in (p for p in untracked_raw.split("\0") if p):
    reason = untracked_capture_veto_reason(target, rel)
    if reason:
        excluded.append({"path": rel, "reason": reason})
    else:
        eligible.append(rel)
staged_paths = indexed + eligible
if staged_paths:
    # `--add --remove` стейджит CURRENT worktree content каждого именованного
    # пути — как `git add -A` для этих путей, но не трогая остальные файлы.
    _git_env(target, "update-index", "-z", "--add", "--remove", "--stdin", env=env,
             input_bytes=b"\0".join(...) + b"\0")
```

Дальше — plumbing-only конвейер: временный индекс (`read-tree` из HEAD), `write-tree`, sha256-манифест дерева, `commit-tree` с автором `Ouroboros <ouroboros@localhost>`, `update-ref` в `refs/ouroboros/delegated/` и `git worktree add --detach`. Сам target при этом не трогается — ни его индекс, ни HEAD, ни рабочие файлы. Повторный provision того же `snapshot_id` идемпотентен: старый checkout и ref от crashed-попытки зачищаются заранее, а при неудаче чекаута baseline-ref удаляется, чтобы не утёк.

## Typed binding едет в custody ДО POST, retry воспроизводит его точно

Typed binding `{execution_root, baseline_sha, target_root, authority_source}` записывается в durable custody rows **до** POST делегирования. Явный retry воспроизводит ровно этот binding: попытка пере-снапшотить мутирующие строки или перевыпустить GC-собранный baseline — это typed refusal, а не «тихий re-mint». Pending-invocation orphan recovery переносит **полный** binding в строку восстановленного запуска, поэтому startup GC — чей предикат `settled && patch_disposed` — никогда не удалит снапшот, в котором лежит единственная работа ребёнка.

## Терминальная реконсиляция: захватывать только там, где есть receipt

Финальный захват diff'а (orphan sweep, kill path, in-process release) идёт через один drive-rooted capture core и делается **только при наличии терминального receipt**, доказывающего, что run окончен. Если daemon вернул 404 (отсутствует) или close нечитаем — захватывается ничего: за границей owned-daemon ребёнок может всё ещё писать.

Точка повтора перенесена в disposition: `integrate_delegated_patch` захватывает по требованию **до** apply или reject, и провал захвата — это typed refusal `INTEGRATE_DELEGATED_CAPTURE_FAILED` для **обоих** решений. Семантика `patch_captured` теперь честная: «существует пригодный артефакт» — манифест, отчитывающийся о собственном провале, строку не минтит, строки над failed-манифестами перезахватываются при replay, а reject перепроверяет манифест перед освобождением снапшота.

## Apply: drift-check под git lock и NUL-safe numstat в обе стороны

Ничего не достигает общего дерева без явного owner apply/reject flow:

- **Baseline drift** доказывается per touched path под git lock перед apply.
- **Touched paths** читаются NUL-безопасно из `git apply --numstat -z` в **обоих** направлениях (`ouroboros/tools/subagent_integration.py`, `_patch_touched_paths`). Прямое направление называет только пути, которые оно пишет: rename отчитывается destination'ом вперёд и source'ом назад — а source это ровно то удаление, которое staging должен записать. Старый текстовый парсинг (split по табам + regex по `diff --git` заголовкам) ломался на путях с табами, переводами строк и кавычками, и искажённый pathspec уезжал в protected-path gate.
- **Cleanup** следует durable disposition row: `INTEGRATE_DISPOSITION_UNWRITTEN` и `INTEGRATE_APPLIED_UNSTAGED` — typed состояния, никакого молчаливого double-apply.
- **Protected-path gate** срабатывает только когда target — это само тело Ouroboros.
- **Pending obligation** виден на health surface: `undisposed_patches` → предупреждение «DELEGATED PATCH AWAITS DISPOSITION» в `context_health.py` — и остаётся там, пока строка `PATCH_DISPOSED` его не снимет. Формулировка зависит от реального состояния захвата: для run, реконсилированного через absent daemon (без захвата), пишется «no patch captured yet», а не «captured» — потому что это была бы квитанция над работой, которую ребёнок мог ещё писать.

Отдельная страховка стейджинга: `_stageable_paths` считает подмножество touched-путей, которое git реально может застейджить после apply. Путь stageable, если существует на диске (add/modify) или есть в индексе (тогда стейджится как deletion). Untracked-файл, который патч удалил, — не то и не другое: раньше его имя заставляло `git add` упасть с «did not match any files» **после** того, как apply уже мутировал дерево.

## Рядом в релизе

- **Честная проекция стоимости.** В `ouroboros/cost_projection.py` появилось поле `accounted_upper_bound_usd` под своим честным именем рядом с deprecated-алиасом `cost_usd` (то же значение; та же пара для `*_with_children`). Плюс исправления $0-fabrication, и web UI теперь показывает верхнюю границу стоимости честно (`web/tests/cost_presentation.test.js`).
- **`delegated_runs_failed` на execution-evidence receipt** (`ouroboros/delegate_evidence.py`): сырой счётчик settled-но-не-succeeded запусков, включая closed-absent — чтобы «никогда не пробовали» отличалось от «пробовали и run умер» без перепарсивания event log.
- **Маршрутизация уведомлений по чатам**: `LifecycleJob.chat_id`, task-bound reviews, reaper incident chat (`supervisor/events.py`).
- **Байт-точный бюджет argv/env** с транспортом `--prompt-file` (`ouroboros/cli.py`, `_resolve_prompt`): benchmark-scale промпт в argv рискует упереться в E2BIG, поэтому объёмные промпты едут файлом — или stdin через `--prompt-file -` — и два транспорта взаимоисключающие, чтобы stray positional word никогда молча не перекрыл файл.
- **Hash-bound skill repair** (`ouroboros/skill_repair_admission.py`): repair допускается против одного точного состояния payload'а — `base_content_hash`, зафиксированный иммутабельно при admission; каждая собственная запись CAS-проверяет payload против `expected_content_hash`; чужой hash — это typed stale terminalization.

## Release proof

Релиз собран из [`944ad98992`](https://github.com/razzant/ouroboros/commit/944ad989921213dc8394ad09f7dc836e3eed36e3); перед публикацией прошли полная test matrix, UI/Docker/skill/packaged-artifact smoke-тесты. `SHA256SUMS` покрывает все ассеты, SBOM и smoke receipts; `release-evidence.json` связывает тег, коммит, workflow run, хэши артефактов и SBOM. Проверка provenance:

```bash
gh attestation verify <file> --repo razzant/ouroboros \
  --signer-workflow razzant/ouroboros/.github/workflows/ci.yml \
  --source-digest 944ad989921213dc8394ad09f7dc836e3eed36e3 \
  --source-ref refs/tags/v6.100.0
```

## Кому стоит обновиться

Всем, кто пользуется делегированными мутирующими запусками во внешних репозиториях: до этой версии секреты из untracked-файлов могли оседать в object database execution worktree, а орфанная работа — молча исчезать при GC. После обновления обратите внимание на health surface: предупреждения «DELEGATED PATCH AWAITS DISPOSITION» означают, что чья-то работа ждёт явного `integrate_delegated_patch(run_id=..., decision='apply'|'reject')`.

## Как обновиться

Пакеты под все платформы — на [странице релиза](https://github.com/razzant/ouroboros/releases/tag/v6.100.0). На Linux: `sudo apt install ./ouroboros_*_amd64.deb` или `sudo dnf install ./ouroboros-*.x86_64.rpm` (установка в `/opt/ouroboros`, `ouroboros` появляется на `PATH`; для RED OS 8 есть отдельный `.red80.x86_64.rpm`). AppImage запускается из user-writable пути при установленном host Git; `.tar.gz` остаётся для extraction-based установок. Сборки под macOS сейчас — только Apple silicon.

---
author: Артём Нецветаев
pubDatetime: 2026-08-15T19:39:01.000Z
title: "Ouroboros 6.102.0: Wrap up / Hurry up, ContextFit и редактирование skill-payload через делегирование"
slug: ouroboros-v6-102-0
featured: false
draft: false
tags:
  - release
  - ouroboros
  - ai-agents
  - task-control
  - context
  - self-evolving
description: "Разбор Ouroboros v6.102.0: owner-контролы Wrap up и Hurry up, typed ContextFit deficit/reclaim, делегированное редактирование skill-payload со снапшот-custody, UI-карточки, nanny с первого напоминания на раунде 3 и фиксация Claudexor login-daemon."
---

[Ouroboros](https://github.com/razzant/ouroboros) — open-source self-creating AI-агент, который работает над внешними проектами, координирует рой саб-агентов и умеет переписывать собственную реализацию. 15 августа 2026 вышел минорный релиз [`v6.102.0`](https://github.com/razzant/ouroboros/releases/tag/v6.102.0): владелец впервые получает настоящие mid-task контролы («Wrap up» / «Hurry up» / «Stop now»), движок контекста переведён на typed-контракт ContextFit, а skill-payload редактируется через делегированный harness-сеанс со snapshot custody.

Это не pointer-only релиз: в body есть полный «What's new» плюс proof. Источники: [GitHub Release v6.102.0](https://github.com/razzant/ouroboros/releases/tag/v6.102.0), compare [`v6.100.0...v6.102.0`](https://github.com/razzant/ouroboros/compare/v6.100.0...v6.102.0) (67 коммитов), итоговый коммит сборки [`ca75d909d7f3`](https://github.com/razzant/ouroboros/commit/ca75d909d7f39456f174c761fe4c46e8d800e3fa). Между 6.100.0 и 6.102.0 в истории есть внутренние `release 6.101.0` / `6.101.1` (size ratchets и Windows CI); отдельного GitHub Release для 6.101.x нет.

## Wrap up: отмена становится финализацией с custody

До этого релиза `POST /api/tasks/{id}/cancel` был жёсткой отменой. Теперь политика терминализации — отдельная ось на том же durable cancel-intent (`ouroboros/cancel_intents.py`), а не второй ledger:

- отсутствие/`immediate` — прежнее hard-cancel, byte-identical для существующих клиентов;
- `finalize_then_cancel` — «Wrap up»: один ограниченный tool-less ход модели, потом custody убивает процесс.

HTTP-ingress (`ouroboros/gateway/tasks.py::_graceful_stop_acknowledgement`) сразу отвечает `202` с `cancel_state: pending` и `stop_policy`. Сокет не держится на весь эпизод: durable intent — единственная воля владельца, оркестрация стартует в фоне, а `sweep_cancel_intents` → `sweep_owner_stop_hold` переигрывает её после рестарта.

Ключевой инвариант — бюджет эпизода якорится на **доставке** контроля модели, а не на клике. `mark_finalize_control_drained` пишет `control_drained_at` (first drain wins). `owner_stop_deadline_ts` считает так:

- пока stamp нет — действует только внешний потолок `OWNER_STOP_OUTER_CAP_SEC = 600` (10 минут от `requested_at`). Долгий blocking tool call больше не съедает окно: задача всё ещё получает финальный ход;
- после drain — `min(drain + grace, request + 600)`, где grace — `OUROBOROS_FINALIZATION_GRACE_SEC` (дефолт 120 с, clamp 0…300);
- `grace_sec <= 0` выключает фичу целиком: никакого pre-drain окна, sweep сразу кормит custody.

Если stamp не записался, worker ретраит один раз (`for _ in range(2)` в `_mark_owner_stop_control_drained`). Второй провал — typed forensic `owner_stop_stamp_failed` в `logs/events.jsonl`; бюджет **не расширяется**, sweep остаётся на `request + 600`.

Контроль, который доехал уже просроченным, не покупает платный саммари: `_owner_stop_window_elapsed` уводит на `_forced_fallback_result` с `reason_code=owner_requested_finalization` и нулём новых LLM-вызовов. Если к этому моменту уже есть `DeliveryCandidate`, salvage сохраняет его текст (`retained_source=owner_stop_retained_candidate`) и не затирает.

Каждый терминальный шов (expiry / handoff / salvage) остаётся typed receipt в UI. «Stop now» во время ожидания **ужесточает** тот же intent (`stop_policy_hardened`) — reverse softening запрещён. В каскаде живые потомки режутся deepest-first без платных ходов; корень получает bounded проекцию их durable-результатов (макс. 20 строк × 240 символов) в одном финальном ходе.

## Hurry up: ускорить, не убивая

Рядом — контрол, который **не** отменяет задачу. `POST /api/tasks/{task_id}/hurry` принимает **только** `{"request_id": "..."}`. Любое лишнее поле — `400 unexpected_fields`. Текста нет: нет `steer_task`, нет пузыря в чате, нет outbox/WS chat-frame.

```json
POST /api/tasks/{task_id}/hurry
{ "request_id": "hurry-550e8400-e29b-41d4-a716-446655440000" }
```

Admission идёт под queue lock (`ouroboros/gateway/task_hurry.py::_admit_hurry_locked`): live PENDING/RUNNING, только root, не sealed acceptance-fence. Pending cancel **побеждает** — hurry получает `409 cancel_pending` и не ставится в очередь. Тот же `request_id` на живой попытке — идемпотентный ack с `duplicate: true`; другой id схлопывается в один effect latch.

Контрол едет через owner mailbox как `KIND_HURRY` (`msg_id=hurry:{request_id}`). Drain в `loop.py` маршрутизирует его структурно — в `messages` не попадает — и ставит attempt-local latch. Эффекты только host rails (`ouroboros/owner_hurry.py`):

- следующий eligible acceptance-panel пропускается (`status=finalized_unaccepted`, `reason=owner_hurry`), reviewer-вызовов ноль; уже летящая панель не отменяется и не переименовывается;
- `max_improvement_passes` на эффективном профиле становится `0` (immutable `task_contract.budget_profile` не мутируется);
- открытый force-plan gate читается как **task-local advisory** (`reviewed`/`open`/`unavailable` могут идти локально; `absent`/`pending` остаются hold). Commit triad/scope, advisory pre-review, P3 и safety hurry **не** смотрят.

Проекция пишется dedicated writer'ом в ключи `owner_hurry` / `owner_hurry_history` task-result — не через `write_task_result`, чей status-regression guard мог молча выбросить запись. Same-id retry (reaper timeout и crash-requeue) зовёт один `retry_reset`: чистит mailbox и архивирует latch, чтобы новая попытка не унаследовала ускорение.

## ContextFit: deficit/reclaim вместо ad-hoc порогов

`ouroboros/context_fit.py` больше не набор compaction-threshold'ов. Один захваченный `ContextCore` (base prompt, BIBLE, ARCHITECTURE, DEVELOPMENT, semi-stable/dynamic) проецируется в две детерминированные картинки — Max и Low — с `core_sha256`. `measure_main_fit` сравнивает кандидата с owner target `T` и route window `W`:

- `target_deficit_tokens` / `capacity_deficit_tokens`;
- `reclaim_goal_tokens = max(ненулевые дефициты)`;
- действие: `send` | `reclaim_once` | `send_target_miss`.

Автоматический reclaim — один проход. Task-local Low разрешён только после реального provider overflow на этом маршруте; prediction не меняет owner-выбранную проекцию документов. Калибровка плотности читается из **канонического** evidence root (`resolve_main_token_density`), не из drive ребёнка. В оценку входят tool schemas: `tool_schema_tokens` закрывает дыру, из-за которой emergency-compaction срабатывал на целый envelope позже (~37K токенов схем на submarine-трейсах). Persistent auto-low routing в этом релизе снят.

## Skill-payload: делегированное редактирование со snapshot custody

Установленный skill больше не правится серией своих `edit_text`. Exact-resource lane в `delegate_start` принимает **только** `root="skill_payload"` плюс `bucket` / `skill_name`. Селектор выбирает authority, которую задача уже держит (`skill_payload.write`); ничего нового не выдаёт.

Мутирующий запуск живёт в **standalone** git-снапшоте payload'а (живой файл не инициализируется как Git). Binding `{snapshot_id, baseline_sha, target_root, authority_source}` пишется в durable custody **до** POST. Capture не доверяет child-writable `.git` снапшота. После apply — hash-assert; mismatch ставит stale-extension reconcile в очередь, а не молча принимает чужой байт. Busy-предикат — single-pass read (закрыт TOCTOU). Абсолютные пути плана в этом lane больше не режутся full-flow rejection.

В `prompts/SYSTEM.md` это теперь канон: ordinary top-level задача сама зовёт `delegate_start(root="skill_payload", …)` и сама супервизит снапшот. `schedule_subagent` сюда не годится — acting child не может открыть ещё одну payload-делегацию.

## UI: три действия, карточки делегирования и login

Общий модуль `web/modules/task_control_menu.js` отдаёт ровно три английские строки (product language policy): **Wrap up**, **Hurry up**, **Stop now**. Триггер всегда подписан `Stop…` и открывает меню — случайный клик не делает hard-stop. Пока cancel уже pending, в меню остаётся только **Stop now**. Тот же модуль едет в live-карточки чата и во вкладку Activity.

Рядом:

- expandable Skill Review cards (`web/modules/skill_review_card.js`) — в чат пишется компактная reference-строка, полный текст лениво с `GET /api/skills/{skill}/review-history/{job_id}`;
- harness login cards и Claudexor account surface;
- delegation / review cards.

Eligibility стоп-меню: host-attested `cancelable` + root (не subagent) + не reusable slot (`bg-consciousness` / `active`) + не finished/converted. In-process direct-chat ход с uuid, но без queue entry, кнопку не получает.

## Delegation-first экономика и planning swarm

System prompt переформулирован: для **любой** существенной работы — код, исследование, документы — дефолт это делегирование. Собственный `web_search` у harness-ребёнка оставлен для точечных lookup'ов; серия нативных поисковых раундов — ровно тот metered co-building, от которого nanny должна отучать.

Nanny-напоминание больше не ждёт 8 раундов / $2. Константы в `ouroboros/task_pacing.py`:

- `NANNY_FIRST_REMINDER_ROUNDS = 3` — первое напоминание, если не было ни одного delegate-verb (live E2E: дети за 4–8 раундов закрывали исследование нативно и не слышали nanny);
- после любой delegate-активности и на каждом re-arm снова `NANNY_REMINDER_ROUNDS = 8` / `NANNY_REMINDER_USD = 2.0`.

Сами заметки едут typed checkpoint'ами, а не спамом progress-warning'ов в owner chat. `delegate_wait` двигает только round-половину baseline, чтобы долларовая ось копилась между ожиданиями.

Отдельный шов planning swarm: если scout оседает `cancelled` до handoff (owner/parent cascade), волна выходит как `planning_scout_unavailable` — без платной reviewer-панели над мёртвой волной и без чужого finalize-эпизода владельца (`ouroboros/tools/plan_review.py`).

## Claudexor: login-owned daemon переживает сессию

Фикс custody логина (issues [#124](https://github.com/razzant/ouroboros/issues/124), [#151](https://github.com/razzant/ouroboros/issues/151)) в `ouroboros/gateway/claudexor_accounts.py` / `ouroboros/gateways/claudexor.py`:

- snapshot poll больше не оборачивает daemon envelope второй раз (был `job.job`);
- 404/410 по job — вердикт о **записи job**, не 503 «демон умер»; 409 на reconcile проходит как `setup_termination_unconfirmed` + `required_actions`;
- `POST /api/claudexor/login/{job_id}/reconcile` — отдельный тонкий proxy, который доказывает пустую process group неподтверждённого termination;
- login-owned daemon не убивается вместе с HTTP-сессией карточки.

Status-facet'ы (`catalog` / `accounts` / `quota`) читаются параллельно и независимо: отказ одного не обнуляет соседние и не публикует «пустой магазин» там, где чтение просто не состоялось (`ok` | `not_read` | `failed`).

## Что ещё вошло в 6.100.0…6.102.0

Не заголовок релиза, но в том же compare:

- systemd user unit `packaging/systemd/ouroboros.service`: `ExecStart=/opt/ouroboros/Ouroboros`, `KillMode=control-group`, `TimeoutStopSec=120`, без Restart= — launcher сам владеет crash fuse и panic;
- packaged CLI остаётся user-local (`ouroboros/packaged_cli_install.py`);
- managed tasks могут искать `runtime_data` ([#209](https://github.com/razzant/ouroboros/issues/209));
- LLM response-cache не переиспользуется на incomplete retry ([#202](https://github.com/razzant/ouroboros/pull/202));
- git rescue/rollback в `git_ops` ограничен timeout'ом ([#210](https://github.com/razzant/ouroboros/pull/210));
- exact-path repository size ratchets (`ouroboros/size_ratchet_manifest.py`, внутренний 6.101.0).

## Release proof

Релиз собран из [`ca75d909d7f3`](https://github.com/razzant/ouroboros/commit/ca75d909d7f39456f174c761fe4c46e8d800e3fa). Перед публикацией прошли полная test matrix, UI/Docker/skill/packaged-artifact smoke-тесты. `SHA256SUMS` покрывает все installable-артефакты, SBOM и smoke receipts; `release-evidence.json` связывает тег, коммит, workflow run, хэши и SBOM.

```bash
gh attestation verify <file> --repo razzant/ouroboros \
  --signer-workflow razzant/ouroboros/.github/workflows/ci.yml \
  --source-digest ca75d909d7f39456f174c761fe4c46e8d800e3fa \
  --source-ref refs/tags/v6.102.0
```

CycloneDX: тот же вызов плюс `--predicate-type https://cyclonedx.org/bom`.

## Кому стоит обновиться

Всем, кто гоняет длинные задачи в web UI и раньше мог только hard-stop: Wrap up даёт честный саммари с якорем на доставку контроля, Hurry up сжимает acceptance/improvement без убийства процесса. Авторам skills — payload теперь едет через тот же snapshot-delegate lane, что и внешние репозитории. Операторам Claudexor — login-демон и job-reconcile больше не разваливаются вместе с вкладкой.

## Как обновиться

Пакеты на [странице релиза](https://github.com/razzant/ouroboros/releases/tag/v6.102.0): `.dmg` (macOS 12+, Apple silicon), Windows x64 zip, `.deb` (Debian/Ubuntu/Astra), `.rpm` (Fedora/RHEL и отдельный RED OS 8), AppImage и `.tar.gz`. `SHA256SUMS`, `release-evidence.json`, `release-smoke-*.json` и `sbom-*.cdx.json` — это evidence, не установщики.

На Linux: `sudo apt install ./ouroboros_6.102.0_amd64.deb` или `sudo dnf install ./ouroboros-6.102.0-1.x86_64.rpm` (бинарник в `/opt/ouroboros`, `ouroboros` на `PATH`). Опционально — user systemd unit из `packaging/systemd/`. AppImage запускается из user-writable пути при установленном host Git.

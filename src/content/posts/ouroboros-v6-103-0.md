---
author: Артём Нецветаев
pubDatetime: 2026-08-17T12:57:00.000Z
title: "Ouroboros 6.103.0: plan review как spec-gate для INTENTION и общий OUROBOROS_REVIEW_MAX_CYCLES"
slug: ouroboros-v6-103-0
featured: false
draft: false
tags:
  - release
  - ouroboros
  - ai-agents
  - plan-review
  - self-evolving
description: "Разбор Ouroboros v6.103.0: plan_task ревьюит typed spec, хост считает GREEN/REVISE_PLAN, constitutional pack только при пути в system repo, OUROBOROS_REVIEW_MAX_CYCLES=2, удалены planning scouts и Atlas, плюс серверный in-flight индикатор чата."
---

[Ouroboros](https://github.com/razzant/ouroboros) — open-source self-creating AI-агент, который работает над внешними проектами, координирует рой саб-агентов и умеет переписывать собственную реализацию. 17 августа 2026 вышел минорный релиз [`v6.103.0`](https://github.com/razzant/ouroboros/releases/tag/v6.103.0): `plan_task` перестал быть генеративным «перепиши план» и стал одним органом ревью INTENTION — typed spec, findings-only ревьюеры, агрегат считает хост.

Это не pointer-only релиз: в body полный «What's new» плюс proof. Источники: [GitHub Release v6.103.0](https://github.com/razzant/ouroboros/releases/tag/v6.103.0), compare [`v6.102.0...v6.103.0`](https://github.com/razzant/ouroboros/compare/v6.102.0...v6.103.0) (16 коммитов, 95 файлов, +9112/−10265), итоговый коммит сборки [`aef0fc03e080`](https://github.com/razzant/ouroboros/commit/aef0fc03e080fd581c2b4976a4d8d310f3bde600). Главный коммит перестройки — [`d6210b1a050b`](https://github.com/razzant/ouroboros/commit/d6210b1a050b) («plan review becomes a domain-neutral spec gate»), добивка governance pack — [`bdbf062ddaf0`](https://github.com/razzant/ouroboros/commit/bdbf062ddaf0). Авторы релиза меряют self-modification plan review как ~$0.14 за волну против ~$3.5 раньше.

## `plan_task` ревьюит spec, а не конкурирующий план

Инструмент остаётся `plan_task`, но контракт другой (`ouroboros/tools/plan_review.py`). Два взаимоисключающих режима:

- ревью: `goal` + `plan` (проза, контекст) + `spec` (то, что судят);
- disposition: только `review_disposition` — ответ на findings уже записанной волны. Смешать поля нельзя: `ERROR: PLAN_REVIEW_DISPOSITION_MIXED_ENVELOPE`.

Схема spec (`_SPEC_SCHEMA`, нормализация в `ouroboros/tools/plan_spec.py::normalize_spec`) — домен-нейтральный объект. Спека без единого пути в файловой системе — first-class: код, слайды, литература, GUI-флоу или поездка проходят один и тот же орган.

```json
{
  "goal": "Сжать plan review до findings-only пакета",
  "plan": "Хост нормализует spec, ревьюеры отвечают массивом findings, агрегат считает хост.",
  "spec": {
    "in_scope": ["plan_task schema", "host aggregate"],
    "non_goals": ["ревьюер пишет альтернативный план"],
    "acceptance_claims": [
      {
        "claim": "blocking без валидного breaks хост демоутит в note",
        "priority": "must"
      }
    ],
    "invariants": ["хост не интерпретирует домен"],
    "decisions": [
      {
        "choice": "host-minted ids",
        "rejected": ["caller-chosen ids"],
        "why": "чужой id может перекрыть другой элемент или съехать между циклами"
      }
    ],
    "deferred": [
      {
        "what": "fetch URL как evidence",
        "why_safe_to_defer": "хост URL никогда не качает"
      }
    ],
    "affected_resources": ["ouroboros/tools/plan_review.py"],
    "evidence": ["docs/CHECKLISTS.md"]
  }
}
```

Неизвестное поле, пустой `goal`, decision без `choice` — `ERROR: PLAN_SPEC_INVALID`, ревьюер не вызывается. Списки режутся на `MAX_LIST_ITEMS = 40` (у `decision.rejected` — 8) с записью в `normalization_omissions`, без тихой обрезки.

## Host-minted ids — единственные валидные `breaks`

Идентификаторы чекаут-элементов чеканит хост позиционно: `claim_1..N`, `invariant_1..N`, `decision_1..N`, `deferred_1..N`. Id `goal` зарезервирован для намерения целиком (D32) — даже spec без claims может получить blocking. Если агент прислал свой `id`, он сохраняется рядом как `declared_id`, но `breaks` смотрит только на minted.

Ревьюер возвращает массив findings трёх классов: `blocking` | `note` | `need_evidence`. Пустой массив легитимен только с sentinel `NO_FINDINGS`. Структурная валидация (`validate_findings`) — shape/membership, не домен:

- `blocking` без `breaks ∈ spec_ids` → демоут в `note` (`blocking_without_valid_breaks`);
- `need_evidence` без `locator` или повтор того же locator в per-task памяти → демоут в `note` (повтор не дропают: иначе волна стала бы GREEN);
- finding без `summary` не выкидывают — подставляют `(missing summary)`.

Правило высоты в пакете и в `docs/CHECKLISTS.md`: blocking только если ошибка _после старта работы_ инвалидирует уже сделанное, нарушит commitment или сделает acceptance claim непроверяемым. Недостающее evidence, из-за которого claim структурно неверифицируем, — это `blocking` с `breaks=<claim id>`, не `need_evidence`.

## Агрегат считает хост, не ревьюер

`plan_spec.aggregate` принимает слоты `{slot, model, ok, findings, error?}` и `adaptive_quorum`. Ревьюер не эмитит GREEN и не пишет конкурирующий план.

| условие                                      | вердикт                                                           |
| -------------------------------------------- | ----------------------------------------------------------------- |
| parseable слотов < quorum                    | `DEGRADED` (волна не закрывается disposition'ом, её переигрывают) |
| blocking-слотов ≥ quorum                     | `REVISE_PLAN`                                                     |
| есть любые findings, но blocking ниже quorum | `REVIEW_REQUIRED`                                                 |
| пустые findings                              | `GREEN`                                                           |

Один слот идёт с `adaptive_quorum(1) == 1` и громкой причиной `single_reviewer_no_diversity`. Findings плющатся как `finding_id = "<slot>:<id>"`.

Закрытие (`closure_after_disposition`):

- `GREEN` — закрыто;
- `REVIEW_REQUIRED` — закрывается disposition'ом `accept|reject|defer` + rationale, без новой оплаты;
- `REVISE_PLAN` disposition'ом **не** закрывается: accept требует изменённый spec (следующий платный цикл), полный reject волны даёт ровно один платный delta-цикл;
- под `blocking` enforcement открытая волна держит имплементацию (`owner_hurry.force_plan_decision`);
- `advisory` не переключает `closed` — можно идти дальше, хост громко раскрывает, что ревью открыто.

Идентичный конверт (fingerprint из goal + prose + канонической spec + `evidence_manifest_hash` + `constitutional`) переигрывается бесплатно. Exploration log в fingerprint не входит.

## Один структурный факт: `constitutional`

`resolve_constitutional` смотрит **только** path-локаторы в `affected_resources` и `evidence`. True, если хоть один резолвится в system repo (или под ним). Сам факт, что active workspace = system repo, конституционным план не делает (D29): надо объявить путь. URL и `task:` никогда не поднимают флаг. Skill-payload пути под `payload_roots` исключены — это data plane, даже если физически лежат внутри репозитория.

Нюанс existence: путь в `affected_resources` считается, даже если файла ещё нет (`ouroboros/new_module.py` — уже self-modification). Тот же путь только в `evidence` и не существующий на диске — skip с раскрытием, pack не тащится.

Governance pack (W3, `plan_packet.build_plan_review_system_prompt`):

- constitutional: полный `BIBLE.md` **и** полный `docs/ARCHITECTURE.md`. Пустой документ — typed `PlanPacketError`, не тихая дыра. Retrieving (`agent_session`) ревьюер читает оба файла своими инструментами; api-ревьюер получает их inline;
- все остальные планы: navigation map обоих документов + named pointers. Нужен полный текст — `need_evidence` с locator, хост приложит на следующем цикле.

В BIBLE P3 одна новая граница: scope floor вяжет ревьюера CHANGE; ревьюер INTENTION несёт constitutional pack, только если план касается собственного тела Ouroboros, плюс declared/requested evidence — каждое отсутствие по имени.

## Evidence: bounded, с именованными дырами, без data plane

`ouroboros/tools/plan_evidence.py::resolve_evidence`:

- per-item 40 000 байт, всего 120 000, источник > 8 МиБ не читается (`too_large:<bytes>`);
- URL перечисляются, не фетчатся;
- бинарь / невалидный UTF-8 → omission `binary`;
- `allowed_roots` = active workspace + system repo;
- `_evidence_deny_paths` режет runtime data plane (`DATA_DIR`, canonical drive) и живой `SETTINGS_PATH` — даже если operator subject root стоит уровнем выше.

Секреты в именах/расширениях идут через `_SENSITIVE_*`. Агентские сессии видят тот же redacted snapshot, что и пакет.

Хост сам докладывает locators из прошлых `need_evidence` (память `MAX_NEED_EVIDENCE_MEMORY = 160`). Это меняет envelope, поэтому следующий вызов — уже не бесплатный replay.

## `OUROBOROS_REVIEW_MAX_CYCLES`: одна ручка на три гейта

Новый shared owner setting, строка `"N"` или `"unlimited"` (алиасы `inf` / `∞`). Дефолт `"2"`. Тип нарочно строковый: int-дефолт проглотил бы `"unlimited"` в `_coerce_setting_value`. Битый ввод fail-closed на дефолт с одним warning на процесс.

Смысл одного числа (`ouroboros/review_cycles.py`):

| гейт            | что считает                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| plan review     | оплаченные reviewer-panel циклы на задачу                                                                        |
| task acceptance | `passes = cycles − 1` (дефолт 2 → историческая 1 improvement pass)                                               |
| commit gate     | подряд идущие блоки **байт-идентичного** staged diff до отказа тратить ещё triad+scope (было хардкод 3, стало 2) |

UI: сегменты `1 / 2 / 3 / 5 / ∞` (`web/modules/settings.js`, `#s-review-max-cycles`). `POST /api/settings` валидирует через `is_valid_review_max_cycles` и канонизирует алиасы; мусор — `400`.

Старый `OUROBOROS_ACCEPTANCE_MAX_IMPROVEMENT_PASSES` в `RETIRED_SETTING_KEYS`. При load, если passes ≠ 1 (нетронутый исторический дефолт) и новой ручки ещё нет, пишется `cycles = passes + 1`. Значение, жившее только в env и никогда не сохранённое, больше не биндится.

Исчерпанный cap под blocking: typed событие `review_cycles_exhausted` в `logs/events.jsonl`, попытка `status=cycles_exhausted`, терминал `blocked_with_evidence`. Честные выходы — owner unstick или этот терминал, не молчаливый GREEN.

## Что выкинули

Вместе со scouts/Atlas ушла генеративная стойка ревьюера. `ouroboros/tools/review_synthesis.py` больше не собирает plan-review mega-pack: для plan engine остались control-line prefix, input-cap helpers и cache-friendly message pair. Синтез claims остался у commit-review.

Удалены явно:

- planning scouts и adaptive swarm wait (`tests/test_planning_swarm_adaptive_wait.py` снят целиком);
- plan Atlas и поля `plan_class` / `context_level`;
- hidden 32-wave лимит;
- pin «только `api_chat`»;
- settings `OUROBOROS_PLAN_TASK_SWARM_TIMEOUT_SEC`, `*_MAX_WAIT_SEC`, `*_HEARTBEAT_STALE_SEC`.

Checklist переписан findings-only вокруг одного вопроса: «достаточна ли SPEC, чтобы _начать_ работу безопасно?» — не «всё ли специфицировано».

## In-flight индикатор прямого чата

Не заголовок релиза, но в том же compare ([#227](https://github.com/razzant/ouroboros/pull/227)): сервер — authority для «сейчас думаю», без фейковых queue records.

`supervisor/active_activity.py` держит process-local `DirectActivityRegistry` (`kind`: `direct_chat` | `ephemeral_decision`, `phase`, `activity_id`, `client_message_id`). Воркер оборачивает ход в `track_direct_activity(...)` и сразу шлёт WS `typing` с теми же полями — клиентский `Sending...` снимается этим кадром, а не эхом сокета.

`GET /api/state` отдаёт `active_direct_turns`. Клиент гидрирует карту через `computeHydratedDirectActivities`: snapshot авторитетен только для registry-tracked kind'ов, заведённых до barrier; turn, который клиент уже заключил keyed final, snapshot не воскрешает. Статус-строка (`computeDerivedChatStatus`): live card → `Working...`; `activeDirectCount > 0` → `Thinking...`; pending submit → `Sending...`.

## Что ещё в 6.102.0…6.103.0

- Managed Claudexor runtime последовательно запинен на 3.4.0 → 3.4.1 → **3.4.2** (`ouroboros/claudexor_runtime_pin.json`, `build_sha=9b3adc2176f0`, Node 24.16.0) — PR [#223](https://github.com/razzant/ouroboros/pull/223), [#225](https://github.com/razzant/ouroboros/pull/225), [#231](https://github.com/razzant/ouroboros/pull/231).
- Промпт `prompts/SYSTEM.md`: read-only ребёнок владеет `delegate_start` / `wait` / `answer` / `cancel`, но хост выводит доступ из authority ребёнка — только READ-ONLY harness. Skill-payload по-прежнему мутирует только top-level `delegate_start(root="skill_payload", …)`; ребёнок не открывает payload-делегацию ([#224](https://github.com/razzant/ouroboros/pull/224)).
- Windows-флаки в тайминговых тестах сделаны детерминированными.

## Release proof

Релиз собран из [`aef0fc03e080`](https://github.com/razzant/ouroboros/commit/aef0fc03e080fd581c2b4976a4d8d310f3bde600). Перед публикацией прошли полная test matrix, UI/Docker/skill/packaged-artifact smoke-тесты. `SHA256SUMS` покрывает все installable-артефакты, SBOM и smoke receipts; `release-evidence.json` связывает тег, коммит, workflow run, хэши и SBOM.

```bash
gh attestation verify <file> --repo razzant/ouroboros \
  --signer-workflow razzant/ouroboros/.github/workflows/ci.yml \
  --source-digest aef0fc03e080fd581c2b4976a4d8d310f3bde600 \
  --source-ref refs/tags/v6.103.0
```

CycloneDX: тот же вызов плюс `--predicate-type https://cyclonedx.org/bom`.

## Кому стоит обновиться

Всем, у кого `plan_task` ещё зовёт scouts / Atlas / generative reviewer: контракт сломан намеренно — ревьюер больше не автор плана и не источник GREEN. Операторам с кастомным `OUROBOROS_ACCEPTANCE_MAX_IMPROVEMENT_PASSES` — проверить, что значение уехало в `OUROBOROS_REVIEW_MAX_CYCLES` (`passes + 1`); env-only наследие больше не действует. Владельцам длинных self-mod планов — constitutional pack теперь дешевле и уже, но путь в system repo нужно **объявить** в `affected_resources`. Пользователям web-чата — индикатор хода больше не врёт «Online», пока сервер ещё думает.

## Как обновиться

Пакеты на [странице релиза](https://github.com/razzant/ouroboros/releases/tag/v6.103.0): `.dmg` (macOS 12+, Apple silicon), Windows x64 zip, `.deb` (Debian/Ubuntu/Astra), `.rpm` (Fedora/RHEL и отдельный RED OS 8), AppImage и `.tar.gz`. `SHA256SUMS`, `release-evidence.json`, `release-smoke-*.json` и `sbom-*.cdx.json` — это evidence, не установщики.

На Linux: `sudo apt install ./ouroboros_6.103.0_amd64.deb` или `sudo dnf install ./ouroboros-6.103.0-1.x86_64.rpm` (бинарник в `/opt/ouroboros`, `ouroboros` на `PATH`). AppImage запускается из user-writable пути при установленном host Git.

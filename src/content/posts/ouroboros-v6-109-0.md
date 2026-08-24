---
author: Артём Нецветаев
pubDatetime: 2026-08-24T02:40:00.000Z
title: "Ouroboros 6.109.0: живая стоимость задач «на лету» и пробуждение агента при открытии Agents"
slug: ouroboros-v6-109-0
featured: false
draft: false
tags:
  - release
  - ouroboros
  - ai-agents
  - cost-accounting
description: "Разбор Ouroboros v6.109.0: live-root cost projection для Chat/Activity карточек (единый итог cost_usd_with_children через существующий heartbeat, новая честная обработка unknown-zero через honest_accounted_amount), пробуждение бездействующего Claudexor-демона при активации вкладки Agents (onActivate в bindStatusSurface) и fail-closed фикстуры staged-binary review."
---

[Ouroboros](https://github.com/razzant/ouroboros) выпустил минорный релиз [`v6.109.0`](https://github.com/razzant/ouroboros/releases/tag/v6.109.0) (21 августа 2026). Ряд небольших, но заметных UX-изменений в трекинге стоимости задач и в работе встроенного агентного демона Claudexor, плюс правка тестовых фикстур (без изменения production-поведения).

Основа статьи — GitHub Release [`v6.109.0`](https://github.com/razzant/ouroboros/releases/tag/v6.109.0), PR [#288](https://github.com/razzant/ouroboros/pull/288) и [#289](https://github.com/razzant/ouroboros/pull/289), а также compare [`v6.108.1...v6.109.0`](https://github.com/razzant/ouroboros/compare/v6.108.1...v6.109.0).

## Живая стоимость корневой задачи прямо на карточках

[PR #288](https://github.com/razzant/ouroboros/pull/288) убирает главную недоработку прошлых версий: стоимость **запущенной** корневой задачи (root task) обновлялась на компактных карточках Chat/Activity только после завершения очередного heartbeat-цикла, и для показа требовалось отдельное суммирование «своей» и «поддерева» частей. Теперь running-корневой heartbeat проецирует уже существующий физический журнал попыток (physical-attempt ledger) в единый, ещё не финальный итог поддерева — и карточки обновляются «на лету», **без** второго таймера, отдельного эндпоинта или клиентского суммирования.

Ключевая функция — `live_root_cost_projection()` в `ouroboros/cost_projection.py`. Она вычисляет lineage задачи, вызывает `usage_projection()` для корня и собирает projection:

```python
projection = {
    "cost_accounting_status": "available",
    "cost_usd_with_children": round(accounted, 6) if accounted is not None else None,
    "reserved_usd": reserved,
    "unresolved_upper_bound_usd": unresolved,
    "unknown_unmetered": unknown,
    "non_final_rows": int(usage.get("non_final_rows") or 0),
    "ledger_integrity_degraded": bool(usage.get("integrity_degraded")),
}
projection.update(cost_final=False, cost_with_children_partial=True)
```

В `supervisor/events.py` (`_handle_task_heartbeat`) эти поля теперь раскрываются прямо в heartbeat-логу через `**cost_fields`, поэтому клиент получает их в том же сообщении, что и прогресс.

### Честное обращение с «нулём»

Главная нюансная часть — новая функция `honest_accounted_amount()`. Проблема, которую она решает: в физическом журнале `accounted_usd` — это «урегулированная + резервная/неразрешённая» сумма, и у внешней строки или строки с неизвестной ценой итог может быть `0.0` при положительном `unknown_unmetered`. Такой `0` — **не** измеренный бесплатный результат, и выдавать его за факт нельзя. Правило: если субтотал равен нулю, но есть неизвестные метрики (`unknown_unmetered > 0`) и нет резерва/неразрешённого, возвращается `None` (неизвестно), а не `0.0`.

```python
def honest_accounted_amount(source):
    amount = _as_amount(source.get("accounted_usd"))
    if amount is None:
        return None
    unknown = int(source.get("unknown_unmetered") or 0)
    reserved = float(source.get("reserved_usd") or 0)
    unresolved = float(source.get("unresolved_upper_bound_usd") or 0)
    if amount == 0 and unknown > 0 and reserved == 0 and unresolved == 0:
        return None  # открытый ноль ≠ бесплатно
    return amount
```

Эта же функция теперь используется и в «терминальном» пути (`_authoritative_terminal_cost` в `supervisor/events.py`, `_task_cost_breakdown_view` в `ouroboros/gateway/tasks.py`): раньше там стояло `round(float(subtree.get("accounted_usd") or 0.0), 6)`, которое превращало неизвестный/пустой субтотал в `0.0`; теперь `honest_accounted_amount(subtree)` даёт `None`, и значение `cost_usd_with_children` может быть `null`.

### Клиент: одна сумма вместо «своя + поддерево»

В `web/modules/chat_activity.js` функция `taskCostMeta()` переработана: компактные карточки показывают **один** итог. Приоритет у subtree-проекции, при её отсутствии — fallback на «свою» часть:

```js
const total = accountedUpperBoundWithChildren(payload) ?? own;
const finalKnown =
  payload.cost_final === true && payload.cost_with_children_partial !== true;
```

Раньше рендерились раздельные метки `cost=$X` и `subtree=$Y`; теперь — одна `cost=$X (pending)`. Условие **final** смягчено и в `taskCostProjection()`: итог считается финальным только если он settled (не передвигался), то есть `cost_final === true && cost_with_children_partial !== true`. Это закрывает ситуацию, когда транзитный сбой чтения журнала однажды пометил бы результат финальным вопреки более поздним реальным чтениям.

В `web/modules/costs.js` добавлена `costBucketPresentation(info)` — для legacy bucket-видов она рендерит `cost pending (unmetered=N)`, `$X (pending, unmetered=N)` и т.п., не превращая открытый ноль в бесплатное.

## Пробуждение Claudexor при открытии Agents

[PR #289](https://github.com/razzant/ouroboros/pull/289) закрывает UX-дыру: после перезапуска Ouroboros вкладка **Settings > Agents** оставалась недоступной, потому что owned-демон Claudexor стартует лениво (session-scoped), а статусный GET намеренно read-only и не будит его. Раньше владельцу, которому нужно было просто увидеть свои аккаунты, приходилось запускать login job или делегированный ран.

Теперь явная активация вкладки Agents трактуется как owner-действие, которое может разбудить **уже provisioned** простаивающий демон:

1. сначала — свежее (side-effect-free) чтение статуса;
2. затем — wake через существующий endpoint `api_claudexor_wake`, но **только** для состояния `stale + runtime.ready + нет ownership_problem`.

Первая установка, обновление, repair и foreign ownership остаются за кнопкой Connect; фоновый polling остаётся без side-эффектов. Во время wake UI показывает `Starting the agent daemon…`, а после — обновлённые аккаунты.

Со стороны клиента добавлен необязательный параметр `onActivate` в `bindStatusSurface()` (`web/modules/claudexor_status_store.js`). По умолчанию активация вкладки делала `store.refresh({ includeModels })`; теперь можно подменить это действие, чтобы выполнить owner-action wake:

```js
bindStatusSurface(store, {
  elementId: "agents-surface",
  includeModels: false,
  onActivate: () => store.wakeOwnerDaemon(), // owner-action вместо refresh
});
```

Список событий-активации `SURFACE_ACTIVATION_EVENTS` не изменился (`ouro:page-shown`, `ouro:settings-subtab-changed` и т.д.), меняется только то, что делает обработчик.

## Тестовые фикстуры (без изменения production)

Третья правка — fail-closed fixtures для staged-binary review: теперь они инжектируют **точные ошибки чтения Git-дерева** вместо предположения о loose-object хранилище. Это убирает race в macOS stable-CI, но не меняет production-поведение, поэтому релиз обошёлся опубликованным набором проверок: полная тестовая матрица + UI/Docker/skill/artifact smoke tests.

## Ссылки

- Релиз: [`v6.109.0`](https://github.com/razzant/ouroboros/releases/tag/v6.109.0)
- Compare: [`v6.108.1...v6.109.0`](https://github.com/razzant/ouroboros/compare/v6.108.1...v6.109.0) (10 commits)
- PR [#288](https://github.com/razzant/ouroboros/pull/288) «Show live aggregate task cost»
- PR [#289](https://github.com/razzant/ouroboros/pull/289) «Wake Claudexor when Agents opens»

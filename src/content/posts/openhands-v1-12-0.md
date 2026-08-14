---
author: Артём Нецветаев
pubDatetime: 2026-08-14T22:58:12.000Z
title: "OpenHands 1.12.0: free-бейджи и подписи для OpenHands model endpoints"
slug: openhands-v1-12-0
featured: false
draft: false
tags:
  - release
  - openhands
  - ai-agents
  - canvas
  - llm
  - ui
description: "Разбор OpenHands v1.12.0: централизованный список free OpenHands routes (glm-5.2, deepseek-v4-flash, minimax-m2.7), Free-бейджи в model selector, display-only labels в chat/profiles/slash commands и prefill free default при создании LLM profile."
---

[OpenHands](https://github.com/OpenHands/OpenHands) выпустил минорный релиз [`v1.12.0`](https://github.com/OpenHands/OpenHands/releases/tag/v1.12.0) (7 августа 2026). Это узкий Canvas/Agent Canvas релиз про читаемость free LLM endpoints: UI явно помечает, какие OpenHands-routed модели бесплатны, и не даёт спутать их с одноимёнными endpoint'ами других провайдеров.

Основа статьи — GitHub Release [`v1.12.0`](https://github.com/OpenHands/OpenHands/releases/tag/v1.12.0), compare [`v1.11.0...v1.12.0`](https://github.com/OpenHands/OpenHands/compare/v1.11.0...v1.12.0) и исходный [PR #16281](https://github.com/OpenHands/OpenHands/pull/16281) (`feat: clarify free OpenHands model endpoints`). В диапазоне два коммита: feature merge `7d897d76` и release-please bump `4d0fe498`. Pin в `config/defaults.json`: `agentCanvas` `1.11.0` → `1.12.0`; `agentServer` остаётся `1.40.1`, `automation` — `1.6.0`.

## Зачем это нужно

Бесплатны только OpenHands-routed endpoints. Пользователь мог выбрать `openhands/glm-5.2`, а рядом видеть похожие id у других провайдеров (`openai/glm-5.2` и т.п.) без явного free-статуса — и не понимать, что billing path разный. Free status не держался визуально после выбора модели.

[PR #16281](https://github.com/OpenHands/OpenHands/pull/16281) — **display-only UI guidance**: stored model IDs и routing не меняются. Меняются labels, badges и note в selector'е.

## Центральный allowlist free routes

Новый контракт живёт в `src/utils/format-model-name.ts`:

```ts
export const FREE_MODEL_BADGE_LABEL = "Free";

export const FREE_OPENHANDS_MODELS = {
  "openhands/glm-5.2": "OpenHands GLM-5.2 (free)",
  "openhands/deepseek-v4-flash": "OpenHands DeepSeek V4 Flash (free)",
  "openhands/minimax-m2.7": "OpenHands MiniMax M2.7 (free)",
} as const;

export const FREE_OPENHANDS_MODEL_IDS = Object.keys(FREE_OPENHANDS_MODELS);

export const FREE_OPENHANDS_MODEL_NOTE = `Free OpenHands models: ${FREE_OPENHANDS_MODEL_IDS.join(
  ", "
)}. Other provider endpoints with similar model names may require separate billing.`;

export const isFreeOpenHandsModel = (
  model: string | null | undefined
): model is keyof typeof FREE_OPENHANDS_MODELS =>
  Boolean(model && model in FREE_OPENHANDS_MODELS);
```

Helpers:

| Function                                             | Behavior                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `formatModelNameForDisplay(model)`                   | free OpenHands id → human label `OpenHands … (free)`; иначе исходная строка      |
| `formatProviderModelNameForDisplay(provider, model)` | собирает `provider/model` и применяет тот же allowlist                           |
| `formatNativeModelName(model)`                       | **сначала** free-label; иначе strip provider prefix до last segment (как раньше) |
| `isFreeOpenHandsModel(model)`                        | exact match на ключи `FREE_OPENHANDS_MODELS`                                     |

Важно: free только при полном route id с провайдером `openhands/…`. Тесты фиксируют negative case:

```ts
expect(formatModelNameForDisplay("openai/glm-5.2")).toBe("openai/glm-5.2");
expect(isFreeOpenHandsModel("openai/glm-5.2")).toBe(false);
```

То есть `glm-5.2` у другого provider **не** получает Free badge и не переписывается в «OpenHands GLM-5.2 (free)».

## Model selector: Free badge + orange note

`src/components/shared/modals/settings/model-selector.tsx` для provider `openhands`:

1. В combobox у verified models рядом с именем рендерится orange pill `Free`, если `isFreeOpenHandsModel(\`${selectedProvider}/${model.name}\`)`.
2. После выбора free model рядом с value input остаётся badge `selected-free-model-badge` — позиция через measure + `ResizeObserver`, чтобы badge стоял сразу после текста model id, а не «где-то справа».
3. Под полем модели — `FreeOpenHandsModelsNote` (`data-testid="openhands-free-models-note"`) с текстом `FREE_OPENHANDS_MODEL_NOTE`, то есть явным списком:
   - `openhands/glm-5.2`
   - `openhands/deepseek-v4-flash`
   - `openhands/minimax-m2.7`

На экране LLM settings (`src/routes/llm-settings.tsx`) note показывается, когда текущий `modelValue` сам free (`isFreeOpenHandsModel(modelValue)`), рядом с OpenHands API key help.

Badge styling (warning/orange):

```ts
const freeModelBadgeClassName =
  "shrink-0 rounded-full border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] leading-none text-warning";
```

## Display labels по всему Canvas surface

Один и тот же `formatModelNameForDisplay` подключён в нескольких UI path'ах, чтобы free route выглядел одинаково:

| Surface                                       | File                                | Что видит пользователь                                          |
| --------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| Chat LLM profile picker                       | `chat-input-llm-profile-picker.tsx` | `OpenHands GLM-5.2 (free)` вместо raw `openhands/glm-5.2`       |
| Profile diagnostics / ModelMessages           | `model-messages.tsx`                | `model: OpenHands GLM-5.2 (free)` в expanded details            |
| Conversation card chip                        | через `formatNativeModelName`       | chip text free-label; `title` остаётся raw id                   |
| LLM profiles list row                         | `profile-row.tsx`                   | display label + `title={profile.model}` (raw id для copy/hover) |
| Slash `/model` suggestions                    | `use-slash-command.ts`              | `Switch to OpenHands GLM-5.2 (free)`                            |
| App settings title-generation profile options | `app-settings.tsx`                  | option label использует display model name                      |

Raw stored id **не** переписывается: chip/profile row держат `title="openhands/glm-5.2"`, а badge/label — presentation layer.

## Create LLM profile: prefill free default

В `llm-settings-local-view.tsx` create mode больше не стартует с пустым `llm.model`. Вместо empty fields форма prefills Canvas free default:

```ts
// Create mode: prefill the model with Canvas' free default,
// while keeping secret/base URL fields blank for a fresh profile.
{
  "llm.model": DEFAULT_SETTINGS.llm_model, // "openhands/glm-5.2"
  "llm.api_key": "",
  "llm.base_url": "",
  // ...
}
```

Тесты create flow ожидают:

- profile name auto-derived → `glm-5.2`;
- model input → `openhands/glm-5.2`;
- повторный вход в create mode снова даёт fresh form с тем же free default, а не пустые поля и не значения из edit mode.

Это стыкуется с default model из 1.10.0 (`DEFAULT_SETTINGS.llm_model = "openhands/glm-5.2"`): новый profile сразу попадает на бесплатный OpenHands route, а UI помечает его как free.

## Как проверить у себя

1. Открыть LLM settings → provider **OpenHands**.
2. В combobox model увидеть Free badges у `glm-5.2`, `deepseek-v4-flash`, `minimax-m2.7`.
3. Выбрать free model — badge остаётся рядом с selected value; note перечисляет free ids.
4. Создать новый LLM profile — model prefills `openhands/glm-5.2`, name `glm-5.2`.
5. В chat profile menu / conversation chip / `/model` suggestions увидеть label вида `OpenHands GLM-5.2 (free)`.

## Кого это касается

- Пользователей OpenHands provider в Canvas, которые выбирают free endpoints и раньше путались с похожими model names у других провайдеров.
- Тех, кто смотрит model id в chat profile picker, conversation chips, profile list и slash `/model`.
- Авторов новых LLM profiles: create form больше не «пустая», а стартует с free default.

Не breaking change для saved preferences/routing: stored ids прежние, меняется только presentation + create-mode prefill model field.

## Ссылки

- Release: [v1.12.0](https://github.com/OpenHands/OpenHands/releases/tag/v1.12.0)
- Compare: [v1.11.0...v1.12.0](https://github.com/OpenHands/OpenHands/compare/v1.11.0...v1.12.0)
- PR: [#16281](https://github.com/OpenHands/OpenHands/pull/16281)

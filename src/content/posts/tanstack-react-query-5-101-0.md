---
author: Артём Нецветаев
pubDatetime: 2026-06-28T18:33:38.000Z
title: "TanStack React Query 5.101.0: синхронный релиз без новых React API"
slug: tanstack-react-query-5-101-0
featured: false
draft: false
tags:
  - release
  - tanstack
  - react-query
description: "Обзор релиза @tanstack/react-query 5.101.0: React-пакет обновляет @tanstack/query-core до 5.101.0, выравнивает devtools/persist-пакеты и не меняет API хуков."
---

TanStack выпустил [`@tanstack/react-query@5.101.0`](https://github.com/TanStack/query/releases/tag/%40tanstack/react-query%405.101.0). Несмотря на минорный номер `5.101.0`, это не релиз с новым React-facing API: официальный release body для React-пакета содержит один пункт — обновление зависимости `@tanstack/query-core` до `5.101.0`.

Источник для обзора — GitHub Release [`@tanstack/react-query@5.101.0`](https://github.com/TanStack/query/releases/tag/%40tanstack/react-query%405.101.0), release PR [#10774](https://github.com/TanStack/query/pull/10774) и compare `@tanstack/react-query@5.100.14...@tanstack/react-query@5.101.0`. В compare нет изменений в `packages/react-query/src/`: версия пакета поднята, примеры и соседние пакеты в release train переведены с `5.100.14` на `5.101.0`.

## Что реально меняется для React Query

Главное практическое действие для пользователя React Query — поставить согласованные версии пакетов из одной release train. Сам `@tanstack/react-query` по-прежнему экспортирует тот же набор React-хуков и компонентов; изменение в release body выглядит именно как dependency bump:

```json
{
  "dependencies": {
    "@tanstack/query-core": "5.101.0"
  }
}
```

Если проект использует только React Query без devtools и persistence-адаптеров, обновление выглядит обычным bump'ом:

```bash
pnpm add @tanstack/react-query@5.101.0
```

Если вместе с React Query подключены devtools или persist client, лучше обновить их в той же команде, чтобы не смешивать `5.100.x` и `5.101.x` внутри одного приложения:

```bash
pnpm add \
  @tanstack/react-query@5.101.0 \
  @tanstack/react-query-devtools@5.101.0 \
  @tanstack/react-query-persist-client@5.101.0
```

Это не миграция API: в `packages/react-query/package.json` у релиза остался тот же `peerDependencies.react: "^18 || ^19"`, те же ESM/CJS export paths и та же зависимость на `@tanstack/query-core` как workspace-пакет. Менять вызовы `useQuery`, `useMutation`, `useInfiniteQuery`, `QueryClientProvider` или `HydrationBoundary` из-за самого `5.101.0` не требуется.

## Почему релиз всё равно попал в minor-очередь

У TanStack Query монорепозиторий и синхронная release train: несколько пакетов получают близкие версии одновременно. В PR [#10774](https://github.com/TanStack/query/pull/10774) для `@tanstack/react-query@5.101.0` указан только dependency update, но рядом в том же релизном PR есть изменения для соседних пакетов.

Для React-проектов особенно заметны три соседних пункта:

- `@tanstack/react-query-devtools@5.101.0` подтягивает `@tanstack/query-devtools@5.101.0` и `@tanstack/react-query@5.101.0`;
- `@tanstack/react-query-persist-client@5.101.0` подтягивает `@tanstack/query-persist-client-core@5.101.0` и `@tanstack/react-query@5.101.0`;
- `@tanstack/react-query-next-experimental@5.101.0` заменяет deprecated `isServer` на `environmentManager.isServer()` внутри Next experimental-пакета.

То есть `5.101.0` важен прежде всего как точка синхронизации пакетов: React-адаптер, devtools, persist client, Next experimental package и core опубликованы в одной серии.

## Devtools: два исправления, которые доходят до React через dependency chain

Release PR связывает `@tanstack/react-query-devtools@5.101.0` с двумя изменениями в `@tanstack/query-devtools@5.101.0`:

1. [#10772](https://github.com/TanStack/query/pull/10772) — devtools query rows больше не должны падать, если состояние кешированного query временно недоступно.
2. [#10750](https://github.com/TanStack/query/pull/10750) — строки devtools теперь резолвятся через стабильный query hash, поэтому мутированные object query keys не ломают отрисовку строки.

Это не добавляет новый prop к `ReactQueryDevtools`, но влияет на приложения, где devtools открываются поверх активного кеша с нестабильными или мутируемыми query keys. Практическая рекомендация остаётся прежней: обновлять devtools вместе с React Query, а не оставлять `@tanstack/react-query-devtools@5.100.x` рядом с `@tanstack/react-query@5.101.0`.

## Next experimental: уход от deprecated `isServer`

Для пользователей `@tanstack/react-query-next-experimental` в этом релизном наборе есть отдельный fix: пакет заменяет deprecated `isServer` на `environmentManager.isServer()` ([#10857](https://github.com/TanStack/query/pull/10857)). Это внутреннее изменение experimental-интеграции, поэтому пользовательский код с обычным провайдером остаётся таким же:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* routes / app */}
    </QueryClientProvider>
  );
}
```

Если проект использует Next experimental-пакет, обновлять его стоит вместе с `@tanstack/react-query`, потому что release body для `@tanstack/react-query-next-experimental@5.101.0` прямо указывает dependency update до `@tanstack/react-query@5.101.0`.

## ESLint-плагин: единственный minor API в этой release train

Минорный пользовательский пункт в PR [#10774](https://github.com/TanStack/query/pull/10774) относится не к `@tanstack/react-query`, а к `@tanstack/eslint-plugin-query@5.101.0`. Правило `no-rest-destructuring` теперь умеет ругаться не только на прямой результат `useQuery`, но и на кастомные хуки, которые возвращают результат TanStack Query. В release PR отдельно сказано, что это работает через TypeScript type checker и только при включённом typed linting; проекты без typed linting не затрагиваются.

Пример того, что теперь может попасть под правило при typed linting:

```tsx
function useTodos() {
  return useQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
  });
}

const { data, ...queryState } = useTodos();
```

Смысл правила прежний: rest destructuring может подписать компонент на большее число полей результата, чем реально нужно, и тем самым ухудшить точечные обновления. Более безопасный вариант — выбирать конкретные поля:

```tsx
const todosQuery = useTodos();
const todos = todosQuery.data;
const isFetching = todosQuery.isFetching;
```

## Итог

`@tanstack/react-query@5.101.0` — это аккуратный синхронный релиз без новых React-хуков, props или breaking changes в React-адаптере. Обновление имеет смысл как выравнивание версии `@tanstack/query-core` и соседних пакетов: devtools получают два исправления стабильности строк, Next experimental уходит от deprecated `isServer`, а ESLint-плагин расширяет `no-rest-destructuring` на кастомные хуки при typed linting.

Если вы ждёте новый API именно в React Query, в `5.101.0` его нет. Если вы поддерживаете набор `react-query + devtools + persist + eslint-plugin-query`, этот релиз лучше ставить целиком одной версией `5.101.0`.

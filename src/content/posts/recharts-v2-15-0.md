---
author: Артём Нецветаев
pubDatetime: 2026-08-22T16:20:00.000Z
title: "Recharts 2.15.0: React 19 в peerDependencies, удаление deprecated ReactText и фикс типов mouse-событий у Bar"
slug: recharts-v2-15-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Recharts 2.15.0 (minor): React 19 добавлен в peerDependencies для react и react-dom (с оговоркой про react-is), удалён deprecated тип ReactText (tickFormatter и strokeDasharray теперь string | number), а типы mouse-событий у Bar снова используют any."
---

Recharts 2.15.0 (minor) — небольшой релиз, который, по словам авторов, закрывает тему React 19 на ветке `2.x`: React 19 официально попадает в `peerDependencies`, удаляется deprecated тип `ReactText`, и правятся регрессия типов mouse-событий у `Bar`. Формально это «final 2.x React 19 support» — полное избавление от оговорки про `react-is` ожидается уже в 3.0.

Источник — [GitHub Release `recharts/recharts@v2.15.0`](https://github.com/recharts/recharts/releases/tag/v2.15.0) и [сравнение с v2.14.1](https://github.com/recharts/recharts/compare/v2.14.1...v2.15.0). В compare всего 3 коммита: [PR #5324](https://github.com/recharts/recharts/pull/5324) (React 19 в peerDeps + удаление `ReactText`), [PR #5351](https://github.com/recharts/recharts/pull/5351) (фикс типов событий `Bar`) и коммит-версия `2.15.0`. Детали проверены по diff-ам этих PR. Обычный changelog-релиз, не ссылка на отдельный официальный анонс.

## Feat: React 19 в peerDependencies

**feat** ([PR #5324](https://github.com/recharts/recharts/pull/5324), issue [#4558](https://github.com/recharts/recharts/issues/4558) «Support React 19») — в `package.json` (и в `package-lock.json`) диапазон `peerDependencies` для `react` и `react-dom` расширен на `^19.0.0`:

```diff
   "peerDependencies": {
-    "react": "^16.0.0 || ^17.0.0 || ^18.0.0",
-    "react-dom": "^16.0.0 || ^17.0.0 || ^18.0.0"
+    "react": "^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
+    "react-dom": "^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
   }
```

Теперь npm/yarn больше не считают React 19 «несовместимым peer», и проект с `react@19` + `react-dom@19` не потребует обходных флагов вида `--legacy-peer-deps`, о которых PR упоминает как о прошлом вынужденном решении («so people don't have to use `legacyPeerDependencies` anymore»).

**Важная оговорка из release body.** Для работы 2.x с React 19 всё ещё нужно, чтобы версия `react-is` совпадала с `react`/`react-dom`. Это ограничение — оно снимается полностью только в recharts 3.0. То есть после установки стоит убедиться, что в дереве зависимостей есть `react-is@19.0.x` (или явно переопределить его), иначе возможны несоответствия типов/поведения внутри recharts:

```json
{
  "overrides": {
    "react-is": "^19.0.0"
  }
}
```

В 2.x это ограничение нельзя убрать внутри самого пакета — оно уйдёт вместе с новым мажором.

## Fix: типы mouse-событий у Bar снова используют `any`

**fix** ([PR #5351](https://github.com/recharts/recharts/pull/5351), issue [#5308](https://github.com/recharts/recharts/issues/5308)) — в ходе правки типов событий у `Bar` их слишком сузили, из-за чего `data` в обработчиках перестала совпадать с тем, что реально доступно. Тип `Props` у `Bar` снова параметризуется через `any` (`src/cartesian/Bar.tsx`):

```diff
-export type Props = Omit<PresentationAttributesAdaptChildEvent<BarRectangleItem, SVGPathElement>, 'radius' | 'name'> &
-  BarProps;
+export type Props = Omit<PresentationAttributesAdaptChildEvent<any, SVGPathElement>, 'radius' | 'name'> & BarProps;
```

В вопросе [#5308](https://github.com/recharts/recharts/issues/5308) указывалось, что у `Pie` тип `onClick` — `(data: any, index: number, e: React.MouseEvent) => void`, а у `Bar` он был слишком узким (только `AdaptChildMouseEventHandler` без доступа к данным как `any`). В регрессии, которую чинит этот PR, типы стали «слишком специфичными» и снова «сломали людей» (формулировка самого автора). После фикса `data` в событии `Bar` типизируется как `any`, приходя в соответствие с подходом остальных графиков.

## Fix: удалён deprecated тип ReactText

**fix** (в составе [PR #5324](https://github.com/recharts/recharts/pull/5324)) — `ReactText` = `string | number` считается deprecated в React 19. Тип убран из двух компонентов, а его использование на публичных сигнатурах заменено явным `string | number`:

- `src/cartesian/Brush.tsx` — `tickFormatter`:

```diff
-  tickFormatter?: (value: any, index: number) => ReactText;
+  tickFormatter?: (value: any, index: number) => string | number;
```

- `src/component/DefaultLegendContent.tsx` — `strokeDasharray` в типе `Formatter` и в `Payload`:

```diff
   payload?: {
-    strokeDasharray: ReactText;
+    strokeDasharray: string | number;
     value?: any;
   };
```

Фактически это косметическая замена: `ReactText` в React и есть просто `string | number`, поэтому рантайм не изменился, а TS-типы больше не тянут deprecated импорт из `react`.

## Итоги

- Версия: **2.15.0** (minor), без breaking change в рантайме; правки только в типах и в `peerDependencies`.
- **React 19 поддержан на уровне peer**: `react`/`react-dom` `^19.0.0` (`package.json` + `package-lock.json`) — PR [#5324](https://github.com/recharts/recharts/pull/5324), issue [#4558](https://github.com/recharts/recharts/issues/4558). Оговорка про `react-is` остаётся до 3.0.
- **Fix типов `Bar`**: `Props` снова использует `PresentationAttributesAdaptChildEvent<any, ...>` — `data` в mouse-событиях опять `any` — PR [#5351](https://github.com/recharts/recharts/pull/5351), issue [#5308](https://github.com/recharts/recharts/issues/5308).
- **Удалён deprecated `ReactText`**: `Brush.tickFormatter` и `DefaultLegendContent.strokeDasharray` теперь явные `string | number`.
- Установка:

```bash
npm install recharts@2.15.0
```

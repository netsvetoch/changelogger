---
author: Артём Нецветаев
pubDatetime: 2026-06-29T01:28:53.000Z
title: "react-konva 18.1.0: React 18 в peerDependencies, экспорт KonvaRenderer и типы без React.SFC"
slug: react-konva-v18-1-0
featured: false
draft: false
tags:
  - release
  - react-konva
  - react
  - canvas
description: "Разбор react-konva v18.1.0: пакет теперь рассчитан на React 18, экспортирует KonvaRenderer для продвинутых интеграций, типы переходят с React.SFC на React.FC, а README документирует мост для React Context внутри Stage."
---

[`react-konva` v18.1.0](https://github.com/konvajs/react-konva/releases/tag/v18.1.0) — минорный релиз React-обвязки для Konva, который на практике является релизом совместимости с React 18. В `package.json` версии `18.1.0` peer dependencies зафиксированы как `react: ">=18.0.0"` и `react-dom: ">=18.0.0"`, а runtime-зависимости подняты до `react-reconciler: "~0.28.0"` и `scheduler: "^0.22.0"`.

Источник: GitHub Release [`konvajs/react-konva@v18.1.0`](https://github.com/konvajs/react-konva/releases/tag/v18.1.0), compare [`v16.8.6...v18.1.0`](https://github.com/konvajs/react-konva/compare/v16.8.6...v18.1.0) и связанные PR [#379](https://github.com/konvajs/react-konva/pull/379), [#450](https://github.com/konvajs/react-konva/pull/450), [#508](https://github.com/konvajs/react-konva/pull/508), [#603](https://github.com/konvajs/react-konva/pull/603), [#642](https://github.com/konvajs/react-konva/pull/642), [#659](https://github.com/konvajs/react-konva/pull/659). Для конкретики я проверил release body, diff PR-ов и итоговые файлы `package.json`, `ReactKonvaCore.d.ts`, `react-konva.d.ts` и `README.md` в теге `v18.1.0` через GitHub API.

## React 18 теперь основной поддерживаемый диапазон

Главная строка релиза формулирует ограничение прямо: поддерживаются `react` и `react-dom` версии 18, а с другими версиями пакет может не работать. Это видно и в итоговом `package.json` тега `v18.1.0`:

```json
{
  "dependencies": {
    "react-reconciler": "~0.28.0",
    "scheduler": "^0.22.0"
  },
  "peerDependencies": {
    "konva": "^8.0.1 || ^7.2.5",
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "devDependencies": {
    "@types/react": "18.0.8",
    "react": "^18.1.0",
    "react-dom": "^18.1.0",
    "typescript": "^4.6.4"
  }
}
```

Это важно для проектов, которые до сих пор держали `react-konva` из линейки 16/17 рядом с React 18 через overrides или игнорирование peer dependency warning. После обновления ожидаемый путь установки становится обычным:

```bash
npm install react-konva@18.1.0 konva react@18 react-dom@18
```

Если проект остаётся на React 16 или 17, этот релиз лучше не воспринимать как «широкий» совместимый диапазон: в самом release body есть предупреждение `May not work with other versions`, а опубликованный peer range требует минимум 18.0.0.

## Типы больше не завязаны на удалённый `React.SFC`

PR [#659](https://github.com/konvajs/react-konva/pull/659) исправляет несовместимость declaration-файла с `@types/react` 18.0.0. Конкретное изменение находится в `ReactKonvaCore.d.ts`: базовый тип компонента Konva-узла заменён с удалённого alias `React.SFC` на `React.FC`.

```diff
export interface KonvaNodeComponent<
  Node extends Konva.Node,
  Props = Konva.NodeConfig
-> extends React.SFC<Props & KonvaNodeEvents & React.ClassAttributes<Node>> {
+> extends React.FC<Props & KonvaNodeEvents & React.ClassAttributes<Node>> {
  getPublicInstance(): Node;
  getNativeNode(): Node;
}
```

Практический эффект: TypeScript-проект с `@types/react@18` может импортировать `Stage`, `Layer`, `Rect`, `Shape` и другие компоненты из `react-konva` без ошибки на отсутствующий `React.SFC`. В том же PR dev dependency `@types/react` была расширена с `17.0.6` до диапазона `^17.0.6 || ^18.0.0`, а в итоговом релизном `package.json` уже стоит `@types/react: "18.0.8"`.

## `useStrictMode` закреплён в публичных declaration-файлах

Раньше README уже показывал глобальное включение strict mode через `useStrictMode(true)`, но типы не экспортировали этот member. PR [#379](https://github.com/konvajs/react-konva/pull/379) добавляет его в `react-konva.d.ts`, а в версии `18.1.0` `react-konva.d.ts` реэкспортирует `ReactKonvaCore.d.ts`, где есть явная декларация:

```ts
export var useStrictMode: (useStrictMode: boolean) => void;
```

Теперь TypeScript-код может использовать задокументированный API без локальных module augmentation:

```ts
import { useStrictMode } from "react-konva";

useStrictMode(true);
```

Смысл режима остался прежним: в non-strict режиме `react-konva` обновляет только props, изменившиеся в React render, а в strict mode принудительно синхронизирует все props Konva-ноды со значениями из render. Это особенно заметно на draggable-формах: позиция, изменённая пользователем, в strict mode будет возвращаться к `x`/`y` из React props.

## Экспортирован `KonvaRenderer` для продвинутых интеграций

PR [#642](https://github.com/konvajs/react-konva/pull/642) делает внутренний reconciler публичным экспортом. В `ReactKonvaCore.js` изменение минимальное, но оно меняет доступность API:

```diff
-const KonvaRenderer = ReactFiberReconciler(HostConfig);
+export const KonvaRenderer = ReactFiberReconciler(HostConfig);
```

В типах это отражено отдельной строкой:

```ts
import * as ReactReconciler from "react-reconciler";

export var KonvaRenderer: ReactReconciler.Reconciler<any, any, any, any, any>;
```

Автор PR связывал изменение со сценариями вроде zustand `zombie child problem` и императивного кода наподобие `node.cache()` внутри `useEffect`, где важно, чтобы операции выполнялись в порядке, соответствующем JSX-дереву. Для большинства приложений это не замена обычным `<Stage>`/`<Layer>`/`<Rect>`, а escape hatch для библиотек и интеграций, которым нужно обращаться к reconciler-слою напрямую.

```ts
import { KonvaRenderer } from "react-konva/lib/ReactKonvaCore";

// Низкоуровневый API: используйте только если вы действительно строите
// интеграцию вокруг reconciler-а react-konva, а не обычный canvas UI.
console.log(KonvaRenderer);
```

## README теперь показывает мост для React Context внутри `Stage`

PR [#450](https://github.com/konvajs/react-konva/pull/450) не меняет runtime, но добавляет важную миграционную подсказку в README. Из-за известного ограничения React Context не читается напрямую дочерними компонентами внутри `react-konva` `Stage`; если компонент внутри canvas должен получить context, provider нужно «перекинуть» внутрь `Stage`.

Схема из документации выглядит так:

```tsx
const ThemeContext = React.createContext("red");

const ThemedRect = () => {
  const value = React.useContext(ThemeContext);
  return <Rect x={20} y={50} width={100} height={100} fill={value} />;
};

const Canvas = () => (
  <ThemeContext.Consumer>
    {value => (
      <Stage width={window.innerWidth} height={window.innerHeight}>
        <ThemeContext.Provider value={value}>
          <Layer>
            <ThemedRect />
          </Layer>
        </ThemeContext.Provider>
      </Stage>
    )}
  </ThemeContext.Consumer>
);
```

Для React 18-приложений это полезно проверить при миграции: если внутри canvas-дерева используются theme, i18n, auth или state-management context, они могут потребовать такого provider bridge, а не только обновления зависимостей.

## Что проверить при обновлении

- Обновите связку целиком: `react-konva@18.1.0`, `react@18`, `react-dom@18` и совместимую версию `konva` из диапазона `^8.0.1 || ^7.2.5`.
- Уберите старые overrides для peer dependencies React 16/17: опубликованный peer range версии `18.1.0` уже требует `>=18.0.0`.
- Если TypeScript падал на `React.SFC`, проверьте сборку с `@types/react@18`: declaration-файл теперь использует `React.FC`.
- Если вы используете `useStrictMode`, импорт из `react-konva` теперь покрыт типами; локальные `declare module "react-konva"` для этого API можно удалить.
- Если приложение передаёт context в компоненты внутри `<Stage>`, проверьте README-паттерн с `Context.Consumer` снаружи и `Context.Provider` внутри `Stage`.
- Если у вас библиотечная интеграция вокруг reconciler-а, обратите внимание на новый экспорт `KonvaRenderer`; обычным приложениям лучше оставаться на компонентном API `Stage`/`Layer`/shapes.

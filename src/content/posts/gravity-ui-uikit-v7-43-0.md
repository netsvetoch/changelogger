---
author: Artem Netsvetaev
pubDatetime: 2026-06-28T12:20:23.000Z
title: "Gravity UI UIKit 7.43.0: Alert, Skeleton и обновлённые Popover API"
slug: gravity-ui-uikit-v7-43-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - uikit
description: "Короткий обзор минорного релиза Gravity UI UIKit v7.43.0: новые возможности Alert, Skeleton, Popover/Tooltip API и исправления в Button, Select и TextInput."
---

Gravity UI UIKit выпустил минорную версию [`v7.43.0`](https://github.com/gravity-ui/uikit/releases/tag/v7.43.0). Релиз опубликован 24 июня 2026 года и продолжает аккуратное развитие компонентной библиотеки: больше настроек для базовых компонентов, расширение API всплывающих элементов и несколько точечных исправлений.

Источник для этого обзора — GitHub Release [`gravity-ui/uikit@v7.43.0`](https://github.com/gravity-ui/uikit/releases/tag/v7.43.0).

## Что нового

### Alert стал гибче

Компонент `Alert` получил новые `size` props, CSS API и внутренний рефакторинг. Это полезное изменение для дизайн-систем: теперь предупреждения проще подгонять под разные плотности интерфейса и поддерживать через CSS-переменные/классы, а не только через отдельные обёртки.

Изменение пришло в рамках [#2146](https://github.com/gravity-ui/uikit/issues/2146).

### Default props provider

В релиз добавлен механизм `default props provider`. В changelog про него сказано кратко, поэтому полезно смотреть не только текст релиза, но и фактический код изменения: в коммите [`f1f1a6a`](https://github.com/gravity-ui/uikit/commit/f1f1a6a6405f99c179421efa132a6771c135da22) у `ThemeProvider` появился новый prop `defaultProps?: ComponentDefaultPropsMap`, а компоненты начали пропускать входные props через `useDefaultProps("ComponentName", rawProps)`.

Из реализации видно несколько важных деталей:

- defaults задаются по имени компонента, например `Button`, `Alert`, `TextInput`, `Popover`;
- пользовательские props имеют приоритет над defaults;
- props со значением `undefined` не затирают default-значение;
- вложенный `ThemeProvider` может переопределять defaults из родительского провайдера.

Пример использования выглядит так:

```tsx
import { Button, TextInput, ThemeProvider } from "@gravity-ui/uikit";

export function App() {
  return (
    <ThemeProvider
      theme="light"
      defaultProps={{
        Button: { view: "outlined", size: "l" },
        TextInput: { size: "l" },
      }}
    >
      {/* Получит view="outlined" и size="l" из ThemeProvider */}
      <Button>Сохранить</Button>

      {/* Явный prop важнее defaultProps, поэтому size будет "m" */}
      <TextInput size="m" placeholder="Название" />
    </ThemeProvider>
  );
}
```

Практический эффект для больших продуктов: меньше повторяющихся props в местах использования компонентов и проще централизованно менять базовое поведение UI без обёрток вокруг каждого компонента.

Изменение: [#2708](https://github.com/gravity-ui/uikit/issues/2708).

### Popover и Tooltip: точнее управление триггерами

В changelog это описано как `enrich Popover and Tooltip API`, но конкретика находится в коммите [`9fde213`](https://github.com/gravity-ui/uikit/commit/9fde213b29a1f9bb2e62b939de8c6c36ab59923b).

У `Popover` появились новые props:

- `trigger?: "all" | "click"` — раньше тип был только `"click"`, а поведение «и hover, и click» было неявным. Теперь оно явно называется `"all"` и используется по умолчанию.
- `toggle?: boolean` — управляет тем, будет ли повторный клик переключать `open`-состояние. Значение по умолчанию — `true`.
- `rest?: number` — сколько миллисекунд курсор должен оставаться неподвижным перед открытием по hover. Это прокидывается в `useHover` как `restMs`.

У `Tooltip` изменился `trigger` и тоже появился `rest`:

- `trigger?: "all" | "focus"` — значение по умолчанию `"all"` включает hover/focus-сценарий, а `"focus"` отключает hover-открытие.
- `rest?: number` — задержка «покоя» курсора перед открытием tooltip по hover.

Пример, где эти настройки действительно имеют смысл:

```tsx
import { Button, Popover, Tooltip } from "@gravity-ui/uikit";

export function Example() {
  return (
    <>
      {/* Открывается только по клику и не закрывается повторным кликом по якорю */}
      <Popover trigger="click" toggle={false} content="Настройки">
        <Button>Открыть popover</Button>
      </Popover>

      {/* Не показываем tooltip на случайном пролёте мышкой — ждём 400 мс покоя */}
      <Tooltip content="Подробная подсказка" rest={400}>
        <Button>Наведи курсор</Button>
      </Tooltip>
    </>
  );
}
```

Изменение: [#2635](https://github.com/gravity-ui/uikit/issues/2635).

### Skeleton стал настраиваемым

`Skeleton` получил не просто «больше гибкости», а конкретный набор новых props в коммите [`8744e45`](https://github.com/gravity-ui/uikit/commit/8744e458179076166e5306b6b6cd788423c5a9b7):

- `variant?: "rect" | "square" | "circle" | "text"` — предустановленная форма skeleton'а. По умолчанию `"rect"`.
- `size?: "xs" | "s" | "m" | "l" | "xl"` — предустановленная высота, а для `circle`/`square` ещё и ширина.
- `width?: number | string` и `height?: number | string` — прямые алиасы для `style.width` и `style.height`.
- `animation` остался прежним: `"gradient" | "pulse" | "none"`.

Что это меняет на практике:

- `variant="circle"` задаёт `border-radius: 50%` и `aspect-ratio: 1` — удобно для avatar-placeholder.
- `variant="square"` тоже задаёт `aspect-ratio: 1`, но сохраняет обычное скругление.
- `variant="text"` делает высоту `1em` и использует `margin-block: calc((1lh - 1em) / 2)`, поэтому строка skeleton'а подстраивается под типографику родителя.
- `size` выбирает токены высоты и border-radius (`xs`, `s`, `m`, `l`, `xl`), так что не нужно каждый раз руками писать одинаковые inline styles.

Пример многострочного текстового placeholder'а:

```tsx
import { Skeleton, Text } from "@gravity-ui/uikit";

export function ArticlePreviewSkeleton() {
  return (
    <Text variant="body-1">
      <Skeleton variant="text" width={400} />
      <Skeleton variant="text" width={400} />
      <Skeleton variant="text" width={240} />
    </Text>
  );
}
```

А так можно собрать skeleton для карточки пользователя без кастомных CSS-классов под круглый avatar:

```tsx
import { Skeleton, User } from "@gravity-ui/uikit";

export function UserSkeleton() {
  return (
    <User
      avatar={<Skeleton variant="circle" height={32} />}
      name={<Skeleton variant="text" size="s" width={80} />}
      description={<Skeleton variant="text" size="s" width={120} />}
    />
  );
}
```

Изменение: [#2684](https://github.com/gravity-ui/uikit/issues/2684).

## Исправления

В `v7.43.0` также вошли три bug fix'а:

- `Button` больше не прокидывает служебный prop компонента в итоговый DOM-элемент — это снижает риск React warning'ов и лишних атрибутов в HTML ([#2703](https://github.com/gravity-ui/uikit/issues/2703)).
- `Select` переведён с legacy `Popover` на новый `Popover` ([#2711](https://github.com/gravity-ui/uikit/issues/2711)).
- `TextInput` тоже переведён с legacy `Popover` на новый `Popover` ([#2710](https://github.com/gravity-ui/uikit/issues/2710)).

Последние два пункта выглядят как часть постепенной миграции библиотеки с устаревшей реализации всплывающих элементов на новую. Для пользователей это обычно означает более единое поведение компонентов и меньше расхождений между `Select`, `TextInput`, `Tooltip` и другими элементами, которые используют popover-паттерн.

## Кому стоит обновиться

Если проект уже использует `@gravity-ui/uikit` версии `7.x`, релиз выглядит как безопасное минорное обновление: в changelog нет явных breaking changes, а изменения в основном добавляют новые возможности и исправляют внутренние детали компонентов.

Обновление особенно интересно, если вы:

- активно используете `Alert` и хотите тоньше управлять его размером и стилями;
- строите свою дизайн-систему поверх Gravity UI и хотите централизовать default props;
- используете `Popover`, `Tooltip`, `Select` или `TextInput` в сложных сценариях;
- хотите уменьшить количество legacy-зависимостей внутри UI-компонентов.

## Как обновиться

```bash
pnpm add @gravity-ui/uikit@7.43.0
```

Или через npm:

```bash
npm install @gravity-ui/uikit@7.43.0
```

После обновления стоит прогнать типизацию, линтер и визуальные тесты/сторибук, если они есть. Особое внимание — местам, где используются `Alert`, `Popover`, `Tooltip`, `Select` и `TextInput`.

## Ссылки

- [Release v7.43.0](https://github.com/gravity-ui/uikit/releases/tag/v7.43.0)
- [Compare v7.42.0...v7.43.0](https://github.com/gravity-ui/uikit/compare/v7.42.0...v7.43.0)
- [Репозиторий gravity-ui/uikit](https://github.com/gravity-ui/uikit)

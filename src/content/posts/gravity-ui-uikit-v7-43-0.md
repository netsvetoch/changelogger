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

В релиз добавлен механизм `default props provider`. Судя по названию изменения, он позволяет задавать значения props по умолчанию на уровне приложения или части дерева компонентов.

Практический эффект для больших продуктов: меньше повторяющихся props в местах использования компонентов и проще централизованно менять поведение UI.

Изменение: [#2708](https://github.com/gravity-ui/uikit/issues/2708).

### Расширены API Popover и Tooltip

`Popover` и `Tooltip` получили расширенный API. Это особенно важно, потому что всплывающие элементы часто оказываются в центре сложных сценариев: позиционирование, управление открытием, вложенные интерактивные элементы, фокус и доступность.

Изменение: [#2635](https://github.com/gravity-ui/uikit/issues/2635).

### Skeleton стал настраиваемым

Компонент `Skeleton` теперь стал более гибким — в changelog это обозначено как adjustable skeleton. Для приложений с большим количеством loading-состояний это приятное улучшение: скелетоны легче согласовать с реальной формой контента.

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

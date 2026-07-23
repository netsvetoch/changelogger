---
author: Артём Нецветаев
pubDatetime: 2026-07-23T10:31:54.000Z
title: "Gravity UI Icons 2.21.0: синхронизация 27 существующих иконок"
slug: gravity-ui-icons-v2-21-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - icons
description: "Что действительно изменилось в @gravity-ui/icons v2.21.0: синхронизация 27 существующих React-компонентов и raw SVG, обновлённые path-данные и упрощённая SVG-разметка без нового публичного API."
---

Минорный релиз [`@gravity-ui/icons v2.21.0`](https://github.com/gravity-ui/icons/releases/tag/v2.21.0) содержит один feature-пункт — `sync icons`. За ним стоит [PR #101](https://github.com/gravity-ui/icons/pull/101), влитый коммитом [`f347de3`](https://github.com/gravity-ui/icons/commit/f347de32d0be8dbfbf602b4d65667d808f8b1b0c). Поэтому это не выпуск новых имён для импорта и не изменение способа подключения пакета, а синхронизация уже существующих глифов с их актуальными SVG-исходниками.

В [compare `v2.20.0...v2.21.0`](https://github.com/gravity-ui/icons/compare/v2.20.0...v2.21.0) три коммита: собственно синхронизация, обновление changelog и версии пакета. PR меняет 54 файла: 27 React-компонентов в `lib/` и те же 27 raw SVG в `svgs/`.

## Что именно синхронизировали

Затронуты следующие уже экспортируемые иконки:

- `ArrowDownLeft`, `ArrowRotateLeftNumber5`, `ArrowRotateRightNumber5`;
- `Books`, `BroomMotion`, `ChevronsCollapseVerticalToLine`;
- `DatabaseMagnifier`, `DatabaseNutHex`, `DatabasePlus`;
- `EyeClosed`, `Firewall`, `Gem`, `HourglassStart`;
- `LockFill`, `LockOpenFill`;
- `LogoFigma`, `LogoMicrosoftOffice`, `LogoSlack`, `LogoYandexCloud`;
- `Microscope`, `Paintbrush`, `ServerPlus`;
- `Speedometer`, `Tachometer`, `Thunderbolt`, `ThunderboltFill`, `UniversalAccess`.

Для каждой позиции обновлены оба публичных представления: React-реализация `lib/<Icon>.tsx` и файл `svgs/<icon>.svg`. Это важно, если приложение одновременно использует React-компоненты и прямые SVG-импорты: после обновления они остаются согласованными, а не начинают рисовать разные версии одной и той же иконки.

## Не новый API, а новые контуры и упрощённая разметка

В ряде файлов синхронизация заменяет дублирующиеся `path`-элементы или обёртки `<g fill="currentColor">` одним актуальным контуром. Например, в `ArrowDownLeft`, `ArrowRotateRightNumber5`, `Books` и `ChevronsCollapseVerticalToLine` группа с повторяющимися path заменена на один `path` с `fill="currentColor"`. В `Books` правила заливки `fillRule="evenodd"` и `clipRule="evenodd"` перенесены на этот же элемент.

Есть и правки геометрии. В `DatabaseNutHex` исправлен контур внутренней шестигранной гайки, в `ArrowRotateLeftNumber5` удалён устаревший дублирующий path, а `DatabaseMagnifier` теперь хранит два контура в одной группе с общими `fill`, `fillRule` и `clipRule`. У `LogoSlack`, `LogoYandexCloud`, `Microscope`, `Paintbrush`, `Thunderbolt` и других файлов также обновлены path-данные или устранены дубликаты.

Это означает, что публичные имена и сигнатуры компонентов не менялись: `DatabaseMagnifier`, `Thunderbolt` и остальные продолжают импортироваться прежним способом. Но визуальный результат отдельных значков мог измениться. После обновления стоит переснять visual-regression или snapshot-тесты там, где эти иконки проверяются попиксельно.

## Подключение остаётся прежним

Новых экспортов, props, флагов или миграций в релизе нет. Иконки по-прежнему можно получать как отдельный React-модуль, из корневого barrel-экспорта или как raw SVG:

```tsx
import DatabaseMagnifier from "@gravity-ui/icons/DatabaseMagnifier";
import { Thunderbolt } from "@gravity-ui/icons";
import thunderboltSvg from "@gravity-ui/icons/svgs/thunderbolt.svg";
```

Первый вариант берёт конкретную иконку; второй зависит от tree-shaking сборщика; импорт SVG, как и прежде, требует настроенного обработчика `.svg` в bundler'е. Сам пакет предоставляет глифы, а рендеринг, размеры и доступность в приложениях Gravity UI обычно задаёт компонент `Icon` из `@gravity-ui/uikit`.

## Как обновиться

Breaking changes в release notes и связанном PR отсутствуют. Для получения синхронизированных глифов достаточно обновить зависимость:

```bash
pnpm add @gravity-ui/icons@2.21.0
```

После обновления отдельно проверьте экраны и снапшоты, в которых используются перечисленные 27 иконок, особенно логотипы, `DatabaseMagnifier`, `Thunderbolt` и `ThunderboltFill`: именно их SVG-разметка или path-геометрия попали в синхронизацию.

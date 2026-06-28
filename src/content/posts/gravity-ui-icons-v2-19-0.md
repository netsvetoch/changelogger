---
author: Артём Нецветаев
pubDatetime: 2026-06-28T16:33:14.000Z
title: "Gravity UI Icons 2.19.0: 18 новых React-иконок и обновлённые SVG"
slug: gravity-ui-icons-v2-19-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - icons
description: "Обзор минорного релиза @gravity-ui/icons v2.19.0: какие новые SVG и React-компоненты появились, что изменилось в metadata.json и какие существующие иконки перерисовали."
---

`@gravity-ui/icons` выпустил минорную версию [`v2.19.0`](https://github.com/gravity-ui/icons/releases/tag/v2.19.0). В changelog релиз описан коротко — `sync icons`, поэтому для обзора пришлось смотреть связанный [PR #93](https://github.com/gravity-ui/icons/pull/93), merge-коммит [`130461c`](https://github.com/gravity-ui/icons/commit/130461c45b44e51d87c9d875952034b1d74443db) и compare [`v2.18.0...v2.19.0`](https://github.com/gravity-ui/icons/compare/v2.18.0...v2.19.0).

Главный результат синхронизации: пакет получил 18 новых React-компонентов, соответствующие SVG-файлы и записи в `metadata.json`. Всего PR меняет 50 файлов: 36 добавлены, 14 изменены; релизный коммит затем обновляет `CHANGELOG.md` и версию пакета до `2.19.0`.

## Новые иконки экспортируются из `lib/index.ts`

Самое важное для пользователей пакета — новые компоненты сразу добавлены в общий barrel-export `lib/index.ts`, поэтому их можно импортировать так же, как остальные иконки:

```tsx
import {
  BanDashed,
  CommentsDot,
  LogoAppStore,
  WalletDot,
} from "@gravity-ui/icons";

export function Toolbar() {
  return (
    <div>
      <BanDashed aria-label="Недоступно" />
      <CommentsDot aria-label="Есть новые комментарии" />
      <LogoAppStore aria-label="App Store" />
      <WalletDot aria-label="Кошелёк с уведомлением" />
    </div>
  );
}
```

В `v2.19.0` появились такие новые React-компоненты:

- `BanDashed`;
- `ChevronsCollapseVerticalToLine` и `ChevronsExpandVerticalFromLine`;
- `CommentsDot`;
- `DatabaseNutHex` и `DatabasePlus`;
- `Hourglass`, `HourglassEnd`, `HourglassStart`;
- `LogoAppStore`, `LogoApple`, `LogoGooglePlay`, `LogoHuaweiAppgallery`, `LogoRustore`, `LogoWebhook`;
- `ServerPlus`;
- `Wallet` и `WalletDot`.

Для каждого компонента в коммите есть пара файлов: React-компонент в `lib/*.tsx` и исходный SVG в `svgs/*.svg`. Например, `WalletDot` добавлен как `lib/WalletDot.tsx` и `svgs/wallet-dot.svg`, а `LogoHuaweiAppgallery` — как `lib/LogoHuaweiAppgallery.tsx` и `svgs/logo-huawei-appgallery.svg`.

## Обновился каталог метаданных

Синхронизация затронула не только TypeScript-экспорты. В `metadata.json` добавлены записи с `name`, `svgName`, `componentName`, `style: "regular"` и keywords для новых иконок. Это важно для витрин, поисковиков и внутренних каталогов иконок, которые строятся не по импортам из `lib/index.ts`, а по метаданным.

Подтверждённые новые записи включают, например:

```json
{
  "name": "comments-dot",
  "style": "regular",
  "svgName": "comments-dot",
  "componentName": "CommentsDot",
  "keywords": ["dialog", "messages", "bubbles", "notification"]
}
```

Для `BanDashed` добавлен keyword `inactive`, а для `Hourglass`, `HourglassEnd` и `HourglassStart` — keyword `time`. У большинства новых logo/database/server/wallet-иконок keywords пока пустые, но сами записи уже есть, так что каталог сможет показать их по имени и componentName.

## Какие сценарии закрывает набор

По названиям и фактическим SVG/metadata изменения группируются в несколько практических блоков.

Во-первых, появились иконки для статусов и уведомлений: `CommentsDot` и `WalletDot` имеют дополнительную красную точку (`fill="#f33"`) в SVG. Это готовый вариант для бейджей «есть новое сообщение» или «есть событие по кошельку» без отдельного overlay-компонента.

Во-вторых, добавились иконки для управления раскрытием по вертикали: `ChevronsCollapseVerticalToLine` и `ChevronsExpandVerticalFromLine`. Они дополняют уже существующую группу `Chevrons*` и полезны для UI, где нужно показать сворачивание к горизонтальной линии или разворачивание от неё.

В-третьих, расширился набор инфраструктурных и продуктовых символов: `DatabasePlus`, `DatabaseNutHex`, `ServerPlus`, `Wallet`, `BanDashed`, а также три состояния песочных часов. Это закрывает типовые действия «добавить базу», «настроить базу», «добавить сервер», «кошелёк» и «ожидание/начало/конец времени».

Наконец, релиз заметно пополнил logo-набор: `LogoAppStore`, `LogoApple`, `LogoGooglePlay`, `LogoHuaweiAppgallery`, `LogoRustore` и `LogoWebhook`. Для продуктовых экранов распространения приложений это означает меньше локальных SVG в проекте и больше единообразных импортов из `@gravity-ui/icons`.

## Не только новые файлы: есть перерисованные существующие иконки

Коммит не ограничивается добавлением новых файлов. В compare также видны изменения существующих SVG и React-компонентов:

- `AlmostEqual` получил небольшие правки path-данных;
- `CrownDiamond` переписан с группы `fillRule/clipRule` на один `path` с более подробным контуром;
- `DatabaseMagnifier` существенно перерисован и теперь содержит вложенные группы `g`;
- `LogoDebian` получил точечную правку path-данных;
- `Thunderbolt` и `ThunderboltFill` перерисованы: в SVG теперь есть группа `g fill="currentColor"`, а `Thunderbolt` содержит отдельный `path` и `path fill-rule="evenodd"`.

Для потребителей это не API-изменение: имена импортов остаются прежними. Но если в проекте есть визуальные снапшоты, пиксельные тесты или вручную утверждённые SVG-рендеры, эти иконки стоит отдельно пересмотреть после обновления.

## Как обновиться

Пакет остаётся обычным React/SVG-набором с `peerDependencies.react: "*"` и `sideEffects: false`; в релизе не видно breaking changes или миграций. Для установки достаточно обновить зависимость:

```bash
pnpm add @gravity-ui/icons@2.19.0
```

После этого новые иконки доступны из корневого импорта `@gravity-ui/icons`, а SVG-версии — в опубликованной директории `svgs` пакета.

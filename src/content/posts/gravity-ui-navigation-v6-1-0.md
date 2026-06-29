---
author: Артём Нецветаев
pubDatetime: 2026-06-29T00:08:32.000Z
title: "@gravity-ui/navigation 6.1.0: прокручиваемые вкладки Settings на мобильных"
slug: gravity-ui-navigation-v6-1-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - navigation
description: "Разбор минорного релиза @gravity-ui/navigation v6.1.0: новый prop enableMobileSettingsTabsScroll для мобильного Settings, переключение TabList contentOverflow между wrap и scroll, обновление @gravity-ui/uikit до 7.42.0 и визуальный story/test для нового режима."
---

`@gravity-ui/navigation` выпустил минорный релиз [`v6.1.0`](https://github.com/gravity-ui/navigation/releases/tag/v6.1.0). В changelog у релиза всего один feature-пункт — «add scroll view for mobile tabs», поэтому главное изменение здесь стоит читать не как общую «улучшенную мобильную навигацию», а как конкретный opt-in prop для компонента `Settings`.

Источник для обзора — GitHub Release [`gravity-ui/navigation@v6.1.0`](https://github.com/gravity-ui/navigation/releases/tag/v6.1.0), PR [`#643`](https://github.com/gravity-ui/navigation/pull/643) и merge commit [`e95e6a8`](https://github.com/gravity-ui/navigation/commit/e95e6a84fa767a97bba941631372d3190c8c15b0). В diff попали `src/components/Settings/types.ts`, `Settings.tsx`, `SettingsMenuMobile.tsx`, README, Storybook story и visual test.

## `Settings` получил `enableMobileSettingsTabsScroll`

Новый публичный API — optional prop `enableMobileSettingsTabsScroll?: boolean` в `SettingsProps`. Он добавлен в `src/components/Settings/types.ts` и пробрасывается из `SettingsContent` в мобильный внутренний рендер `SettingsContentInnerMobile`.

Практически это настройка для экранов, где в мобильном `Settings` много вкладок. До этого мобильное меню вкладок рендерилось без отдельного режима overflow, и `TabList` оставался в поведении по умолчанию для переноса. Теперь пользователь компонента может явно попросить горизонтальный scroll вместо wrap.

Минимальный пример использования выглядит так:

```tsx
import { Settings } from "@gravity-ui/navigation";

export function MobileSettings() {
  return (
    <Settings view="mobile" enableMobileSettingsTabsScroll>
      <Settings.Group id="general" groupTitle="General">
        <Settings.Page id="profile" title="Profile">
          Profile settings
        </Settings.Page>
        <Settings.Page id="notifications" title="Notifications">
          Notification settings
        </Settings.Page>
      </Settings.Group>
    </Settings>
  );
}
```

Важно: новый prop не меняет структуру страниц, `initialPage`, `onPageChange` или API `Settings.Group`/`Settings.Page`. Это именно переключатель поведения вкладок в мобильном варианте.

## Внутри `SettingsMenuMobile` переключается `TabList.contentOverflow`

Внутренняя реализация тоже достаточно точечная. Тип `SettingsMenuMobileProps` теперь расширен полем `enableTabsScroll?: boolean`, а `SettingsMenuMobile` передаёт его в `TabList` из `@gravity-ui/uikit` так:

```tsx
<TabList
  size="l"
  className={b(null, className)}
  contentOverflow={enableTabsScroll ? "scroll" : "wrap"}
>
  {tabItems.map(item => (
    <Tab key={item.value} {...item} />
  ))}
</TabList>
```

Это подтверждает две детали поведения:

- при `enableMobileSettingsTabsScroll={true}` мобильные вкладки используют `contentOverflow="scroll"`;
- без нового prop сохраняется прежний режим `contentOverflow="wrap"`.

Поэтому обновление безопасно для существующих экранов: чтобы увидеть новый UX, его нужно включить явно.

## Документация и Storybook закрепили сценарий

README компонента `Settings` получил новую строку в таблице properties: `enableMobileSettingsTabsScroll` описан как boolean-флаг, при котором «In mobile view tabs will overflow with scroll instead of wrap».

В Storybook добавлена отдельная история `ViewMobileWithTabsScroll`. Она строится через новый `SettingsMobileWithTabsScrollDemo`, который передаёт `enableMobileSettingsTabsScroll` в `SettingsMobileComponent`. Для неё же добавлен visual regression test `render story: <ViewMobileWithTabsScroll>` с viewport `400 × 600` и новые snapshot PNG для light/dark в Chromium и WebKit.

Это хороший сигнал для пользователей дизайн-системы: новый режим не является случайным внутренним хаком, он задокументирован, показан в Storybook и покрыт визуальными снапшотами.

## Peer dependency на `@gravity-ui/uikit` поднят до `^7.42.0`

В том же PR обновили зависимость на `@gravity-ui/uikit`:

```diff
-"@gravity-ui/uikit": "^7.2.0"
+"@gravity-ui/uikit": "^7.42.0"
```

Это изменение есть в `peerDependencies`, а dev-зависимость для самого репозитория также поднята с `^7.31.0` до `^7.42.0`. Причина видна из реализации: новый режим опирается на `TabList` с `contentOverflow`, поэтому потребителям `@gravity-ui/navigation` после обновления нужно иметь совместимую версию `@gravity-ui/uikit`.

Если в приложении `@gravity-ui/uikit` закреплён вручную ниже `7.42.0`, стоит обновить его вместе с `@gravity-ui/navigation`:

```bash
npm install @gravity-ui/navigation@6.1.0 @gravity-ui/uikit@^7.42.0
```

## Кому обновляться

Релиз особенно полезен продуктам, где `Settings` в мобильном представлении содержит несколько групп или страниц с длинными названиями. Вместо переноса вкладок в несколько строк можно включить горизонтальную прокрутку и оставить панель компактнее по высоте.

Для десктопного `view="normal"` новый prop не добавляет отдельного поведения: в diff он используется только в мобильной ветке `SettingsContentInnerMobile`. Для существующих мобильных настроек без `enableMobileSettingsTabsScroll` поведение также остаётся прежним — вкладки продолжают использовать wrap.

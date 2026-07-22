---
author: Артём Нецветаев
pubDatetime: 2026-07-22T13:59:00.000Z
title: "@gravity-ui/uikit 7.47.0: миграция Tabs, локализованное «Ещё» и типы React как optional peer"
slug: gravity-ui-uikit-v7-47-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
  - typescript
  - ui
  - accessibility
description: "Разбор @gravity-ui/uikit v7.47.0: подробная миграция с legacy Tabs и AdaptiveTabs на TabList/Tab, корректный рендер custom-компонентов, локализация overflow-триггера, optional peer @types/react и исправленный popover ошибки Select."
---

Вышел минорный релиз [`@gravity-ui/uikit v7.47.0`](https://github.com/gravity-ui/uikit/releases/tag/v7.47.0). Самая практичная часть версии — не новый визуальный компонент, а доведённая миграция вкладок: репозиторий добавил отдельное руководство для перехода с legacy `Tabs` и `AdaptiveTabs`, исправил использование собственного компонента в `Tab` и уточнил поведение переполнения. Кроме того, UIKit теперь явно объявляет `@types/react` optional peer dependency, а `Select` с ошибкой внутри контрола снова показывает popover по наведению.

Источники: [GitHub Release](https://github.com/gravity-ui/uikit/releases/tag/v7.47.0), [compare `v7.46.0...v7.47.0`](https://github.com/gravity-ui/uikit/compare/v7.46.0...v7.47.0), PR [#2757](https://github.com/gravity-ui/uikit/pull/2757), [#2751](https://github.com/gravity-ui/uikit/pull/2751), [#2753](https://github.com/gravity-ui/uikit/pull/2753), [#2760](https://github.com/gravity-ui/uikit/pull/2760) и обновление README в [#2705](https://github.com/gravity-ui/uikit/pull/2705). Версия `7.47.0` находится на minor-границе semver, поэтому это самостоятельная статья; `featured` оставлен `false`.

## `Tabs` → `TabList` и `Tab`: не только переименование

В релизе появился `src/components/tabs/migration-guide.md`. Он фиксирует контракт новой API, который отличается от legacy `Tabs` из `@gravity-ui/uikit/legacy`:

- вместо одного компонента с `items`, `activeTab` и `onSelectTab` используются `TabList`, `Tab` и, при необходимости, `TabPanel`;
- `activeTab` переименован в `value`, `onSelectTab` — в `onUpdate`;
- режима `items` больше нет: вкладки должны быть JSX-детьми `Tab` (для данных — через `.map()`);
- `TabList` не активирует первую вкладку неявно: если это было важно, начальное `value` нужно передать явно;
- вертикального `direction="vertical"` в новой API нет.

Минимальная замена выглядит так:

```tsx
// Было: @gravity-ui/uikit/legacy
<Tabs
  activeTab={activeTab}
  onSelectTab={setActiveTab}
  items={[
    {id: "overview", title: "Обзор"},
    {id: "settings", title: "Настройки"},
  ]}
/>

// Стало: @gravity-ui/uikit
<TabList value={activeTab} onUpdate={setActiveTab}>
  <Tab value="overview">Обзор</Tab>
  <Tab value="settings">Настройки</Tab>
</TabList>
```

`TabProvider` не нужен в обычной разметке, где `TabList` и `TabPanel` могут получить одно состояние напрямую. Он предназначен для случая, когда список и панели разделены собственными обёртками и должны брать `value`/`onUpdate` из context.

Новый `TabList` также даёт встроенную стратегию `contentOverflow="collapse"`: не поместившиеся вкладки уходят в меню. Для неё доступны `moreLabel`, а также `activateOnFocus`, включающий активацию при получении фокуса. Последний стоит использовать только когда содержимое соответствующей панели можно показать без задержки.

```tsx
<TabList
  value={activeTab}
  onUpdate={setActiveTab}
  contentOverflow="collapse"
  moreLabel="Другие разделы"
>
  {sections.map(({ id, title }) => (
    <Tab key={id} value={id}>
      {title}
    </Tab>
  ))}
</TabList>
```

Для перехода с `AdaptiveTabs` важно не считать это полной заменой один к одному. `contentOverflow="collapse"` переносит лишние вкладки в меню, но не повторяет `breakpointsConfig`: новый компонент не сжимает вкладки пропорционально и не заменяет всю панель одним `Select` на малой ширине.

## Свои компоненты в `Tab` и безопасные ссылки

PR [#2757](https://github.com/gravity-ui/uikit/pull/2757) выделил внутренний `TabInner` и сделал экспортируемый `Tab` полиморфным компонентом с overload-типами. Поэтому `component` можно передать без того, чтобы содержимое вкладки терялось при обычном рендере или при переносе вкладки в overflow-меню.

```tsx
import { Link } from "react-router-dom";
import { Tab } from "@gravity-ui/uikit";

<Tab component={Link} to="/settings" value="settings">
  Настройки
</Tab>;
```

В том же изменении `isMenuItem` убран из публичного `TabCommonProps`: это теперь внутренняя деталь `TabInner`, а не prop потребительского API. Для вкладок-ссылок общая утилита выставляет `rel="noopener noreferrer"`, если есть `target="_blank"`, но `rel` не указан — то есть защитное значение не нужно добавлять вручную в типичном случае.

## Overflow-триггер теперь переводится

Ранее `TabListCollapseItem` задавал текст overflow-кнопки как `moreLabel = "More"`. В [#2751](https://github.com/gravity-ui/uikit/pull/2751) default заменён на ключ `Tabs.label_more` из нового i18n keyset: для английского это `More`, для русского — `Ещё`. Пользовательское значение `moreLabel` сохраняет приоритет.

```tsx
<ThemeProvider lang="ru">
  <TabList contentOverflow="collapse">{/* ... */}</TabList>
  {/* default trigger: «Ещё» */}
</ThemeProvider>
```

Тест покрывает именно сценарий с `ThemeProvider lang="ru"`: при переполнении кнопка доступна по имени «Ещё». Это важно для приложений, которые прежде локализовали только собственные подписи и неожиданно оставляли встроенный триггер на английском.

## `@types/react` стал optional peer dependency

В [#2753](https://github.com/gravity-ui/uikit/pull/2753) пакет объявил:

```json
{
  "peerDependencies": {
    "@types/react": "^16.14.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
  },
  "peerDependenciesMeta": {
    "@types/react": { "optional": true }
  }
}
```

Скомпилированный UIKit импортирует React-типы. В строгой изоляции `node_modules` у pnpm транзитивный или hoisted `@types/react` мог не резолвиться, и TypeScript-проверка потребителя падала. Теперь требование видно пакетному менеджеру, но JavaScript-проект не получает обязательную установку типов. TypeScript-проекту с React стоит убедиться, что в его зависимостях есть совместимый `@types/react`.

## Popover ошибки `Select` поверх декоративного слоя

Исправление [#2760](https://github.com/gravity-ui/uikit/pull/2760) касается связки `validationState="invalid"`, `errorMessage` и `errorPlacement="inside"`. Иконка ошибки внутри `SelectControl` могла оказаться под декоративным слоем и не открывать подсказку по hover. В SCSS для `__error-icon` добавлен `z-index: 1`; регрессионный тест наводит указатель на кнопку с aria-именем `Show popup with error info` и ожидает текст ошибки.

```tsx
<Select
  validationState="invalid"
  errorMessage="Выберите хотя бы один пункт"
  errorPlacement="inside"
/>
```

После обновления этот вариант снова должен показывать popover при наведении на иконку ошибки.

## README: требования и рабочие команды стали явнее

[PR #2705](https://github.com/gravity-ui/uikit/pull/2705) переработал английский и русский README. В них добавлены перекрёстные ссылки между языками, описание UIKit как базового пакета Gravity UI, ссылки на сайт, документацию, Figma, Themer и Storybook. Инструкции теперь отдельно называют поддерживаемые React `16.14`, `17`, `18` и `19`, предлагают обычную установку и показывают импорт базовых CSS и шрифтов.

```bash
npm install @gravity-ui/uikit
```

```ts
import "@gravity-ui/uikit/styles/fonts.css";
import "@gravity-ui/uikit/styles/styles.css";
```

В README также собраны команды для разработки: `npm test`, `npm run lint`, `npm run typecheck` и `npm run playwright`.

## Обновление

```bash
pnpm add @gravity-ui/uikit@7.47.0
```

Если приложение ещё использует legacy `Tabs` или `AdaptiveTabs`, обновление лучше совместить с проверкой нового migration guide: заменить `items` на JSX-вкладки, зафиксировать начальное `value`, если раньше полагались на автоматический выбор первой вкладки, и отдельно оценить адаптивное поведение `contentOverflow="collapse"` на узких экранах.

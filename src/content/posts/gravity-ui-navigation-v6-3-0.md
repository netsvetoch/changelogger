---
author: Артём Нецветаев
pubDatetime: 2026-07-15T16:25:40.000Z
title: "@gravity-ui/navigation 6.3.0: документация для AI-агентов и новые README компонентов"
slug: gravity-ui-navigation-v6-3-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - navigation
description: "Разбор @gravity-ui/navigation v6.3.0: документация для AI-агентов собирается в build/docs, README компонентов и хуков получили структурированные properties, а проверка документации теперь выполняется в CI."
---

`@gravity-ui/navigation` выпустил минорную версию [`v6.3.0`](https://github.com/gravity-ui/navigation/releases/tag/v6.3.0). В официальном changelog у неё один пункт — `improve agent docs`, но за ним стоит не косметическая правка текста, а новая цепочка подготовки документации к публикации пакета.

Источник этого разбора — GitHub Release [`v6.3.0`](https://github.com/gravity-ui/navigation/releases/tag/v6.3.0), issue/PR [`#653`](https://github.com/gravity-ui/navigation/pull/653), merge commit [`f03fdfd`](https://github.com/gravity-ui/navigation/commit/f03fdfd2e2d48918d23caa16e28c5d85b20b7fe2) и сравнение [`v6.2.0...v6.3.0`](https://github.com/gravity-ui/navigation/compare/v6.2.0...v6.3.0).

## В пакет добавляется дерево документации для AI-агентов

В корневой `README.md` появилась явная ссылка на документацию установленной версии:

```text
node_modules/@gravity-ui/navigation/build/docs/INDEX.md
```

Это не ссылка на документацию `main` в GitHub. Путь указывает на каталог `build/docs`, который создаётся при сборке пакета и попадает в установленный npm-модуль. Агент, работающий с конкретной версией зависимости, может читать документацию из того же дерева, что и приложение, не подменяя её актуальным состоянием репозитория.

Генерация вынесена в отдельную команду `build:docs` и запускается скриптом `scripts/build-docs.js`:

```json
{
  "scripts": {
    "build:docs": "node scripts/build-docs.js",
    "prepublishOnly": "npm run build && npm run build:docs"
  }
}
```

Сам скрипт вызывает `buildDocs()` из `@gravity-ui/gulp-utils`. В результате в `build/docs` создаются `INDEX.md` и подготовленные README компонентов и хуков. Поэтому при публикации новой версии документация не остаётся только исходными файлами в `src` — она становится частью артефакта пакета.

## README компонентов получили предсказуемую структуру

PR #653 нормализует заголовки и названия секций, чтобы документацию было проще разбирать программно. Например, у `Footer`, `HotkeysPanel` и `AsideHeader` секции с параметрами теперь называются `Properties`, а не по-разному (`PropTypes`, `Properties of AsideHeader` и т. п.). У `MobileHeader` появился полноценный список свойств:

| Свойство                                 | Тип                                                        |
| ---------------------------------------- | ---------------------------------------------------------- |
| `logo`                                   | `LogoProps`                                                |
| `burgerMenu`                             | `BurgerMenuProps`                                          |
| `overlapPanel`                           | `OverlapPanelProps`                                        |
| `burgerCloseTitle`, `burgerOpenTitle`    | `string`                                                   |
| `panelItems`                             | `PanelItemProps[]`                                         |
| `topAlert`                               | `TopAlertProps`                                            |
| `renderContent`, `sideItemRenderContent` | `RenderContentType`                                        |
| `onEvent`                                | `(itemName: string, eventName: MobileHeaderEvent) => void` |
| `onClosePanel`                           | `() => void`                                               |
| `className`, `contentClassName`          | `string`                                                   |

Это полезно не только для чтения человеком: у агента появляется единый маркер `Properties` и таблица с именами и типами props вместо необходимости угадывать API по исходникам компонента.

## Исправлена документация `useOverflowingHorizontalListItems`

README хука исправляет прежнее имя `useOverflowingContainerListItems` и описывает фактическое назначение: горизонтальные элементы, которые остаются видимыми, а лишние складываются в overflow-меню «ещё». В документацию также добавлен импорт:

```tsx
import { useOverflowingHorizontalListItems } from "@gravity-ui/navigation";
```

После этого идёт секция `Properties` с таблицей параметров. Это особенно важно для автоматизированного поиска: имя в заголовке, имя экспорта и пример импорта теперь совпадают.

## README проверяются отдельно для пакета, компонентов и хуков

Workflow [`.github/workflows/validate-readme.yml`](https://github.com/gravity-ui/navigation/blob/v6.3.0/.github/workflows/validate-readme.yml) больше не запускает одну общую проверку. Теперь он содержит две job:

- `validate-package` проверяет корневой `README.md` через `gravity-ui/readme-validator@v1` с `type: package`;
- `validate-components` проверяет README по шаблонам `src/components/*/README.md` и `src/hooks/*/README.md` с `type: component`.

В `on.pull_request.paths` также добавлены README компонентов и хуков. Поэтому изменения в этих файлах запускают проверку автоматически, а ошибки в таблицах, заголовках или Markdown не должны попасть в релиз незамеченными.

## Изменения, важные при обновлении

В `package.json` peer dependency на `@gravity-ui/uikit` обновлена с `^7.2.0` до `^7.42.0`. Это не новый runtime-проп, но версия теперь явно зафиксирована в метаданных релиза. Если приложение устанавливает peer-зависимости вручную, обновить их можно вместе:

```bash
npm install @gravity-ui/navigation@6.3.0 @gravity-ui/uikit@^7.42.0
```

Сам релиз не меняет API компонентов навигации и не требует миграции JSX. Основной пользовательский эффект — наличие документации именно установленной версии в `build/docs`, а основной процессный эффект — генерация этой документации при публикации и отдельная CI-проверка README компонентов и хуков.

## Итог

`6.3.0` делает `@gravity-ui/navigation` удобнее для инструментов, которые работают с npm-пакетом локально: они получают `build/docs/INDEX.md` и нормализованные README с таблицами свойств. Для разработчика библиотеки это сопровождается явной командой `npm run build:docs`, включённой в `prepublishOnly`, и проверками `README.md` по двум категориям в GitHub Actions.

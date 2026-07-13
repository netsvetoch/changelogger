---
author: Артём Нецветаев
pubDatetime: 2026-07-13T16:50:09.000Z
title: "Gravity UI UIKit 7.45.0: стабильные ключи List и ссылки в Pagination"
slug: gravity-ui-uikit-v7-45-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - uikit
description: "Что изменилось в @gravity-ui/uikit 7.45.0: itemKey для сохранения состояния элементов List, pageComponent и getPageProps для ссылок Pagination, документация в npm-пакете и исправления Accordion и CSS-переменных."
---

Gravity UI UIKit выпустил минорную версию [`v7.45.0`](https://github.com/gravity-ui/uikit/releases/tag/v7.45.0). Главные изменения — стабильные ключи для `List` и возможность рендерить элементы `Pagination` обычными ссылками или компонентом роутера. Кроме того, npm-архив теперь содержит документацию компонентов, `Accordion` снова корректно открывается с `defaultExpanded={false}`, а размеры `Button` и `Label` используют общие Sass-переменные.

Источник — [GitHub Release `v7.45.0`](https://github.com/gravity-ui/uikit/releases/tag/v7.45.0), [compare `v7.44.2...v7.45.0`](https://github.com/gravity-ui/uikit/compare/v7.44.2...v7.45.0) и diff связанных коммитов: [List](https://github.com/gravity-ui/uikit/commit/24ba33ded73ad4e4a3e3b4587c69b2c8ac33e9f3), [Pagination](https://github.com/gravity-ui/uikit/commit/878b19e5f9a20b872914ec5735cec8e38e1ca796), [документация в tarball](https://github.com/gravity-ui/uikit/commit/f348b10a1561879a65193269631af4df3bce9da2), [Accordion](https://github.com/gravity-ui/uikit/commit/6377bf18a29dadca0a0288396ede274602f0cd9a) и [Sass-переменные](https://github.com/gravity-ui/uikit/commit/7e7aee8d642e46cc978e6754a6e882c5c91147f9).

## `List.itemKey`: состояние элемента не теряется при фильтрации

У `ListProps` появился опциональный prop `itemKey?: (item) => string`. Если его не передать, компонент по-прежнему использует индекс элемента. Если передать функцию, результат становится ключом React-элемента, `draggableId` для сортируемого списка и `itemKey` для виртуализированного списка.

Это важно для элементов с собственным состоянием. При фильтрации или изменении порядка индекс может измениться, а стабильный идентификатор предметной области позволяет React сохранить нужный экземпляр компонента:

```tsx
import { List } from "@gravity-ui/uikit";

<List
  items={users}
  itemKey={user => user.id}
  filterItem={filter => user =>
    user.name.toLowerCase().includes(filter.toLowerCase())
  }
  renderItem={user => <UserRow user={user} />}
/>;
```

В исходном тесте релиза `StatefulItem` меняет внутреннее состояние по клику, после чего список фильтруется. При использовании `itemKey={(item) => item.name}` состояние строк не смешивается и не сбрасывается из-за нового индекса. Для служебного loading-элемента компонент сохраняет индексный ключ, а пользовательский callback вызывается только для обычных данных.

## `Pagination`: собственный элемент и props для ссылок

`PaginationProps` получил два связанных prop'а:

- `pageComponent?: PaginationPageComponent` — `"a"` или кастомный тип элемента из API `Button`;
- `getPageProps?: PaginationPagePropsGetter` — функция, которая получает `{item, page}` и возвращает props для конкретной кнопки страницы или навигационной кнопки.

Раньше кликабельные элементы пагинации всегда строились как кнопки. Теперь пагинацию можно подключить к URL-навигации:

```tsx
import { Pagination } from "@gravity-ui/uikit";
import type {
  PaginationPagePropsGetter,
  PaginationProps,
} from "@gravity-ui/uikit";

const getPageProps: PaginationPagePropsGetter = ({ page }) => ({
  href: `?page=${page}`,
});

const onUpdate: PaginationProps["onUpdate"] = () => {};

<Pagination
  page={1}
  pageSize={20}
  total={200}
  onUpdate={onUpdate}
  pageComponent="a"
  getPageProps={getPageProps}
/>;
```

Для роутера вместо `"a"` передаётся его компонент, а callback возвращает специфичный prop — например, `to` для `Link`:

```tsx
import { Link } from "react-router-dom";

<Pagination
  page={2}
  pageSize={20}
  total={200}
  onUpdate={onUpdate}
  pageComponent={Link}
  getPageProps={({ page }) => ({ to: `/users?page=${page}` })}
/>;
```

`getPageProps` вызывается для страниц и доступных навигационных кнопок. Он не применяется к многоточию, индикатору `page of`, текущему простому элементу в мобильной разметке и отключённым кнопкам. Если `pageComponent="a"`, для каждого кликабельного элемента нужен `href`; без него UIKit предупреждает и оставляет нативную кнопку.

Внутренние props пагинации имеют приоритет над результатом `getPageProps`: callback не может подменить `onClick`, `className`, `size`, `view`, `selected`, `disabled`, `qa`, `aria-current`, `extraProps` или `children`. Для текущей страницы при кастомном компоненте добавляется `aria-current="page"`; без `pageComponent` сохраняется прежний `aria-pressed`.

Обработчик клика учитывает семантику ссылок. Обычный клик в текущей вкладке вызывает `onUpdate`, а клик с Ctrl/Cmd/Shift/Alt, `target="_blank"` или отменённым событием не меняет состояние пагинации. Отключённые `first` и `previous` остаются `<button disabled>`, даже когда остальные элементы — ссылки.

## Документация попадает в npm-архив

Сборка пакета получила отдельную задачу `copy-docs`, которая вызывает `utils.buildDocs()` и добавлена в последовательность `build` после компиляции и копирования стилей. Поэтому документация компонентов теперь включается в публикуемый npm tarball, а не остаётся только в исходном репозитории.

Для потребителей библиотеки это упрощает просмотр README конкретного компонента после установки пакета и делает содержимое локального `node_modules` ближе к исходному репозиторию. В рамках этого изменения зависимость `@gravity-ui/gulp-utils` обновлена с `^1.0.3` до `^1.1.0`.

## Исправления

### `Accordion`: `defaultExpanded={false}` снова открывается

В `AccordionItem` исправлена граница между явным `defaultExpanded={false}` и отсутствующим prop. Раньше наличие любого значения `defaultExpanded` отключало обновление состояния через Accordion-контекст. В результате элемент, изначально закрытый с `defaultExpanded={false}`, не мог открыться по клику.

Теперь специальное поведение начального состояния применяется только при `defaultExpanded={true}`. Явный `false` оставляет элемент закрытым при первом рендере, но разрешает открыть его и корректно закрыть, когда открывается другой элемент в Accordion.

### Общие Sass-переменные для размеров `Button` и `Label`

Жёстко заданные высоты в `Button.scss` и `Label.scss` заменены ссылками на переменные из `src/components/variables.scss`:

- для `Button`: `$xs-height`, `$s-height`, `$m-height`, `$l-height`, `$xl-height`;
- для `Label`: `$xxs-height`, `$xs-height`, `$s-height`, `$m-height`.

В таблицу переменных добавлена `$xxs-height: 18px`; остальные значения сохраняют прежние размеры — `20`, `24`, `28`, `36` и `44px` в зависимости от компонента и размера. Runtime API не меняется, но Sass-тема теперь использует единый источник значений и может переопределять их согласованнее.

## Кому стоит обновиться

Релиз особенно полезен, если вы:

- фильтруете или сортируете `List` с дочерними компонентами, у которых есть локальное состояние;
- хотите, чтобы пагинация формировала обычные URL-ссылки или использовала `Link` вашего роутера;
- распространяете UIKit вместе с локальной документацией компонентов;
- используете `Accordion` с явным `defaultExpanded={false}`;
- поддерживаете собственную Sass-тему и хотите опираться на переменные высот компонентов.

Обновление:

```bash
pnpm add @gravity-ui/uikit@7.45.0
```

Или:

```bash
npm install @gravity-ui/uikit@7.45.0
```

## Ссылки

- [Release v7.45.0](https://github.com/gravity-ui/uikit/releases/tag/v7.45.0)
- [Compare v7.44.2...v7.45.0](https://github.com/gravity-ui/uikit/compare/v7.44.2...v7.45.0)
- [PR #2739: `List.itemKey`](https://github.com/gravity-ui/uikit/pull/2739)
- [PR #2701: кастомный компонент в `Pagination`](https://github.com/gravity-ui/uikit/pull/2701)
- [PR #2740: документация в npm tarball](https://github.com/gravity-ui/uikit/pull/2740)
- [Репозиторий gravity-ui/uikit](https://github.com/gravity-ui/uikit)

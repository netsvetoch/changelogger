---
author: Артём Нецветаев
pubDatetime: 2026-08-25T11:50:34.000Z
title: "Gravity UI Icons 2.22.0: категории иконок в metadata.json"
slug: gravity-ui-icons-v2-22-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - icons
description: "Что меняется в @gravity-ui/icons v2.22.0: каждому значку в metadata.json добавляется поле categories: string[], которое парсится из Figma-свойства category, с fallback-категорией unassigned и предупреждением в консоли синхронизации."
---

Минорный релиз [`@gravity-ui/icons v2.22.0`](https://github.com/gravity-ui/icons/releases/tag/v2.22.0) содержит один feature-пункт — `add icon categories to metadata.json`. За ним стоит [PR #104](https://github.com/gravity-ui/icons/pull/104), влитый коммитом [`0445c6f`](https://github.com/gravity-ui/icons/commit/0445c6f7bd6869187a3fbda4661ae44fa0af79b0). Это не выпуск новых имён для импорта, а расширение метаданных пакета: теперь готовый для фильтрации набор категорий приезжает прямо в `metadata.json`, не дожидаясь следующей синхронизации.

Публичные экспорты, props и способы импорта иконок в релизе не меняются. Меняется структура данных пакета.

## Поле categories в metadata.json

Раньше каждая запись иконки в `metadata.json` несла `name`, `style`, `svgName`, `componentName` и `keywords`. PR #104 добавляет к каждому элементу поле `categories: string[]`. Выглядит это так:

```json
{
  "name": "people",
  "style": "regular",
  "svgName": "people",
  "componentName": "People",
  "keywords": [],
  "categories": ["people"]
}
```

Источник данных — новое свойство `category` в Figma-файле. Скрипт `src:download` (`scripts/download.mjs`) разбирает его так же, как `style` и `keywords`, из строки свойств варианта иконки:

- одиночная категория: `style=regular, keywords=-, category=people` → `["people"]`;
- несколько категорий через пробел: `category=shapes status` → `["shapes", "status"]`;
- отсутствующее или пустое (`-`) свойство → fallback `["unassigned"]`, причём синхронизация не падает, а лишь выводит предупреждение — ровно по образцу обработки пустых `keywords`.

Реализацию fallback вынесли в константу [`UNASSIGNED_CATEGORY = 'unassigned'`](https://github.com/gravity-ui/icons/blob/0445c6f7bd6869187a3fbda4661ae44fa0af79b0/scripts/constants.mjs), а в `scripts/download.mjs` переименовали `EMPTY_KEYWORDS_STRING` в более общий `EMPTY_PROPERTY_VALUE` (поскольку тот же маркер `-` теперь используется и для категорий). После синхронизации при наличии бескатегорийных иконок печатается `console.warn` со списком их `svgName`.

## Что внутри синхронизированного файла

`metadata.json` на теге `v2.22.0` уже регенерирован из текущего состояния Figma-файла, поэтому категории пригодны сразу:

- 799 записей иконок (тот же размер и порядок, что и в предыдущем `metadata.json`);
- 27 различных категорий — от `arrows`, `shapes`, `transport` и `weather` до `commerce`, `finance`, `security` и `development`;
- 249 иконок отнесены сразу к нескольким категориям;
- пустых значений нет — ни один значок не оказался в fallback-категории `unassigned`.

Сверка показала, что кроме нового поля `categories` изменились только keyword-правки из Figma с прошлой синхронизации (`circle-question` получил `help support`, у `snowflake` исчез завершающий пустой keyword). Файлам `svgs/` и React-компонентам в `lib/` это не затрагивает.

## Кому это нужно

Категории вводятся под фильтрацию на gravity-ui.com (страница `/icons`): дизайн-система сможет группировать и фильтровать иконки по смыслу, не держа собственную таблицу соответствий. Для потребителей пакета это в первую очередь удобство работы с `metadata.json` как источником истины о наборе иконок.

## Как обновиться

Breaking changes в release notes и связанных правках нет. Для получения новых метаданных достаточно обновить зависимость:

```bash
pnpm add @gravity-ui/icons@2.22.0
```

Если вы работаете с `metadata.json` напрямую (например, для автогенерации списков, поиска или UI-фильтров), после обновления учтите новое поле `categories: string[]` в своих типах и регулярно читающих этот файл запросах.

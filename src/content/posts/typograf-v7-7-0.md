---
author: Артём Нецветаев
pubDatetime: 2026-06-29T02:00:59.000Z
title: "Typograf 7.7.0: правило en-GB/dash/main для британского английского"
slug: typograf-v7-7-0
featured: false
draft: false
tags:
  - release
  - typograf
  - typography
description: "Разбор Typograf 7.7.0: новый rule en-GB/dash/main подключает для locale en-GB ту же замену дефисов вокруг пробелов на длинное тире, что раньше была доступна для en-US."
---

[`typograf` 7.7.0](https://github.com/typograf/typograf/releases/tag/v7.7.0) — точечный минорный релиз про поддержку британского английского в правилах для тире. GitHub Release формулирует изменение коротко: добавлено правило `en-GB/dash/main`, аналогичное `en-US/dash/main`. Поэтому я проверил compare [`v7.6.0...v7.7.0`](https://github.com/typograf/typograf/compare/v7.6.0...v7.7.0), коммит [`8b27fe4`](https://github.com/typograf/typograf/commit/8b27fe4e6dea41456cea80aef97142e6dd6fbd7e) и новые файлы `src/rules/en-GB/dash/*`.

Практический смысл релиза: если проект уже типографирует тексты с `locale: ['en-GB']`, теперь английское правило для замены дефиса на длинное тире включается штатно через британскую локаль, а не только через `en-US` или ручное подключение правила.

## Что именно добавлено

В 7.7.0 появился новый rule-файл `src/rules/en-GB/dash/main.ts`. Он не дублирует регулярное выражение, а переиспользует реализацию из `en-US/dash/main` и меняет только имя правила:

```ts
import type { TypografRule } from "../../../main";
import { mainRule as mainRuleEnUS } from "../../en-US/dash/main";

export const mainRule: TypografRule = {
  ...mainRuleEnUS,
  name: "en-GB/dash/main",
};
```

`en-US/dash/main` ищет дефис или двойной дефис из набора `common/dash`, если он окружён обычными или неразрывными пробелами, и заменяет левый пробел на `\u00A0`, а сам дефис — на em dash `\u2014`. Другими словами, строка `word - word` превращается в `word — word`, где перед тире стоит неразрывный пробел.

## Как меняется поведение для `locale: ['en-GB']`

До 7.7.0 таблицы правил содержали `en-US/dash/main`, но не содержали отдельного dash-rule для `en-GB`. В релизном коммите добавлены:

- `src/rules/en-GB/dash/index.ts`, который регистрирует `mainRule` через `Typograf.addRules([...])`;
- `src/rules/en-GB/index.ts`, который подключает группу `dash`;
- импорт `./en-GB/index` в общем `src/rules/index.ts`;
- строки в `docs/RULES.en-US.md`, `docs/RULES.ru.md` и отсортированных списках правил.

После обновления rule отображается в документации как `en-GB/dash/main` с индексом `305`, группой `default` и отметкой включения по умолчанию. Описание совпадает с американским правилом: “Replace hyphens surrounded by spaces with an em-dash” / «Замена дефиса на длинное тире».

Минимальный пример для Node.js:

```js
import Typograf from "typograf";

const tp = new Typograf({ locale: ["en-GB"] });

console.log(tp.execute("What is serious - and what is not"));
// What is serious — and what is not
```

Это важно для сайтов и CMS, которые принципиально указывают британскую локаль отдельно от американской: теперь им не нужно добавлять `en-US` только ради базового правила для английского тире.

## Какие случаи покрыты тестами

Новый тест `src/rules/en-GB/dash/main.test.ts` фиксирует три сценария:

```ts
typografRuleTest([
  "en-GB/dash/main",
  [
    [
      "What is serious - and what is not",
      "What is serious\u00A0— and what is not",
    ],
    [
      "What is serious -\nand what is not",
      "What is serious\u00A0—\nand what is not",
    ],
    [
      "What is serious -- and what is not",
      "What is serious\u00A0— and what is not",
    ],
  ],
]);
```

То есть правило обрабатывает одиночный дефис между пробелами, дефис перед переносом строки и двойной дефис `--`. Во всех случаях перед длинным тире появляется `\u00A0`, чтобы тире не оторвалось от предыдущего слова при переносе строки.

## Что ещё попало в compare

В compare `v7.6.0...v7.7.0` также есть служебные изменения: bump версии пакета до `7.7.0`, обновления dev-зависимостей в `package.json`/`package-lock.json` и изменение `declarationDir` в `tsconfig.json` на `./build/`. В release body они не выделены как пользовательские изменения; пользовательская часть релиза — именно новое правило `en-GB/dash/main` и его регистрация в общем наборе правил.

## Итог

Typograf 7.7.0 стоит поставить проектам, которые типографируют английские тексты под `en-GB` и ожидают такое же поведение тире, как у `en-US`. Изменение небольшое, но оно убирает локализационный разрыв: британская локаль теперь получает собственное правило `en-GB/dash/main`, зарегистрированное в `default`-наборе и покрытое тестами на основные варианты дефиса.

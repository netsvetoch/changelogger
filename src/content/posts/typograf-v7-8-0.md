---
author: Артём Нецветаев
pubDatetime: 2026-08-14T21:59:14.000Z
title: "Typograf 7.8.0: немецкая локаль в common/nbsp/afterShortWordByList"
slug: typograf-v7-8-0
featured: false
draft: false
tags:
  - release
  - typograf
  - typography
description: "Разбор Typograf 7.8.0: в data de/shortWord появился список немецких коротких слов, и правило common/nbsp/afterShortWordByList ставит неразрывный пробел после них при locale de."
---

[`typograf` 7.8.0](https://github.com/typograf/typograf/releases/tag/v7.8.0) — минорный релиз про немецкую типографику коротких слов. GitHub Release формулирует изменение одной строкой: добавлена поддержка немецкой локали в правиле `common/nbsp/afterShortWordByList`. Поэтому я сверил compare [`v7.7.0...v7.8.0`](https://github.com/typograf/typograf/compare/v7.7.0...v7.8.0), коммит [`79e82d06`](https://github.com/typograf/typograf/commit/79e82d060f12cacfd430fea25fe7575d4365c938), `src/data/de.ts` и сам handler правила.

Практический смысл: если вы типографируете немецкий текст с `locale: ['de']`, после коротких служебных слов (артикли, предлоги, союзы из списка) обычный пробел заменяется на неразрывный `\u00A0`, чтобы короткое слово не оставалось одиноким в конце строки.

## Что именно изменилось

Само правило `common/nbsp/afterShortWordByList` в 7.8.0 не переписывали. Оно уже брало locale-данные `shortWord` через `context.getData('shortWord')` и строило regex вида «короткое слово + пробел → короткое слово + NBSP»:

```ts
export const afterShortWordByListRule: TypografRule<{
  lengthShortWord: number;
}> = {
  name: "common/nbsp/afterShortWordByList",
  handler(text, _, context) {
    const quote = getData("common/quote") as DataCommonQuote;
    const shortWord = context.getData("shortWord") as DataChar | undefined;
    const before = " \\u00A0(" + privateLabel + quote;
    const subStr = "(^|[" + before + "])(" + shortWord + ") ";
    const newSubStr = "$1$2\\u00A0";
    const re = new RegExp(subStr, "gim");

    return text.replace(re, newSubStr).replace(re, newSubStr);
  },
};
```

До 7.8.0 в `src/data/de.ts` были только `de/char` и `de/quote`. Ключа `de/shortWord` не было, поэтому для `locale: ['de']` правило фактически не находило список коротких слов и не вставляло NBSP по этому списку.

В 7.8.0 в немецкие data добавлен список:

```ts
export default {
  "de/char": "a-zßäöü",
  "de/quote": {
    left: "„‚",
    right: "“‘",
  },
  "de/shortWord":
    "ab|aber|als|am|an|ans|auf|aufs|aus|bei|beim|bis|da|das|dass|dem|den|denn|der|des|die|doch|ein|eine|für|fürs|im|in|ins|mit|nach|ob|oder|ohne|seit|so|über|um|ums|und|vom|von|vor|weil|wenn|wie|zu|zum|zur",
};
```

Это тот же паттерн, что уже давно используется для других локалей: например, `ru/shortWord` перечисляет «а|без|в|во|…», а правило `common/nbsp/afterShortWordByList` работает поверх этих data.

## Как это выглядит на немецком тексте

Новый блок в `src/rules/common/nbsp/afterShortWordByList.test.ts` фиксирует поведение именно для `{locale: 'de'}`:

```ts
typografRuleTest([
  "common/nbsp/afterShortWordByList",
  [
    [
      "Ich fahre mit dem Zug über Hamburg nach Berlin.",
      "Ich fahre mit\\u00A0dem\\u00A0Zug über\\u00A0Hamburg nach\\u00A0Berlin.",
    ],
    [
      "Das ist ein Test für die deutsche Sprache.",
      "Das\\u00A0ist ein\\u00A0Test für\\u00A0die\\u00A0deutsche Sprache.",
    ],
    ["Er fährt heute schnell.", "Er fährt heute schnell."],
  ],
  { locale: "de" },
]);
```

Что здесь важно:

- `mit`, `dem`, `über`, `nach`, `Das`, `ein`, `für`, `die` есть в `de/shortWord`, поэтому пробел после них становится `\u00A0`.
- Цепочка «короткое слово + пробел + следующее короткое слово» обрабатывается повторным `replace` в handler, поэтому в первом примере появляются и `mit\u00A0dem\u00A0Zug`, и `für\u00A0die`.
- `Er`, `fährt`, `heute`, `schnell` в список не входят, поэтому третья фраза не меняется.

Минимальный пример для приложения:

```js
import Typograf from "typograf";

const tp = new Typograf({ locale: ["de"] });

console.log(tp.execute("Das ist ein Test für die deutsche Sprache."));
// Das ist ein Test für die deutsche Sprache.
```

Если проект держит немецкий контент под отдельной локалью `de`, после обновления до 7.8.0 это правило начинает работать без кастомного списка short words.

## Что ещё попало в compare

В `v7.7.0...v7.8.0` три коммита:

1. [`79e82d06`](https://github.com/typograf/typograf/commit/79e82d060f12cacfd430fea25fe7575d4365c938) — пользовательское изменение: `de/shortWord`, тесты, changelog, bump версии.
2. [`4a772afe`](https://github.com/typograf/typograf/commit/4a772afeb4f2e11f315638068b6a505fa0acfc87) — добавлен `AGENTS.md` с картой репозитория и правилами для агентов/контрибьюторов.
3. [`166c8c9e`](https://github.com/typograf/typograf/commit/166c8c9e7cde9dca2993374f518328f6194fa10e) — CI: `actions/checkout` и `actions/setup-node` обновлены до v6, в одной job matrix Node.js сдвинут на `26.x`.

В release body пользовательским пунктом названа только немецкая поддержка short-word NBSP; `AGENTS.md` и CI — служебные.

## Итог

Typograf 7.8.0 стоит поставить, если вы уже используете `locale: ['de']` или готовите немецкий контент и хотите, чтобы артикли, предлоги и союзы из `de/shortWord` не отрывались от следующего слова при переносе строки. Изменение точечное: handler `common/nbsp/afterShortWordByList` прежний, а для немецкой локали наконец появились data, без которых правило не могло работать.

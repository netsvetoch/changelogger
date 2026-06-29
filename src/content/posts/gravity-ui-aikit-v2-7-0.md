---
author: Артём Нецветаев
pubDatetime: 2026-06-29T00:56:55.000Z
title: "@gravity-ui/aikit 2.7.0: сообщение рядом с Loader и общие CSS-переменные ActionPopup"
slug: gravity-ui-aikit-v2-7-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
description: "Разбор минорного релиза @gravity-ui/aikit v2.7.0: у Loader появился prop message, MessageList прокидывает loaderMessage в футер, а CSS-переменные ActionPopup перенесены в common.css."
---

`@gravity-ui/aikit` выпустил минорный релиз [`v2.7.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.7.0). В changelog всего два пункта, но оба затрагивают интеграцию UI: лоадер теперь умеет показывать текст рядом с индикатором, а переменные ширины `ActionPopup` стали частью общего CSS-теминга пакета.

Источник для обзора — GitHub Release [`gravity-ui/aikit@v2.7.0`](https://github.com/gravity-ui/aikit/releases/tag/v2.7.0), compare [`v2.6.2...v2.7.0`](https://github.com/gravity-ui/aikit/compare/v2.6.2...v2.7.0), PR [`#193`](https://github.com/gravity-ui/aikit/pull/193), merge commit [`551eca3`](https://github.com/gravity-ui/aikit/commit/551eca339986cbd50b3e075a52cf9252b4637761) и commit [`be5ef8d`](https://github.com/gravity-ui/aikit/commit/be5ef8dabec5d9f34f48a4e394324e973b6c945f).

## `Loader` получил optional `message`

Главное публичное изменение находится в `src/components/atoms/Loader/Loader.tsx`: в `LoaderProps` добавлено поле `message?: string`. До `2.7.0` компонент возвращал либо streaming-разметку из трёх блоков, либо `Spin` из `@gravity-ui/uikit`; текстового состояния рядом с индикатором в API не было.

В новой версии компонент сначала собирает прежний `loader`, а затем, если `message` не передан, возвращает его без дополнительной обёртки. Это важно для обратной совместимости: существующие `<Loader />`, `<Loader view="loading" />`, `size`, `className` и `qa` продолжают рендериться старым способом.

Если `message` есть, `Loader` оборачивает индикатор и текст в `Flex gap={2}`, а сам текст выводит через `Text` из `@gravity-ui/uikit` с `variant="body-1"` и `color="secondary"`:

```tsx
import { Loader } from "@gravity-ui/aikit";

export function WaitingForModel() {
  return (
    <Loader
      view="streaming"
      size="s"
      message="Вопрос со звёздочкой — позвали умную модель, ей нужно больше времени"
    />
  );
}
```

Именно такой сценарий добавлен в Storybook как `WithMessage`: `view="streaming"` плюс русскоязычная подсказка о долгом ответе модели. Для визуальной регрессии появился отдельный тест `should render with message` и PNG-снэпшот `Loader-should-render-with-message-chromium.png`.

## `MessageList` прокидывает `loaderMessage` до футера

Новый текстовый лоадер сразу подключили к более высокоуровневому компоненту чата. В `src/components/organisms/MessageList/MessageList.tsx` тип `MessageListProps` получил `loaderMessage?: string`; `PlainMessageList` принимает этот prop и передаёт его в `MessageListFooter`.

В `MessageListFooterProps` также появилось `loaderMessage?: string`, а место рендера лоадера изменилось с простого:

```tsx
{
  showLoader && <Loader className={b("loader")} />;
}
```

на вариант, который сохраняет прежний `className`, но добавляет сообщение:

```tsx
{
  showLoader && <Loader className={b("loader")} message={loaderMessage} />;
}
```

Практический эффект для приложений с AI-чатом: когда список сообщений находится в `streaming`, `streaming_loading` или другом состоянии, где футер показывает `showLoader`, рядом с индикатором можно вывести человекочитаемое объяснение задержки. Отдельный renderer сообщений для этого писать не нужно — достаточно передать строку в `MessageList`.

```tsx
import { MessageList } from "@gravity-ui/aikit";

<MessageList
  messages={messages}
  status="streaming"
  loaderMessage="Модель формирует ответ, это может занять несколько секунд"
/>;
```

Документация `MessageList` тоже обновлена: в таблице props появилась строка `loaderMessage | string | - | - | Loader message next to a loader`. Это подтверждает, что изменение предназначено именно как публичная настройка списка сообщений, а не только внутренний prop `Loader`.

## CSS-переменные `ActionPopup` переехали в `common.css`

Второй пункт релиза — bug fix `css-variables: move css variables to common.css`. Diff commit [`be5ef8d`](https://github.com/gravity-ui/aikit/commit/be5ef8dabec5d9f34f48a4e394324e973b6c945f) показывает конкретный перенос: в `src/themes/common.css` добавлены две переменные под секцией `Action Popup`.

```css
--g-aikit-action-popup-min-width: 280px;
--g-aikit-action-popup-max-width: 400px;
```

Это не меняет имена переменных и не добавляет новый компонент, но меняет место, где базовые значения объявляются. Если приложение подключает общий CSS-теминг `@gravity-ui/aikit`, `ActionPopup` получает дефолтные ограничения ширины из `common.css`: минимальная ширина `280px`, максимальная `400px`.

Для дизайн-систем и shell-приложений это снижает риск ситуации, когда компонент использует CSS custom properties, а базовые значения не попали в итоговый bundle из-за подключения только общего theme entrypoint. Если вы переопределяли эти переменные на уровне своего theme layer, имена остаются прежними — проверьте только порядок подключения CSS, чтобы ваши значения продолжали идти после `common.css`.

## Что проверить при обновлении

Обновление выглядит совместимым: `message` и `loaderMessage` опциональны, а старый рендер без текста сохраняется. Тем не менее после перехода на `@gravity-ui/aikit@2.7.0` стоит проверить три места:

- экраны ожидания ответа модели: теперь вместо отдельной подписи рядом с лоадером можно использовать `Loader message` или `MessageList loaderMessage`;
- визуальные тесты вокруг `MessageListFooter`: при переданном `loaderMessage` в DOM появится `Flex`-обёртка и `Text` рядом с индикатором;
- CSS-бандл темы: `--g-aikit-action-popup-min-width` и `--g-aikit-action-popup-max-width` должны приходить из `common.css`, а локальные overrides — применяться после него.

Установка версии остаётся обычной:

```bash
npm install @gravity-ui/aikit@2.7.0
```

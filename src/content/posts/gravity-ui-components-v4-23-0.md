---
author: Артём Нецветаев
pubDatetime: 2026-07-14T12:37:10.000Z
title: "@gravity-ui/components 4.23.0: Gallery встраивается в страницу, TokenizedInput получает размеры"
slug: gravity-ui-components-v4-23-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
description: "Разбор @gravity-ui/components v4.23.0: Gallery получил inline-режим и управляемый активный элемент, а TokenizedInput — размеры m, l и xl."
---

В [`@gravity-ui/components v4.23.0`](https://github.com/gravity-ui/components/releases/tag/v4.23.0) появились два изменения публичного API: `Gallery` теперь можно рендерить прямо внутри страницы и управлять выбранным элементом извне, а `TokenizedInput` поддерживает три размера.

Источник — [GitHub Release v4.23.0](https://github.com/gravity-ui/components/releases/tag/v4.23.0), [compare `v4.22.0...v4.23.0`](https://github.com/gravity-ui/components/compare/v4.22.0...v4.23.0), [PR #397](https://github.com/gravity-ui/components/pull/397) и [PR #398](https://github.com/gravity-ui/components/pull/398).

## Gallery: inline-режим вместо обязательной модалки

Раньше `Gallery` всегда размещал содержимое внутри `Modal`. В `v4.23.0` появился проп `view` со значениями `"modal"` и `"inline"`; по умолчанию сохраняется `"modal"`.

В режиме `inline` компонент возвращает обычный корневой `div` и заполняет размер родительского контейнера. `open`, `onOpenChange` и `container` относятся только к модальному режиму, а встроенная галерея не показывает кнопку закрытия: видимость контролирует родитель, например через размонтирование компонента. Размер родителя нужно задать самостоятельно.

```tsx
<div
  style={{
    width: "100%",
    maxWidth: 640,
    aspectRatio: "16 / 10",
    overflow: "hidden",
  }}
>
  <Gallery view="inline">
    <GalleryItem
      {...itemProps}
      actions={[
        {
          id: "close",
          title: "Закрыть",
          icon: <XmarkIcon />,
          onClick: onClose,
        },
      ]}
    />
  </Gallery>
</div>
```

Для inline-режима из `Gallery` также убираются модальные действия полноэкранного режима и закрытия. При этом навигация между элементами, мобильные swipe-жесты, интерактивный просмотр и действия `GalleryItem` остаются частью содержимого. В `GalleryItem` добавлен необязательный `id`: он даёт превью стабильную идентичность при изменении списка.

## Управляемый активный элемент Gallery

Активный индекс по-прежнему можно задать начальным значением через `initialItemIndex`. Для контролируемого сценария теперь доступны:

- `activeItemIndex?: number` — текущий позиционный индекс, передаваемый родителем;
- `onActiveItemIndexChange?: (index: number) => void` — уведомление о следующем индексе.

В контролируемом режиме `Gallery` не меняет индекс самостоятельно: после клика или нажатия стрелки вызывается callback, а новое значение приходит через `activeItemIndex`. Индекс ограничивается диапазоном существующих элементов; при пустом списке он равен `0`, а навигация по кругу сохраняется.

```tsx
const [index, setIndex] = React.useState(0);

<Gallery
  activeItemIndex={index}
  onActiveItemIndexChange={setIndex}
  open={open}
  onOpenChange={setOpen}
>
  {items.map(item => (
    <GalleryItem
      key={item.id}
      id={item.id}
      view={<img src={item.src} alt={item.title} />}
      thumbnail={<img src={item.thumbnail} alt="" />}
      name={item.title}
    />
  ))}
</Gallery>;
```

Индекс остаётся позиционным. Если родитель добавляет или удаляет элементы, он должен сам переназначить `activeItemIndex` на нужный элемент. Стабильный `GalleryItem.id` помогает сохранить соответствие превью их элементам при таких изменениях; `key` в React-примере также должен быть стабильным.

Изменение затрагивает и клавиатурную навигацию: в модальном режиме обработчик остаётся на `document`, а в inline-режиме ограничивается контейнером конкретной галереи. Поэтому стрелки одной встроенной галереи не должны переключать другую.

## TokenizedInput: размеры `m`, `l` и `xl`

`TokenizedInput` получил проп `size?: TokenizedInputSize`, где тип экспортируется как:

```ts
export type TokenizedInputSize = "m" | "l" | "xl";
```

Значение по умолчанию — `"m"`. Размер применяется не только к внешнему полю: он передаётся в список подсказок, меняет высоту токенов, размеры кнопок удаления и очистки, внутренние отступы, радиусы и типографику.

```tsx
<TokenizedInput
  size="xl"
  fields={fields}
  value={value}
  onChange={setValue}
  placeholder="Добавить фильтр"
/>
```

Поддерживаемые варианты имеют следующие базовые размеры токенов:

| Значение | Высота токена | Размер кнопки очистки | Размер кнопки удаления |
| -------- | ------------: | --------------------- | ---------------------- |
| `m`      |         24 px | `s`                   | `m`                    |
| `l`      |         30 px | `m`                   | `m`                    |
| `xl`     |         38 px | `l`                   | `l`                    |

Для `l` и `xl` меняются также размеры и отступы элементов popup-подсказок. Значение прокидывается через внутреннее состояние `TokenizedInput` в `SuggestionsList`, так что поле и список подсказок остаются визуально согласованными. В API утилит добавлены `getTokenizedInputClearButtonSize` и `getTokenizedInputRemoveButtonSize`, возвращающие размер кнопки Gravity UI для выбранного значения.

## Итог

Релиз закрывает два разных сценария настройки компонентов:

- `Gallery view="inline"` подходит для просмотрщика, встроенного в карточку, боковую панель или другой заранее размеченный контейнер;
- `activeItemIndex` и `onActiveItemIndexChange` позволяют синхронизировать просмотр с состоянием приложения;
- `TokenizedInput size="l"` или `size="xl"` помогает согласовать поле и подсказки с остальными контролами интерфейса.

Для существующего кода миграция не требуется: модальный `Gallery` без `view` и `TokenizedInput` без `size` сохраняют прежнее поведение.

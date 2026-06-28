---
author: Artem Netsvetaev
pubDatetime: 2026-06-28T13:44:37.000Z
title: "Gravity UI UIKit 7.42.0: FileDropZone, Drawer без анимации и safe-area для Sheet"
slug: gravity-ui-uikit-v7-42-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - uikit
description: "Обзор Gravity UI UIKit v7.42.0: новый API FileDropZone для accepted/rejected файлов, disableTransition у Drawer, safe-area padding в Sheet и CSS-переменная цвета для Spin."
---

Gravity UI UIKit выпустил [`v7.42.0`](https://github.com/gravity-ui/uikit/releases/tag/v7.42.0). Релиз опубликован 10 июня 2026 года и выглядит небольшим, но в нём есть несколько практичных изменений для продуктовых интерфейсов: лучшее поведение drag-and-drop загрузки файлов, Drawer без transition-анимаций, корректные отступы Sheet на устройствах с safe area и настраиваемый цвет `Spin` через CSS.

Источник для обзора — GitHub Release [`gravity-ui/uikit@v7.42.0`](https://github.com/gravity-ui/uikit/releases/tag/v7.42.0) и связанные изменения в коде.

## Что нового

### FileDropZone теперь явно разделяет принятые и отклонённые файлы

Самое объёмное изменение релиза — переработка `FileDropZone` из unstable API ([#2614](https://github.com/gravity-ui/uikit/issues/2614), коммит [`50985c3`](https://github.com/gravity-ui/uikit/commit/50985c31b35b603de0670a6da02d5776c63b6c9f)). Раньше `onUpdate` получал только список файлов и не вызывался, если файл не подходил по типу. В `v7.42.0` компонент стал возвращать и accepted, и rejected элементы.

Новый тип rejected-элемента:

```ts
export type DropZoneFileRejection = {
  file: File;
  reasons: ("invalid-type" | "too-many-files")[];
};
```

У `FileDropZoneProps` появились отдельные коллбэки:

```ts
onUpdate?: (
  acceptedItems: File[],
  rejectedItems: DropZoneFileRejection[]
) => void;
onUpdateAccepted?: (items: File[]) => void;
onUpdateRejected?: (items: DropZoneFileRejection[]) => void;
```

Практический пример: можно принять изображения, а пользователю сразу показать, почему остальные файлы не прошли проверку.

```tsx
import {
  unstable_FileDropZone as FileDropZone,
  type DropZoneFileRejection,
} from "@gravity-ui/uikit/unstable";

function UploadZone() {
  const handleRejected = (items: DropZoneFileRejection[]) => {
    for (const { file, reasons } of items) {
      console.warn(`${file.name}: ${reasons.join(", ")}`);
    }
  };

  return (
    <FileDropZone
      accept={["image/*"]}
      multiple={false}
      onUpdateAccepted={files => uploadImages(files)}
      onUpdateRejected={handleRejected}
    />
  );
}
```

Валидация поддерживает точные MIME-типы и wildcard верхнего уровня вроде `image/*`. Если `multiple={false}`, первый подходящий файл принимается, а следующие попадают в rejected с причиной `too-many-files`. Для неподходящего MIME-типа используется причина `invalid-type`.

Изменился и визуальный фидбек: внутри компонента появился state `isInvalidDrag`, который включается, когда drag-событие не содержит ни одного подходящего файла. Корневой элемент также получил `data-qa`, `aria-disabled`, корректный `tabIndex`, внутренний `<input type="file">` с `multiple` и `accept`, а клик по зоне теперь сам открывает file picker.

Отдельно обновился хук `useDropZone`: он больше не занимается MIME-фильтрацией сам, а отдаёт drag/drop lifecycle наружу через `onDragEnter`, `onDragOver`, `onDragLeave` и `onDrop`. Это делает хук более низкоуровневым: фильтрацию можно реализовать в компоненте, как это теперь делает `FileDropZone`.

### Drawer можно показывать без анимации

У `Drawer` появился prop `disableTransition?: boolean` ([#2691](https://github.com/gravity-ui/uikit/issues/2691), коммит [`dbdd1a6`](https://github.com/gravity-ui/uikit/commit/dbdd1a6245b04fef6a90eaaa79866d46c3156037)). По умолчанию поведение прежнее: Drawer выезжает и скрывается с transition. Если передать `disableTransition`, длительность анимации становится `0ms`.

```tsx
import { Drawer } from "@gravity-ui/uikit";

function InstantDrawer({ open, setOpen }: Props) {
  return (
    <Drawer open={open} onOpenChange={setOpen} disableTransition>
      <p>Content of the drawer</p>
    </Drawer>
  );
}
```

В реализации это сделано не отдельной веткой компонента, а через общий animation duration: `useTransition` получает `duration: 0`, а SCSS использует внутреннюю переменную `--_--animation-duration` вместо фиксированных `300ms` для `transform` и backdrop `background-color`.

Где это полезно:

- в визуальных тестах и storybook-сценариях, где анимация мешает стабильным скриншотам;
- в интерфейсах, где Drawer должен появляться мгновенно при переключении layout/state;
- в продуктах, которые отдельно управляют motion-политикой или accessibility-настройками.

### Sheet учитывает safe-area отступы

`Sheet` получил безопасные отступы для устройств с вырезами и системными gesture areas ([#2699](https://github.com/gravity-ui/uikit/issues/2699), коммит [`c546e6e`](https://github.com/gravity-ui/uikit/commit/c546e6eb16e23987a390f550e297b150fe98fbcc)). Изменение находится в CSS-переменной `--g-sheet-content-padding`: если пользователь не задаёт своё значение, дефолт теперь включает `env(safe-area-inset-*)`.

Новый fallback выглядит так:

```scss
padding: var(
  --g-sheet-content-padding,
  0 max(10px, env(safe-area-inset-right, 0px)) env(safe-area-inset-bottom, 0px)
    max(10px, env(safe-area-inset-left, 0px))
);
```

То есть:

- сверху остаётся `0`;
- слева и справа берётся максимум между `10px` и соответствующим safe-area inset;
- снизу добавляется `env(safe-area-inset-bottom, 0px)`.

Важно, что API кастомизации не ломается: если в проекте уже задан `--g-sheet-content-padding`, это значение по-прежнему переопределяет дефолт. Просто стандартное поведение стало лучше для мобильных устройств, особенно для bottom sheet на iPhone-like viewport'ах.

### Spin получил CSS-переменную цвета

У `Spin` появился CSS API для цвета ([#2688](https://github.com/gravity-ui/uikit/issues/2688), коммит [`460de54`](https://github.com/gravity-ui/uikit/commit/460de54efd77fad51652967ceb91d238316159a3)). Раньше border spinner'а был завязан на токен `--g-color-line-brand`; теперь используется переменная `--g-spin-color` с fallback на `--g-color-base-brand`.

```css
.my-loader {
  --g-spin-color: #ff3d64;
}
```

```tsx
import { Spin } from "@gravity-ui/uikit";

export function CustomLoader() {
  return <Spin className="my-loader" size="l" />;
}
```

Это небольшое изменение, но оно полезно для локального styling'а: цвет можно менять на уровне className или контейнера без обёртки над компонентом и без переопределения внутренних селекторов.

## Кому стоит обновиться

Релиз особенно интересен, если вы:

- используете `unstable_FileDropZone` и хотите различать accepted/rejected файлы без собственной обвязки вокруг drop event;
- пишете визуальные тесты или сложные сценарии с `Drawer`, где transition-анимация мешает;
- показываете `Sheet` на мобильных устройствах и хотите корректные safe-area отступы по умолчанию;
- кастомизируете `Spin` под локальный контекст, брендовый акцент или состояние загрузки.

В changelog нет breaking changes, но у `FileDropZone` и `useDropZone` изменились типы и форма коллбэков. Если проект использует unstable API напрямую, после обновления стоит проверить TypeScript-ошибки именно в местах загрузки файлов и drag-and-drop.

## Как обновиться

```bash
pnpm add @gravity-ui/uikit@7.42.0
```

Или через npm:

```bash
npm install @gravity-ui/uikit@7.42.0
```

После обновления стоит прогнать типизацию, линтер и visual/e2e тесты для сценариев с загрузкой файлов, `Drawer` и мобильным `Sheet`. Для `FileDropZone` отдельно проверьте сценарии неподходящего MIME-типа и single-file режима: теперь они могут попадать в `onUpdateRejected` с конкретной причиной.

## Ссылки

- [Release v7.42.0](https://github.com/gravity-ui/uikit/releases/tag/v7.42.0)
- [Compare v7.41.0...v7.42.0](https://github.com/gravity-ui/uikit/compare/v7.41.0...v7.42.0)
- [Репозиторий gravity-ui/uikit](https://github.com/gravity-ui/uikit)

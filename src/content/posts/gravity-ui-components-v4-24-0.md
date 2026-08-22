---
author: Артём Нецветаев
pubDatetime: 2026-08-22T21:38:47.000Z
title: "@gravity-ui/components 4.24.0: ChangelogDialog становится адаптивным и получает modalClassName"
slug: gravity-ui-components-v4-24-0
featured: false
draft: false
tags:
  - release
  - gravity-ui
  - react
description: "Разбор минорного релиза @gravity-ui/components v4.24.0: ChangelogDialog переведён на CSS-переменные максимального размера и получил prop modalClassName для поинстансной настройки ширины модалки через переменные Modal (PR #403 и #405)."
---

В [`@gravity-ui/components v4.24.0`](https://github.com/gravity-ui/components/releases/tag/v4.24.0) оба изменения касаются компонента `ChangelogDialog` — диалога со списком версий и ссылкой на полный changelog. Диалог стал адаптивным за счёт CSS-переменных максимального размера и получил новый prop `modalClassName`, через который модалку можно настраивать поинстансно.

Источник — [GitHub Release v4.24.0](https://github.com/gravity-ui/components/releases/tag/v4.24.0), [compare `v4.23.1...v4.24.0`](https://github.com/gravity-ui/components/compare/v4.23.1...v4.24.0), [PR #403](https://github.com/gravity-ui/components/pull/403) и [PR #405](https://github.com/gravity-ui/components/pull/405).

## Размеры модалки теперь задаются через переменные Modal

Раньше ширина задавалась на самом блоке через `--g-dialog-width` и устаревшую `--gc-changelog-dialog-width`, а высота списка — жёстким `max-height: 70vh` в SCSS. В [PR #403](https://github.com/gravity-ui/components/pull/403) переменные размера переехали внутрь элемента `&__modal`, и диалог стал опираться на переменные `Modal` из uikit: `--g-modal-width` и `--g-modal-max-width`:

```scss
&__modal {
  --g-modal-width: 100%;
  --g-modal-max-width: var(--gc-changelog-dialog-width, 732px);
}

&__items-container {
  max-height: var(--gc-changelog-dialog-max-height);
  overflow-y: auto;
}
```

Итоговая CSS API на теге `v4.24.0`:

| Переменная                         | Описание                                        | Значение по умолчанию |
| :--------------------------------- | :---------------------------------------------- | :-------------------- |
| `--gc-changelog-dialog-max-height` | Максимальная высота списка версий               | `70vh`                |
| `--gc-changelog-dialog-meta-width` | Ширина служебной колонки (дата, метка «New»)    | `80px`                |
| ~~`--gc-changelog-dialog-width`~~  | **Устарела**, используйте `--g-modal-max-width` | —                     |

Вместе с этим поднято peer-зависимое `@gravity-ui/uikit` с `^7.39.0` до `^7.44.0` — новая версия Modal умеет принимать `modalClassName` и переменные `--g-modal-*`.

## Новый prop modalClassName

В [PR #405](https://github.com/gravity-ui/components/pull/405) добавлен prop `modalClassName` в `ChangelogDialogProps`:

```tsx
export interface ChangelogDialogProps {
    ...
    className?: string;
    modalClassName?: string; // new
}
```

Он прокидывается в `Modal`:

```tsx
<Dialog
    className={b(null, className)}
    modalClassName={b('modal', modalClassName)}
    open={open}
    onClose={onClose}
    ...
/>
```

Зачем это нужно: модалка рендерится в портале поверх элемента, к которому применяется `className`, поэтому CSS-переменные `--g-modal-*` могли задаваться только глобально. `modalClassName` даёт поинстансные настройки.

Чтобы изменить ширину конкретного диалога, задайте переменные `Modal` на элементе модалки через prop:

```css
.my-changelog-dialog-modal {
  --g-modal-max-width: 1000px;
}
```

```tsx
<ChangelogDialog
  open={open}
  items={items}
  onClose={handleClose}
  modalClassName="my-changelog-dialog-modal"
/>
```

Компонент выставляет `--g-modal-max-width: 732px` на самой модалке, поэтому правило переопределения должно выигрывать каскад (например, по специфичности селектора).

## Миграция

- Если вы использовали `--gc-changelog-dialog-width` для ширины диалога — замените на `--g-modal-max-width`, задаваемый через `modalClassName`. Сама переменная осталась как fallback, но помечена устаревшей.
- Промежуточная `--gc-changelog-dialog-max-width` из PR #403 в опубликованный релиз не попала: перед `v4.24.0` её удалили в пользу переменных Modal в PR #405.
- Для существующего кода без кастомных размеров миграция не требуется: поведение по умолчанию (ширина `732px`) сохранено.

## Итог

`ChangelogDialog` переведён на переменные `Modal` uikit и научился принимать `modalClassName`, так что ширину и отступы модалки теперь можно переопределять для каждого экземпляра без глобальных стилей. Новый API пригодится, когда диалог changelog встраивают в лейауты с отличной от стандартной шириной контента.

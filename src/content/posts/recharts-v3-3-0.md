---
author: Артём Нецветаев
pubDatetime: 2026-08-22T17:11:00.000Z
title: "Recharts 3.3: встроенный адаптивный рендеринг через проп responsive"
slug: recharts-v3-3-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
description: "Разбор Recharts 3.3.0: проп responsive прямо на графиках вместо обёртки ResponsiveContainer, исправления YAxis width=auto, ResponsiveContainer, Treemap и Sankey, а также переезд сайта на recharts.github.io."
---

Recharts 3.3.0 — минорный релиз, чей главный пункт — упрощение адаптивной верстки графиков: `ResponsiveContainer` теперь встроен во все графики через новый проп `responsive`. Вместе с этим исправлены несколько багов 3.x (`YAxis width="auto"`, сужение `ResponsiveContainer`, анимации `Treemap`, ключи `Sankey`) и завершён переезд сайта проекта.

Источник: GitHub Release [`recharts/recharts@v3.3.0`](https://github.com/recharts/recharts/releases/tag/v3.3.0). Для конкретики я проверил связанные PR и типы на теге: проп `responsive` и его дефолт подтверждены в `src/util/types.ts`, а обёртка графиков — в diff `ResponsiveContainer` в PR [#6388](https://github.com/recharts/recharts/pull/6388).

## Проп `responsive`: адаптивность без обёртки

[#6388](https://github.com/recharts/recharts/pull/6388) «встраивает» `ResponsiveContainer` во все графики: у `CartesianChart`, `PolarChart` и `SunburstChart` появился булев проп `responsive` (по умолчанию `false`). Если его включить, генерируемый график слушает изменения размера контейнера и пересчитывает размеры SVG сам, без отдельного компонента-обёртки:

```tsx
<BarChart data={data} responsive height={300} width="100%">
  ...
</BarChart>
```

По словам автора, раньше график без обёртки и с неуказанными размерами просто молча не отображался — теперь такие графики по умолчанию получают `width="100%" height="100%"`.

Важная деталь из типов и diff: проп `responsive` использует **стандартные CSS-правила расчёта размеров**, а не собственную логику резолва (которую использует `ResponsiveContainer`). Поэтому варианты вроде `width="100%"` работают напрямую.

Проп `ResponsiveContainer` не удалён — компонент продолжит работать на протяжении всей ветки 3.x. Внутренне графики теперь оборачиваются в него сами (в diff `CartesianChart.tsx` и `PolarChart.tsx` корневой рендер обёрнут в `<ResponsiveContainer>`, а переданные `width`/`height`/`aspect` пробрасываются внутрь). Так что:

- хотите минимум кода и стандартные CSS-размеры — включайте `responsive` на самом графике;
- нужна гибкость самостоятельного контейнера — по-прежнему используйте `ResponsiveContainer` как обёртку.

## Исправления

### `YAxis width="auto"`: детектор осцилляции теперь срабатывает реже

[#6450](https://github.com/recharts/recharts/pull/6450), закрывает [#6424](https://github.com/recharts/recharts/issues/6424). Детектор «осцилляции» ширины оси существовал для субпиксельной разницы при рендере, но мешался при реальных изменениях данных. Теперь подстройка применяется только если разница больше 1 пикселя — при мелких субпиксельных колебаниях ширина не пересчитывается и лейаут не прыгает.

### `ResponsiveContainer`: сужение только там, где нужно

[#6367](https://github.com/recharts/recharts/pull/6367), закрывает [#6245](https://github.com/recharts/recharts/issues/6245). Раньше контейнер применял overflow-обрезку всегда; теперь он уменьшается (shrinks) только в тех измерениях, где это действительно необходимо, вместо принудительной обрезки по обеим осям.

### `Treemap`: стабильная анимация

[#6326](https://github.com/recharts/recharts/pull/6326), закрывает [#6310](https://github.com/recharts/recharts/issues/6310). Побочным эффектом стала анимация «из случайного места»: прямоугольники переходили из произвольной точки `(random X, random Y)`, из-за чего переходы выглядели хаотичными. Анимация заменена на «выезд слева» (`slide from left`), что даёт стабильную и предсказуемую картинку. В PR также выделен отдельный компонент `TreemapItem`.

### `Sankey`: корректные ключи узлов

[#6352](https://github.com/recharts/recharts/pull/6352), закрывает [#6322](https://github.com/recharts/recharts/issues/6322). Ключи узлов `Sankey` генерировались иначе, чем ключи связей, что приводило к `unique key`-ошибке. Теперь ключи узлов строятся по паттерну `node-${index}-${x}-${y}`, единообразно с ключами связей `link-${source}-${target}-${value}` на основе data-атрибутов.

## Переезд сайта

Вместе с релизом сайт Recharts переехал: он теперь инлайнится в `recharts/www` внутри самого монорепозитория (вместо отдельного `recharts.org`) и доступен по адресу https://recharts.github.io/. Причина — контрибьюторы и админы не владеют доменом `recharts.org` и не могут гарантировать его продление, поэтому сайт развёрнут на GitHub Pages.

## Итоги

- Новые контрибьюторы релиза: @kristiandueholm ([#6344](https://github.com/recharts/recharts/pull/6344)), @daiboom ([#6352](https://github.com/recharts/recharts/pull/6352)) и @vmizg ([#6387](https://github.com/recharts/recharts/pull/6387)).
- Полный список изменений: [compare v3.2.1...v3.3.0](https://github.com/recharts/recharts/compare/v3.2.1...v3.3.0).

**Стоит ли обновляться.** Да — breaking changes нет, а новый `responsive` упрощает типовой сценарий адаптивных Дашбордов: не нужно оборачивать каждый график в `ResponsiveContainer` вручную. Для тех, кто уже строит вёрстку на явной обёртке, ничего не сломается — `ResponsiveContainer` по-прежнему поддерживается в 3.x. Точечные фиксы `YAxis`, `Sankey` и плавная анимация `Treemap` — приятный бонус для тех, кто на них натыкался.

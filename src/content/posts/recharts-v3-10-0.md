---
author: Артём Нецветаев
pubDatetime: 2026-07-20T21:34:11.000Z
title: "Recharts 3.10: позиционирование Legend, авто-высота XAxis и доступный Sankey"
slug: recharts-v3-10-0
featured: false
draft: false
tags:
  - release
  - recharts
  - react
  - charts
  - accessibility
description: 'Разбор Recharts 3.10.0: новые position и offset у Legend, XAxis с height="auto", accessibilityLayer/title/desc для Sankey и исправления управляемого Brush, Tooltip, Area и осей.'
---

Recharts 3.10.0 концентрируется на компоновке и интерактивности графиков. В релизе появились координатное позиционирование `Legend`, автоматическая высота `XAxis` для длинных подписей и недостающие accessibility-props у `Sankey`. Кроме новых API команда исправила несколько неприятных крайних случаев: управляемый `Brush` больше не сбрасывает положение, tooltip у круговой диаграммы не пропадает около границы полного круга, а серия `Area` корректно проходит через полностью пустую точку стека.

Источник — [GitHub Release `recharts/recharts@v3.10.0`](https://github.com/recharts/recharts/releases/tag/v3.10.0) и [сравнение с v3.9.2](https://github.com/recharts/recharts/compare/v3.9.2...v3.10.0). Детали API и поведения ниже проверены по связанным PR: [#7564](https://github.com/recharts/recharts/pull/7564), [#7570](https://github.com/recharts/recharts/pull/7570), [#7546](https://github.com/recharts/recharts/pull/7546), [#7542](https://github.com/recharts/recharts/pull/7542), [#7530](https://github.com/recharts/recharts/pull/7530), [#7550](https://github.com/recharts/recharts/pull/7550), [#7549](https://github.com/recharts/recharts/pull/7549), [#7565](https://github.com/recharts/recharts/pull/7565), [#7556](https://github.com/recharts/recharts/pull/7556) и [#7566](https://github.com/recharts/recharts/pull/7566).

## `Legend`: вместо двух осей выравнивания — одна позиция

У `Legend` появились props `position` и `offset`. `position` использует тот же набор Cartesian-позиций, что и `Label`: например, `top`, `bottom`, `left`, `right`, `center`, `insideTopRight` или `insideBottomLeft`. Можно передать и абсолютную точку `{ x, y }`, где координаты допускают проценты.

Если задан `position`, он имеет приоритет над прежними `align` и `verticalAlign`. Поэтому в новом коде положение легенды можно описать одной декларацией, а не сочетанием двух prop-ов:

```tsx
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

<LineChart width={640} height={320} data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="month" />
  <YAxis />
  <Tooltip />
  <Legend position="insideTopRight" offset={12} />
  <Line dataKey="revenue" stroke="#2563eb" />
  <Line dataKey="expenses" stroke="#dc2626" />
</LineChart>;
```

`offset` по умолчанию равен `0`; направление зависит от выбранной позиции. Для внешних позиций Recharts учитывает размер легенды и резервирует место рядом с plot area, а не просто накладывает HTML-обёртку поверх осей. Это устраняет один из источников визуальных коллизий старой схемы выравнивания.

Вместе с API изменился дефолт `layout`: теперь это `"auto"`. Для `left`, `right`, `insideLeft` и `insideRight` элементы легенды располагаются вертикально; для остальных позиций — горизонтально. При необходимости прежнее поведение можно зафиксировать явно:

```tsx
<Legend position="right" layout="horizontal" />
```

В [diff PR #7564](https://github.com/recharts/recharts/pull/7564/files) также видно два сопутствующих изменения для длинных названий серий: контейнер элемента легенды получает `white-space: nowrap`, а его текст по умолчанию может переноситься через `overflow-wrap: break-word`. Кроме того, из пакета экспортируется тип `CartesianPosition`, который полезен, если позицию хранит собственный компонент или настройка:

```tsx
import type { CartesianPosition } from "recharts";

const legendPosition: CartesianPosition = "insideBottomRight";
```

## `XAxis height="auto"` измеряет реальные подписи

Раньше высоту оси X нужно было выбирать числом. При повороте тиков, многострочных подписях или добавленном `label` приходилось вручную увеличивать `height` либо подбирать `margin.bottom`. В 3.10 `XAxis` принимает строковое значение `"auto"`, симметричное уже существующему `YAxis width="auto"`.

```tsx
<BarChart width={720} height={360} data={data}>
  <XAxis
    dataKey="date"
    height="auto"
    angle={-45}
    textAnchor="end"
    tickMargin={8}
    label={{ value: "Дата продажи", position: "insideBottom", offset: -4 }}
  />
  <YAxis />
  <Bar dataKey="amount" fill="#4f46e5" />
</BarChart>
```

Реализация из [#7570](https://github.com/recharts/recharts/pull/7570) измеряет максимальную высоту отрендеренных tick-label, затем прибавляет `tickSize`, `tickMargin`, высоту осевого label и промежуток между label и тиками. До первого измерения селекторы оставляют безопасную стандартную высоту в `30px`, поэтому обычный `height={число}` не меняет поведения.

Перерасчёт выполняется через `useLayoutEffect`: измеренная высота записывается в состояние оси только если округлённое значение действительно отличается. В PR есть и защита от колебаний размеров вида A → B → A с разницей не больше одного пикселя. Важно ограничение реализации: автоматическое измерение не запускается, если `label` передан как React-элемент или функция; в таком случае размер кастомного содержимого библиотека не пытается угадать.

## Sankey получил `title`, `desc` и доступный SVG-слой

`Sankey` наконец принимает `accessibilityLayer`, `title` и `desc` на уровне типов и передаёт их в SVG `Surface`. До этого `title` и `desc` отбрасывались при фильтрации SVG-props, а TypeScript не позволял передать `accessibilityLayer`.

```tsx
<Sankey
  width={900}
  height={460}
  data={flowData}
  dataKey="value"
  title="Перемещение пользователей по воронке"
  desc="Переходы от первого визита к покупке за июль"
/>
```

По [#7546](https://github.com/recharts/recharts/pull/7546) `accessibilityLayer` включён по умолчанию. В таком режиме SVG получает `role="application"` и `tabIndex={0}`. Их можно отключить либо переопределить:

```tsx
<Sankey
  width={900}
  height={460}
  data={flowData}
  accessibilityLayer={false}
/>

<Sankey
  width={900}
  height={460}
  data={flowData}
  role="img"
  tabIndex={-1}
  title="Диаграмма потоков"
/>
```

Явно переданные `role` и `tabIndex` имеют приоритет над дефолтами. Это именно улучшение семантики и имени SVG: навигацию по узлам и ссылкам с клавиатуры PR отдельно не добавляет.

## Управляемый `Brush` перестаёт спорить с props

В релиз вошли два независимых исправления `Brush` для controlled-сценария с `startIndex` и `endIndex`.

Первое, из [#7542](https://github.com/recharts/recharts/pull/7542), исправляет возврат ползунка после `mouseup`. Проблема возникала, когда родитель контролировал индексы, но небольшое перетаскивание ещё не изменило индекс. После отпускания мыши внутреннее состояние ошибочно считало, что props «изменились», и пересчитывало `startX` из прежнего `startIndex`. Теперь предыдущие контролируемые значения инициализируются сразу, а не только после завершения взаимодействия.

Второе, из [#7530](https://github.com/recharts/recharts/pull/7530), повторно применяет controlled-индексы при замене массива `data`. Раньше эффект синхронизации зависел только от самих индексов: обновление данных сбрасывало Redux-состояние диапазона, но не запускало повторную синхронизацию. Теперь `chartData` входит в зависимости эффекта, поэтому заданные props снова становятся источником истины.

```tsx
function SalesChart({ data }: { data: Sale[] }) {
  const [range, setRange] = useState({ startIndex: 2, endIndex: 8 });

  return (
    <LineChart width={700} height={300} data={data}>
      <XAxis dataKey="day" />
      <YAxis />
      <Line dataKey="sales" />
      <Brush
        dataKey="day"
        startIndex={range.startIndex}
        endIndex={range.endIndex}
        onChange={next => {
          if (next?.startIndex != null && next?.endIndex != null) {
            setRange(next);
          }
        }}
      />
    </LineChart>
  );
}
```

Для пользователей controlled `Brush` это означает, что drag больше не должен визуально отскакивать после отпускания, а выбранный диапазон не должен теряться только из-за нового экземпляра `data`.

## Tooltip, пользовательские Label и производительность осей

Остальные исправления тоже закрывают конкретные пограничные случаи:

- [#7550](https://github.com/recharts/recharts/pull/7550) делает поиск активного сектора круговой angle-axis циклическим. У полного круга смещённые интервалы тиков могли оставить щель у 0°/360°: наведение, например, около 358°, не находило сектор и tooltip не открывался. Теперь алгоритм дополнительно проверяет координату, сдвинутую на полный оборот в обе стороны; поведение RadarChart при этом не меняется.
- [#7549](https://github.com/recharts/recharts/pull/7549) передаёт в custom `Label` вычисленные `x`, `y`, `textAnchor` и `verticalAnchor`. Раньше `<YAxis label={<MyLabel />}>` получал `viewBox`, но не готовые координаты и заставлял компонент повторять внутренние расчёты.

```tsx
function AxisLabel({
  x,
  y,
  value,
}: {
  x?: number;
  y?: number;
  value?: string;
}) {
  return (
    <text x={x} y={y} fill="#475569">
      {value}
    </text>
  );
}

<YAxis label={<AxisLabel value="Выручка" />} />;
```

- [#7565](https://github.com/recharts/recharts/pull/7565) убирает лишние dispatch-ы `renderedTicks`. Массив ticks пересоздавался на каждом рендере, поэтому эффект отправлял `setRenderedTicks`, а cleanup — `removeRenderedTicks`, даже если значения не менялись. Теперь ticks сравниваются по значениям, а очистка запускается при настоящем unmount. Это особенно заметно в графиках, которые часто перерисовываются из-за slider или потоковых данных: уменьшается риск вложенных обновлений и ошибки React о максимальной глубине обновления.
- [#7556](https://github.com/recharts/recharts/pull/7556) не даёт `getBandSizeOfAxis` выбрать почти нулевой промежуток между float-тиками как размер полосы. Ранее один разрыв порядка `0.000083px` мог сделать все `Bar` практически невидимыми. Новый порог игнорирует gaps меньше `1e-4` от максимального gap, сохраняя реальные неравномерные интервалы.
- [#7566](https://github.com/recharts/recharts/pull/7566) уточняет `connectNulls` у stacked `AreaChart`. Если на точке все серии стека имеют `null`, линия теперь соединяет соседние точки при `connectNulls`, а частичный `null` одной серии по-прежнему остаётся нулевым вкладом, чтобы не сломать высоту стека.

```tsx
<AreaChart width={700} height={300} data={dataWithGaps} stackOffset="none">
  <XAxis dataKey="name" />
  <YAxis />
  <Area stackId="traffic" dataKey="organic" connectNulls fill="#93c5fd" />
  <Area stackId="traffic" dataKey="paid" connectNulls fill="#a7f3d0" />
</AreaChart>
```

## Что проверить после обновления

Релиз не заявляет breaking changes, но затрагивает расположение и измерение элементов. После перехода на 3.10 стоит проверить:

1. легенды, которые одновременно задают `position` и старые `align`/`verticalAlign`: новая позиция намеренно побеждает;
2. узкие графики с вертикальной легендой и длинными названиями серий — `layout="auto"` теперь выбирает вертикальное расположение для боковых позиций;
3. оси X с наклонёнными, многострочными или локализованными подписями: `height="auto"` позволяет убрать ручной запас, но custom label-элемент всё ещё требует явного размера;
4. controlled `Brush` при drag и при подмене `data`;
5. круговые диаграммы с tooltip вблизи границы 0°/360°, stacked `AreaChart` с полностью пустыми строками и столбчатые графики на данных с высокоточной float-шкалой.

Главные изменения 3.10 дают меньше ручной геометрии в приложении: `Legend` получает общий словарь позиций, `XAxis` измеряет нужное место сам, а `Sankey` снова можно корректно назвать и описать для пользователей ассистивных технологий.

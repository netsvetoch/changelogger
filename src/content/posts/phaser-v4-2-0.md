---
author: Артём Нецветаев
pubDatetime: 2026-06-29T01:45:02.000Z
title: "Phaser 4.2.0: Mesh2D, Stencil, cone lights и новые режимы alpha/tint"
slug: phaser-v4-2-0
featured: false
draft: false
tags:
  - release
  - phaser
  - javascript
  - gamedev
description: "Обзор минорного релиза Phaser v4.2.0: новые WebGL game objects Mesh2D, Stencil, StencilReference и CustomContext, cone lights, alpha strategies, второй tint и безопасное изменение FPS limit во время игры."
---

`phaser` выпустил минорную версию [`v4.2.0`](https://github.com/phaserjs/phaser/releases/tag/v4.2.0) с кодовым именем Giedi. Это в первую очередь WebGL-релиз: в движок добавили низкоуровневые инструменты для треугольных мешей, stencil-буфера, cone lights и управления тем, как прозрачность попадает в shader pipeline.

Источник для обзора — GitHub Release [`phaserjs/phaser@v4.2.0`](https://github.com/phaserjs/phaser/releases/tag/v4.2.0) и diff [`v4.1.0...v4.2.0`](https://github.com/phaserjs/phaser/compare/v4.1.0...v4.2.0). Детали ниже проверены по коммитам `4703267835` (`Mesh2D`), `530f78181a`/`9decba4e46`/`20e59b1335` (`Stencil`, `StencilReference`, `CustomContext`), `2340194521` и PR [#7312](https://github.com/phaserjs/phaser/pull/7312) (cone lights), `f84916099a` (secondary tint) и `3d6ad03169` (`TimeStep#setFPSLimit`).

## `render.alphaStrategy`, `render.stencil` и `render.stencilAlphaStrategy`

В `Phaser.Types.Core.RenderConfig` появились три опции для WebGL-рендера:

```js
const config = {
  type: Phaser.WEBGL,
  render: {
    alphaStrategy: "keep",
    stencil: true,
    stencilAlphaStrategy: "dither",
  },
};
```

`render.alphaStrategy` задаёт стратегию прозрачности для совместимых shader nodes. Тип подтверждён в `src/renderer/webgl/typedefs/AlphaStrategy.js`: допустимы `"keep"`, `"dither"` и число от `0` до `1`, которое работает как threshold. `"keep"` сохраняет обычную alpha, `"dither"` отбрасывает часть фрагментов по dithering-алгоритму, а числовой threshold делает `discard` для пикселей ниже выбранной прозрачности.

`render.stencil` управляет созданием stencil buffer: если stencil-эффекты в игре не используются, его можно выключить и не выделять память под stencil attachments. `render.stencilAlphaStrategy` задаёт стратегию прозрачности именно для отрисовки stencil-источников; по умолчанию в typedef указан `"dither"`, потому что при `"keep"` прозрачные пиксели всё равно могут записаться в stencil buffer как непрозрачные.

## `Stencil`: persistent-маски на уровне canvas

Новый `Stencil` — это расширенный container game object, который рендерит дочерние объекты в stencil buffer. В отличие от привычных масок уровня объекта, stencil-слои сохраняются в буфере в течение кадра и влияют на то, что будет нарисовано позже в display list. Factory зарегистрирован как `scene.add.stencil(x, y, children, options)`.

Опции `StencilOptions` включают:

- `stencilAlphaStrategy` — стратегия alpha для источника stencil;
- `stencilLayerMode` — `"addLayer"`, `"subtractLayer"`, `"clear"` или `"clearRegion"`;
- `stencilInvert` — инверсия для `addLayer`/`subtractLayer` с дополнительным draw call;
- `stencilClearValue` — значение, которым заполняется stencil buffer в режимах `clear` и `clearRegion`;
- `stencilValueWrap` — использовать ли wrapping при переполнении/underflow stencil value.

Минимальный пример слоя, который добавляет геометрию в stencil buffer:

```js
const maskShape = this.add.circle(0, 0, 96, 0xffffff);

this.add.stencil(320, 240, [maskShape], {
  stencilLayerMode: "addLayer",
  stencilAlphaStrategy: "dither",
});
```

Для повторного использования уже созданной stencil-геометрии добавлен `StencilReference`: factory `scene.add.stencilreference(targetStencil, options)` повторно рендерит целевой `Stencil` с другими настройками. Это полезно, когда одна и та же форма должна сначала добавить область, а затем, например, вычесть или очистить регион без дублирования game objects.

## `CustomContext`: контейнер с callback к `DrawingContext`

`CustomContext` — ещё один новый container game object, но вместо работы только со stencil-слоями он клонирует текущий `DrawingContext` и перед активацией вызывает пользовательский callback. В factory он зарегистрирован как `scene.add.customcontext(x, y, children, customContextCallback)`.

В JSDoc для `CustomContext` приведён конкретный сценарий: callback получает `drawingContext`, и в нём можно менять низкоуровневое состояние, например отключить stencil test для дочерних объектов:

```js
this.add.customcontext(0, 0, [sprite], drawingContext => {
  drawingContext.state.stencil.enabled = false;
  drawingContext.setAlphaStrategy(0.5);
});
```

Это API не для обычной композиции сцен, а для случаев, где нужно точечно вмешаться в WebGL state: stencil testing, alpha strategy, scissor-параметры или color/stencil write masks. В том же релизе `DrawingContext#setStencil` получил явный `writeMask`, а snapshot состояния теперь сохраняет `stencil.writeMask`, поэтому такие изменения можно изолировать внутри контекста.

## `Mesh2D`: текстурированные треугольники, которые батчатся рядом со спрайтами

`Mesh2D` добавляет WebGL game object для текстурированных треугольников. Factory выглядит так: `scene.add.mesh2d(x, y, texture, vertices, indices, flipV)`. Внутри объект хранит `vertices`, `indices`, tint-поля и может выбирать между двумя режимами рендера.

Для статичной топологии появился `Mesh2D#buildOrderedIndices(strategy, useOrderedIndices)`. Метод строит `indicesOrdered`: список индексов, где треугольники сгруппированы в пары вида quad. Если у треугольника нет соседа с общей гранью, Phaser добавляет degenerate triangle, чтобы сохранить формат батча. Стратегии задокументированы прямо в `Mesh2D.js`:

- `0` — быстрый режим: каждый треугольник превращается в отдельный quad с degenerate-парой;
- `1` — средний режим: проверяется только следующий треугольник на общую грань;
- `2` — высокий режим: проверяются все треугольники через edge lookup; строится дольше, но экономит память на рендере.

```js
const vertices = [0, 0, 0, 0, 128, 0, 1, 0, 128, 128, 1, 1, 0, 128, 0, 1];
const indices = [0, 1, 2, 0, 0, 2, 3, 0];

const mesh = this.add
  .mesh2d(400, 300, "tiles", vertices, indices)
  .buildOrderedIndices(2, true);

mesh.setUseOrderedIndices(true);
```

Если топология динамическая и перекладывать индексы в quad-пары невыгодно, можно включить `Mesh2D#setRenderAsTriangles(true)`. Тогда объект идёт через новый render node `BatchHandlerTri`, который рисует `gl.TRIANGLES`, наследует shader/vertex layout/texture handling от `BatchHandlerQuad` и добавляет метод `batchTriangles(vertices, indices, ...)` для прямой передачи массивов вершин и индексов.

Важная внутренняя оптимизация для мешей — изменение `TransformerVertex`: старый `run()` остался для совместимости, но теперь он делегирует в `setupMatrix()` и `transformVertex()`. `BatchHandlerTri` вызывает `setupMatrix` один раз на game object и затем трансформирует отдельные вершины через кешированную матрицу, вместо пересборки матрицы на каждую вершину.

## Cone lights без масок и второго camera pass

Релиз добавляет cone lights в существующую WebGL lighting-систему. Это те же `Light`, но ограниченные направленным конусом: фонарики, фары, searchlights, vision cones. По release notes они проходят через существующий lighting shader, без mask, без второй Camera и без повторного рендера карты.

Новые поля и методы у `Light`:

- `coneEnabled`, `coneRotation`, `coneInnerAngle`, `coneOuterAngle`;
- `setCone(rotation, innerAngle, outerAngle)`;
- `setConeRotation(rotation)`;
- `setConeAngles(innerAngle, outerAngle)`;
- `disableCone()`.

У `LightsManager` появился factory-метод `addConeLight(x, y, radius, rgb, intensity, rotation, innerAngle, outerAngle, z)`, который внутри создаёт обычный light и вызывает `.setCone(...)`:

```js
this.lights.enable();

const flashlight = this.lights.addConeLight(
  player.x,
  player.y,
  420,
  0xffffff,
  1.2,
  player.rotation,
  Phaser.Math.DegToRad(18),
  Phaser.Math.DegToRad(36)
);

flashlight.setConeRotation(player.rotation);
```

В shader `DefineLights.glsl` структура `Light` получила `vec2 direction` и `vec3 cone`, где `cone` хранит outer cosine, inner cosine и enabled flag. В фрагментном shader attenuation домножается на `smoothstep` между внешним и внутренним углом, поэтому край cone light может быть мягким, а не бинарным.

## Второй tint и `TintModes.MULTIPLY_TWO`

Для объектов с компонентом `Tint` добавлен второй цвет на каждый угол: `tint2TopLeft`, `tint2TopRight`, `tint2BottomLeft`, `tint2BottomRight`, а также метод `setTint2(topLeft, topRight, bottomLeft, bottomRight)`. Для `Mesh2D` и `Tile` релиз также добавляет постоянный `tint2`.

Новый режим `Phaser.TintModes.MULTIPLY_TWO` имеет значение `7` и использует вторичный цвет. Это позволяет делать эффекты вроде огня или инверсии без отдельного custom shader. На уровне shader ABI есть breaking-подобная деталь для тех, кто лезет глубоко в render system: `ApplyTint` меняет `inTintEffect` с `float` на `vec4`, а кодирование tint mode переезжает с float32 на четыре `uint8`.

```js
sprite
  .setTint(0xff8844, 0xffaa66, 0x221100, 0x000000)
  .setTint2(0x1111ff, 0x0044ff, 0xff3300, 0xff0000)
  .setTintMode(Phaser.TintModes.MULTIPLY_TWO);
```

Если у вас есть собственные render nodes или shaders, которые напрямую читают `inTintEffect`, их стоит проверить отдельно: обычные game objects с компонентом `Tint` получают новый API через компонент, но нестандартные shaders должны соответствовать новой кодировке.

## `TimeStep#setFPSLimit`: менять лимит кадров без ручного пересчёта

Небольшое, но полезное runtime API — `Phaser.Core.TimeStep#setFPSLimit(limit)`. До этого можно было вручную менять `timeStep.fpsLimit`, но тогда легко забыть синхронизировать связанные поля. Новый метод выставляет сразу три значения:

- `fpsLimit = limit`;
- `hasFpsLimit = fpsLimit > 0`;
- `_limitRate = hasFpsLimit ? 1000 / fpsLimit : 0`.

```js
// ограничить игру 30 кадрами в секунду во время battery saver режима
this.game.loop.setFPSLimit(30);

// вернуть поведение без FPS cap
this.game.loop.setFPSLimit(0);
```

Это безопаснее для пауз, энергосберегающих режимов и настроек производительности, где лимит меняется уже после старта игры.

## Кому стоит обновиться

`Phaser v4.2.0` особенно интересен, если проект уже живёт на WebGL-ветке Phaser 4 и упирается в рендеринг:

- нужны текстурированные треугольники, которые можно батчить рядом с обычными спрайтами;
- требуется persistent masking через stencil buffer, включая add/subtract/clear слои;
- нужны flashlight/vision cone эффекты без ручных mask passes;
- используются custom render nodes или shaders, которым важно знать про `AlphaStrategy`, `BatchHandlerTri`, `DrawingContext#setStencil(..., writeMask)` и новую кодировку tint mode;
- в игре есть runtime-переключатель FPS cap.

Для обычных 2D-сцен без кастомного WebGL большинство изменений можно подключать постепенно. Но если проект использует собственные shaders, стоит отдельно проверить alpha discard, `inTintEffect` и совместимость со stencil/composite pipeline перед обновлением.

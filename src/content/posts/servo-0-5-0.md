---
author: Артём Нецветаев
pubDatetime: 2026-08-31T11:26:00.000Z
title: "Июль в Servo: больше платформ, быстрее canvas, веб-шрифты в SVG и не только"
slug: servo-0-5-0
featured: false
draft: false
tags:
  - release
  - servo
  - browser
  - web-platform
  - rust
description: "Перевод июльского обзора Servo 0.5.0: видеовыделение DOM-текста, stale-while-revalidate, новые execCommand-команды, быстрый потоковый 2D canvas, веб-шрифты в SVG и бинарники под Linux aarch64."
---

> Это перевод статьи [«July in Servo: more platforms, faster canvas, web fonts in SVG, and more!»](https://servo.org/blog/2026/08/31/july-in-servo/), ссылка на которую указана в GitHub Release [`servo/servo@v0.5.0`](https://github.com/servo/servo/releases/tag/v0.5.0). Практические заметки из release body: на Linux при ошибке `loading shared libraries` авторы отправляют в [troubleshooting guide](https://servo.org/download/#troubleshooting); `servo-aarch64-linux-ohos.hap` подписан для OpenHarmony, а для HarmonyOS нужна самостоятельная подпись через DevEco Studio и ArkTS [Servo Demo](https://github.com/jschwe/ServoDemo). Полный список PR — в [compare между v0.4.0 и v0.5.0](https://github.com/servo/servo/compare/v0.4.0...v0.5.0).

[**Servo 0.5.0**](https://github.com/servo/servo/releases/tag/v0.5.0) включает все изменения, которые влились в июле, — **488 коммитов**, и теперь мы публикуем бинарники и для **Linux aarch64** ([@mukilan](https://github.com/mukilan), [#46760](https://github.com/servo/servo/pull/46760))!

**DOM-выделение текста** теперь видимое ([@mrobinson](https://github.com/mrobinson), [@SimonSapin](https://github.com/SimonSapin), [#46698](https://github.com/servo/servo/pull/46698), [#46864](https://github.com/servo/servo/pull/46864), [#46742](https://github.com/servo/servo/pull/46742), [#46889](https://github.com/servo/servo/pull/46889), [#46126](https://github.com/servo/servo/pull/46126)).
Интерактивное выделение скоро появится!

Про исправления безопасности см. [**§ Безопасность**](#безопасность).

![servoshell 0.5.0 с несколькими новыми возможностями: «text-decoration-thickness», «box-decoration-break», веб-шрифты во встроенном <svg> и отрисовка DOM-выделения](https://servo.org/img/blog/2026-08-diffie.png)

Мы выпустили несколько новых возможностей веб-платформы:

- **«Cache-Control: stale-while-revalidate»** ([@arayaryoma](https://github.com/arayaryoma), [#46060](https://github.com/servo/servo/pull/46060))
- **«text-decoration-thickness»** ([@nicoburns](https://github.com/nicoburns), [#46592](https://github.com/servo/servo/pull/46592))
- **«box-decoration-break»**, по большей части ([@Psychpsyo](https://github.com/Psychpsyo), [#45492](https://github.com/servo/servo/pull/45492))
- **«@font-feature-values»**, по большей части ([@simonwuelker](https://github.com/simonwuelker), [#45308](https://github.com/servo/servo/pull/45308))
- **«font-language-override»**, по большей части ([@simonwuelker](https://github.com/simonwuelker), [#46618](https://github.com/servo/servo/pull/46618))
- **«font-variant-alternates»**, по большей части ([@simonwuelker](https://github.com/simonwuelker), [#45308](https://github.com/servo/servo/pull/45308))

Плюс пачка новых DOM API:

- алгоритмы [**Ed448**](https://wicg.github.io/webcrypto-secure-curves/#ed448), [**X448**](https://wicg.github.io/webcrypto-secure-curves/#x448) и [**KMAC**](https://wicg.github.io/webcrypto-modern-algos/#kmac) в **SubtleCrypto** ([@kkoyung](https://github.com/kkoyung), [#46402](https://github.com/servo/servo/pull/46402), [#46141](https://github.com/servo/servo/pull/46141), [#46180](https://github.com/servo/servo/pull/46180), [#46583](https://github.com/servo/servo/pull/46583), [#46606](https://github.com/servo/servo/pull/46606), [#46622](https://github.com/servo/servo/pull/46622), [#46334](https://github.com/servo/servo/pull/46334), [#46376](https://github.com/servo/servo/pull/46376))
- команды **«insertHorizontalRule»**, **«insertImage»**, **«insertText»** и **«forwardDelete»** в **document.execCommand()** ([@Psychpsyo](https://github.com/Psychpsyo), [#46608](https://github.com/servo/servo/pull/46608), [#46597](https://github.com/servo/servo/pull/46597), [#46538](https://github.com/servo/servo/pull/46538), [#46838](https://github.com/servo/servo/pull/46838))
- **AnimationEffect** ([@simonwuelker](https://github.com/simonwuelker), [#46677](https://github.com/servo/servo/pull/46677))
- **new Touch()** ([@yezhizhen](https://github.com/yezhizhen), [#46741](https://github.com/servo/servo/pull/46741))
- свойство **duplex** у **Request** ([@Taym95](https://github.com/Taym95), [#46858](https://github.com/servo/servo/pull/46858))
- свойство **effect** у **Animation** ([@simonwuelker](https://github.com/simonwuelker), [#46677](https://github.com/servo/servo/pull/46677))
- **getKeyframes()** и **setKeyframes()** у **KeyframeEffect** ([@simonwuelker](https://github.com/simonwuelker), [#46118](https://github.com/servo/servo/pull/46118))
- свойство **id** у **LargestContentfulPaint** ([@shubhamg13](https://github.com/shubhamg13), [#46828](https://github.com/servo/servo/pull/46828))
- read-only **CSSFontFeatureValuesRule** ([@simonwuelker](https://github.com/simonwuelker), [#46728](https://github.com/servo/servo/pull/46728))

Обновление снова большое, поэтому вот оглавление:

- [**Вы можете помочь!**](#вы-можете-помочь)
- [**Безопасность**](#безопасность)
- [**Совместимость с реальными сайтами**](#совместимость-с-реальными-сайтами)
- [**Работа в процессе**](#работа-в-процессе)
- [**Embedding API**](#embedding-api)
- [**Для пользователей и разработчиков**](#для-пользователей-и-разработчиков)
- [**Ещё о веб-платформе**](#ещё-о-веб-платформе)
- [**Производительность и стабильность**](#производительность-и-стабильность)
- [**Новые контрибьюторы**](#новые-контрибьюторы)

## Вы можете помочь!

Если вы работаете над pull request, который, как вам кажется, может быть интересен для следующего ежемесячного обзора — даже если вы не на сто процентов уверены, — расскажите нам об этом, выполнив следующие шаги:

1. Добавьте на pull request метку `monthly update` или напишите комментарий `@servo-highfive monthly update`
2. Highfive задаст несколько вопросов в комментарии
3. Ответьте на них в комментарии, который содержит `@servo-highfive monthly update answer`

## Безопасность

Servo потенциально затрагивали уязвимости в [**quick-xml**](https://crates.io/crates/quick-xml) и [**crossbeam-epoch**](https://crates.io/crates/crossbeam-epoch), которые закрыты в Servo 0.5.0 ([@atouchet](https://github.com/atouchet), [@Loirooriol](https://github.com/Loirooriol), [#46737](https://github.com/servo/servo/pull/46737), [#46324](https://github.com/servo/servo/pull/46324)).
Подробности: [RUSTSEC-2026-0194](https://rustsec.org/advisories/RUSTSEC-2026-0194), [RUSTSEC-2026-0195](https://rustsec.org/advisories/RUSTSEC-2026-0195) и [RUSTSEC-2026-0204](https://rustsec.org/advisories/RUSTSEC-2026-0204).

Мы обновили **[ANGLE](https://github.com/servo/mozangle)** с версии на базе Firefox 115.x ESR ([02755361e26d8](https://hg.mozilla.org/mozilla-unified/file/02755361e26d82768eb1d5f576145e19d7c265cd/gfx/angle)) до версии на базе Firefox 140.12.0 ESR ([f8025617e815f](https://github.com/mozilla-firefox/firefox/commit/f8025617e815f21388b40baf189338d31a5f9a0a)), которая, вероятно, включает много правок безопасности ([@jschwe](https://github.com/jschwe), [@sagudev](https://github.com/sagudev), [#46455](https://github.com/servo/servo/pull/46455), [mozangle#100](https://github.com/servo/mozangle/pull/100)).

## Совместимость с реальными сайтами

Утка на главной странице **DuckDuckGo ([duckduckgo.com](https://duckduckgo.com))** теперь отрисовывается в v0.5.0 после того, как мы исправили баг предзагрузки, который затрагивал SVG-изображения ([@jdm](https://github.com/jdm), [#46668](https://github.com/servo/servo/pull/46668)).

duckduckgo.com, v0.4.0 / v0.5.0:

![duckduckgo.com в Servo 0.4.0](https://servo.org/img/blog/2026-08-143728.png)

![duckduckgo.com в Servo 0.5.0](https://servo.org/img/blog/2026-08-143737.png)

**Gumroad ([gumroad.com](https://gumroad.com))**, за исключением главной страницы, почти полностью не отрисовывался в v0.4.0, a начиная с v0.5.0 такие страницы, как [**Discover page**](https://gumroad.com/discover) или [**эта страница продукта**](https://harrycraft2.gumroad.com/l/theworldslongestcity), рендерятся почти идеально.

gumroad.com/discover, v0.4.0 / v0.5.0:

![gumroad.com/discover в Servo 0.4.0](https://servo.org/img/blog/2026-08-165201.png)

![gumroad.com/discover в Servo 0.5.0](https://servo.org/img/blog/2026-08-164722.png)

Страница продукта, v0.4.0 / v0.5.0:

![страница продукта в Servo 0.4.0](https://servo.org/img/blog/2026-08-162729.png)

![страница продукта в Servo 0.5.0](https://servo.org/img/blog/2026-08-162731.png)

Нам интересно, как в Servo ведут себя ваши любимые сайты.
Об успехах пишите в [этот тред Zulip](https://servo.zulipchat.com/#narrow/channel/263398-general/topic/Servo.20web.20compat.20success.20stories/with/612898341), о поломках — [в GitHub issues](https://github.com/servo/servo/issues).

## Работа в процессе

Обновление до Stylo 2026-07-01 приносит несколько изменений во встроенных **CSS-функциях** ([@Loirooriol](https://github.com/Loirooriol), [#46129](https://github.com/servo/servo/pull/46129)):

- **«alpha()»** теперь поддерживается под `--pref layout_css_alpha_color_function_enabled`
- **«progress()»** теперь поддерживается под `--pref layout_css_progress_function_enabled`
- значения **«ellipse()»**: **«closest-corner»** и **«farthest-corner»** больше не стабильны из-за неопределённости в спецификации, но всё ещё экспериментальны под `--pref layout_css_ellipse_corners_enabled`
- **«attr()»** стал более конформным под `--pref layout_css_attr_enabled`

**WebGPU**-контент теперь может рассчитывать на лучшую конформность и использовать **GPUExternalTexture** и **importExternalTexture()** на **GPUDevice** под `--pref dom_webgpu_enabled` ([@sagudev](https://github.com/sagudev), [#45873](https://github.com/servo/servo/pull/45873), [#46178](https://github.com/servo/servo/pull/46178), [#46286](https://github.com/servo/servo/pull/46286)).

![servoshell 0.5.0 показывающий четыре наклонённых прямоугольника (в WebGPU), текстурированные картинкой с собакой (кадром из внешнего видео)](https://servo.org/img/blog/2026-08-webgpu.png)

**IndexedDB**-контент теперь может использовать свойство **name** у **IDBIndex** под `--pref dom_indexeddb_enabled` ([@skyz1](https://github.com/skyz1), [#45512](https://github.com/servo/servo/pull/45512)).

**document.fonts** теперь включает **FontFace** для каждого валидного **«@font-face»** под `--pref dom_fontface_enabled` ([@simonwuelker](https://github.com/simonwuelker), [#46509](https://github.com/servo/servo/pull/46509), [#46537](https://github.com/servo/servo/pull/46537)).

Все перечисленные выше фичи включены в [экспериментальном режиме](https://book.servo.org/design-documentation/experimental-features.html#experimental-web-platform-features) servoshell.

Мы начали реализовывать **WebVTT** для нативных **субтитров** и **подписей**, включённый по умолчанию (без `--pref`).
Они пока не отрисовываются, но мы уже можем забирать каждый `<track src>`, парсить WebVTT и отдавать cue через свойство **track** у **HTMLTrackElement** ([@TimvdLippe](https://github.com/TimvdLippe), [#46289](https://github.com/servo/servo/pull/46289), [#46383](https://github.com/servo/servo/pull/46383)).

Июль был большим месяцем для **accessibility** в Servo под `--pref accessibility_enabled`.
В этом месяце фокус был на **производительности**: дерево accessibility теперь поддерживает **инкрементальные обновления** ([@alice](https://github.com/alice), [@delan](https://github.com/delan), [#45578](https://github.com/servo/servo/pull/45578), [#45971](https://github.com/servo/servo/pull/45971), [#46589](https://github.com/servo/servo/pull/46589), [#46691](https://github.com/servo/servo/pull/46691), [#46385](https://github.com/servo/servo/pull/46385)), требует **меньше HashMap-поисков** и **обходов дерева** ([@alice](https://github.com/alice), [@delan](https://github.com/delan), [#45798](https://github.com/servo/servo/pull/45798), [#46740](https://github.com/servo/servo/pull/46740), [#46348](https://github.com/servo/servo/pull/46348)) и позволяет **быстрее мутировать DOM** ([@alice](https://github.com/alice), [#46348](https://github.com/servo/servo/pull/46348), [#46530](https://github.com/servo/servo/pull/46530)).

Мы также начали работать над [**File and Directory Entries API**](https://wicg.github.io/entries-api/), чтобы пользователи могли **выбирать** и **загружать целые директории** через **`<input type=file>`** и **drag-and-drop**.
Для этого у нас теперь есть **webkitGetAsEntry()** у **DataTransferItem**, плюс минимальная поддержка **FileSystemEntry**, **FileSystemDirectoryEntry** и **FileSystemFileEntry**, под `--pref dom_entries_api_enabled` ([@yezhizhen](https://github.com/yezhizhen), [#46456](https://github.com/servo/servo/pull/46456), [#46879](https://github.com/servo/servo/pull/46879), [#46832](https://github.com/servo/servo/pull/46832)).

## Embedding API

Мы улучшили документацию для крейта [`servo`](https://doc.servo.org/servo/index.html) и для [WebViewDelegate](https://doc.servo.org/servo/trait.WebViewDelegate.html) ([@mukilan](https://github.com/mukilan), [#46193](https://github.com/servo/servo/pull/46193)).

Ломающее изменение: [`ServoBuilder`](https://doc.servo.org/servo/struct.ServoBuilder.html)::`webxr_registry()` **удалён**.
Вместо него используйте новый [`Servo`](https://doc.servo.org/servo/struct.Servo.html)::[`register_webxr_registry`](https://doc.servo.org/servo/struct.Servo.html#method.register_webxr_registry) — это **ленивая** схема, которая позволила servoshell **вдвое сократить время запуска** ([@Narfinger](https://github.com/Narfinger), [#46494](https://github.com/servo/servo/pull/46494)).

## Для пользователей и разработчиков

**servoshell** для **Android** теперь работает на **Android 10+** (91% доли рынка), а не только Android 13+ (68% доли рынка), улучшая адаптируемость и сокращая отходы ([@jschwe](https://github.com/jschwe), [#46142](https://github.com/servo/servo/pull/46142), [#46308](https://github.com/servo/servo/pull/46308)).
Мы также исправили проблему со сборкой для Android на macOS ([@jschwe](https://github.com/jschwe), [#46128](https://github.com/servo/servo/pull/46128)).

**servoshell** для **Windows** теперь ведёт себя корректнее при запуске в окне консоли — командная строка ждёт завершения servoshell ([@yezhizhen](https://github.com/yezhizhen), [#43010](https://github.com/servo/servo/pull/43010)).

При работе с Firefox **DevTools** вкладка **Console** теперь поддерживает базовую **автодополнение** ([@freyacodes](https://github.com/freyacodes), [#46382](https://github.com/servo/servo/pull/46382)).

Мы завершили модернизацию servoshell для Android под Compose UI ([@veyndan](https://github.com/veyndan), [#46085](https://github.com/servo/servo/pull/46085), [#46164](https://github.com/servo/servo/pull/46164), [#46253](https://github.com/servo/servo/pull/46253), [#46257](https://github.com/servo/servo/pull/46257), [#46317](https://github.com/servo/servo/pull/46317), [#46353](https://github.com/servo/servo/pull/46353), [#46565](https://github.com/servo/servo/pull/46565), [#46612](https://github.com/servo/servo/pull/46612), [#46626](https://github.com/servo/servo/pull/46626), [#46666](https://github.com/servo/servo/pull/46666), [#46663](https://github.com/servo/servo/pull/46663), [#46700](https://github.com/servo/servo/pull/46700)), а сейчас переводим Servo как библиотеку на Kotlin ([@veyndan](https://github.com/veyndan), [#46817](https://github.com/servo/servo/pull/46817), [#46895](https://github.com/servo/servo/pull/46895), [#46772](https://github.com/servo/servo/pull/46772)).

## Ещё о веб-платформе

**Встроенный SVG** теперь может использовать **веб-шрифты**, определённые в содержащей странице ([@yodalee](https://github.com/yodalee), [#45979](https://github.com/servo/servo/pull/45979)).
Мы также реализуем **SVG DOM**, начиная со stub-интерфейсов для **SVGElement**, SVGCircleElement, SVGDefsElement, SVGEllipseElement, SVGLineElement, SVGLinearGradientElement, SVGPathElement, SVGPolygonElement, SVGPolylineElement, SVGRadialGradientElement, SVGStopElement, SVGRectElement, SVGSymbolElement и SVGUseElement ([@mu-mostafa98](https://github.com/mu-mostafa98), [#46558](https://github.com/servo/servo/pull/46558)).

**`<button>`** теперь **вертикально центрирует** своё содержимое ([@Loirooriol](https://github.com/Loirooriol), [@mrobinson](https://github.com/mrobinson), [#46590](https://github.com/servo/servo/pull/46590)) и лучше ведёт себя с **'display: block'** и **'display: inline'** ([@Loirooriol](https://github.com/Loirooriol), [#46536](https://github.com/servo/servo/pull/46536)).

Мы улучшили конформность **`<form>`** без **`<form action>`** ([@kevlu93](https://github.com/kevlu93), [#46860](https://github.com/servo/servo/pull/46860)), **`<color>`-значений** ([@Loirooriol](https://github.com/Loirooriol), [#46129](https://github.com/servo/servo/pull/46129)), **GamepadEvent** ([@log101](https://github.com/log101), [#46788](https://github.com/servo/servo/pull/46788)), **document.execCommand("delete")** ([@Psychpsyo](https://github.com/Psychpsyo), [#46539](https://github.com/servo/servo/pull/46539)), свойства **selectorText** у **CSSStyleRule** ([@simonwuelker](https://github.com/simonwuelker), [#46687](https://github.com/servo/servo/pull/46687)) и **Set Window Rect** в WebDriver ([@janeoa](https://github.com/janeoa), [#46475](https://github.com/servo/servo/pull/46475), [#46477](https://github.com/servo/servo/pull/46477)).

Мы починили баги, связанные с **`<iframe>`** ([@jschwe](https://github.com/jschwe), [@jdm](https://github.com/jdm), [#46587](https://github.com/servo/servo/pull/46587)), **`<img>`** ([@yodalee](https://github.com/yodalee), [#46892](https://github.com/servo/servo/pull/46892)), **`<textarea>`** ([@SimonSapin](https://github.com/SimonSapin), [@mrobinson](https://github.com/mrobinson), [#46309](https://github.com/servo/servo/pull/46309)), **custom-свойствами** ([@Loirooriol](https://github.com/Loirooriol), [#46129](https://github.com/servo/servo/pull/46129)), **'::before'** и **'::after'** ([@Loirooriol](https://github.com/Loirooriol), [#46640](https://github.com/servo/servo/pull/46640)), **'flex-direction: column'** ([@simonwuelker](https://github.com/simonwuelker), [#46697](https://github.com/servo/servo/pull/46697)), **'float'** ([@Loirooriol](https://github.com/Loirooriol), [@mrobinson](https://github.com/mrobinson), [#46407](https://github.com/servo/servo/pull/46407), [#46500](https://github.com/servo/servo/pull/46500), [#46505](https://github.com/servo/servo/pull/46505)), **'@font-face'** ([@simonwuelker](https://github.com/simonwuelker), [#46568](https://github.com/servo/servo/pull/46568), [#46271](https://github.com/servo/servo/pull/46271), [#46436](https://github.com/servo/servo/pull/46436)), **'position: absolute'** ([@simonwuelker](https://github.com/simonwuelker), [#46358](https://github.com/servo/servo/pull/46358), [#46637](https://github.com/servo/servo/pull/46637)), **Blob** ([@jdm](https://github.com/jdm), [#46881](https://github.com/servo/servo/pull/46881)), **IDBDatabase**, **IDBObjectStore** и **IDBIndex** ([@mrobinson](https://github.com/mrobinson), [#46615](https://github.com/servo/servo/pull/46615)), свойством **adoptedStyleSheets** у **ShadowRoot** ([@simonwuelker](https://github.com/simonwuelker), [#46738](https://github.com/servo/servo/pull/46738)), **delete()** у **FontFaceSet** ([@simonwuelker](https://github.com/simonwuelker), [#46634](https://github.com/servo/servo/pull/46634)), **moveBefore()** у **Element** ([@mrobinson](https://github.com/mrobinson), [#46599](https://github.com/servo/servo/pull/46599)), **resizeTo()** у **Window** ([@janeoa](https://github.com/janeoa), [#46477](https://github.com/servo/servo/pull/46477)), свойством **selected** у **HTMLOptionElement** ([@rhit-kapilaar](https://github.com/rhit-kapilaar), [#46386](https://github.com/servo/servo/pull/46386)) и свойством **value** у **HTMLSelectElement** ([@simonwuelker](https://github.com/simonwuelker), [#46230](https://github.com/servo/servo/pull/46230)).

## Производительность и стабильность

Рендеринг **2D canvas** теперь **многопоточный**, что повышает частоту кадров **до 55%** и снижает энергопотребление на кадр **до 42%** ([@yezhizhen](https://github.com/yezhizhen), [#46410](https://github.com/servo/servo/pull/46410)), а также должен потреблять заметно меньше памяти ([@jschwe](https://github.com/jschwe), [@sagudev](https://github.com/sagudev), [#46786](https://github.com/servo/servo/pull/46786)).

**Отрисовка текста** стала **до 10 раз быстрее** для случаев с одинаковым текстом и разным **'font-size'** ([@Loirooriol](https://github.com/Loirooriol), [#46129](https://github.com/servo/servo/pull/46129)).

Бенчмарки **flex-раскладки** быстрее **до 3%**, а улучшение **getElementsByClassName()** сделало некоторые сайты быстрее **до 1%** ([@Narfinger](https://github.com/Narfinger), [@jdm](https://github.com/jdm), [#46563](https://github.com/servo/servo/pull/46563), [#46595](https://github.com/servo/servo/pull/46595), [#46594](https://github.com/servo/servo/pull/46594)).

Мы также сократили потребление памяти, аллокации, шаги GC-рутинга и другие операции во многих частях Servo ([@mrobinson](https://github.com/mrobinson), [@jdm](https://github.com/jdm), [@yezhizhen](https://github.com/yezhizhen), [@Narfinger](https://github.com/Narfinger), [@Gae24](https://github.com/Gae24), [@SimonSapin](https://github.com/SimonSapin), [@Taym95](https://github.com/Taym95), [@cychronex-labs](https://github.com/cychronex-labs), [@arayaryoma](https://github.com/arayaryoma), [#46499](https://github.com/servo/servo/pull/46499), [#46411](https://github.com/servo/servo/pull/46411), [#46659](https://github.com/servo/servo/pull/46659), [#45974](https://github.com/servo/servo/pull/45974), [#46377](https://github.com/servo/servo/pull/46377), [#45758](https://github.com/servo/servo/pull/45758), [#46440](https://github.com/servo/servo/pull/46440), [#46762](https://github.com/servo/servo/pull/46762), [#46301](https://github.com/servo/servo/pull/46301), [#46349](https://github.com/servo/servo/pull/46349), [#46419](https://github.com/servo/servo/pull/46419), [#46418](https://github.com/servo/servo/pull/46418), [#46420](https://github.com/servo/servo/pull/46420), [#46460](https://github.com/servo/servo/pull/46460), [#46633](https://github.com/servo/servo/pull/46633), [#46638](https://github.com/servo/servo/pull/46638), [#46690](https://github.com/servo/servo/pull/46690), [#46745](https://github.com/servo/servo/pull/46745), [#46726](https://github.com/servo/servo/pull/46726), [#46564](https://github.com/servo/servo/pull/46564), [#46144](https://github.com/servo/servo/pull/46144), [#46664](https://github.com/servo/servo/pull/46664), [#46462](https://github.com/servo/servo/pull/46462), [#46139](https://github.com/servo/servo/pull/46139), [#46430](https://github.com/servo/servo/pull/46430), [#46446](https://github.com/servo/servo/pull/46446), [#46498](https://github.com/servo/servo/pull/46498), [#46548](https://github.com/servo/servo/pull/46548), [#46598](https://github.com/servo/servo/pull/46598), [#46632](https://github.com/servo/servo/pull/46632), [#46656](https://github.com/servo/servo/pull/46656), [#46678](https://github.com/servo/servo/pull/46678), [#46718](https://github.com/servo/servo/pull/46718), [#46722](https://github.com/servo/servo/pull/46722), [#46238](https://github.com/servo/servo/pull/46238), [#46072](https://github.com/servo/servo/pull/46072), [#46408](https://github.com/servo/servo/pull/46408), [#46438](https://github.com/servo/servo/pull/46438), [#46437](https://github.com/servo/servo/pull/46437), [#46528](https://github.com/servo/servo/pull/46528), [#46124](https://github.com/servo/servo/pull/46124), [#46330](https://github.com/servo/servo/pull/46330), [#46412](https://github.com/servo/servo/pull/46412), [#46807](https://github.com/servo/servo/pull/46807)).

Мы исправили краш-регрессию с порчей памяти ([@mrobinson](https://github.com/mrobinson), [#46316](https://github.com/servo/servo/pull/46316)), несколько крашей, связанных с динамическими borrow-операциями ([@Narfinger](https://github.com/Narfinger), [@SharanRP](https://github.com/SharanRP), [@Taym95](https://github.com/Taym95), [@agrawalx](https://github.com/agrawalx), [@amittenak47](https://github.com/amittenak47), [@sungmen](https://github.com/sungmen), [#46381](https://github.com/servo/servo/pull/46381), [#46384](https://github.com/servo/servo/pull/46384), [#46405](https://github.com/servo/servo/pull/46405), [#46684](https://github.com/servo/servo/pull/46684), [#46452](https://github.com/servo/servo/pull/46452), [#46770](https://github.com/servo/servo/pull/46770), [#46830](https://github.com/servo/servo/pull/46830), [#46763](https://github.com/servo/servo/pull/46763)), а также краши, связанные с:

- **`<area>`** без **`<area href>`** ([@simonwuelker](https://github.com/simonwuelker), [#46341](https://github.com/servo/servo/pull/46341))
- **`<progress>`** или shadow DOM ([@mrobinson](https://github.com/mrobinson), [@simonwuelker](https://github.com/simonwuelker), [#46188](https://github.com/servo/servo/pull/46188))
- разметкой **`<table>`** ([@mrobinson](https://github.com/mrobinson), [#46775](https://github.com/servo/servo/pull/46775))
- **`<td rowspan>`** ([@mrobinson](https://github.com/mrobinson), [#46841](https://github.com/servo/servo/pull/46841))
- **`<svg>`** без **`<svg viewBox>`** ([@Narfinger](https://github.com/Narfinger), [@mrobinson](https://github.com/mrobinson), [#46199](https://github.com/servo/servo/pull/46199))
- **`<use>`** в SVG ([@mrobinson](https://github.com/mrobinson), [@Loirooriol](https://github.com/Loirooriol), [#46261](https://github.com/servo/servo/pull/46261))
- **'animation'** ([@mrobinson](https://github.com/mrobinson), [@Loirooriol](https://github.com/Loirooriol), [#46689](https://github.com/servo/servo/pull/46689))
- **'content'** ([@Loirooriol](https://github.com/Loirooriol), [@mrobinson](https://github.com/mrobinson), [#46314](https://github.com/servo/servo/pull/46314))
- **'mix-blend-mode'** ([@mrobinson](https://github.com/mrobinson), [#45624](https://github.com/servo/servo/pull/45624))
- **ArrayBuffer** ([@jdm](https://github.com/jdm), [#46504](https://github.com/servo/servo/pull/46504))
- **adoptedStyleSheets** у **Document** ([@TimvdLippe](https://github.com/TimvdLippe), [#46373](https://github.com/servo/servo/pull/46373))
- **execCommand(`"delete"`)** у **Document** ([@TimvdLippe](https://github.com/TimvdLippe), [#46265](https://github.com/servo/servo/pull/46265))
- удалением DOM-узлов ([@SimonSapin](https://github.com/SimonSapin), [#46866](https://github.com/servo/servo/pull/46866))

Мы продолжили долгую работу по использованию системы типов Rust, чтобы интеграция Servo со SpiderMonkey стала безопаснее и надёжнее ([@Gae24](https://github.com/Gae24), [@Narfinger](https://github.com/Narfinger), [@TimvdLippe](https://github.com/TimvdLippe), [@jdm](https://github.com/jdm), [@kunalmohan](https://github.com/kunalmohan), [@lumiscosity](https://github.com/lumiscosity), [@simonwuelker](https://github.com/simonwuelker), [#46191](https://github.com/servo/servo/pull/46191), [#46777](https://github.com/servo/servo/pull/46777), [#46890](https://github.com/servo/servo/pull/46890), [#46243](https://github.com/servo/servo/pull/46243), [#46248](https://github.com/servo/servo/pull/46248), [#46246](https://github.com/servo/servo/pull/46246), [#46310](https://github.com/servo/servo/pull/46310), [#46312](https://github.com/servo/servo/pull/46312), [#46333](https://github.com/servo/servo/pull/46333), [#46147](https://github.com/servo/servo/pull/46147), [#46150](https://github.com/servo/servo/pull/46150), [#46151](https://github.com/servo/servo/pull/46151), [#46229](https://github.com/servo/servo/pull/46229), [#46262](https://github.com/servo/servo/pull/46262), [#46375](https://github.com/servo/servo/pull/46375), [#46374](https://github.com/servo/servo/pull/46374), [#46529](https://github.com/servo/servo/pull/46529), [#46584](https://github.com/servo/servo/pull/46584), [#46585](https://github.com/servo/servo/pull/46585), [#46593](https://github.com/servo/servo/pull/46593), [#46693](https://github.com/servo/servo/pull/46693), [#46166](https://github.com/servo/servo/pull/46166), [#46156](https://github.com/servo/servo/pull/46156), [#46254](https://github.com/servo/servo/pull/46254), [#46267](https://github.com/servo/servo/pull/46267), [#46268](https://github.com/servo/servo/pull/46268), [#46269](https://github.com/servo/servo/pull/46269), [#46270](https://github.com/servo/servo/pull/46270), [#46284](https://github.com/servo/servo/pull/46284), [#46285](https://github.com/servo/servo/pull/46285), [#46318](https://github.com/servo/servo/pull/46318), [#46435](https://github.com/servo/servo/pull/46435), [#46461](https://github.com/servo/servo/pull/46461)).

## Новые контрибьюторы

Отдельное спасибо тем, кто влил свой первый патч в Servo:

- Umut Cevdet Koçak ([@UMCEKO](https://github.com/UMCEKO), [#46256](https://github.com/servo/servo/pull/46256))
- Yash Agrawal ([@agrawalx](https://github.com/agrawalx), [#46770](https://github.com/servo/servo/pull/46770))
- amittenak47 ([@amittenak47](https://github.com/amittenak47), [#46743](https://github.com/servo/servo/pull/46743))
- Apoorva Pendse ([@apoorvapendse](https://github.com/apoorvapendse), [#46739](https://github.com/servo/servo/pull/46739))
- dDostalker ([@dDostalker](https://github.com/dDostalker), [#46181](https://github.com/servo/servo/pull/46181))
- Oisín Ó Maolchathail ([@eachra-bawn](https://github.com/eachra-bawn), [#46478](https://github.com/servo/servo/pull/46478))
- Kevin Lu ([@kevlu93](https://github.com/kevlu93), [#46860](https://github.com/servo/servo/pull/46860))
- Mohamed Mostafa ([@mu-mostafa98](https://github.com/mu-mostafa98), [#45405](https://github.com/servo/servo/pull/45405))
- SeongMan Jeon ([@sungmen](https://github.com/sungmen), [#46763](https://github.com/servo/servo/pull/46763))
- Yoda Lee ([@yodalee](https://github.com/yodalee), [#45979](https://github.com/servo/servo/pull/45979))

Хотите помочь собрать браузер?
Посмотрите нашу [подборку задач](https://starters.servo.org), которые подходят новым контрибьюторам!

## Донаты

Спасибо ещё раз за щедрую поддержку!
Сейчас мы получаем **7824 USD/месяц** (+1.8% к июню) регулярными донатами.
Это помогает оплачивать наши **[быстрые](https://ci0.servo.org) [CI](https://ci1.servo.org) [и](https://ci2.servo.org) [бенчмарк](https://ci3.servo.org)-[серверы](https://ci4.servo.org)**, одного из недавних **[стажёров Outreachy](https://www.outreachy.org/alums/2026-05/#:~:text=Servo)** и **[работу мейнтейнера](https://servo.org/blog/2025/09/17/your-donations-at-work-funding-jdm/)**, которая упрощает вклад в Servo.

Servo также есть на [thanks.dev](https://thanks.dev), и уже **35 пользователей GitHub** (как и в июне), которые зависят от Servo, спонсируют нас там.
Если вы используете библиотеки Servo вроде [url](https://crates.io/crates/url/reverse_dependencies), [html5ever](https://crates.io/crates/html5ever/reverse_dependencies), [selectors](https://crates.io/crates/selectors/reverse_dependencies) или [cssparser](https://crates.io/crates/cssparser/reverse_dependencies), регистрация на [thanks.dev](https://thanks.dev) — хороший способ отблагодарить сообщество за себя или за работодателя.

Теперь есть [**уровни спонсорства**](https://servo.org/blog/2025/11/21/sponsorship-tiers/), которые позволяют вам или вашей организации жертвовать проекту Servo с публичным признанием поддержки.
Если такой формат вам интересен, напишите на [join@servo.org](mailto:join@servo.org).

Сейчас: **7824 USD/месяц** при ориентире **10000**.

Как тратятся донаты, решается прозрачно через публичный **[процесс funding request](https://github.com/servo/project/blob/main/FUNDING_REQUEST.md)** Technical Steering Committee; активные заявки собраны в [servo/project#187](https://github.com/servo/project/issues/187).
Подробности — на [странице Sponsorship](https://servo.org/sponsorship/).

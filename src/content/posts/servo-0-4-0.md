---
author: Артём Нецветаев
pubDatetime: 2026-08-15T17:43:25.000Z
title: "Июнь в Servo: совместимость с реальными сайтами, media queries, SharedWorker и не только"
slug: servo-0-4-0
featured: false
draft: false
tags:
  - release
  - servo
  - browser
  - web-platform
  - rust
description: "Перевод июньского обзора Servo 0.4.0: media queries, attr(), SharedWorker, обновления SpiderMonkey, совместимость с lichess/Zulip и прогресс WebGPU."
---

> Это перевод статьи [«June in Servo: real world compat, media queries, SharedWorker, and more!»](https://servo.org/blog/2026/07/31/june-in-servo/), ссылка на которую указана в GitHub Release [`servo/servo@0.4.0`](https://github.com/servo/servo/releases/tag/0.4.0). Оригинальный релиз также содержит [diff между v0.3.0 и 0.4.0](https://github.com/servo/servo/compare/v0.3.0...0.4.0) и практические заметки по Tech Demo: на Linux при ошибке `loading shared libraries` авторы отправляют в [troubleshooting guide](https://servo.org/download/#troubleshooting); `servo-aarch64-linux-ohos.hap` подписан для OpenHarmony, а для HarmonyOS нужна самостоятельная подпись через DevEco Studio и ArkTS [Servo Demo](https://github.com/jschwe/ServoDemo).

[**Servo 0.4.0**](https://github.com/servo/servo/releases/tag/0.4.0) включает все изменения, которые влились в июне, — очередной рекорд: **558 коммитов** (апрель: 534, май: 391).
Про исправления безопасности см. [**§ Безопасность**](#безопасность).

![servoshell 0.4.0 с несколькими новыми возможностями: media-query фичи width, height, device-width, device-height и aspect-ratio, а также расширенная функция attr(); фон и ширина блока управляются data-атрибутами, которые задают range-инпуты](https://servo.org/img/blog/2026-07-diffie.png)

Мы выпустили несколько новых возможностей веб-платформы:

- **`attr()`** в [экспериментальном режиме](https://book.servo.org/design-documentation/experimental-features.html#experimental-web-platform-features) ([@Loirooriol](https://github.com/Loirooriol), [#45041](https://github.com/servo/servo/pull/45041))
- **`image(<color>)`**, **`closest-corner`** и **`farthest-corner`** в **`ellipse()`** и **`circle()`** ([@Loirooriol](https://github.com/Loirooriol), [#45421](https://github.com/servo/servo/pull/45421))
- **`calc()`** и другие [математические выражения](https://drafts.csswg.org/css-values/#math) теперь могут вычисляться позже парсинга, например `sign(1em - 32px)` ([@Loirooriol](https://github.com/Loirooriol), [#45421](https://github.com/servo/servo/pull/45421))
- **`font-feature-settings`** в **`@font-face`** ([@simonwuelker](https://github.com/simonwuelker), [#45393](https://github.com/servo/servo/pull/45393))
- **`@media (device-width)`**, **`@media (device-height)`**, **`@media (height)`**, **`@media (aspect-ratio)`** и их варианты **`min-`** / **`max-`** ([@jdm](https://github.com/jdm), [@mrobinson](https://github.com/mrobinson), [@nicoburns](https://github.com/nicoburns), [@jschwe](https://github.com/jschwe), [#44978](https://github.com/servo/servo/pull/44978), [#45707](https://github.com/servo/servo/pull/45707), [#45490](https://github.com/servo/servo/pull/45490))
- **`@media (orientation)`** ([@nicoburns](https://github.com/nicoburns), [#45707](https://github.com/servo/servo/pull/45707))
- **`@media (pointer)`** и **`@media (any-pointer)`** ([@nicoburns](https://github.com/nicoburns), [#45681](https://github.com/servo/servo/pull/45681))
- **`@media (hover)`** и **`@media (any-hover)`** ([@nicoburns](https://github.com/nicoburns), [#45681](https://github.com/servo/servo/pull/45681))

Плюс пачка новых DOM API:

- **SharedWorker** ([@Taym95](https://github.com/Taym95), [#45786](https://github.com/servo/servo/pull/45786))
- **`console.dir()`** ([@Taym95](https://github.com/Taym95), [#45109](https://github.com/servo/servo/pull/45109))
- **`customElementRegistry`** на **Document** и **ShadowRoot** ([@shubhamg13](https://github.com/shubhamg13), [#45872](https://github.com/servo/servo/pull/45872))
- **`initialize()`** на **CustomElementRegistry** ([@shubhamg13](https://github.com/shubhamg13), [@yezhizhen](https://github.com/yezhizhen), [#45903](https://github.com/servo/servo/pull/45903))
- **`new CustomElementRegistry()`** ([@shubhamg13](https://github.com/shubhamg13), [#45791](https://github.com/servo/servo/pull/45791), [#45550](https://github.com/servo/servo/pull/45550))
- **`textStream()`** на **Request**, **Response** и **Blob** ([@yezhizhen](https://github.com/yezhizhen), [#45864](https://github.com/servo/servo/pull/45864), [#45861](https://github.com/servo/servo/pull/45861))
- **`setPointerCapture()`**, **`releasePointerCapture()`**, **`hasPointerCapture()`** на **Element** ([@webbeef](https://github.com/webbeef), [#45048](https://github.com/servo/servo/pull/45048))
- **`ontouchstart`**, **`ontouchend`**, **`ontouchmove`**, **`ontouchcancel`** на **Element** ([@stevennovaryo](https://github.com/stevennovaryo), [#45049](https://github.com/servo/servo/pull/45049))
- **`crypto.subtle.digest()`** для **KT128** и **KT256** ([@kkoyung](https://github.com/kkoyung), [#45699](https://github.com/servo/servo/pull/45699))
- **`crypto.subtle.getPublicKey()`** для **ML-KEM** и **ML-DSA** ([@kkoyung](https://github.com/kkoyung), [#45252](https://github.com/servo/servo/pull/45252))

Обновление снова большое, поэтому вот оглавление:

- [**Вы можете помочь!**](#вы-можете-помочь)
- [**Безопасность**](#безопасность)
- [**Совместимость с реальными сайтами**](#совместимость-с-реальными-сайтами)
- [**Работа в процессе**](#работа-в-процессе)
- [**Embedding API**](#embedding-api)
- [**Для пользователей и разработчиков**](#для-пользователей-и-разработчиков)
- [**Ещё о веб-платформе**](#ещё-о-веб-платформе)
- [**Безопасность сборки мусора**](#безопасность-сборки-мусора)
- [**Производительность и стабильность**](#производительность-и-стабильность)
- [**Новые контрибьюторы**](#новые-контрибьюторы)

## Вы можете помочь!

Servo каждый месяц становится больше и оживлённее: к июню 2026 мы уже разбираем **более чем в четыре раза** больше коммитов, чем в сентябре 2023, когда начали эти обзоры.

![линейный график числа коммитов в основной репозиторий Servo с сентября 2023 по июнь 2026 включительно: явный линейный тренд от 130 до 551 коммита](https://servo.org/img/blog/2026-07-commits.png)

Это тяжёлая работа, особенно потому что по одному diff часто трудно ответить на вопросы, которые нам нужны:

- **На кого влияет изменение**, если вообще влияет? На пользователей, разработчиков Servo, эмбеддеров или ещё какую-то группу?
- **Какая наблюдаемая разница** появляется, если она есть?
- **Нужно ли включать pref**, или фича доступна всем по умолчанию?
- **Затронуты ли реальные сайты?**
- **С каким issue или более широким проектом связано изменение?** На этот вопрос отвечают строки `Fixes: #xxxxx` или `Part of: #xxxxx` в описании PR.

Благодаря инициативе [@jdm](https://github.com/jdm) на эти вопросы теперь проще ответить с помощью бота Servo Highfive.
Если вы работаете над pull request, который, как вам кажется, может быть интересен для следующего ежемесячного обзора — даже если вы не на сто процентов уверены, — расскажите нам об этом так:

1. Добавьте на pull request метку `monthly update` или напишите комментарий `@servo-highfive monthly update`
2. Highfive задаст несколько вопросов в комментарии
3. Ответьте на них в комментарии, который содержит `@servo-highfive monthly update answer`

## Безопасность

В JS-рантайме Servo, **SpiderMonkey 140.10.1**, было несколько **уязвимостей**, которые в Servo 0.4.0 закрыты обновлением до SpiderMonkey 140.11.0 ([@jschwe](https://github.com/jschwe), [#45584](https://github.com/servo/servo/pull/45584)).
Подробности: [CVE-2026-8388](https://nvd.nist.gov/vuln/detail/CVE-2026-8388), [CVE-2026-8391](https://nvd.nist.gov/vuln/detail/CVE-2026-8391), [CVE-2026-8974](https://nvd.nist.gov/vuln/detail/CVE-2026-8974), [CVE-2026-8975](https://nvd.nist.gov/vuln/detail/CVE-2026-8975) и [MFSA 2026-48](https://www.mozilla.org/en-US/security/advisories/mfsa2026-48/).

Ещё несколько **уязвимостей** в JS-рантайме закрыты обновлением до SpiderMonkey 140.12.0 ([@jschwe](https://github.com/jschwe), [#45766](https://github.com/servo/servo/pull/45766)).
Какие именно CVE относятся к Servo, пока неизвестно; подробности см. в [MFSA 2026-58](https://www.mozilla.org/en-US/security/advisories/mfsa2026-58/).

**RSA**-операции в **SubtleCrypto** теперь делают модульное возведение в степень за константное время ([@kkoyung](https://github.com/kkoyung), [#45631](https://github.com/servo/servo/pull/45631)).
Обратите внимание: текущая реализация RSA всё ещё уязвима к [Marvin Attack](https://people.redhat.com/~hkario/marvin/) — подробности в [RUSTSEC-2023-0071](https://rustsec.org/advisories/RUSTSEC-2023-0071.html).

**ML-DSA**-операции в **SubtleCrypto** теперь выполняют шаг Decompose за константное время, закрывая [RUSTSEC-2025-0144](https://rustsec.org/advisories/RUSTSEC-2025-0144.html) ([@kkoyung](https://github.com/kkoyung), [#45294](https://github.com/servo/servo/pull/45294)).

Мы исправили HTML-инъекцию (XSS) в **листингах каталогов `file:///`**, которая срабатывала на именах файлов с `</script>` ([@sahvx655-wq](https://github.com/sahvx655-wq), [#45510](https://github.com/servo/servo/pull/45510)).

## Совместимость с реальными сайтами

Корректность вёрстки заметно выросла на **[lichess.org](https://lichess.org/)**, а многие сайты стали куда читабельнее благодаря улучшенной работе с **variable fonts** ([@simonwuelker](https://github.com/simonwuelker), [#45768](https://github.com/servo/servo/pull/45768)), в том числе **Zulip ([servo.zulipchat.com](https://servo.zulipchat.com/))** и **Speedtest ([speedtest.net](https://speedtest.net/))**.

[lichess.org](https://lichess.org/), v0.3.0:

![lichess.org в Servo 0.3.0](https://servo.org/img/blog/2026-07-161705.png)

lichess.org, v0.4.0:

![lichess.org в Servo 0.4.0](https://servo.org/img/blog/2026-07-161708.png)

Zulip, v0.3.0:

![Zulip в Servo 0.3.0](https://servo.org/img/blog/2026-07-161115.png)

Zulip, v0.4.0:

![Zulip в Servo 0.4.0](https://servo.org/img/blog/2026-07-161201.png)

Speedtest, v0.3.0:

![Speedtest в Servo 0.3.0](https://servo.org/img/blog/2026-07-174050.png)

Speedtest, v0.4.0:

![Speedtest в Servo 0.4.0](https://servo.org/img/blog/2026-07-174052.png)

Многие сайты работали в Servo ещё до 0.4.0, включая **Google Photos ([photos.google.com](https://photos.google.com/))** и Cash Converters ([cashconverters.com.au](https://cashconverters.com.au/)), и продолжают работать в 0.4.0.
Другие, например Google Maps ([maps.google.com](https://maps.google.com/)) и OpenStreetMap ([www.openstreetmap.org](https://www.openstreetmap.org/)), хорошо рисуются, но с интерактивностью пока есть проблемы.

![Google Photos в Servo](https://servo.org/img/blog/2026-07-175215.png)

Google Photos ([photos.google.com](https://photos.google.com/))

![Cash Converters в Servo](https://servo.org/img/blog/2026-07-162341.png)

Cash Converters ([cashconverters.com.au](https://cashconverters.com.au/))

![Google Maps в Servo](https://servo.org/img/blog/2026-07-202258.png)

Google Maps ([maps.google.com](https://maps.google.com/))

![OpenStreetMap в Servo](https://servo.org/img/blog/2026-07-203458.png)

OpenStreetMap ([www.openstreetmap.org](https://www.openstreetmap.org/))

Нам интересно, как в Servo ведут себя ваши любимые сайты.
Об успехах пишите в [этот тред Zulip](https://servo.zulipchat.com/#narrow/channel/263398-general/topic/Servo.20web.20compat.20success.20stories/with/612898341), о поломках — [в GitHub issues](https://github.com/servo/servo/issues).

## Работа в процессе

Мы реализуем более мощную версию **`attr()`**, которую можно использовать не только в `content`, а где угодно, под `--pref layout_css_attr_enabled` ([@Loirooriol](https://github.com/Loirooriol), [#45041](https://github.com/servo/servo/pull/45041), [#45421](https://github.com/servo/servo/pull/45421), [#45495](https://github.com/servo/servo/pull/45495), [#45752](https://github.com/servo/servo/pull/45752)).

Поддержка **WebGPU** улучшилась под `--pref dom_webgpu_enabled`:

- реализован **`copyExternalImageToTexture()`** на **GPUQueue** ([@sagudev](https://github.com/sagudev), [#45646](https://github.com/servo/servo/pull/45646))
- реализованы **`createQuerySet()`** на **GPUDevice** и **`resolveQuerySet()`** на **GPUCommandEncoder** ([@sagudev](https://github.com/sagudev), [#45644](https://github.com/servo/servo/pull/45644))
- реализованы **`pushDebugGroup()`**, **`popDebugGroup()`** и **`insertDebugMarker()`** на **GPUCommandEncoder**, **GPUComputePassEncoder** и **GPURenderPassEncoder** ([@jschwe](https://github.com/jschwe), [#45489](https://github.com/servo/servo/pull/45489))
- более конформный **GPUTexture** ([@sagudev](https://github.com/sagudev), [#45300](https://github.com/servo/servo/pull/45300))
- более конформный **`requestAdapter()`** на **GPU** ([@sagudev](https://github.com/sagudev), [#45424](https://github.com/servo/servo/pull/45424))
- более конформная проверка **secure context** ([@sagudev](https://github.com/sagudev), [#45279](https://github.com/servo/servo/pull/45279))

Все перечисленные выше фичи включены в [экспериментальном режиме](https://book.servo.org/design-documentation/experimental-features.html#experimental-web-platform-features) servoshell.

Мы продвинулись и по **accessibility** под `--pref accessibility_enabled` ([@alice](https://github.com/alice), [@delan](https://github.com/delan), [#45555](https://github.com/servo/servo/pull/45555), [#45554](https://github.com/servo/servo/pull/45554), [#44949](https://github.com/servo/servo/pull/44949)).

Началась реализация видимого и интерактивного **выделения текста** ([@mrobinson](https://github.com/mrobinson), [@SimonSapin](https://github.com/SimonSapin), [#46107](https://github.com/servo/servo/pull/46107)) — одной из самых долгожданных фич любого браузера.
Следите за новостями!

Также началась работа над **Web Animations** под `--pref dom_web_animations_enabled` ([@simonwuelker](https://github.com/simonwuelker), [#45522](https://github.com/servo/servo/pull/45522), [#45983](https://github.com/servo/servo/pull/45983)) и над **`webkitRelativePath`** у **File** под `--pref dom_entries_api_enabled` ([@yezhizhen](https://github.com/yezhizhen), [#45666](https://github.com/servo/servo/pull/45666)).

У Rust нет стабильного [ABI](https://en.wikipedia.org/wiki/Application_binary_interface), поэтому встроить Servo в другое приложение обычно нельзя без сборки Servo из исходников.
Чтобы это стало возможным, мы начали проектировать **обёрточный C API**: он позволит потреблять Servo как предсобранную shared library через стабильный и вездесущий C ABI ([@mukilan](https://github.com/mukilan), [#44984](https://github.com/servo/servo/pull/44984)).
Дальше идея в том, чтобы поверх _этого_ C API сделать обёрточный Rust API — и получить эргономику Rust вместе с простотой сборки как у C.

## Embedding API

Новое в [**Servo API**](https://doc.servo.org/servo/):

- [`WebView`](https://doc.servo.org/servo/struct.WebView.html)::[`rendering_context`](https://doc.servo.org/servo/struct.WebView.html#method.rendering_context) ([@mrobinson](https://github.com/mrobinson), [#46047](https://github.com/servo/servo/pull/46047))

Ломающие изменения:

- [`WebView`](https://doc.servo.org/servo/struct.WebView.html)::`send_error` удалён ([@mukilan](https://github.com/mukilan), [#45502](https://github.com/servo/servo/pull/45502)) — метод всегда задумывался как внутренний и стал не нужен после появления нового API на базе WebView и WebViewDelegate

Мы улучшили документацию для WebView, WebViewDelegate, JSValue, AlertDialog, AllowOrDenyRequest, AuthenticationResponse, BluetoothDeviceDescription, ConfirmDialog, ConsoleLogLevel, CreateNewWebViewRequest, EmbedderControl, EmbedderControlResponse, FilePicker, Image, JavaScriptErrorInfo, NavigationRequest, PermissionRequest, PixelFormat, PromptDialog, ProtocolHandlerRegistration, ProtocolHandlerUpdateRegistration, Scroll, SelectElement, SelectElementRequest и WebViewVector ([@mukilan](https://github.com/mukilan), [#45282](https://github.com/servo/servo/pull/45282), [#45467](https://github.com/servo/servo/pull/45467)).

## Для пользователей и разработчиков

В servoshell:

- **Android**-версия теперь требует **Android 13+** ([@jschwe](https://github.com/jschwe), [#46104](https://github.com/servo/servo/pull/46104))
- в **десктопной** версии можно **перетаскивать файлы** в окно, чтобы открыть их ([@simonwuelker](https://github.com/simonwuelker), [#45454](https://github.com/servo/servo/pull/45454))
- в **десктопной** версии панель вкладок **прокручивается горизонтально**, если вкладок слишком много — хотя от одного любителя вкладок другому: может, их всё-таки стоит поубавить ([@Nylme](https://github.com/Nylme), [#44884](https://github.com/servo/servo/pull/44884))
- **десктопная** версия уходит в fullscreen на том мониторе, где сейчас окно, даже если вы перетащили его на другой монитор ([@rhit-kapilaar](https://github.com/rhit-kapilaar), [#45556](https://github.com/servo/servo/pull/45556))
- **десктопный** UI быстрее, плавнее ресайзится и больше не залипает в hovered-состояниях ([@mrobinson](https://github.com/mrobinson), [#45289](https://github.com/servo/servo/pull/45289), [#45456](https://github.com/servo/servo/pull/45456), [#45290](https://github.com/servo/servo/pull/45290))
- **`<select multiple>`** теперь должен быть кликабелен на **всех десктопных платформах** ([@alexcat3](https://github.com/alexcat3), [#45419](https://github.com/servo/servo/pull/45419))
- `localhost:<port>` теперь подразумевает `http://` **в адресной строке** и **в командной строке**, а не воспринимается как неподдерживаемая схема `localhost:` ([@SteveSharonSam](https://github.com/SteveSharonSam), [#45729](https://github.com/servo/servo/pull/45729), [#45832](https://github.com/servo/servo/pull/45832))

При работе с Firefox **DevTools**:

- на вкладке **Console** **неперехваченные исключения** теперь репортятся корректно ([@jdm](https://github.com/jdm), [#45549](https://github.com/servo/servo/pull/45549))
- на вкладках **Console** и **Debugger** можно осматривать элементы **вложенных массивов** и записи **объектов Map** ([@atbrakhi](https://github.com/atbrakhi), [#45435](https://github.com/servo/servo/pull/45435), [#45514](https://github.com/servo/servo/pull/45514), [#45767](https://github.com/servo/servo/pull/45767))
- на вкладке **Debugger** панель **Scopes** показывает переменные **`(uninitialized)`**, значение `this` и **global scope** ([@atbrakhi](https://github.com/atbrakhi), [@eerii](https://github.com/eerii), [#45824](https://github.com/servo/servo/pull/45824), [#45517](https://github.com/servo/servo/pull/45517))

Мы починили сборку на **riscv32**, **riscv64** и **arm64** ([@fxzjshm](https://github.com/fxzjshm), [@saschanaz](https://github.com/saschanaz), [#45285](https://github.com/servo/servo/pull/45285), [#45731](https://github.com/servo/servo/pull/45731)) и модернизировали Android-servoshell под Compose UI и Kotlin ([@veyndan](https://github.com/veyndan), [#45923](https://github.com/servo/servo/pull/45923), [#45932](https://github.com/servo/servo/pull/45932), [#45941](https://github.com/servo/servo/pull/45941), [#45982](https://github.com/servo/servo/pull/45982), [#45985](https://github.com/servo/servo/pull/45985), [#46015](https://github.com/servo/servo/pull/46015), [#46035](https://github.com/servo/servo/pull/46035), [#46037](https://github.com/servo/servo/pull/46037), [#46046](https://github.com/servo/servo/pull/46046), [#46053](https://github.com/servo/servo/pull/46053), [#46061](https://github.com/servo/servo/pull/46061), [#46071](https://github.com/servo/servo/pull/46071), [#45641](https://github.com/servo/servo/pull/45641), [#45643](https://github.com/servo/servo/pull/45643), [#45650](https://github.com/servo/servo/pull/45650), [#45665](https://github.com/servo/servo/pull/45665), [#45671](https://github.com/servo/servo/pull/45671), [#45676](https://github.com/servo/servo/pull/45676), [#45679](https://github.com/servo/servo/pull/45679), [#45683](https://github.com/servo/servo/pull/45683), [#45712](https://github.com/servo/servo/pull/45712), [#45713](https://github.com/servo/servo/pull/45713), [#45734](https://github.com/servo/servo/pull/45734), [#45738](https://github.com/servo/servo/pull/45738)).

Для разработчиков самого Servo:

- `mach try --help` теперь перечисляет все виды **try jobs**, которые можно запускать ([@shubhamg13](https://github.com/shubhamg13), [#45607](https://github.com/servo/servo/pull/45607))
- `mach test-wpt --update-expectations` позволяет прогнать **Web Platform Tests** и [**обновить expectations**](https://book.servo.org/contributing/testing.html#updating-web-platform-test-expectations) одной командой ([@TimvdLippe](https://github.com/TimvdLippe), [#45521](https://github.com/servo/servo/pull/45521)), а не делать `mach test-wpt --log-raw <path>` и затем `mach update-wpt <path>`

## Ещё о веб-платформе

Чтобы скролл был быстрее, события **`wheel`** больше не `.cancelable`, если нет ни одного не-[`passive`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#passive) слушателя ([@kunalmohan](https://github.com/kunalmohan), [#45667](https://github.com/servo/servo/pull/45667)).
Как и в Firefox, события `wheel` по умолчанию `passive`.

Текстовые украшения **`dotted`**, **`dashed`** и **`wavy`** теперь непрерывны через границы элементов ([@mrobinson](https://github.com/mrobinson), [#45726](https://github.com/servo/servo/pull/45726)).

Мы улучшили конформность **`<dialog>`** ([@skyz1](https://github.com/skyz1), [@mrobinson](https://github.com/mrobinson), [#45825](https://github.com/servo/servo/pull/45825), [#45761](https://github.com/servo/servo/pull/45761)), **`<iframe sandbox>`** ([@cychronex-labs](https://github.com/cychronex-labs), [#45880](https://github.com/servo/servo/pull/45880)), **`<input minlength>`** и **`<input maxlength>`** ([@skyz1](https://github.com/skyz1), [#45705](https://github.com/servo/servo/pull/45705)), **CSS-градиентов** ([@mrobinson](https://github.com/mrobinson), [#43945](https://github.com/servo/servo/pull/43945)), **`font-style`** и **`unicode-range`** в **`@font-face`** ([@Loirooriol](https://github.com/Loirooriol), [#45821](https://github.com/servo/servo/pull/45821)), **FontFaceSet** ([@mrobinson](https://github.com/mrobinson), [#45390](https://github.com/servo/servo/pull/45390), [#45382](https://github.com/servo/servo/pull/45382)), **HTMLInputElement** ([@steigeo](https://github.com/steigeo), [#45416](https://github.com/servo/servo/pull/45416)), **IntersectionObserver** ([@jdm](https://github.com/jdm), [#45655](https://github.com/servo/servo/pull/45655), [#45659](https://github.com/servo/servo/pull/45659), [#45680](https://github.com/servo/servo/pull/45680)), **`new Response()`** ([@yezhizhen](https://github.com/yezhizhen), [#45953](https://github.com/servo/servo/pull/45953)), **`URL.createObjectURL()`** и **`URL.revokeObjectURL()`** ([@yezhizhen](https://github.com/yezhizhen), [#45182](https://github.com/servo/servo/pull/45182), [#45417](https://github.com/servo/servo/pull/45417)), а также **ECDSA** и **Ed25519** в **SubtleCrypto** ([@kkoyung](https://github.com/kkoyung), [#45833](https://github.com/servo/servo/pull/45833), [#46017](https://github.com/servo/servo/pull/46017)).

Починены баги вокруг **`<input hidden>`** ([@mrobinson](https://github.com/mrobinson), [#45750](https://github.com/servo/servo/pull/45750)), **`animation-delay`** ([@yezhizhen](https://github.com/yezhizhen), [#45013](https://github.com/servo/servo/pull/45013)), **`clip-path`** ([@Loirooriol](https://github.com/Loirooriol), [#45468](https://github.com/servo/servo/pull/45468), [#45373](https://github.com/servo/servo/pull/45373)), **`tab-size`** ([@SimonSapin](https://github.com/SimonSapin), [@mrobinson](https://github.com/mrobinson), [#45309](https://github.com/servo/servo/pull/45309)), **`width`** и **`height`** ([@RichardTjokroutomo](https://github.com/RichardTjokroutomo), [#44627](https://github.com/servo/servo/pull/44627)), **`box-shadow: inset`** ([@Loirooriol](https://github.com/Loirooriol), [#45620](https://github.com/servo/servo/pull/45620)), событий **`animationiteration`** ([@Loirooriol](https://github.com/Loirooriol), [#45990](https://github.com/servo/servo/pull/45990)), **`click`** ([@mrobinson](https://github.com/mrobinson), [#45751](https://github.com/servo/servo/pull/45751)), **`load`** ([@jdm](https://github.com/jdm), [#45883](https://github.com/servo/servo/pull/45883)), **`error`** в Worker global scopes ([@Gae24](https://github.com/Gae24), [#45829](https://github.com/servo/servo/pull/45829)) и **`document.getElementById()`** ([@mrobinson](https://github.com/mrobinson), [#45433](https://github.com/servo/servo/pull/45433)).

## Безопасность сборки мусора

Многие DOM-типы мы храним внутри других DOM-типов через [механизм на **RefCell**](https://doc.servo.org/script_bindings/cell/struct.DomRefCell.html): правило Rust «либо алиасинг, либо мутабельность» проверяется в рантайме, и при нарушении происходит panic.
Но во время сборки мусора нужно вызывать [borrow()](https://doc.servo.org/script_bindings/cell/struct.DomRefCell.html#method.borrow) у каждого DomRefCell, чтобы трассировать ссылки, — и именно отсюда растут многие panic-баги.
Чтобы закрыть этот класс проблем, сначала появился **CanGc**: маркерный тип, который помечает пути, где GC возможен, вместе с кастомным статическим анализом ([@jdm](https://github.com/jdm), [#33140](https://github.com/servo/servo/pull/33140)).

С системой типов Rust можно сделать лучше: развернуть схему и требовать, чтобы любой вызов [borrow_mut()](https://doc.servo.org/script_bindings/cell/struct.DomRefCell.html#method.borrow_mut) доказывал, что GC _не_ может произойти, передавая маркер **NoGC**.
Дальше можно потребовать, чтобы `&NoGC` брался из `&JSContext` (GC заблокирован), а не из `&mut JSContext` (GC разрешён), используя обычные правила ссылок Rust без кастомного анализа.

Кодовая база большая и мигрирует по частям, поэтому пока появился новый метод [safe_borrow_mut()](https://doc.servo.org/script_bindings/cell/struct.DomRefCell.html#method.safe_borrow_mut) ([@sagudev](https://github.com/sagudev), [#46050](https://github.com/servo/servo/pull/46050)).
Нужно также перевести весь script-код на заимствование [безопасной обёртки JSContext](https://doc.servo.org/script_bindings/import/base/struct.JSContext.html), а не создавать owned JSContext на месте.

Это продолжение долгой работы: **использовать систему типов Rust**, чтобы интеграция Servo со SpiderMonkey стала безопаснее и надёжнее ([@Gae24](https://github.com/Gae24), [@Keerti707](https://github.com/Keerti707), [@Narfinger](https://github.com/Narfinger), [@TimvdLippe](https://github.com/TimvdLippe), [@sagudev](https://github.com/sagudev), [@guptapiyush16](https://github.com/guptapiyush16), [@ivomurrell](https://github.com/ivomurrell), [@kunalmohan](https://github.com/kunalmohan), [@skyz1](https://github.com/skyz1), [#45230](https://github.com/servo/servo/pull/45230), [#45436](https://github.com/servo/servo/pull/45436), [#45503](https://github.com/servo/servo/pull/45503), [#45617](https://github.com/servo/servo/pull/45617), [#45711](https://github.com/servo/servo/pull/45711), [#45797](https://github.com/servo/servo/pull/45797), [#45800](https://github.com/servo/servo/pull/45800), [#45858](https://github.com/servo/servo/pull/45858), [#45884](https://github.com/servo/servo/pull/45884), [#45937](https://github.com/servo/servo/pull/45937), [#45902](https://github.com/servo/servo/pull/45902), [#45968](https://github.com/servo/servo/pull/45968), [#45977](https://github.com/servo/servo/pull/45977), [#45991](https://github.com/servo/servo/pull/45991), [#46003](https://github.com/servo/servo/pull/46003), [#46005](https://github.com/servo/servo/pull/46005), [#46084](https://github.com/servo/servo/pull/46084), [#45548](https://github.com/servo/servo/pull/45548), [#45552](https://github.com/servo/servo/pull/45552), [#45590](https://github.com/servo/servo/pull/45590), [#45909](https://github.com/servo/servo/pull/45909), [#45912](https://github.com/servo/servo/pull/45912), [#45943](https://github.com/servo/servo/pull/45943), [#46089](https://github.com/servo/servo/pull/46089), [#46117](https://github.com/servo/servo/pull/46117), [#46114](https://github.com/servo/servo/pull/46114), [#45320](https://github.com/servo/servo/pull/45320), [#45324](https://github.com/servo/servo/pull/45324), [#45328](https://github.com/servo/servo/pull/45328), [#45340](https://github.com/servo/servo/pull/45340), [#45381](https://github.com/servo/servo/pull/45381), [#45385](https://github.com/servo/servo/pull/45385), [#45410](https://github.com/servo/servo/pull/45410), [#45392](https://github.com/servo/servo/pull/45392), [#45409](https://github.com/servo/servo/pull/45409), [#45604](https://github.com/servo/servo/pull/45604), [#45616](https://github.com/servo/servo/pull/45616), [#45618](https://github.com/servo/servo/pull/45618), [#45627](https://github.com/servo/servo/pull/45627), [#45636](https://github.com/servo/servo/pull/45636), [#45662](https://github.com/servo/servo/pull/45662), [#45663](https://github.com/servo/servo/pull/45663), [#45675](https://github.com/servo/servo/pull/45675), [#45674](https://github.com/servo/servo/pull/45674), [#45677](https://github.com/servo/servo/pull/45677), [#45684](https://github.com/servo/servo/pull/45684), [#45735](https://github.com/servo/servo/pull/45735), [#45807](https://github.com/servo/servo/pull/45807), [#45810](https://github.com/servo/servo/pull/45810), [#45816](https://github.com/servo/servo/pull/45816), [#45818](https://github.com/servo/servo/pull/45818), [#45828](https://github.com/servo/servo/pull/45828), [#45838](https://github.com/servo/servo/pull/45838), [#45836](https://github.com/servo/servo/pull/45836), [#45837](https://github.com/servo/servo/pull/45837), [#45840](https://github.com/servo/servo/pull/45840), [#45841](https://github.com/servo/servo/pull/45841), [#45857](https://github.com/servo/servo/pull/45857), [#45859](https://github.com/servo/servo/pull/45859), [#45862](https://github.com/servo/servo/pull/45862), [#45875](https://github.com/servo/servo/pull/45875), [#45887](https://github.com/servo/servo/pull/45887), [#45931](https://github.com/servo/servo/pull/45931), [#45964](https://github.com/servo/servo/pull/45964), [#45935](https://github.com/servo/servo/pull/45935), [#45987](https://github.com/servo/servo/pull/45987), [#45988](https://github.com/servo/servo/pull/45988), [#46001](https://github.com/servo/servo/pull/46001), [#46040](https://github.com/servo/servo/pull/46040), [#46051](https://github.com/servo/servo/pull/46051), [#46057](https://github.com/servo/servo/pull/46057), [#46106](https://github.com/servo/servo/pull/46106), [#46125](https://github.com/servo/servo/pull/46125), [#45678](https://github.com/servo/servo/pull/45678), [#46002](https://github.com/servo/servo/pull/46002), [#45845](https://github.com/servo/servo/pull/45845), [#45645](https://github.com/servo/servo/pull/45645), [#45673](https://github.com/servo/servo/pull/45673), [#45259](https://github.com/servo/servo/pull/45259), [#45817](https://github.com/servo/servo/pull/45817), [#45822](https://github.com/servo/servo/pull/45822), [#45876](https://github.com/servo/servo/pull/45876), [#45877](https://github.com/servo/servo/pull/45877), [#45891](https://github.com/servo/servo/pull/45891)).

## Производительность и стабильность

**NoGC** задумывался против динамических borrow-паник, но он же открывает оптимизации.
Если в каком-то участке Servo можно доказать, что сборка мусора невозможна, часто удаётся **не рутовать JavaScript-объекты** при работе с ними.
Так мы снизили накладные расходы больше чем на 1% в процессе **layout** и в **HTMLCollection** ([@Narfinger](https://github.com/Narfinger), [#46092](https://github.com/servo/servo/pull/46092), [#45582](https://github.com/servo/servo/pull/45582)).

**Потребление памяти** тоже лучше: **BoxFragment** стал **на 17% меньше** (288 → 240 байт на amd64), **ShapeCacheEntry** тоже уменьшился ([@SimonSapin](https://github.com/SimonSapin), [@mrobinson](https://github.com/mrobinson), [@simonwuelker](https://github.com/simonwuelker), [#45183](https://github.com/servo/servo/pull/45183), [#45496](https://github.com/servo/servo/pull/45496)).

Закрыты неприятные **утечки памяти** при **перезагрузке** и в **2D canvas** ([@Taym95](https://github.com/Taym95), [@sagudev](https://github.com/sagudev), [@jschwe](https://github.com/jschwe), [#45455](https://github.com/servo/servo/pull/45455), [#45261](https://github.com/servo/servo/pull/45261), [#45414](https://github.com/servo/servo/pull/45414)).

Кстати о canvas: **2D canvas** теперь потребляет до **23% меньше энергии** ([@yezhizhen](https://github.com/yezhizhen), [#45301](https://github.com/servo/servo/pull/45301)), а один и тот же SVG мы больше не растеризуем повторно ([@Narfinger](https://github.com/Narfinger), [@jschwe](https://github.com/jschwe), [#44805](https://github.com/servo/servo/pull/44805)).

Servo теперь **декодирует все изображения асинхронно** и **асинхронно наполняет image cache**, оставляя script-потокам (процессам веб-контента) больше времени на остальную работу ([@Narfinger](https://github.com/Narfinger), [#45542](https://github.com/servo/servo/pull/45542), [#44483](https://github.com/servo/servo/pull/44483)).
Сверху мы улучшили **инкрементальный layout** ([@mrobinson](https://github.com/mrobinson), [@Loirooriol](https://github.com/Loirooriol), [#45411](https://github.com/servo/servo/pull/45411)) и сократили reflow в **IntersectionObserver** ([@jschwe](https://github.com/jschwe), [#45986](https://github.com/servo/servo/pull/45986)).

Началась работа над **инкрементальными обновлениями** дерева **stacking context**; побочный эффект — некоторые layout-микробенчмарки стали быстрее до 10% ([@mrobinson](https://github.com/mrobinson), [@Loirooriol](https://github.com/Loirooriol), [#45208](https://github.com/servo/servo/pull/45208)).

Также сокращены аллокации, копирования, шаги GC-рутинга и другие операции во многих частях Servo ([@Narfinger](https://github.com/Narfinger), [@SimonSapin](https://github.com/SimonSapin), [@mrobinson](https://github.com/mrobinson), [@Loirooriol](https://github.com/Loirooriol), [#45506](https://github.com/servo/servo/pull/45506), [#45969](https://github.com/servo/servo/pull/45969), [#45940](https://github.com/servo/servo/pull/45940), [#45760](https://github.com/servo/servo/pull/45760), [#46090](https://github.com/servo/servo/pull/46090), [#45335](https://github.com/servo/servo/pull/45335), [#45413](https://github.com/servo/servo/pull/45413), [#45511](https://github.com/servo/servo/pull/45511)).

Несколько месяцев Frédéric ([@fred-wang](https://github.com/fred-wang)) [**фаззит**](https://en.wikipedia.org/wiki/Fuzzing) Servo, и благодаря этой работе в июне закрыты шестнадцать (16) **crash-багов**, затрагивающих **`<iframe>`**, **`<slot>`**, **`<link onerror>`**, **`animation`**, **`clip-path`**, **`content`**, **`rotate`**, **`transition`**, **`transform-style`**, **`display: contents`**, **`overflow: clip`**, **CSSKeyframesRule**, **FontFace**, **`stop()` на Window**, **`document.elementFromPoint()`** и **DOM-дерево** ([@mrobinson](https://github.com/mrobinson), [@Loirooriol](https://github.com/Loirooriol), [@fred-wang](https://github.com/fred-wang), [#46031](https://github.com/servo/servo/pull/46031), [#46027](https://github.com/servo/servo/pull/46027), [#46054](https://github.com/servo/servo/pull/46054), [#46058](https://github.com/servo/servo/pull/46058), [#46016](https://github.com/servo/servo/pull/46016), [#46028](https://github.com/servo/servo/pull/46028), [#46033](https://github.com/servo/servo/pull/46033), [#45287](https://github.com/servo/servo/pull/45287), [#45951](https://github.com/servo/servo/pull/45951), [#45634](https://github.com/servo/servo/pull/45634), [#45629](https://github.com/servo/servo/pull/45629), [#46110](https://github.com/servo/servo/pull/46110), [#46094](https://github.com/servo/servo/pull/46094), [#45799](https://github.com/servo/servo/pull/45799), [#45611](https://github.com/servo/servo/pull/45611), [#45682](https://github.com/servo/servo/pull/45682), [#45788](https://github.com/servo/servo/pull/45788), [#45612](https://github.com/servo/servo/pull/45612), [#45834](https://github.com/servo/servo/pull/45834)).

Также закрыты краши, связанные со сбоями **IPC**, **HTMLInputElement**, **Range**, вкладкой Debugger в **DevTools** и сборкой servoshell с `--features native-bluetooth` ([@jschwe](https://github.com/jschwe), [@Taym95](https://github.com/Taym95), [@mrobinson](https://github.com/mrobinson), [@atbrakhi](https://github.com/atbrakhi), [@mukilan](https://github.com/mukilan), [#45311](https://github.com/servo/servo/pull/45311), [#45619](https://github.com/servo/servo/pull/45619), [#45765](https://github.com/servo/servo/pull/45765), [#45513](https://github.com/servo/servo/pull/45513), [#45702](https://github.com/servo/servo/pull/45702)).

## Новые контрибьюторы

Отдельное спасибо тем, кто влил свой первый патч в Servo:

- Deepam Goyal ([@Deepam02](https://github.com/Deepam02), [#44836](https://github.com/servo/servo/pull/44836))
- Mark ([@Mark-Boger](https://github.com/Mark-Boger), [#45486](https://github.com/servo/servo/pull/45486))
- Mr SheerLuck ([@MrSheerluck](https://github.com/MrSheerluck), [#45557](https://github.com/servo/servo/pull/45557))
- Psychpsyo (Cameron) ([@Psychpsyo](https://github.com/Psychpsyo), [#45494](https://github.com/servo/servo/pull/45494))
- TusharSariya ([@TusharSariya](https://github.com/TusharSariya), [#43663](https://github.com/servo/servo/pull/43663))
- Adam Sharif ([@adamsharifc](https://github.com/adamsharifc), [#45551](https://github.com/servo/servo/pull/45551))
- Akash Ravikumar ([@ak4shravikumar](https://github.com/ak4shravikumar), [#45736](https://github.com/servo/servo/pull/45736))
- Sean Cunneen ([@alexcat3](https://github.com/alexcat3), [#45419](https://github.com/servo/servo/pull/45419))
- Abdul Wahab Melethil Shibu ([@cychronex-labs](https://github.com/cychronex-labs), [#45880](https://github.com/servo/servo/pull/45880))
- darkdragon-001 ([@darkdragon-001](https://github.com/darkdragon-001), [#45267](https://github.com/servo/servo/pull/45267))
- Frédéric Wang Nélar ([@fred-wang](https://github.com/fred-wang), [#45834](https://github.com/servo/servo/pull/45834))
- fxzjshm ([@fxzjshm](https://github.com/fxzjshm), [#45285](https://github.com/servo/servo/pull/45285))
- Piyush Gupta ([@guptapiyush16](https://github.com/guptapiyush16), [#45845](https://github.com/servo/servo/pull/45845))
- Ivo Murrell ([@ivomurrell](https://github.com/ivomurrell), [#45645](https://github.com/servo/servo/pull/45645))
- rhit-kapilaar ([@rhit-kapilaar](https://github.com/rhit-kapilaar), [#45556](https://github.com/servo/servo/pull/45556))
- sahvx655-wq ([@sahvx655-wq](https://github.com/sahvx655-wq), [#45510](https://github.com/servo/servo/pull/45510))
- Kagami Sascha Rosylight ([@saschanaz](https://github.com/saschanaz), [#45731](https://github.com/servo/servo/pull/45731))
- shangguanmachine-dot ([@shangguanmachine-dot](https://github.com/shangguanmachine-dot), [#45310](https://github.com/servo/servo/pull/45310))
- Glenn Skrzypczak ([@skyz1](https://github.com/skyz1), [#45471](https://github.com/servo/servo/pull/45471))
- Oskar Steiger ([@steigeo](https://github.com/steigeo), [#45416](https://github.com/servo/servo/pull/45416))
- Veyndan Stuart ([@veyndan](https://github.com/veyndan), [#45326](https://github.com/servo/servo/pull/45326))

Хотите помочь собрать браузер?
Посмотрите нашу [подборку задач](https://starters.servo.org/) для новых контрибьюторов.

## Донаты

Спасибо ещё раз за щедрую поддержку!
Сейчас мы получаем **7681 USD/месяц** (+0.2% к маю) регулярными донатами.
Это помогает оплачивать наши **[быстрые](https://ci0.servo.org/) [CI](https://ci1.servo.org/) [и](https://ci2.servo.org/) [бенчмарк](https://ci3.servo.org/)-[серверы](https://ci4.servo.org/)**, одного из недавних **[стажёров Outreachy](https://www.outreachy.org/alums/2026-05/#:~:text=Servo)** и **[работу мейнтейнера](https://servo.org/blog/2025/09/17/your-donations-at-work-funding-jdm/)**, которая упрощает вклад в Servo.

Servo также есть на [thanks.dev](https://thanks.dev/), и уже **35 пользователей GitHub** (как в мае), которые зависят от Servo, спонсируют нас там.
Если вы используете библиотеки Servo вроде [url](https://crates.io/crates/url/reverse_dependencies), [html5ever](https://crates.io/crates/html5ever/reverse_dependencies), [selectors](https://crates.io/crates/selectors/reverse_dependencies) или [cssparser](https://crates.io/crates/cssparser/reverse_dependencies), регистрация на [thanks.dev](https://thanks.dev/) — хороший способ отблагодарить сообщество за себя или за работодателя.

Теперь есть [**уровни спонсорства**](https://servo.org/blog/2025/11/21/sponsorship-tiers/), которые позволяют вам или вашей организации жертвовать проекту Servo с публичным признанием поддержки.
Если такой формат вам интересен, напишите на [join@servo.org](mailto:join@servo.org).

Сейчас: **7681 USD/месяц** при ориентире **10000**.

Как тратятся донаты, решается прозрачно через публичный **[процесс funding request](https://github.com/servo/project/blob/main/FUNDING_REQUEST.md)** Technical Steering Committee; активные заявки собраны в [servo/project#187](https://github.com/servo/project/issues/187).
Подробности — на [странице Sponsorship](https://servo.org/sponsorship/).

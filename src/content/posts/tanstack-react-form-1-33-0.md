---
author: Артём Нецветаев
pubDatetime: 2026-06-28T15:29:17.000Z
title: "TanStack React Form 1.33.0: FormGroup для пошаговых форм"
slug: tanstack-react-form-1-33-0
featured: false
draft: false
tags:
  - release
  - tanstack
  - react-form
description: "Обзор минорного релиза @tanstack/react-form 1.33.0: новый FormGroup API, отдельная отправка и валидация подформ, meta-состояние групп и примеры для wizard-сценариев."
---

TanStack выпустил минорный релиз [`@tanstack/react-form@1.33.0`](https://github.com/TanStack/form/releases/tag/%40tanstack/react-form%401.33.0). В changelog у релиза всего один пользовательский пункт — [#2128 «Form Groups»](https://github.com/TanStack/form/pull/2128), но за ним стоит большой новый API: `FormGroup` для подформ внутри одной общей формы.

Источник для обзора — GitHub Release [`TanStack/form@808f158`](https://github.com/TanStack/form/commit/808f158b62c08f69689a7b652c35989d717f9014) и связанные изменения из PR [#2128](https://github.com/TanStack/form/pull/2128). Релиз также обновляет зависимость `@tanstack/form-core` до `1.33.0`, потому что основная логика групп живёт в core-пакете.

## Что такое FormGroup

`FormGroup` решает типичную проблему многошаговых форм: раньше каждый шаг wizard'а часто приходилось делать отдельной формой или вручную фильтровать, какие поля валидировать и когда отправлять весь объект. В `1.33.0` React-адаптер получает компонент `form.FormGroup`, который привязан к части `defaultValues` по имени группы и отдаёт в `children` отдельный group API.

Минимальный подтверждённый пример из новой документации выглядит так:

```tsx
const form = useForm({
  defaultValues: {
    step1: { name: "" },
    step2: { age: 0 },
  },
});

return (
  <form.FormGroup name="step1">
    {group => {
      // group работает как form-like API для ветки step1:
      // например, доступны handleSubmit(), state.value, state.meta
      return null;
    }}
  </form.FormGroup>
);
```

В коде React-адаптера это не просто документационный алиас: `ReactFormApi`, который возвращает `useForm`, теперь включает `FormGroup`, а `useForm.tsx` монтирует его как `<FormGroup {...props} form={formApi} />`. Отдельно добавлен `useFormGroup`, который создаёт `FormGroupApi` из `@tanstack/form-core` и подписывает React на `group.state.value` и ключевые поля `group.state.meta`.

## Отдельная отправка шага без отправки всей формы

Главное практическое изменение — у группы есть свой `handleSubmit()`. Его можно вызывать из формы внутри шага, не вызывая `form.handleSubmit()` для всей формы. Для wizard'а это означает: первый шаг может провалидировать только `step1`, перейти дальше через `onGroupSubmit`, а финальный шаг уже отправит весь parent form.

```tsx
const [step, setStep] = useState(0);
const form = useForm({
  defaultValues: {
    step1: { name: "" },
    step2: { age: 0 },
  },
  onSubmit: ({ value }) => saveProfile(value),
});

return (
  <>
    {step === 0 ? (
      <form.FormGroup
        name="step1"
        onGroupSubmit={() => setStep(1)}
        onGroupSubmitInvalid={() => {
          // Ошибки остаются на первом шаге.
        }}
      >
        {group => (
          <form
            onSubmit={event => {
              event.preventDefault();
              event.stopPropagation();
              group.handleSubmit();
            }}
          >
            <form.Field name="step1.name">{() => null}</form.Field>
            <button type="submit">Дальше</button>
          </form>
        )}
      </form.FormGroup>
    ) : null}

    {step === 1 ? (
      <form.FormGroup name="step2" onGroupSubmit={() => form.handleSubmit()}>
        {group => (
          <form
            onSubmit={event => {
              event.preventDefault();
              event.stopPropagation();
              group.handleSubmit();
            }}
          >
            <form.Field name="step2.age">{() => null}</form.Field>
            <button type="submit">Сохранить всё</button>
          </form>
        )}
      </form.FormGroup>
    ) : null}
  </>
);
```

Это поведение покрыто новыми тестами: при submit группы вызывается `onGroupSubmit`, но не вызывается parent `onSubmit`; ошибки формы за пределами группы, например на `step2.name`, не должны блокировать submit группы `step1`.

## Валидация группы: group-level ошибки, field-level ошибки и schema validators

`FormGroup` получил собственный набор validators: `onMount`, `onChange`, `onChangeAsync`, `onBlur`, `onBlurAsync`, `onSubmit`, `onSubmitAsync`, `onDynamic` и `onDynamicAsync`. Валидатор получает `value` текущей группы и `groupApi`.

Самый простой вариант — вернуть ошибку группы:

```tsx
<form.FormGroup
  name="step1"
  validators={{
    onChange: ({ value }) =>
      value.name.trim().length === 0 ? "Name is required" : undefined,
  }}
>
  {group => {
    group.state.meta.errorMap.onChange;
    group.state.meta.errors;
    return null;
  }}
</form.FormGroup>
```

Если нужно разложить ошибку по полям внутри группы, валидатор возвращает объект с ключами `group` и `fields`. Важно: в `fields` используются имена относительно группы, а не полный путь `step1.name`. Это сделано для совместимости с вложенными schema validators.

```tsx
<form.FormGroup
  name="step1"
  validators={{
    onChange: ({ value }) => ({
      group: value.name === "error" ? "Group error" : undefined,
      fields: {
        name: value.name === "error" ? "Field error" : undefined,
      },
    }),
  }}
/>
```

Новый API также принимает standard schema validator. Документация показывает `z.object({ name: z.string().min(2) })` как валидатор именно для `step1`, а parent form может параллельно валидировать полный объект `{ step1, step2 }`.

```tsx
const step1Schema = z.object({
  name: z.string().min(2),
});

const formSchema = z.object({
  step1: step1Schema,
  step2: z.object({ age: z.number().min(18) }),
});

const form = useForm({
  defaultValues: {
    step1: { name: "" },
    step2: { age: 0 },
  },
  validators: { onSubmit: formSchema },
});

return <form.FormGroup name="step1" validators={{ onChange: step1Schema }} />;
```

## Dynamic validation теперь нужно задавать на уровне группы

PR отдельно документирует важную деталь для `onDynamic`: если динамическая валидация задана только в `useForm({ validators: { onDynamic } })`, она не будет запускать `onChange` при submit подформы; она отработает при submit всей формы. Для пошаговых сценариев schema конкретного шага нужно передавать прямо в `FormGroup`:

```tsx
const form = useForm({
  validationLogic: revalidateLogic(),
  validators: {
    onDynamic: fullFormSchema,
  },
});

return <form.FormGroup name="step1" validators={{ onDynamic: step1Schema }} />;
```

В реализации для группы используется собственный счётчик `submissionAttempts`: документация формулирует это как `group.submissionAttempts`, а в React-обёртке реактивно подписаны поля `state.meta.submissionAttempts`, `isSubmitted` и `isSubmitSuccessful`.

## Новое состояние группы

`group.state.value` отдаёт значение ветки формы, например для `name="step1"` это объект `step1`. В `group.state.meta` появились агрегаты, которых не было у обычного top-level доступа к форме как к шагу wizard'а:

- `isFieldsValid` — нет ошибок на field-level validators внутри группы;
- `isGroupValid` — нет ошибок на validators самой группы;
- `isValid` — одновременно валидны поля и group validators;
- `isSubmitting` — группа сейчас выполняет submit;
- `canSubmit`, `isSubmitted`, `isSubmitSuccessful`, `submissionAttempts` — lifecycle submit'а для группы.

Это важно для UI: кнопку «Дальше» можно блокировать на время async-submit именно текущего шага, не смешивая состояние с отправкой всей формы.

```tsx
<form.FormGroup name="step1" onGroupSubmit={saveStepDraft}>
  {group => (
    <button
      type="button"
      disabled={group.state.meta.isSubmitting || !group.state.meta.canSubmit}
      onClick={() => group.handleSubmit({ source: "next-button" })}
    >
      {group.state.meta.isSubmitting ? "Сохраняем..." : "Дальше"}
    </button>
  )}
</form.FormGroup>
```

Передача submit meta тоже покрыта тестом: `group.handleSubmit({ source: 'button' })` приходит в `onGroupSubmit` как `meta: { source: 'button' }` вместе с `value` группы.

## Не только React, но React-пакет получает готовый API

Changeset помечает minor не только для `@tanstack/react-form`, но и для `@tanstack/form-core`, `@tanstack/angular-form`, `@tanstack/preact-form`, `@tanstack/solid-form`, `@tanstack/svelte-form`, `@tanstack/lit-form` и `@tanstack/vue-form`. В документации добавлены guides `Form Groups` и примеры `Multi-Step Wizard` для разных адаптеров.

Для пользователя именно `@tanstack/react-form` важны два экспортируемых пути:

- `form.FormGroup` — компонент, уже привязанный к экземпляру `form` из `useForm`;
- `useFormGroup` / `FormGroup` внутри React-адаптера — низкоуровневая реализация, которая строится поверх `FormGroupApi` из core.

## Как обновиться

```bash
pnpm add @tanstack/react-form@1.33.0
```

Или через npm:

```bash
npm install @tanstack/react-form@1.33.0
```

После обновления стоит прогнать typecheck и тесты сценариев отправки формы. Особое внимание — wizard'ам и страницам, где раньше каждый шаг был отдельной формой или где вручную фильтровались ошибки по префиксу поля.

## Ссылки

- [Release `@tanstack/react-form@1.33.0`](https://github.com/TanStack/form/releases/tag/%40tanstack/react-form%401.33.0)
- [PR #2128: Form Groups](https://github.com/TanStack/form/pull/2128)
- [Commit `808f158`: Form Groups](https://github.com/TanStack/form/commit/808f158b62c08f69689a7b652c35989d717f9014)

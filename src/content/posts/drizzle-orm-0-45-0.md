---
author: Артём Нецветаев
pubDatetime: 2026-06-28T22:49:07.000Z
title: "Drizzle ORM 0.45.0: subqueries в select, pg-native Pool и SQL в $onUpdate"
slug: drizzle-orm-0-45-0
featured: false
draft: false
tags:
  - release
  - drizzle-orm
  - database
description: "Обзор минорного релиза Drizzle ORM 0.45.0: подзапросы прямо в select fields, корректные транзакции с pg-native Pool, переименование algorythm в algorithm, SQL-значения в $onUpdate и исправление Date/string маппинга для bun-sql:postgresql."
---

Drizzle Team выпустила минорный релиз [`drizzle-orm@0.45.0`](https://github.com/drizzle-team/drizzle-orm/releases/tag/0.45.0). В GitHub Release перечислены пять изменений, поэтому для обзора я сверил release body, compare [`0.44.7...0.45.0`](https://github.com/drizzle-team/drizzle-orm/compare/0.44.7...0.45.0), PR [#1674](https://github.com/drizzle-team/drizzle-orm/pull/1674), PR [#1676](https://github.com/drizzle-team/drizzle-orm/pull/1676), PR [#1708](https://github.com/drizzle-team/drizzle-orm/pull/1708), issue [#2388](https://github.com/drizzle-team/drizzle-orm/issues/2388), PR [#2911](https://github.com/drizzle-team/drizzle-orm/pull/2911) и issue [#4493](https://github.com/drizzle-team/drizzle-orm/issues/4493).

Главная практическая новость — в `select({ ... })` теперь можно класть scalar subquery, а Drizzle сохранит тип и runtime decoder выбранной колонки. Остальные пункты релиза закрывают неприятные edge cases в PostgreSQL/Bun SQL и исправляют опечатку в API MySQL/SingleStore indexes.

## Subqueries теперь можно выбирать как поля `select({ ... })`

До 0.45.0 подзапросы хорошо работали в `from(...)` и `join(...)`, но не как отдельное поле результата в `db.select({ ... })`. PR [#1674](https://github.com/drizzle-team/drizzle-orm/pull/1674) расширяет `SelectedFieldsFlat` и `SelectedFieldsOrdered`: поле select теперь может быть не только `Column`, `SQL` или `SQL.Aliased`, но и `Subquery`.

Типичный кейс — посчитать связанные строки без ручного `sql<number>` в каждом запросе:

```ts
import { count, eq } from "drizzle-orm";

const rows = await db
  .select({
    population: db
      .select({ count: count().as("count") })
      .from(users)
      .where(eq(users.cityId, cities.id))
      .as("population"),
    name: cities.name,
  })
  .from(cities);

// тип результата: { population: number; name: string }[]
```

Из diff видно два важных ограничения/свойства. Во-первых, subquery в select field должен возвращать ровно одну колонку: для нескольких выбранных полей тип уходит в `DrizzleTypeError<'You can only select one column in the subquery'>`. Во-вторых, Drizzle переносит decoder выбранной колонки на весь subquery. Поэтому scalar subquery с `timestamp` или другой колонкой с маппером не превращается в сырой driver value — результат проходит через тот же `mapFromDriverValue`.

Поддержка добавлена не точечно для PostgreSQL: изменения есть в dialect-файлах `gel-core`, `mysql-core`, `pg-core`, `singlestore-core` и `sqlite-core`, а type tests обновлены для MySQL, PostgreSQL и SQLite. В integration tests появились кейсы `select from a many subquery` и `select from a one subquery` для разных драйверов.

## Транзакции с `pg-native` Pool больше не обходят pool-логику

PR [#1708](https://github.com/drizzle-team/drizzle-orm/pull/1708) чинит транзакции в `drizzle-orm/node-postgres`, когда клиент создан через `pg-native` Pool. До релиза Drizzle проверял только `this.client instanceof Pool` из обычного `pg`, поэтому native pool не распознавался как pool: сессия не брала отдельный connection через `connect()` и не освобождала его через `release()` в `finally`.

В `drizzle-orm/src/node-postgres/session.ts` теперь извлекается `native` из `pg`, создаётся `NativePool = native?.Pool`, а проверка стала такой:

```ts
const session =
  this.client instanceof Pool ||
  (NativePool && this.client instanceof NativePool)
    ? new NodePgSession(
        await this.client.connect(),
        this.dialect,
        this.schema,
        this.options
      )
    : this;
```

Та же проверка используется перед `release()`. Для приложений на `pg-native` это означает, что `db.transaction(...)` снова работает как pool transaction: берёт connection на время транзакции и гарантированно возвращает его в pool после `commit` или `rollback`.

## `algorythm` переименован в `algorithm` для MySQL и SingleStore indexes

Релизный пункт «Updated typo algorythm => algorithm» — это изменение публичного builder API, а не только правка комментария. PR [#1676](https://github.com/drizzle-team/drizzle-orm/pull/1676) меняет метод и поле конфигурации индекса в `drizzle-orm/src/mysql-core/indexes.ts` и `drizzle-orm/src/singlestore-core/indexes.ts`:

```ts
uniqueIndex("uniqueClass")
  .on(users.class, users.subClass)
  .lock("default")
  .algorithm("copy")
  .using("btree");
```

В serializer'ах Drizzle Kit (`drizzle-kit/src/serializer/mysqlSerializer.ts` и `drizzle-kit/src/serializer/singlestoreSerializer.ts`) чтение тоже переехало с `value.config.algorythm` на `value.config.algorithm`. Если в проекте использовался старый `.algorythm(...)`, это место стоит переименовать вместе с обновлением до 0.45.0.

## `$onUpdate` теперь принимает `SQL`/placeholder значения без падения мапперов

Issue [#2388](https://github.com/drizzle-team/drizzle-orm/issues/2388) описывал схему с `timestamp(...).$onUpdate(() => sql\`CURRENT_TIMESTAMP\`)`, которая падала на `TypeError: value.toISOString is not a function`. Причина была в том, что column mapper ожидал обычное значение колонки (`Date`, JSON, point tuple и т. п.) и пытался сериализовать `SQL` как это значение.

В релизе это исправлено не только для PostgreSQL timestamp. Коммит [`adf9bf1`](https://github.com/drizzle-team/drizzle-orm/commit/adf9bf1fb4074ae563024f1acd8a20a1c72136ac) и rework PR [#2911](https://github.com/drizzle-team/drizzle-orm/pull/2911) расширяют `mapToDriverValue` в наборах колонок PostgreSQL, MySQL, SQLite, SingleStore и Gel: мапперы пропускают `SQL` и `Placeholder` дальше, а обычные значения продолжают сериализовать как раньше.

Практический пример из новых integration tests:

```ts
const users = pgTable("users_on_update", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .$onUpdate(() => sql`now()`),
});

await db.update(users).set({ name: "John" });
```

Аналогичные тесты добавлены для MySQL (`sql\`current_timestamp\``), SQLite (выражение на `strftime(...)`), SingleStore и Gel. Это важно для схем, где значение обновления должно вычисляться на стороне базы, а не в JavaScript-процессе.

## `bun-sql:postgresql` корректнее обрабатывает Date от драйвера

Issue [#4493](https://github.com/drizzle-team/drizzle-orm/issues/4493) был про импорт `drizzle` из `drizzle-orm/bun-sql`: даже для `timestamp(..., { mode: "string" })` пользователь получал `Date` object вместо строки. В релизе commit [`74b85ae`](https://github.com/drizzle-team/drizzle-orm/commit/74b85ae259036cd4f1becc040387df538c2a8e32) меняет PostgreSQL date/timestamp mappers так, чтобы `mapFromDriverValue` принимал и `string`, и `Date`.

Для `date(..., { mode: "string" })` Date теперь превращается в `YYYY-MM-DD` через `toISOString().slice(0, -14)`. Для `timestamp(..., { mode: "string" })` Date форматируется в строку вида `YYYY-MM-DD HH:mm:ss.sss`; для `withTimezone: true` добавляется offset (`+00`, `-03` и т. п.). В `mode: "date"` Date от драйвера возвращается как есть, а строка по-прежнему превращается в `Date`.

Релиз добавляет большой integration test `all types` для `integration-tests/tests/bun/bun-sql.test.ts`: он создаёт таблицу PostgreSQL с `date`, `dateStr`, `timestamp`, `timestampTz`, `timestampStr`, `timestampTzStr` и массивами этих типов, затем проверяет и TypeScript-тип результата, и фактические значения. Для пользователей `bun-sql:postgresql` это особенно заметно при миграции с `node-postgres`: `mode: "string"` снова означает строковый результат и для `date`, и для `timestamp`.

## Что проверить при обновлении

- Если используете MySQL или SingleStore index builder, замените `.algorythm(...)` на `.algorithm(...)`.
- Если раньше писали scalar subquery через raw `sql`, попробуйте перенести его в `db.select({ field: db.select(...).as(...) })`: Drizzle 0.45.0 теперь сам держит тип результата и decoder.
- Если отключали `$onUpdate(() => sql\`...\`)` из-за падения мапперов, можно вернуть database-side timestamp/expr обновления и проверить integration path на своём драйвере.
- Если проект на Bun SQL + PostgreSQL полагался на workaround для `Date` вместо string в `date`/`timestamp`, после обновления workaround может стать лишним.

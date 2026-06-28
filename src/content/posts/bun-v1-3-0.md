---
author: Артём Нецветаев
pubDatetime: 2026-06-28T21:17:33.000Z
title: "Bun 1.3.0: full-stack dev server, Bun.SQL и security scanner"
slug: bun-v1-3-0
featured: false
draft: false
tags:
  - release
  - bun
  - javascript
description: "Обзор минорного релиза Bun 1.3.0: запуск HTML-файлов, HMR и routes в Bun.serve(), компиляция full-stack apps в один executable, unified Bun.SQL для PostgreSQL/MySQL/SQLite, Redis, security scanner, minimumReleaseAge, catalogs и test.concurrent."
---

Bun выпустил минорный релиз [`bun-v1.3.0`](https://github.com/oven-sh/bun/releases/tag/bun-v1.3.0). GitHub Release почти целиком отправляет в официальный пост [Bun 1.3](https://bun.com/1.3), поэтому для этого обзора я сверил release, compare [`bun-v1.2.23...bun-v1.3.0`](https://github.com/oven-sh/bun/compare/bun-v1.2.23...bun-v1.3.0) и изменения в документации/типах релизного тега: `packages/bun-types/serve.d.ts`, `docs/api/sql.md`, `docs/api/redis.md`, `docs/cli/bun-install.md`, `docs/install/workspaces.md`, `docs/test/configuration.md`.

Главная тема 1.3 — Bun перестаёт быть только runtime/package manager/test runner и сильнее заходит в full-stack JavaScript: frontend dev server, typed routes в `Bun.serve()`, базы данных, Redis, workspace-безопасность и новые режимы тестов теперь поставляются из коробки.

## HTML-файлы можно запускать напрямую

Bun 1.3 добавляет frontend development flow без отдельного Vite/webpack-конфига: HTML-файл становится entrypoint'ом. Команда из релизного поста:

```bash
bun './**/*.html'
```

Это не просто static server. В посте и документации bundler'а изменение описано как сборка через встроенные транспайлеры JavaScript, CSS, HTML и React. Для разработки dev server включает Hot Module Replacement, React Fast Refresh и `import.meta.hot`; watcher реализован нативно через `kqueue` на macOS, `inotify` на Linux и `ReadDirectoryChangesW` на Windows.

Production-сборка теперь тоже может начинаться с HTML:

```bash
bun build ./index.html --production --outdir=dist
```

Для новых проектов `bun init` получил frontend-варианты:

```bash
bun init --react
bun init --react=tailwind
bun init --react=shadcn
```

Практический эффект: простой React/HTML-проект можно поднять, смотреть HMR и собрать production output без установки отдельного dev server'а.

## `Bun.serve()` получил routes, HTML imports и dev-настройки

В Bun 1.2 появились HTML imports, а в 1.3 они стали частью серверного API. Типы в `packages/bun-types/serve.d.ts` добавляют `Serve.Development` с настройками `hmr`, `console` и `chromeDevToolsAutomaticWorkspaceFolders`, а `routes` теперь принимает `Response`, `BunFile`, `HTMLBundle`, функцию-handler или объект с HTTP-методами `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`.

Минимальный full-stack сервер из нового API выглядит так:

```ts
import homepage from "./index.html";
import dashboard from "./dashboard.html";
import { serve } from "bun";

serve({
  development: {
    hmr: true,
    console: true,
  },
  routes: {
    "/": homepage,
    "/dashboard": dashboard,
  },
});
```

Для API-маршрутов типы извлекают параметры из path-шаблона: `ExtractRouteParams` распознаёт `:id`, поэтому handler для `"/api/users/:id"` получает `req.params.id`.

```ts
import App from "./myReactSPA.html";
import { serve, sql } from "bun";

serve({
  port: 3000,
  routes: {
    "/*": App,

    "/api/users": {
      GET: async () => Response.json(await sql`SELECT * FROM users LIMIT 10`),
      POST: async req => {
        const { name, email } = await req.json();
        const [user] = await sql`
          INSERT INTO users ${sql({ name, email })}
          RETURNING *;
        `;
        return Response.json(user);
      },
    },

    "/api/users/:id": async req => {
      const [user] = await sql`
        SELECT * FROM users WHERE id = ${req.params.id} LIMIT 1
      `;
      return user
        ? Response.json(user)
        : new Response("Not found", { status: 404 });
    },
  },
});
```

Ещё одно важное следствие: full-stack приложение можно компилировать в single-file executable:

```bash
bun build --compile ./index.html --outfile myapp
```

В релизном посте отдельно отмечено, что такой executable может использовать `Bun.serve()` routes, `Bun.sql`, `Bun.redis` и остальные Bun API внутри одного переносимого бинарника.

## `Bun.SQL`: один API для PostgreSQL, MySQL/MariaDB и SQLite

До 1.3 встроенный SQL-клиент Bun был в первую очередь PostgreSQL-клиентом. В 1.3 документация `docs/api/sql.md` описывает unified Promise-based API для PostgreSQL, MySQL и SQLite с теми же tagged template literals, connection pooling, transactions и prepared statements.

```ts
import { sql, SQL } from "bun";

const postgres = new SQL("postgres://user:***@localhost:5432/mydb");
const mysql = new SQL("mysql://user:***@localhost:3306/database");
const mysql2 = new SQL("mysql2://user:password@localhost:3306/database");
const sqlite = new SQL("sqlite://myapp.db");

const users = await mysql`SELECT * FROM users WHERE active = ${true}`;
```

MySQL можно настраивать и через object form:

```ts
const db = new SQL({
  adapter: "mysql",
  hostname: "localhost",
  port: 3306,
  database: "myapp",
  username: "dbuser",
  password: "secretpass",
});
```

Transactions и bulk inserts используют тот же стиль, что PostgreSQL:

```ts
await db.begin(async tx => {
  await tx`INSERT INTO users (name) VALUES (${"Alice"})`;
  await tx`UPDATE accounts SET balance = balance - 100 WHERE user_id = ${userId}`;
});

await db`INSERT INTO users ${db([
  { name: "Alice", email: "alice@example.com" },
  { name: "Bob", email: "bob@example.com" },
])}`;
```

Для PostgreSQL в релизе появился `sql.array`. Он нужен, чтобы передавать массивы с явным PostgreSQL-типом: `TEXT`, `INTEGER`, `BOOLEAN`, `JSONB`, `TIMESTAMP`, `UUID`, `INET` и другие.

```ts
await sql`
  INSERT INTO users (name, roles)
  VALUES (${"Alice"}, ${sql.array(["admin", "user"], "TEXT")})
`;

await sql`
  SELECT ${sql.array([{ a: 1 }, { b: 2 }], "JSONB")} AS data
`;
```

## Redis стал встроенным клиентом, а не внешней зависимостью

В `docs/api/redis.md` релизного тега Bun описывает Promise-based Redis API с typed responses, TLS support и ленивым подключением: соединение не открывается до первой команды. По умолчанию `redis` читает `REDIS_URL`, иначе использует `redis://localhost:6379`.

```ts
import { redis, RedisClient } from "bun";

await redis.set("greeting", "Hello from Bun!");
const greeting = await redis.get("greeting");

const client = new RedisClient("redis://username:***@localhost:6379");
await client.set("counter", "0");
await client.incr("counter");
client.close();
```

Для pub/sub используется тот же `RedisClient`:

```ts
const writer = new RedisClient("redis://localhost:6379");
await writer.connect();
await writer.publish("general", "Hello everyone!");
writer.close();
```

Это важно для standalone/full-stack сценариев: `Bun.redis` и `RedisClient` доступны в том же runtime, который обслуживает HTML routes и API.

## Package manager: security scanner, `minimumReleaseAge`, catalogs и platform flags

Самая прикладная часть для monorepo и CI — новые защитные и workspace-настройки `bun install`.

Security Scanner API подключается через `bunfig.toml`. Сканер вызывается во время `bun install`, `bun add` и других package operations, может вернуть `fatal` или `warn`; `fatal` останавливает установку с non-zero exit code, а `warn` в CI тоже завершает процесс без интерактивного продолжения.

```toml
[install.security]
scanner = "@acme/bun-security-scanner"
```

`minimumReleaseAge` блокирует слишком свежие публикации. Значение задаётся в секундах:

```toml
[install]
minimumReleaseAge = 604800 # 7 дней
```

Для platform-specific optional dependencies появились `--cpu` и `--os`. Документация фиксирует accepted CPU values `arm64`, `x64`, `ia32`, `ppc64`, `s390x` и OS values `linux`, `darwin`, `win32`, `freebsd`, `openbsd`, `sunos`, `aix`.

```bash
bun install --os linux --cpu arm64
bun install --os darwin --os linux --cpu x64
bun install --os '*' --cpu '*'
```

Для pnpm-миграций Bun теперь переносит `pnpm-workspace.yaml` в `package.json` `workspaces`: `packages`, `catalog`, `catalogs`, а dependencies с `catalog:` / `catalog:build` сохраняет как catalog dependencies.

```json
{
  "workspaces": {
    "packages": ["apps/*", "packages/*"],
    "catalog": {
      "react": "^18.0.0",
      "typescript": "^5.0.0"
    },
    "catalogs": {
      "build": {
        "webpack": "^5.0.0"
      }
    }
  },
  "dependencies": {
    "react": "catalog:",
    "webpack": "catalog:build"
  }
}
```

Дополнительно появились everyday-команды: `bun why <package>` для объяснения dependency chain и `bun update --interactive` для выборочного обновления зависимостей.

## `bun:test`: concurrent/serial режимы и VS Code Test Explorer

Bun 1.3 добавляет несколько тестовых улучшений. На уровне editor UX — интеграция с VS Code Test Explorer через расширение Bun for Visual Studio Code: тесты видны в sidebar, их можно запускать и debug'ить из редактора.

На уровне API появился `test.concurrent` и `describe.concurrent` для параллельного запуска asynchronous tests внутри одного файла. По умолчанию максимум — 20 concurrent tests; лимит меняется флагом `--max-concurrency`.

```ts
import { describe, expect, test } from "bun:test";

test.concurrent("fetch user", async () => {
  const res = await fetch("https://api.example.com/users/1");
  expect(res.status).toBe(200);
});

describe.concurrent("server tests", () => {
  test("parallel request", async () => {
    const response = await fetch("https://example.com/server-1");
    expect(response.status).toBe(200);
  });

  test.serial("still sequential", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Для opt-in по файлам есть `concurrentTestGlob` в `bunfig.toml`:

```toml
[test]
concurrentTestGlob = "**/integration/**/*.test.ts"
# или массив patterns:
# concurrentTestGlob = ["**/integration/**/*.test.ts", "**/*-concurrent.test.ts"]
```

Релиз также добавляет `--randomize`, чтобы обнаруживать скрытые зависимости тестов от порядка выполнения.

## Диагностика: async stack traces в JavaScriptCore

Bun 1.3 подтягивает async stack traces в JavaScriptCore. Раньше ошибка внутри цепочки `foo -> await bar -> await baz` могла терять async-call trace; теперь stack показывает `at async bar` и `at async foo`, а не только место `throw`.

```ts
async function foo() {
  return await bar();
}
async function bar() {
  return await baz();
}
async function baz() {
  await 1;
  throw new Error("oops");
}

try {
  await foo();
} catch (e) {
  console.log(e);
}
```

По release post это изменение сделано совместно с WebKit, поэтому оно полезно не только Bun-приложениям: улучшение попадает в JavaScriptCore-based runtimes, включая Safari.

## Что проверить перед обновлением

- Если проект уже использует Vite/webpack только для простого HTML/React dev server'а, можно отдельно попробовать `bun './**/*.html'` и `bun build ./index.html --production --outdir=dist`.
- Backend-приложениям на `Bun.serve()` стоит проверить новый `routes` API: он закрывает static/HTML/API routes и typed `req.params` в одном объекте.
- Командам с PostgreSQL/MySQL/SQLite стоит оценить `Bun.SQL`, особенно если хочется убрать `pg`, `mysql2` или отдельный SQLite-клиент из простых сервисов.
- В CI для package manager'а наиболее полезны `minimumReleaseAge`, scanner в `[install.security]`, `--os`/`--cpu` и `linkWorkspacePackages = false`.
- Большим test suites стоит начинать с `test.concurrent` / `concurrentTestGlob` для I/O-bound тестов и добавить `test.serial` там, где есть shared state.

Обновление обычное:

```bash
bun upgrade
```

# 07 — Setup and run

This document tracks **reality**. Commands appear here only once the task that creates them has landed.
If a section says _"not yet — T-xxx"_, that code does not exist.

## 1. Prerequisites

| Tool   | Version                                  | Why                                |
| ------ | ---------------------------------------- | ---------------------------------- |
| Node   | `>=22 <23`                               | pinned in `.nvmrc` and `engines`   |
| pnpm   | 9.15.4                                   | `packageManager` in `package.json` |
| Docker | any recent, via Colima or Docker Desktop | Postgres + Redis                   |

The Supabase CLI is **not** needed yet: Phase 1 runs on plain Postgres, which Prisma migrates the
same way it will migrate the hosted Supabase database (ADR-003). It arrives with T-063.

## 2. First run

```bash
pnpm install
pnpm infra:up                 # Postgres on :5433, Redis on :6381 — waits until healthy
pnpm db:migrate               # applies libs/db/prisma/migrations
pnpm db:seed                  # DROP 014 live, DROP 013 archived, 56 variants — idempotent
pnpm frames                   # renders the seed turntables into apps/web/public/frames (~50s, gitignored)
pnpm check                    # everything green before you touch anything
pnpm dev                      # web :3000 · admin :3001 · api :4100 · worker
```

Ports are offset (5433, 6381) so this runs beside other projects' stacks — `classroom-metaverse`
holds 5432 and 6380 on the reference machine.

## 3. Commands

| Command                                        | What                                                      |
| ---------------------------------------------- | --------------------------------------------------------- |
| `pnpm check`                                   | typecheck, lint, test, build — every project              |
| `pnpm affected`                                | the same, only what changed                               |
| `pnpm dev`                                     | all four apps in parallel                                 |
| `pnpm exec nx run web:budget`                  | initial-route JS ≤ 180 KB gzipped; fails on regression    |
| `pnpm infra:up` / `infra:down` / `infra:reset` | Postgres + Redis (`reset` wipes volumes)                  |
| `pnpm db:migrate` / `db:seed`                  | Prisma migrate dev / local seed                           |
| `pnpm exec nx sync`                            | fix tsconfig project references after a dependency change |
| `pnpm format` / `format:check`                 | prettier                                                  |

Always run through `nx`, never the underlying tool — the cache and `dependsOn` graph are what stop a
suite passing against a stale build. The API and worker suites talk to the real Postgres and Redis, so
`pnpm infra:up` must be running.

## 4. Environment variables

Names only. Values live in `.env`, which is git-ignored and `deny`-listed in `.claude/settings.json`.

`apps/api/.env.example` — **not yet, T-025**

```
DATABASE_URL  DIRECT_URL  PORT
SUPABASE_URL  SUPABASE_SERVICE_ROLE_KEY  SUPABASE_JWT_SECRET
RAZORPAY_KEY_ID  RAZORPAY_KEY_SECRET  RAZORPAY_WEBHOOK_SECRET
PRINTROVE_EMAIL  PRINTROVE_PASSWORD  PRINTROVE_WEBHOOK_SECRET
REDIS_URL  SENTRY_DSN
```

`apps/worker/.env.example` — **not yet, T-026**

```
DATABASE_URL  REDIS_URL
SUPABASE_URL  SUPABASE_SERVICE_ROLE_KEY
PRINTROVE_EMAIL  PRINTROVE_PASSWORD
REDDIT_CLIENT_ID  REDDIT_CLIENT_SECRET  YOUTUBE_API_KEY
RESEND_API_KEY  SENTRY_DSN
```

`apps/web/.env.example` — **not yet, T-027**

```
NEXT_PUBLIC_API_URL  NEXT_PUBLIC_SUPABASE_URL  NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_RAZORPAY_KEY_ID
```

**No service role key, provider secret or webhook secret may ever appear in a `NEXT_PUBLIC_` variable.**
The module boundary in [04 §4](./04-hld.md) makes importing a pod or payment package from `scope:web`
a build failure, which is the structural half of the same rule.

## 5. Conventions

- **ESM only.** No CommonJS anywhere.
- **Zod at every boundary** — HTTP, webhook, queue payload, env.
- **Money is integer paise.** No floats, ever. Currency explicit on every amount.
- **Nest:** one module per bounded context. Services hold domain logic and never import HTTP types.
- **Next:** server components by default; `'use client'` only where interactivity genuinely needs it.
- **`apps/web/app/api/` is BFF only** — auth callbacks and webhooks. Never domain logic.
- **No raw hex, font stack or duration outside `libs/ui`.** Lint rule, T-023.
- Commits follow Conventional Commits. Branches: `type/scope-short-description`.

## 6. Troubleshooting

Entries get added the first time something costs more than ten minutes.

- **`docker compose` says "unknown command"** — a stale Docker Desktop symlink in
  `~/.docker/cli-plugins`. `tools/compose.sh` falls back to the standalone `docker-compose`.
- **"port is already allocated" on `infra:up`** — another project's containers hold the port. Set
  `POSTGRES_PORT` / `REDIS_PORT` (see `infra/.env.example`).
- **"The workspace is out of sync"** — a project gained a workspace dependency. `pnpm exec nx sync`.
- **Prisma 7's `$connect()` opens nothing** with a driver adapter. The API proves the database at
  boot with `SELECT 1`; do the same in any new process that owns a client.
- **The hero shows a still and never turns** — the frames are not rendered. `pnpm frames`.
- **`motion-check` says the browser is missing** — `pnpm exec playwright install chromium`.
- **Checkout says "Test payments — no money moves"** — the API runs `PAYMENTS=fake` (the local default).
  Set the three `RAZORPAY_*` variables and `PAYMENTS=razorpay` to take real test payments.
- **Something else is on :4000** — on the reference machine it is `country_dairy`'s API. NOWCORE uses 4100.
- **An order sits at PAID** — the worker is not running (`pnpm dev` starts it). The reconciliation sweep
  re-enqueues paid orders stranded for 10 minutes.
- **Play the printer locally** — `curl -X POST localhost:4100/dev/pod/NC-10427/advance` moves an order
  PRINTING → SHIPPED → DELIVERED through the real signed webhook path.
- **Force a tier to look at it** — append `?tier=full|reduced|static` to any URL.
- **Next apps have no inferred `typecheck`** because their tsconfig sets `noEmit`. Each declares an
  explicit `tsc --noEmit` target in its `package.json` — keep it when adding an app.

- A `noEmit` in a tsconfig silently disables the `typecheck` target. The target passes; nothing is checked.
- `@nx/js/typescript` infers no `build` target without a `tsconfig.lib.json`.
- Webhook signature verification fails silently if Fastify has parsed the body — the HMAC is over the
  raw bytes, and a re-serialised JSON body will not match.

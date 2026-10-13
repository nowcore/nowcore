# 04 — High-level design

## 1. System context

```
   ┌─────────┐   ┌─────────┐        ┌──────────────┐        ┌──────────────┐
   │ Visitor │   │Operator │        │   Razorpay   │        │  Printrove   │
   └────┬────┘   └────┬────┘        └──────┬───────┘        └──────┬───────┘
        │             │                    │ webhooks              │ webhooks
        ▼             ▼                    ▼                       ▼
  ┌───────────┐ ┌───────────┐      ┌──────────────────────────────────────┐
  │ apps/web  │ │apps/admin │─────▶│             apps/api                 │
  │ Next.js   │ │ Next.js   │      │        NestJS + Fastify              │
  │ cinematic │ │ shadcn    │      │  the only database writer            │
  └─────┬─────┘ └─────┬─────┘      └───────┬──────────────────┬───────────┘
        │             │                    │                  │ enqueue
        │ reads       │ Realtime           ▼                  ▼
        │             │            ┌──────────────┐   ┌───────────────┐
        └─────────────┴───────────▶│   Supabase   │   │  apps/worker  │
                                   │ PG · Auth ·  │◀──│ NestJS+BullMQ │
                                   │ Storage · RT │   │  Redis queue  │
                                   └──────────────┘   └───────┬───────┘
                                                              │
                                      ┌───────────────────────┴────────────┐
                                      │ POD submit · frame render · trend  │
                                      │ ingest · email/WhatsApp · scheduler│
                                      └────────────────────────────────────┘
```

## 2. Services

| Service       | Runtime                    | Owns                                                                                                             |
| ------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `apps/web`    | Next.js 16, Node           | The cinematic storefront. Reads catalogue via RSC, writes only through the API. Holds no provider secret.        |
| `apps/admin`  | Next.js 16, Node           | Operator tool. Drop authoring, order board (Supabase Realtime), trend radar, revenue.                            |
| `apps/api`    | NestJS 11 + Fastify        | Every domain rule. The only process with a database write path or a provider credential. Receives all webhooks.  |
| `apps/worker` | NestJS standalone + BullMQ | Everything slow or retryable: POD submission, turntable rendering, trend ingest, notifications, drop scheduling. |

Four deployables, one database, one queue. The split is along _failure modes_, not along features: the
worker exists because a slow job must not block a request, and the API exists because a domain rule must
not live in a rendering framework.

## 3. Request paths

**Browse** — `apps/web` RSC → Prisma read replica → rendered HTML. No API hop; the catalogue is public
and the render is cached per drop with tag-based revalidation on publish.

**Buy** — `apps/web` → `POST /orders` → API validates variant availability _and price_ server-side →
creates Razorpay order → client completes payment → Razorpay webhook → API marks `PAID` → enqueues
`pod.submit`.

Price and availability are re-checked on the server at order creation. The client's cart is a suggestion.

**Fulfil** — worker `pod.submit` → `libs/pod` → Printrove → store `pod_order_id`. Printrove webhooks →
API → order transitions + buyer notification.

**Author** — `apps/admin` → API → Supabase Storage for artwork → enqueue `render.turntable` → frames
land in Storage → drop becomes publishable.

## 4. Directory structure

```
nowcore/
├── CLAUDE.md  .mcp.json  nx.json  pnpm-workspace.yaml  tsconfig.base.json
├── .claude/
│   ├── settings.json                  shared, checked in
│   ├── settings.local.json            gitignored
│   └── skills/{new-drop,finish-task,motion-check}/SKILL.md
├── apps/
│   ├── web/          @nowcore/web     app/(shop)/ (drop)/ (legal)/ · features/ · lib/
│   ├── admin/        @nowcore/admin   app/(dash)/ · features/
│   ├── api/          @nowcore/api     src/modules/{drops,products,orders,payments,
│   │                                  fulfilment,trends,customers,wall}/ · src/webhooks/
│   ├── worker/       @nowcore/worker  src/jobs/{pod-submit,render-turntable,trend-ingest,
│   │                                  notify,schedule-drops}/
│   ├── web-e2e/  admin-e2e/           Playwright
├── libs/
│   ├── shared/       @nowcore/shared  domain types + zod schemas
│   ├── db/           @nowcore/db      prisma/schema.prisma + migrations
│   ├── ui/           @nowcore/ui      tokens, primitives, shadcn base
│   ├── motion/       @nowcore/motion  ScrollStage, CanvasSequence, TextReveal, ChapterRail,
│   │                                  Marquee, Grain, MagneticCursor, Curtain, tiers
│   ├── pod/          @nowcore/pod     PodProvider port + SandboxPrinter (Printrove adapter: T-059)
│   └── orders/       @nowcore/orders  the guarded order transition + signed order tokens,
│                                      shared by api (payments, printer webhooks) and worker
├── infra/            docker-compose: Postgres 16 :5433 + Redis 7 :6381
├── tools/            scaffold-lib.sh · compose.sh · eslint/no-raw-design-values.mjs
└── docs/             01…11 + adr/
```

**Module boundaries** (`@nx/enforce-module-boundaries`, fails the build):

| Tag            | May import                                              | Banned externals                                 |
| -------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `scope:shared` | `scope:shared`                                          | react, next, @nestjs/_, @prisma/_                |
| `scope:motion` | `scope:motion`, `scope:shared`                          | @nestjs/_, @prisma/_, any pod or payment package |
| `scope:pod`    | `scope:pod`, `scope:shared`                             | react, next                                      |
| `scope:web`    | `scope:web`, `scope:motion`, `scope:ui`, `scope:shared` | @prisma/*, razorpay, any pod package             |
| `scope:server` | `scope:server`, `scope:pod`, `scope:shared`             | react, next                                      |

The ban on `scope:web` importing a pod or payment package is the one that matters: it makes it structurally
impossible to leak a provider credential into the browser bundle.

## 5. Environments

|            | Local                             | Preview                | Production                      |
| ---------- | --------------------------------- | ---------------------- | ------------------------------- |
| DB         | Supabase local (`supabase start`) | Supabase branch per PR | Supabase project, Mumbai region |
| Redis      | docker-compose                    | Upstash                | Upstash                         |
| Razorpay   | test keys                         | test keys              | live keys                       |
| Printrove  | sandbox                           | sandbox                | live                            |
| Web/Admin  | `nx serve`                        | Vercel preview         | Vercel, Mumbai edge             |
| API/Worker | `nx serve`                        | Railway/Fly preview    | Railway/Fly, Mumbai             |

Production region is Mumbai for every component. The buyer, the printer and the payment processor are all
in India; putting the database in Virginia would add a round trip to every page.

## 6. Failure modes

| Failure               | Blast radius                       | Response                                                                                              |
| --------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Printrove down        | New orders accepted, not fulfilled | Queue retries with backoff 24h, then operator alert. Buyer sees "preparing", not an error.            |
| Razorpay webhook lost | Order stuck `PENDING`              | Reconciliation job polls Razorpay every 5 min for pending orders older than 2 min.                    |
| Duplicate webhook     | None                               | Idempotency table keyed on provider event id; second delivery is a no-op.                             |
| Redis down            | No fulfilment, no renders          | API still takes orders; jobs persist in Redis AOF and drain on recovery. Alert immediately.           |
| Frame CDN slow        | Hero never upgrades from fallback  | Static fallback is the LCP element by design; the page is fully shoppable without a single frame.     |
| Supabase down         | Total outage                       | Accepted. Single-region, single-provider is the right trade at this stage; revisit above ~₹10L/month. |
| Variant unmapped      | Order takes money, cannot be made  | Prevented, not handled: a drop cannot open with an unmapped variant. Enforced in the publish check.   |

## 7. Observability

Sentry for errors in all four apps. Structured JSON logs with a request id propagated into queue jobs, so
one order can be traced from click to tracking number. A dashboard of the four numbers that mean anything:
orders/hour, payment success rate, POD submission success rate, and p95 scroll frame rate from field RUM.

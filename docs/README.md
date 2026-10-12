# NOWCORE — Documentation

> **NOWCORE** — _wear the moment._ A trend-driven merch label. A trend is spotted, drawn, dropped,
> printed and shipped inside a day. India first, zero inventory, 72-hour drops that never restock.

---

## Design artifacts

| Artifact                  | What it is                                                                                                                                                                                      | Link                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **NOWCORE design canvas** | Eight artboards: brand system, motion grammar, the homepage film, the shop rail, the product page, the admin order board, and mobile. The brand board re-tints live when you click a drop chip. | [Open](https://claude.ai/artifact/PXvXBuUKwzsm5i8gvawop6) |

Private artifact. Canvas is at **v0.1**; when it changes, note the version here.

**Reference sites studied** (13 Oct 2026):
[makeaimedicoreagain.com](https://www.makeaimedicoreagain.com/) — the business model (Wix + print-on-demand,
Bella+Canvas blanks, DTF/DTG). [morphowater.com](https://morphowater.com/) — the design language
(Next.js App Router, seven chaptered scroll films, sticky stage + canvas image sequence; its hero fallback
image is frame 376 of a pre-rendered sequence, not Three.js).

---

## Documents

Read in order. Each builds on the last.

| #   | Doc                                      | Purpose                                                  | Status |
| --- | ---------------------------------------- | -------------------------------------------------------- | ------ |
| 01  | [Requirements](./01-requirements.md)     | Product principles, actors, FR/NFR, non-goals            | Draft  |
| 02  | [UX flows](./02-ux-flows.md)             | Every flow, step by step, with states and edge cases     | Draft  |
| 03  | [Tech stack](./03-tech-stack.md)         | Every choice with the reasoning and what was rejected    | Draft  |
| 04  | [High-level design](./04-hld.md)         | Services, data flow, directory structure, failure modes  | Draft  |
| 05  | [Low-level design](./05-lld.md)          | Schema, API surface, webhook contracts, security         | Draft  |
| 06  | [Task breakdown](./06-task-breakdown.md) | Granular, estimated, dependency-ordered work             | Draft  |
| 07  | [Setup & run](./07-setup.md)             | Prerequisites, commands, layout, troubleshooting         | Live   |
| 08  | [Build progress](./08-progress.md)       | **Running log — read first when picking up work**        | Live   |
| 09  | [Agent tooling](./09-agent-tooling.md)   | MCP servers and skills — what is set up, and what is not | Live   |
| 10  | [Design system](./10-design-system.md)   | Tokens, type, motion grammar, performance budgets        | Draft  |
| 11  | [Business model](./11-business-model.md) | Unit economics, pricing, COD policy, IP rules            | Draft  |

**ADRs** live in [`./adr/`](./adr/):

| ADR                                      | Decision                                                                                   | Status   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| [001](./adr/001-pod-provider-port.md)    | Fulfilment sits behind a `PodProvider` port; Printrove is the first adapter                | Accepted |
| [002](./adr/002-motion-as-a-library.md)  | Motion is a library with budgets, not per-page animation code                              | Accepted |
| [003](./adr/003-supabase-with-prisma.md) | Supabase for Postgres/Auth/Storage/Realtime; Prisma as the ORM; the API is the only writer | Accepted |
| [004](./adr/004-cinematic-everywhere.md) | Cinematic treatment on every surface, paid for with three quality tiers and CI budgets     | Accepted |

**Stack:** Next.js 16 App Router · NestJS 11 (Fastify) · Supabase · Prisma · BullMQ · Nx + pnpm ·
Razorpay · Printrove.

---

## The four things that must not drift

1. **The brand is a system, not a vibe.** Tokens in `libs/ui` and [doc 10](./10-design-system.md).
   No raw hex outside `libs/ui` — a lint rule fails the build. The accent is `--drop-accent`, per drop.
2. **Motion is budgeted.** Every animated surface ships full / reduced / static tiers and holds
   ≥55fps p95 on a mid-tier Android. The static tier must stay completely shoppable.
3. **Fulfilment is behind a port.** Nothing outside `libs/pod` imports a Printrove type.
4. **Money is append-only and idempotent.** Order items snapshot price and title at purchase. Every
   webhook is idempotent on the provider's event id — both providers retry, both will double-fire.

## Current repo state

Design artifacts and documentation only. No application code yet — Phase 1 opens once the design is
signed off. See [08-progress.md](./08-progress.md).

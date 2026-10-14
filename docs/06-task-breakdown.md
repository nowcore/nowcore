# 06 — Task breakdown

Estimates assume **one experienced full-stack developer**, in ideal days (~6 focused hours).
Multiply by ~1.4 for calendar time. IDs are stable and referenceable in commits and PRs.

`D:` = depends on. Every task states its **done** condition — if you cannot test it, it is not done.

✅ = done. 🟡 = partly done, with the rest blocked; the entry in [08-progress.md](./08-progress.md) says on what.

---

## Phase 0 — Design and decide

**2 ideal days · no code**

> **GATE: the design is signed off.** Nothing in Phase 1 starts before this.

### E0.1 — Direction (0.5d)

| ID    | Task                                                           | Est  | D:    |
| ----- | -------------------------------------------------------------- | ---- | ----- |
| T-001 | ✅ Analyse both reference sites; record the technique findings | 0.2d | —     |
| T-002 | ✅ Decide name, market, fulfilment model, site shape, v1 scope | 0.1d | T-001 |
| T-003 | ✅ Brand direction: Archive of Now — palette, type, concept    | 0.2d | T-002 |

**done:** decisions recorded in [README](./README.md) and [03](./03-tech-stack.md).

### E0.2 — Design artifacts (1d)

| ID    | Task                                                               | Est  | D:    |
| ----- | ------------------------------------------------------------------ | ---- | ----- |
| T-004 | ✅ Brand system artboard — tokens, type, the two-line move, parts  | 0.3d | T-003 |
| T-005 | ✅ Motion grammar artboard — technique, primitives, tiers, budgets | 0.2d | T-003 |
| T-006 | ✅ Homepage artboards — hero + chapters 01–06                      | 0.3d | T-004 |
| T-007 | ✅ Commerce artboards — shop rail, product detail                  | 0.1d | T-004 |
| T-008 | ✅ Admin + mobile artboards                                        | 0.1d | T-004 |

**done:** canvas published, linked from [README](./README.md), reviewed by the operator.

### E0.3 — Documentation (0.5d)

| ID    | Task                                                 | Est  | D:    |
| ----- | ---------------------------------------------------- | ---- | ----- |
| T-009 | ✅ docs 01–05 — requirements, flows, stack, HLD, LLD | 0.3d | T-002 |
| T-010 | ✅ docs 06–11 + CLAUDE.md + skills + settings        | 0.2d | T-009 |
| T-011 | ✅ ADRs 001–004 written                              | 0.1d | T-010 |

**done:** a new developer can read 01→11 in order and know what to build and why.

---

## Phase 1 — Foundation

**6 ideal days · nothing visible ships**

### E1.1 — Monorepo (2d)

| ID    | Task                                                                                                                | Est  | D:    |
| ----- | ------------------------------------------------------------------------------------------------------------------- | ---- | ----- |
| T-012 | ✅ Init Nx 23 + pnpm workspaces; `.nvmrc`, `engines`, prettier, eslint                                              | 0.5d | T-011 |
| T-013 | ✅ `tsconfig.base.json` — strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no `paths`              | 0.3d | T-012 |
| T-014 | ✅ Nx project tags + `@nx/enforce-module-boundaries` per [04 §4](./04-hld.md). **Must fail the build on violation** | 0.5d | T-013 |
| T-015 | 🟡 GitHub Actions: `nx affected -t typecheck lint test build budget`, prettier `--check .`                          | 0.4d | T-014 |
| T-016 | ✅ `libs/shared` — domain types + zod schemas                                                                       | 0.3d | T-013 |

**done:** `pnpm check` green; a deliberate cross-boundary import fails CI.

### E1.2 — Data (1.5d)

| ID    | Task                                                                      | Est  | D:           |
| ----- | ------------------------------------------------------------------------- | ---- | ------------ |
| T-017 | 🟡 Supabase project (Mumbai) + local `supabase start` + `.env.example`    | 0.3d | T-012        |
| T-018 | ✅ `libs/db` — Prisma schema from [05 §1](./05-lld.md), initial migration | 0.6d | T-017, T-016 |
| T-019 | ✅ Seed script: one live drop, one archived, products, variants, SKUs     | 0.3d | T-018        |
| T-020 | ✅ `infra/docker-compose.yml` — Postgres 16 + Redis 7 + `pnpm infra:up`   | 0.3d | T-012        |

**done:** `pnpm infra:up && pnpm db:seed` yields a browsable database.

### E1.3 — Brand foundation (1.5d)

| ID    | Task                                                                                                                           | Est  | D:    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | ---- | ----- |
| T-021 | ✅ `libs/ui` — tokens from [10](./10-design-system.md) as CSS vars + Tailwind v4 theme                                         | 0.4d | T-012 |
| T-022 | ✅ Self-host Geist + Geist Mono (`geist` package) and Instrument Serif (`next/font/google`, downloaded at build); latin subset | 0.3d | T-021 |
| T-023 | ✅ **Lint rule banning raw colours (hex, rgb/hsl/oklch) and easing curves outside `libs/ui`**                                  | 0.4d | T-021 |
| T-024 | ✅ `--drop-accent` runtime theming — one drop re-tints every surface                                                           | 0.4d | T-021 |

**done:** a raw `#D7FF3E` in an app file fails lint; changing a drop's accent re-tints the whole app.

### E1.4 — App shells (1d)

| ID    | Task                                                                                         | Est  | D:    |
| ----- | -------------------------------------------------------------------------------------------- | ---- | ----- |
| T-025 | ✅ `apps/api` — NestJS + Fastify, raw-body config for webhooks, health endpoint              | 0.3d | T-018 |
| T-026 | ✅ `apps/worker` — NestJS standalone + BullMQ, one no-op job, graceful shutdown              | 0.3d | T-020 |
| T-027 | ✅ `apps/web` + `apps/admin` — Next 16 shells, separate `NEXT_DIST_DIR` per target           | 0.2d | T-021 |
| T-028 | ✅ `budget` nx target (cached, `dependsOn: build`), budgets from [10](./10-design-system.md) | 0.2d | T-027 |

**done:** all four serve; T-028 **must be watched failing** against a deliberately bloated bundle.

---

## Phase 2 — The film

**9 ideal days**

> **GATE: ≥55fps p95 scroll and LCP < 2.5s on a mid-tier Android at Fast 4G.**
> If this fails, the cinematic-everywhere decision gets revisited with data.

### E2.1 — Motion core (4d)

| ID    | Task                                                                                                                       | Est  | D:    |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | ---- | ----- |
| T-029 | ✅ `libs/motion` scaffold + tier detection (reduced-motion, effectiveType, saveData)                                       | 0.5d | T-027 |
| T-030 | ✅ `<ScrollStage>` — CSS-sticky stage emitting normalised progress; Lenis lazily on the full tier (no GSAP — ADR-002 rev.) | 1d   | T-029 |
| T-031 | ✅ `<CanvasSequence>` — `createImageBitmap` off-thread, ±8 pre-warm, fallback frame as LCP                                 | 1.5d | T-030 |
| T-032 | ✅ `<TextReveal>`, `<ChapterRail>`, `<Marquee>`                                                                            | 0.6d | T-030 |
| T-033 | 🟡 `<Grain>` ✅, `<Curtain>` as a CSS cross-document view transition ✅, `<MagneticCursor>` deferred to T-044              | 0.4d | T-030 |

**done:** each primitive has a Playwright visual baseline and behaves correctly in all three tiers.

### E2.2 — Turntable pipeline (2d)

| ID    | Task                                                                                                                                                          | Est  | D:           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------ |
| T-034 | ✅ `render.turntable` worker job: artwork + blank → 72 AVIF frames + fallback                                                                                 | 1.2d | T-026, T-031 |
| T-035 | 🟡 Frames through a `FrameStore` port; size budget asserted in the job ✅. Supabase Storage binding waits on the hosted project — local filesystem until then | 0.4d | T-034        |
| T-036 | ✅ Mobile frame set (24 frames) for the reduced tier                                                                                                          | 0.4d | T-034        |

**done:** one artwork upload yields a working turntable with no manual step. **This is the task that, if skipped, costs a day per drop forever.**

### E2.3 — Homepage (3d)

| ID    | Task                                                                                       | Est  | D:    |
| ----- | ------------------------------------------------------------------------------------------ | ---- | ----- |
| T-037 | ✅ Chapter 00 the signal — hero, pinned turntable, countdown                               | 0.6d | T-031 |
| T-038 | ✅ Chapter 01 what's now — trend ticker                                                    | 0.3d | T-032 |
| T-039 | ✅ Chapter 02 the drop — garment detail, specs, price, CTA                                 | 0.5d | T-031 |
| T-040 | ✅ Chapter 03 the archive — desaturated, stamped                                           | 0.4d | T-032 |
| T-041 | ✅ Chapter 04 the making — three beats                                                     | 0.3d | T-032 |
| T-042 | ✅ Chapter 05 the wall — UGC grid                                                          | 0.3d | T-032 |
| T-043 | ✅ Chapter 06 take it — CTA, waitlist, footer                                              | 0.3d | T-032 |
| T-044 | 🟡 Nav, dock, mobile composition at 390px ✅ — `<MagneticCursor>` (from T-033) still to do | 0.3d | T-037 |

**done:** `motion-check` passes on the homepage at all three tiers; every chapter works at 390px.

---

## Phase 3 — Commerce

**10 ideal days**

### E3.1 — Catalogue (2d)

| ID    | Task                                                                              | Est  | D:           |
| ----- | --------------------------------------------------------------------------------- | ---- | ------------ |
| T-045 | ✅ API: `GET /drops/live`, `/drops/:slug`, `/products/:slug`                      | 0.5d | T-025, T-018 |
| T-046 | ✅ `/shop` — the pinned horizontal rail                                           | 0.8d | T-045, T-030 |
| T-047 | ✅ `/product/[slug]` — sticky scrub, variant selection, specs that swap on scroll | 0.9d | T-045, T-031 |

### E3.2 — Cart and checkout (3d)

| ID    | Task                                                                                                                                                                                                                    | Est  | D:    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- |
| T-048 | ✅ Cart domain + API; server-side availability validation                                                                                                                                                               | 0.6d | T-045 |
| T-049 | ✅ `/cart` — cinematic                                                                                                                                                                                                  | 0.5d | T-048 |
| T-050 | ✅ Address capture + Indian pincode/state validation                                                                                                                                                                    | 0.4d | T-048 |
| T-051 | ✅ `POST /orders` — **re-validates price and availability server-side**                                                                                                                                                 | 0.5d | T-048 |
| T-052 | 🟡 Razorpay order creation + checkout handoff (UPI, cards, COD) — adapter written to the documented API, signatures unit-tested; **never run against Razorpay** (no test keys yet). Fake provider runs the flow locally | 0.7d | T-051 |
| T-053 | ✅ Confirmation page that polls for a late webhook instead of erroring                                                                                                                                                  | 0.3d | T-052 |

**done:** a test ₹10 order completes over UPI and COD and reaches `PAID`.

### E3.3 — Payments and webhooks (2d)

| ID    | Task                                                                          | Est  | D:    |
| ----- | ----------------------------------------------------------------------------- | ---- | ----- |
| T-054 | ✅ `WebhookEvent` idempotency table + guard, per [05 §3](./05-lld.md)         | 0.4d | T-018 |
| T-055 | ✅ `POST /webhooks/razorpay` — raw-body signature verify, transition, enqueue | 0.7d | T-054 |
| T-056 | ✅ Order state machine + append-only `OrderEvent`                             | 0.5d | T-054 |
| T-057 | ✅ Reconciliation job: poll Razorpay for orders pending > 2 min               | 0.4d | T-055 |

**done:** firing each webhook **twice** changes state exactly once — watched failing before being trusted.

### E3.4 — Fulfilment (3d)

| ID    | Task                                                                                                                                                            | Est  | D:           |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------ |
| T-058 | ✅ `libs/pod` — `PodProvider` port + zod contracts                                                                                                              | 0.5d | T-016        |
| T-059 | Printrove adapter: catalogue, variant map, create order, cancel                                                                                                 | 1d   | T-058        |
| T-060 | ✅ `pod.submit` job with backoff, 24h retry, then operator alert                                                                                                | 0.6d | T-059, T-026 |
| T-061 | ✅ `POST /webhooks/printrove` — printing/shipped/delivered/RTO                                                                                                  | 0.6d | T-054, T-059 |
| T-062 | 🟡 Buyer notifications: confirmed, shipped with tracking ✅ (console mailer locally); Resend adapter written, never run — needs a key; delivered email not sent | 0.3d | T-061        |

**done:** a sandbox order round-trips to a tracking number without a human touching it.

---

## Phase 4 — Admin

**8 ideal days**

| ID    | Task                                                                                                                                     | Est  | D:    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- |
| T-063 | ✅ Admin shell + operator sign-in in the API (ADR-005 — not Supabase Auth; no shadcn yet), session verified server-side on every request | 0.8d | T-027 |
| T-064 | Drop authoring: number, title, accent, edition, windows                                                                                  | 0.8d | T-063 |
| T-065 | Chapter CMS — homepage copy and imagery without a deploy                                                                                 | 1d   | T-064 |
| T-066 | Artwork upload → mockup + turntable, with progress                                                                                       | 0.8d | T-034 |
| T-067 | Variant editor + **Printrove variant mapping UI**                                                                                        | 0.8d | T-059 |
| T-068 | **Publish check** per [05 §5](./05-lld.md) — refuses an unmapped variant                                                                 | 0.6d | T-067 |
| T-069 | ✅ Order board — 10 s server re-render instead of Supabase Realtime (no hosted project), filters, search, status pills                   | 1.2d | T-056 |
| T-070 | ✅ Order detail: timeline, retry fulfilment, cancel, refund (**recorded only** — money moves in the Razorpay dashboard)                  | 0.6d | T-069 |
| T-071 | ✅ Revenue dashboard: revenue, orders, AOV, COD share, print SLA                                                                         | 0.7d | T-069 |
| T-072 | Customers view                                                                                                                           | 0.4d | T-069 |
| T-073 | Close early / extend a drop                                                                                                              | 0.3d | T-064 |

**done:** a full drop is authored, published, sold and fulfilled without touching code.

---

## Phase 5 — Trend radar and the drop engine

**6 ideal days**

| ID    | Task                                                               | Est  | D:           |
| ----- | ------------------------------------------------------------------ | ---- | ------------ |
| T-074 | `trend.ingest` job framework + per-source rate limiting            | 0.6d | T-026        |
| T-075 | Reddit source                                                      | 0.5d | T-074        |
| T-076 | Hacker News (Algolia) source                                       | 0.3d | T-074        |
| T-077 | Google Trends daily source                                         | 0.5d | T-074        |
| T-078 | YouTube trending source                                            | 0.4d | T-074        |
| T-079 | Scoring + cross-source dedupe; the two-source rule from `new-drop` | 0.8d | T-075–T-078  |
| T-080 | Radar board in admin: shortlist, reject, promote                   | 0.9d | T-079, T-063 |
| T-081 | Promote trend → draft drop carrying its evidence                   | 0.5d | T-080, T-064 |
| T-082 | `schedule.drops` job: open at `opensAt`, archive at `closesAt`     | 0.5d | T-064        |
| T-083 | Waitlist notification on open — idempotent on drop id              | 0.5d | T-082        |
| T-084 | Countdown + edition counter, server-authoritative                  | 0.5d | T-082        |

**done:** a signal goes from radar to live drop in under 4 hours, end to end.

---

## Phase 6 — Accounts and retention

**4 ideal days**

| ID    | Task                                                           | Est  | D:           |
| ----- | -------------------------------------------------------------- | ---- | ------------ |
| T-085 | Supabase Auth: phone OTP + email; guest orders claimable later | 0.8d | T-063        |
| T-086 | Order history + signed tracking link without an account        | 0.6d | T-085, T-056 |
| T-087 | Wishlist / "notify me when my size returns"                    | 0.5d | T-085        |
| T-088 | Abandoned cart recovery — one message, once                    | 0.7d | T-048        |
| T-089 | Drop alert subscriptions + preference centre                   | 0.5d | T-083        |
| T-090 | The wall: UGC submission + moderation queue                    | 0.9d | T-063        |

---

## Phase 7 — Launch hardening

**6 ideal days**

| ID    | Task                                                                  | Est  | D:    |
| ----- | --------------------------------------------------------------------- | ---- | ----- |
| T-091 | Budgets wired into CI as a blocking gate on every route               | 0.6d | T-028 |
| T-092 | Full a11y pass: focus order, keyboard traps, contrast, reduced-motion | 1d   | T-044 |
| T-093 | SEO + OG image per drop, sitemap, structured data                     | 0.6d | T-046 |
| T-094 | Analytics + field RUM (p95 scroll fps from real devices)              | 0.5d | T-091 |
| T-095 | Sentry across all four apps, PII scrubbed from breadcrumbs            | 0.4d | T-025 |
| T-096 | Load test: a drop opening with 500 concurrent buyers                  | 0.8d | T-052 |
| T-097 | Legal: privacy, terms, shipping/returns, COD policy                   | 0.5d | —     |
| T-098 | Runbook: provider outage, stuck order, failed drop open               | 0.5d | T-060 |
| T-099 | Production deploy — Vercel + Railway/Fly, both Mumbai                 | 0.8d | T-091 |
| T-100 | Dry-run drop end to end on production with real money                 | 0.3d | T-099 |

**done:** T-100 passes. That is launch.

---

## Phase 8 — Mobile app

**10 ideal days · after the web is proven**

| ID    | Task                                                     | Est  | D:    |
| ----- | -------------------------------------------------------- | ---- | ----- |
| T-101 | Expo + React Native shell reusing `@nowcore/shared`      | 1.5d | T-099 |
| T-102 | Catalogue + product, with a native-appropriate turntable | 2.5d | T-101 |
| T-103 | Checkout via Razorpay native SDK                         | 2d   | T-102 |
| T-104 | Auth + order history                                     | 1.5d | T-103 |
| T-105 | Push notifications for drop alerts                       | 1.5d | T-104 |
| T-106 | Store submission, both stores                            | 1d   | T-105 |

---

## Summary

| Phase           | Ideal days | Calendar (×1.4) |
| --------------- | ---------- | --------------- |
| 0 · Design      | 2          | ~3 days         |
| 1 · Foundation  | 6          | ~1.7 weeks      |
| 2 · The film    | 9          | ~2.5 weeks      |
| 3 · Commerce    | 10         | ~2.8 weeks      |
| 4 · Admin       | 8          | ~2.2 weeks      |
| 5 · Trend radar | 6          | ~1.7 weeks      |
| 6 · Accounts    | 4          | ~1.1 weeks      |
| 7 · Hardening   | 6          | ~1.7 weeks      |
| **To launch**   | **51**     | **~14 weeks**   |
| 8 · Mobile      | 10         | ~2.8 weeks      |

## Critical path

T-012 → T-014 → T-018 → T-021 → T-029 → T-030 → **T-031** → T-034 → T-037 → T-045 → T-051 → T-052 →
T-055 → T-059 → T-060 → T-068 → T-099 → T-100

**T-031** (`<CanvasSequence>`) and **T-034** (the render pipeline) are the two that decide whether this
project is what it claims to be. Everything cinematic depends on T-031; everything _fast_ depends on T-034.

## Sequencing rules

1. **T-014 before any app code.** Boundaries added after the fact are boundaries that get argued about.
2. **T-023 before any surface is styled.** A raw hex that ships is a raw hex that spreads.
3. **T-028 must be watched failing** before it is trusted. A budget that has never failed is decoration.
4. **T-054 before T-055 and T-061.** Idempotency is not retrofittable onto a live payment integration.
5. **T-034 before T-039.** Hand-rendering frames once teaches the wrong lesson.
6. **T-068 before the first real drop.** Non-negotiable.

## Known risks

| Risk                                                            | Impact                                   | Mitigation                                                                                    |
| --------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Cinematic everywhere fails the Phase 2 gate on mid-tier Android | The core premise                         | Three tiers + CI budgets. If it still fails, revisit the decision with numbers, not opinions. |
| T-034 slips and frames get hand-made                            | Kills the one-day cycle                  | It is on the critical path and gated before chapter 02.                                       |
| Printrove SLA or print quality disappoints                      | Product quality                          | `PodProvider` port; Qikink adapter is a day's work.                                           |
| COD return rate above 25%                                       | Margin                                   | Prepaid-only on first order, COD confirmation step — see [11](./11-business-model.md).        |
| Trend merch IP complaint                                        | Takedown after printing is unrecoverable | Hard rules in `new-drop` step 2; if arguable, it is a no.                                     |
| Solo developer, 14 weeks                                        | Schedule                                 | Phases 5 and 6 can slip past launch; 1–4 and 7 cannot.                                        |

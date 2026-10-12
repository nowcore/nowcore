# 08 — Build progress

A running log so context survives across sessions and developers. **Newest entry at the top.**

Each entry records: what landed, what was decided along the way, what is verified, and what the next
person should pick up. Task IDs refer to [06-task-breakdown.md](./06-task-breakdown.md).

---

## Status

| Phase                       | Progress                                     |
| --------------------------- | -------------------------------------------- |
| Phase 0 — Design and decide | ▓▓▓▓▓▓▓▓▓▓ 11 / 11 tasks · signed off 13 Oct |
| **Phase 1 — Foundation**    | ▓▓▓▓▓▓▓▓▓░ 15 / 17 tasks · 2 🟡              |
| Phase 2 — The film          | ░░░░░░░░░░ 0 / 16 tasks                      |
| Phase 3 — Commerce          | ░░░░░░░░░░ 0 / 18 tasks                      |
| Phase 4 — Admin             | ░░░░░░░░░░ 0 / 11 tasks                      |
| Phase 5 — Trend radar       | ░░░░░░░░░░ 0 / 11 tasks                      |
| Phase 6 — Accounts          | ░░░░░░░░░░ 0 / 6 tasks                       |
| Phase 7 — Hardening         | ░░░░░░░░░░ 0 / 10 tasks                      |

**Next up:** Phase 2 — the film. T-029 (`libs/motion` scaffold + tier detection), then T-030 and T-031
(`<ScrollStage>`, `<CanvasSequence>`), which are the critical path. Install the Chrome DevTools MCP
before T-030; `motion-check` depends on it.

**Gate to watch:** Phase 2 requires ≥55fps p95 scroll and LCP < 2.5s on a mid-tier Android at Fast 4G.
Cinematic-everywhere was chosen with that cost understood; if the gate fails, it gets revisited with
numbers, not opinions.

**Needs a decision:** none blocking. Two need the operator before their tasks: a hosted Supabase
project in Mumbai (T-017 — needs your account) and a GitHub remote (T-015 — CI is written but has
never run).

**What "design signed off" is not:** it is not agreement that the mock looks nice. It is agreement on the
tokens, the type pairing, the motion grammar and the three-tier degradation, because those become
`libs/ui` and `libs/motion` and are expensive to change after Phase 2.

---

## 2026-10-13 — Foundation: monorepo, data, brand tokens, four app shells · T-012…T-028

Design signed off by the operator. Phase 1 landed in one pass: seven Nx projects, all green on every
target uncached, with every guard in this phase watched failing before being trusted.

**What landed.**

- **Monorepo** — Nx 23.1.1 + pnpm 9.15.4, same pinned versions as `classroom-metaverse` (Next 16.1,
  TypeScript 6.0, Prisma 7.10, zod 4.4). `tsconfig.base.json` copied wholesale. `tools/scaffold-lib.sh`
  writes the lib boilerplate so every package has one shape.
- **Boundaries** — `scope:shared|ui|motion|pod|web|server`, per [04 §4](./04-hld.md). `scope:web` cannot
  reach `scope:server` or `scope:pod`, and is banned from `@prisma/*`, `razorpay` and `bullmq`.
- **`nowcore/no-raw-design-values`** — a local ESLint rule (`tools/eslint/`) failing any hex,
  rgb/hsl/oklch or `cubic-bezier` literal outside `libs/ui`. Off inside `libs/ui` (it owns the tokens) and
  inside `libs/db/prisma/seed.ts` (drop accents there are rows of data, not styling).
- **`libs/shared`** — paise money + INR formatting, `dropLabel`, `AccentHex`, the seven-chapter film schema,
  SKU make/parse, and the order state machine from [05 §4](./05-lld.md). 12 tests.
- **`libs/ui`** — `tokens.css` (CSS variables + Tailwind v4 `@theme`), WCAG contrast maths,
  `accentProblems()` for the publish check, `accentVars()` + `<DropTheme>` for server-rendered re-tinting.
  7 tests.
- **`libs/db`** — the full schema from [05 §1](./05-lld.md), snake_case tables, initial migration applied, an
  idempotent seed (2 drops, 2 products, 56 variants), and `schema.spec.ts` asserting the money, snapshot,
  idempotency and status-parity rules. 6 tests.
- **Infra** — Postgres 16 + Redis 7 (AOF on) in `infra/docker-compose.yml`, ports 5433/6381,
  `tools/compose.sh` for machines where `docker compose` is broken.
- **`apps/api`** — Nest 11 on Fastify, zod env, `PrismaService`, `/healthz` + `/readyz`, `rawBody: true`.
  `createApp()` is shared by `main.ts` and the tests so they exercise the real app. 3 tests.
- **`apps/worker`** — standalone Nest + BullMQ, queue names for every future job family, one `system`
  processor, shutdown hooks. 1 test against real Redis.
- **`apps/web`, `apps/admin`** — Next 16 shells, tokens, the three faces, `<DropTheme>` on `<body>`.
  Separate `NEXT_DIST_DIR`. Explicit `typecheck` targets. `apps/web/budget.mjs`.
- **CI** — `.github/workflows/ci.yml` with Postgres + Redis services, prettier, `nx sync:check`,
  `prisma migrate deploy`, `nx affected -t typecheck lint test build budget`.

**Decisions, with what was rejected.**

- _Plain Postgres for local dev, over `supabase start`._ Prisma owns the schema either way (ADR-003), so
  migrations are identical; the full Supabase stack is a dozen containers for features (Auth, Storage)
  no Phase 1 task uses. It arrives with T-063.
- _`geist` package + `next/font/google`, over `next/font/local` with vendored font files._ Both self-host;
  this avoids committing binaries. Verified in Chrome: three faces loaded, zero runtime requests to Google.
- _A shared `createApp()`, over building the app separately in tests._ A test app that differs from the
  server in body handling or CORS is exactly how webhook signatures pass in test and fail in production.
- _Explicit `typecheck` on the Next apps, over relying on `next build`'s type-check._ `classroom-metaverse`
  has no typecheck target on `web` at all (the `noEmit` trap); an explicit, cached target is cheaper than
  remembering that `build` happens to check types.
- _Excluding `noModule` scripts from the budget, over counting every script tag._ They are legacy
  polyfills that every module-capable browser skips. The script inherited from `classroom-metaverse`
  counts them — **that repo's budget overstates by the same ~39 KB**.

**Counts:** 7 projects, 29 tests, 1 migration (14 tables), 0 warnings. Initial route JS: 124.6 KB gzipped.

**Watched failing before being trusted:**

- **Boot against a dead database** — the API test was written expecting `init()` to reject, and it
  _passed init_: Prisma 7's `$connect()` with a driver adapter opens nothing, so the API would have booted
  happily and failed on the first buyer. Fixed with `SELECT 1` at boot; the test now fails without it.
- **Worker with no processor** — removed `SystemProcessor` from the module: the job was accepted and the
  test timed out at 5 s. Restored: passes.
- **Budget** — an incompressible 200 KB client island pushed `/` to 364.4 KB and failed the target by
  184.4 KB. Removed: passes at 124.6 KB.
- **Typecheck** — a planted `const x: number = 'nope'` in `apps/web` failed `web:typecheck`.
- **Module boundary** — `apps/web` importing `@nowcore/db` failed lint with the `scope:web` constraint.
- **Raw colour** — `'bg-[#ff0000]'` in `apps/web` failed `nowcore/no-raw-design-values`. The rule also
  caught two real slips on its first run: an example hex in a zod error message, and the seed's colourways.
- **My own wrong test** — asserted the canvas's electric blue (#3E7BFF) fails contrast; it measures 5.20:1
  and passes. The test was wrong, not the code. All four canvas accents are usable.

**Carried forward:**

- **The motion budget is tight.** 124.6 KB of 180 KB is gone before any motion code. GSAP + ScrollTrigger +
  Lenis is roughly 50 KB gzipped, leaving almost nothing. T-029 should load motion after first paint
  (the static fallback frame is the LCP element by design, so this costs nothing visible).
- **T-017 🟡** — the hosted Supabase project (Mumbai) needs the operator's account. Local dev does not.
- **T-015 🟡** — CI is written and every step runs locally, but the workflow itself has never run: there
  is no GitHub remote yet.
- **T-023 scope** — the lint rule covers colours and easings, not font stacks or durations. Font stacks are
  owned by `next/font`; durations are not yet policed. CSS files are not linted at all — app stylesheets
  only `@import` the token sheet, which is a convention, not an enforcement.
- `classroom-metaverse/apps/web/budget.mjs` has the same `noModule` overcount. Not touched — different repo.

**Verified:** `nx run-many -t typecheck lint test build budget --skip-nx-cache` green for all 7 projects;
`nx sync:check` clean; prettier clean; the built API answered `/healthz` and `/readyz` against the real
database; the built web app rendered in Chrome with all three faces and the drop accent.

**Not verified:** the CI workflow on GitHub; anything on a real phone; the admin app beyond build and
typecheck — it is intentionally an empty shell.

---

## 2026-10-13 — Direction, design canvas and documentation · T-001…T-011

Phase 0 is effectively complete. Both reference sites were analysed in a real browser, the brand was
decided and drawn, and the repo now carries its conventions and its documentation.

**What landed.**

- **Reference analysis.** `makeaimedicoreagain.com` is a Wix store, 2 live products, 3 of 4 categories
  marked "Coming Soon"; its product copy (Bella+Canvas, Airlume, DTF/DTG, tear-away label, Honduras)
  identifies it as print-on-demand dropship. `morphowater.com` is Next.js App Router, 22,024px tall,
  seven chaptered scroll films (`#flow-hero` 3524px … `#flow-water` 2884px).
- **The technique finding that shaped the whole build.** `#flow-hero` contains one `<canvas>`, a
  `.flow-stage` at `position: sticky; top: 0`, and a fallback `<img src="opening-can-desktop-376.webp">`
  — frame 376 of a pre-rendered sequence. `window.gsap`, `window.THREE` and Lenis were all absent as
  globals. It is a sticky stage plus a canvas image sequence, not 3D. That is reproducible for a garment
  turntable at a fraction of the cost, and it is why `<CanvasSequence>` (T-031) is on the critical path
  instead of a WebGL model.
- **Decisions.** NOWCORE; India-first (Printrove + Razorpay, UPI and COD); cinematic everywhere;
  "Archive of Now" art direction; v1 covers storefront, admin, trend radar and accounts.
- **Design canvas** — eight artboards, published and linked from [README](./README.md).
- **Repo conventions** — `CLAUDE.md`, `.claude/settings.json`, `.mcp.json`, three skills
  (`new-drop`, `finish-task`, `motion-check`), `.gitignore`.
- **Docs 01–11.**

**Decisions, with what was rejected.**

- _Canvas image sequence over Three.js_ for the turntable. Three.js needs a 3D asset per garment that we
  cannot author per drop in a day; 72 AVIF frames render themselves from artwork in a worker job.
- _India-first over global._ Printful is the reference site's provider and the wrong one here — a
  US-printed tee lands in India at roughly ₹2,500 plus customs against ~₹300 printed in Bengaluru.
  Rejected keeping Printful "for quality": a 2–3 week delivery destroys a 72-hour drop.
- _Prisma over Drizzle._ Drizzle is lighter and genuinely good, but NestJS is a long-lived process so
  Prisma's weight is irrelevant, and it matches the house convention in `classroom-metaverse/libs/db`.
- _The API as the only database writer, over RLS-everywhere._ Policy sprawl across a dozen tables is
  hard to test and slow on joins; authorization in one place is testable.
- _Motion as a library with CI budgets, over per-page animation code._ Cinematic everywhere means the
  motion system is the most-reused code in the repo; it needs boundaries and a failing build.
- _A separate `libs/pod` port, over a direct Printrove client in the order service._ Cheaper today,
  a rewrite the first time we ship abroad.

**Counts:** 8 artboards, 16 documentation files (11 docs, index, 4 ADRs), 3 skills, 0 lines of application code, 0 dependencies.

**Watched failing before being trusted:** nothing yet — there is no code to sabotage. The first real
instance will be T-028, where the `budget` target must be seen failing against a deliberately bloated
bundle before any budget claim in [10](./10-design-system.md) is trustworthy.

**Carried forward:**

- ADRs 001–004 written (T-011).
- Mid-tier Android hardware for the Phase 2 gate is not yet identified. Simulated throttling is not the
  same as a real device, and the gate says "mid-tier Android", not "4× CPU slowdown".
- Printrove sandbox credentials are not yet obtained; T-059 is blocked on that in practice even though
  the dependency graph does not show it.

**Verified:** both reference sites analysed live in Chrome; the frame-376 finding read directly from the
DOM, not inferred. The design canvas renders and the brand board's accent re-tint works.

**Not verified:** every performance number in [10](./10-design-system.md) is a _budget_, not a
measurement. Nothing has been measured, because nothing has been built.

**Next up:** superseded by the entry above.

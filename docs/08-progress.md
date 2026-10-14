# 08 — Build progress

A running log so context survives across sessions and developers. **Newest entry at the top.**

Each entry records: what landed, what was decided along the way, what is verified, and what the next
person should pick up. Task IDs refer to [06-task-breakdown.md](./06-task-breakdown.md).

---

## Status

| Phase                       | Progress                                     |
| --------------------------- | -------------------------------------------- |
| Phase 0 — Design and decide | ▓▓▓▓▓▓▓▓▓▓ 11 / 11 tasks · signed off 13 Oct |
| Phase 1 — Foundation        | ▓▓▓▓▓▓▓▓▓░ 15 / 17 tasks · 2 🟡              |
| Phase 2 — The film          | ▓▓▓▓▓▓▓▓▓░ 15 / 16 tasks · 3 🟡              |
| Phase 3 — Commerce          | ▓▓▓▓▓▓▓▓▓░ 15 / 18 tasks · 2 🟡 · 1 blocked  |
| Phase 4 — Admin             | ▓▓▓▓▓▓▓▓▓▓ 11 / 11 tasks                     |
| **Phase 5 — Trend radar**   | ▓▓▓▓▓▓▓▓░░ 9 / 11 tasks · 2 🟡               |
| Phase 6 — Accounts          | ░░░░░░░░░░ 0 / 6 tasks                       |
| Phase 7 — Hardening         | ▓▓░░░░░░░░ 2 / 11 tasks                      |

**Next up:** Phase 6 — accounts (Supabase Auth, phone OTP or email; order history). It needs the hosted
Supabase project (T-017). Until that exists, Phase 7 hardening items that are local — per-route body limits
and rate limiting (T-096) — can go first.

**Gate to watch:** Phase 2 requires ≥55fps p95 scroll and LCP < 2.5s on a mid-tier Android at Fast 4G.
Cinematic-everywhere was chosen with that cost understood; if the gate fails, it gets revisited with
numbers, not opinions.

**Needs from the operator** — none block local work; each unblocks one adapter:

- **Razorpay test keys** (key id, key secret, webhook secret) → T-052 against Razorpay itself.
- **Printrove API docs + sandbox credentials** → T-059. The adapter is not started on purpose; it will not
  be written from memory.
- **A Resend (or other) API key** and a sending domain → real buyer emails (T-062).
- **A mid-tier Android phone** for the Phase 2 gate, measured on hardware.
- **A Reddit app (client id + secret) and a YouTube Data API key** → T-075 and T-078 against the real APIs.
  Without them the radar runs on HN and Google Trends only, which rarely overlap (US tech vs India searches).

**Needs a decision:** none blocking. Operator decided 13 Oct: **local Postgres only for now** — the
hosted Supabase project (T-017) and the GitHub remote (T-015) come later and will be shared then. All
changes stay local until the remote exists; nothing is pushed.

**What "design signed off" is not:** it is not agreement that the mock looks nice. It is agreement on the
tokens, the type pairing, the motion grammar and the three-tier degradation, because those become
`libs/ui` and `libs/motion` and are expensive to change after Phase 2.

---

## 2026-10-15 — Load test: a drop opening with 500 buyers · T-096

**The first run oversold by 400.** 500 buyers released at once on an edition of 100 — every one of them got
an order, paid, and was confirmed. Every response was a 2xx; nothing in the system noticed. Two faults: the
edition check counted only paid orders (and every buyer was checked before anyone paid), and the check and
the insert were separate statements. Fixed by ADR-008: unpaid orders hold their pieces for 15 minutes, and
checkout counts and inserts under a per-drop advisory lock.

**After the fix:**

| Buyers | Edition | Paid | Order p50 / p95  | Responses                                   |
| ------ | ------- | ---- | ---------------- | ------------------------------------------- |
| 500    | 100     | 100  | 651 / 752 ms     | 100 × 201, 400 × 409 "Only 0 left", 0 × 5xx |
| 1 000  | 250     | 250  | 1 812 / 2 089 ms | 250 × 201, 750 × 409, 0 × 5xx               |

Local machine, one API process, Postgres in Colima, fake payments, every buyer on its own IP.

**What landed.**

- `pnpm exec nx run api:load` (`BUYERS`, `EDITION`): boots the built API on :4180, makes a throwaway drop,
  releases every buyer at once through cart → line → order → pay → verify, prints latency per step, fails on
  any 5xx or an oversell, and removes everything after.
- `libs/orders` `edition.ts`: `HOLD_MS`, `CLAIMED`, `claimed()`, `lockEdition()`.
- A payment after its hold lapsed, when the edition has since filled, is honoured and flagged
  (`overEdition: true` on the PAID event, a warning in the log).

**Counts:** 10 projects, 144 tests (API 60).

**Watched failing before being trusted:** the load test itself (oversold by 400 before the fix); the lock
removed (the 12-buyer rush test sold more than 4); holds not counted (rush and hold tests failed); the
late-payment flag removed (its test failed).

**Carried forward:**

- **Every step is pool-bound at this scale** — even creating a cart took ~1 s p50 at 1 000 simultaneous
  buyers, because one process shares a small Postgres pool. Production needs the pool sized for it
  (Supabase's pooler, T-017) and more than one API instance; re-run the load test against staging.
- The storefront's edition counter shows paid pieces only, not holds.
- `CLAIMED` is still copied in catalogue, admin-drops and admin-orders; libs/orders now exports it.
- Not measured: through the Next server (the BFF adds a hop), real Razorpay latency, rate limiting under
  distinct-IP load from outside one machine.

**Verified:** load test at 500 and 1 000 buyers; two uncached full runs.

---

## 2026-10-14 — Body limits and rate limits · T-101

The API no longer accepts 12 MB on every route, and the routes a script would hammer are limited per buyer.

**What landed.**

- **Body limits**: 64 KB by default; artwork (base64 PNG) keeps 12 MB.
- **Rate limits** (`@fastify/rate-limit`, counters in Redis so they hold across instances, failing open if
  Redis is down): orders 10/min, payment verify 20, cart create 30, cart lines 60, waitlist join and
  unsubscribe 5, operator sign-in 5, webhooks 600 (flood guard only — providers retry, and a refused genuine
  webhook is an unseen payment). A 429 says how many seconds to wait; the waitlist form says "Too many tries".
- **One table**, `apps/api/src/limits.ts`. The API refuses to start if it names a route that does not exist.
- **The buyer's IP, not the storefront's.** Every buyer request reaches the API from the Next server, so a
  per-IP limit would have been one limit for the whole store — ten orders a minute, total. Web and admin
  forward the buyer's IP as `x-client-ip` with `BFF_SECRET`; the API uses it only when the secret matches.
  `TRUST_PROXY` (hops) for the load balancer in front of the API; `BFF_SECRET` refused in production if
  left at the local default. `RATE_LIMIT=off` in tests.

**Counts:** 10 projects, 142 tests (API 58).

**Watched failing before being trusted:**

- Rate config not attached, artwork body override removed, the unknown-route check disabled, the forwarded
  IP trusted without the secret, the forwarded IP ignored: each failed its test.
- **In Chrome**: a waitlist join from `127.0.0.1` was counted under `::ffff:127.0.0.1` (the browser) while
  Next reaches the API on `::1` — the forwarded IP arrives through the real server action. At the limit the
  form showed "Too many tries. Wait a minute and try again."

**Carried forward:**

- **Production must set `TRUST_PROXY` and `BFF_SECRET`**, and `x-forwarded-for` at the storefront must come
  from the platform (Vercel sets it), not the client.
- Limits are guesses until the load test (T-096) and a real drop say otherwise.
- `GET /orders/:reference?t=` is not limited: the token is 128 bits.

**Verified:** full uncached runs; the limit and its message in Chrome.

---

## 2026-10-14 — The drop engine and the trend radar · T-074–T-084

A drop now opens and closes itself, tells the waitlist once, and can be born on the radar. Run end to end on
the dev stack: drop 014 set to expire, drop 099 scheduled 20 s out; one clock tick logged `closed [14]
opened [99]`, the subscriber was mailed once, the storefront showed 099 on the next request. On the radar,
live HN and Google Trends landed (29 + 9; one fixture search filtered as noise); with one corroborating row
added by hand, "gemini argon" reached the board, was shortlisted, and promoted to draft DROP 015 with its
evidence on the drop page. (Demo rows, drops and subscribers removed; the seed restored.)

**What landed.**

- **Waitlist (T-083)**: one row per email (the old `(email, drop_id)` unique let NULL duplicates through —
  proved with two rows for one email); `POST /waitlist` is idempotent and answers the same whether or not the
  email was known. A `drop_alerts` ledger row is written _before_ each send, so a retried job never mails
  anyone twice (at-most-once, by design). Every alert carries a signed unsubscribe link; the page asks for one
  click instead of acting on the GET, because mail scanners open every link.
- **Drop clock (T-082, ADR-007)**: in the API, every minute — closes expired drops, opens the earliest due
  scheduled drop if it still passes the publish check and nothing is live. Opening (clock or operator) is one
  `open()` under a Postgres advisory lock. `DROP_CLOCK=off` in tests.
- **Server-authoritative close (T-084)**: `isOpen()` — cart and order refuse a drop past `closesAt` even while
  it is still LIVE. The countdown corrects for a wrong device clock using the `Date` header of a HEAD request.
- **Ingest (T-074–T-078)**: hourly BullMQ job schedulers, one per source, upsert on (source, externalId);
  `seenAt` moves, `capturedAt` keeps the first sighting. One log scale across sources (HN 100 pts ≈ 67,
  Google 20 000 searches ≈ 72). A noise filter for logins, prices, results, fixtures, horoscopes — taken from
  the live IN feed. Reddit and YouTube are scheduled only when their credentials exist. `TRENDS=off` in tests.
- **Radar (T-079–T-081)**: keys are words and adjacent pairs; a key is on the board when two sources carry it
  at ≥ 50 within 24 h; a word in more than 10% of all trends is dropped as common; a word gives way to a pair
  with the same sources. Shortlist / reject / reset; promote re-checks the two-source rule, drafts a drop from
  defaults and links every trend under the key as evidence (FR-23), shown on the drop page.

**Counts:** 10 projects, 138 tests (API 54, worker 21, shared 27). Motion: full 60 fps · LCP 0.53 s · CLS 0;
reduced 60 fps · 0.42 s; static 0.40 s — unchanged.

**Watched failing before being trusted:**

- **Drop alerts** — ledger made non-blocking and the unsubscribe filter removed: both tests failed.
- **The clock** — publish check skipped and expiry disabled: all three clock tests failed. The first version
  of the "fails the check" test passed even with the check gone (014 being live held the drop anyway); `tick()`
  now reports _why_ a drop is held, and the test asserts the reason.
- **The close** — cart and order put back on status alone: the past-`closesAt` test failed.
- **Radar rules** — score line and commonness cap removed: tests failed. The cap's first fixture was vacuous
  (the common word was folded into a pair instead); rewritten so only the cap can remove it.
- **Ingest** — noise filter removed and first sighting overwritten: both ingest tests failed.
- **Promote** — two-source gate removed and evidence limited to the best trend per source: both tests failed.
- **Orphan workers** — the first live clock run's alert job failed with a ZodError: three NOWCORE workers from
  earlier dev runs (09:03, 09:16, 09:20) were still consuming the queue with old code. Stopping `pnpm dev`
  kills pnpm, not nx's continuous children. Killed them (country_dairy's process left alone); the retry sent
  the alert once.

**Carried forward:**

- **Reddit and YouTube (T-075, T-078) are 🟡**: written to the documented APIs and tested against canned
  responses; never called for real. Need credentials.
- **HN + Google Trends rarely corroborate** — different audiences. Expect an empty board until a third source
  runs. Brand searches ("hotstar") pass the noise filter; widen it with data, not guesses.
- **Clusters are computed on every board read** — fine for a few hundred trends a day; precompute if it grows.
- **First request after a drop opens** may still show the previous drop (stale-while-revalidate); ordering
  from it is refused by `isOpen()`.
- **`pnpm dev` leaves orphan processes** when stopped from a job runner; check `ps` for `node dist/main.js`
  under nowcore before trusting a dev run.
- Unchanged: 12 MB global body limit (T-096), frames served by the API (T-035), refunds recorded not issued.

**Verified:** two consecutive uncached full runs; the clock opening and closing on the live stack; waitlist
join and one-click unsubscribe in Chrome; countdown correct with the device clock an hour fast; live ingest;
radar shortlist and promote in Chrome; motion-check on the production build.

**Not verified:** Reddit or YouTube live; two API instances ticking at once (the lock is reasoned about, not
raced); a real email provider; a real phone.

---

## 2026-10-14 — Admin, drops side: authoring, artwork → turntables, printer mapping, the publish check · T-064–T-068, T-072, T-073

An operator can now launch a drop without touching code. Run end to end in Chrome: created DROP 015 "Inbox
Zero Is Fake" (orange accent), uploaded a 1200 px print file, watched both colourways render (~10 s each),
mapped 14 variants to the printer, passed the publish check, was refused "Open now" because DROP 014 was
live, closed 014, opened 015 — and the storefront re-tinted orange with the new turntable, 72-hour clock,
and 014 in the archive. (Demo drop removed and the seed restored afterwards.)

**What landed.**

- **Drop authoring**: create (number, slug from title, accent with a live contrast check, edition, colourways
  from the blanks, price; 2XL/3XL +₹50), edit, the seven-chapter film copy (drafted from the title so a new
  drop is never blank), close early, extend by 1–72 h. Drops cannot reopen; only one is live at a time.
- **Artwork → turntables**: upload checked by PNG magic bytes, ≤ 8 MB, ≥ 600 px; stored in `.storage/artwork`;
  one render job per colourway (key, not bytes, through Redis); the worker renders and points the variants at
  the frames; each upload gets a new revision path. The drop page shows progress and refreshes until done.
- **Variant → printer mapping** table, with the printer asked about every mapped id (`unknownVariants` on the
  port).
- **The publish check**, in words: unmapped variants, ids the printer does not stock, missing turntables,
  accent contrast, incomplete film copy, a window that closes before it opens.
- **Customers**: buyers by email, with orders, delivered, RTO, spend, cities.
- **Frames from an asset origin** (ADR-006), and a storefront revalidate webhook so a drop opening shows at once.
- Contrast maths moved to `@nowcore/shared/color` (zod-free) — the API check and the admin preview share it.

**Decisions, with what was rejected.**

- _Ask the printer about mapped ids, over placing a sandbox order per colourway_ (LLD §5's original wording).
  A lookup answers the real question — "will this id print?" — without inventing orders.
- _Refuse to open while another drop is live, over auto-closing it._ Closing a drop is irreversible and fires
  the archive; it should be a deliberate act.
- _Artwork only before opening._ Re-rendering a live drop would blank its turntables while buyers watch.
- _A 12 MB global body limit for artwork_, over multipart. Smaller change; the risk is carried forward.

**Counts:** 10 projects, 111 tests (API 43). Initial routes unchanged (72–73%). Motion: full 60 fps · LCP
0.50 s · CLS 0, frames 843 KB; reduced 60 fps · 0.41 s · 199 KB; static 0.40 s.

**Watched failing before being trusted:**

- **The publish check** — gutted to always return no problems: the two tests asserting its findings failed.
- **Frames written after a build 404'd** — found in the browser (the admin's new stills were broken), confirmed
  with curl (new frame 404, seed frame 200), fixed by ADR-006, and pinned by a test that writes a frame after
  the API starts and fetches it.
- **The dashboard had no upper bound** on its window — a test pinned to a fixed past day counted 10 orders
  instead of 2. Harmless in production (now is always now), wrong in principle; bounded at `now`.
- **A parallel-suite race** — the dashboard test measured global "today" totals while another suite created
  orders. Moved to a day no suite touches.
- **The single-live rule** named another suite's live test drop instead of 014 — the rule was right; the test now
  accepts whichever drop is live.
- **motion-check went blind** — frames moved cross-origin and every one read as 0 bytes. `Timing-Allow-Origin`.
- **Stale storefront after opening a drop** — the 30 s stale-while-revalidate cache showed the old drop. Fixed
  with the revalidate webhook; proven by extending a drop and seeing the new closing time on the next request.
- **Accessibility** — the accent hex field had no accessible name (seen in the a11y snapshot). Labelled.

**Carried forward:**

- **The scheduler (T-082) does not exist yet**: "Schedule" marks a drop SCHEDULED, but nothing opens it at its
  time. The admin says so on the button.
- **12 MB global request body limit** — every public route accepts it. Per-route limits with rate limiting (T-096).
- **Serving frames from the API** is a local stand-in; production frames belong on the storage CDN (T-035).
- **Refund is recorded, not issued** (unchanged).
- The publish check calls the printer for every mapped id on every drop page view of a draft — fine for the
  sandbox; cache it when a real printer's API has rate limits.

**Verified:** two consecutive uncached full runs; the operator loop in Chrome; the revalidate webhook (401 on a
wrong secret, instant storefront update on extend); motion-check with cross-origin frames.

**Not verified:** a print file at the 8 MB limit; two operators editing one drop; a real phone.

---

## 2026-10-14 — Admin, operations side: sign-in, dashboard, order board, order actions · T-063, T-069–T-071

An operator can sign in, see what needs them, and fix it. Run live: an order for an unmapped variant failed
at the worker, surfaced on the dashboard as "1 order needs you", and after the mapping was restored, **Retry
fulfilment** sent it to the printer — PRINTING, attention badge gone.

**What landed.**

- **Operator auth in the API** (ADR-005): `operators` + `operator_sessions` tables, scrypt passwords, 32-byte
  tokens stored only as SHA-256, 12 h expiry, 5-attempt lockout per email, one message for wrong email and
  wrong password, `OperatorGuard` on every admin route. The seed creates `admin@nowcore.local`.
- **Admin API**: dashboard (revenue, orders, AOV, COD share, print SLA, needs-attention), order list with
  status filters and search (reference, email, phone, SKU), order detail with the full event timeline and the
  actions the state machine allows, and the actions — retry fulfilment (fresh job id, since BullMQ would
  silently ignore a reused one), cancel, refund (recorded only, said so in the event).
- **Admin app**: sign-in, a sidebar with a red needs-attention count, dashboard with range tabs, the order
  board (10 s live re-render, paused when the tab is hidden), order detail with timeline, references and
  action forms. Plain accessible HTML on tokens; status colours added to `libs/ui`.

**Decisions, with what was rejected.**

- _Operator auth in the API, over Supabase Auth_ — ADR-005.
- _No shadcn yet._ Tables, tabs and forms are native elements; shadcn earns its entry when a combobox or
  date picker does.
- _Polling over Realtime_ for the board — no hosted project; polling a server component needs no socket.
- _Refund recorded, not issued._ The Razorpay refund API is unwired (no keys); the event carries
  `recordedOnly: true` and the button tells the operator where the money actually moves.

**Counts:** 11 projects, 98 tests (API 33, admin 2).

**Watched failing before being trusted:**

- **The operator guard** — removed `@UseGuards(OperatorGuard)`: unauthenticated access and every action
  failed in the suite (4 tests). Restored.
- **A bug the API tests could not see** — in the browser, Retry answered "Body cannot be empty when
  content-type is set to 'application/json'": the admin's client sent a JSON content type on body-less
  actions, which Fastify refuses. The API tests sent no content type, so they passed. Fixed in the client and
  pinned by a new admin unit test, which fails with the old header behaviour.
- **Suites eating each other's jobs** — the first combined uncached run failed twice: two worker suites each
  started a full worker on the same queues, so one completed (and removed) the other's `system` job and sent
  the other's confirmation email through the wrong mailer. The same mechanism was behind yesterday's "live
  worker changed a test's world". Fixed at the root with a BullMQ key prefix (`QUEUE_PREFIX`, default
  `nowcore`): every worker test run gets a unique one, API suites use `test-api` (which nothing consumes).
  Two consecutive uncached full runs green afterwards.

**Carried forward:**

- Retry and refund need care in production: refund does not move money; retry only helps once the cause is
  fixed (the hint says so).
- Login lockout is per API instance and in memory (ADR-005).
- API test runs leave their never-consumed jobs under the `test-api` prefix in local Redis — a few keys per
  run; CI's Redis is ephemeral. `pnpm infra:reset` clears it.
- The variant mapping had to be restored with SQL for the retry demo — the mapping UI is the next slice.

**Verified:** full uncached check; in Chrome via the DevTools MCP — redirect to sign-in, wrong password
message, sign-in, dashboard numbers, needs-attention list, order detail timeline, retry → PRINTING.

**Not verified:** two operators at once; a real phone.

---

## 2026-10-13 — Fulfilment: the printer port, the worker, printer webhooks, emails · T-058…T-062

A paid order now reaches the printer and comes back as a tracking number without a person touching it.
Run live with all three processes: NC-10427 (two moss tees, free shipping) went PAID → PRINTING (worker) →
SHIPPED → DELIVERED, with the confirmation and shipped emails in the worker log.

**What landed.**

- **`libs/pod`** — the `PodProvider` port (idempotent on our order reference), `PodRejected` for permanent
  failures, `unmapped()` for the publish check, and `SandboxPrinter`: stateless (the worker submits, the API
  receives webhooks — two processes), refuses variants it does not stock, signs its webhooks.
- **`libs/orders`** — the guarded transition and `markPaid`, moved out of the API so the worker uses the same
  code; signed order tokens moved here so emails carry links the API accepts.
- **API**: paying an order enqueues `pod.submit` and a confirmation email (job ids from the order id, so
  repeated enqueues collapse); printer webhooks at `/webhooks/pod/:provider` (signature, dedup, guarded
  transition, tracking URL saved, shipped email); a dev press route that goes through the real signed path;
  reconciliation now also re-enqueues paid orders stranded for 10 minutes. The API refuses `POD=sandbox` in
  production.
- **Worker**: its own Prisma connection (boot proves the database); `pod.submit` (PAID → FULFILMENT_QUEUED →
  submit → PRINTING; unmapped or refused → FULFILMENT_FAILED with no retry; transient → backoff, ~17 h, then
  FULFILMENT_FAILED); `notify` with a `Mailer` port — console locally, Resend adapter for production.
- **Seed** maps every variant to a sandbox printer id.
- **Order page** progress reaches all four steps and links to tracking.

**Decisions, with what was rejected.**

- _A stateless sandbox, over an in-memory fake printer._ The first version kept orders in a Map; it could not
  work across the worker and the API. Making the printer's id a pure function of our reference also _is_ the
  idempotency guarantee.
- _The worker owns PAID → FULFILMENT_QUEUED, over the API transitioning after enqueueing._ The API enqueues
  only; whoever processes the job moves the order. No window where an order says "queued" with no job.
- _Unmapped variants fail permanently, over retrying._ Retrying cannot map a variant; seventeen hours of
  backoff would only delay the operator finding out.
- _No Printrove adapter, over writing one from memory._ An adapter guessed from memory would pass its own tests
  and fail on the first real order — the worst place to discover it.

**Counts:** 10 projects, 88 tests (API 25, worker 13, pod 4). Initial routes 72–73%. Motion unchanged:
full 60 fps · LCP 0.58 s · CLS 0, reduced 60 fps · 0.40 s, static 0.40 s.

**Watched failing before being trusted:**

- **Unmapped variant** — a paid order for an XL with no printer id went straight to FULFILMENT_FAILED with the
  SKU in the event payload, and the job did not retry.
- **Idempotent submission** — the same order through `pod.submit` twice: one printer id, one PRINTING event.
- **Printer webhooks** — wrong signature → 401, order untouched; SHIPPED delivered twice → one transition;
  DELIVERED for an order that never shipped → refused by the state machine.
- **The seed only seeded half a variant.** The `create` branch set no frame location and no printer id — only
  `update` did — so every existing local database looked right and every fresh one would have had blank
  turntables and unprintable orders. Found because a sed matched once instead of twice; fixed by building both
  branches from one object, proven on a reset database (0 of 56 unmapped).
- **A live worker changed a test's world** — the edition test counted only PAID orders while the running worker
  moved them on to PRINTING. The test now counts every claimed status, as the service does.

**Carried forward:**

- **T-059 Printrove — blocked** on their API docs and credentials. Also unknown: whether Printrove honours an
  idempotency key on order creation. If not, the adapter must look up by our reference before creating.
- **Real emails** need a provider key; Resend's adapter has never sent one. No "delivered" email yet.
- **FULFILMENT_FAILED reaches only the log.** The admin order board (T-069) and Sentry (T-095) are where an
  operator will actually see it.
- **Reconciliation still lives in the API.** The worker now has a database; moving it is a small follow-up.
- `infra:reset` was run to prove the seed — local orders from earlier browser runs are gone (NC-10491).

**Verified:** full uncached check; live pipeline with API + worker + web; the order page in Chrome after
delivery; motion-check on the data-driven film.

**Not verified:** Printrove, Razorpay, Resend — none have credentials; a real phone; WebKit.

---

## 2026-10-13 — Checkout, payments, webhooks and reconciliation · T-050…T-057

A buyer can now go from product page to a confirmed, paid order. Verified by placing order NC-10491 in a
real browser with the fake provider: validation errors per field, payment, confirmation page.

**What landed.**

- **Checkout contracts** (`libs/shared/src/checkout.ts`): address with PIN-code and state validation,
  Indian mobile normalised to +91, `priceOrder` (prices GST-inclusive, ₹80 shipping under ₹999, ₹80 COD fee).
- **`POST /orders`** re-checks every line at the moment of ordering — variant exists, drop live, not sold
  out, edition not exhausted — prices from the variant, snapshots onto order items. References from a
  Postgres sequence (`NC-10427`…). The cart empties only when payment lands.
- **Payments behind a port**: `RazorpayProvider` (documented Orders API, HMAC-SHA256 checkout and webhook
  signatures, `X-Razorpay-Event-Id`) and `FakeProvider` (signs identically). The API **refuses to boot**
  with the fake provider in production, and its pay route is only registered when it is configured.
- **One guarded transition** (`OrderStateService`): `UPDATE … WHERE status = from` plus the OrderEvent in one
  transaction. The checkout verify, the webhook and reconciliation all go through it.
- **Webhooks** per docs/05 §3: signature over raw bytes first, `webhook_events` unique insert as the
  idempotency gate, 200 for anything understood.
- **Reconciliation** every 5 min for orders pending 2 min–24 h (in the API until the worker has a database).
- **COD policy** from docs/11: refused until a prepaid order has been delivered to that phone.
- **Signed order links**: `/order/NC-…?t=` with an HMAC token; the sequential reference is never a credential.
- **Web**: `/checkout` (calm, per-field server errors, test-payment sheet or Razorpay Checkout), `/order/…`
  (confirmation, progress, polls while a payment is still confirming — T-053).
- `/checkout` joined the budget, measured with a real cart.

**Decisions, with what was rejected.**

- _A conditional UPDATE as the concurrency guard, over a row lock or an application mutex._ It is one
  statement, needs no lock management, and makes the race testable.
- _COD confirmed immediately (PAID), over a PENDING_COD state._ The docs/11 confirmation call/OTP before
  printing is not built; marked in code and carried forward rather than half-modelled.
- _Reconciliation in the API for now, over waiting for the worker to get a database._ A lost webhook is a
  paid buyer told nothing; it could not wait. Safe on many instances because markPaid is idempotent.
- _Echo submitted values back from the action, over a controlled form._ Keeps the form working before
  JavaScript, and is the smaller change.

**Counts:** 8 projects, 77 tests (22 in the API, 10 for orders). Initial routes 129.6–132.0 KB (72–73%).

**Watched failing before being trusted:**

- **The transition guard** — removed `status: from` from the update: the idempotency test and the
  verify-vs-webhook race test both failed (the order was paid twice). Restored: pass.
- **Webhook dedup** — removed the `webhook_events` insert: the duplicate-delivery test failed. (The first
  attempt at this sabotage silently did nothing — the sed missed a Prettier-wrapped line — and the suite
  "passed". Caught because the duplicate test _should_ have failed; re-run properly.)
- **Edition limit** — my own test design exhausted a 3-garment edition and four later tests failed with
  409s. The test was wrong; the guard was right.
- **The checkout form wiped every field after one typo** — found in the browser: React 19 resets an
  uncontrolled form after its action. Fixed by echoing values back; the `<select>` also needed a key,
  because a mounted select ignores a changed `defaultValue`. Re-verified: every field survives.
- **Order links** — tampered token, missing token, and a neighbouring reference with a valid token all 404.
- **An untrue promise** — the confirmation page said "a receipt is on its way" when no email exists. Removed.

**Carried forward:**

- **Razorpay itself has never been called.** Signature maths is unit-tested against the documented scheme;
  the HTTP calls and Checkout.js handoff are unverified until test keys exist.
- **COD confirmation (call/OTP) before printing** — docs/11 policy, not built.
- **Edition limit is checked, not reserved.** Two buyers racing for the last garment can both pass the check.
  Acceptable at this scale; a reservation or a `SELECT … FOR UPDATE` on the drop fixes it when it matters.
- **Reconciliation moves to the worker** once the worker has a database (with T-060).
- **No emails yet** (T-062) — the order page says to keep the link, honestly.
- **Local DB now has real-looking orders** from the browser run (NC-10491). Harmless locally; `pnpm infra:reset`
  clears everything.

**Verified:** full uncached check; in Chrome via the DevTools MCP — add to cart, bad PIN + bad mobile → errors
on those fields with all input kept, fix → "Order NC-10491 is held for you", Pay (test) → "It is yours",
Confirmed, ₹879, no console errors; tampered links 404; `claimed` went 0 → 1.

**Not verified:** Razorpay; a real phone; WebKit.

---

## 2026-10-13 — Catalogue API, shop rail, product page, cart · T-045…T-049

The storefront now reads real data end to end: the homepage fixture is gone, and a visitor can pick a
colourway and size, add to cart, and change quantities — verified by clicking through in Chrome.

**What landed.**

- **Catalogue API** (`apps/api/src/modules/catalogue`): live drop (or the latest if none is live),
  archive, drop by slug, product by slug. Variants grouped into colourways (black first), sizes in garment
  order, sold-out sizes kept (FR-5), frame URLs from each variant's `sequence_url`. `claimed` counted from
  paid orders — the homepage now honestly says 0 of 500; the fixture's 240 was invented. 30 s shared cache.
- **Contracts** in `libs/shared` (`catalogue.ts`, `cart.ts`), parsed by both API and web.
- **Cart API** (`modules/cart`): create, view, set item; every change checked against live stock and
  drop status; quantity 1–5.
- **Web**: `lib/api.ts` (server-only, zod-parsed, 30 s data cache); the film's chapter copy now comes from
  the drop's CMS `chapters` field; layout accent from the live drop (falls back to the house signal if the
  API is down); cart via server actions and an httpOnly `nc_cart` cookie; `/shop` (pinned horizontal rail on
  a new `<HorizontalRail>`), `/product/[slug]` (sticky turntable on a new non-pinning `<ScrollTrack>`, colour
  and size selection, persistent buy bar), `/cart` (plain-form quantity controls that work without JS).
- **Budget measured on a running server** — routes render per request now, so `budget.mjs` boots the built
  API and web app and measures what each page's HTML actually loads.
- `@nowcore/shared/format` — zod-free formatting for client components.

**Decisions, with what was rejected.**

- _Per-request rendering with a 30 s data cache, over ISR prerendering._ Prerendering would need the API
  running at build time. Rejected reading the catalogue from Postgres in the web app (HLD §3 said so): the
  module boundary bans `scope:web` from the database, and that ban is the credential guarantee. HLD's
  request path is now out of date on this point and the boundary wins.
- _Cart id as an httpOnly cookie, over a client-side cart._ The server is the source of truth for price and
  stock; a client cart would be a second copy to reconcile.
- _A zod-free subpath, over a lint rule._ The budget caught the regression; the subpath fixes it at the
  source. A rule for "value imports from the shared root in client files" was rejected as hard to scope
  correctly — the budget remains the enforcement.

**Counts:** 8 projects, 74 tests. Initial routes: `/` 128.9 KB, `/shop` 128.9, `/product/…` 130.8, `/cart`
128.9 (72–73%).

**Watched failing before being trusted:**

- **The budget, on a real regression** — the product page came in at **195.1 KB (108%) → FAIL**: the client
  component imported `formatInr` from the shared root and pulled all of zod into the browser. Moved to
  `@nowcore/shared/format`: 130.7 KB.
- **The product page layout** — by eye in Chrome: the sticky turntable shared a column with the controls and
  was painted over them; clicks hit the canvas. Restructured into two columns; flow re-verified.
- **Cart refusals** — tests for sold-out size (409), closed drop (409), quantity 6 and −1 (400), unknown SKU
  (400), malformed cart id (400).
- **Archived still** — the API picked the alphabetically first variant (ASH), which has no frames; the shop
  showed a blank panel. Now prefers the hero colourway; test asserts the BLK still.

**Carried forward:**

- **Port 4000 belongs to `country_dairy`'s API** on this machine; NOWCORE's API default moved to 4100.
- **Port 4190 is a Fetch-spec blocked port** (ManageSieve) — undici refuses it. The budget uses 4180/3180.
- **Browser automation vs Lenis** — scripted clicks that scroll an element into view can land before Lenis
  finishes smoothing. Not a user bug; drive QA flows with `?tier=static` or direct clicks.
- `/checkout` is linked from the cart and does not exist yet — next.
- HLD §3's "browse → Prisma read replica" is superseded by the boundary; update the HLD when it is next
  touched.

**Verified:** full uncached check; budget on a running server; in Chrome — shop rail renders aligned with
stills; product page: choose Bone + L, add → "Added — 1 in your cart", XS disabled and struck through,
badge 1; cart: line shown, + → quantity 2, ₹1,598, badge 2.

**Not verified:** a real phone; WebKit.

---

## 2026-10-13 — The whole film: chapters 01–06, phone composition, the clipping guard · T-038…T-044

The homepage film is complete: seven chapters, three of them pinned stages, measured inside budget on a
throttled phone for every tier.

**What landed.**

- **Chapters 01–06** (`apps/web/src/features/film/Chapters.tsx`): the radar ticker on `<Marquee>`; the drop
  as a pinned stage turning the second colourway while specs and price arrive as beats; the archive,
  desaturated and stamped; the making as a pinned stage with three beats in sequence; the wall; take-it
  with the waitlist form, footer and ghosted wordmark. `ChapterHead` carries the two-line move.
- **Phone composition** for the two turntable chapters, sized in `svh` so each fits one screen and pins.
- **Header backdrop** fading from the void, so fixed chrome dims a headline instead of colliding with it.
- **`ScrollStage` never clips.** If a stage's content is taller than the viewport it unpins and scrolls
  like a page (ResizeObserver; re-pins if it fits again).
- **`motion-check`** now scrolls the whole film, not one stage, and fails on any pinned stage that clips.

**Decisions, with what was rejected.**

- _Only three of seven chapters pinned._ The ticker, archive, wall and take-it read at a glance; pinning
  them would make the film a chore on a phone. Rejected: pinning everything because the reference does.
- _Unpin on overflow, over shrinking content to fit._ Shrinking text to keep a stage pinned trades
  legibility for motion. The phone compositions are designed to fit; the guard is the safety net when one
  does not.
- _Redesign the hero for 390px, over letting the guard unpin it._ The turn is the point of the hero and
  most buyers only see 390px; an unpinned hero on phones would quietly remove the product's signature.

**Counts:** 8 projects, 52 tests. Initial route 128.4 KB gzipped (71%) — six chapters added 0.1 KB, being
server components. Full-tier frames over the whole film: 840 KB (two colourways); reduced: 197 KB.

**Watched failing before being trusted:**

- **The clipping guard** — with the unpin disabled and a deliberately over-tall chapter, `motion-check`
  exited 1: `FAIL: clipped: the-making` on full and reduced. With the guard on and the same tall chapter,
  that stage unpinned (2 pinned instead of 3) and the check passed. Tall chapter then removed.
- **Whole-film measurement** — `full 60fps · LCP 0.50s · CLS 0.000 · 0 long tasks · 3 pinned`,
  `reduced 60fps · 0.39s · 0.000 · 0 · 3`, `static · 0.40s · 0.000 · 0 · 0` at 390×844, 4× CPU, Fast 4G.

**Carried forward:**

- **Found by accident, at 500px:** the header collision and the clipped stage. Both are now guarded, but
  they were found because a browser window happened to shrink — real-device testing is overdue.
- **The waitlist form posts to `/api/waitlist`, which does not exist yet** (FR-8, T-089). It will 404 if
  submitted. Not hidden, because the form is the design; wire it before anyone outside the team sees it.
- **Archive cards reuse drop 013's still** for drops 012–009, which have no seed frames. Placeholder.
- **840 KB of frames on the full tier** across two turning chapters. Within per-colourway budgets, but
  the page-level total is not budgeted anywhere. Consider a page budget when the shop and product pages
  add more.
- Chrome cannot size a window below 500px wide; the 390px check is the scripted one, not by eye.

**Verified:** full workspace check uncached; `motion-check` on the whole film, all tiers, seen failing;
the film by eye at 1440×900 and 500×656.

**Not verified:** a real phone; Safari/WebKit; anything after the waitlist submit.

---

## 2026-10-13 — The motion library, the turntable pipeline and chapter 00 · T-029…T-037

The critical path of Phase 2 is done: `libs/motion` exists, turntables render themselves from artwork,
and the hero scrubs a real 72-frame turn — measured inside every budget on a throttled phone profile.

**What landed.**

- **`libs/motion`** — tier detection (`prefers-reduced-motion` always wins; save-data, non-4G or <4 cores
  → reduced), pure scroll maths (stage progress, frame index, nearest-first prewarm, beat segments), a
  tiny observable store so scrubbing never re-renders React, and the primitives: `MotionProvider`,
  `ScrollStage`, `CanvasSequence`, `TextReveal`, `ChapterRail`, `Marquee`, `Grain`, `SmoothScroll`, `Beat`.
  `motion.css` uses tokens only. `?tier=` forces a tier for QA. 15 tests.
- **The turntable pipeline** (`apps/worker/src/render`) — a parametric 2.5D turn from flat artwork:
  silhouette narrows side-on, print foreshortens with cos θ and slides with sin θ, collar flips, highlight
  crosses. `sharp` composites and encodes AVIF. Both sets per colourway: 72 × 800px and 24 × 480px.
  Budgets asserted _before_ storing. `FrameStore` port with a local implementation. `RenderProcessor` on
  its own queue, concurrency 1. `pnpm frames` renders the seed drops. 8 new tests.
- **Chapter 00 — the signal** (`apps/web/src/features/film`) — 3.5-screen pinned stage, the turntable,
  the two-line headline revealing, "Already fading" and edition/price arriving as beats, chapter rail,
  glass nav, dock, live countdown, accent glow. Data from a fixture mirroring the seed until T-045.
- **`tools/motion-check.mjs`** — the measured half of the `motion-check` skill, as a script.

**Decisions, with what was rejected.**

- _No GSAP._ ADR-002 named GSAP + ScrollTrigger; built, the pinning is CSS sticky (morphowater's own
  technique) and progress is one division per frame. GSAP would have spent ~45 KB of the ~55 KB left.
  Rejected keeping it "for future timelines" — a chapter that needs one can import it lazily. ADR-002 revised.
- _A parametric 2.5D turn, over waiting for 3D models or photography._ Neither exists, and either would
  cost a day per drop — the exact failure T-034 exists to prevent. The output contract (frames + still per
  colourway, under budget) is what a better renderer would replace without touching the web app.
- _A dedicated 24-frame mobile set, over thinning the 72._ Same arc; 94 KB instead of ~140 KB at 800px.
- _Frames gitignored and regenerated (`pnpm frames`), over committing them._ They are build output —
  3.4 MB of binaries per seed render.
- _Scripted Playwright measurement, over waiting for the DevTools MCP in-session._ The MCP is installed
  and loads on a fresh session; the script is repeatable and could gate CI. Both stay: script for numbers,
  MCP traces for "why".
- _A fixture for the live drop, over pulling T-045 forward._ A request-time fetch would make the page
  dynamic, and the budget measures prerendered routes. The fixture has a narrow lint exception and a
  deletion note.

**Counts:** 8 projects, 52 tests. Initial route: 128.3 KB gzipped (71%) — the motion library added 3.7 KB.
Per colourway: 387–394 KB desktop set, 80–83 KB mobile set, ~10 s to render both.

**Watched failing before being trusted:**

- **motion-check** — a 40 ms main-thread block per canvas draw took the full and reduced tiers to
  **20 fps → FAIL**, plus 23 long tasks on reduced. Restored: `full 60fps · LCP 0.36s · CLS 0.000 ·
0 long tasks`, `reduced 60fps · 0.36s · 0.000 · 0`, `static · 0.36s · 0.000 · 0`.
- **The reduced-tier frame set** — removed the `reducedFrames` branch; the test asserting only `/m/`
  URLs are fetched failed. Restored: passes. (It first failed for the wrong reason: jsdom has no canvas,
  so the loader bailed before fetching — fixed with a stub 2D context, not by weakening the assertion.)
- **Print visibility** — the render test reads pixels in the print area: bright face-on, dark from behind.
- **`stageProgress(0, …)` returned `-0`**, which fails `Object.is(0)`. Clamp now uses `<=`.

**Carried forward:**

- **The 60 fps is simulated.** 4× CPU on an M-series laptop is not a ₹15,000 Android. The Phase 2 gate
  still needs a real mid-tier device — an operator task, not a code task.
- **The hero is built on a fixture.** `apps/web/src/lib/fixtures/live-drop.ts` goes when T-045 lands.
- **T-035 🟡** — frames go to the local filesystem; the Supabase Storage binding waits on the hosted project.
- **T-033 🟡** — `<MagneticCursor>` deferred to T-044; it is desktop-only polish.
- **The full tier loads all 72 frames (~415 KB)** in idle time after first paint. Within budget, but it is
  the biggest download on the page — revisit if the field RUM (T-094) shows it competing with LCP.
- The 2.5D renderer looks like a flat-lay turning, not a garment on a body. Fine for v1; photography or a
  garment model would replace `renderTurntable` behind the same contract.

**Verified:** full workspace `typecheck lint test build budget` uncached; `motion-check` green on all tiers
and seen failing; the hero scrolled by eye in Chrome (full tier, sticky pin, canvas painted, Lenis loaded).

**Not verified:** a real phone; Safari/WebKit; the admin app (unchanged shell).

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

# Flows

How a request, an order or a drop moves through the code — file by file, in the order things happen. Use it
to find where to change something, or to follow a bug from the screen to the database.

Paths are from the repo root. `→` means "calls" or "sends to". When you change a flow, change this page in
the same commit. Why things are built this way is in [`decisions.md`](./decisions.md).

---

## 0. The shape of every request

```
browser
  → apps/web (Next.js)       server components read; server actions write. The browser never calls the API.
      lib/api.ts             catalogue reads (cached 30 s, tag "catalogue")
      features/*/actions.ts  writes, with lib/forwarded.ts adding the buyer's IP + BFF_SECRET
  → apps/api (NestJS/Fastify)
      create-app.ts          body limits + rate limits from limits.ts, keyed by clientIp()
      modules/<context>/     controller (HTTP, zod) → service (domain) → PrismaService / FulfilmentQueue
  → Postgres (libs/db, Prisma)        the API and the worker are the only writers
  → Redis (BullMQ queues: pod, notify, render, trends)
  → apps/worker              processors pick jobs up: printer, email, renders, trend ingest
```

Contracts shared by every side live in `libs/shared` (zod schemas + pure functions). Order state changes
go through `libs/orders` only. Printers are behind `libs/pod`. Motion is `libs/motion`, tokens `libs/ui`.

---

## 1. Browsing the drop

```
apps/web/src/app/page.tsx                    the film (home)
  → lib/api.ts liveDrop()                     GET /drops/live (cached, tag "catalogue")
    → api modules/catalogue/catalogue.controller.ts → catalogue.service.ts liveDrop()
       (frame paths turned into URLs by modules/assets/asset-url.ts, ASSET_BASE_URL)
  → features/film/Chapters.tsx               seven chapters, built from libs/motion
      ScrollStage / CanvasSequence            frames fetched from the API's /frames/* (assets/frames.controller.ts)
      tier from libs/motion context.tsx       full / reduced / static (tier.ts; reduced-motion always wins)
  → features/film/Chrome.tsx                 header, skip link, countdown (Countdown.tsx), cart pill
app/layout.tsx                               DropTheme (accent from the live drop), SmoothScroll, Rum
app/shop/page.tsx, app/product/[slug]/page.tsx → lib/api.ts productPage() → GET /products/:slug
```

## 2. Cart

```
features/product/ProductStage.tsx (size + "Add to cart")
  → features/cart/actions.ts                 ensureCart(): POST /carts, cart id in an httpOnly cookie (30 days)
                                             put(): PUT /carts/:id/items
    → api modules/cart/cart.controller.ts → cart.service.ts setItem()
        refuses: drop not open (isOpen() — status AND closesAt), sold-out size
features/cart/cart.ts currentCart()          GET /carts/:id, for the cart page and the pill count
```

## 3. Checkout and payment

```
app/checkout/page.tsx → features/checkout/CheckoutForm.tsx
  → features/checkout/actions.ts placeOrder()                POST /orders
    → api modules/orders/orders.controller.ts → orders.service.ts place()
        re-reads every line from the variants (price, stock, isOpen) — the cart is a suggestion
        COD? assertCodAllowed() (needs a delivered prepaid order on that phone)
        transaction: lockEdition() + claimed() (libs/orders/edition.ts, ADR-008) → order PENDING with snapshots
        payments.createOrder() → modules/payments/razorpay.provider.ts (or fake.provider.ts locally)
  ← { reference, token, payment }
  → Razorpay checkout sheet in the browser (CheckoutForm.tsx loadRazorpay)
  → actions.ts confirmPayment()                             POST /orders/:reference/verify
    → orders.service.ts verify() → signature check → order-state.service.ts markPaid()
        → libs/orders markPaid(): conditional PENDING→PAID + event row (+ overEdition flag if the hold lapsed)
        → modules/fulfilment/fulfilment.queue.ts submit() + tell('confirmed')     (Redis, jobId = order)
  → features/checkout/AwaitPayment.tsx → app/order/[reference]/page.tsx

The same payment, told by Razorpay instead:
  POST /webhooks/:provider → modules/orders/webhooks.controller.ts
    verify HMAC over the raw body → webhook_events (dedupe on event id) → order-state.service.ts markPaid()

And if both were lost:
  modules/orders/reconcile.service.ts (every 5 min)
    PENDING 2 min–1 day → ask the provider → markPaid()
    PAID > 10 min with no printer order → fulfilment.queue.ts submit() again
    rum_samples older than 90 days → deleted
```

## 4. Fulfilment

```
apps/worker/src/fulfilment/pod-submit.processor.ts          queue "pod"
  PAID → FULFILMENT_QUEUED (libs/orders transition)
  → libs/pod PodProvider.createOrder() (sandbox.ts now; Printrove later)  idempotent on our reference
  → FULFILMENT_QUEUED → PRINTING, podOrderId saved        (10 tries, ~17 h, then FULFILMENT_FAILED)

Printer status:
  POST /webhooks/pod/:provider → modules/fulfilment/pod-webhooks.controller.ts → pod-events.service.ts
    verify + dedupe → PRINTING → SHIPPED → DELIVERED (or RTO) → tell('shipped')

Emails:
  apps/worker/src/fulfilment/notify.processor.ts             queue "notify"
    'confirmed' / 'shipped' → mailer.ts (ConsoleMailer locally, Resend later), link signed by libs/orders/token.ts

Operator fixes (admin → order):
  apps/admin/src/app/(dash)/orders/[reference]/actions.ts → POST /admin/orders/:ref/retry | cancel | refund
    → api modules/admin/admin-orders.service.ts
```

## 5. Order page

```
app/order/[reference]/page.tsx?t=<token>
  → GET /orders/:reference?t= → orders.service.ts → validOrderToken() (libs/orders/token.ts)
```

## 6. Making a drop (admin)

```
apps/admin/src/app/(dash)/drops/new/NewDropForm.tsx → drops/actions.ts createDrop()   POST /admin/drops
  → api modules/admin/admin-drops.controller.ts → admin-drops.service.ts create()
      drop + product + a variant per colourway × size (libs/shared blanks.ts, sku.ts), draft film copy

Artwork → turntables:
  drops/[slug]/page.tsx → actions.ts uploadArtwork()          POST /admin/drops/:slug/artwork (12 MB limit)
    → admin-drops.service.ts: checks PNG bytes and size → ARTWORK_STORE (libs/storage: .storage/ or Supabase "artwork", private)
      → queue "render", one job per colourway
  → apps/worker/src/render.processor.ts → render/render-colourway.ts (geometry, colour, turntable, artwork)
    → render/frame-store.ts: LocalFrameStore (.storage/frames) or ObjectFrameStore (Supabase "frames", public)
      → variants get /frames/<key> paths; the API prefixes ASSET_BASE_URL (the API locally, the bucket when hosted)
  drops/[slug]/RenderWatch.tsx refreshes the page until every colourway has frames

Printer mapping:  actions.ts → PATCH /admin/variants/:sku → podVariantId
Publish check:    admin-drops.service.ts problems() — unmapped ids, ids the printer does not stock
                  (PodProvider.unknownVariants), missing turntables, accent contrast, film copy, window

Open:
  actions.ts → POST /admin/drops/:slug/publish {mode:'now'|'schedule'}
    → admin-drops.service.ts publish() → problems() → open()
        advisory lock → one live drop → LIVE, closesAt (+72 h)
        → refreshStorefront(): POST web /api/revalidate (apps/web/src/app/api/revalidate/route.ts → revalidateTag)
        → fulfilment.queue.ts dropOpened() → notify job 'drop-open'
```

## 7. The drop clock

```
apps/api/src/modules/admin/drop-clock.service.ts tick() (every minute, DROP_CLOCK=on)
  LIVE past closesAt → ARCHIVED → refreshStorefront()
  earliest SCHEDULED past opensAt → problems() → admin-drops.service.ts open()   (same lock as "Open now")
  held? reported as 'check' (fails the publish check) or 'live' (another drop is live)
```

## 8. Waitlist

```
Join:   features/waitlist/WaitlistForm.tsx → features/waitlist/actions.ts joinWaitlist()
          → POST /waitlist → modules/waitlist/waitlist.controller.ts (upsert, same answer always)
Alert:  drop opens → notify job 'drop-open' → apps/worker/src/fulfilment/notify.processor.ts dropOpened()
          for each active subscriber: write drop_alerts row first (at most once) → mailer → link with listToken()
Leave:  email link → app/unsubscribe/page.tsx (shows a button) → actions.ts leaveList()
          → POST /waitlist/unsubscribe (token checked) → unsubscribedAt set
```

## 9. Trend radar

```
Ingest: apps/worker/src/trends/trends.processor.ts
          onApplicationBootstrap: one hourly job scheduler per configured source (TRENDS=on)
          process(): trends/sources.ts pull() (HN, Google Trends; Reddit/YouTube with credentials)
            → libs/shared/trends.ts isNoise() + normalise() → trends upsert on (source, externalId)
Board:  apps/admin/src/app/(dash)/radar/page.tsx → GET /admin/trends
          → api modules/admin/admin-trends.service.ts board() → libs/shared/trends.ts radar() over the last 24 h
            + trend_clusters (decisions) + the single-source watch list
Decide: radar/actions.ts decide() → POST /admin/trends/decide → trend_clusters upsert
Promote: radar/actions.ts promote() → POST /admin/trends/promote
          → admin-trends.service.ts promote(): two-source rule again → admin-drops.service.ts create()
          → trends linked to the drop (evidence) → redirect to /drops/<slug> (evidence shown there)
```

## 10. Admin sign-in

```
apps/admin/src/app/login/LoginForm.tsx → login/actions.ts signIn()         POST /admin/session (5/min per IP)
  → api modules/admin/auth.service.ts (scrypt via password.ts) → session token (hash stored, 12 h)
  → httpOnly cookie nc_admin
Every admin page → apps/admin/src/lib/api.ts get()/send() → Bearer token → modules/admin/operator.guard.ts
  401 → redirect to /login?expired=1
```

## 11. Field performance

```
apps/web/src/features/rum/Rum.tsx (in app/layout.tsx)
  web vitals (next/web-vitals) + p95 scroll frame time + own LCP observer
  page hidden / route change → navigator.sendBeacon('/api/rum')
  → apps/web/src/app/api/rum/route.ts (pass-through, 4 KB cap, forwarded IP)
  → POST /rum → api modules/rum/rum.controller.ts (zod) → rum_samples (integers, thousandths)
Admin dashboard: apps/admin/src/features/FieldPerformance.tsx → GET /admin/rum?days=7
  → modules/admin/admin-rum.service.ts (p75 in SQL, by low-end and tier)
```

## 12. Limits and the buyer's IP

```
apps/web/src/lib/forwarded.ts, apps/admin/src/lib/forwarded.ts
  x-client-ip (from x-forwarded-for) + x-bff-secret on every rate-limited call
apps/api/src/create-app.ts
  applyLimits(): onRoute hook reads limits.ts → bodyLimit + @fastify/rate-limit config per route
  clientIp(): trusts x-client-ip only with the right BFF_SECRET, else the socket address
  Redis counters "<QUEUE_PREFIX>-rl-…", fail open
```

## 13. SEO

```
apps/web/src/app/layout.tsx       metadataBase (SITE_URL), Open Graph defaults
each page                         its own canonical
app/sitemap.ts, app/robots.ts     home, shop, live products, legal pages; private pages disallowed
app/opengraph-image.tsx, app/product/[slug]/opengraph-image.tsx → features/seo/card.tsx (Geist TTFs in seo/fonts)
app/product/[slug]/page.tsx       Product JSON-LD
```

## 14. Legal pages

```
app/legal/{shipping,cod,privacy,terms,contact}/page.tsx → features/legal/LegalPage.tsx
  business details: features/legal/business.ts (placeholders until launch → "Draft" notice)
  costs read from libs/shared checkout.ts (FREE_SHIPPING_FROM, SHIPPING, COD_FEE)
footer links: features/film/Chapters.tsx TakeIt()
```

---

## Where to change…

| You want to change                    | Start at                                                              |
| ------------------------------------- | --------------------------------------------------------------------- |
| Prices, shipping, COD fee, GST        | `libs/shared/src/checkout.ts`                                         |
| What a drop needs before it can open  | `apps/api/src/modules/admin/admin-drops.service.ts` `problems()`      |
| Order statuses and allowed moves      | `libs/shared/src/order.ts` (TRANSITIONS), `libs/orders/src/index.ts`  |
| The edition hold (15 min)             | `libs/orders/src/edition.ts`                                          |
| Rate limits or body sizes             | `apps/api/src/limits.ts`                                              |
| Colours, type, focus ring             | `libs/ui/src/tokens.css` (never in an app)                            |
| Motion tiers or budgets               | `libs/motion/src/tier.ts`, `docs/10-design-system.md`                 |
| Radar scoring, noise, two-source rule | `libs/shared/src/trends.ts`                                           |
| A radar source                        | `apps/worker/src/trends/sources.ts`                                   |
| Email wording                         | `apps/worker/src/fulfilment/notify.processor.ts`                      |
| Policy text / business details        | `apps/web/src/app/legal/*`, `apps/web/src/features/legal/business.ts` |
| The printer                           | `libs/pod` (port.ts, sandbox.ts; a Printrove adapter goes here)       |
| Environment variables                 | each app's `src/env.ts` (zod; production refuses local defaults)      |

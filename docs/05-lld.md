# 05 — Low-level design

## 1. Data model

Prisma, against Supabase Postgres. Money is integer **paise** everywhere; there are no floats in this
schema. Sketch — field names are the contract, attributes will tighten in T-012.

```prisma
enum DropStatus    { DRAFT SCHEDULED LIVE ARCHIVED }
enum OrderStatus   { PENDING PAID FULFILMENT_QUEUED FULFILMENT_FAILED PRINTING SHIPPED DELIVERED CANCELLED REFUNDED RTO }
enum PaymentMethod { UPI CARD NETBANKING WALLET COD }
enum TrendStatus   { NEW SHORTLISTED REJECTED SHIPPED }

model Drop {
  id          String     @id @default(uuid())
  number      Int        @unique            // 14 → "DROP 014"
  slug        String     @unique
  title       String
  accentColor String                        // re-tints the whole site for this drop's life
  status      DropStatus @default(DRAFT)
  opensAt     DateTime?
  closesAt    DateTime?
  editionSize Int?                          // null = unlimited within the window
  chapters    Json                          // CMS copy for the film, validated by zod
  products    Product[]
  trends      Trend[]
  waitlist    WaitlistSubscription[]
  @@index([status, opensAt])
}

model Product {
  id          String    @id @default(uuid())
  dropId      String
  drop        Drop      @relation(fields: [dropId], references: [id])
  slug        String    @unique
  title       String
  description String
  basePaise   Int
  variants    Variant[]
  assets      Asset[]
}

model Variant {
  id           String  @id @default(uuid())
  productId    String
  product      Product @relation(fields: [productId], references: [id])
  size         String
  colorName    String
  colorHex     String
  sku          String  @unique              // NC-014-TEE-BLK-L
  podVariantId String?                      // null blocks publish — see §5
  pricePaise   Int
  soldOut      Boolean @default(false)
  mockupUrl    String?
  sequenceUrl  String?                      // Storage prefix for the 72 frames
  @@unique([productId, size, colorName])
}

model Order {
  id              String        @id @default(uuid())
  reference       String        @unique      // NC-10427, shown to humans
  customerId      String?                    // null = guest checkout
  email           String
  phone           String
  status          OrderStatus   @default(PENDING)
  method          PaymentMethod?
  subtotalPaise   Int
  shippingPaise   Int
  taxPaise        Int
  totalPaise      Int
  razorpayOrderId String?       @unique
  podOrderId      String?       @unique
  trackingUrl     String?
  shippingAddress Json
  items           OrderItem[]
  events          OrderEvent[]
  createdAt       DateTime      @default(now())
  @@index([status, createdAt])
}

model OrderItem {
  id          String @id @default(uuid())
  orderId     String
  order       Order  @relation(fields: [orderId], references: [id])
  variantId   String                        // reference only — never joined for display
  titleSnap   String                        // frozen at purchase
  skuSnap     String
  sizeSnap    String
  colorSnap   String
  pricePaise  Int                           // frozen at purchase
  quantity    Int
}

model OrderEvent {                          // append-only; the order's true history
  id        String      @id @default(uuid())
  orderId   String
  order     Order       @relation(fields: [orderId], references: [id])
  from      OrderStatus?
  to        OrderStatus
  source    String                          // razorpay | printrove | operator | system
  payload   Json
  createdAt DateTime    @default(now())
  @@index([orderId, createdAt])
}

model WebhookEvent {                        // the idempotency table
  id         String   @id @default(uuid())
  provider   String                         // razorpay | printrove
  eventId    String
  receivedAt DateTime @default(now())
  @@unique([provider, eventId])
}

model Trend {
  id         String      @id @default(uuid())
  source     String                         // reddit | hn | google_trends | youtube
  externalId String
  term       String
  score      Int
  capturedAt DateTime
  status     TrendStatus @default(NEW)
  dropId     String?
  drop       Drop?       @relation(fields: [dropId], references: [id])
  @@unique([source, externalId])
  @@index([status, score])
}

// Built (T-074–T-081): Trend also has url and seenAt (last sighting; capturedAt is the first).
// Clusters are computed at read time by radar() in libs/shared/trends.ts — keys are words and
// adjacent word pairs; a key is on the board when two sources carry it at score ≥ 50 inside
// 24 h. Scores are one log scale across sources (normalise()). The only stored state:
model TrendCluster {
  key       String      @id          // "gemini argon"
  status    TrendStatus              // SHORTLISTED | REJECTED | SHIPPED
  dropId    String?
  decidedAt DateTime
}
```

Also: `Customer` (→ `auth.users`), `Address`, `Cart`/`CartItem`, `Asset`, `WaitlistSubscription`,
`WallPost`.

**Two rules the schema enforces structurally.** `OrderItem` snapshots title, SKU, size, colour and price,
so a POD catalogue price change cannot rewrite history. `WebhookEvent` has a unique constraint on
`(provider, eventId)`, so idempotency is a database guarantee rather than application discipline.

## 2. API surface

Public, consumed by `apps/web`. **Built (T-045, T-048)** — shapes are the zod contracts in
`libs/shared/src/catalogue.ts` and `cart.ts`, parsed on both sides:

```
GET   /drops/live                      the live drop (or the latest, if none is live) with chapters
GET   /drops/archive                   closed drops, newest first
GET   /drops/:slug                     any non-draft drop
GET   /products/:slug                  product, its drop, colourways → sizes, frames
POST  /carts                           create; the id is the credential (httpOnly cookie on web)
GET   /carts/:id                       lines priced from current variants, availability flagged
PUT   /carts/:id/items                 {sku, quantity 0..5} — refuses sold out, closed drop
POST  /orders                          re-validates price + availability, creates Razorpay order
GET   /orders/:reference?token=        tracking without an account (signed link)
POST  /waitlist                        subscribe — idempotent, same answer either way (T-083)
POST  /waitlist/unsubscribe            {email, token}; token = HMAC of the email, sent in every alert
POST  /rum                             field performance beacon (T-094); anonymous; via the storefront's /api/rum
```

Admin — **built** (T-063–T-073), behind an operator session (ADR-005: sign-in in the API, not Supabase Auth).
The block below was the plan; the routes that exist are `POST/DELETE /admin/session`, `GET /admin/me`,
`GET /admin/dashboard`, `GET /admin/orders[/:reference]`, `POST /admin/orders/:reference/{retry,cancel,refund}`,
`GET|POST /admin/drops`, `GET|PATCH /admin/drops/:slug`, `PUT /admin/drops/:slug/chapters`,
`POST /admin/drops/:slug/{artwork,publish,close,extend}`, `PATCH /admin/variants/:sku`, `GET /admin/customers`.
Assets: `GET /frames/*` (ADR-006). Planned shape, for reference:

```
POST  /admin/drops                     create draft
PATCH /admin/drops/:id                 edit
POST  /admin/drops/:id/publish         runs the publish check (§5), schedules or opens
POST  /admin/drops/:id/close           close early
POST  /admin/products/:id/artwork      upload → enqueues render.turntable
GET   /admin/orders                    filter, paginate
POST  /admin/orders/:id/retry          re-enqueue a failed fulfilment
GET   /admin/rum?days=7                p75 vitals and scroll fps, by tier and low-end devices
GET   /admin/trends                    radar board: two-source clusters, the single-source watch list, source freshness
POST  /admin/trends/decide             {key, action: shortlist|reject|reset}
POST  /admin/trends/promote            {key} → draft drop; every trend under the key linked as evidence (T-081)
```

Orders and payments — **built (T-050–T-057)**:

```
POST  /orders                          place: re-prices, re-checks stock + edition, snapshots, hands off
POST  /orders/:reference/verify        the payment sheet's success report; trusted only if signed
GET   /orders/:reference?t=            the order, behind a signed single-order token
POST  /dev/fake-payments/:id/pay       PAYMENTS=fake only — never registered otherwise
```

Webhooks, signature-verified over the raw body, never authenticated by session:

```
POST  /webhooks/razorpay               (or /webhooks/fake locally) — built
POST  /webhooks/pod/:provider          printer status — built against the sandbox (T-061)
POST  /dev/pod/:reference/advance      POD=sandbox only — plays the press through the real signed path
```

Payments sit behind a `PaymentProvider` port (`apps/api/src/modules/payments`) — `RazorpayProvider` and a
`FakeProvider` that signs exactly as Razorpay does. `orders.razorpay_order_id` holds whichever provider's
order id is configured; the column name predates the port.

## 3. Webhook contract

Both handlers follow the same five steps, in this order:

1. **Verify the signature** against the raw request body. Fastify must be configured to keep the raw
   body — a JSON-parsed body re-serialised will not match the HMAC, and this fails silently in test.
2. **Insert into `WebhookEvent`.** A unique-constraint violation means we have already processed this
   event: return `200` and stop. Returning an error would make the provider retry forever.
3. **Load the order** by provider id.
4. **Apply the transition** inside a transaction, writing an `OrderEvent`.
5. **Enqueue side effects** — email, WhatsApp, POD submission. Never perform them inline; a slow SMTP
   call inside a webhook handler is how providers decide you are down.

Always return `200` for an event that was understood, even when it changed nothing.

## 4. Order state machine

```
PENDING ──pay──▶ PAID ──enqueue──▶ FULFILMENT_QUEUED ──pod ok──▶ PRINTING ──▶ SHIPPED ──▶ DELIVERED
   │                                      │                                        │
   │ fail/expire                          │ pod rejects                            │ undelivered
   ▼                                      ▼                                        ▼
CANCELLED                        FULFILMENT_FAILED ──operator retry──┘            RTO
```

Transitions are append-only through `OrderEvent`. `Order.status` is a cached projection of the latest
event, not the source of truth — a disagreement between them is a bug worth alerting on.

COD orders skip `PENDING` and enter at `PAID` with `method = COD`, carrying the RTO allowance from
[doc 11](./11-business-model.md).

## 5. The publish check

`POST /admin/drops/:id/publish` refuses the drop unless **all** hold. This is the gate that stops the
worst failure in the system — taking money for something that cannot be made.

- Every variant has a non-null `podVariantId`.
- Every variant has a `mockupUrl` and a `sequenceUrl`.
- Each frame sequence is within budget (≤ 1.2MB mobile, ≤ 3.0MB desktop).
- `accentColor` meets 4.5:1 against `--void` for text use and renders legibly as black-on-accent.
- `opensAt` is in the future and `closesAt` is after it.
- Chapter copy parses against the zod chapter schema.
- A sandbox POD order has succeeded for every colourway.

## 6. Security checklist

- No provider credential is readable by `apps/web` or `apps/admin`. Enforced structurally by the module
  boundary that bans `scope:web` from importing any pod or payment package.
- Price and availability are re-validated server-side at order creation. The client's cart is a suggestion.
- The edition cap holds under a rush (ADR-008): unpaid orders hold their pieces for 15 minutes and checkout
  is serialised per drop by an advisory lock. `pnpm exec nx run api:load` proves it with 500 buyers.
- Webhook signatures verified against the raw body; unsigned requests rejected before any parsing.
- Tracking links are signed, single-order, and expire — a sequential order reference must never be
  enumerable into someone else's address.
- Supabase service role key exists only in `apps/api` and `apps/worker`. Never in a Next.js environment
  variable, prefixed or not.
- Artwork uploads: content-type and magic-byte checked, size-capped, served from Storage, never executed.
- Admin routes require an operator role claim verified server-side on every request — never a client check.
- PII (address, phone) is never written to logs or Sentry breadcrumbs.
- Rate limits on `/orders`, `/waitlist` and `/webhooks/*` — **built (T-101)**, plus carts and operator
  sign-in. One table, `apps/api/src/limits.ts`; the API will not start if it names a route that does not
  exist. Per client IP per minute, counted in Redis, failing open if Redis is down. Web and admin call the
  API from their servers, so they forward the buyer's IP as `x-client-ip` signed with `BFF_SECRET`; without
  the secret the header is ignored. Bodies are capped at 64 KB except artwork (12 MB).

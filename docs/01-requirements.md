# 01 — Requirements

## Product principles

**P1 — Speed is the product.** Any trend that cannot go from spotted to buyable inside one working day
is a trend we lost. Every architectural choice is judged against that clock first.

**P2 — Scarcity is the offer.** Drops open for 72 hours and never restock. The archive is kept forever,
stamped and unbuyable, because the archive is what makes today's drop urgent.

**P3 — Zero inventory, always.** We never hold stock, never tie up capital, never guess demand. A design
that does not sell costs us a day of work, not a warehouse.

**P4 — The site is the brand.** We are selling a ₹799 tee that a hundred other shops also sell. The only
defensible difference is that NOWCORE looks and feels like nothing else in the category.

**P5 — Honest degradation.** Cinematic is the default, not the requirement. On a slow phone the same
design arrives with less motion — never a different, worse design, and never a page that cannot be
bought from.

## Actors

| Actor        | Who                                                                           | What they need                                                                                   |
| ------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Visitor**  | Arrived from Instagram or a link, on a phone, in under 10 seconds of patience | To understand the drop, see the garment, and buy without making an account                       |
| **Buyer**    | Visitor who paid                                                              | Confidence it is real, a tracking number, and to know when the next drop lands                   |
| **Operator** | You                                                                           | To run a whole drop — trend to live — without touching code, and to see every order's true state |
| **Radar**    | The ingest worker                                                             | To pull, score and deduplicate trend signals without being rate-limited or banned                |

## Functional requirements

### Storefront

- **FR-1** The homepage presents the live drop as a chaptered scroll film with a persistent countdown.
- **FR-2** Every surface — home, shop, product, cart — carries the cinematic treatment.
- **FR-3** A visitor can buy without creating an account. Email and phone are enough.
- **FR-4** The product page shows a 360° turntable of the actual garment in the selected colourway.
- **FR-5** Sold-out variants are shown struck through, never hidden. Scarcity has to be visible.
- **FR-6** A closed drop keeps its page forever: desaturated, stamped with its close date, unbuyable.
- **FR-7** Checkout accepts UPI, cards and COD through Razorpay, priced in INR.
- **FR-8** A visitor can join the waitlist for the next drop and is notified once when it opens.

### Fulfilment

- **FR-9** A paid order is submitted to the POD provider automatically, with no human step.
- **FR-10** Provider status changes reach the buyer as tracking updates and an email.
- **FR-11** Order items snapshot price, title and variant at purchase time.
- **FR-12** Every webhook is idempotent on the provider's event id.
- **FR-13** An order that fails to reach the provider raises an operator alert and is retried with backoff.

### Admin

- **FR-14** The operator can author a drop: number, title, accent colour, chapters, open and close times.
- **FR-15** Uploading artwork produces mockups and the 72-frame turntable without manual rendering.
- **FR-16** The order board updates live and shows true fulfilment state, not just payment state.
- **FR-17** The operator can see revenue, orders, AOV, COD share and print SLA for a chosen range.
- **FR-18** The operator can close a drop early, or extend it, without a deploy.
- **FR-19** Homepage chapter copy and imagery are editable without a deploy.

### Trend radar

- **FR-20** Signals are ingested hourly from Reddit, Hacker News, Google Trends and YouTube.
- **FR-21** Signals are scored, deduplicated across sources, and surfaced as a shortlist board.
- **FR-22** A shortlisted signal can be promoted to a draft drop, carrying its evidence with it.
- **FR-23** Every drop records the sources and scores that justified it.

### Accounts

- **FR-24** Optional account via Supabase Auth — phone OTP or email.
- **FR-25** A buyer can see order history and tracking without an account, via a signed link.
- **FR-26** Abandoned carts are recovered by one email or WhatsApp message, once.

## Non-functional requirements

| ID         | Requirement                                                                      |
| ---------- | -------------------------------------------------------------------------------- |
| **NFR-1**  | LCP < 2.5s, CLS < 0.1, INP < 200ms on simulated Fast 4G with 4× CPU throttling   |
| **NFR-2**  | Scroll holds ≥ 55fps p95 on a mid-tier Android during any scrubbed sequence      |
| **NFR-3**  | Frame sequences ≤ 1.2MB mobile, ≤ 3.0MB desktop, per colourway                   |
| **NFR-4**  | Home route JS ≤ 180KB gzip, excluding frames                                     |
| **NFR-5**  | Every surface works at 390px and passes WCAG 2.2 AA for contrast and focus order |
| **NFR-6**  | `prefers-reduced-motion: reduce` yields a fully shoppable static experience      |
| **NFR-7**  | Payment and fulfilment webhooks are idempotent and survive duplicate delivery    |
| **NFR-8**  | No secret is ever read by the web app; the API holds every provider credential   |
| **NFR-9**  | A drop can be authored and opened by one person in under 4 hours from shortlist  |
| **NFR-10** | Trend ingest never exceeds any source's published rate limit                     |

## Non-goals (v1)

- International shipping or multi-currency. The `PodProvider` port keeps it possible; nothing more.
- A marketplace, user-submitted designs, or made-to-order customisation.
- Subscriptions, loyalty points, or referral mechanics.
- A native mobile app. It is Phase 8, after the web is proven.
- Live chat. A contact form and WhatsApp link are enough at this volume.
- X/Twitter as a radar source. The API is priced out of reach — revisit if it changes.

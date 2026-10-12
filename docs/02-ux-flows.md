# 02 — UX flows

Nine flows. Each lists its steps, the states that can occur, and what happens when it goes wrong.
Requirement IDs refer to [01-requirements.md](./01-requirements.md).

```
                         ┌──────────────┐
   Instagram / link ────▶│  F1  The film │────┐
                         └──────────────┘    │
                                             ▼
   ┌──────────────┐     ┌──────────────┐   ┌──────────────┐    ┌──────────────┐
   │ F8 Waitlist  │◀────│  F2  Shop    │──▶│ F3  Product  │───▶│ F4 Checkout  │
   └──────────────┘     └──────────────┘   └──────────────┘    └──────┬───────┘
          ▲                     ▲                                     │
          │                     │                                     ▼
   ┌──────┴───────┐     ┌───────┴──────┐                      ┌──────────────┐
   │ F9 Drop opens│◀────│ F7 Archive   │                      │ F5 Fulfilment│
   └──────────────┘     └──────────────┘                      └──────┬───────┘
          ▲                                                          │
          │                     ┌──────────────┐                     ▼
          └─────────────────────│ F6 Author    │              ┌──────────────┐
                                │    a drop    │              │  Tracking    │
                                └──────────────┘              └──────────────┘
```

---

## F1 — The film (homepage) · FR-1, FR-2, P5

| #   | Step                         | State                                                       | Notes                                                      |
| --- | ---------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Land on `/`                  | Quality tier chosen once at mount                           | From `prefers-reduced-motion`, `effectiveType`, `saveData` |
| 2   | Hero paints                  | Static fallback frame first, canvas takes over when decoded | The fallback frame is the LCP element — never the canvas   |
| 3   | Scroll chapter 00            | Stage pins, turntable scrubs, headline reveals              | Chapter rail tracks index                                  |
| 4   | Chapters 01–06               | Trend ticker, the drop, archive, making, wall, CTA          | Each is its own pinned stage                               |
| 5   | Countdown visible throughout | Dock, bottom right                                          | Also in nav on mobile                                      |

**Edge cases.** Drop already closed → chapter 02 swaps to the archived treatment and the CTA becomes
"Join the waitlist". No drop live at all → the film runs on the most recent drop with an
`ARCHIVED` stamp, and chapter 06 leads with the waitlist. Frames fail to load → fallback frame stays,
no error shown, scroll still advances chapters.

---

## F2 — The shop rail · FR-2, FR-5, FR-6

Horizontal pinned rail of drop panels; live drop first, archive after it, newest first. Filters open as
an overlay, not a sidebar — the rail is the composition and a sidebar would break it.

**Edge cases.** Zero archived drops (launch day) → the rail shows only the live drop and the copy reads
"the first one". Filter returns nothing → the empty state offers the waitlist rather than a dead end.

---

## F3 — Product · FR-4, FR-5

| #   | Step                   | State                                                                       |
| --- | ---------------------- | --------------------------------------------------------------------------- |
| 1   | Open `/product/[slug]` | Default colourway, no size chosen                                           |
| 2   | Pick colourway         | Turntable swaps sequence; URL updates; selected size preserved if available |
| 3   | Pick size              | Sold-out sizes struck through and disabled, never removed                   |
| 4   | Add to cart            | Persistent bottom bar; cart count animates                                  |

**Edge cases.** Size sold out while on the page → Realtime marks it struck through and, if it was the
selected one, clears the selection and says so. Drop closes while on the page → the buy bar becomes
"This drop has closed" with a waitlist link; the page stays readable forever.

---

## F4 — Checkout · FR-3, FR-7

Cart → address → Razorpay → confirmation. No account required (FR-3); email and phone are collected for
the order and for tracking.

**This is where the film ends.** The payment step is composed and calm, and the Razorpay surface belongs
to Razorpay. Motion here is limited to state transitions.

**Edge cases.** Payment fails → cart preserved intact, retry offered, no order row created. Payment
succeeds but the webhook is late → confirmation page polls the order, shows "confirming payment" rather
than an error. COD selected → the COD policy from [doc 11](./11-business-model.md) applies, and a
confirmation step is shown before placing. Stock exhausted between add-to-cart and pay → the order is
refused _before_ payment, never refunded after.

---

## F5 — Fulfilment · FR-9 to FR-13

```
payment captured ──▶ order PAID ──▶ queue job ──▶ POD create order ──▶ POD accepted
                                        │                                   │
                                   retry×5 backoff                    webhook: printing
                                        │                                   │
                                   operator alert                    webhook: shipped ──▶ email + tracking
                                                                            │
                                                                     webhook: delivered
```

Every transition is append-only. Every webhook is idempotent on the provider event id (FR-12) because
both Razorpay and Printrove retry and both will double-fire.

**Edge cases.** Provider rejects the order (bad variant map) → operator alert, order held in
`FULFILMENT_FAILED`, buyer told it is delayed, never silently dropped. Provider is down → retries with
backoff for 24h before escalating. Duplicate webhook → second delivery is a no-op.

---

## F6 — Author a drop · FR-14 to FR-19, FR-22

The `new-drop` skill is this flow written as a procedure. Shortlist → legal clearance → artwork →
turntable render → variant map → price → schedule → open.

**Gate.** The drop cannot open with an unmapped variant. An unmapped variant takes money for something
that cannot be made, which is the worst failure in the system.

---

## F7 — The archive · FR-6, P2

A closed drop is desaturated, stamped `ARCHIVED · <date>`, and keeps its page and URL permanently. Nothing
is restocked. Buy controls are replaced by the waitlist, not removed — the shape of the page stays, which
is what makes the loss legible.

---

## F8 — Waitlist · FR-8

Email captured on the film, the archive, or an empty filter. One confirmation. One message when the next
drop opens. Nothing else, ever — stated at the point of capture and honoured.

---

## F9 — Drop opens · FR-8, FR-18

Scheduler flips the drop to `live` at `opens_at`, sends the waitlist notification, and starts the
countdown. **The send is not reversible**, so the preview in F6 is the last honest checkpoint.

**Edge cases.** Scheduler misses its window → the drop still opens on first request after `opens_at`;
the notification job is separate and idempotent on drop id, so a late run cannot double-send.

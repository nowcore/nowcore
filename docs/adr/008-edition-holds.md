# ADR-008 — Unpaid orders hold their pieces; checkout is serialised per drop

**Status:** Accepted, 15 Oct 2026

**Context.** The load test (T-096) released 500 buyers at once on a drop with an edition of 100. All 500
paid. Two faults: the edition check counted only _paid_ orders, and every buyer was checked before anyone
had paid; and the check and the order it admitted were separate statements, so concurrent checkouts read
the same count.

**Decision.**

- An unpaid (PENDING) order **holds** its pieces for 15 minutes (`HOLD_MS`, libs/orders `edition.ts`) —
  enough to finish UPI or a card. The edition counts paid orders plus live holds.
- Checkout takes a Postgres advisory lock per drop and does the count and the order insert in one
  transaction. A rush is served in turn; holds can never exceed the edition. The payment provider is called
  after the transaction, so the lock is held for milliseconds.
- A payment that arrives **after its hold lapsed**, when the edition has since filled, is **honoured** and
  flagged: the PAID event carries `overEdition: true` and the API logs a warning.

**Why honour the late payer.** The money is already taken, and the garment is printed on demand — there is
no stock to run out of. Refusing would mean a refund flow for a buyer who did nothing wrong but pay slowly.
The cap can be exceeded only by buyers whose hold lapsed, which needs a 15-minute payment and a sell-out
inside that window. The flag makes every case visible.

**Consequences.** An abandoned checkout keeps a piece off the shelf for up to 15 minutes; near sell-out a
buyer can be told "Only 0 left" and succeed a little later. The storefront's edition counter still shows
paid pieces only. Checkouts for one drop are serialised — measured at 1 000 simultaneous buyers: order p95
2.1 s locally, every response a 201 or a 409, never a 5xx.

**Alternatives rejected.** Counting only paid orders and checking again at payment (would refund most of a
rush). A stock row decremented with `UPDATE … WHERE remaining >= n` (needs restocking logic for every
abandoned checkout, i.e. the same holds with more moving parts). `SERIALIZABLE` isolation (retries under
contention are exactly the rush case).

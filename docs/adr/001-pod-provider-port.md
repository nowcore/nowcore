# ADR-001 — Fulfilment behind a PodProvider port

**Status:** Accepted, 13 Oct 2026

**Context.** India-first means Printrove now. Printful (the reference site's provider) costs ~₹2,500
landed into India with 2–3 week delivery, which a 72-hour drop cannot survive. Global shipping is a
plausible later step.

**Decision.** `libs/pod` exposes a `PodProvider` port (catalogue, variant map, create order, cancel,
verify webhook). Printrove is the first adapter. Nothing outside `libs/pod` imports a provider type;
Nx module boundaries enforce it.

**Why.** The order domain should not change when the printer does.

**Consequences.** One small abstraction to maintain. Qikink or Printful becomes an adapter, not a rewrite.

**Alternatives rejected.** A direct Printrove client in the order service — cheaper today, a rewrite the
first time we ship abroad or Printrove's SLA slips.

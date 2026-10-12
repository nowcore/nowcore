# ADR-004 — Cinematic everywhere, paid for with tiers and budgets

**Status:** Accepted, 13 Oct 2026

**Context.** The operator was offered a two-speed site (cinematic home, fast commerce) and chose
cinematic on every surface, with the conversion and mobile-performance cost stated at the time.

**Decision.** Home, shop, product and cart all get the film treatment. Checkout's payment step is the
one exception, because the Razorpay surface belongs to Razorpay. Every animated surface ships full,
reduced and static tiers; the static tier must remain fully shoppable. Budgets in
[doc 10](../10-design-system.md) gate CI.

**Why.** P4: the site is the brand. P5: it degrades honestly rather than becoming a different site.

**Consequences.** Phase 2 has a hard gate: ≥55fps p95 and LCP < 2.5s on a mid-tier Android. If it
fails, this decision is revisited with measurements.

**Alternatives rejected.** Two-speed site (operator's call to reject). Cinematic per-drop microsites only.

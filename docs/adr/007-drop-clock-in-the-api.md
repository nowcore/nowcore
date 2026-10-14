# ADR-007 — The drop clock runs in the API, and opening is locked

**Status:** Accepted, 14 Oct 2026

**Context.** T-082 was planned as a worker job (`schedule.drops`). But a scheduled drop can still be edited
after it is scheduled — its variants remapped, its accent changed — so the clock must re-run the publish
check before opening it. That check lives in the API: it asks the printer, through the POD port, whether
every mapped variant exists. A worker clock would either duplicate the check or skip it, and a skipped check
fails at the printer after a buyer has paid.

Separately, "one live drop at a time" was a read-then-write in `publish`: two openers (an operator and the
clock, or two API instances) could each see no live drop and both open one.

**Decision.** `DropClockService` in the API ticks every minute (`DROP_CLOCK=on|off`, off in tests). Each
tick closes live drops past `closesAt` (conditional on still being live), then tries the earliest due
scheduled drop: it must pass the same publish check, and it opens through the same `open()` an operator's
"Open now" uses. `open()` takes a Postgres advisory transaction lock around the check-and-write. A due drop
that fails the check, or waits behind a live drop, stays scheduled; the tick reports why (`held`).

Cart and order placement no longer trust status alone: `isOpen()` refuses a drop past `closesAt` even while
it is still `LIVE`, so a late or stopped clock can never sell after the close (T-084).

**Why.** One code path opens drops, with one check and one lock. Re-evaluating state each minute loses
nothing on deploy — docs/03 rejected in-process cron because it loses _jobs_; this clock has none to lose,
the next tick after a restart catches up.

**Consequences.** Several API instances each tick; safe (lock + conditional updates), slightly wasteful.
A drop due while another is live opens within a minute of that one closing — possibly long after its own
`opensAt`; it then gets a fresh 72 h if its `closesAt` has passed. The storefront revalidate uses
stale-while-revalidate, so the first request after an open may still show the previous drop; ordering
from it is refused by `isOpen()`.

**Alternatives rejected.** A worker repeatable job calling the API (an internal HTTP surface for one
call). Moving the publish check into a shared library (it needs the POD provider and storage the worker
already has, but would split ownership of "can this open" across two processes). A partial unique index on
`status = 'LIVE'` (Prisma cannot express it, so every future `migrate diff` would try to drop it).

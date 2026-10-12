---
name: motion-check
description: Measure an animated surface against the NOWCORE performance budgets — trace it, check all three quality tiers, check reduced-motion, record the numbers. Use after building or changing any scroll-driven, canvas or transition surface, before calling it done.
---

Cinematic everywhere is a decision that was made with its cost understood. This skill is how that cost
stays paid. A surface nobody measured is a claim, not a feature.

Budgets live in `docs/10-design-system.md` and are enforced by `pnpm nx budget web`. This skill is the
manual pass that catches what a bundle-size budget cannot: jank.

## 1. Build it as the user gets it

```bash
pnpm exec nx build web && pnpm exec nx preview web
```

Never measure the dev server. HMR, source maps and unminified React make the numbers meaningless — a dev
build has shown 22fps on a surface that shipped at 60.

## 2. Trace the scroll

With the Chrome DevTools MCP: start a performance trace, scroll the surface end to end, stop it. Record
from the trace:

- **frame rate p95 while scrolling** — must be ≥ 55fps
- **LCP, CLS, INP** — < 2.5s, < 0.1, < 200ms
- **long tasks** — anything over 50ms during scroll is a defect, not a warning

Throttle to **4x CPU slowdown and Fast 4G**. India-first means the median device is a mid-tier Android on
a mobile network, not the Mac this is being written on.

## 3. Check all three tiers

A tier that was never opened does not work. Force each one and look at it:

- **full** — default
- **reduced** — DevTools network panel set to Slow 4G, or `navigator.connection.saveData` forced true
- **static** — emulate `prefers-reduced-motion: reduce` in DevTools Rendering

The static tier must still be **completely shoppable**: every price, size, variant and buy button
reachable and operable. Degrading motion must never degrade commerce.

## 4. Check the frame sequence

If the surface uses `<CanvasSequence>`: confirm the transferred bytes of the frame set against the budget
(≤ 1.2MB mobile, ≤ 3.0MB desktop) in the network panel, and confirm frames are decoded with
`createImageBitmap` off the main thread — a decode on the main thread shows up in the trace as a sawtooth
of long tasks exactly one per frame.

## 5. Record it

Put the measured numbers in the `docs/08-progress.md` entry, under
`**Watched failing before being trusted:**`. Numbers, not adjectives: `58fps p95, LCP 2.1s, CLS 0.02`.
If a budget failed, say which and by how much — then either fix it or open it as a task, never round it up.

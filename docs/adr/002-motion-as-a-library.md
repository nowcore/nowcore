# ADR-002 — Motion is a library with budgets

**Status:** Accepted, 13 Oct 2026 · **Revised 13 Oct 2026** — no GSAP; see below

**Context.** The operator chose cinematic everywhere. The reference site's hero is a sticky stage plus a
canvas image sequence (fallback image = frame 376), not 3D.

**Decision.** All motion lives in `libs/motion`: `ScrollStage`, `CanvasSequence`, `TextReveal`,
`ChapterRail`, `Marquee`, `Grain`, `MagneticCursor`, `Curtain`, plus tier detection. Apps compose these;
they do not write scroll or animation code. A cached `budget` target fails CI on regression.

**Why.** Motion becomes the most-reused code in the repo. It needs one implementation, visual baselines,
three tiers, and a build that fails when it gets slow.

**Consequences.** Building primitives before pages costs ~4 days up front in Phase 2.

**Alternatives rejected.** Per-page animation code (diverges, unbudgetable). Three.js turntables (a 3D
asset per garment we cannot produce per drop in a day). Framer Motion scroll (no pin primitive).

## Revision — 13 Oct 2026: no GSAP

The decision named Lenis + GSAP ScrollTrigger as the runtime. Built, it needs neither GSAP nor
ScrollTrigger: pinning is CSS `position: sticky` (what morphowater.com's `.flow-stage` does), and stage
progress is one division per animation frame in `libs/motion/src/progress.ts`.

**Why the change.** After Phase 1 the empty shell's initial route was 124.6 KB of the 180 KB budget.
GSAP + ScrollTrigger is roughly 45 KB gzipped for what ~60 lines of sticky + `requestAnimationFrame`
already do. With the whole motion library the hero's route is 128.3 KB (71%).

**Lenis stays**, imported dynamically on the full tier only, after first paint — never in the initial
route. Stages read the real scroll position, so they work identically with or without it.

**Rejected:** keeping GSAP "for future timelines". If a chapter needs sequenced timelines it can import
GSAP lazily inside that chapter; nothing so far does.

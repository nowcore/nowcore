# ADR-002 — Motion is a library with budgets

**Status:** Accepted, 13 Oct 2026

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

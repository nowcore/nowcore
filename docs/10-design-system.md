# 10 — Design system

The canvas is the visual source: [NOWCORE design canvas](https://claude.ai/artifact/PXvXBuUKwzsm5i8gvawop6).
This document is the contract `libs/ui` and `libs/motion` implement.

## Concept — Archive of Now

Every drop is a timestamped artefact of a moment that is already passing. The site is a cold observatory
cataloguing internet culture — dark, precise, instrumented, mono-labelled. The garment is the only warm
object in the room. A closed drop is stamped and archived, never deleted. Scarcity is the product.

## Tokens

```css
:root {
  --void: #08090b; /* ground */
  --ash: #15171b; /* elevated panels, cards, dock */
  --steel: #22252b; /* hairlines and borders — never type */
  --smoke: #8a8e96; /* secondary type — 6.1:1 on void */
  --paper: #f4f3f0; /* primary type — never pure white */
  --signal: #d7ff3e; /* default accent */
  --drop-accent: var(--signal); /* overridden per drop at runtime */
}
```

`--smoke` was moved from the originally planned `#6E7279` to `#8A8E96`: the darker value measured ~4.1:1
on `--void` and fails AA for body copy. `--ghost`, the quiet step below it, is `#7C8088` (was `#6E7279`
"for ≥ 24px only" — a rule the code broke in 66 places; changed 15 Oct 2026 after a Lighthouse pass). It
meets 4.5:1 on `--void`, panels and `--ash`, so it is safe at any size there — but not on `--steel` (3.9:1).

**The accent.** One use at a time: live badge, countdown digits, primary CTA, the active rail tick.
Black type on the accent is the only colour inversion in the system. Each drop sets `accentColor`;
the publish check rejects one that fails as black-on-accent or as text on `--void`.

## Type

| Role      | Face                      | Use                                                                                           |
| --------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| Display   | Geist Sans 400/500/600    | Headlines, nav, buttons. Negative tracking above 24px.                                        |
| Editorial | Instrument Serif _Italic_ | The second line of a headline. Nothing else.                                                  |
| Mono      | Geist Mono 400/500        | All instrumentation: drop numbers, countdowns, prices, SKUs, sizes, dates. Uppercase, 0.18em. |

All OFL and self-hosted: Geist and Geist Mono from the `geist` package, Instrument Serif via `next/font/google`, which downloads it at build time and serves it from our origin (verified: zero runtime requests to Google). Paid upgrade path: PP Neue Montreal for display.

**The two-line move.** Line one grotesque, line two serif italic, same left edge (serif nudged −2 to −4px
optically). `Wear the` / _`moment.`_ This is the single rule that makes the system look designed.

| Token         | Size / leading / tracking             |
| ------------- | ------------------------------------- |
| `--t-film`    | 92 / 0.95 / −0.045em (serif line +8%) |
| `--t-chapter` | 56 / 1.05 / −0.03em                   |
| `--t-lede`    | 21 / 1.55 / 0                         |
| `--t-body`    | 15 / 1.6 / 0                          |
| `--t-micro`   | 11 / 2 / 0.18em mono uppercase        |

## Parts

Floating glass pill nav (top centre) · chapter rail (left: index, ticks, rotated label) · dock (bottom
right: countdown, sound, cart) · product card · archived card with stamp · size pills (sold out struck
through, never hidden) · persistent buy bar on product pages · grain + vignette overlay at 4–6%.

## Motion grammar — `libs/motion`

| Primitive          | Behaviour                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `<ScrollStage>`    | Sticky 100vh stage, emits progress 0→1                                                           |
| `<CanvasSequence>` | 72 AVIF frames at 5°, `createImageBitmap` decode, ±8 pre-warm, fallback frame is the LCP element |
| `<TextReveal>`     | Per-line mask-up + blur-out, 40ms stagger                                                        |
| `<ChapterRail>`    | Index, ticks, rotated label; active tick takes the accent                                        |
| `<Marquee>`        | Seamless; pauses on hover and in reduced-motion                                                  |
| `<Grain>`          | Fixed overlay                                                                                    |
| `<MagneticCursor>` | `pointer: fine` only                                                                             |
| `<Curtain>`        | View Transitions API route wipe                                                                  |

Runtime: CSS `position: sticky` + a `requestAnimationFrame` progress loop; Lenis smoothing loaded lazily on the full tier only (ADR-002, revised — no GSAP). Easing: enter `cubic-bezier(0.16,1,0.3,1)`, exit
`(0.7,0,0.84,0)`, move `(0.65,0,0.35,1)`, scrub linear with 0.6s catch-up.

### Quality tiers

| Tier    | Trigger                                 | Behaviour                                                         |
| ------- | --------------------------------------- | ----------------------------------------------------------------- |
| Full    | 4G, no saveData                         | 72 frames, Lenis, grain, cursor, parallax                         |
| Reduced | 3G, saveData, low `hardwareConcurrency` | 24 frames, native scroll, grain off, cross-fades replace scrubs   |
| Static  | `prefers-reduced-motion: reduce`        | One still, no pinning, opacity-only transitions — fully shoppable |

Chosen once at mount. Same design, degraded honestly.

## Budgets — fail the build

| Metric                       | Budget                           |
| ---------------------------- | -------------------------------- |
| LCP (Fast 4G, 4× CPU)        | < 2.5s                           |
| CLS                          | < 0.1                            |
| INP                          | < 200ms                          |
| Scroll fps, mid-tier Android | ≥ 55 p95                         |
| Home route JS                | ≤ 180KB gzip                     |
| Frame set per colourway      | ≤ 1.2MB mobile · ≤ 3.0MB desktop |

**Measured so far:** the empty web shell is 124.6 KB gzipped on its initial route — 69% of the budget before any motion code. That leaves ~55 KB for `libs/motion`; GSAP + ScrollTrigger + Lenis is roughly 50 KB, so motion should load after first paint rather than in the initial bundle. Everything else above is still a budget, not a measurement.

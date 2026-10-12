---
name: new-drop
description: Take a trend from the radar to a live drop — shortlist, artwork, turntable render, POD variant map, schedule, open. Use when shipping a new NOWCORE drop, or when building or changing any step of that pipeline.
---

This is the business, written down as a procedure. The whole advantage is that it finishes in one day;
every step below exists because skipping it has a specific cost.

## 1. Pick the signal

In the admin trend radar, shortlist one term. It needs **two independent sources** above the score line
within the same 24 hours — a single-source spike is usually one loud thread, and a drop built on it sells
nothing.

Record the sources and scores on the drop. When the drop is reviewed later, the question is always
"was the signal real", and only the captured evidence can answer it.

## 2. Clear it legally

No logos, no character likenesses, no song lyrics, no protected marks, no real person's name or face.
Original typographic or illustrative commentary only. Trending is not the same as free to use, and a
takedown after printing is unrecoverable — the garments already exist.

If it is arguable, it is a no. Write the reasoning on the drop either way.

## 3. Make the artwork

Set the type, lay out the print at 300dpi within the printable area for the chosen blank, export the
transparent PNG. Give the drop its **number** and its **accent colour** — the accent re-tints the entire
site for the drop's life, so pick one that holds up on `--void` at 11% opacity as a glow and at 100% as
black-on-accent for the buy button.

## 4. Render the turntable

Queue the render job in `apps/worker`. It produces 72 AVIF frames at 5° for each colourway, plus the
static fallback frame.

Check the output size against the budget (≤ 1.2MB mobile, ≤ 3.0MB desktop) before accepting it. This is
the step that quietly becomes a day of manual work if the pipeline is broken — if it fails, fix the
pipeline, do not hand-render the frames.

## 5. Map the variants

For every size × colourway, map the NOWCORE variant to its Printrove variant id in `libs/pod`. An
unmapped variant is an order that takes payment and then cannot be fulfilled, which is the single worst
failure this system has.

Verify by placing a sandbox order against each colourway before the drop opens, not after.

## 6. Price it

Base cost + print + shipping + Razorpay fee + GST, then the margin. Check it against
`docs/11-business-model.md`. COD orders carry the RTO allowance — if the drop is COD-eligible, the price
must survive the return rate, not the happy path.

## 7. Schedule and open

Set `opens_at` and `closes_at` — 72 hours is the default and the reason the countdown means anything.
Write the chapter copy. Preview every chapter at 390px before opening; most buyers will never see the
desktop composition.

Opening the drop fires the waitlist notification. That send is not reversible, so the preview is the last
honest checkpoint.

## 8. After it closes

The drop archives itself: desaturated, stamped with its close date, page kept forever, unbuyable. Nothing
is ever restocked — the archive is the only reason the next drop feels urgent.

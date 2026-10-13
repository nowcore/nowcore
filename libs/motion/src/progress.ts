/**
 * Scroll maths for a sticky stage. Pure, so it is tested without a browser.
 *
 * A stage is a tall section whose child is `position: sticky; top: 0`. While
 * the section scrolls past, the child stays pinned and `progress` runs 0 → 1.
 */
export function clamp01(n: number): number {
  // `<=` so -0 (from -top / travel at top = 0) comes back as 0.
  return n <= 0 ? 0 : n >= 1 ? 1 : n;
}

/**
 * @param top          section's getBoundingClientRect().top
 * @param height       section's height
 * @param viewport     window.innerHeight
 */
export function stageProgress(
  top: number,
  height: number,
  viewport: number,
): number {
  const travel = height - viewport;
  if (travel <= 0) return top <= 0 ? 1 : 0;
  return clamp01(-top / travel);
}

/** progress 0..1 → frame index 0..count-1, never out of range. */
export function frameAt(progress: number, count: number): number {
  if (count <= 1) return 0;
  return Math.round(clamp01(progress) * (count - 1));
}

/**
 * Which frames to have decoded around the current one, nearest first, so the
 * frame the scroll lands on next is already a bitmap (±8 by default).
 */
export function prewarmOrder(
  center: number,
  count: number,
  radius = 8,
): number[] {
  const out = [center];
  for (let d = 1; d <= radius; d++) {
    if (center + d < count) out.push(center + d);
    if (center - d >= 0) out.push(center - d);
  }
  return out;
}

/**
 * Maps the shared progress into a sub-range, so one stage can drive several
 * beats: `segment(p, 0.4, 0.75)` is 0 before 40% and 1 after 75%.
 */
export function segment(progress: number, start: number, end: number): number {
  return clamp01((progress - start) / (end - start));
}

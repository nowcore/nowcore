/**
 * Colour arithmetic for the per-drop accent (T-024) and the publish check
 * (docs/05-lld.md §5). WCAG 2.x relative luminance and contrast ratio.
 */
export const VOID = '#08090B';
export const INK_ON_ACCENT = '#08090B';
export const SIGNAL = '#D7FF3E';

const HEX6 = /^#([0-9a-f]{6})$/i;

export function rgb(hex: string): [number, number, number] {
  const m = HEX6.exec(hex);
  if (!m) throw new Error(`expected #RRGGBB, got ${hex}`);
  const n = parseInt(m[1] as string, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(channel) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * A drop's accent has two jobs: text on the void (the LIVE badge, countdown
 * digits) and a fill under near-black type (the buy button). It must pass AA
 * at both, or the drop cannot be published.
 */
export function accentProblems(hex: string): string[] {
  const problems: string[] = [];
  const onVoid = contrast(hex, VOID);
  const underInk = contrast(hex, INK_ON_ACCENT);
  if (onVoid < 4.5)
    problems.push(
      `as text on the void it is ${onVoid.toFixed(2)}:1, needs 4.5:1`,
    );
  if (underInk < 4.5)
    problems.push(
      `under button text it is ${underInk.toFixed(2)}:1, needs 4.5:1`,
    );
  return problems;
}

/** CSS custom properties that re-tint a subtree — or the whole site — for one drop. */
export function accentVars(
  hex: string,
): Record<'--drop-accent' | '--drop-glow', string> {
  const [r, g, b] = rgb(hex);
  return {
    '--drop-accent': hex.toUpperCase(),
    '--drop-glow': `rgb(${r} ${g} ${b} / 0.1)`,
  };
}

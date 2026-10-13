/**
 * Where everything is at a given angle of the turn. Pure, so the shape of the
 * rotation is tested without rendering a pixel.
 *
 * This is a parametric 2.5D turn, not a 3D render: the silhouette narrows
 * towards side-on, the print foreshortens with cos θ and slides with sin θ,
 * the collar flips between front and back, a highlight crosses the fabric.
 * It stands in until there is photography or a garment model, and its output
 * contract (N frames + a still, per colourway) is what those would replace.
 */
export const VIEWBOX = { w: 200, h: 248 } as const;
/** Printable area on the front, in viewBox units (matches the design canvas). */
export const PRINT = { x: 62, y: 92, w: 76, h: 78 } as const;
/** How far the print sits in front of the turn axis, in viewBox units. */
const PRINT_DEPTH = 18;

export interface FrameGeometry {
  angle: number;
  facing: 'front' | 'back';
  /** Horizontal squash of the body, 1 = face-on. */
  bodyScale: number;
  /** 0..1 position of the highlight across the body. */
  highlight: number;
  /** Null when the print is turned away or edge-on. */
  print: { cx: number; width: number } | null;
}

export function frameGeometry(angleDeg: number): FrameGeometry {
  const t = (angleDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const visible = c > 0.08;
  return {
    angle: angleDeg,
    facing: c >= 0 ? 'front' : 'back',
    bodyScale: 0.58 + 0.42 * Math.abs(c),
    highlight: 0.5 - 0.35 * s,
    print: visible
      ? { cx: VIEWBOX.w / 2 - PRINT_DEPTH * s, width: PRINT.w * c }
      : null,
  };
}

/** Angles for an n-frame turn, starting face-on. */
export function angles(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (360 * i) / n);
}

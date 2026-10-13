import sharp from 'sharp';
import { mix, isLight } from './colour.js';
import {
  PRINT,
  VIEWBOX,
  angles,
  frameGeometry,
  type FrameGeometry,
} from './geometry.js';

const BODY =
  'M62,8 L40,18 L6,58 L34,88 L50,72 L50,234 Q50,240 56,240 L144,240 Q150,240 150,234 L150,72 L166,88 L194,58 L160,18 L138,8 Q100,34 62,8 Z';
const COLLAR = {
  front: 'M62,8 Q100,34 138,8',
  back: 'M62,8 Q100,16 138,8',
} as const;

export interface TurntableInput {
  /** Transparent PNG of the print, any size; fitted into the printable area. */
  artwork: Buffer;
  /** Garment colour, from the variant. */
  garmentHex: string;
  frames?: number;
  /** Output width; height follows the garment's aspect. */
  width?: number;
  quality?: number;
}

export interface Turntable {
  frames: Buffer[];
  /** Frame 0, face-on: the LCP image and all the static tier shows. */
  still: Buffer;
  bytes: number;
}

/** One frame's garment, as SVG. The print is composited separately. */
function garmentSvg(
  g: FrameGeometry,
  hex: string,
  width: number,
  height: number,
): string {
  const light = mix(hex, 'white', isLight(hex) ? 0.35 : 0.16);
  const dark = mix(hex, 'black', isLight(hex) ? 0.18 : 0.42);
  const edge = mix(hex, isLight(hex) ? 'black' : 'white', 0.18);
  const hi = Math.max(0.05, Math.min(0.95, g.highlight));
  const cx = VIEWBOX.w / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${VIEWBOX.w} ${VIEWBOX.h}">
  <defs>
    <linearGradient id="fabric" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${dark}"/>
      <stop offset="${hi}" stop-color="${light}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <linearGradient id="fall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.55" stop-color="${hex}" stop-opacity="0"/>
      <stop offset="1" stop-color="${dark}" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <g transform="translate(${cx} 0) scale(${g.bodyScale.toFixed(4)} 1) translate(${-cx} 0)">
    <path d="${BODY}" fill="url(#fabric)" stroke="${edge}" stroke-width="0.7"/>
    <path d="${BODY}" fill="url(#fall)"/>
    <path d="${COLLAR[g.facing]}" fill="none" stroke="${edge}" stroke-width="1.5"/>
  </g>
</svg>`;
}

export async function renderTurntable(
  input: TurntableInput,
): Promise<Turntable> {
  const n = input.frames ?? 72;
  const width = input.width ?? 800;
  const unit = width / VIEWBOX.w;
  const height = Math.round(VIEWBOX.h * unit);
  const quality = input.quality ?? 50;

  // Fit the artwork into the printable area once; each frame only squashes it.
  const art = await sharp(input.artwork)
    .resize({
      width: Math.round(PRINT.w * unit),
      height: Math.round(PRINT.h * unit),
      fit: 'inside',
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  const frames: Buffer[] = [];
  for (const angle of angles(n)) {
    const g = frameGeometry(angle);
    const layers: sharp.OverlayOptions[] = [];
    if (g.print) {
      const w = Math.max(
        1,
        Math.round(art.info.width * (g.print.width / PRINT.w)),
      );
      const squashed = await sharp(art.data)
        .resize({ width: w, height: art.info.height, fit: 'fill' })
        .toBuffer();
      layers.push({
        input: squashed,
        left: Math.round(g.print.cx * unit - w / 2),
        top: Math.round(PRINT.y * unit),
      });
    }
    const frame = await sharp(
      Buffer.from(garmentSvg(g, input.garmentHex, width, height)),
    )
      .composite(layers)
      .avif({ quality, effort: 4 })
      .toBuffer();
    frames.push(frame);
  }
  const still = frames[0] as Buffer;
  return { frames, still, bytes: frames.reduce((t, f) => t + f.length, 0) };
}

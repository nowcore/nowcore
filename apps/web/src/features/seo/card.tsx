import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { INK_ON_ACCENT } from '@nowcore/ui';
import { dropLabel } from '@nowcore/shared';

export const CARD = { width: 1200, height: 630 };

/**
 * The brand faces, as TTF — the card renderer reads TTF/OTF/WOFF, not the
 * WOFF2 the site serves, and its default face has no ₹. Copied from the
 * `geist` package (OFL 1.1, LICENSE-Geist.txt beside them). Read from the app
 * root (next.config.js traces them into the build): `new URL(…, import.meta.url)`
 * gives the bundler's URL, which readFile refuses — and then next/og silently
 * downloads a fallback face from Google at render time instead.
 */
const fonts = Promise.all(
  [
    ['Geist', 'Geist-SemiBold.ttf', 600],
    ['Geist Mono', 'GeistMono-Regular.ttf', 400],
  ].map(async ([name, file, weight]) => ({
    name: name as string,
    data: await readFile(
      join(process.cwd(), 'src/features/seo/fonts', file as string),
    ),
    weight: weight as 400 | 600,
    style: 'normal' as const,
  })),
);

/**
 * The share card (T-093): the drop's own accent, its number, its title. Type
 * only — the turntable stills are AVIF, which the card renderer cannot read,
 * and a label that reads at thumbnail size beats a garment that does not.
 */
export async function shareCard({
  number,
  title,
  accent,
  line,
}: {
  number: number | null;
  title: string;
  accent: string;
  line: string;
}): Promise<ImageResponse> {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: accent,
        color: INK_ON_ACCENT,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 28,
          letterSpacing: 4,
          fontFamily: 'Geist Mono',
        }}
      >
        <span>NOWCORE</span>
        <span>{number ? dropLabel(number) : 'WEAR THE MOMENT'}</span>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 120,
          fontFamily: 'Geist',
          fontWeight: 600,
          lineHeight: 0.95,
          letterSpacing: -4,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', fontSize: 30, fontFamily: 'Geist Mono' }}>
        {line}
      </div>
    </div>,
    { ...CARD, fonts: await fonts },
  );
}

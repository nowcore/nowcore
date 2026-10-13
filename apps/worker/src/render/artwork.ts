import sharp from 'sharp';

/**
 * Typographic artwork for the seed drops, so the pipeline can be exercised
 * end to end without a designer's file. A real drop's artwork is the
 * operator's uploaded PNG (T-066); this only stands in for it.
 */
export async function typographicArtwork(opts: {
  wordmark: string;
  line: string;
  sub: string;
  ink: string;
  accent: string;
}): Promise<Buffer> {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="780">
  <text x="380" y="250" text-anchor="middle" font-family="Menlo, monospace" font-size="118" letter-spacing="14" fill="${opts.ink}">${esc(opts.wordmark)}</text>
  <rect x="50" y="300" width="660" height="22" fill="${opts.accent}"/>
  <text x="380" y="430" text-anchor="middle" font-family="Menlo, monospace" font-size="52" letter-spacing="9" fill="${opts.ink}" fill-opacity="0.72">${esc(opts.line)}</text>
  <text x="380" y="520" text-anchor="middle" font-family="Menlo, monospace" font-size="40" letter-spacing="8" fill="${opts.ink}" fill-opacity="0.45">${esc(opts.sub)}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

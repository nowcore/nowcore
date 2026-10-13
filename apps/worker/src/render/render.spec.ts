import sharp from 'sharp';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { typographicArtwork } from './artwork.js';
import { LocalFrameStore } from './frame-store.js';
import { angles, frameGeometry } from './geometry.js';
import { renderColourway } from './render-colourway.js';
import { renderTurntable } from './turntable.js';

describe('turn geometry', () => {
  it('is face-on at 0°, with the print full width and centred', () => {
    const g = frameGeometry(0);
    expect(g.facing).toBe('front');
    expect(g.bodyScale).toBeCloseTo(1);
    expect(g.print).toEqual({ cx: 100, width: 76 });
  });
  it('hides the print edge-on and on the back', () => {
    expect(frameGeometry(90).print).toBeNull();
    expect(frameGeometry(180).print).toBeNull();
    expect(frameGeometry(180).facing).toBe('back');
  });
  it('narrows the body side-on and foreshortens the print', () => {
    expect(frameGeometry(90).bodyScale).toBeCloseTo(0.58);
    expect(frameGeometry(45).print?.width).toBeCloseTo(
      76 * Math.cos(Math.PI / 4),
    );
  });
  it('takes 72 evenly spaced angles from 0', () => {
    const a = angles(72);
    expect(a).toHaveLength(72);
    expect(a[1]).toBe(5);
    expect(a[71]).toBe(355);
  });
});

describe('render', () => {
  const art = () =>
    typographicArtwork({
      wordmark: 'NOWCORE',
      line: 'TEST',
      sub: 'DROP 000',
      ink: '#ffffff',
      accent: '#d7ff3e',
    });

  it('renders the requested number of AVIF frames at the garment aspect', async () => {
    const t = await renderTurntable({
      artwork: await art(),
      garmentHex: '#15171b',
      frames: 8,
      width: 400,
    });
    expect(t.frames).toHaveLength(8);
    const meta = await sharp(t.frames[0]).metadata();
    expect(meta.format).toBe('heif');
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(496);
    expect(t.still).toBe(t.frames[0]);
  }, 30_000);

  it('shows the print face-on and not from behind', async () => {
    // Same garment, so any difference in the print area is the print.
    const t = await renderTurntable({
      artwork: await art(),
      garmentHex: '#15171b',
      frames: 2,
      width: 400,
    });
    const printArea = { left: 140, top: 190, width: 120, height: 60 };
    const front = await sharp(t.frames[0]).extract(printArea).stats();
    const back = await sharp(t.frames[1]).extract(printArea).stats();
    expect(front.channels[0]?.max).toBeGreaterThan(200);
    expect(back.channels[0]?.max).toBeLessThan(120);
  }, 30_000);

  it('stores both sets under predictable keys, within budget', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nc-frames-'));
    const r = await renderColourway(
      {
        drop: 'drop-test',
        colour: 'BLK',
        garmentHex: '#15171b',
        artwork: await art(),
      },
      new LocalFrameStore(dir),
    );
    expect(r.still).toBe('/frames/drop-test/blk/still.avif');
    expect(r.desktop.urls).toHaveLength(72);
    expect(r.mobile.urls).toHaveLength(24);
    expect(r.desktop.urls[71]).toBe('/frames/drop-test/blk/d/f71.avif');
    expect(await readdir(join(dir, 'drop-test/blk/m'))).toHaveLength(24);
    expect(r.desktop.bytes).toBeLessThan(3 * 1024 * 1024);
    expect(r.mobile.bytes).toBeLessThan(1.2 * 1024 * 1024);
  }, 120_000);

  it('refuses a key that escapes the store', async () => {
    await expect(
      new LocalFrameStore('/tmp/x').put('../etc/passwd', Buffer.from('')),
    ).rejects.toThrow(/unsafe/);
  });
});

import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CanvasSequence,
  Marquee,
  MotionProvider,
  ScrollStage,
  TextReveal,
  detectTier,
  frameAt,
  prewarmOrder,
  segment,
  stageProgress,
  thin,
  createProgressStore,
} from './index.js';

describe('tier detection', () => {
  it('reduced motion always wins, whatever the network', () => {
    expect(
      detectTier({
        reducedMotion: true,
        effectiveType: '4g',
        hardwareConcurrency: 16,
      }),
    ).toBe('static');
  });
  it('drops to reduced on save-data, slow networks and weak CPUs', () => {
    expect(detectTier({ reducedMotion: false, saveData: true })).toBe(
      'reduced',
    );
    expect(detectTier({ reducedMotion: false, effectiveType: '3g' })).toBe(
      'reduced',
    );
    expect(detectTier({ reducedMotion: false, hardwareConcurrency: 2 })).toBe(
      'reduced',
    );
  });
  it('is full on a capable device, and when the browser says nothing', () => {
    expect(
      detectTier({
        reducedMotion: false,
        effectiveType: '4g',
        hardwareConcurrency: 8,
      }),
    ).toBe('full');
    expect(detectTier({ reducedMotion: false })).toBe('full');
  });
});

describe('scroll maths', () => {
  it('runs 0 → 1 across the section, pinned in between', () => {
    // 3 screens tall, 1000px viewport: 2000px of travel.
    expect(stageProgress(0, 3000, 1000)).toBe(0);
    expect(stageProgress(-1000, 3000, 1000)).toBe(0.5);
    expect(stageProgress(-2000, 3000, 1000)).toBe(1);
    expect(stageProgress(400, 3000, 1000)).toBe(0);
    expect(stageProgress(-5000, 3000, 1000)).toBe(1);
  });
  it('never asks for a frame that does not exist', () => {
    expect(frameAt(0, 72)).toBe(0);
    expect(frameAt(1, 72)).toBe(71);
    expect(frameAt(1.4, 72)).toBe(71);
    expect(frameAt(-1, 72)).toBe(0);
    expect(frameAt(0.5, 1)).toBe(0);
  });
  it('prewarms nearest first, within bounds', () => {
    expect(prewarmOrder(0, 72, 3)).toEqual([0, 1, 2, 3]);
    expect(prewarmOrder(10, 72, 2)).toEqual([10, 11, 9, 12, 8]);
    expect(prewarmOrder(71, 72, 2)).toEqual([71, 70, 69]);
  });
  it('maps a beat inside the stage', () => {
    expect(segment(0.3, 0.4, 0.8)).toBe(0);
    expect(segment(0.6, 0.4, 0.8)).toBeCloseTo(0.5);
    expect(segment(0.9, 0.4, 0.8)).toBe(1);
  });
  it('thins 72 frames to 24 that still cover the whole turn', () => {
    const all = Array.from({ length: 72 }, (_, i) => i);
    const t = thin(all, 24);
    expect(t).toHaveLength(24);
    expect(t[0]).toBe(0);
    expect(t[23]).toBe(69);
  });
  it('notifies only on change', () => {
    const s = createProgressStore();
    let calls = 0;
    s.subscribe(() => calls++);
    s.set(0.5);
    s.set(0.5);
    s.set(0.6);
    expect(calls).toBe(2);
  });
});

const frames = Array.from({ length: 72 }, (_, i) => `/f/${i}.avif`);

describe('server render (static tier, first paint for everyone)', () => {
  const html = renderToStaticMarkup(
    <MotionProvider>
      <ScrollStage length={3} label="The signal">
        <CanvasSequence
          frames={frames}
          fallback="/f/still.avif"
          alt="Drop 014 tee"
          width={800}
          height={1000}
        />
        <TextReveal as="h1" lines={['Wear the', 'moment.']} />
      </ScrollStage>
    </MotionProvider>,
  );
  it('ships the still as the only image, high priority, with alt text', () => {
    expect(html).toContain('src="/f/still.avif"');
    expect(html).toContain('alt="Drop 014 tee"');
    expect(html).toMatch(/fetchPriority="high"/i);
    expect(html).not.toContain('<canvas');
  });
  it('does not pin, and the headline text is already there', () => {
    expect(html).toContain('data-stage-pin="none"');
    expect(html).toContain('Wear the');
    expect(html).toContain('moment.');
    expect(html).toContain('data-reveal="static"');
  });
});

describe('client render', () => {
  it('pins and layers a canvas on the full tier', () => {
    const { container } = render(
      <MotionProvider force="full">
        <ScrollStage length={3}>
          <CanvasSequence
            frames={frames}
            fallback="/f/still.avif"
            alt="tee"
            width={800}
            height={1000}
          />
        </ScrollStage>
      </MotionProvider>,
    );
    expect(container.querySelector('[data-stage-pin="sticky"]')).not.toBeNull();
    expect(container.querySelector('section')?.style.height).toBe('300svh');
    expect(container.querySelector('canvas')).not.toBeNull();
    // Until a frame is painted the still stays visible underneath.
    expect(screen.getByAltText('tee').style.opacity).toBe('1');
  });

  it('uses the small frame set on the reduced tier', async () => {
    const fetched: string[] = [];
    // jsdom has no canvas; a stub context lets the loader run.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: () => undefined,
      drawImage: () => undefined,
    } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('fetch', (url: string) => {
      fetched.push(url);
      return new Promise(() => undefined);
    });
    render(
      <MotionProvider force="reduced">
        <ScrollStage>
          <CanvasSequence
            frames={frames}
            reducedFrames={Array.from({ length: 24 }, (_, i) => `/m/${i}.avif`)}
            fallback="/f/still.avif"
            alt="tee"
            width={800}
            height={1000}
          />
        </ScrollStage>
      </MotionProvider>,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(fetched.length).toBeGreaterThan(0);
    expect(fetched.every((u) => u.startsWith('/m/'))).toBe(true);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the static tier free of canvas and pinning', () => {
    const { container } = render(
      <MotionProvider force="static">
        <ScrollStage>
          <CanvasSequence
            frames={frames}
            fallback="/f/still.avif"
            alt="tee"
            width={800}
            height={1000}
          />
        </ScrollStage>
      </MotionProvider>,
    );
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('[data-stage-pin="none"]')).not.toBeNull();
  });

  it('reads the marquee list once to assistive tech', () => {
    render(
      <Marquee label="Trending now">
        <span>touch grass</span>
      </Marquee>,
    );
    const region = screen.getByRole('region', { name: 'Trending now' });
    expect(region.querySelectorAll('.nc-marquee-set')).toHaveLength(2);
    expect(region.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });
});

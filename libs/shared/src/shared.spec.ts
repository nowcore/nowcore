import {
  canTransition,
  Chapters,
  ChapterKey,
  dropLabel,
  AccentHex,
  formatInr,
  isTerminal,
  makeSku,
  OrderStatus,
  Paise,
  parseSku,
  rupees,
} from './index.js';

describe('money', () => {
  it('formats whole rupees without decimals and Indian grouping', () => {
    expect(formatInr(79900)).toBe('₹799');
    expect(formatInr(19176000)).toBe('₹1,91,760');
  });
  it('formats part-rupees to exactly two places', () => {
    expect(formatInr(79950)).toBe('₹799.50');
    expect(formatInr(79901)).toBe('₹799.01');
  });
  it('refuses fractional paise instead of rounding them', () => {
    expect(() => Paise.parse(799.5)).toThrow();
    expect(rupees(799)).toBe(79900);
  });
});

describe('drops', () => {
  it('labels drops with a padded number', () => {
    expect(dropLabel(14)).toBe('DROP 014');
    expect(() => dropLabel(0)).toThrow(RangeError);
  });
  it('normalises accents and refuses shorthand', () => {
    expect(AccentHex.parse('#d7ff3e')).toBe('#D7FF3E');
    expect(() => AccentHex.parse('#fff')).toThrow();
  });
  it('requires all seven chapters in film order', () => {
    const chapters = ChapterKey.options.map((key) => ({
      key,
      kicker: 'k',
      lineOne: 'one',
      lineTwo: 'two',
    }));
    expect(Chapters.safeParse(chapters).success).toBe(true);
    expect(Chapters.safeParse([...chapters].reverse()).success).toBe(false);
    expect(Chapters.safeParse(chapters.slice(1)).success).toBe(false);
  });
});

describe('skus', () => {
  it('round-trips', () => {
    const sku = makeSku({ drop: 14, garment: 'TEE', color: 'blk', size: 'L' });
    expect(sku).toBe('NC-014-TEE-BLK-L');
    expect(parseSku(sku)).toEqual({
      drop: 14,
      garment: 'TEE',
      color: 'BLK',
      size: 'L',
    });
  });
  it('rejects anything off-format', () => {
    expect(() => parseSku('NC-14-TEE-BLK-L')).toThrow();
    expect(() =>
      makeSku({ drop: 14, garment: 'TEE', color: 'B', size: 'L' }),
    ).toThrow();
  });
});

describe('order state machine', () => {
  it('follows the happy path', () => {
    const path = [
      'PENDING',
      'PAID',
      'FULFILMENT_QUEUED',
      'PRINTING',
      'SHIPPED',
      'DELIVERED',
    ] as const;
    path.slice(1).forEach((to, i) => {
      expect(canTransition(path[i] as (typeof path)[number], to)).toBe(true);
    });
  });
  it('refuses to go backwards or skip fulfilment', () => {
    expect(canTransition('SHIPPED', 'PAID')).toBe(false);
    expect(canTransition('PAID', 'SHIPPED')).toBe(false);
    expect(canTransition('DELIVERED', 'RTO')).toBe(false);
  });
  it('lets a failed fulfilment be retried', () => {
    expect(canTransition('FULFILMENT_FAILED', 'FULFILMENT_QUEUED')).toBe(true);
  });
  it('has terminal states with no way out', () => {
    const terminal = OrderStatus.options.filter(isTerminal);
    expect(terminal.sort()).toEqual([
      'CANCELLED',
      'DELIVERED',
      'REFUNDED',
      'RTO',
    ]);
  });
});

describe('client-safe formatting', () => {
  it('has no runtime dependencies, so client components can use it', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(import.meta.dirname, 'format.ts'), 'utf8');
    expect(src).not.toMatch(/^import /m);
  });
});

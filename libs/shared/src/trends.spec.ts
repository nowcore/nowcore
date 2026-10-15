import {
  isNoise,
  keysOf,
  normalise,
  radar,
  SCORE_LINE,
  type TrendRow,
  type TrendSource,
} from './trends.js';

const now = new Date('2026-10-14T12:00:00Z');
let n = 0;
const t = (
  source: TrendSource,
  term: string,
  score: number,
  hoursAgo = 1,
): TrendRow => ({
  id: `t${++n}`,
  source,
  term,
  score,
  url: null,
  seenAt: new Date(now.getTime() - hoursAgo * 3_600_000),
});

describe('normalise', () => {
  it('puts each source on one 0–100 log scale', () => {
    expect(normalise('hn', 1000)).toBe(100);
    expect(normalise('hn', 100)).toBe(67);
    expect(normalise('google_trends', 20_000)).toBe(72);
    expect(normalise('google_trends', 200)).toBeLessThan(SCORE_LINE);
    expect(normalise('youtube', 0)).toBe(0);
    expect(normalise('reddit', 1e9)).toBe(100);
  });
});

describe('isNoise', () => {
  it('drops navigational and fixture searches seen in the live IN feed', () => {
    for (const q of [
      'hk vs sin',
      'aquarius horoscope today',
      'upstox login',
      'tata motors share price',
      'cbse result',
      'india v australia',
    ])
      expect(isNoise(q)).toBe(true);
    // The same kinds of search in Indian languages and romanised Hindi.
    for (const q of [
      'ನಾಳೆಯ ಹವಾಮಾನ', // seen live: Kannada, "tomorrow's weather"
      'आज का मौसम',
      'మేష రాశి ఫలాలు',
      'பொதுத் தேர்வு முடிவுகள்',
      'kerala lottery sambad',
      'aaj ka mausam',
      'gold rate today',
    ])
      expect(isNoise(q)).toBe(true);
    // Regional-language moments are not noise: they are what an India-first radar is for.
    for (const q of ['കോക്രോച്ച് ജനതാ പാര്ട്ടി', 'ಆಧಾರ್'])
      expect(isNoise(q)).toBe(false);
    for (const q of [
      'pm kisan yojana',
      'gemini 4 argon',
      'cockroach janta party',
    ])
      expect(isNoise(q)).toBe(false);
  });
});

describe('keysOf', () => {
  it('keeps meaningful words and adjacent pairs, not stop words or numbers', () => {
    expect(keysOf('Gemini 4 Argon')).toEqual([
      'gemini',
      'argon',
      'gemini argon',
    ]);
    expect(keysOf('The new iPhone')).toEqual(['iphone']);
  });
});

describe('radar', () => {
  it('surfaces a key two sources carry above the line, and nothing one source carries alone', () => {
    const rows = radar(
      [
        t('hn', 'Gemini 4 Argon', 100),
        t('google_trends', 'gemini argon', 61),
        t('hn', 'Thunderbird for iOS', 80),
        t('youtube', 'Apple HomeView review', 70),
      ],
      now,
    );
    expect(rows.map((r) => r.key)).toEqual(['gemini argon']);
    expect(rows[0]?.heat).toBe(161);
    expect(rows[0]?.sources.map((s) => s.source)).toEqual([
      'hn',
      'google_trends',
    ]);
  });

  it('needs both sources above the line, and both inside the window', () => {
    expect(
      radar(
        [
          t('hn', 'Gemini Argon', 100),
          t('reddit', 'gemini argon', SCORE_LINE - 1),
        ],
        now,
      ),
    ).toEqual([]);
    expect(
      radar(
        [t('hn', 'Gemini Argon', 100), t('reddit', 'gemini argon', 90, 30)],
        now,
      ),
    ).toEqual([]);
  });

  it('keeps every trend under the key as evidence, not just the best per source', () => {
    const rows = radar(
      [
        t('hn', 'Gemini Argon benchmarks', 90),
        t('hn', 'Gemini Argon is out', 70),
        t('reddit', 'gemini argon', 80),
      ],
      now,
    );
    expect(rows[0]?.trendIds).toHaveLength(3);
  });

  it('drops a word too common to mean anything', () => {
    const filler = Array.from({ length: 20 }, (_, i) =>
      t(i % 2 ? 'hn' : 'youtube', `cricket alpha${i}`, 90),
    );
    expect(radar(filler, now).map((r) => r.key)).toEqual([]);
  });
});

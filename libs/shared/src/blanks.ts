/**
 * Garment blanks a drop can be made in. The hexes are data — the colour the
 * turntable renderer paints the garment — not styling, which is why this file
 * alone is exempt from the raw-colour rule.
 */
export const BLANKS = [
  { code: 'blk', name: 'Void black', hex: '#15171B' },
  { code: 'bone', name: 'Bone', hex: '#E8E5DE' },
  { code: 'ash', name: 'Ash grey', hex: '#4A4F57' },
  { code: 'moss', name: 'Deep moss', hex: '#2C3A2E' },
] as const;

import { z } from 'zod';

export const DropStatus = z.enum(['DRAFT', 'SCHEDULED', 'LIVE', 'ARCHIVED']);
export type DropStatus = z.infer<typeof DropStatus>;

/** `14` → `DROP 014`. The number is the drop's identity in every surface. */
export function dropLabel(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 999) {
    throw new RangeError(`drop number out of range: ${n}`);
  }
  return `DROP ${String(n).padStart(3, '0')}`;
}

/** A six-digit hex. Shorthand is refused so one colour has one spelling. */
export const AccentHex = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'accent must be a six-digit hex, #RRGGBB')
  .transform((s) => s.toUpperCase());

/**
 * Homepage chapter copy, as the admin CMS stores it (FR-19).
 * The film has seven chapters, 00–06, in this order.
 */
export const ChapterKey = z.enum([
  'the-signal',
  'whats-now',
  'the-drop',
  'the-archive',
  'the-making',
  'the-wall',
  'take-it',
]);
export type ChapterKey = z.infer<typeof ChapterKey>;

export const Chapter = z.object({
  key: ChapterKey,
  kicker: z.string().min(1).max(60),
  /** Line one, set in the grotesque. */
  lineOne: z.string().min(1).max(40),
  /** Line two, set in the serif italic — the two-line move. */
  lineTwo: z.string().min(1).max(40),
  body: z.string().max(400).optional(),
});
export type Chapter = z.infer<typeof Chapter>;

export const Chapters = z
  .array(Chapter)
  .length(ChapterKey.options.length)
  .refine(
    (cs) => cs.every((c, i) => c.key === ChapterKey.options[i]),
    'chapters must appear once each, in film order',
  );

import { z } from 'zod';

export const DropStatus = z.enum(['DRAFT', 'SCHEDULED', 'LIVE', 'ARCHIVED']);
export type DropStatus = z.infer<typeof DropStatus>;

export { dropLabel } from './format.js';

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

/**
 * Drop lifecycle. A drop is drafted, optionally scheduled, opened, and closed
 * into the archive — never reopened: a closed drop is the scarcity the whole
 * label rests on (docs/01 P2).
 */
const DROP_TRANSITIONS: Readonly<Record<DropStatus, readonly DropStatus[]>> = {
  DRAFT: ['SCHEDULED', 'LIVE'],
  SCHEDULED: ['DRAFT', 'LIVE'],
  LIVE: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canDropTransition(from: DropStatus, to: DropStatus): boolean {
  return DROP_TRANSITIONS[from].includes(to);
}

/**
 * Whether a drop takes orders right now. Its time, not only its status: the
 * drop clock runs once a minute and can be late, and the close is the promise
 * (T-084) — a cart or order a second after closesAt is refused either way.
 */
export function isOpen(
  drop: { status: DropStatus; closesAt: Date | null },
  now = new Date(),
): boolean {
  return drop.status === 'LIVE' && (!drop.closesAt || drop.closesAt > now);
}

import { z } from 'zod';

/**
 * Money is integer paise, everywhere (CLAUDE.md, conventions).
 *
 * Floats round. ₹799 is 79,900 paise and stays that; 0.1 + 0.2 never enters a
 * total that a customer is charged. The schema rejects a fractional amount
 * rather than rounding it, because a fractional paise means a bug upstream.
 */
export const Paise = z.number().int().nonnegative();
export type Paise = z.infer<typeof Paise>;

export const rupees = (whole: number): Paise =>
  Paise.parse(Math.round(whole * 100));

export { formatInr } from './format.js';

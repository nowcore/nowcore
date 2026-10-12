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

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** `79900` → `₹799`, `79950` → `₹799.50`, `19176000` → `₹1,91,760`. */
export function formatInr(amount: Paise): string {
  const value = Paise.parse(amount) / 100;
  // Whole rupees print without decimals; anything else prints exactly two.
  return Number.isInteger(value)
    ? inr.format(value)
    : inr.format(value).replace(/(\.\d)$/, '$10');
}

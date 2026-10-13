/**
 * Pure formatting with no dependencies — safe to import from a client
 * component. Everything else in this package carries zod, which is ~60 KB in
 * a browser bundle: importing `formatInr` from the package root put the
 * product page 15 KB over its budget (13 Oct 2026). Client code imports from
 * `@nowcore/shared/format`; server code can use the root.
 */
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** `79900` → `₹799`, `79950` → `₹799.50`, `19176000` → `₹1,91,760`. */
export function formatInr(paise: number): string {
  if (!Number.isInteger(paise) || paise < 0)
    throw new RangeError(`not a paise amount: ${paise}`);
  const value = paise / 100;
  return Number.isInteger(value)
    ? inr.format(value)
    : inr.format(value).replace(/(\.\d)$/, '$10');
}

/** `14` → `DROP 014`. */
export function dropLabel(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 999)
    throw new RangeError(`drop number out of range: ${n}`);
  return `DROP ${String(n).padStart(3, '0')}`;
}

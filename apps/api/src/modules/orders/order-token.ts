import { hmacHex, sameHex } from '../payments/hmac.js';

/**
 * A signed, single-order view token (docs/05 §6). The reference (NC-10427) is
 * sequential and readable, so it must never be the credential — otherwise
 * anyone could walk the numbers into strangers' addresses.
 */
export function orderToken(secret: string, reference: string): string {
  return hmacHex(secret, `order:${reference}`).slice(0, 32);
}

export function validOrderToken(
  secret: string,
  reference: string,
  token: string | undefined,
): boolean {
  return !!token && sameHex(orderToken(secret, reference), token);
}

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * A signed, single-order view token (docs/05 §6). The reference (NC-10427) is
 * sequential and readable, so it must never be the credential — otherwise
 * anyone could walk the numbers into strangers' addresses. Shared so the
 * worker can put the same link in an email that the API will accept.
 */
export function orderToken(secret: string, reference: string): string {
  return createHmac('sha256', secret)
    .update(`order:${reference}`)
    .digest('hex')
    .slice(0, 32);
}

export function validOrderToken(
  secret: string,
  reference: string,
  token: string | undefined,
): boolean {
  if (!token) return false;
  const want = Buffer.from(orderToken(secret, reference));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}

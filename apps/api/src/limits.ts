/**
 * Per-route request limits (docs/05 §6). Everything not listed gets the
 * default body limit and no rate limit. Keys are Fastify's own `METHOD /url`
 * patterns; `applyLimits` refuses to start the API if a key matches no route,
 * so renaming a route cannot quietly drop its limit.
 *
 * Rates are per client IP per minute — generous for a person, small for a
 * script. Webhooks are limited only against floods: providers retry, and a
 * rejected genuine webhook is a payment we do not see.
 */
export const DEFAULT_BODY = 64 * 1024;

export const LIMITS: Record<string, { perMinute?: number; body?: number }> = {
  'POST /orders': { perMinute: 10 },
  'POST /orders/:reference/verify': { perMinute: 20 },
  'POST /carts': { perMinute: 30 },
  'PUT /carts/:id/items': { perMinute: 60 },
  'POST /waitlist': { perMinute: 5 },
  'POST /waitlist/unsubscribe': { perMinute: 5 },
  // Password guessing. Per IP; a lockout per account would let anyone lock the operator out.
  'POST /admin/session': { perMinute: 5 },
  // A page view sends one beacon; a tab-switching visitor a few.
  'POST /rum': { perMinute: 30, body: 4 * 1024 },
  'POST /webhooks/:provider': { perMinute: 600 },
  'POST /webhooks/pod/:provider': { perMinute: 600 },
  // Artwork arrives base64 in JSON: 8 MB of PNG is ~10.7 MB on the wire.
  'POST /admin/drops/:slug/artwork': { body: 12 * 1024 * 1024 },
};

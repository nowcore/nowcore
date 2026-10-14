'use server';
import { PlacedOrder } from '@nowcore/shared';
import { env } from '../../env';
import { cartId } from '../cart/cart';
import { forwarded } from '../../lib/forwarded';

export type PlaceResult =
  | { ok: true; placed: PlacedOrder }
  | {
      ok: false;
      message: string;
      fields: Record<string, string>;
      /**
       * What was submitted, echoed back. React 19 resets an uncontrolled form
       * after its action runs; without this, one typo wiped every field the
       * buyer had typed (found in the browser, 13 Oct 2026).
       */
      values: Record<string, string>;
    };

/**
 * Hands the form to the API, which validates, re-prices and re-checks stock
 * (T-051). Nothing about price or availability is decided here.
 */
export async function placeOrder(
  _prev: PlaceResult | null,
  form: FormData,
): Promise<PlaceResult> {
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const values = Object.fromEntries(
    [
      'email',
      'phone',
      'name',
      'line1',
      'line2',
      'city',
      'pincode',
      'state',
      'pay',
    ].map((k) => [k, s(k)]),
  );
  const id = await cartId();
  if (!id)
    return { ok: false, message: 'Your cart is empty.', fields: {}, values };
  const body = {
    cartId: id,
    email: s('email'),
    phone: s('phone'),
    pay: s('pay') === 'COD' ? 'COD' : 'PREPAID',
    address: {
      name: s('name'),
      line1: s('line1'),
      ...(s('line2') ? { line2: s('line2') } : {}),
      city: s('city'),
      state: s('state'),
      pincode: s('pincode'),
    },
  };
  const res = await fetch(`${env.API_URL}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await forwarded()) },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as {
    message?: string;
    fields?: Record<string, string>;
  };
  if (!res.ok) {
    return {
      ok: false,
      message: json.message ?? 'Could not place the order.',
      fields: json.fields ?? {},
      values,
    };
  }
  return { ok: true, placed: PlacedOrder.parse(json) };
}

/** The payment sheet reported success; the API checks the signature. */
export async function confirmPayment(
  reference: string,
  payment: { providerOrderId: string; paymentId: string; signature: string },
): Promise<{ ok: boolean }> {
  const res = await fetch(`${env.API_URL}/orders/${reference}/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await forwarded()) },
    body: JSON.stringify(payment),
    cache: 'no-store',
  });
  return { ok: res.ok };
}

/**
 * The fake provider's "pay" — only reachable when the API runs PAYMENTS=fake,
 * which it refuses to do in production. Returns what Razorpay's sheet would.
 */
export async function fakePay(
  providerOrderId: string,
): Promise<{ paymentId: string; signature: string } | null> {
  const res = await fetch(
    `${env.API_URL}/dev/fake-payments/${encodeURIComponent(providerOrderId)}/pay`,
    {
      method: 'POST',
      cache: 'no-store',
    },
  );
  return res.ok
    ? ((await res.json()) as { paymentId: string; signature: string })
    : null;
}

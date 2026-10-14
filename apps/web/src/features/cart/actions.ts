'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { CartView, MAX_PER_LINE } from '@nowcore/shared';
import { env } from '../../env';
import { CART_COOKIE, currentCart } from './cart';
import { forwarded } from '../../lib/forwarded';

export type CartResult =
  { ok: true; count: number } | { ok: false; error: string };

async function ensureCart(): Promise<string> {
  const existing = await currentCart();
  if (existing) return existing.id;
  const res = await fetch(`${env.API_URL}/carts`, {
    method: 'POST',
    headers: await forwarded(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`could not create a cart: ${res.status}`);
  const cart = CartView.parse(await res.json());
  (await cookies()).set(CART_COOKIE, cart.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return cart.id;
}

async function put(
  id: string,
  sku: string,
  quantity: number,
): Promise<CartResult> {
  const res = await fetch(`${env.API_URL}/carts/${id}/items`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(await forwarded()) },
    body: JSON.stringify({ sku, quantity }),
    cache: 'no-store',
  });
  if (!res.ok) {
    // The API's message is written for people ("that size has sold out").
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, error: body.message ?? 'Could not update your cart.' };
  }
  const cart = CartView.parse(await res.json());
  revalidatePath('/', 'layout');
  return { ok: true, count: cart.count };
}

/** Adds one, capped at the per-line limit. */
export async function addToCart(sku: string): Promise<CartResult> {
  const id = await ensureCart();
  const cart = await currentCart();
  const current = cart?.lines.find((l) => l.sku === sku)?.quantity ?? 0;
  if (current >= MAX_PER_LINE)
    return { ok: false, error: `Up to ${MAX_PER_LINE} of each per order.` };
  return put(id, sku, current + 1);
}

/** Form action for the cart page's quantity controls. */
export async function setQuantity(form: FormData): Promise<void> {
  const sku = String(form.get('sku') ?? '');
  const quantity = Number(form.get('quantity'));
  const cart = await currentCart();
  if (!cart || !sku || !Number.isInteger(quantity)) return;
  await put(cart.id, sku, Math.max(0, Math.min(MAX_PER_LINE, quantity)));
}

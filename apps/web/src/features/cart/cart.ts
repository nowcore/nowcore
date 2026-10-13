import 'server-only';
import { cookies } from 'next/headers';
import { CartView } from '@nowcore/shared';
import { env } from '../../env';

/**
 * The visitor's cart, server-side only. The id is an unguessable UUID in an
 * httpOnly cookie — possession is access, the same model as a guest checkout
 * link. Never cached: it is one person's state.
 */
export const CART_COOKIE = 'nc_cart';

export async function cartId(): Promise<string | undefined> {
  return (await cookies()).get(CART_COOKIE)?.value;
}

export async function currentCart(): Promise<CartView | null> {
  const id = await cartId();
  if (!id) return null;
  const res = await fetch(`${env.API_URL}/carts/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return CartView.parse(await res.json());
}

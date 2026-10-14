import 'server-only';
import { headers } from 'next/headers';
import { env } from '../env';

/**
 * The buyer's IP for the API's rate limits. Every API call comes from this
 * server, so without it the API would see one address for everyone and
 * every buyer would share one limit. Signed with BFF_SECRET: the API trusts
 * the IP only from us, never from a caller who sets the header themselves.
 */
export async function forwarded(): Promise<Record<string, string>> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip');
  return ip ? { 'x-client-ip': ip, 'x-bff-secret': env.BFF_SECRET } : {};
}

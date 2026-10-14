import { vi } from 'vitest';

/**
 * The admin's API client. Body-less actions (retry, cancel) once sent
 * `content-type: application/json` with no body; Fastify refuses that, so
 * every such action failed from the admin while the API's own tests — which
 * sent no content type — stayed green. This pins the client's half.
 */
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'tok' }) }),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

const calls: { url: string; init: RequestInit }[] = [];
vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
  calls.push({ url, init });
  return new Response(null, { status: 204 });
});

const { post } = await import('./api');

describe('admin api client', () => {
  beforeEach(() => calls.splice(0));

  it('sends no JSON content type on a body-less action', async () => {
    expect(await post('/admin/orders/NC-1/retry')).toEqual({ ok: true });
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['content-type']).toBeUndefined();
    expect(headers['authorization']).toBe('Bearer tok');
  });

  it('sends JSON with a body', async () => {
    await post('/admin/orders/NC-1/refund', { note: 'x' });
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(calls[0]?.init.body).toBe('{"note":"x"}');
  });
});

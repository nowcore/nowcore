import { CartView } from '@nowcore/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../create-app.js';
import { readEnv } from '../../env.js';

/** Against the seeded database: drop 014 live (XS and 2XL sold out), 013 archived. */
describe('cart', () => {
  let app: NestFastifyApplication;
  beforeAll(async () => {
    app = await createApp(
      readEnv({
        QUEUE_PREFIX: 'test-api',
        DROP_CLOCK: 'off',
        RATE_LIMIT: 'off',
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(() => app.close());

  const newCart = async () =>
    CartView.parse(
      (await app.inject({ method: 'POST', url: '/carts' })).json(),
    );
  const put = (id: string, sku: string, quantity: number) =>
    app.inject({
      method: 'PUT',
      url: `/carts/${id}/items`,
      payload: { sku, quantity },
    });

  it('adds, updates and removes a line, pricing from the variant', async () => {
    const cart = await newCart();
    let view = CartView.parse(
      (await put(cart.id, 'NC-014-TEE-BLK-L', 2)).json(),
    );
    expect(view.count).toBe(2);
    expect(view.subtotalPaise).toBe(2 * 79900);
    expect(view.lines[0]).toMatchObject({
      title: 'Mediocre By Design',
      colourName: 'Void black',
      size: 'L',
    });

    view = CartView.parse((await put(cart.id, 'NC-014-TEE-BLK-L', 1)).json());
    expect(view.count).toBe(1);
    view = CartView.parse((await put(cart.id, 'NC-014-TEE-BLK-L', 0)).json());
    expect(view.lines).toHaveLength(0);
  });

  it('refuses a sold-out size and a closed drop', async () => {
    const cart = await newCart();
    expect((await put(cart.id, 'NC-014-TEE-BLK-XS', 1)).statusCode).toBe(409);
    expect((await put(cart.id, 'NC-013-TEE-BLK-L', 1)).statusCode).toBe(409);
  });

  it('refuses quantities outside 1–5 and unknown SKUs', async () => {
    const cart = await newCart();
    expect((await put(cart.id, 'NC-014-TEE-BLK-L', 6)).statusCode).toBe(400);
    expect((await put(cart.id, 'NC-014-TEE-BLK-L', -1)).statusCode).toBe(400);
    expect((await put(cart.id, 'NC-999-TEE-BLK-L', 1)).statusCode).toBe(400);
  });

  it('404s an unknown cart and 400s a malformed id', async () => {
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/carts/00000000-0000-4000-8000-000000000000',
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'GET', url: '/carts/nope' })).statusCode,
    ).toBe(400);
  });
});

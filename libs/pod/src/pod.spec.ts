import {
  PodRejected,
  SandboxPrinter,
  unmapped,
  type PodOrderInput,
} from './index.js';

const order = (
  reference: string,
  podVariantId = 'sbx_NC-014-TEE-BLK-L',
): PodOrderInput => ({
  reference,
  cod: false,
  collectPaise: 0,
  ship: {
    name: 'A',
    phone: '+919845012345',
    line1: '1 Rd',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
  },
  items: [{ podVariantId, sku: 'NC-014-TEE-BLK-L', quantity: 1 }],
});

describe('sandbox printer', () => {
  it('is idempotent on our reference — a retried submission never prints twice', async () => {
    const p = new SandboxPrinter('s');
    const a = await p.createOrder(order('NC-1'));
    const b = await p.createOrder(order('NC-1'));
    expect(b.podOrderId).toBe(a.podOrderId);
    expect((await p.createOrder(order('NC-2'))).podOrderId).not.toBe(
      a.podOrderId,
    );
  });

  it('refuses a variant it does not stock, as a permanent failure', async () => {
    await expect(
      new SandboxPrinter('s').createOrder(order('NC-3', 'printrove_999')),
    ).rejects.toBeInstanceOf(PodRejected);
  });

  it('signs its webhooks and verifies only its own signature', async () => {
    const p = new SandboxPrinter('s');
    const { podOrderId } = await p.createOrder(order('NC-4'));
    const shipped = p.webhook(podOrderId, 'SHIPPED');
    const body = Buffer.from(shipped.body);
    expect(
      p.verifyWebhook(body, { 'x-sandbox-signature': shipped.signature }),
    ).toBe(true);
    expect(p.verifyWebhook(body, { 'x-sandbox-signature': 'nope' })).toBe(
      false,
    );
    expect(
      new SandboxPrinter('other').verifyWebhook(body, {
        'x-sandbox-signature': shipped.signature,
      }),
    ).toBe(false);
    const evt = p.parseWebhook(JSON.parse(shipped.body));
    expect(evt).toMatchObject({ status: 'SHIPPED', podOrderId });
    expect(evt.trackingUrl).toContain(podOrderId);
  });

  it('tells the publish check which mapped ids it does not stock', async () => {
    expect(
      await new SandboxPrinter('s').unknownVariants([
        'sbx_a',
        'printrove_1',
        'sbx_b',
      ]),
    ).toEqual(['printrove_1']);
  });

  it('names every unmapped variant, so the publish check can refuse the drop', () => {
    expect(
      unmapped([
        { sku: 'A', podVariantId: 'x' },
        { sku: 'B', podVariantId: null },
      ]),
    ).toEqual(['B']);
  });
});

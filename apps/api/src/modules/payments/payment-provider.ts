/**
 * The payment port. Orders talk to this; only the adapters know a provider.
 * Mirrors libs/pod's role for fulfilment (ADR-001) — when Cashfree or a
 * second gateway is needed, it is an adapter, not a rewrite of checkout.
 */
export interface ProviderOrder {
  providerOrderId: string;
  /** Public key for the browser's payment sheet, if the provider has one. */
  keyId: string | null;
}

export interface WebhookEvent {
  /** The provider's id for this delivery — the idempotency key. */
  eventId: string;
  kind: 'paid' | 'failed' | 'other';
  providerOrderId: string | null;
  paymentId: string | null;
  method: 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' | null;
}

export interface PaymentProvider {
  readonly name: 'razorpay' | 'fake';
  createOrder(input: {
    amountPaise: number;
    receipt: string;
  }): Promise<ProviderOrder>;
  /** The signature the browser receives when the sheet reports success. */
  verifyCheckout(input: {
    providerOrderId: string;
    paymentId: string;
    signature: string;
  }): boolean;
  /** Authenticity of a webhook, over the exact bytes received. */
  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean;
  parseWebhook(
    body: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookEvent;
  /** For reconciliation: has this provider order been paid? */
  status(providerOrderId: string): Promise<'paid' | 'pending' | 'failed'>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

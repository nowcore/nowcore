import {
  Controller,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { FakeProvider } from '../payments/fake.provider.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../payments/payment-provider.js';

/**
 * Stands in for the payment sheet when PAYMENTS=fake: returns what Razorpay's
 * checkout would hand the browser after a successful payment. Registered only
 * when the fake provider is configured, which env.ts forbids in production.
 */
@Controller('dev/fake-payments')
export class FakePayController {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  @Post(':providerOrderId/pay')
  pay(@Param('providerOrderId') id: string): {
    paymentId: string;
    signature: string;
  } {
    if (!(this.payments instanceof FakeProvider)) throw new NotFoundException();
    return this.payments.pay(id);
  }
}

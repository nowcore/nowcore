import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../../env.js';
import { FakeProvider } from './fake.provider.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';
import { RazorpayProvider } from './razorpay.provider.js';

@Global()
@Module({
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env): PaymentProvider =>
        env.PAYMENTS === 'razorpay'
          ? new RazorpayProvider(
              env.RAZORPAY_KEY_ID as string,
              env.RAZORPAY_KEY_SECRET as string,
              env.RAZORPAY_WEBHOOK_SECRET as string,
            )
          : new FakeProvider(env.FAKE_PAYMENTS_SECRET),
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}

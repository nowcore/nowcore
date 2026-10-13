'use client';
import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatInr } from '@nowcore/shared/format';
import {
  confirmPayment,
  fakePay,
  placeOrder,
  type PlaceResult,
} from './actions';

/**
 * Checkout (T-050, T-052). The film ends here: this surface is calm on
 * purpose (docs/02 F4). Validation happens on the server and comes back per
 * field; the payment sheet belongs to the provider.
 */
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

const field =
  'min-h-12 w-full rounded-[3px] border border-steel bg-ash/40 px-3.5 text-[15px] text-paper outline-none focus:border-paper/60';
const label = 'font-mono text-[10px] uppercase tracking-[0.18em] text-smoke';

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Razorpay did not load'));
    document.head.appendChild(s);
  });
}

export function CheckoutForm({
  states,
  subtotalPaise,
}: {
  states: readonly string[];
  subtotalPaise: number;
}) {
  const router = useRouter();
  const [result, action, placing] = useActionState<
    PlaceResult | null,
    FormData
  >(placeOrder, null);
  const [paying, startPaying] = useTransition();
  const [payMessage, setPayMessage] = useState('');
  const [pay, setPay] = useState<'PREPAID' | 'COD'>('PREPAID');
  const fields = result && !result.ok ? result.fields : {};
  const values = result && !result.ok ? result.values : {};
  const v = (k: string) => values[k] ?? '';
  const placed = result?.ok ? result.placed : null;
  const orderUrl = placed ? `/order/${placed.reference}?t=${placed.token}` : '';

  // COD needs no payment: straight to the order page.
  if (placed && !placed.payment && typeof window !== 'undefined')
    router.replace(orderUrl);

  const err = (k: string) =>
    fields[k] ? (
      <span id={`${k}-err`} className="text-sm text-paper-dim">
        {fields[k]}
      </span>
    ) : null;
  const aria = (k: string) =>
    fields[k] ? { 'aria-invalid': true, 'aria-describedby': `${k}-err` } : {};

  const payNow = () => {
    const p = placed?.payment;
    if (!placed || !p) return;
    startPaying(async () => {
      if (p.provider === 'fake') {
        const r = await fakePay(p.providerOrderId);
        if (!r) return setPayMessage('Test payment failed to start.');
        await confirmPayment(placed.reference, {
          providerOrderId: p.providerOrderId,
          ...r,
        });
        router.replace(orderUrl);
        return;
      }
      try {
        await loadRazorpay();
      } catch {
        setPayMessage(
          'The payment window could not load. Check your connection and try again.',
        );
        return;
      }
      const accent = getComputedStyle(document.body)
        .getPropertyValue('--drop-accent')
        .trim();
      const Razorpay = window.Razorpay;
      if (!Razorpay) return;
      new Razorpay({
        key: p.keyId,
        order_id: p.providerOrderId,
        amount: p.amountPaise,
        currency: 'INR',
        name: 'NOWCORE',
        description: placed.reference,
        theme: { color: accent },
        handler: async (r: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          await confirmPayment(placed.reference, {
            providerOrderId: r.razorpay_order_id,
            paymentId: r.razorpay_payment_id,
            signature: r.razorpay_signature,
          });
          router.replace(orderUrl);
        },
        modal: {
          ondismiss: () =>
            setPayMessage(
              'Payment cancelled. Your order is held — pay when ready.',
            ),
        },
      }).open();
    });
  };

  if (placed?.payment) {
    const p = placed.payment;
    return (
      <section
        aria-labelledby="pay-h"
        className="flex flex-col gap-6 rounded border border-steel bg-ash/40 p-6"
      >
        <h2 id="pay-h" className="text-xl font-medium">
          Order {placed.reference} is held for you.
        </h2>
        {p.provider === 'fake' && (
          <p className="rounded border border-accent/40 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
            Test payments — no money moves. Razorpay replaces this when keys are
            configured.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-5">
          <span className="font-mono text-2xl text-paper">
            {formatInr(p.amountPaise)}
          </span>
          <button
            type="button"
            onClick={payNow}
            disabled={paying}
            className="min-h-[52px] rounded-full bg-accent px-8 text-[15px] font-medium text-void disabled:opacity-50"
          >
            {paying
              ? 'Opening…'
              : p.provider === 'fake'
                ? 'Pay (test)'
                : 'Pay with UPI, card or netbanking'}
          </button>
        </div>
        <p role="status" aria-live="polite" className="text-sm text-smoke">
          {payMessage}
        </p>
      </section>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-7">
      {result && !result.ok && (
        <p
          role="alert"
          className="rounded border border-paper/30 px-4 py-3 text-sm text-paper"
        >
          {result.message}
        </p>
      )}
      <fieldset className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <legend className={`${label} mb-4`}>Contact</legend>
        <label className="flex flex-col gap-2">
          <span className={label}>Email</span>
          <input
            name="email"
            defaultValue={v('email')}
            type="email"
            autoComplete="email"
            required
            className={field}
            {...aria('email')}
          />
          {err('email')}
        </label>
        <label className="flex flex-col gap-2">
          <span className={label}>Mobile</span>
          <input
            name="phone"
            defaultValue={v('phone')}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            className={field}
            {...aria('phone')}
          />
          {err('phone')}
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <legend className={`${label} mb-4`}>Deliver to</legend>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className={label}>Name</span>
          <input
            name="name"
            defaultValue={v('name')}
            autoComplete="name"
            required
            className={field}
            {...aria('address.name')}
          />
          {err('address.name')}
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className={label}>Address</span>
          <input
            name="line1"
            defaultValue={v('line1')}
            autoComplete="address-line1"
            required
            className={field}
            {...aria('address.line1')}
          />
          {err('address.line1')}
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className={label}>Apartment, landmark (optional)</span>
          <input
            name="line2"
            defaultValue={v('line2')}
            autoComplete="address-line2"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={label}>City</span>
          <input
            name="city"
            defaultValue={v('city')}
            autoComplete="address-level2"
            required
            className={field}
            {...aria('address.city')}
          />
          {err('address.city')}
        </label>
        <label className="flex flex-col gap-2">
          <span className={label}>PIN code</span>
          <input
            name="pincode"
            defaultValue={v('pincode')}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            required
            className={field}
            {...aria('address.pincode')}
          />
          {err('address.pincode')}
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className={label}>State</span>
          <select
            name="state"
            autoComplete="address-level1"
            required
            defaultValue={v('state')}
            // A mounted <select> ignores a changed defaultValue; remounting on
            // the echoed value is what restores it after the form resets.
            key={`state-${v('state')}`}
            className={field}
            {...aria('address.state')}
          >
            <option value="" disabled>
              Choose a state
            </option>
            {states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {err('address.state')}
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${label} mb-4`}>Payment</legend>
        {(
          [
            [
              'PREPAID',
              'UPI, card or netbanking',
              subtotalPaise >= 99900 ? 'Free shipping' : '₹80 shipping',
            ],
            [
              'COD',
              'Cash on delivery',
              '₹80 handling · after your first prepaid order',
            ],
          ] as const
        ).map(([value, title, note]) => (
          <label
            key={value}
            className={`flex min-h-14 cursor-pointer items-center gap-4 rounded-[3px] border px-4 ${pay === value ? 'border-accent' : 'border-steel'}`}
          >
            <input
              type="radio"
              name="pay"
              value={value}
              checked={pay === value}
              onChange={() => setPay(value)}
              className="accent-[var(--drop-accent)]"
            />
            <span className="flex-1 text-[15px] text-paper">{title}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ghost">
              {note}
            </span>
          </label>
        ))}
      </fieldset>

      <button
        type="submit"
        disabled={placing}
        className="min-h-[56px] rounded-full bg-accent px-8 text-base font-medium text-void disabled:opacity-50"
      >
        {placing
          ? 'Placing…'
          : pay === 'COD'
            ? 'Place order'
            : 'Continue to payment'}
      </button>
    </form>
  );
}

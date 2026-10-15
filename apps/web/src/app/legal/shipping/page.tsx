import type { Metadata } from 'next';
import {
  COD_FEE,
  FREE_SHIPPING_FROM,
  SHIPPING,
  formatInr,
} from '@nowcore/shared';
import { BUSINESS } from '../../../features/legal/business';
import { LegalPage, List, Section } from '../../../features/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Shipping & returns — NOWCORE',
  description:
    'Delivery times and costs across India, and what happens if something arrives wrong.',
  alternates: { canonical: '/legal/shipping' },
};

/** Draft (T-097), modelled on Indian print-on-demand apparel stores. Numbers come from the checkout itself. */
export default function Shipping() {
  return (
    <LegalPage
      slug="shipping"
      intro="Every NOWCORE piece is printed to order after you buy it — nothing sits in a warehouse. That shapes how shipping, cancellations and returns work, so here it is plainly."
    >
      <Section title="Where we ship">
        <p>
          Anywhere in India our courier partners serve — almost every PIN code.
          If yours turns out to be out of reach, we tell you and refund the
          order in full. We do not ship outside India yet.
        </p>
      </Section>

      <Section title="What it costs">
        <List>
          <li>Free on orders of {formatInr(FREE_SHIPPING_FROM)} or more.</li>
          <li>{formatInr(SHIPPING)} on orders below that.</li>
          <li>
            Cash on delivery adds a {formatInr(COD_FEE)} handling fee — see the{' '}
            <a href="/legal/cod" className="underline">
              COD policy
            </a>
            .
          </li>
          <li>
            Prices include GST. The total you see before paying is the total you
            pay.
          </li>
        </List>
      </Section>

      <Section title="How long it takes">
        <List>
          <li>
            <strong className="text-paper">Printing:</strong> 1–3 business days
            after your order is confirmed.
          </li>
          <li>
            <strong className="text-paper">Delivery:</strong> usually 3–7
            business days after dispatch; remote PIN codes can take up to 10.
          </li>
          <li>
            You get an email with tracking when it ships, and your order page
            always shows where it is.
          </li>
        </List>
        <p>
          Festival seasons, weather and courier strikes can add days. If we
          expect a delay, we will tell you.
        </p>
      </Section>

      <Section title="Cancellations">
        <p>
          Printing starts soon after payment, so an order can be cancelled only
          until it goes to print. Write to {BUSINESS.email} straight away with
          your order reference; if it has not been printed, we cancel it and
          refund you in full. Once printed, it cannot be cancelled — it was made
          for you.
        </p>
        <p>
          We may cancel an order ourselves if we cannot fulfil it (for example a
          payment that arrives long after the drop sold out, or an address we
          cannot deliver to). You are then refunded in full.
        </p>
      </Section>

      <Section title="Returns and exchanges">
        <p>
          Because each piece is printed for you, we do not accept returns or
          exchanges for change of mind or a size that does not suit. Every
          product page shows measurements and fit — please check them before you
          order.
        </p>
      </Section>

      <Section title="If something arrives wrong">
        <p>
          We replace it or refund you in full, at no cost to you, if your order
          arrives:
        </p>
        <List>
          <li>misprinted, damaged or defective;</li>
          <li>in a different size or colour from what you ordered; or</li>
          <li>incomplete.</li>
        </List>
        <p>
          Tell us within{' '}
          <strong className="text-paper">7 days of delivery</strong> at{' '}
          {BUSINESS.email}, with your order reference and clear photos of the
          item and the label (an unboxing video helps). Please keep the item and
          its packaging until we reply. You choose a reprint or a refund; a
          reprint of a closed drop is a replacement, not a restock.
        </p>
        <p>
          If a parcel shows as delivered but never reached you, write within 48
          hours and we will raise it with the courier.
        </p>
      </Section>

      <Section title="Refunds">
        <List>
          <li>
            Prepaid orders are refunded to the original payment method, usually
            within 5–7 business days of approval (your bank can take longer to
            show it).
          </li>
          <li>
            Cash-on-delivery orders are refunded by UPI or bank transfer to
            details you give us.
          </li>
          <li>
            Shipping and COD fees are refunded whenever the problem was ours.
          </li>
        </List>
      </Section>

      <Section title="Parcels that come back to us">
        <p>
          If a parcel returns undelivered because the address was incomplete or
          nobody accepted it, we will contact you. We can reship it once you pay
          the shipping again, or refund the product price minus the two-way
          shipping cost.
        </p>
      </Section>
    </LegalPage>
  );
}

import type { Metadata } from 'next';
import { COD_FEE, formatInr } from '@nowcore/shared';
import { BUSINESS } from '../../../features/legal/business';
import { LegalPage, List, Section } from '../../../features/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Cash on delivery — NOWCORE',
  description:
    'When cash on delivery is available and why the first order is prepaid.',
  alternates: { canonical: '/legal/cod' },
};

/** Draft (T-097). The rules are the ones checkout enforces (docs/11 COD policy). */
export default function Cod() {
  return (
    <LegalPage
      slug="cod"
      intro="We print every order for one person. A refused cash-on-delivery parcel cannot be resold, so cash on delivery comes with a few rules that keep prices low for everyone."
    >
      <Section title="Who can use it">
        <List>
          <li>
            <strong className="text-paper">Your first order is prepaid</strong>{' '}
            — UPI, card, net banking or wallet.
          </li>
          <li>
            Cash on delivery opens for your phone number once a prepaid order
            has been delivered to it.
          </li>
        </List>
      </Section>

      <Section title="What it costs">
        <p>
          A {formatInr(COD_FEE)} handling fee per order, shown at checkout
          before you place it. Prepaid orders never pay it.
        </p>
      </Section>

      <Section title="Confirming your order">
        <p>
          We may call or message you to confirm a cash-on-delivery order before
          we print it. If we cannot reach you within 24 hours, we may cancel it
          — nothing is charged.
        </p>
      </Section>

      <Section title="If a parcel is refused">
        <p>
          Refusing a cash-on-delivery parcel without a reason (it was not
          damaged, wrong or late beyond what we told you) costs us the garment
          and shipping both ways. After a refused parcel, cash on delivery may
          be switched off for that phone number, and we may pause it for a whole
          drop if refusals run high.
        </p>
      </Section>

      <Section title="Paying the courier">
        <List>
          <li>
            Pay the exact amount on your order email — couriers may not carry
            change.
          </li>
          <li>
            Many couriers accept UPI at the door; ask the delivery partner.
          </li>
          <li>
            Never pay more than the order total. If anyone asks, refuse and
            write to {BUSINESS.email}.
          </li>
        </List>
      </Section>
    </LegalPage>
  );
}

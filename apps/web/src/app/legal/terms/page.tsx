import type { Metadata } from 'next';
import { BUSINESS } from '../../../features/legal/business';
import { LegalPage, List, Section } from '../../../features/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of sale — NOWCORE',
  description:
    'The terms you buy from NOWCORE on: drops, orders, prices and designs.',
  alternates: { canonical: '/legal/terms' },
};

/** Draft (T-097). Drops, holds and editions are described as the checkout actually behaves (ADR-008). */
export default function Terms() {
  return (
    <LegalPage
      slug="terms"
      intro={`These terms apply when you buy from NOWCORE, run by ${BUSINESS.legalName}. By placing an order you agree to them, along with our shipping, COD and privacy policies.`}
    >
      <Section title="Drops">
        <List>
          <li>
            Products are sold in <strong className="text-paper">drops</strong>:
            each opens for a limited window (usually 72 hours), shown by the
            countdown on the site. When it closes, that design is not sold
            again.
          </li>
          <li>
            Some drops are{' '}
            <strong className="text-paper">limited editions</strong>. When you
            start checkout, your pieces are held for 15 minutes while you pay.
            If you pay later than that and the edition has sold out meanwhile,
            we will still make your order, or refund it in full if you prefer.
          </li>
          <li>
            We may extend, close early or cancel a drop. If we cancel one you
            have paid for, you are refunded in full.
          </li>
        </List>
      </Section>

      <Section title="Orders and prices">
        <List>
          <li>
            Prices are in Indian rupees and include GST. Shipping and any COD
            fee are shown before you pay.
          </li>
          <li>
            Your order is accepted when payment is confirmed, or when you place
            it if you pay cash on delivery. Until then we may decline it — for
            example if a size sells out, or a price was shown in obvious error.
            You are never charged for an order we decline.
          </li>
          <li>
            The price you pay is fixed when you order; later price changes do
            not affect it.
          </li>
          <li>
            A GST tax invoice is issued for every order; write to us for a copy.
          </li>
        </List>
      </Section>

      <Section title="The products">
        <List>
          <li>
            Each piece is printed to order. Small variations in print placement
            and colour from screen images are normal.
          </li>
          <li>Measurements and care instructions are on every product page.</li>
          <li>
            Cancellations, returns and refunds are covered in{' '}
            <a href="/legal/shipping" className="underline">
              Shipping &amp; returns
            </a>
            .
          </li>
        </List>
      </Section>

      <Section title="Designs and commentary">
        <p>
          The designs, text and images on this site are ours and are protected
          by copyright. Buying a piece gives you the piece, not the right to
          reproduce the design. Our designs are original commentary on public
          moments; they do not claim any endorsement by, or affiliation with,
          anyone they refer to.
        </p>
      </Section>

      <Section title="Using the site">
        <p>
          Please do not misuse the site — for example by automated buying,
          interfering with drops, or attempting to access other people's orders.
          We may cancel orders and block access where we see this.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          Nothing in these terms limits your rights as a consumer under Indian
          law. Beyond those rights, our liability for an order is limited to the
          amount you paid for it, and we are not responsible for delays caused
          by events outside our control, such as courier disruption, natural
          events or strikes.
        </p>
      </Section>

      <Section title="Law and disputes">
        <p>
          These terms are governed by the laws of India. Please contact us first
          — most problems are solved by an email. Any dispute is subject to the
          courts of {BUSINESS.jurisdiction}, without affecting your right to
          approach a consumer commission.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update these terms; the version on this page when you place an
          order is the one that applies to it.
        </p>
      </Section>
    </LegalPage>
  );
}

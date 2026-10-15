import type { Metadata } from 'next';
import { BUSINESS } from '../../../features/legal/business';
import { LegalPage, List, Section } from '../../../features/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy policy — NOWCORE',
  description:
    'What NOWCORE collects, why, who it is shared with, and your rights.',
  alternates: { canonical: '/legal/privacy' },
};

/**
 * Draft (T-097), written to India's Digital Personal Data Protection Act,
 * 2023 and the IT Act. Every claim here is about what the code does — if the
 * code changes what it collects or keeps, this page changes with it.
 */
export default function Privacy() {
  return (
    <LegalPage
      slug="privacy"
      intro={`${BUSINESS.legalName} ("NOWCORE", "we") runs this store. We collect what we need to print and deliver your order and to tell you about drops you asked to hear about — nothing more, and we never sell it.`}
    >
      <Section title="What we collect, and why">
        <List>
          <li>
            <strong className="text-paper">When you order:</strong> your name,
            phone number, email and delivery address, and what you bought. We
            use them to make and deliver your order, to send order and shipping
            emails, and to answer you if you write to us. Your phone number and
            order history also decide whether cash on delivery is available to
            you (see the{' '}
            <a href="/legal/cod" className="underline">
              COD policy
            </a>
            ).
          </li>
          <li>
            <strong className="text-paper">When you pay:</strong> payments are
            handled by Razorpay. Card, UPI and bank details go to them directly;
            we never see or store them. We keep only the payment's status and
            reference.
          </li>
          <li>
            <strong className="text-paper">Drop alerts:</strong> if you sign up,
            your email — used for one message when a drop opens. Every message
            has a one-click unsubscribe.
          </li>
          <li>
            <strong className="text-paper">How the site performs:</strong>{' '}
            anonymous timings (how fast a page loaded, how smoothly it scrolled)
            with the page type and a rough device class (CPU cores, memory,
            network type). No name, no IP address, no device or visitor
            identifier — it cannot be tied to you.
          </li>
          <li>
            <strong className="text-paper">Security:</strong> your IP address is
            used briefly to limit repeated requests (spam and abuse protection)
            and is not stored with anything else about you.
          </li>
        </List>
      </Section>

      <Section title="Cookies">
        <p>
          One cookie, to remember your cart (a random identifier, kept for 30
          days). It is needed for the store to work, so there is nothing to opt
          into. We use no advertising or tracking cookies.
        </p>
      </Section>

      <Section title="Who we share it with">
        <p>
          Only the companies that help us run the store, and only what each
          needs:
        </p>
        <List>
          <li>
            <strong className="text-paper">Razorpay</strong> — payments.
          </li>
          <li>
            <strong className="text-paper">
              Our print partner and its courier partners
            </strong>{' '}
            — your name, phone, address and the items, to print and deliver your
            order.
          </li>
          <li>
            <strong className="text-paper">Our email provider</strong> — your
            email, to send order emails and drop alerts.
          </li>
          <li>
            <strong className="text-paper">
              Our hosting and database providers
            </strong>{' '}
            — they store data on our behalf.
          </li>
        </List>
        <p>
          They act on our instructions and may not use your data for their own
          purposes. We disclose data to authorities only when the law requires
          it.
        </p>
      </Section>

      <Section title="How long we keep it">
        <List>
          <li>
            Orders: as long as tax and accounting laws require us to keep
            invoices and records (up to 8 years).
          </li>
          <li>
            Drop alerts: until you unsubscribe. We keep a record that you
            unsubscribed so we never email you again.
          </li>
          <li>Anonymous performance data: 90 days.</li>
        </List>
      </Section>

      <Section title="Your rights">
        <p>Under the Digital Personal Data Protection Act, 2023 you can:</p>
        <List>
          <li>ask what personal data we hold about you and how we use it;</li>
          <li>ask us to correct or complete it;</li>
          <li>
            ask us to erase it — we will, except what the law requires us to
            keep, such as invoices;
          </li>
          <li>
            withdraw consent, for example by unsubscribing from drop alerts;
          </li>
          <li>nominate someone to exercise these rights for you; and</li>
          <li>
            complain to our grievance officer, and then to the Data Protection
            Board of India.
          </li>
        </List>
        <p>
          Write to {BUSINESS.grievanceEmail}. We reply within 30 days. See{' '}
          <a href="/legal/contact" className="underline">
            Contact &amp; grievances
          </a>
          .
        </p>
      </Section>

      <Section title="Keeping it safe">
        <p>
          Data travels encrypted (HTTPS). Order pages are reached only through a
          signed link sent to you, so an order number alone shows nothing.
          Access to customer data is limited to the people who run the store,
          behind sign-in.
        </p>
      </Section>

      <Section title="Children">
        <p>
          The store is for adults. If you are under 18, please order with a
          parent or guardian. We do not knowingly collect data from children.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we change how we use your data, we update this page and its date.
          If a change matters to you — a new kind of data, or a new purpose — we
          will tell you by email first.
        </p>
      </Section>
    </LegalPage>
  );
}

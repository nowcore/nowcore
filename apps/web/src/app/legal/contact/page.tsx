import type { Metadata } from 'next';
import { BUSINESS } from '../../../features/legal/business';
import { LegalPage, Section } from '../../../features/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Contact & grievances — NOWCORE',
  description: 'How to reach NOWCORE, and the grievance officer.',
  alternates: { canonical: '/legal/contact' },
};

/** Draft (T-097). The seller and grievance details Indian e-commerce rules require on the site. */
export default function Contact() {
  const row = (k: string, v: string) => (
    <div className="flex flex-col gap-0.5 border-b border-steel/60 py-3 sm:flex-row sm:gap-6">
      <dt className="w-44 shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-ghost">
        {k}
      </dt>
      <dd className="text-paper">{v}</dd>
    </div>
  );
  return (
    <LegalPage
      slug="contact"
      intro="Questions about an order, a drop or your data — this is where to reach us. Have your order reference ready (it starts NC-)."
    >
      <Section title="Customer support">
        <dl>
          {row('Email', BUSINESS.email)}
          {row('Phone', BUSINESS.phone)}
          {row('Hours', BUSINESS.hours)}
        </dl>
        <p>
          We reply within one business day. Your order page — the link in your
          order email — always shows its live status.
        </p>
      </Section>

      <Section title="Grievance officer">
        <p>
          If support has not resolved a complaint, or it concerns your personal
          data, write to our grievance officer. We acknowledge within 48 hours
          and resolve within one month.
        </p>
        <dl>
          {row('Name', BUSINESS.grievanceOfficer)}
          {row('Email', BUSINESS.grievanceEmail)}
          {row('Address', BUSINESS.address)}
        </dl>
      </Section>

      <Section title="Seller">
        <dl>
          {row('Business', BUSINESS.legalName)}
          {row('Registered address', BUSINESS.address)}
          {row('GSTIN', BUSINESS.gstin)}
        </dl>
      </Section>
    </LegalPage>
  );
}

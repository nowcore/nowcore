/**
 * The business details the policies name (T-097). Everything in [brackets] is
 * a placeholder to fill before launch: Indian e-commerce rules require the
 * seller's legal name, address and a grievance officer on the site. While any
 * placeholder remains, every legal page says so at the top.
 */
export const BUSINESS = {
  legalName: '[Registered business name]',
  address: '[Registered address, city, state, PIN]',
  gstin: '[GSTIN]',
  email: '[support@yourdomain.in]',
  phone: '[+91 phone number]',
  hours: 'Monday to Saturday, 10:00–18:00 IST',
  grievanceOfficer: '[Grievance officer name]',
  grievanceEmail: '[grievance@yourdomain.in]',
  /** Courts for disputes under the Terms. */
  jurisdiction: '[City]',
} as const;

/** The date these drafts were written; change it whenever a policy changes. */
export const LEGAL_UPDATED = '15 October 2026';

export const DRAFT = Object.values(BUSINESS).some((v) => v.startsWith('['));

export const LEGAL_PAGES = [
  { slug: 'shipping', title: 'Shipping & returns' },
  { slug: 'cod', title: 'Cash on delivery' },
  { slug: 'privacy', title: 'Privacy policy' },
  { slug: 'terms', title: 'Terms of sale' },
  { slug: 'contact', title: 'Contact & grievances' },
] as const;

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DropTheme, SIGNAL } from '@nowcore/ui';
import { fontVariables } from './fonts';
import './global.css';

export const metadata: Metadata = {
  title: 'NOWCORE — wear the moment',
  description:
    'Trend-driven drops. 72 hours, printed to order, never restocked.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // The live drop's accent replaces SIGNAL once the catalogue API lands (T-045).
  return (
    <html lang="en" className={fontVariables}>
      <DropTheme as="body" accent={SIGNAL}>
        {children}
      </DropTheme>
    </html>
  );
}

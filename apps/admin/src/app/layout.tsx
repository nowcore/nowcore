import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { fontVariables } from './fonts';
import './global.css';

export const metadata: Metadata = {
  title: 'NOWCORE admin',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}

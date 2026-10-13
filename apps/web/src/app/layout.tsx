import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Grain, MotionProvider, SmoothScroll } from '@nowcore/motion';
import { DropTheme, SIGNAL } from '@nowcore/ui';
import { liveDrop } from '../lib/api';
import { fontVariables } from './fonts';
import './global.css';

export const metadata: Metadata = {
  title: 'NOWCORE — wear the moment',
  description:
    'Trend-driven drops. 72 hours, printed to order, never restocked.',
};

export const viewport: Viewport = { themeColor: 'black', colorScheme: 'dark' };

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // If the catalogue is unreachable the house signal stands in, so an API
  // blip degrades the colour, not the whole site.
  const accent = await liveDrop().then(
    (d) => d.accentColor,
    () => SIGNAL,
  );
  return (
    <html lang="en" className={fontVariables}>
      {/* The live drop's accent re-tints every surface (CLAUDE.md, rule 1). */}
      <DropTheme as="body" accent={accent}>
        <MotionProvider>
          <SmoothScroll />
          <Grain />
          {children}
        </MotionProvider>
      </DropTheme>
    </html>
  );
}

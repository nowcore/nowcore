import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { Instrument_Serif } from 'next/font/google';

/**
 * The three faces (docs/10-design-system.md). All self-hosted: next/font
 * downloads Instrument Serif at build time and serves it from this origin, so
 * there is no request to Google at runtime.
 */
const editorial = Instrument_Serif({
  weight: '400',
  style: 'italic',
  subsets: ['latin'],
  variable: '--font-editorial',
  display: 'swap',
});

export const fontVariables = [
  GeistSans.variable,
  GeistMono.variable,
  editorial.variable,
].join(' ');

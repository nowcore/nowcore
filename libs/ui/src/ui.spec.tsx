import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  accentProblems,
  accentVars,
  contrast,
  DropTheme,
  SIGNAL,
  VOID,
} from './index.js';

describe('palette contrast (docs/10)', () => {
  it('smoke clears AA on the void; the first-drafted grey did not', () => {
    expect(contrast('#8A8E96', VOID)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#6E7279', VOID)).toBeLessThan(4.5);
  });
  it('paper is high contrast on the void', () => {
    expect(contrast('#F4F3F0', VOID)).toBeGreaterThan(15);
  });
});

describe('drop accents', () => {
  it('accepts every accent drawn on the canvas', () => {
    for (const hex of ['#D7FF3E', '#FF6B1A', '#3E7BFF', '#FF3E88']) {
      expect(accentProblems(hex)).toEqual([]);
    }
  });
  it('rejects an accent too dark to read on the void', () => {
    expect(accentProblems('#1A1A80')).toHaveLength(2);
    // 3.99:1 — close enough to look fine, still a fail.
    expect(accentProblems('#5A6CB0').length).toBeGreaterThan(0);
  });
  it('emits the custom properties that re-tint a subtree', () => {
    expect(accentVars('#ff6b1a')).toEqual({
      '--drop-accent': '#FF6B1A',
      '--drop-glow': 'rgb(255 107 26 / 0.1)',
    });
  });
  it('re-tints on the first server render, with no effect', () => {
    const html = renderToStaticMarkup(
      <DropTheme accent="#FF6B1A">x</DropTheme>,
    );
    expect(html).toContain('--drop-accent:#FF6B1A');
  });
});

describe('token sheet', () => {
  const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');
  it('defines every colour token the Tailwind theme refers to', () => {
    for (const name of [
      'void',
      'ash',
      'steel',
      'smoke',
      'ghost',
      'paper',
      'paper-dim',
      'signal',
    ]) {
      expect(css).toMatch(new RegExp(`--${name}:\\s*#[0-9a-f]{6};`));
    }
    expect(css).toContain('--color-accent: var(--drop-accent)');
  });
});

describe('shared colour constants', () => {
  it('match the token sheet, so the publish check and the site agree', () => {
    const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');
    expect(css.toLowerCase()).toContain(`--void: ${VOID.toLowerCase()};`);
    expect(css.toLowerCase()).toContain(`--signal: ${SIGNAL.toLowerCase()};`);
  });
});

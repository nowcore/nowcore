import type { CSSProperties, ReactNode } from 'react';
import { accentVars } from '@nowcore/shared/color';

/**
 * Re-tints everything inside it for one drop (CLAUDE.md, rule 1).
 * Server-renderable: it is a style attribute, not an effect, so the first
 * paint already has the drop's colour.
 */
export function DropTheme({
  accent,
  children,
  as: Tag = 'div',
}: {
  accent: string;
  children: ReactNode;
  as?: 'div' | 'body' | 'main';
}) {
  return <Tag style={accentVars(accent) as CSSProperties}>{children}</Tag>;
}

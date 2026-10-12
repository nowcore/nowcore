import nextEslintPluginNext from '@next/eslint-plugin-next';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  { plugins: { '@next/next': nextEslintPluginNext } },
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  {
    // One glob for all of them: `next dev` writes `.next`, `next build`
    // writes `.next-build` and the e2e run writes `.next-e2e` — separate so
    // none can corrupt another (see next.config.js). Naming them one at a
    // time meant lint broke the first time a new one appeared, reporting
    // `var` and `@ts-ignore` in generated code nobody wrote.
    ignores: ['.next*/**/*', '**/out-tsc'],
  },
];

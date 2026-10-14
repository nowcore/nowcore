import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/vitest.config.{js,ts,mjs,mts}',
          ],
          // Test tooling is a workspace-root devDependency and must never
          // appear in a package's runtime dependencies.
          ignoredDependencies: ['vitest'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    // Contrast reference values (the void, ink on accent, the house signal):
    // inputs to the WCAG maths, not styling. Must equal libs/ui tokens.css,
    // which libs/ui's own test asserts.
    files: ['src/color.ts', 'src/blanks.ts'],
    rules: { 'nowcore/no-raw-design-values': 'off' },
  },
  {
    ignores: ['**/out-tsc', '**/test-output'],
  },
];

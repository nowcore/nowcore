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
    // This package is where tokens are defined: the one place raw colour and
    // easing values are the point rather than a leak (CLAUDE.md, rule 1).
    rules: { 'nowcore/no-raw-design-values': 'off' },
  },
  {
    ignores: ['**/out-tsc', '**/test-output'],
  },
];

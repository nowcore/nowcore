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
            // Dev-time only: migrations, the local seed and the schema spec
            // run from the workspace, never from a consumer of this package.
            '{projectRoot}/prisma.config.ts',
            '{projectRoot}/prisma/seed.ts',
            '{projectRoot}/src/**/*.spec.ts',
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
    // Colourways and drop accents in the seed are rows of data, not styling —
    // a drop's accent living in the database is what --drop-accent is for.
    files: ['prisma/seed.ts'],
    rules: { 'nowcore/no-raw-design-values': 'off' },
  },
  {
    ignores: ['**/out-tsc', '**/test-output'],
  },
];
